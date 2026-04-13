/**
 * Easy Prompt Web — API 客户端
 * 2026-04-13 Vite 迁移：从 app.js §6 提取为独立 ESM 模块
 *
 * [类型]     重构（模块化）
 * [描述]     将 fetch-based API 客户端（4 种 API 模式）提取为独立模块
 * [影响范围] composer.js, backend.js, ui/ 中的测试连接 / 模型获取功能
 * [潜在风险] 无已知风险
 */

import {
  MAX_INPUT_LENGTH,
  MAX_RETRIES,
  RETRY_DELAYS,
  ENHANCE_MODES,
  DEFAULT_ENHANCE_MODE,
  DEFAULT_API_PATHS,
} from "./constants.js";

/* ═══════════════════════════════════════════════════
   §6. API Client (fetch-based, replaces curl)
   ═══════════════════════════════════════════════════ */

export function isRetryableError(error) {
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

export function shouldTryResponsesFallback(error, config) {
  const base = (config.baseUrl || "").replace(/\/+$/, "");
  const mode = config.apiMode || detectApiMode(base);
  return (
    mode === "openai-responses" &&
    /upstream request failed/i.test(error.message || "")
  );
}

export function stripApiEndpoint(baseUrl) {
  return (baseUrl || "")
    .replace(/\/+$/, "")
    .replace(/\/responses$/i, "")
    .replace(/\/chat\/completions$/i, "")
    .replace(/\/messages$/i, "");
}

export function friendlyError(errorMsg, model) {
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
      const remain = parseFloat(remainMatch[1]).toFixed(2);
      const need = parseFloat(needMatch[1]).toFixed(2);
      return `API 额度不足（剩余 $${remain}，需要 $${need}）· 请在设置中配置您自己的 API Key，或为当前 Key 充值`;
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

  if (msg.includes("json") || msg.includes("解析"))
    return "API 返回格式错误 · 请检查 Base URL 是否正确";
  if (msg.includes("返回为空") || msg.includes("empty"))
    return "API 返回结果为空 · 请修改输入内容后重试";
  if (msg.includes("upstream request failed"))
    return "上游模型服务暂时不可用 · 请稍后重试，或在设置中切换 API 模式/模型";

  return `API 调用出错: ${errorMsg}`;
}

/** 根据 baseUrl 路径自动推断 API 模式 */
export function detectApiMode(baseUrl) {
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

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getEnhanceMode(config) {
  return config?.enhanceMode === ENHANCE_MODES.DEEP
    ? ENHANCE_MODES.DEEP
    : DEFAULT_ENHANCE_MODE;
}

export function getRouterCallOptions(config, onRetry, signal) {
  return {
    temperature: 0.1,
    maxTokens: 500,
    timeout: 30,
    onRetry,
    signal,
  };
}

export function getGenerationCallOptions(config, isComposite, onRetry, signal) {
  if (getEnhanceMode(config) === ENHANCE_MODES.DEEP) {
    return {
      temperature: 0.7,
      maxTokens: isComposite ? 8192 : 4096,
      timeout: 120,
      onRetry,
      signal,
      model: config?.model,
    };
  }

  return {
    temperature: 0.5,
    maxTokens: isComposite ? 4096 : 2048,
    timeout: 60,
    onRetry,
    signal,
  };
}

export function decorateGenerationSystemPrompt(systemPrompt, config) {
  const mode = getEnhanceMode(config);
  const modeHint =
    mode === ENHANCE_MODES.DEEP
      ? "\n\n[增强模式: Deep]\n请优先保证完整性，补充关键边界条件、风险提示、验证步骤与输出结构，允许结果更充分展开。"
      : "\n\n[增强模式: Fast]\n请在保证专业度与可执行性的前提下，优先输出更精炼、更直接的 Prompt，避免不必要的铺陈和重复说明。";
  return `${systemPrompt}${modeHint}`;
}

/**
 * 单次 API 调用（支持 4 种 API 模式）
 * config: { baseUrl, apiKey, model, apiMode? }
 */
export async function callApiOnce(config, systemPrompt, userMessage, options = {}) {
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

  // 2026-04-09: 直接使用 URL（内置 Provider 代理已移除，增强走 backend API）
  const fetchUrl = url;

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
    const resp = await fetch(fetchUrl, {
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
        if (errBody.error) {
          errorMsg = errBody.error.message || JSON.stringify(errBody.error);
        }
      } catch (e) {
        // couldn't parse error body
      }
      throw new Error(errorMsg);
    }

    const MAX_RESPONSE_SIZE = 2 * 1024 * 1024;
    const text = await resp.text();
    if (text.length > MAX_RESPONSE_SIZE) {
      throw new Error("响应体过大（超过 2MB），已中断");
    }
    const data = JSON.parse(text);
    if (data.error) {
      throw new Error(data.error.message || JSON.stringify(data.error));
    }

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
    if (err.name === "AbortError") {
      throw new Error(signal?.aborted ? "已取消" : "请求超时");
    }
    throw err;
  }
}

export async function callApi(config, systemPrompt, userMessage, options = {}) {
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

      // openai-responses 模式遇到 upstream request failed → 自动回退到 /chat/completions
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
      if (!isRetryableError(effectiveError) || attempt >= MAX_RETRIES) {
        throw new Error(friendlyError(effectiveError.message, config.model));
      }
      const delayMs = RETRY_DELAYS[attempt] || 8000;
      if (onRetry) onRetry(attempt + 1, MAX_RETRIES, delayMs);
      await delay(delayMs);
    }
  }
  throw new Error(friendlyError(lastError.message, config.model));
}

export async function callRouterApi(
  config,
  systemPrompt,
  userMessage,
  onRetry,
  signal,
) {
  return callApi(
    config,
    systemPrompt,
    userMessage,
    getRouterCallOptions(config, onRetry, signal),
  );
}

export async function callGenerationApi(
  config,
  systemPrompt,
  userMessage,
  isComposite,
  onRetry,
  signal,
) {
  const effectiveSystemPrompt = decorateGenerationSystemPrompt(
    systemPrompt,
    config,
  );
  return callApi(
    config,
    effectiveSystemPrompt,
    userMessage,
    getGenerationCallOptions(config, isComposite, onRetry, signal),
  );
}

export async function testApiConfig(config) {
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
    const latency = Date.now() - start;
    return {
      ok: false,
      message: friendlyError(err.message, config.model),
      latency,
    };
  }
}

/**
 * 查询 API 可用模型列表
 * config: { baseUrl, apiKey, model?, apiMode? }
 */
export async function fetchModels(config) {
  const normalizedBase = config.baseUrl.replace(/\/+$/, "");
  const mode = config.apiMode || detectApiMode(normalizedBase);

  let url, headers;

  if (mode === "gemini") {
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
