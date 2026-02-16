/**
 * Easy Prompt Browser Extension — API Client
 * fetch-based API 调用层（与 web/app.js 完全一致的逻辑）
 * 含重试、友好错误信息、安全限制
 */

const MAX_INPUT_LENGTH = 10000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

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
  ];
  return patterns.some((p) => msg.includes(p));
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
  if (msg.includes("json") || msg.includes("解析"))
    return "API 返回格式错误 · 请检查 Base URL 是否正确";
  if (msg.includes("返回为空") || msg.includes("empty"))
    return "API 返回结果为空 · 请修改输入内容后重试";
  return `API 调用出错: ${errorMsg}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callApiOnce(config, systemPrompt, userMessage, options = {}) {
  const { temperature = 0.7, maxTokens = 4096, timeout = 60, signal } = options;
  const normalizedBase = config.baseUrl.replace(/\/+$/, "");
  const url = normalizedBase.endsWith("/chat/completions")
    ? normalizedBase
    : `${normalizedBase}/chat/completions`;

  const body = JSON.stringify({
    model: config.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature,
    max_tokens: maxTokens,
  });

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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
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
    const content = data.choices?.[0]?.message?.content;
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
      lastError = err;
      if (signal?.aborted) throw new Error("已取消");
      if (!isRetryableError(err) || attempt >= MAX_RETRIES)
        throw new Error(friendlyError(err.message, config.model));
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
        message: "Base URL 格式错误：必须以 http:// 或 https:// 开头",
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

// eslint-disable-next-line no-unused-vars
const Api = {
  MAX_INPUT_LENGTH,
  callApi,
  callApiOnce,
  testApiConfig,
  friendlyError,
};
