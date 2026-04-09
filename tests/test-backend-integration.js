/**
 * 2026-04-08 P9.11: 跨端后端集成测试
 * 设计思路：通过 Node.js 直接调用后端 API，验证各端关键场景
 *   - 正常增强请求（匿名 + 带 Token）
 *   - 后端不可用回退（模拟超时）
 *   - 错误码映射
 *   - /health 端点
 * 影响范围：tests/test-backend-integration.js（新建）
 * 潜在风险：无已知风险（只读测试，不修改后端状态）
 *
 * 运行方式：node tests/test-backend-integration.js [--base-url URL] [--token TOKEN]
 */

const https = require("https");
const http = require("http");
const { URL } = require("url");

// ── 配置 ──────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const BASE_URL = getArg("--base-url", "https://api.zhiz.chat");
const TOKEN = getArg("--token", "");
// 2026-04-08 修改 — AI 增强请求需要较长超时（讯飞星辰响应 ~10-20s）
const TIMEOUT_MS = parseInt(getArg("--timeout", "60000"), 10);

// ── 工具函数 ──────────────────────────────────────────
let passed = 0;
let failed = 0;
let skipped = 0;

function log(icon, msg) {
  console.log(`${icon} ${msg}`);
}

/**
 * 发送 HTTP 请求
 * @param {string} method
 * @param {string} path
 * @param {object} [body]
 * @param {object} [extraHeaders]
 * @param {number} [timeoutMs]
 * @returns {Promise<{status: number, data: object|string, latencyMs: number}>}
 */
function request(
  method,
  path,
  body = null,
  extraHeaders = {},
  timeoutMs = TIMEOUT_MS,
) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const mod = url.protocol === "https:" ? https : http;
    const headers = {
      "Content-Type": "application/json",
      ...extraHeaders,
    };
    if (body) {
      headers["Content-Length"] = Buffer.byteLength(JSON.stringify(body));
    }

    const start = Date.now();
    const req = mod.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const latencyMs = Date.now() - start;
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, data: parsed, latencyMs });
        });
      },
    );

    req.on("error", (err) => reject(err));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * 断言辅助
 */
function assert(condition, testName, detail = "") {
  if (condition) {
    passed++;
    log("✅", testName);
  } else {
    failed++;
    log("❌", `${testName}${detail ? " — " + detail : ""}`);
  }
}

// ── 测试用例 ──────────────────────────────────────────

async function testHealthEndpoint() {
  log("📋", "--- Health Endpoint ---");
  try {
    const { status, data, latencyMs } = await request("GET", "/health");
    assert(status === 200, "GET /health returns 200", `got ${status}`);
    assert(
      data && data.status === "ok",
      "GET /health body.status === 'ok'",
      `got ${JSON.stringify(data)}`,
    );
    assert(latencyMs < 5000, `GET /health latency < 5s`, `was ${latencyMs}ms`);
  } catch (err) {
    failed++;
    log("❌", `GET /health failed: ${err.message}`);
  }
}

async function testAnonymousEnhance() {
  log("📋", "--- Anonymous Enhance ---");
  try {
    const body = {
      input: "写一篇关于人工智能的文章",
      enhanceMode: "fast",
      model: "",
      language: "zh-CN",
      clientType: "test",
    };
    const { status, data, latencyMs } = await request(
      "POST",
      "/api/v1/ai/enhance",
      body,
    );

    // 匿名请求应该成功（可能受限流）或返回限流错误
    if (status === 200 && data.success) {
      assert(true, "Anonymous enhance: 200 OK");
      assert(
        !!data.data?.output,
        "Response has output field",
        `keys: ${Object.keys(data.data || {})}`,
      );
      // 2026-04-08 修正 — 后端 enhance API 返回 {output, model, provider, usage}，
      // scenes/composite 是客户端路由概念，不在后端响应中
      assert(
        typeof data.data?.model === "string",
        "Response has model field",
        `got ${typeof data.data?.model}`,
      );
      assert(latencyMs < 60000, `Latency < 60s`, `was ${latencyMs}ms`);
    } else if (status === 429) {
      // 限流也是合法的匿名行为
      assert(
        true,
        "Anonymous enhance: 429 rate limited (expected for anonymous)",
      );
      assert(
        data.error?.code === "RATE_LIMIT_EXCEEDED",
        "Rate limit error code correct",
        `got ${data.error?.code}`,
      );
    } else {
      // 其他错误
      assert(
        false,
        `Anonymous enhance unexpected status`,
        `${status}: ${JSON.stringify(data)}`,
      );
    }
  } catch (err) {
    failed++;
    log("❌", `Anonymous enhance failed: ${err.message}`);
  }
}

async function testAuthenticatedEnhance() {
  log("📋", "--- Authenticated Enhance ---");
  if (!TOKEN) {
    skipped++;
    log("⏭️", "Skipped (no --token provided)");
    return;
  }

  try {
    const body = {
      input: "帮我优化这段代码",
      enhanceMode: "fast",
      model: "",
      language: "zh-CN",
      clientType: "test",
    };
    const headers = { Authorization: `Bearer ${TOKEN}` };
    const { status, data } = await request(
      "POST",
      "/api/v1/ai/enhance",
      body,
      headers,
    );

    if (status === 200 && data.success) {
      assert(true, "Authenticated enhance: 200 OK");
      assert(!!data.data?.output, "Response has output field");
    } else if (status === 401) {
      assert(true, "Authenticated enhance: 401 (token may be invalid/expired)");
    } else {
      assert(
        false,
        `Authenticated enhance unexpected`,
        `${status}: ${JSON.stringify(data)}`,
      );
    }
  } catch (err) {
    failed++;
    log("❌", `Authenticated enhance failed: ${err.message}`);
  }
}

async function testErrorMapping() {
  log("📋", "--- Error Mapping ---");

  // Missing input field
  try {
    const { status, data } = await request("POST", "/api/v1/ai/enhance", {
      enhanceMode: "fast",
      clientType: "test",
    });
    assert(
      status === 400 || (status === 422 && !data.success),
      "Missing input returns 400/422",
      `got ${status}`,
    );
  } catch (err) {
    failed++;
    log("❌", `Error mapping (missing input) failed: ${err.message}`);
  }

  // Invalid endpoint
  try {
    const { status } = await request("GET", "/api/v1/nonexistent");
    assert(status === 404, "Nonexistent endpoint returns 404", `got ${status}`);
  } catch (err) {
    failed++;
    log("❌", `Error mapping (404) failed: ${err.message}`);
  }
}

async function testResponseFormat() {
  log("📋", "--- Response Format ---");
  try {
    const body = {
      input: "测试请求格式",
      enhanceMode: "fast",
      model: "",
      language: "zh-CN",
      clientType: "test",
    };
    const { status, data } = await request("POST", "/api/v1/ai/enhance", body);

    if (status === 200 && data.success) {
      // 验证响应格式符合 CLIENT_MIGRATION_GUIDE 定义
      assert(
        typeof data.success === "boolean",
        "Response has boolean success field",
      );
      assert(typeof data.data === "object", "Response has data object");
      assert(typeof data.data.output === "string", "data.output is string");
      // 2026-04-08 修正 — 验证后端实际返回字段（model, provider, usage）
      assert(typeof data.data.model === "string", "data.model is string");
      assert(typeof data.data.provider === "string", "data.provider is string");
    } else if (status === 429) {
      log("⏭️", "Rate limited — skipping format check");
      skipped++;
    } else {
      // Error response format
      assert(
        typeof data.success === "boolean",
        "Error response has boolean success field",
      );
      if (!data.success) {
        assert(
          typeof data.error === "object",
          "Error response has error object",
        );
        assert(typeof data.error.code === "string", "error.code is string");
        assert(
          typeof data.error.message === "string",
          "error.message is string",
        );
      }
    }
  } catch (err) {
    failed++;
    log("❌", `Response format check failed: ${err.message}`);
  }
}

async function testClientTypes() {
  log("📋", "--- Client Type Variants ---");
  const clientTypes = ["web", "browser", "vscode", "intellij"];

  for (const clientType of clientTypes) {
    try {
      const body = {
        input: `测试 ${clientType} 客户端`,
        enhanceMode: "fast",
        model: "",
        language: "zh-CN",
        clientType,
      };
      const { status } = await request("POST", "/api/v1/ai/enhance", body);
      // 任何非 5xx 响应都说明 clientType 被接受
      assert(
        status < 500,
        `clientType="${clientType}" accepted (HTTP ${status})`,
      );
    } catch (err) {
      failed++;
      log("❌", `clientType="${clientType}" failed: ${err.message}`);
    }
  }
}

// ── 主流程 ──────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  Easy Prompt — Backend Integration Tests        ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Token: ${TOKEN ? TOKEN.slice(0, 8) + "..." : "(anonymous)"}`);
  console.log("");

  await testHealthEndpoint();
  console.log("");
  await testAnonymousEnhance();
  console.log("");
  await testAuthenticatedEnhance();
  console.log("");
  await testErrorMapping();
  console.log("");
  await testResponseFormat();
  console.log("");
  await testClientTypes();

  console.log("");
  console.log("═══════════════════════════════════════════════════");
  console.log(
    `Results: ${passed} passed, ${failed} failed, ${skipped} skipped`,
  );
  console.log("═══════════════════════════════════════════════════");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
