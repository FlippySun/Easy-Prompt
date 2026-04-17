/**
 * 2026-04-16 修复 — Web / Browser Skill Proxy 客户端鉴权退化统一
 * 变更类型：修复/重构/兼容/安全
 * 功能描述：为 Web 与 Browser 的 skill proxy 请求统一提供 Bearer -> 401 刷新一次 -> 重试 -> 匿名 fallback 的客户端链路。
 * 设计思路：
 *   1. 将 skill proxy 的纯请求编排提取为跨端 helper，避免 web 与 browser 各自维护一份 401 刷新逻辑而继续漂移。
 *   2. 只有“首次带 token 请求返回 401”才会触发 refresh；refresh 失败或重试仍 401 时退化为匿名请求一次。
 *   3. helper 只负责 transport 与 payload 解包；cache / mock / UI 刷新节奏仍留在各端调用方，避免共享层越权处理状态。
 * 参数与返回值：
 *   - loadSkillProxyPayload(options): 返回 { response, payload, skills }。
 *   - assertSkillProxySuccess(result): 成功时返回 skills 数组，失败时抛出 Error。
 * 影响范围：web/src/skill.js、browser/content/content.js、browser/__tests__/skill-fetch-client.test.js。
 * 潜在风险：若 skill proxy 返回契约不再是 `{ success, data: { skills } }`，需同步更新此模块。
 */

function isRecord(value) {
  return typeof value === "object" && value !== null;
}

function extractSkillList(payload) {
  if (
    !isRecord(payload) ||
    payload.success !== true ||
    !isRecord(payload.data)
  ) {
    return null;
  }
  return Array.isArray(payload.data.skills) ? payload.data.skills : null;
}

function getSkillProxyErrorMessage(payload) {
  if (
    isRecord(payload) &&
    isRecord(payload.error) &&
    typeof payload.error.message === "string" &&
    payload.error.message.trim()
  ) {
    return payload.error.message.trim();
  }
  return "Skill proxy returned invalid payload";
}

async function readAccessToken(getAccessToken) {
  if (typeof getAccessToken !== "function") {
    return null;
  }
  const token = await getAccessToken();
  return typeof token === "string" && token.trim() ? token : null;
}

function extractRefreshedAccessToken(refreshedTokens) {
  if (
    !isRecord(refreshedTokens) ||
    typeof refreshedTokens.accessToken !== "string"
  ) {
    return null;
  }
  const nextToken = refreshedTokens.accessToken.trim();
  return nextToken || null;
}

async function requestSkillProxy({
  requestUrl,
  fetchImpl,
  accessToken,
  anonymous,
  getRequestSignal,
}) {
  const headers = {};
  if (!anonymous && typeof accessToken === "string" && accessToken.trim()) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetchImpl(requestUrl, {
    method: "GET",
    headers,
    signal:
      typeof getRequestSignal === "function" ? getRequestSignal() : undefined,
  });
  const payload = await response.json();
  return {
    response,
    payload,
    skills: extractSkillList(payload),
  };
}

export async function loadSkillProxyPayload(options = {}) {
  const {
    requestUrl,
    fetchImpl = globalThis.fetch?.bind(globalThis),
    getAccessToken,
    refreshAccessToken,
    getRequestSignal,
    onAuthRetryFailure,
  } = options;

  if (!requestUrl) {
    throw new Error("Skill proxy requestUrl is required");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("Skill proxy fetch implementation is required");
  }

  const accessToken = await readAccessToken(getAccessToken);
  let result = await requestSkillProxy({
    requestUrl,
    fetchImpl,
    accessToken,
    anonymous: !accessToken,
    getRequestSignal,
  });

  if (accessToken && result.response.status === 401) {
    let refreshedAccessToken = null;
    if (typeof refreshAccessToken === "function") {
      try {
        const refreshedTokens = await refreshAccessToken();
        refreshedAccessToken = extractRefreshedAccessToken(refreshedTokens);
      } catch (error) {
        if (typeof onAuthRetryFailure === "function") {
          onAuthRetryFailure(error);
        }
      }
    }

    if (refreshedAccessToken) {
      result = await requestSkillProxy({
        requestUrl,
        fetchImpl,
        accessToken: refreshedAccessToken,
        anonymous: false,
        getRequestSignal,
      });
    }

    if (!refreshedAccessToken || result.response.status === 401) {
      result = await requestSkillProxy({
        requestUrl,
        fetchImpl,
        anonymous: true,
        getRequestSignal,
      });
    }
  }

  return result;
}

export function assertSkillProxySuccess(result) {
  if (!result?.response?.ok || !Array.isArray(result.skills)) {
    throw new Error(getSkillProxyErrorMessage(result?.payload));
  }
  return result.skills;
}
