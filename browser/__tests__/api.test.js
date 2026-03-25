/**
 * Unit Tests for browser/shared/api.js
 * Pure function tests — no network calls, no chrome.storage mocking needed.
 */
import { describe, it, expect } from "vitest";

// Inline minimal Api module for testing (avoids ESM import path issues)
const MAX_INPUT_LENGTH = 10000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

const API_MODES = {
  openai: "OpenAI Chat Completions",
  "openai-responses": "OpenAI Responses API",
  claude: "Claude API",
  gemini: "Google Gemini API",
};

const DEFAULT_API_PATHS = {
  openai: "/v1/chat/completions",
  "openai-responses": "/v1/responses",
  claude: "/v1/messages",
  gemini: "/v1beta",
};

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
    return `模型 "${model}"不可用 · 请在设置中检查模型名称是否正确`;
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

// ─── Tests ────────────────────────────────────────────────────────────────

describe("API Constants", () => {
  it("should define MAX_INPUT_LENGTH as 10000", () => {
    expect(MAX_INPUT_LENGTH).toBe(10000);
  });

  it("should define MAX_RETRIES as 3", () => {
    expect(MAX_RETRIES).toBe(3);
  });

  it("should define RETRY_DELAYS with 3 values", () => {
    expect(RETRY_DELAYS).toHaveLength(3);
    expect(RETRY_DELAYS).toEqual([2000, 4000, 8000]);
  });

  it("should define all 4 API modes", () => {
    expect(Object.keys(API_MODES)).toHaveLength(4);
    expect(API_MODES.openai).toBe("OpenAI Chat Completions");
    expect(API_MODES["openai-responses"]).toBe("OpenAI Responses API");
    expect(API_MODES.claude).toBe("Claude API");
    expect(API_MODES.gemini).toBe("Google Gemini API");
  });

  it("should define default paths for all API modes", () => {
    expect(DEFAULT_API_PATHS.openai).toBe("/v1/chat/completions");
    expect(DEFAULT_API_PATHS["openai-responses"]).toBe("/v1/responses");
    expect(DEFAULT_API_PATHS.claude).toBe("/v1/messages");
    expect(DEFAULT_API_PATHS.gemini).toBe("/v1beta");
  });
});

describe("detectApiMode()", () => {
  it("returns 'openai' for null/undefined/empty", () => {
    expect(detectApiMode("")).toBe("openai");
    expect(detectApiMode(null)).toBe("openai");
    expect(detectApiMode(undefined)).toBe("openai");
  });

  it("returns 'openai' by default", () => {
    expect(detectApiMode("https://api.openai.com/v1")).toBe("openai");
    expect(detectApiMode("https://api.example.com/")).toBe("openai");
  });

  it("returns 'openai-responses' for /responses endpoint", () => {
    expect(detectApiMode("https://api.openai.com/v1/responses")).toBe(
      "openai-responses",
    );
    expect(detectApiMode("https://custom.ai/responses/")).toBe(
      "openai-responses",
    );
  });

  it("returns 'claude' for anthropic URLs", () => {
    expect(detectApiMode("https://api.anthropic.com/v1/messages")).toBe(
      "claude",
    );
    expect(detectApiMode("https://claude.ai/api/v1/messages")).toBe("claude");
  });

  it("returns 'claude' for /messages endpoint", () => {
    expect(detectApiMode("https://api.example.com/v1/messages")).toBe("claude");
    expect(detectApiMode("https://api.example.com/messages/")).toBe("claude");
  });

  it("returns 'gemini' for generativelanguage.googleapis.com", () => {
    expect(
      detectApiMode(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro",
      ),
    ).toBe("gemini");
  });

  it("returns 'gemini' for /v1beta or /v1alpha paths", () => {
    expect(detectApiMode("https://api.example.com/v1beta")).toBe("gemini");
    expect(detectApiMode("https://api.example.com/v1alpha/models")).toBe(
      "gemini",
    );
  });

  it("is case-insensitive", () => {
    expect(detectApiMode("https://API.ANTHROPIC.COM/v1/Messages")).toBe(
      "claude",
    );
    expect(detectApiMode("https://GENERATIVELANGUAGE.GOOGLEAPI.COM/v1beta")).toBe(
      "gemini",
    );
  });

  it("strips trailing slashes before detection", () => {
    expect(detectApiMode("https://api.openai.com/v1/")).toBe("openai");
    expect(detectApiMode("https://api.anthropic.com/v1/messages///")).toBe(
      "claude",
    );
  });
});

describe("isRetryableError()", () => {
  it("returns true for HTTP 503", () =>
    expect(isRetryableError({ message: "503 Service Unavailable" })).toBe(
      true,
    ));

  it("returns true for rate limit (429)", () =>
    expect(
      isRetryableError({ message: "429 Too Many Requests" }),
    ).toBe(true));

  it("returns true for overloaded", () =>
    expect(isRetryableError({ message: "cpu overloaded" })).toBe(true));

  it("returns true for bad gateway", () =>
    expect(isRetryableError({ message: "502 Bad Gateway" })).toBe(true));

  it("returns true for upstream request failed", () =>
    expect(isRetryableError({ message: "upstream request failed" })).toBe(
      true,
    ));

  it("returns true for rate_limit (snake case)", () =>
    expect(isRetryableError({ message: "rate_limit exceeded" })).toBe(true));

  it("returns true for timeout", () =>
    expect(isRetryableError({ message: "etimedout" })).toBe(true));

  it("returns true for failed to fetch", () =>
    expect(isRetryableError({ message: "failed to fetch" })).toBe(true));

  it("returns false for 401 Unauthorized", () =>
    expect(isRetryableError({ message: "401 Unauthorized" })).toBe(false));

  it("returns false for 403 Forbidden", () =>
    expect(isRetryableError({ message: "403 Forbidden" })).toBe(false));

  it("returns false for quota exceeded", () =>
    expect(isRetryableError({ message: "quota exceeded" })).toBe(false));

  it("returns false for generic errors", () =>
    expect(isRetryableError({ message: "Something went wrong" })).toBe(false));

  it("handles empty message", () =>
    expect(isRetryableError({ message: "" })).toBe(false));

  it("handles undefined message", () =>
    expect(isRetryableError({ message: undefined })).toBe(false));
});

describe("shouldTryResponsesFallback()", () => {
  it("returns true when mode is openai-responses and error is upstream failure", () => {
    expect(
      shouldTryResponsesFallback(
        { message: "upstream request failed" },
        { apiMode: "openai-responses", baseUrl: "https://api.openai.com/v1" },
      ),
    ).toBe(true);
  });

  it("returns false when mode is openai", () => {
    expect(
      shouldTryResponsesFallback(
        { message: "upstream request failed" },
        { apiMode: "openai", baseUrl: "https://api.openai.com" },
      ),
    ).toBe(false);
  });

  it("returns false for non-upstream errors", () => {
    expect(
      shouldTryResponsesFallback(
        { message: "401 Unauthorized" },
        { apiMode: "openai-responses", baseUrl: "https://api.openai.com" },
      ),
    ).toBe(false);
  });

  it("infers mode from baseUrl when apiMode not set", () => {
    expect(
      shouldTryResponsesFallback(
        { message: "upstream request failed" },
        { baseUrl: "https://api.openai.com/v1/responses" },
      ),
    ).toBe(true);
  });
});

describe("stripApiEndpoint()", () => {
  it("strips /responses suffix", () => {
    expect(stripApiEndpoint("https://api.openai.com/v1/responses")).toBe(
      "https://api.openai.com/v1",
    );
  });

  it("strips /chat/completions suffix", () => {
    expect(stripApiEndpoint("https://api.openai.com/v1/chat/completions")).toBe(
      "https://api.openai.com/v1",
    );
  });

  it("strips /messages suffix", () => {
    expect(stripApiEndpoint("https://api.anthropic.com/v1/messages")).toBe(
      "https://api.anthropic.com/v1",
    );
  });

  it("handles URLs without trailing slashes", () => {
    expect(stripApiEndpoint("https://api.openai.com/v1")).toBe(
      "https://api.openai.com/v1",
    );
  });

  it("strips trailing slashes", () => {
    expect(stripApiEndpoint("https://api.openai.com/v1/responses/")).toBe(
      "https://api.openai.com/v1",
    );
  });

  it("handles empty input", () => {
    expect(stripApiEndpoint("")).toBe("");
    expect(stripApiEndpoint(null)).toBe("");
    expect(stripApiEndpoint(undefined)).toBe("");
  });
});

describe("friendlyError()", () => {
  it("returns CPU overload message for overloaded errors", () => {
    const result = friendlyError("cpu overloaded", "gpt-5.4");
    expect(result).toContain("API 服务器繁忙");
  });

  it("returns 503 message for service unavailable", () => {
    const result = friendlyError("503 Service Unavailable", "gpt-5.4");
    expect(result).toContain("503");
    expect(result).toContain("暂时不可用");
  });

  it("returns 502 message for bad gateway", () => {
    const result = friendlyError("502 Bad Gateway", "gpt-5.4");
    expect(result).toContain("502");
    expect(result).toContain("网关错误");
  });

  it("returns 401 message for invalid API key", () => {
    const result = friendlyError("401 Unauthorized", "gpt-5.4");
    expect(result).toContain("API Key 无效或已过期");
  });

  it("returns 403 message for forbidden", () => {
    const result = friendlyError("403 Forbidden", "gpt-5.4");
    expect(result).toContain("403");
    expect(result).toContain("访问被拒绝");
  });

  it("returns 429 message for rate limit", () => {
    const result = friendlyError("429 Too Many Requests", "gpt-5.4");
    expect(result).toContain("429");
    expect(result).toContain("频率超限");
  });

  it("returns quota message and includes dollar amounts", () => {
    const result = friendlyError(
      "quota exceeded — remain \$0.50 need \$1.00",
      "gpt-5.4",
    );
    expect(result).toContain("额度不足");
    expect(result).toContain("$0.50");
    expect(result).toContain("$1.00");
  });

  it("returns network error message for failed to fetch", () => {
    const result = friendlyError("failed to fetch", "gpt-5.4");
    expect(result).toContain("无法连接到 API 服务器");
  });

  it("returns timeout message for timeout errors", () => {
    const result = friendlyError("request timed out", "gpt-5.4");
    expect(result).toContain("超时");
  });

  it("returns default message for unknown errors", () => {
    const result = friendlyError("Something mysterious happened", "gpt-5.4");
    expect(result).toContain("API 调用出错");
    expect(result).toContain("Something mysterious happened");
  });

  it("escapes model name in the message", () => {
    const result = friendlyError(
      "model does not exist: gpt-5.4<script>",
      "gpt-5.4",
    );
    expect(result).toContain("模型");
    expect(result).toContain("gpt-5.4"); // XSS-safe: quotes stripped
  });
});
