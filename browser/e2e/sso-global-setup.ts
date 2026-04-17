/**
 * SSO E2E 全局 Setup — 等待 rate limiter 窗口清零
 * 2026-04-10 新增
 * 设计思路：
 *   后端 loginLimiter 对 /api/v1/auth/* 限制 5 req/60s（滑动窗口）。
 *   多次测试运行间可能残留配额消耗，此 setup 在测试开始前
 *   探测 rate limiter 状态，若受限则等待窗口过期后再开始。
 * 影响范围：仅 SSO E2E 测试
 * 潜在风险：无已知风险
 */

/**
 * 2026-04-17 新增 — Browser Task 5 生产 API fixture 常量
 * 变更类型：新增/测试
 * 功能描述：显式声明本文件探测的 API base 是生产 acceptance fixture，而不是浏览器扩展运行时默认地址。
 * 设计思路：Task 5 只要求扩展运行时代码 env-aware；此全局 setup 仍服务于已部署生产环境的 E2E 预检，因此保留稳定线上地址常量。
 * 参数与返回值：`PROD_API_BASE_FIXTURE` 为常量字符串，无运行时副作用。
 * 影响范围：browser/e2e/sso-global-setup.ts。
 * 潜在风险：无已知风险。
 */
const PROD_API_BASE_FIXTURE = "https://api.zhiz.chat";

async function globalSetup() {
  const MAX_WAIT_MS = 70_000;
  const POLL_INTERVAL_MS = 10_000;

  const startTime = Date.now();
  console.log("[SSO Setup] Checking rate limiter status...");

  while (Date.now() - startTime < MAX_WAIT_MS) {
    try {
      const res = await fetch(`${PROD_API_BASE_FIXTURE}/api/v1/auth/me`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      if (res.status !== 429) {
        console.log(
          `[SSO Setup] Rate limiter clear (HTTP ${res.status}), proceeding.`,
        );
        return;
      }
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(
        `[SSO Setup] Rate limited (429), waiting... (${elapsed}s elapsed)`,
      );
    } catch (err: unknown) {
      console.log(
        `[SSO Setup] Probe failed: ${err instanceof Error ? err.message : err}, retrying...`,
      );
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  console.log("[SSO Setup] Max wait exceeded, proceeding anyway.");
}

export default globalSetup;
