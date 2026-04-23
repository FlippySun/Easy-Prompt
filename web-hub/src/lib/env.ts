/**
 * 2026-04-17 新增 — 环境区分任务 4：PromptHub 共享环境基准地址
 * 变更类型：新增/配置/重构
 * 功能描述：集中解析 Web-Hub 的 backend / web / hub / SSO hub 基准地址，并提供跨产品入口链接，避免 API client、auth 页面与导航组件各自硬编码线上域名。
 * 设计思路：
 *   1. 使用任务 1 冻结的 Vite `VITE_*` 契约作为唯一语义源。
 *   2. `BACKEND_API_BASE` 优先读取 `VITE_BACKEND_PUBLIC_BASE_URL`，兼容回退 `VITE_API_BASE`；`SSO_HUB_BASE` 优先读取 `VITE_SSO_HUB_BASE_URL`，兼容回退 `VITE_WEB_HUB_PUBLIC_BASE_URL`。
 *   3. 缺失关键 env 时在导入阶段 fail-closed 抛错，避免 development 静默命中 `api.zhiz.chat` / `prompt.zhiz.chat` / `zhiz.chat`。
 * 参数与返回值：`normalizeViteBaseUrl(value)` 返回去空白与尾斜杠后的字符串；`requireViteBaseUrl(primaryKey, usage, fallbackKey)` 返回必需的基准地址；导出 `BACKEND_API_BASE` / `WEB_APP_BASE_URL` / `WEB_HUB_BASE_URL` / `SSO_HUB_BASE` / `PROMPT_WEB_FROM_HUB_URL` / `ZHIZ_SKILLS_MANAGER_URL`。
 * 影响范围：web-hub API client、登录/回调页、Navbar/Footer/CrossProductGuide/Home 跨产品链接。
 * 潜在风险：若 `.env.development` / `.env.production` 缺少契约字段，页面会显式失败；这是预期的 fail-closed 行为。
 */
const viteEnv = import.meta.env ?? {};

function normalizeViteBaseUrl(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
}

/**
 * 2026-04-23 修复 — Zhiz Skills Manager hash-route 容错归一化
 * 变更类型：fix
 * What：当 `.env` 中未给 `https://sit.zhiz.me/chat-flow/#/skills/index` 这类带 `#` 的 URL 加引号、被 dotenv 截断成 `/chat-flow/` 时，自动补回 Skills Manager 的 hash-route。
 * Why：这条地址同时被 Web / Web-Hub / Browser 用于“编辑技能 / 前往 Skills Manager”，一旦 hash 被当注释吞掉，就会只跳到站点根路由或错误落点。
 * Params & return：`normalizeZhizSkillsManagerUrl(value)` 接收原始 env 值，返回可直接用于跳转的完整 Skills Manager URL；无法识别时返回普通基准地址归一化结果。
 * Impact scope：web-hub 个人页“前往 Skills Manager”、Zhiz complete 页 postBindTarget 外跳。
 * Risk：仅对 `sit.zhiz.me` / `zhiz.me` 的 `/chat-flow` 根路径做修复，不影响其它受控外链。
 */
function normalizeZhizSkillsManagerUrl(value: unknown): string {
  const normalizedValue = normalizeViteBaseUrl(value);
  if (!normalizedValue) {
    return '';
  }

  try {
    const parsed = new URL(normalizedValue);
    const normalizedPath = parsed.pathname.replace(/\/+$/, '');
    const isZhizSkillsHost = parsed.origin === 'https://sit.zhiz.me' || parsed.origin === 'https://zhiz.me';

    if (isZhizSkillsHost && normalizedPath === '/chat-flow' && parsed.hash !== '#/skills/index') {
      return `${parsed.origin}/chat-flow/#/skills/index`;
    }
  } catch {
    return normalizedValue;
  }

  return normalizedValue;
}

function requireZhizSkillsManagerUrl(envKey: string, usage: string): string {
  const resolvedValue = normalizeZhizSkillsManagerUrl(viteEnv[envKey]);
  if (resolvedValue) {
    return resolvedValue;
  }

  throw new Error(`[PROMPTHUB_ENV] ${envKey} is required for ${usage}`);
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

/**
 * 2026-04-22 新增 — Zhiz Skills Manager 环境化入口
 * 变更类型：新增/配置
 * 功能描述：为 Zhiz 绑定完成后的最终跳转提供显式环境变量入口，避免 complete/profile 继续误用 Prompt Web 首页或其它跨产品兜底链接。
 * 设计思路：Skills Manager 属于受控外部站点，因此单独读取 `VITE_ZHIZ_SKILLS_MANAGER_URL`，不复用 `webReturnTo` 也不与 PromptHub/Prompt Web 同源导航混淆。
 * 参数与返回值：导出 `ZHIZ_SKILLS_MANAGER_URL` 字符串常量，无额外参数。
 * 影响范围：web-hub Zhiz 绑定完成页、Profile Zhiz 绑定专区。
 * 潜在风险：若环境变量缺失，PromptHub 会按既有 fail-closed 策略在导入阶段显式失败。
 */
export const ZHIZ_SKILLS_MANAGER_URL = requireZhizSkillsManagerUrl(
  'VITE_ZHIZ_SKILLS_MANAGER_URL',
  'PromptHub Zhiz skills manager redirect',
);
