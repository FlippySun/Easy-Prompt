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

/**
 * 2026-04-23 修复 — Browser 端 Skills Manager hash-route 容错归一化
 * 变更类型：fix
 * What：当扩展构建读取到的 `WXT_ZHIZ_SKILLS_MANAGER_URL` 因 `.env` 中未给 `#` 路由加引号而被截断成 `/chat-flow/` 根路径时，自动补回 `#/skills/index`。
 * Why：浏览器插件端 skill 浮窗“编辑技能”入口依赖这条外跳地址；若 hash 被吞掉，用户会被带到站点首页而不是技能管理页。
 * Params & return：`normalizeZhizSkillsManagerUrl(value)` 接收原始 build-time env 值，返回规范化后的 Skills Manager URL。
 * Impact scope：browser/content/content.js、browser/shared/zhiz.js 的 Skills Manager 外跳。
 * Risk：仅在 `sit.zhiz.me` / `zhiz.me` 的 `/chat-flow` 根路径命中修复，不影响其它 Browser env 常量。
 */
function normalizeZhizSkillsManagerUrl(value) {
  const normalizedValue = normalizeEnvBaseUrl(value);
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

function requireEnvBaseUrl(envKey, usage) {
  const resolvedValue = normalizeEnvBaseUrl(browserEnv[envKey]);
  if (resolvedValue) {
    return resolvedValue;
  }

  throw new Error(`[EP_BROWSER_ENV] ${envKey} is required for ${usage}`);
}

function requireZhizSkillsManagerUrl(envKey, usage) {
  const resolvedValue = normalizeZhizSkillsManagerUrl(browserEnv[envKey]);
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

/**
 * 2026-04-22 新增 — Browser 端 Zhiz 技能管理入口环境变量
 * 变更类型：新增/配置
 * 功能描述：导出浏览器扩展运行时使用的 Zhiz Skills Manager 基准地址，供 slash skill 面板“编辑技能”入口按环境打开 sit/prod 技能管理页。
 * 设计思路：继续沿用集中 env 解析，避免 content script 再次硬编码 `sit.zhiz.me` / `zhiz.me`，保持 Browser 与 Web / Web-Hub 的环境切换一致。
 * 参数与返回值：`ZHIZ_SKILLS_MANAGER_URL` 为字符串常量，来自 `WXT_ZHIZ_SKILLS_MANAGER_URL`。
 * 影响范围：browser/shared/zhiz.js、browser/content/content.js。
 * 潜在风险：若构建环境缺失该变量，扩展会按既有 fail-closed 策略在导入阶段显式失败。
 */
export const ZHIZ_SKILLS_MANAGER_URL = requireZhizSkillsManagerUrl(
  "WXT_ZHIZ_SKILLS_MANAGER_URL",
  "Browser extension Zhiz skills manager entry",
);
