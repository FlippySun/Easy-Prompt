/**
 * 2026-04-22 新增 — Browser 端 Zhiz 绑定状态与跳转 helper
 * 变更类型：新增/交互/安全
 * 功能描述：集中承载浏览器扩展在 skill 面板“编辑技能”入口中所需的 Zhiz 绑定状态查询、绑定专区深链与技能管理页跳转逻辑。
 * 设计思路：
 *   1. 把“link-status 请求 + 401 刷新一次 + 环境化跳转 URL”收口到共享 helper，避免 content script 内再次散落 fetch 与 URL 拼接细节。
 *   2. 仅暴露 provider/linked/profile 这些安全字段给 UI 层，避免内容脚本依赖后端 continuation ticket/rawProfile 等内部结构。
 *   3. 所有外部地址都由 env.js 提供，禁止在运行时代码中硬编码 sit/prod 域名。
 * 参数与返回值：见各导出函数签名注释。
 * 影响范围：browser/content/content.js、browser/__tests__/zhiz-link.test.js。
 * 潜在风险：若后端 link-status 契约字段变化，此模块会显式抛错并由上层提示用户重试，不会静默误判为“未绑定”。
 */

import { Sso } from "./sso.js";
import {
  BACKEND_API_BASE,
  WEB_HUB_BASE_URL,
  ZHIZ_SKILLS_MANAGER_URL,
} from "./env.js";

const ZHIZ_LINK_STATUS_URL =
  `${BACKEND_API_BASE}/api/v1/auth/oauth/zhiz/link-status`;

function getDefaultRequestSignal() {
  if (
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
  ) {
    return AbortSignal.timeout(15000);
  }
  return undefined;
}

function buildLinkStatusRequestHeaders(accessToken) {
  const headers = { Accept: "application/json" };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

async function requestZhizLinkStatus({
  requestUrl,
  fetchImpl,
  accessToken,
  getRequestSignal,
}) {
  const response = await fetchImpl(requestUrl, {
    headers: buildLinkStatusRequestHeaders(accessToken),
    signal: typeof getRequestSignal === "function" ? getRequestSignal() : undefined,
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  return { response, payload };
}

/**
 * 2026-04-22 新增 — Browser Zhiz 绑定状态查询
 * 变更类型：新增/安全/兼容
 * 功能描述：查询当前扩展登录用户是否已绑定 Zhiz；若 access token 过期，则自动刷新一次后重试。
 * 设计思路：
 *   1. 默认复用浏览器扩展现有 SSO 存储与 refresh helper，保证与 options/service-worker 的 token 生命周期一致。
 *   2. 不做匿名 fallback，因为 link-status 只对“已登录用户”有意义；一旦请求失败，上层应提示用户稍后重试。
 * 参数与返回值：fetchZhizLinkStatus(options?) 返回 Promise<{ provider:'zhiz', linked:boolean, profile:{displayName:string|null, avatarUrl:string|null} }>；options 仅供测试注入 fetch/token helper。
 * 影响范围：browser/content/content.js 编辑入口与 pending intent 恢复。
 * 潜在风险：若 refresh 失败会直接抛错给上层，这是刻意选择的 fail-loud 行为，防止错误地把“token 过期”当成“未绑定”。
 */
export async function fetchZhizLinkStatus(options = {}) {
  const requestUrl = options.requestUrl || ZHIZ_LINK_STATUS_URL;
  const fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
  const getAccessToken = options.getAccessToken || Sso.getAccessToken;
  const refreshAccessToken =
    options.refreshAccessToken || Sso.refreshAccessToken;
  const getRequestSignal = options.getRequestSignal || getDefaultRequestSignal;

  if (typeof fetchImpl !== "function") {
    throw new Error("Zhiz 绑定状态请求缺少 fetch 实现");
  }

  const currentToken = await getAccessToken();
  if (!currentToken) {
    throw new Error("当前未登录");
  }

  let { response, payload } = await requestZhizLinkStatus({
    requestUrl,
    fetchImpl,
    accessToken: currentToken,
    getRequestSignal,
  });

  if (response.status === 401) {
    const refreshedTokens = await refreshAccessToken();
    const nextToken =
      refreshedTokens?.accessToken || (await getAccessToken()) || null;
    ({ response, payload } = await requestZhizLinkStatus({
      requestUrl,
      fetchImpl,
      accessToken: nextToken,
      getRequestSignal,
    }));
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
 * 2026-04-22 新增 — PromptHub Zhiz 绑定专区深链
 * 变更类型：新增/交互
 * 功能描述：构造 Browser 端用于引导用户前往 PromptHub 个人页 Zhiz OAuth 授权专区的深链。
 * 设计思路：使用受控 query `connect=zhiz&postBindTarget=skills-manager#zhiz-oauth`，让 web-hub 个人页决定如何聚焦卡片与继续发起授权，而不是 content script 直接自动启动 OAuth。
 * 参数与返回值：buildZhizBindingProfileUrl() 无参数；返回 string URL。
 * 影响范围：browser/content/content.js 未绑定确认后的外部跳转。
 * 潜在风险：无已知风险。
 */
export function buildZhizBindingProfileUrl() {
  const profileUrl = new URL(`${WEB_HUB_BASE_URL}/profile`);
  profileUrl.searchParams.set("connect", "zhiz");
  profileUrl.searchParams.set("postBindTarget", "skills-manager");
  profileUrl.hash = "zhiz-oauth";
  return profileUrl.toString();
}

/**
 * 2026-04-22 新增 — Browser Zhiz 技能管理页跳转
 * 变更类型：新增/交互
 * 功能描述：在用户已绑定 Zhiz 时，以新标签页打开对应环境的 Skills Manager。
 * 设计思路：复用 env.js 导出的环境地址与 `noopener,noreferrer`，避免跨源 opener 泄漏。
 * 参数与返回值：openZhizSkillsManager() 无参数；无返回值。
 * 影响范围：browser/content/content.js 编辑入口与 pending intent 恢复。
 * 潜在风险：若浏览器拦截弹窗，用户需手动放行；不影响当前页面的内容注入功能。
 */
export function openZhizSkillsManager() {
  window.open(ZHIZ_SKILLS_MANAGER_URL, "_blank", "noopener,noreferrer");
}
