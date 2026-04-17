/**
 * 2026-04-17 新增 — 环境区分任务 4：PromptHub 共享环境基准地址
 * 变更类型：新增/配置/重构
 * 功能描述：集中解析 Web-Hub 的 backend / web / hub / SSO hub 基准地址，并提供跨产品入口链接，避免 API client、auth 页面与导航组件各自硬编码线上域名。
 * 设计思路：
 *   1. 使用任务 1 冻结的 Vite `VITE_*` 契约作为唯一语义源。
 *   2. `BACKEND_API_BASE` 优先读取 `VITE_BACKEND_PUBLIC_BASE_URL`，兼容回退 `VITE_API_BASE`；`SSO_HUB_BASE` 优先读取 `VITE_SSO_HUB_BASE_URL`，兼容回退 `VITE_WEB_HUB_PUBLIC_BASE_URL`。
 *   3. 缺失关键 env 时在导入阶段 fail-closed 抛错，避免 development 静默命中 `api.zhiz.chat` / `prompt.zhiz.chat` / `zhiz.chat`。
 * 参数与返回值：`normalizeViteBaseUrl(value)` 返回去空白与尾斜杠后的字符串；`requireViteBaseUrl(primaryKey, usage, fallbackKey)` 返回必需的基准地址；导出 `BACKEND_API_BASE` / `WEB_APP_BASE_URL` / `WEB_HUB_BASE_URL` / `SSO_HUB_BASE` / `PROMPT_WEB_FROM_HUB_URL`。
 * 影响范围：web-hub API client、登录/回调页、Navbar/Footer/CrossProductGuide/Home 跨产品链接。
 * 潜在风险：若 `.env.development` / `.env.production` 缺少契约字段，页面会显式失败；这是预期的 fail-closed 行为。
 */
const viteEnv = import.meta.env ?? {};

function normalizeViteBaseUrl(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
}

function requireViteBaseUrl(primaryKey: string, usage: string, fallbackKey?: string): string {
  const primaryValue = normalizeViteBaseUrl(viteEnv[primaryKey]);
  if (primaryValue) {
    return primaryValue;
  }

  const fallbackValue = fallbackKey ? normalizeViteBaseUrl(viteEnv[fallbackKey]) : '';
  if (fallbackValue) {
    return fallbackValue;
  }

  throw new Error(
    `[PROMPTHUB_ENV] ${primaryKey} is required for ${usage}${fallbackKey ? ` (fallback ${fallbackKey} also missing)` : ''}`,
  );
}

export const BACKEND_API_BASE = requireViteBaseUrl(
  'VITE_BACKEND_PUBLIC_BASE_URL',
  'PromptHub backend API requests',
  'VITE_API_BASE',
);

export const WEB_APP_BASE_URL = requireViteBaseUrl(
  'VITE_WEB_PUBLIC_BASE_URL',
  'PromptHub cross-product links to the web app',
);

export const WEB_HUB_BASE_URL = requireViteBaseUrl('VITE_WEB_HUB_PUBLIC_BASE_URL', 'PromptHub self links');

export const SSO_HUB_BASE = requireViteBaseUrl(
  'VITE_SSO_HUB_BASE_URL',
  'PromptHub auth entry links',
  'VITE_WEB_HUB_PUBLIC_BASE_URL',
);

export const PROMPT_WEB_FROM_HUB_URL = `${WEB_APP_BASE_URL}?from=hub`;
