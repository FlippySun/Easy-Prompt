/**
 * Easy Prompt Web — 后端 API 客户端 + SSO 认证
 * 2026-04-13 Vite 迁移：从 app.js §7b 提取为独立 ESM 模块
 *
 * [类型]     重构（模块化）
 * [描述]     将后端增强 API 调用、SSO token 管理提取为独立模块
 * [影响范围] ui/index.js（handleGenerate 调用 dualTrackEnhance）
 * [潜在风险] 无已知风险
 */

import { CLIENT_VERSION, CLIENT_PLATFORM } from "./constants.js";

/* ═══════════════════════════════════════════════════
   §7b. Backend API Client (backend-only mode)
   2026-04-08 P2.10 新增，2026-04-09 架构重构，2026-04-10 SSO B9 改造
   设计思路：所有增强请求统一走受控 backend API 基准地址，
     后端做中间转接层（记录信息 + 管理 API Key + 内部转发）。
     客户端不再持有 Provider Key，不再有本地直连回退。
     2026-04-10: 认证从 cookie 改为 Bearer token（SSO localStorage）。
   影响范围：handleGenerate 流程、认证方式
   潜在风险：localStorage 在同源下共享，XSS 可读取（CSP 已防护）
   ═══════════════════════════════════════════════════ */

/**
 * 2026-04-17 修复 — 环境区分任务 3：Web 端 backend/SSO 基准地址环境化
 * 变更类型：修复/配置/重构
 * 功能描述：从 Vite `import.meta.env` 读取 Web 端 backend API 与 SSO Hub 基准地址，development / production 分别跟随 `.env.development` / `.env.production`，停止在运行时代码中硬编码生产域名。
 * 设计思路：
 *   1. `VITE_BACKEND_PUBLIC_BASE_URL` 作为主语义源，保留 `VITE_API_BASE` 仅作任务 1 过渡期兼容别名。
 *   2. `VITE_SSO_HUB_BASE_URL` 作为 Web 登录/个人主页跳转基准，缺失时仅回退到同批冻结的 `VITE_WEB_HUB_PUBLIC_BASE_URL`。
 *   3. 关键 env 缺失时立即 fail-closed 抛错，避免本地开发静默命中线上 `api.zhiz.chat` / `zhiz.chat`。
 * 参数与返回值：`normalizeViteBaseUrl(value)` 返回去空白与尾斜杠后的字符串；`requireViteBaseUrl(primaryKey, usage, fallbackKey)` 返回必需的基准地址或抛错。
 * 影响范围：Web 端增强请求、SSO code exchange / refresh、登录页跳转、个人主页跳转、skill proxy 请求。
 * 潜在风险：若 Vite env 契约文件缺失，页面会在导入阶段显式失败；这是预期的 fail-closed 行为。
 */
const viteEnv = import.meta.env ?? {};

function normalizeViteBaseUrl(value) {
  return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
}

/**
 * 2026-04-23 修复 — Web 端 Skills Manager hash-route 容错归一化
 * 变更类型：fix
 * What：当 `.env` 里的 Skills Manager URL 因未加引号、被 dotenv 在 `#` 处截断成 `/chat-flow/` 根路径时，自动补回 `#/skills/index`。
 * Why：slash skill 浮窗“编辑”按钮依赖这条地址；若 hash-route 丢失，用户会被带到 sit/prod 站点根页而不是技能管理页。
 * Params & return：`normalizeZhizSkillsManagerUrl(value)` 接收原始 env 值，返回可直接用于 `window.open()` 的完整 Skills Manager URL。
 * Impact scope：web/src/ui/index.js 的“编辑技能”入口、SSO 恢复后自动打开 Skills Manager 的链路。
 * Risk：仅对 `sit.zhiz.me` / `zhiz.me` 的 `/chat-flow` 根路径做定向修复，不影响其它环境变量读取。
 */
function normalizeZhizSkillsManagerUrl(value) {
  const normalizedValue = normalizeViteBaseUrl(value);
  if (!normalizedValue) {
    return "";
  }

  try {
    const parsed = new URL(normalizedValue);
    const normalizedPath = parsed.pathname.replace(/\/+$/, "");
    const isZhizSkillsHost =
      parsed.origin === "https://sit.zhiz.me" ||
      parsed.origin === "https://zhiz.me";

    if (
      isZhizSkillsHost &&
      normalizedPath === "/chat-flow" &&
      parsed.hash !== "#/skills/index"
    ) {
      return `${parsed.origin}/chat-flow/#/skills/index`;
    }
  } catch {
    return normalizedValue;
  }

  return normalizedValue;
}

function requireViteBaseUrl(primaryKey, usage, fallbackKey) {
  const primaryValue = normalizeViteBaseUrl(viteEnv[primaryKey]);
  if (primaryValue) {
    return primaryValue;
  }

  const fallbackValue = fallbackKey
    ? normalizeViteBaseUrl(viteEnv[fallbackKey])
    : "";
  if (fallbackValue) {
    return fallbackValue;
  }

  throw new Error(
    `[EP_WEB_ENV] ${primaryKey} is required for ${usage}${fallbackKey ? ` (fallback ${fallbackKey} also missing)` : ""}`,
  );
}

function requireZhizSkillsManagerUrl(envKey, usage) {
  const resolvedValue = normalizeZhizSkillsManagerUrl(viteEnv[envKey]);
  if (resolvedValue) {
    return resolvedValue;
  }

  throw new Error(`[EP_WEB_ENV] ${envKey} is required for ${usage}`);
}

export const BACKEND_API_BASE = requireViteBaseUrl(
  "VITE_BACKEND_PUBLIC_BASE_URL",
  "Web backend API requests",
  "VITE_API_BASE",
);

// 2026-04-10 修复
// 变更类型：修复
// 功能描述：将 Web 端后端增强请求超时从 30s 提升到 90s，避免生产环境中两步增强尚未完成时被前端提前中断
// 设计思路：后端增强已改为 routing + generation 两步调用，总耗时可能超过 30s；浏览器插件端已验证 90s 可覆盖正常慢请求，Web 端需保持一致以消除"前端超时但后台 success"状态分叉
// 参数与返回值：BACKEND_TIMEOUT_MS 控制 callBackendEnhance 内部 fetch 的 AbortController 超时；不改变请求参数和返回值结构
// 影响范围：prompt.zhiz.chat Web 端增强流程、用户侧超时提示、与管理后台 AI 请求日志的一致性
// 潜在风险：无已知风险
export const BACKEND_TIMEOUT_MS = 90000;

/* ─── SSO Token Management (B9+B10) ─── */
// 2026-04-10 新增 — SSO Plan v2 B9
// 设计思路：
//   1. 页面加载时检测 URL code + state → 兑换 → 存 localStorage → 清 URL
//   2. callBackendEnhance 使用 Bearer token 替代 cookie
//   3. 401 时自动刷新重试一次
//   4. setInterval 定时刷新（过期前 60s）
// 影响范围：认证方式、UI 登录按钮
// 潜在风险：无已知风险（CSP 限制 XSS）

// 2026-04-17 修改 — Zhiz SSO Hub 基地址 export 化
// 变更类型：重构/修复
// 功能描述：将 SSO_HUB_BASE 从内部常量升级为 export，供 UI 层在"点击已登录用户名跳个人主页"等场景复用同一地址。
// 设计思路：保持单一来源（single source of truth），避免 UI 层再次硬编码 https://zhiz.chat，防止未来切域名时漏改。
// 参数与返回值：无（仅变量 export）。
// 影响范围：web/src/ui/index.js 导入 SSO_HUB_BASE 与 openProfilePage()。
// 潜在风险：无已知风险。
export const SSO_HUB_BASE = requireViteBaseUrl(
  "VITE_SSO_HUB_BASE_URL",
  "Web SSO login and profile links",
  "VITE_WEB_HUB_PUBLIC_BASE_URL",
);
export const ZHIZ_SKILLS_MANAGER_URL = requireZhizSkillsManagerUrl(
  "VITE_ZHIZ_SKILLS_MANAGER_URL",
  "Web Zhiz skills manager entry",
);
export const SSO_KEYS = {
  ACCESS_TOKEN: "ep-sso-access-token",
  REFRESH_TOKEN: "ep-sso-refresh-token",
  EXPIRES_AT: "ep-sso-expires-at",
  USER: "ep-sso-user",
  STATE: "ep-sso-state",
};
const ZHIZ_LINK_STATUS_URL = `${BACKEND_API_BASE}/api/v1/auth/oauth/zhiz/link-status`;
const PENDING_ZHIZ_EDITOR_INTENT_KEY = "ep-zhiz-skill-editor-intent";
const PENDING_ZHIZ_EDITOR_INTENT_TTL_MS = 10 * 60 * 1000;

let _ssoRefreshTimer = null;
export const SSO_STATE_CHANGE_EVENT = "ep:sso-state-change";

/** 获取 SSO access token */
export function getSsoToken() {
  return localStorage.getItem(SSO_KEYS.ACCESS_TOKEN) || null;
}

/** 获取当前登录用户 */
export function getSsoUser() {
  try {
    const raw = localStorage.getItem(SSO_KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** 检查用户登录态 */
export function isAuthenticated() {
  return !!getSsoToken();
}

/**
 * 2026-04-16 新增 — Web SSO 状态变更事件桥接
 * 变更类型：新增/兼容
 * 功能描述：在 Web 端登录态发生保存/清除时向页面广播轻量事件，供 skill 面板等旁路模块刷新依赖登录态的数据。
 * 设计思路：
 *   1. 复用 window CustomEvent，避免把 skill 刷新逻辑直接耦合进 SSO 登录/退出主流程。
 *   2. 仅广播 reason/user 等最小上下文，不传 token，继续遵守客户端不暴露敏感凭证的约束。
 *   3. 提供 onSsoStateChange() 取消订阅函数，便于 UI 模块按需绑定而不污染全局命名空间。
 * 参数与返回值：dispatchSsoStateChange(detail) 无返回值；onSsoStateChange(listener) 返回解绑函数。
 * 影响范围：web/src/ui/index.js 的 skill 数据刷新，以及后续任何依赖 Web 登录态切换的旁路 UI。
 * 潜在风险：无已知风险。
 */
function dispatchSsoStateChange(detail) {
  if (
    typeof window === "undefined" ||
    typeof window.dispatchEvent !== "function"
  ) {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(SSO_STATE_CHANGE_EVENT, {
      detail,
    }),
  );
}

export function onSsoStateChange(listener) {
  if (
    typeof window === "undefined" ||
    typeof window.addEventListener !== "function"
  ) {
    return () => {};
  }
  const wrappedListener = (event) => {
    listener(event.detail || {});
  };
  window.addEventListener(SSO_STATE_CHANGE_EVENT, wrappedListener);
  return () => {
    window.removeEventListener(SSO_STATE_CHANGE_EVENT, wrappedListener);
  };
}

/**
 * 2026-04-16 新增 — Web SSO 刷新定时器清理助手
 * 变更类型：新增/兼容
 * 功能描述：统一清理当前页面持有的 SSO token 自动刷新计时器，供退出登录与跨标签页 storage 同步复用。
 * 设计思路：把 `_ssoRefreshTimer` 的生命周期收口到单一 helper，避免多个入口分别操作 timeout handle 导致遗留定时器。
 * 参数与返回值：clearSsoRefreshTimer() 无参数；无返回值。
 * 影响范围：web/src/backend.js 的 logout、token 刷新与 cross-tab storage 同步。
 * 潜在风险：无已知风险。
 */
function clearSsoRefreshTimer() {
  if (_ssoRefreshTimer) {
    clearTimeout(_ssoRefreshTimer);
    _ssoRefreshTimer = null;
  }
}

/**
 * 2026-04-16 新增 — Web 跨标签页 SSO storage 事件桥接
 * 变更类型：新增/兼容
 * 功能描述：监听其他标签页对 `ep-sso-*` 的 localStorage 变更，并在当前标签页同步登录 UI、刷新定时器与 skill 依赖数据事件。
 * 设计思路：
 *   1. 仅处理 `SSO_KEYS` 范围内的 storage 事件，避免无关 localStorage 读写触发 skill 面板误刷新。
 *   2. 监听到跨 tab 登录/退出/refresh 后，先恢复当前页 UI 与 refresh timer，再通过既有 `ep:sso-state-change` 广播给 skill 面板等旁路模块。
 *   3. 同 tab 的 localStorage 写入不会触发 storage 事件，因此与 `dispatchSsoStateChange()` 的本地广播互补，不会重复覆盖。
 * 参数与返回值：onSsoStorageChange(listener) 返回解绑函数；listener 接收 `{ reason, key, user }`。
 * 影响范围：web/src/ui/index.js 的跨标签页登录态刷新、skill 数据同步。
 * 潜在风险：无已知风险。
 */
export function onSsoStorageChange(listener = () => {}) {
  if (
    typeof window === "undefined" ||
    typeof window.addEventListener !== "function"
  ) {
    return () => {};
  }
  const ssoKeys = new Set(Object.values(SSO_KEYS));
  const wrappedListener = (event) => {
    if (event.storageArea !== localStorage) {
      return;
    }
    if (event.key && !ssoKeys.has(event.key)) {
      return;
    }

    const storedExpiry = localStorage.getItem(SSO_KEYS.EXPIRES_AT);
    if (storedExpiry) {
      scheduleSsoRefresh(Number(storedExpiry));
    } else {
      clearSsoRefreshTimer();
    }
    updateSsoUI();

    const detail = {
      reason: "storage_sync",
      key: event.key || null,
      user: getSsoUser(),
    };
    dispatchSsoStateChange(detail);
    listener(detail);
  };

  window.addEventListener("storage", wrappedListener);
  return () => {
    window.removeEventListener("storage", wrappedListener);
  };
}

/** 保存 SSO tokens */
export function saveSsoTokens(data) {
  const { user, tokens } = data;
  const expiresAt = Date.now() + (tokens.expiresIn || 3600) * 1000;
  localStorage.setItem(SSO_KEYS.ACCESS_TOKEN, tokens.accessToken);
  localStorage.setItem(SSO_KEYS.REFRESH_TOKEN, tokens.refreshToken);
  localStorage.setItem(SSO_KEYS.EXPIRES_AT, String(expiresAt));
  if (user) localStorage.setItem(SSO_KEYS.USER, JSON.stringify(user));
  scheduleSsoRefresh(expiresAt);
  updateSsoUI();
  dispatchSsoStateChange({ reason: "tokens_saved", user: user || null });
}

/** 清除 SSO tokens */
export function clearSsoTokens() {
  Object.values(SSO_KEYS).forEach((k) => localStorage.removeItem(k));
  clearSsoRefreshTimer();
  updateSsoUI();
  dispatchSsoStateChange({ reason: "tokens_cleared", user: null });
}

/**
 * 2026-04-22 修复 — Web auth token 响应格式归一化
 * 变更类型：fix
 * What：兼容后端 `/api/v1/auth/refresh` 的 flat `data.accessToken` 与旧调用方仍在使用的 `data.tokens` 两种形状。
 * Why：当前 Web/Browser 刷新逻辑误以为 refresh 响应总是嵌套在 `data.tokens`，会在 token 轮换或静默登录恢复时把正常响应误判为空。
 * Params & return：`extractAuthTokens(payload)` 接收 refresh/exchange JSON，返回标准化 `{ accessToken, refreshToken, expiresIn }`；非法形状时抛出 Error。
 * Impact scope：`refreshSsoToken()`、`bootstrapSsoSessionFromCookie()` 与 Web 端所有依赖 refresh 的鉴权恢复路径。
 * Risk：No known risks.
 */
function extractAuthTokens(payload) {
  const candidate = payload?.data?.tokens ?? payload?.data ?? null;
  if (
    typeof candidate?.accessToken !== "string" ||
    typeof candidate?.refreshToken !== "string"
  ) {
    throw new Error("认证响应缺少 token");
  }

  return {
    accessToken: candidate.accessToken,
    refreshToken: candidate.refreshToken,
    expiresIn:
      typeof candidate.expiresIn === "number" ? candidate.expiresIn : 3600,
  };
}

/**
 * 2026-04-22 修复 — Web 静默共享会话 bootstrap
 * 变更类型：fix
 * What：在当前页没有本地 `ep-sso-*` token 时，尝试用共享 `refresh_token` cookie 静默换取新 token 与用户信息。
 * Why：多端登录共享的真相来源不应只依赖各自 origin 的 localStorage；有共享会话 cookie 时，Web 应能在首次加载或新开页时自动恢复登录态。
 * Params & return：`bootstrapSsoSessionFromCookie()` 无参数；成功时返回当前用户对象，失败时返回 null。
 * Impact scope：web/src/ui/index.js 启动阶段、Web header 登录态展示、skill 面板“编辑技能”登录前分流。
 * Risk：匿名访问会额外产生一次 cookie-based refresh 探测请求，但该请求只命中 `/auth/refresh`，不会泄露敏感信息。
 */
export async function bootstrapSsoSessionFromCookie() {
  if (getSsoToken()) {
    return getSsoUser();
  }

  const refreshResponse = await fetch(`${BACKEND_API_BASE}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({}),
  });

  let refreshPayload = {};
  try {
    refreshPayload = await refreshResponse.json();
  } catch {
    refreshPayload = {};
  }

  if (!refreshResponse.ok || !refreshPayload?.success) {
    return null;
  }

  const tokens = extractAuthTokens(refreshPayload);
  const profileResponse = await fetch(`${BACKEND_API_BASE}/api/v1/auth/me`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${tokens.accessToken}`,
    },
  });

  let profilePayload = {};
  try {
    profilePayload = await profileResponse.json();
  } catch {
    profilePayload = {};
  }

  if (!profileResponse.ok || !profilePayload?.success || !profilePayload?.data) {
    return null;
  }

  saveSsoTokens({
    user: profilePayload.data,
    tokens,
  });
  return profilePayload.data;
}

/** SSO 登录 — 跳转到统一 SSO Hub 登录页 */
export function ssoLogin() {
  const state = crypto.randomUUID();
  localStorage.setItem(SSO_KEYS.STATE, state);
  const redirectUri = window.location.origin + window.location.pathname;
  const loginUrl =
    `${SSO_HUB_BASE}/auth/login?` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
  window.location.href = loginUrl;
}

/** SSO 退出 */
export function ssoLogout() {
  clearSsoTokens();
}

/** 用授权码换取 tokens */
export async function exchangeSsoCode(code, redirectUri) {
  const resp = await fetch(`${BACKEND_API_BASE}/api/v1/auth/sso/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirectUri }),
  });
  const data = await resp.json();
  if (!data.success) throw new Error(data.error?.message || "授权码兑换失败");
  return data.data;
}

/** 刷新 access token */
export async function refreshSsoToken() {
  const refreshToken = localStorage.getItem(SSO_KEYS.REFRESH_TOKEN);
  if (!refreshToken) throw new Error("无 refresh token");

  const resp = await fetch(`${BACKEND_API_BASE}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ refreshToken }),
  });
  const data = await resp.json();
  if (!data.success) throw new Error(data.error?.message || "Token 刷新失败");

  const tokens = extractAuthTokens(data);
  const expiresAt = Date.now() + (tokens.expiresIn || 3600) * 1000;
  localStorage.setItem(SSO_KEYS.ACCESS_TOKEN, tokens.accessToken);
  localStorage.setItem(SSO_KEYS.REFRESH_TOKEN, tokens.refreshToken);
  localStorage.setItem(SSO_KEYS.EXPIRES_AT, String(expiresAt));
  scheduleSsoRefresh(expiresAt);
  updateSsoUI();
  dispatchSsoStateChange({
    reason: "tokens_refreshed",
    user: getSsoUser(),
  });
  return tokens;
}

/** 调度定时刷新（B10） */
export function scheduleSsoRefresh(expiresAt) {
  clearSsoRefreshTimer();
  const delayMs = Math.max(expiresAt - Date.now() - 60 * 1000, 30 * 1000);
  _ssoRefreshTimer = setTimeout(async () => {
    try {
      await refreshSsoToken();
    } catch {
      clearSsoTokens();
    }
  }, delayMs);
}

/** 页面加载时处理 SSO 回调（URL 带 code + state） */
export async function handleSsoCallbackOnLoad() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  if (!code) return;

  // 清除 URL 参数
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  window.history.replaceState({}, "", url.pathname + url.search);

  // CSRF 校验
  const storedState = localStorage.getItem(SSO_KEYS.STATE);
  localStorage.removeItem(SSO_KEYS.STATE);
  if (!storedState || storedState !== returnedState) {
    console.warn("[EP] SSO state mismatch");
    return;
  }

  try {
    const redirectUri = window.location.origin + window.location.pathname;
    const tokenData = await exchangeSsoCode(code, redirectUri);
    saveSsoTokens(tokenData);
  } catch (err) {
    console.error("[EP] SSO code exchange failed:", err.message);
  }
}

/**
 * 2026-04-17 修复 — Web 主应用 SSO 按钮语义与其他端对齐
 * 变更类型：修复/交互
 * 功能描述：
 *   1. 已登录状态下，按钮主体点击改为跳转 Web-Hub 个人主页（见 #btn-sso click handler + openProfilePage）；
 *   2. 同步更新 title / aria-label 文案，消除"点击退出"的误导提示；
 *   3. 控制新增的 Chevron 下拉菜单按钮与菜单容器在登录态切换时的可见性与 aria-expanded。
 * 设计思路：
 *   - 保持 `getSsoUser()` 为唯一登录态真相来源，避免多处分支各自判断。
 *   - Chevron/menu 仅在"登录成功"后才暴露，降低未登录用户的 UI 噪音。
 *   - 退出登录不再由主按钮承担，而是通过下拉菜单的"退出登录"入口触发。
 * 参数与返回值：无参数、无返回值。
 * 影响范围：web/index.html 的 SSO 按钮组、web/src/ui/index.js 的 bindHeaderEvents。
 * 潜在风险：如果用户浏览器拦截新标签页（弹窗拦截），"点击跳 profile"会失败，但该行为由 openProfilePage 独立承担，不影响 UI 状态。
 */
export function updateSsoUI() {
  const btn = document.getElementById("btn-sso");
  const label = document.getElementById("sso-label");
  const chevron = document.getElementById("btn-sso-menu");
  const menu = document.getElementById("sso-menu");
  if (!btn || !label) return;

  const user = getSsoUser();
  if (user) {
    const name = user.displayName || user.username || "已登录";
    label.textContent = name;
    btn.title = `已登录：${name}\n点击打开个人主页`;
    btn.setAttribute("aria-label", `已登录 ${name}，点击打开个人主页`);
    btn.classList.add("is-logged-in");
    if (chevron) chevron.hidden = false;
  } else {
    label.textContent = "登录";
    btn.title = "打开登录页";
    btn.setAttribute("aria-label", "打开登录页");
    btn.classList.remove("is-logged-in");
    if (chevron) {
      chevron.hidden = true;
      chevron.setAttribute("aria-expanded", "false");
    }
    if (menu) menu.hidden = true;
  }
}

/**
 * 2026-04-17 新增 — 打开 Web-Hub 个人主页
 * 变更类型：新增/交互修复
 * 功能描述：在新标签页中打开 `${SSO_HUB_BASE}/profile`，作为 Web 主应用"点击已登录用户名"的统一行为。
 * 设计思路：
 *   - 复用 SSO_HUB_BASE 常量，避免硬编码主机名；与其他端（VS Code / IntelliJ / Web-Hub / Browser Extension）
 *     指向的 Web-Hub Profile 路由保持一致。
 *   - 使用 `noopener,noreferrer` 新标签页打开，避免跨源 window.opener 泄漏。
 * 参数与返回值：无入参；无显式返回值（浏览器新开标签）。
 * 影响范围：Web 主应用 header SSO 按钮主体点击 + Chevron 下拉菜单"个人主页"选项。
 * 潜在风险：若浏览器弹窗拦截打开，用户需手动授权；无已知代码层风险。
 */
export function openProfilePage() {
  window.open(`${SSO_HUB_BASE}/profile`, "_blank", "noopener,noreferrer");
}

/**
 * 2026-04-22 新增 — Web 端 Zhiz 绑定状态请求
 * 变更类型：新增/交互/安全
 * 功能描述：查询当前已登录用户是否已绑定 Zhiz OAuth 账号，并在 access token 过期时自动刷新一次后重试。
 * 设计思路：
 *   1. skill 面板“编辑技能”要求区分“未登录 / 已登录已绑定 / 已登录未绑定”三态，因此补一个显式 link-status 读取入口。
 *   2. 沿用既有 SSO refresh 语义：首次 401 时刷新一次 token，再以新 token 重试，避免页面侧误把“token 过期”当成“未绑定”。
 *   3. 响应只接收 provider/linked/profile 这些最小安全字段，不让 UI 层依赖后端内部 ticket/rawProfile 结构。
 * 参数与返回值：fetchZhizLinkStatus() 无参数；返回 Promise<{ provider:'zhiz', linked:boolean, profile:{displayName:string|null, avatarUrl:string|null} }>。
 * 影响范围：web/src/ui/index.js 的 skill 面板编辑入口与登录恢复链路。
 * 潜在风险：若后端 link-status 契约字段名变化，此处会显式抛错并在 UI 层提示重试，不会静默误判为“未绑定”。
 */
export async function fetchZhizLinkStatus() {
  async function requestLinkStatus(tokenOverride) {
    const accessToken = tokenOverride ?? getSsoToken();
    if (!accessToken) {
      throw new Error("当前未登录");
    }

    const response = await fetch(ZHIZ_LINK_STATUS_URL, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal:
        typeof AbortSignal !== "undefined" &&
        typeof AbortSignal.timeout === "function"
          ? AbortSignal.timeout(15000)
          : undefined,
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    return { response, payload };
  }

  let { response, payload } = await requestLinkStatus();

  if (response.status === 401) {
    const refreshedTokens = await refreshSsoToken();
    ({ response, payload } = await requestLinkStatus(
      refreshedTokens?.accessToken || null,
    ));
  }

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message || "获取 Zhiz 绑定状态失败");
  }

  if (
    payload?.data?.provider !== "zhiz" ||
    typeof payload?.data?.linked !== "boolean"
  ) {
    throw new Error("Zhiz 绑定状态响应无效");
  }

  return {
    provider: "zhiz",
    linked: payload.data.linked,
    profile: {
      displayName:
        typeof payload.data.profile?.displayName === "string"
          ? payload.data.profile.displayName
          : null,
      avatarUrl:
        typeof payload.data.profile?.avatarUrl === "string"
          ? payload.data.profile.avatarUrl
          : null,
    },
  };
}

/**
 * 2026-04-22 新增 — Web 端待恢复的 Zhiz 技能管理意图
 * 变更类型：新增/交互
 * 功能描述：在未登录用户点击 skill 面板“编辑技能”时保存一个 10 分钟有效的待办意图，以便完成 SSO 回跳后继续分流到 Zhiz 绑定或技能管理页。
 * 设计思路：
 *   1. 仅保存 `type + createdAt` 最小状态，避免把用户输入、token 或跳转外链写进 localStorage。
 *   2. read 时同时做 schema 校验与 TTL 回收，防止无关登录在未来某次误触发自动跳转。
 * 参数与返回值：savePendingZhizEditorIntent()/clearPendingZhizEditorIntent() 无返回值；readPendingZhizEditorIntent() 返回 payload 或 null。
 * 影响范围：web/src/ui/index.js 的登录前点击编辑流程、SSO 回跳恢复。
 * 潜在风险：若用户在 10 分钟内主动登录其他页面，仍会恢复最近一次编辑意图；这是当前产品闭环的预期行为。
 */
export function savePendingZhizEditorIntent() {
  localStorage.setItem(
    PENDING_ZHIZ_EDITOR_INTENT_KEY,
    JSON.stringify({
      type: "open-skills-manager",
      createdAt: Date.now(),
    }),
  );
}

export function readPendingZhizEditorIntent() {
  const rawValue = localStorage.getItem(PENDING_ZHIZ_EDITOR_INTENT_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);
    const createdAt =
      typeof parsed?.createdAt === "number" ? parsed.createdAt : NaN;
    const isExpired =
      !Number.isFinite(createdAt) ||
      Date.now() - createdAt > PENDING_ZHIZ_EDITOR_INTENT_TTL_MS;
    if (parsed?.type !== "open-skills-manager" || isExpired) {
      localStorage.removeItem(PENDING_ZHIZ_EDITOR_INTENT_KEY);
      return null;
    }
    return {
      type: "open-skills-manager",
      createdAt,
    };
  } catch {
    localStorage.removeItem(PENDING_ZHIZ_EDITOR_INTENT_KEY);
    return null;
  }
}

export function clearPendingZhizEditorIntent() {
  localStorage.removeItem(PENDING_ZHIZ_EDITOR_INTENT_KEY);
}

/**
 * 2026-04-22 新增 — Web 端 Zhiz 技能管理 / 绑定页跳转 helpers
 * 变更类型：新增/交互
 * 功能描述：统一封装从 skill 面板发起的外部跳转：已绑定用户进入 Zhiz 技能管理页，未绑定用户进入 PromptHub 个人页的 Zhiz OAuth 绑定专区。
 * 设计思路：
 *   1. Skills Manager URL 走环境变量，避免 Web 端运行时代码硬编码 sit/prod 域名。
 *   2. 绑定入口使用受控 query `connect=zhiz&postBindTarget=skills-manager#zhiz-oauth`，由 web-hub 个人页继续引导用户发起授权。
 * 参数与返回值：openZhizSkillsManager()/openZhizBindingProfilePage() 无参数；通过新标签页打开目标地址。
 * 影响范围：web/src/ui/index.js 的编辑入口分流。
 * 潜在风险：若浏览器拦截新标签页，用户需手动放行弹窗；不影响登录态或 skill 面板状态本身。
 */
export function openZhizSkillsManager() {
  window.open(ZHIZ_SKILLS_MANAGER_URL, "_blank", "noopener,noreferrer");
}

export function openZhizBindingProfilePage() {
  const profileUrl = new URL(`${SSO_HUB_BASE}/profile`);
  profileUrl.searchParams.set("connect", "zhiz");
  profileUrl.searchParams.set("postBindTarget", "skills-manager");
  profileUrl.hash = "zhiz-oauth";
  window.open(profileUrl.toString(), "_blank", "noopener,noreferrer");
}

/**
 * 生成 UUID v4（用于 requestId 透传 — P2.14）
 */
export function generateRequestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 后端错误码 → 用户友好中文提示
 * 2026-04-09 更新：移除"回退到本地模式"提示（本地模式已废弃）
 */
const BACKEND_ERROR_MAP = {
  AI_PROVIDER_ERROR: "AI 服务暂时不可用，请稍后重试",
  AI_TIMEOUT: "AI 服务响应超时，请稍后重试",
  RATE_LIMIT_EXCEEDED: "请求过于频繁，请稍后再试",
  AUTH_TOKEN_EXPIRED: "登录已过期，请重新登录",
  VALIDATION_FAILED: "请求参数有误",
  BLACKLISTED: "您的访问已被限制，请联系管理员",
};

export function mapBackendError(errorCode, defaultMsg) {
  return BACKEND_ERROR_MAP[errorCode] || defaultMsg || "后端服务异常";
}

/**
 * 调用后端 AI 增强 API
 * @param {string} input - 用户输入
 * @param {object} config - 本地配置（用于 enhanceMode/model/language）
 * @param {AbortSignal} signal - 取消信号
 * @returns {Promise<{result: string, scenes: string[], composite: boolean, source: string}>}
 */
export async function callBackendEnhance(input, config, signal) {
  const requestId = generateRequestId();

  // 2026-04-10 B9: 内部请求函数，支持 401 重试
  async function _doRequest(tokenOverride) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
    if (signal) {
      signal.addEventListener("abort", () => controller.abort());
    }

    try {
      const token = tokenOverride ?? getSsoToken();
      const headers = {
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
      };
      // 2026-04-10 B9: 从 cookie 切换为 Bearer token
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // 2026-04-13 修复 — 补发 clientVersion / clientPlatform 供后端日志记录
      const resp = await fetch(`${BACKEND_API_BASE}/api/v1/ai/enhance`, {
        method: "POST",
        headers: {
          ...headers,
          "X-Client-Platform": CLIENT_PLATFORM,
        },
        body: JSON.stringify({
          input,
          enhanceMode: config.enhanceMode || "fast",
          model: config.model || "",
          language: "zh-CN",
          clientType: "web",
          clientVersion: CLIENT_VERSION,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return { resp, data: await resp.json() };
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  // 第一次请求
  let { resp, data } = await _doRequest();

  // 2026-04-10 B9: 401 自动刷新重试（仅重试一次）
  if (resp.status === 401) {
    try {
      const newTokens = await refreshSsoToken();
      if (newTokens?.accessToken) {
        ({ resp, data } = await _doRequest(newTokens.accessToken));
      }
    } catch {
      // refresh 失败，使用原始 401 响应继续处理
    }
  }

  if (!data.success) {
    const errCode = data.error?.code || "UNKNOWN";
    const errMsg = data.error?.message || "Backend error";
    throw new Error(mapBackendError(errCode, errMsg));
  }

  return {
    result: data.data.output,
    scenes: data.data.scenes || ["optimize"],
    composite: data.data.composite || false,
    source: "backend",
    requestId,
  };
}

/**
 * 2026-04-09 架构重构：统一后端增强（backend-only）
 * 所有增强请求走 backend API，不再有本地直连回退。
 * @param {object} config - 用户配置（enhanceMode/model 传给 backend）
 * @param {string} input - 用户输入
 * @param {string|null} sceneId - 指定场景（传给 backend，null = 自动路由）
 * @param {function} onProgress - 进度回调
 * @param {AbortSignal} signal - 取消信号
 * @returns {Promise<{result, scenes, composite, source}>}
 */
export async function dualTrackEnhance(
  config,
  input,
  sceneId,
  onProgress,
  signal,
) {
  // 2026-04-10 修复
  // 变更类型：修复
  // 功能描述：恢复 Web 端 backend-only 增强流程的阶段性进度提示，避免长请求期间一直停留在"正在连接 AI 服务..."
  // 设计思路：复用浏览器插件端已验证的阶段状态机；后端同步 HTTP 返回期间，通过定时器估计 routing 与 generation 两阶段，保持跨端体验一致
  // 参数与返回值：onProgress(stage, text) 会按 routing → generating 触发；函数返回值结构保持 {result, scenes, composite, source} 不变
  // 影响范围：prompt.zhiz.chat Web 端增强流程的进度文案、转圈提示与跨端一致性
  // 潜在风险：无已知风险
  if (onProgress) onProgress("routing", "正在连接 AI 服务...");

  const progressTimers = [];
  if (onProgress) {
    progressTimers.push(
      setTimeout(() => onProgress("routing", "正在识别意图..."), 2000),
    );
    progressTimers.push(
      setTimeout(
        () => onProgress("generating", "正在生成专业 Prompt..."),
        8000,
      ),
    );
  }

  try {
    return await callBackendEnhance(input, config, signal);
  } finally {
    for (const timer of progressTimers) clearTimeout(timer);
  }
}
