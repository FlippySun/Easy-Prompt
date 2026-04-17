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
   设计思路：所有增强请求统一走后端 API（api.zhiz.chat），
     后端做中间转接层（记录信息 + 管理 API Key + 内部转发）。
     客户端不再持有 Provider Key，不再有本地直连回退。
     2026-04-10: 认证从 cookie 改为 Bearer token（SSO localStorage）。
   影响范围：handleGenerate 流程、认证方式
   潜在风险：localStorage 在同源下共享，XSS 可读取（CSP 已防护）
   ═══════════════════════════════════════════════════ */

export const BACKEND_API_BASE = "https://api.zhiz.chat";
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
export const SSO_HUB_BASE = "https://zhiz.chat";
export const SSO_KEYS = {
  ACCESS_TOKEN: "ep-sso-access-token",
  REFRESH_TOKEN: "ep-sso-refresh-token",
  EXPIRES_AT: "ep-sso-expires-at",
  USER: "ep-sso-user",
  STATE: "ep-sso-state",
};
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

/** SSO 登录 — 跳转到 zhiz.chat */
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
    body: JSON.stringify({ refreshToken }),
  });
  const data = await resp.json();
  if (!data.success) throw new Error(data.error?.message || "Token 刷新失败");

  const tokens = data.data.tokens;
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
    btn.title = `已登录：${name}\n点击打开 zhiz.chat 个人主页`;
    btn.setAttribute("aria-label", `已登录 ${name}，点击打开个人主页`);
    btn.classList.add("is-logged-in");
    if (chevron) chevron.hidden = false;
  } else {
    label.textContent = "登录";
    btn.title = "登录 zhiz.chat";
    btn.setAttribute("aria-label", "登录 zhiz.chat");
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
