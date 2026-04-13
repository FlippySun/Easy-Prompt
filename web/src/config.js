/**
 * Easy Prompt Web — 配置与历史记录管理
 * 2026-04-13 Vite 迁移：从 app.js §3/§3b 提取为独立 ESM 模块
 *
 * [类型]     重构（模块化）
 * [描述]     将 localStorage 配置管理和历史记录管理提取为独立模块
 * [影响范围] 所有涉及配置读写和历史记录的模块
 * [潜在风险] 无已知风险
 */

import { DEFAULT_API_PATHS, ENHANCE_MODES, DEFAULT_ENHANCE_MODE } from "./constants.js";
import { detectApiMode } from "./api.js";

/* ═══════════════════════════════════════════════════
   §3. Config Management (localStorage)
   ═══════════════════════════════════════════════════ */

export const STORAGE_KEY = "easy-prompt-config";
export const THEME_KEY = "easy-prompt-theme";

export function _splitBaseUrl(url) {
  if (!url) return { host: "", path: "" };
  try {
    const u = new URL(url);
    const raw = u.pathname;
    return { host: u.origin, path: raw === "/" ? "" : raw };
  } catch (_) {
    return { host: "", path: "" };
  }
}

// 2026-04-09 架构重构：_proxyUrl 已移除。
// 内置 Provider 已废弃，不再需要 Nginx ep-api 代理重写。
// 所有增强请求统一走 backend API（api.zhiz.chat）。

export function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    /* ignore */
  }
  return {};
}

export function saveConfig(cfg) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) {
    /* ignore */
  }
}

/**
 * 2026-04-09 架构重构：获取用户本地配置
 * - 增强请求统一走 backend API，不再需要内置 Provider 回退
 * - 此函数仅用于：设置面板"测试连接"、获取 enhanceMode/model 传给 backend
 * - 未配置的字段为空字符串（backend 会使用默认值）
 */
export async function getEffectiveConfig() {
  const user = loadConfig();

  // 读取用户输入并规整
  let apiHost = (user.apiHost || "").trim().replace(/\/+$/, "");
  let apiPath = (user.apiPath || "").trim();
  let apiMode = (user.apiMode || "").trim();
  const legacyBase = (user.baseUrl || "").trim();

  // 兼容旧版：拆分 baseUrl → host/path
  if (!apiHost && legacyBase) {
    const { host, path } = _splitBaseUrl(legacyBase);
    if (host) apiHost = host;
    if (!apiPath && path) apiPath = path;
  }

  // 填充 path：优先模式默认
  if (!apiPath && apiMode && DEFAULT_API_PATHS[apiMode]) {
    apiPath = DEFAULT_API_PATHS[apiMode];
  }
  if (apiPath && !apiPath.startsWith("/")) apiPath = "/" + apiPath;

  const effectiveBase = (apiHost || "").replace(/\/+$/, "") + (apiPath || "");
  const baseUrl = effectiveBase || legacyBase || "";

  return {
    baseUrl,
    apiHost,
    apiPath,
    apiKey: (user.apiKey || "").trim(),
    model: (user.model || "").trim(),
    apiMode: apiMode || (baseUrl ? detectApiMode(baseUrl) : ""),
    enhanceMode:
      (user.enhanceMode || "").trim() === ENHANCE_MODES.DEEP
        ? ENHANCE_MODES.DEEP
        : DEFAULT_ENHANCE_MODE,
  };
}

/* ═══════════════════════════════════════════════════
   §3b. History Management (localStorage)
   ═══════════════════════════════════════════════════ */

export const HISTORY_KEY = "easy-prompt-history";
export const MAX_HISTORY = 100;

export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    /* ignore */
  }
  return [];
}

export function saveHistoryRecord(
  originalText,
  enhancedText,
  mode,
  sceneIds,
  sceneName,
) {
  const history = loadHistory();
  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: Date.now(),
    mode, // 'smart' | 'scene'
    sceneIds: sceneIds || [],
    sceneName: sceneName || "",
    originalText,
    enhancedText,
  };
  history.unshift(record);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    /* ignore */
  }
  return record;
}

export function deleteHistoryRecord(id) {
  const history = loadHistory().filter((r) => r.id !== id);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    /* ignore */
  }
}

export function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (e) {
    /* ignore */
  }
}

export function formatHistoryTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return `今天 ${time}`;
  if (diffDays === 1) return `昨天 ${time}`;
  if (diffDays < 7) return `${diffDays} 天前 ${time}`;

  const month = d.getMonth() + 1;
  const day = d.getDate();
  if (d.getFullYear() === now.getFullYear())
    return `${month}月${day}日 ${time}`;
  return `${d.getFullYear()}/${month}/${day} ${time}`;
}
