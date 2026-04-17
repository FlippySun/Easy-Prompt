/**
 * 2026-04-17 新增 — 环境区分任务 5：Browser 端共享环境基准地址
 * 变更类型：新增/配置/重构
 * 功能描述：集中解析浏览器扩展运行时所需的 backend / web / web-hub / SSO hub 基准地址，并导出个人主页链接，避免 shared/api.js、shared/sso.js、content.js、options.js 各自硬编码生产域名。
 * 设计思路：
 *   1. 使用任务 1 冻结的 WXT `WXT_*` 契约作为 Browser 端唯一语义源。
 *   2. 3002 仅代表 WXT dev server / HMR 端口，不参与扩展运行时请求来源或 OAuth redirect_uri 计算。
 *   3. 关键 env 缺失时在导入阶段 fail-closed 抛错，避免开发态静默命中 `api.zhiz.chat` / `prompt.zhiz.chat` / `zhiz.chat`。
 * 参数与返回值：`normalizeEnvBaseUrl(value)` 返回去空白与尾斜杠后的字符串；`requireEnvBaseUrl(envKey, usage)` 返回必需的基准地址；导出 `BACKEND_API_BASE` / `WEB_APP_BASE_URL` / `WEB_HUB_BASE_URL` / `SSO_HUB_BASE` / `SSO_PROFILE_URL`。
 * 影响范围：browser/shared/api.js、browser/shared/sso.js、browser/content/content.js、browser/options/options.js、browser/wxt-entrypoints/options/index.html。
 * 潜在风险：若 `.env.development` / `.env.production` 缺少契约字段，扩展页面会显式失败；这是预期的 fail-closed 行为。
 */
const browserEnv = import.meta.env ?? {};

function normalizeEnvBaseUrl(value) {
  return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
}

function requireEnvBaseUrl(envKey, usage) {
  const resolvedValue = normalizeEnvBaseUrl(browserEnv[envKey]);
  if (resolvedValue) {
    return resolvedValue;
  }

  throw new Error(`[EP_BROWSER_ENV] ${envKey} is required for ${usage}`);
}

export const BACKEND_API_BASE = requireEnvBaseUrl(
  "WXT_BACKEND_PUBLIC_BASE_URL",
  "Browser extension backend API requests",
);

export const WEB_APP_BASE_URL = requireEnvBaseUrl(
  "WXT_WEB_PUBLIC_BASE_URL",
  "Browser extension links to the web app",
);

export const WEB_HUB_BASE_URL = requireEnvBaseUrl(
  "WXT_WEB_HUB_PUBLIC_BASE_URL",
  "Browser extension links to PromptHub",
);

export const SSO_HUB_BASE = requireEnvBaseUrl(
  "WXT_SSO_HUB_BASE_URL",
  "Browser extension SSO login entry",
);

export const SSO_PROFILE_URL = `${WEB_HUB_BASE_URL}/profile`;
