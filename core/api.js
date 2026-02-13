/**
 * Easy Prompt — API 调用层
 * 平台无关的 HTTP 请求封装，使用 curl 避免 Cloudflare 拦截
 */

const { spawn } = require("child_process");
const { platform } = require("os");

// 输入长度限制（10000 字符）
const MAX_INPUT_LENGTH = 10000;

// 重试配置
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000]; // 指数退避：2s, 4s, 8s

// curl 可用性缓存（避免每次调用都 spawn 进程检查）
let _curlAvailable = null;

/**
 * 检查 curl 是否可用（带缓存）
 */
function checkCurl() {
  if (_curlAvailable !== null) return Promise.resolve(_curlAvailable);
  return new Promise((resolve) => {
    const proc = spawn(platform() === "win32" ? "where" : "which", ["curl"]);
    proc.on("close", (code) => {
      _curlAvailable = code === 0;
      resolve(_curlAvailable);
    });
    proc.on("error", () => {
      _curlAvailable = false;
      resolve(false);
    });
  });
}

/**
 * 判断错误是否值得重试
 */
function isRetryableError(error) {
  const msg = error.message || "";
  const retryablePatterns = [
    "cpu overloaded",
    "overloaded",
    "503",
    "529",
    "502",
    "Bad Gateway",
    "Service Unavailable",
    "temporarily unavailable",
    "server_error",
    "internal_error",
    "ECONNRESET",
    "ETIMEDOUT",
    "socket hang up",
    "Connection reset",
    "请求超时",
    "Rate limit",
    "rate_limit",
    "429",
    "Too Many Requests",
  ];
  return retryablePatterns.some((p) =>
    msg.toLowerCase().includes(p.toLowerCase()),
  );
}

/**
 * 友好化错误消息 — 将技术错误转换为用户可理解的中文提示
 */
function friendlyError(errorMsg, model) {
  const msg = errorMsg.toLowerCase();

  // === 服务端过载/不可用 ===
  if (msg.includes("cpu overloaded") || msg.includes("overloaded")) {
    return "⚡ API 服务器繁忙（CPU 过载）· 当前使用人数过多，请等待 10-30 秒后重试";
  }
  if (
    msg.includes("503") ||
    msg.includes("service unavailable") ||
    msg.includes("temporarily unavailable")
  ) {
    return "🔧 API 服务暂时不可用（503）· 服务器维护或临时故障，请等待几分钟后重试";
  }
  if (msg.includes("502") || msg.includes("bad gateway")) {
    return "🌐 API 网关错误（502）· 中转服务器连接问题，请稍后重试";
  }
  if (msg.includes("529")) {
    return "🔥 API 服务器过载（529）· 请求量过大，请等待 30 秒后重试";
  }
  if (
    msg.includes("server_error") ||
    msg.includes("internal_error") ||
    msg.includes("500") ||
    msg.includes("internal server error")
  ) {
    return "🛠️ API 服务器内部错误 · 服务端临时故障，请稍后重试";
  }

  // === 认证/授权错误 ===
  if (
    msg.includes("401") ||
    msg.includes("unauthorized") ||
    msg.includes("incorrect api key") ||
    msg.includes("invalid api key") ||
    msg.includes("authentication")
  ) {
    return "🔑 API Key 无效或已过期 · 请在设置中检查 API Key 是否正确";
  }
  if (msg.includes("403") || msg.includes("forbidden")) {
    return "🚫 API 访问被拒绝（403）· Key 权限不足或 IP 被限制，请检查配置";
  }

  // === 频率限制 ===
  if (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests")
  ) {
    return "⏳ API 请求频率超限（429）· 请等待 30-60 秒后重试";
  }

  // === 模型错误 ===
  if (
    msg.includes("model") &&
    (msg.includes("does not exist") ||
      msg.includes("not found") ||
      msg.includes("not available"))
  ) {
    return `🤖 模型 "${model}" 不可用 · 请在设置中检查模型名称是否正确`;
  }

  // === 额度/配额 ===
  if (
    msg.includes("quota") ||
    msg.includes("insufficient") ||
    msg.includes("billing") ||
    msg.includes("payment")
  ) {
    // 尝试从错误消息中提取金额信息（如 "remain quota: $0.014000, need quota: $0.096000"）
    const remainMatch = errorMsg.match(/remain[^$]*\$([0-9.]+)/i);
    const needMatch = errorMsg.match(/need[^$]*\$([0-9.]+)/i);
    if (remainMatch && needMatch) {
      const remain = parseFloat(remainMatch[1]).toFixed(2);
      const need = parseFloat(needMatch[1]).toFixed(2);
      return `💰 API 额度不足（剩余 $${remain}，需要 $${need}）· 请在设置中配置您自己的 API Key，或为当前 Key 充值`;
    }
    return "💰 API 额度不足 · 请在设置中配置您自己的 API Key，或检查当前账户余额";
  }

  // === 网络连接问题 ===
  if (
    msg.includes("could not resolve host") ||
    msg.includes("getaddrinfo") ||
    msg.includes("dns")
  ) {
    return "🌐 无法连接到 API 服务器 · 请检查网络连接和 VPN/代理设置";
  }
  if (msg.includes("connection refused") || msg.includes("econnrefused")) {
    return "🔌 连接被拒绝 · 请检查 API Base URL 是否正确";
  }
  if (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("etimedout") ||
    msg.includes("请求超时")
  ) {
    return "⏱️ API 请求超时 · 请检查网络连接，或缩短输入文本后重试";
  }
  if (
    msg.includes("econnreset") ||
    msg.includes("connection reset") ||
    msg.includes("socket hang up")
  ) {
    return "🔄 连接被重置 · 网络不稳定，请稍后重试";
  }
  if (
    msg.includes("ssl") ||
    msg.includes("certificate") ||
    msg.includes("cert")
  ) {
    return "🔒 SSL/TLS 证书错误 · 请检查系统时间和代理证书配置";
  }

  // === curl 相关 ===
  if (msg.includes("curl") && msg.includes("not found")) {
    return "🔧 未找到 curl 命令 · macOS/Linux 通常预装，Windows 请安装 Git for Windows";
  }

  // === 响应解析错误 ===
  if (msg.includes("解析响应失败") || msg.includes("json")) {
    return "📋 API 返回格式错误 · 请检查 Base URL 是否正确（应以 /v1 结尾）";
  }

  // === 输入相关 ===
  if (msg.includes("过长") || msg.includes("too long") || msg.includes("max")) {
    return `📏 输入文本过长 · 最大支持 ${MAX_INPUT_LENGTH} 字符，请缩短后重试`;
  }
  if (msg.includes("返回为空") || msg.includes("empty")) {
    return "📭 API 返回结果为空 · 请修改输入内容后重试";
  }

  // === 兜底 ===
  return `❌ API 调用出错: ${errorMsg} · 请检查网络和 API 配置后重试`;
}

/**
 * 延时等待
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 执行单次 API 调用（无重试）
 */
function callApiOnce(config, systemPrompt, userMessage, options = {}) {
  const { baseUrl, apiKey, model } = config;
  const { temperature = 0.7, maxTokens = 4096, timeout = 60 } = options;

  // 安全限制：响应体最大 2MB，防止恶意服务器返回巨大响应导致 OOM
  const MAX_RESPONSE_SIZE = 2 * 1024 * 1024;

  const body = JSON.stringify({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature,
    max_tokens: maxTokens,
  });

  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  return new Promise((resolve, reject) => {
    const args = [
      "-s",
      "-S",
      "--max-time",
      String(timeout),
      "-X",
      "POST",
      url,
      "-H",
      "Content-Type: application/json",
      "-H",
      `Authorization: Bearer ${apiKey}`,
      "-d",
      "@-",
    ];

    const curl = spawn("curl", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let stdoutSize = 0;
    let killed = false;

    // 安全保护：超时强制终止 curl 进程（比 curl 自己的 --max-time 多给 10s 容错）
    const killTimer = setTimeout(
      () => {
        killed = true;
        curl.kill("SIGKILL");
      },
      (timeout + 10) * 1000,
    );

    curl.stdout.on("data", (data) => {
      stdoutSize += data.length;
      if (stdoutSize > MAX_RESPONSE_SIZE) {
        killed = true;
        curl.kill("SIGKILL");
        return;
      }
      stdout += data.toString();
    });

    curl.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    curl.on("error", (err) => {
      clearTimeout(killTimer);
      reject(new Error(`curl 执行失败: ${err.message}`));
    });

    curl.on("close", (code) => {
      clearTimeout(killTimer);

      if (killed && stdoutSize > MAX_RESPONSE_SIZE) {
        reject(new Error("响应体过大（超过 2MB），已中断连接"));
        return;
      }
      if (killed) {
        reject(new Error("请求超时"));
        return;
      }

      if (code !== 0) {
        const errMsg = stderr || "未知错误";
        reject(new Error(errMsg));
        return;
      }

      try {
        const resp = JSON.parse(stdout);
        if (resp.error) {
          const errorMsg = resp.error.message || JSON.stringify(resp.error);
          reject(new Error(errorMsg));
          return;
        }
        const content = resp.choices?.[0]?.message?.content;
        if (!content) {
          reject(new Error("返回为空"));
          return;
        }
        resolve(content);
      } catch (e) {
        reject(new Error(`解析响应失败: ${e.message}`));
      }
    });

    curl.stdin.write(body);
    curl.stdin.end();
  });
}

/**
 * 调用 OpenAI 兼容 API（带自动重试）
 * @param {Object} config - {baseUrl, apiKey, model}
 * @param {string} systemPrompt - 系统 Prompt
 * @param {string} userMessage - 用户输入
 * @param {Object} [options] - {temperature, maxTokens, timeout, onRetry}
 * @returns {Promise<string>} AI 返回的文本
 */
async function callApi(config, systemPrompt, userMessage, options = {}) {
  const { onRetry, ...callOptions } = options;

  // 输入长度验证
  if (userMessage.length > MAX_INPUT_LENGTH) {
    throw new Error(
      friendlyError(`输入文本过长（${userMessage.length} 字符）`, config.model),
    );
  }

  // 检查 curl 是否可用
  const hasCurl = await checkCurl();
  if (!hasCurl) {
    throw new Error(friendlyError("curl not found", config.model));
  }

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callApiOnce(config, systemPrompt, userMessage, callOptions);
    } catch (err) {
      lastError = err;

      // 如果是不值得重试的错误（认证错误、模型不存在等），直接抛出友好消息
      if (!isRetryableError(err) || attempt >= MAX_RETRIES) {
        throw new Error(friendlyError(err.message, config.model));
      }

      // 等待后重试
      const delayMs = RETRY_DELAYS[attempt] || 8000;
      if (onRetry) {
        onRetry(attempt + 1, MAX_RETRIES, delayMs);
      }
      await delay(delayMs);
    }
  }

  // 所有重试都失败，包装为友好消息抛出
  throw new Error(friendlyError(lastError.message, config.model));
}

/**
 * 两步路由：第一步意图识别（快速低温），第二步生成（正常温度）
 */
async function callRouterApi(config, systemPrompt, userMessage, onRetry) {
  return callApi(config, systemPrompt, userMessage, {
    temperature: 0.1,
    maxTokens: 500,
    timeout: 30,
    onRetry,
  });
}

async function callGenerationApi(
  config,
  systemPrompt,
  userMessage,
  isComposite = false,
  onRetry,
) {
  return callApi(config, systemPrompt, userMessage, {
    temperature: 0.7,
    maxTokens: isComposite ? 8192 : 4096,
    timeout: 120,
    onRetry,
  });
}

module.exports = { callApi, callRouterApi, callGenerationApi, testApiConfig };

/**
 * 轻量级 API 配置测试
 * 发送一个极简请求验证连通性（maxTokens=5, 极低开销）
 * @param {Object} config - {baseUrl, apiKey, model}
 * @returns {Promise<{ok: boolean, message: string, latency: number}>}
 */
async function testApiConfig(config) {
  const start = Date.now();
  try {
    // 格式校验（先规范化尾部斜杠）
    const baseUrl = (config.baseUrl || "").replace(/\/+$/, "");
    if (!baseUrl || !baseUrl.match(/^https?:\/\//)) {
      return {
        ok: false,
        message: "Base URL 格式错误：必须以 http:// 或 https:// 开头",
        latency: 0,
      };
    }
    if (!baseUrl.endsWith("/v1")) {
      return {
        ok: false,
        message:
          "Base URL 格式错误：必须以 /v1 结尾（例如：https://api.openai.com/v1）",
        latency: 0,
      };
    }
    if (!config.apiKey || !config.apiKey.trim()) {
      return { ok: false, message: "API Key 不能为空", latency: 0 };
    }
    if (!config.model || !config.model.trim()) {
      return { ok: false, message: "模型名称不能为空", latency: 0 };
    }

    // 发送极简请求
    const result = await callApiOnce(config, "Reply with OK", "test", {
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
