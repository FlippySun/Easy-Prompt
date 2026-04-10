/**
 * Easy Prompt Browser Extension — SSO Authentication
 * 2026-04-10 新增 — SSO Plan v2 B1
 * 变更类型：新增
 * 设计思路：
 *   1. 双路径 SSO 登录：
 *      - 路径 A: chrome.identity.launchWebAuthFlow（Chrome/Firefox/Edge）
 *      - 路径 B: Tab redirect + 扩展内 callback 页面（Safari / fallback）
 *   2. state CSRF 防护闭环：生成 → session storage 存储 → 校验 → 清除
 *   3. Token 存储使用 ep-sso-* 前缀（Plan v2 Gap #6 统一 schema）
 *   4. 后端 API:
 *      - POST /api/v1/auth/sso/token — 授权码换 tokens（无需认证）
 *      - POST /api/v1/auth/refresh — 刷新 access token（无需认证）
 *   5. 旧 ep-access-token 迁移检测（B1a 配合清除）
 * 参数：无外部构造参数
 * 影响范围：options 页面登录/退出、service-worker token 刷新、auth-callback 页面
 * 潜在风险：Safari 不支持 identity API，使用 Tab redirect fallback（已验证后端白名单）
 */

/* ─── Constants ─── */

const SSO_HUB_BASE = "https://zhiz.chat";
const BACKEND_API_BASE = "https://api.zhiz.chat";

// Token 存储 key schema（Plan v2 Gap #6）
const SSO_KEYS = {
  ACCESS_TOKEN: "ep-sso-access-token",
  REFRESH_TOKEN: "ep-sso-refresh-token",
  EXPIRES_AT: "ep-sso-expires-at",
  USER: "ep-sso-user",
  STATE: "ep-sso-state",
};

// 旧版手动 Token key（B1a 迁移时清除）
const LEGACY_TOKEN_KEY = "ep-access-token";

/* ─── Helpers ─── */

/**
 * 检测当前运行时是否支持 launchWebAuthFlow
 * Chrome/Firefox/Edge 支持；Safari 不支持
 */
function supportsLaunchWebAuth() {
  return typeof chrome?.identity?.launchWebAuthFlow === "function";
}

/* ─── State (CSRF) Management ─── */

/**
 * 生成 SSO state 随机值并存储
 * 优先 session storage（不跨重启持久化），fallback local storage
 * @returns {Promise<string>} 生成的 state UUID
 */
async function generateAndStoreState() {
  const state = crypto.randomUUID();
  try {
    await chrome.storage.session.set({ [SSO_KEYS.STATE]: state });
  } catch {
    // session storage 不可用（如旧版 Firefox），fallback local
    await chrome.storage.local.set({ [SSO_KEYS.STATE]: state });
  }
  return state;
}

/**
 * 读取并清除已存储的 state（一次性消费，防重放）
 * @returns {Promise<string|null>}
 */
async function consumeStoredState() {
  let state = null;
  try {
    const data = await chrome.storage.session.get(SSO_KEYS.STATE);
    state = data[SSO_KEYS.STATE] || null;
    if (state) await chrome.storage.session.remove(SSO_KEYS.STATE);
  } catch {
    // fallback: local storage
    const data = await chrome.storage.local.get(SSO_KEYS.STATE);
    state = data[SSO_KEYS.STATE] || null;
    if (state) await chrome.storage.local.remove(SSO_KEYS.STATE);
  }
  return state;
}

/* ─── Token Exchange ─── */

/**
 * 用一次性授权码换取 access/refresh tokens
 * @param {string} code — SSO 授权码（UUID，5min 有效，一次性）
 * @param {string} redirectUri — 与 /sso/authorize 时一致的回调 URI
 * @returns {Promise<{user: object, tokens: {accessToken: string, refreshToken: string, expiresIn: number}}>}
 */
async function exchangeSsoCode(code, redirectUri) {
  const resp = await fetch(`${BACKEND_API_BASE}/api/v1/auth/sso/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirectUri }),
    signal: AbortSignal.timeout(15000),
  });

  const data = await resp.json();
  if (!resp.ok || !data.success) {
    const msg = data.error?.message || "授权码兑换失败";
    throw new Error(msg);
  }

  return data.data; // { user, tokens: { accessToken, refreshToken, expiresIn } }
}

/* ─── Token Storage ─── */

/**
 * 保存 SSO tokens + 用户信息到 chrome.storage.local
 * @param {{user: object, tokens: {accessToken: string, refreshToken: string, expiresIn: number}}} data
 */
async function saveSsoTokens(data) {
  const { user, tokens } = data;
  // expiresIn 单位为秒，转为绝对时间戳（ms）
  const expiresAt = Date.now() + (tokens.expiresIn || 3600) * 1000;

  await chrome.storage.local.set({
    [SSO_KEYS.ACCESS_TOKEN]: tokens.accessToken,
    [SSO_KEYS.REFRESH_TOKEN]: tokens.refreshToken,
    [SSO_KEYS.EXPIRES_AT]: expiresAt,
    [SSO_KEYS.USER]: user,
  });
}

/**
 * 获取已存储的 SSO access token
 * @returns {Promise<string|null>}
 */
async function getAccessToken() {
  try {
    const data = await chrome.storage.local.get(SSO_KEYS.ACCESS_TOKEN);
    return data[SSO_KEYS.ACCESS_TOKEN] || null;
  } catch {
    return null;
  }
}

/**
 * 获取已存储的用户信息
 * @returns {Promise<object|null>} { id, email, username, displayName, avatarUrl, role }
 */
async function getSsoUser() {
  try {
    const data = await chrome.storage.local.get(SSO_KEYS.USER);
    return data[SSO_KEYS.USER] || null;
  } catch {
    return null;
  }
}

/**
 * 获取 access token 过期时间（绝对 ms 时间戳）
 * @returns {Promise<number>} 0 表示无 token
 */
async function getExpiresAt() {
  try {
    const data = await chrome.storage.local.get(SSO_KEYS.EXPIRES_AT);
    return data[SSO_KEYS.EXPIRES_AT] || 0;
  } catch {
    return 0;
  }
}

/**
 * 清除所有 SSO tokens（退出登录）
 */
async function clearSsoTokens() {
  await chrome.storage.local.remove([
    SSO_KEYS.ACCESS_TOKEN,
    SSO_KEYS.REFRESH_TOKEN,
    SSO_KEYS.EXPIRES_AT,
    SSO_KEYS.USER,
  ]);
}

/* ─── Token Refresh ─── */

/**
 * 用 refresh token 刷新 access token
 * 失败时自动清除 tokens（登录过期）
 * @returns {Promise<{accessToken: string, refreshToken: string, expiresIn: number}>}
 */
async function refreshAccessToken() {
  const stored = await chrome.storage.local.get(SSO_KEYS.REFRESH_TOKEN);
  const refreshToken = stored[SSO_KEYS.REFRESH_TOKEN];
  if (!refreshToken) {
    throw new Error("无 refresh token，请重新登录");
  }

  const resp = await fetch(`${BACKEND_API_BASE}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    signal: AbortSignal.timeout(15000),
  });

  const result = await resp.json();
  if (!resp.ok || !result.success) {
    // refresh 失败 → 清除 tokens，用户需重新登录
    await clearSsoTokens();
    throw new Error(result.error?.message || "登录已过期，请重新登录");
  }

  // 保存新 tokens（refresh token 也会轮转）
  const tokens = result.data.tokens;
  const expiresAt = Date.now() + (tokens.expiresIn || 3600) * 1000;
  await chrome.storage.local.set({
    [SSO_KEYS.ACCESS_TOKEN]: tokens.accessToken,
    [SSO_KEYS.REFRESH_TOKEN]: tokens.refreshToken,
    [SSO_KEYS.EXPIRES_AT]: expiresAt,
  });

  return tokens;
}

/* ─── Login Flows ─── */

/**
 * 路径 A — chrome.identity.launchWebAuthFlow（Chrome/Firefox/Edge）
 * 弹出浏览器内置 OAuth 窗口，用户登录后自动获取 code
 * @returns {Promise<object>} 登录用户信息
 */
async function loginViaLaunchWebAuth() {
  const state = await generateAndStoreState();
  const redirectUrl = chrome.identity.getRedirectURL("callback");

  const loginUrl =
    `${SSO_HUB_BASE}/auth/login?` +
    new URLSearchParams({
      redirect_uri: redirectUrl,
      state: state,
    }).toString();

  // launchWebAuthFlow 返回完整 redirect URL（含 code + state 参数）
  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: loginUrl,
    interactive: true,
  });

  if (!responseUrl) {
    throw new Error("登录已取消");
  }

  // 解析 responseUrl 中的 code 和 state
  const url = new URL(responseUrl);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  if (!code) {
    throw new Error("未获取到授权码，请重试");
  }

  // CSRF 校验（Plan v2 Gap #5）
  const storedState = await consumeStoredState();
  if (!storedState || storedState !== returnedState) {
    throw new Error("登录验证失败（CSRF），请重试");
  }

  // 用授权码换取 tokens
  const tokenData = await exchangeSsoCode(code, redirectUrl);
  await saveSsoTokens(tokenData);

  return tokenData.user;
}

/**
 * 路径 B — Tab redirect（Safari / fallback）
 * 打开新 Tab 到 zhiz.chat 登录页，登录后 redirect 回扩展内 callback 页面
 * 注意：此函数在打开 Tab 后立即返回，token 获取由 auth-callback 页面脚本异步完成
 * @returns {Promise<void>}
 */
async function loginViaTabRedirect() {
  const state = await generateAndStoreState();
  const redirectUrl = chrome.runtime.getURL("auth-callback/index.html");

  const loginUrl =
    `${SSO_HUB_BASE}/auth/login?` +
    new URLSearchParams({
      redirect_uri: redirectUrl,
      state: state,
    }).toString();

  // 打开新 Tab，后续由 auth-callback 页面脚本完成 code exchange
  await chrome.tabs.create({ url: loginUrl });
}

/**
 * 统一 SSO 登录入口
 * 自动选择路径 A（launchWebAuthFlow）或路径 B（Tab redirect）
 * 路径 A 返回用户信息；路径 B 返回 null（异步完成）
 * @returns {Promise<object|null>} 用户信息（路径 A）或 null（路径 B，异步完成）
 */
async function ssoLogin() {
  if (supportsLaunchWebAuth()) {
    return await loginViaLaunchWebAuth();
  } else {
    await loginViaTabRedirect();
    return null; // 路径 B 是异步的，token 由 callback 页面处理
  }
}

/**
 * 退出登录 — 清除所有 SSO tokens
 */
async function ssoLogout() {
  await clearSsoTokens();
}

/* ─── Legacy Migration ─── */

/**
 * 检查旧 ep-access-token 并清除（B1a 迁移逻辑）
 * @returns {Promise<boolean>} true 如果发现并清除了旧 token（需提示用户重新 SSO 登录）
 */
async function migrateLegacyToken() {
  try {
    const data = await chrome.storage.local.get(LEGACY_TOKEN_KEY);
    const oldToken = data[LEGACY_TOKEN_KEY];
    if (oldToken) {
      await chrome.storage.local.remove(LEGACY_TOKEN_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/* ─── Export ─── */

// eslint-disable-next-line no-unused-vars
const Sso = {
  SSO_KEYS,
  SSO_HUB_BASE,
  BACKEND_API_BASE,
  LEGACY_TOKEN_KEY,
  supportsLaunchWebAuth,
  generateAndStoreState,
  consumeStoredState,
  exchangeSsoCode,
  saveSsoTokens,
  getAccessToken,
  getSsoUser,
  getExpiresAt,
  clearSsoTokens,
  refreshAccessToken,
  ssoLogin,
  ssoLogout,
  migrateLegacyToken,
};
export { Sso };
