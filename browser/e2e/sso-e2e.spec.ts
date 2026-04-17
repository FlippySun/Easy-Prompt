/**
 * SSO 端到端实机测试 — 针对已部署的生产环境
 * 2026-04-10 新增 — SSO Plan v2 Phase C 验证
 *
 * 设计思路：
 *   - 使用 test.describe.serial 确保测试按顺序执行
 *   - 整个套件只在 T2 中执行 1 次浏览器登录，后续测试复用 token
 *   - 避免 Playwright request API 的 TLS/rate-limit 问题，全部通过浏览器 context fetch
 *   - Rate limiter 配置：5 次/60 秒窗口，必须最小化登录次数
 *
 * 测试项：
 *   T1: Web-Hub 登录页可访问 + 表单可交互
 *   T2: Web-Hub SSO 登录全流程（login → authorize → redirect → token exchange）
 *   T3: Web SPA SSO 回调处理（独立 code → token exchange → localStorage）
 *   T4: Web-Hub 注册页 + SSO 参数透传
 *   T5: Web SPA 主页 + SSO 登录按钮
 *   T6: SSO 安全性 — 非法 redirect_uri 被拒绝
 */

import { test, expect } from "@playwright/test";

/**
 * 2026-04-17 新增 — Browser Task 5 生产 E2E fixture 常量
 * 变更类型：新增/测试
 * 功能描述：显式声明本套件命中的 Web-Hub / Web SPA / Backend URL 均为生产 acceptance fixture，而不是浏览器扩展运行时默认值。
 * 设计思路：Task 5 要求运行时代码 env-aware，但这组 Playwright 用例仍专门验证已部署生产环境，因此保留稳定线上地址并通过命名区分语义。
 * 参数与返回值：`PROD_WEB_HUB_URL_FIXTURE` / `PROD_WEB_SPA_URL_FIXTURE` / `PROD_API_BASE_FIXTURE` 为常量字符串，无运行时副作用。
 * 影响范围：browser/e2e/sso-e2e.spec.ts。
 * 潜在风险：无已知风险。
 */
const PROD_WEB_HUB_URL_FIXTURE = "https://zhiz.chat";
const PROD_WEB_SPA_URL_FIXTURE = "https://prompt.zhiz.chat";
const PROD_API_BASE_FIXTURE = "https://api.zhiz.chat";
const PROD_WEB_SPA_HOST_FIXTURE = new URL(PROD_WEB_SPA_URL_FIXTURE).hostname;

const TEST_USER = {
  email: "sso_test@zhiz.chat",
  password: "SsoTest2026!",
  username: "sso_test_user",
};

// 共享 token（T2 登录后存储，T3/T6 复用）
let sharedAccessToken: string | null = null;

test.describe.serial("SSO E2E Tests", () => {
  // 拦截 Web-Hub 自动发起的 auth 请求（GET /auth/me + POST /auth/refresh），
  // 避免消耗 rate limiter 配额（5 req/60s on /api/v1/auth/*）。
  // 只放行测试实际需要的：POST /auth/login、/auth/sso/authorize、/auth/sso/token。
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/v1/auth/**", (route) => {
      const url = route.request().url();
      const method = route.request().method();
      // 放行测试核心操作
      if (
        method === "POST" &&
        (url.includes("/auth/login") || url.includes("/auth/sso/"))
      ) {
        return route.continue();
      }
      // 拦截其他所有 auth 请求（GET /auth/me、POST /auth/refresh 等）
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "Not authenticated" }),
      });
    });
  });

  // ─── T1: Web-Hub 登录页可访问 + 表单元素完整 ───
  test("T1: Web-Hub login page loads with form elements", async ({ page }) => {
    await page.goto(`${PROD_WEB_HUB_URL_FIXTURE}/auth/login`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });

    await expect(page.locator("h1")).toContainText("登录");
    await expect(page.locator("input#email")).toBeVisible();
    await expect(page.locator("input#password")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('a[href*="/auth/register"]')).toBeVisible();
    await expect(page.getByText("GitHub 登录")).toBeVisible();
    await expect(page.getByText("Google 登录")).toBeVisible();
  });

  // ─── T4: Web-Hub 注册页 + SSO 参数透传（放在登录前，不消耗 login quota） ───
  test("T4: Web-Hub register page preserves SSO params", async ({ page }) => {
    const redirectUri = `${PROD_WEB_SPA_URL_FIXTURE}/`;
    const state = "e2e-register-state";

    await page.goto(
      `${PROD_WEB_HUB_URL_FIXTURE}/auth/login?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`,
      { waitUntil: "networkidle", timeout: 15000 },
    );

    const registerLink = page.locator('a[href*="/auth/register"]');
    await expect(registerLink).toBeVisible();

    const href = await registerLink.getAttribute("href");
    expect(href).toContain("redirect_uri=");
    expect(href).toContain("state=");

    await registerLink.click();
    await page.waitForURL("**/auth/register**", { timeout: 10000 });

    await expect(page.locator("input#email")).toBeVisible();
    await expect(page.locator("input#password")).toBeVisible();
  });

  // ─── T5: Web SPA 主页 + SSO 登录按钮（无需登录） ───
  test("T5: Web SPA home page has SSO login button", async ({ page }) => {
    await page.goto(PROD_WEB_SPA_URL_FIXTURE, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    expect(new URL(page.url()).hostname).toBe(PROD_WEB_SPA_HOST_FIXTURE);

    const ssoButton = page
      .locator(
        '[id*="sso"], [class*="sso"], button:has-text("登录"), a:has-text("登录")',
      )
      .first();
    await expect(ssoButton).toBeVisible({ timeout: 5000 });
  });

  // ─── T2: Web-Hub SSO 登录全流程（唯一一次浏览器登录） ───
  test("T2: Web-Hub SSO login with redirect_uri and state", async ({
    page,
  }) => {
    const testState = "e2e-csrf-state-" + Date.now();
    const redirectUri = `${PROD_WEB_SPA_URL_FIXTURE}/`;

    // 模拟真实 SSO 流程：先在生产 Web SPA fixture 设置 CSRF state（ssoLogin() 做的事）
    await page.goto(PROD_WEB_SPA_URL_FIXTURE, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.evaluate((state) => {
      localStorage.setItem("ep-sso-state", state);
    }, testState);

    // 然后跳到生产 Web-Hub fixture 登录页（模拟 ssoLogin() 的 redirect）
    await page.goto(
      `${PROD_WEB_HUB_URL_FIXTURE}/auth/login?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(testState)}`,
      { waitUntil: "networkidle", timeout: 15000 },
    );

    await page.fill("input#email", TEST_USER.email);
    await page.fill("input#password", TEST_USER.password);

    // 拦截 login 响应（获取 token 供后续测试复用）
    const loginRespPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/auth/login") &&
        res.request().method() === "POST",
      { timeout: 15000 },
    );

    // 拦截 SSO authorize 响应
    const authorizeRespPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/auth/sso/authorize") &&
        res.request().method() === "POST",
      { timeout: 15000 },
    );

    await page.click('button[type="submit"]');

    // 验证 login 成功
    const loginResp = await loginRespPromise;
    expect(loginResp.status()).toBe(200);

    // 从 login 响应中提取 token 供后续复用
    try {
      const loginBody = await loginResp.json();
      sharedAccessToken = loginBody?.data?.tokens?.accessToken ?? null;
    } catch {
      // response body 可能因 redirect 不可读，从 localStorage 兜底
    }

    // 验证 SSO authorize 返回 200
    const authorizeResp = await authorizeRespPromise;
    expect(authorizeResp.status()).toBe(200);

    // 等待 redirect 到生产 Web SPA fixture
    await page.waitForURL((url) => url.hostname === PROD_WEB_SPA_HOST_FIXTURE, {
      timeout: 15000,
    });
    expect(new URL(page.url()).hostname).toBe(PROD_WEB_SPA_HOST_FIXTURE);

    // 等待 handleSsoCallbackOnLoad 完成 token exchange
    await page.waitForTimeout(2000);
    const storedToken = await page.evaluate(() =>
      localStorage.getItem("ep-sso-access-token"),
    );
    expect(storedToken).toBeTruthy();
  });

  // ─── T3: Web SPA SSO 回调处理（用浏览器 fetch 获取 SSO code） ───
  test("T3: Web SPA handles SSO callback (code exchange)", async ({ page }) => {
    // 增加超时以容纳 rate-limit 重试等待
    test.setTimeout(90_000);

    // 先到 Web-Hub 获取 SSO code（通过浏览器 fetch，含 429 自动重试）
    await page.goto(PROD_WEB_HUB_URL_FIXTURE, {
      waitUntil: "networkidle",
      timeout: 15000,
    });

    const ssoResult = await page.evaluate(
      async ({ apiBase, token, redirectUri, user }) => {
        let accessToken = token;
        if (!accessToken) {
          const loginRes = await fetch(`${apiBase}/api/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: user.email,
              password: user.password,
            }),
          });
          if (!loginRes.ok)
            return { error: `login ${loginRes.status}`, code: null };
          const d = await loginRes.json();
          accessToken = d.data.tokens.accessToken;
        }

        // 带 429 重试的 authorize 调用（rate limiter 窗口 60s）
        for (let attempt = 0; attempt < 4; attempt++) {
          const ssoRes = await fetch(`${apiBase}/api/v1/auth/sso/authorize`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ redirectUri, state: "e2e-callback-test" }),
          });
          if (ssoRes.ok) {
            const ssoData = await ssoRes.json();
            return { error: null, code: ssoData.data.code };
          }
          if (ssoRes.status === 429 && attempt < 3) {
            // 等待 20 秒后重试
            await new Promise((r) => setTimeout(r, 20_000));
            continue;
          }
          return { error: `authorize ${ssoRes.status}`, code: null };
        }
        return { error: "max retries", code: null };
      },
      {
        apiBase: PROD_API_BASE_FIXTURE,
        token: sharedAccessToken,
        redirectUri: `${PROD_WEB_SPA_URL_FIXTURE}/`,
        user: TEST_USER,
      },
    );

    expect(ssoResult.error).toBeNull();
    expect(ssoResult.code).toBeTruthy();
    const ssoCode = ssoResult.code!;

    // 在 Web SPA 上设置 state 并模拟回调
    await page.goto(PROD_WEB_SPA_URL_FIXTURE, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.evaluate(() => {
      localStorage.setItem("ep-sso-state", "e2e-callback-test");
    });

    // 拦截 token exchange 响应
    const tokenExchangePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/auth/sso/token") && res.status() === 200,
      { timeout: 10000 },
    );

    await page.goto(
      `${PROD_WEB_SPA_URL_FIXTURE}/?code=${ssoCode}&state=e2e-callback-test`,
      {
        waitUntil: "networkidle",
        timeout: 15000,
      },
    );

    // 验证 token exchange 成功
    const tokenResponse = await tokenExchangePromise;
    const tokenBody = await tokenResponse.json();
    expect(tokenBody.success).toBe(true);
    expect(tokenBody.data.tokens.accessToken).toBeTruthy();
    expect(tokenBody.data.user.username).toBe(TEST_USER.username);

    // 验证 token 存储
    const storedToken = await page.evaluate(() =>
      localStorage.getItem("ep-sso-access-token"),
    );
    expect(storedToken).toBeTruthy();

    // 验证 URL 参数已清除
    const currentUrl = new URL(page.url());
    expect(currentUrl.searchParams.has("code")).toBe(false);
  });

  // ─── T6: SSO 安全性 — 非法 redirect_uri 被拒绝（复用 token，0 次额外登录） ───
  test("T6: SSO rejects invalid redirect_uri", async ({ page }) => {
    await page.goto(PROD_WEB_HUB_URL_FIXTURE, {
      waitUntil: "networkidle",
      timeout: 15000,
    });

    const result = await page.evaluate(
      async ({ apiBase, token, user }) => {
        // 复用 shared token，如无则登录
        let accessToken = token;
        if (!accessToken) {
          const loginRes = await fetch(`${apiBase}/api/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: user.email,
              password: user.password,
            }),
          });
          if (!loginRes.ok) return { error: `login ${loginRes.status}` };
          const d = await loginRes.json();
          accessToken = d.data.tokens.accessToken;
        }

        const res = await fetch(`${apiBase}/api/v1/auth/sso/authorize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            redirectUri: "https://evil.com/steal-token",
            state: "malicious",
          }),
        });
        return {
          error: null,
          status: res.status,
          body: await res.json(),
        };
      },
      {
        apiBase: PROD_API_BASE_FIXTURE,
        token: sharedAccessToken,
        user: TEST_USER,
      },
    );

    expect(result.error).toBeNull();
    expect(result.status).not.toBe(200);
    expect(result.body.success).toBe(false);
  });
});
