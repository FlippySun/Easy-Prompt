/**
 * Easy Prompt Browser Extension — API Client
 * fetch-based API 调用层，支持 4 种 API 模式
 * openai / openai-responses / claude / gemini
 * 含重试、友好错误信息、安全限制
 */

// 2026-04-10 SSO B2: 引入 Sso 模块用于 401 自动刷新重试
import { Sso } from "./sso.js";

const MAX_INPUT_LENGTH = 10000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

/** 支持的 API 模式 */
const API_MODES = {
  openai: "OpenAI Chat Completions",
  "openai-responses": "OpenAI Responses API",
  claude: "Claude API",
  gemini: "Google Gemini API",
};

/** 每种模式的默认 API 路径 */
const DEFAULT_API_PATHS = {
  openai: "/v1/chat/completions",
  "openai-responses": "/v1/responses",
  claude: "/v1/messages",
  gemini: "/v1beta",
};

/**
 * 根据 baseUrl 路径自动推断 API 模式
 */
function detectApiMode(baseUrl) {
  if (!baseUrl) return "openai";
  const normalized = baseUrl.replace(/\/+$/, "").toLowerCase();
  if (normalized.endsWith("/responses")) return "openai-responses";
  if (
    normalized.includes("anthropic") ||
    normalized.includes("/v1/messages") ||
    normalized.endsWith("/messages")
  )
    return "claude";
  if (
    normalized.includes("generativelanguage.googleapis.com") ||
    normalized.includes("/v1beta") ||
    normalized.includes("/v1alpha")
  )
    return "gemini";
  return "openai";
}

function isRetryableError(error) {
  const msg = (error.message || "").toLowerCase();
  const patterns = [
    "cpu overloaded",
    "overloaded",
    "503",
    "529",
    "502",
    "bad gateway",
    "service unavailable",
    "temporarily unavailable",
    "server_error",
    "internal_error",
    "econnreset",
    "etimedout",
    "socket hang up",
    "connection reset",
    "请求超时",
    "rate limit",
    "rate_limit",
    "429",
    "too many requests",
    "failed to fetch",
    "network error",
    "load failed",
    "upstream request failed",
  ];
  return patterns.some((p) => msg.includes(p));
}

function shouldTryResponsesFallback(error, config) {
  const base = (config.baseUrl || "").replace(/\/+$/, "");
  const mode = config.apiMode || detectApiMode(base);
  return (
    mode === "openai-responses" &&
    /upstream request failed/i.test(error.message || "")
  );
}

function stripApiEndpoint(baseUrl) {
  return (baseUrl || "")
    .replace(/\/+$/, "")
    .replace(/\/responses$/i, "")
    .replace(/\/chat\/completions$/i, "")
    .replace(/\/messages$/i, "");
}

function friendlyError(errorMsg, model) {
  const msg = errorMsg.toLowerCase();
  if (msg.includes("cpu overloaded") || msg.includes("overloaded"))
    return "API 服务器繁忙（CPU 过载）· 当前使用人数过多，请等待 10-30 秒后重试";
  if (
    msg.includes("503") ||
    msg.includes("service unavailable") ||
    msg.includes("temporarily unavailable")
  )
    return "API 服务暂时不可用（503）· 服务器维护或临时故障，请等待几分钟后重试";
  if (msg.includes("502") || msg.includes("bad gateway"))
    return "API 网关错误（502）· 中转服务器连接问题，请稍后重试";
  if (msg.includes("529"))
    return "API 服务器过载（529）· 请求量过大，请等待 30 秒后重试";
  if (
    msg.includes("server_error") ||
    msg.includes("internal_error") ||
    msg.includes("500") ||
    msg.includes("internal server error")
  )
    return "API 服务器内部错误 · 服务端临时故障，请稍后重试";
  if (
    msg.includes("401") ||
    msg.includes("unauthorized") ||
    msg.includes("incorrect api key") ||
    msg.includes("invalid api key") ||
    msg.includes("authentication")
  )
    return "API Key 无效或已过期 · 请在设置中检查 API Key 是否正确";
  if (msg.includes("403") || msg.includes("forbidden"))
    return "API 访问被拒绝（403）· Key 权限不足或 IP 被限制，请检查配置";
  if (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests")
  )
    return "API 请求频率超限（429）· 请等待 30-60 秒后重试";
  if (
    msg.includes("model") &&
    (msg.includes("does not exist") ||
      msg.includes("not found") ||
      msg.includes("not available"))
  )
    return `模型 "${model}" 不可用 · 请在设置中检查模型名称是否正确`;
  if (
    msg.includes("quota") ||
    msg.includes("insufficient") ||
    msg.includes("billing") ||
    msg.includes("payment")
  ) {
    const remainMatch = errorMsg.match(/remain[^$]*\$([0-9.]+)/i);
    const needMatch = errorMsg.match(/need[^$]*\$([0-9.]+)/i);
    if (remainMatch && needMatch) {
      return `API 额度不足（剩余 $${parseFloat(remainMatch[1]).toFixed(2)}，需要 $${parseFloat(needMatch[1]).toFixed(2)}）· 请配置您自己的 API Key`;
    }
    return "API 额度不足 · 请在设置中配置您自己的 API Key，或检查当前账户余额";
  }
  if (
    msg.includes("failed to fetch") ||
    msg.includes("network error") ||
    msg.includes("load failed") ||
    msg.includes("networkerror")
  )
    return "无法连接到 API 服务器 · 请检查网络连接，或 API 服务器可能不支持浏览器跨域请求 (CORS)";
  if (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("aborted") ||
    msg.includes("请求超时")
  )
    return "API 请求超时 · 请检查网络连接，或缩短输入文本后重试";
  if (msg.includes("upstream request failed"))
    return "上游模型服务暂时不可用 · 请稍后重试，或在设置中切换 API 模式/模型";
  if (msg.includes("json") || msg.includes("解析"))
    return "API 返回格式错误 · 请检查 API Host 和 Path 是否正确";
  if (msg.includes("返回为空") || msg.includes("empty"))
    return "API 返回结果为空 · 请修改输入内容后重试";
  return `API 调用出错: ${errorMsg}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 单次 API 调用（支持 4 种 API 模式）
 * config: { baseUrl, apiKey, model, apiMode? }
 */
async function callApiOnce(config, systemPrompt, userMessage, options = {}) {
  const { temperature = 0.7, maxTokens = 4096, timeout = 60, signal } = options;

  const normalizedBase = config.baseUrl.replace(/\/+$/, "");
  const mode = config.apiMode || detectApiMode(normalizedBase);

  // ── 构建 URL ──
  let url;
  if (mode === "gemini") {
    url = `${normalizedBase}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
  } else if (mode === "openai-responses") {
    url = normalizedBase.endsWith("/responses")
      ? normalizedBase
      : `${normalizedBase}/responses`;
  } else if (mode === "claude") {
    url = normalizedBase.endsWith("/messages")
      ? normalizedBase
      : `${normalizedBase}/messages`;
  } else {
    // openai
    url = normalizedBase.endsWith("/chat/completions")
      ? normalizedBase
      : `${normalizedBase}/chat/completions`;
  }

  // ── 构建 Headers ──
  const headers = { "Content-Type": "application/json" };
  if (mode === "claude") {
    headers["x-api-key"] = config.apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else if (mode !== "gemini") {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }
  // gemini: API key in URL, no auth header

  // ── 构建 Body ──
  let body;
  if (mode === "openai-responses") {
    body = JSON.stringify({
      model: config.model,
      instructions: systemPrompt,
      input: userMessage,
      temperature,
      max_output_tokens: maxTokens,
    });
  } else if (mode === "claude") {
    body = JSON.stringify({
      model: config.model,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      max_tokens: maxTokens,
      temperature,
    });
  } else if (mode === "gemini") {
    const payload = {
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    };
    if (systemPrompt) {
      payload.systemInstruction = { parts: [{ text: systemPrompt }] };
    }
    body = JSON.stringify(payload);
  } else {
    // openai
    body = JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature,
      max_tokens: maxTokens,
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout * 1000);
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw new Error("已取消");
    }
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      let errorMsg = `HTTP ${resp.status}`;
      try {
        const errBody = await resp.json();
        if (errBody.error)
          errorMsg = errBody.error.message || JSON.stringify(errBody.error);
      } catch {
        /* ignore */
      }
      throw new Error(errorMsg);
    }

    const MAX_RESPONSE_SIZE = 2 * 1024 * 1024;
    const text = await resp.text();
    if (text.length > MAX_RESPONSE_SIZE)
      throw new Error("响应体过大（超过 2MB），已中断");
    const data = JSON.parse(text);
    if (data.error)
      throw new Error(data.error.message || JSON.stringify(data.error));

    // ── 解析响应 ──
    let content;
    if (mode === "openai-responses") {
      const outputArr = Array.isArray(data.output) ? data.output : [];
      const msgOutput = outputArr.find((o) => o.type === "message");
      const contentArr = Array.isArray(msgOutput?.content)
        ? msgOutput.content
        : [];
      content = contentArr.find((c) => c.type === "output_text")?.text;
    } else if (mode === "claude") {
      content = data.content?.[0]?.text;
    } else if (mode === "gemini") {
      content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    } else {
      content = data.choices?.[0]?.message?.content;
    }

    if (!content) throw new Error("返回为空");
    return content;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError")
      throw new Error(signal?.aborted ? "已取消" : "请求超时");
    throw err;
  }
}

async function callApi(config, systemPrompt, userMessage, options = {}) {
  const { onRetry, signal, ...callOptions } = options;
  if (userMessage.length > MAX_INPUT_LENGTH) {
    throw new Error(
      friendlyError(`输入文本过长（${userMessage.length} 字符）`, config.model),
    );
  }
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw new Error("已取消");
    try {
      return await callApiOnce(config, systemPrompt, userMessage, {
        ...callOptions,
        signal,
      });
    } catch (err) {
      let effectiveError = err;

      if (shouldTryResponsesFallback(err, config)) {
        try {
          return await callApiOnce(
            {
              ...config,
              apiMode: "openai",
              baseUrl: stripApiEndpoint(config.baseUrl),
            },
            systemPrompt,
            userMessage,
            { ...callOptions, signal },
          );
        } catch (fallbackErr) {
          effectiveError = fallbackErr;
        }
      }
      lastError = effectiveError;
      if (signal?.aborted) throw new Error("已取消");
      if (!isRetryableError(effectiveError) || attempt >= MAX_RETRIES)
        throw new Error(friendlyError(effectiveError.message, config.model));
      const delayMs = RETRY_DELAYS[attempt] || 8000;
      if (onRetry) onRetry(attempt + 1, MAX_RETRIES, delayMs);
      await delay(delayMs);
    }
  }
  throw new Error(friendlyError(lastError.message, config.model));
}

async function testApiConfig(config) {
  const start = Date.now();
  try {
    const baseUrl = (config.baseUrl || "").replace(/\/+$/, "");
    if (!baseUrl || !baseUrl.match(/^https?:\/\//))
      return {
        ok: false,
        message: "API Host 格式错误：必须以 http:// 或 https:// 开头",
        latency: 0,
      };
    if (!config.apiKey || !config.apiKey.trim())
      return { ok: false, message: "API Key 不能为空", latency: 0 };
    if (!config.model || !config.model.trim())
      return { ok: false, message: "模型名称不能为空", latency: 0 };
    await callApiOnce(config, "Reply with OK", "test", {
      temperature: 0,
      maxTokens: 5,
      timeout: 15,
    });
    const latency = Date.now() - start;
    return { ok: true, message: `连接成功 · 响应耗时 ${latency}ms`, latency };
  } catch (err) {
    return {
      ok: false,
      message: friendlyError(err.message, config.model),
      latency: Date.now() - start,
    };
  }
}

/**
 * 查询 API 可用模型列表
 * config: { baseUrl, apiKey, model?, apiMode? }
 */
async function fetchModels(config) {
  const normalizedBase = config.baseUrl.replace(/\/+$/, "");
  const mode = config.apiMode || detectApiMode(normalizedBase);

  let url, headers;

  if (mode === "gemini") {
    // GET {host}/v1beta/models?key={apiKey}
    let host = normalizedBase;
    const pathIdx = host.indexOf("/v1beta");
    if (pathIdx > 0) host = host.substring(0, pathIdx);
    url = `${host}/v1beta/models?key=${encodeURIComponent(config.apiKey)}`;
    headers = {};
  } else if (mode === "claude") {
    let host = normalizedBase;
    const pathIdx = host.indexOf("/v1");
    if (pathIdx > 0) host = host.substring(0, pathIdx);
    url = `${host}/v1/models`;
    headers = {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    };
  } else {
    // openai / openai-responses
    let host = normalizedBase;
    const pathIdx = host.indexOf("/v1");
    if (pathIdx > 0) host = host.substring(0, pathIdx);
    url = `${host}/v1/models`;
    headers = { Authorization: `Bearer ${config.apiKey}` };
  }

  try {
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      let errorMsg = `HTTP ${resp.status}`;
      try {
        const errBody = await resp.json();
        if (errBody.error)
          errorMsg = errBody.error.message || JSON.stringify(errBody.error);
      } catch {
        /* ignore */
      }
      throw new Error(errorMsg);
    }
    const data = await resp.json();

    // 解析模型 ID
    let models = [];
    if (mode === "gemini") {
      models = (data.models || [])
        .map((m) => (m.name || "").replace(/^models\//, ""))
        .filter(Boolean);
    } else {
      models = (data.data || []).map((m) => m.id).filter(Boolean);
    }
    models.sort();
    return { ok: true, models, message: `获取到 ${models.length} 个模型` };
  } catch (err) {
    return { ok: false, models: [], message: friendlyError(err.message, "") };
  }
}

/* ═══════════════════════════════════════════════════
   Backend API Client (backend-only mode)
   2026-04-08 新增，2026-04-09 架构重构
   设计思路：所有增强请求统一走后端 API（api.zhiz.chat），
     后端做中间转接层（记录信息 + 管理 API Key + 内部转发）。
     客户端不再持有 Provider Key，不再有本地直连回退。
     认证使用 chrome.storage.local 中存储的 access_token。
   影响范围：handleInlineEnhance / popup enhance 流程
   潜在风险：无已知风险
   ═══════════════════════════════════════════════════ */

const BACKEND_API_BASE = "https://api.zhiz.chat";
// 2026-04-09 修复：30s → 90s，实测 AI provider 响应可达 45s+
const BACKEND_TIMEOUT_MS = 90000;

/**
 * 生成 UUID v4（用于 requestId 透传 — P2.14）
 */
function generateRequestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 2026-04-09 架构重构：三模式开关已移除。
// 所有增强请求统一走 backend API，不再有本地直连回退。

/**
 * 从 chrome.storage.local 获取 access token
 * 2026-04-10 B1a: 改为读取 SSO token key（ep-sso-access-token）
 * 旧 key ep-access-token 由 Sso.migrateLegacyToken() 在 options 页面加载时清除
 */
async function getAccessToken() {
  try {
    const data = await chrome.storage.local.get("ep-sso-access-token");
    return data["ep-sso-access-token"] || null;
  } catch {
    return null;
  }
}

/**
 * 后端错误码 → 用户友好中文提示
 * 2026-04-09 更新：移除“回退到本地模式”提示（本地模式已废弃）
 */
const BACKEND_ERROR_MAP = {
  AI_PROVIDER_ERROR: "AI 服务暂时不可用，请稍后重试",
  AI_TIMEOUT: "AI 服务响应超时，请稍后重试",
  RATE_LIMIT_EXCEEDED: "请求过于频繁，请稍后再试",
  AUTH_TOKEN_EXPIRED: "登录已过期，请重新登录",
  VALIDATION_FAILED: "请求参数有误",
  BLACKLISTED: "您的访问已被限制，请联系管理员",
};

function mapBackendError(errorCode, defaultMsg) {
  return BACKEND_ERROR_MAP[errorCode] || defaultMsg || "后端服务异常";
}

/**
 * 调用后端 AI 增强 API
 * @param {string} input - 用户输入
 * @param {object} config - 本地配置（用于 enhanceMode/model）
 * @param {AbortSignal} [signal] - 取消信号
 * @returns {Promise<{result: string, scenes: string[], composite: boolean, source: string, requestId: string}>}
 */
async function callBackendEnhance(input, config, signal) {
  const requestId = generateRequestId();

  // 2026-04-10 B2: 内部请求函数，支持 401 重试
  // 设计思路：将单次请求封装为 _doRequest，401 时刷新 token 重试一次
  // 影响范围：callBackendEnhance 内部
  // 潜在风险：refresh 本身也可能失败（抛出异常由外层 catch 处理）
  async function _doRequest(tokenOverride) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
    if (signal) {
      signal.addEventListener("abort", () => controller.abort());
    }

    try {
      const token = tokenOverride ?? (await getAccessToken());
      const headers = {
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // 2026-04-09 修复：条件传递 model 字段
      // - 默认配置（使用我们的 LLM 服务）：不传 model，后端用 provider defaultModel
      // - 用户自定义 LLM 服务：传用户写的 model（config.model 来自 Storage，非 builtin defaults）
      const resp = await fetch(`${BACKEND_API_BASE}/api/v1/ai/enhance`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          input,
          enhanceMode: config.enhanceMode || "fast",
          ...(config.model ? { model: config.model } : {}),
          language: "zh-CN",
          clientType: "browser",
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

  // 2026-04-10 B2: 401 自动刷新重试（仅重试一次）
  if (resp.status === 401) {
    try {
      const newTokens = await Sso.refreshAccessToken();
      if (newTokens?.accessToken) {
        ({ resp, data } = await _doRequest(newTokens.accessToken));
      }
    } catch {
      // refresh 失败，使用原始 401 响应继续处理
    }
  }

  // 2026-04-10 新增 — SSO 全端审计 P1-3
  // 429 退避重试（最多 2 次，间隔 2s/4s）
  // 设计思路：后端 AI 端 429 是暂态错误，短暂等待后通常可成功
  // 影响范围：callBackendEnhance 429 场景
  // 潜在风险：无已知风险（最多额外等待 6s）
  if (resp.status === 429) {
    const retryDelays = [2000, 4000];
    for (const delay of retryDelays) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      await new Promise((r) => setTimeout(r, delay));
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      ({ resp, data } = await _doRequest());
      if (resp.status !== 429) break;
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
 * @param {function} _localEnhanceFn - [已废弃] 保留参数位以免调用方报错
 * @param {function} [onProgress] - 进度回调
 * @param {AbortSignal} [signal] - 取消信号
 * @returns {Promise<{result, scenes, composite, source}>}
 */
async function dualTrackEnhance(
  config,
  input,
  _localEnhanceFn,
  onProgress,
  signal,
) {
  // 2026-04-09 修复：为 backend 两步流程添加估计进度阶段
  // 后端内部执行 routing(~3-8s) + generation(~15-45s)，HTTP 同步返回
  // 使用定时器模拟进度阶段，与原有客户端两步流程 UX 一致
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
    const result = await callBackendEnhance(input, config, signal);
    return result;
  } finally {
    // 无论成功/失败/取消，清除所有进度定时器
    for (const t of progressTimers) clearTimeout(t);
  }
}

// eslint-disable-next-line no-unused-vars
const Api = {
  MAX_INPUT_LENGTH,
  API_MODES,
  DEFAULT_API_PATHS,
  BACKEND_API_BASE,
  detectApiMode,
  callApi,
  callApiOnce,
  testApiConfig,
  fetchModels,
  friendlyError,
  generateRequestId,
  getAccessToken,
  callBackendEnhance,
  dualTrackEnhance,
  mapBackendError,
};
export { Api };
