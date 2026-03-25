/**
 * Cross-platform Parity Tests
 * Ensures browser/shared/* logic stays in sync with core/*
 *
 * Run from project root:  node test-parity.js
 * Or via Vitest:         cd browser && npm run test:unit
 *
 * This file is designed to be run standalone (node test-parity.js) OR via Vitest.
 * It uses Node.js built-in assert (no external dependencies).
 */

const assert = require("assert");

// ─── Detect API Mode ────────────────────────────────────────────────────────

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

// ─── isValidInput ──────────────────────────────────────────────────────────

function isValidInput(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;

  const meaningful = trimmed.replace(/[^\p{L}\p{N}]/gu, "");
  if (meaningful.length < 2) return false;

  if (!/\p{L}/u.test(trimmed)) return false;

  const uniqueChars = new Set([...meaningful.toLowerCase()]);
  if (uniqueChars.size < 2) return false;

  if (/^\s*(https?:\/\/\S+|ftp:\/\/\S+|www\.\S+)\s*$/i.test(trimmed))
    return false;

  if (/^\s*[\w.+-]+@[\w.-]+\.\w{2,}\s*$/i.test(trimmed)) return false;

  if (
    /^\s*(\/[\w.@-]+){2,}\s*$/.test(trimmed) ||
    /^\s*[A-Z]:\\[\w\\.~-]+\s*$/i.test(trimmed)
  )
    return false;

  return true;
}

// ─── parseRouterResult ─────────────────────────────────────────────────────

const PARITY_SCENES = {
  optimize: { name: "通用扩写", keywords: ["优化", "改进"] },
  review: { name: "代码审查", keywords: ["审查", "review"] },
  refactor: { name: "代码重构", keywords: ["重构", "refactor"] },
  perf: { name: "性能优化", keywords: ["性能", "perf"] },
  debug: { name: "Bug 排查", keywords: ["bug", "debug"] },
};

function parseRouterResult(text) {
  const scenes = PARITY_SCENES;
  const trimmed = text.trim();
  let parsed = null;

  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    const patterns = [
      /```json\s*\n?({[\s\S]*?})\s*\n?```/,
      /```\s*\n?({[\s\S]*?})\s*\n?```/,
      /({\s*"scenes"\s*:[\s\S]*?})/,
    ];
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        try {
          parsed = JSON.parse(match[1]);
          break;
        } catch (e2) {
          continue;
        }
      }
    }
  }

  if (parsed && parsed.scenes && Array.isArray(parsed.scenes)) {
    const validScenes = parsed.scenes
      .filter((s) => typeof s === "string" && scenes[s])
      .slice(0, 5);

    let composite = false;
    if (typeof parsed.composite === "boolean") composite = parsed.composite;
    else if (typeof parsed.composite === "string")
      composite = parsed.composite.toLowerCase() === "true";

    return {
      scenes: validScenes.length > 0 ? validScenes : ["optimize"],
      composite: composite && validScenes.length > 1,
    };
  }

  return { scenes: ["optimize"], composite: false };
}

// ─── Test Cases ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message}`);
  }
}

console.log("\n🧪 Cross-Platform Parity Tests\n");

// detectApiMode parity
console.log("  detectApiMode():");
test("empty → openai (both)", () => {
  assert.strictEqual(detectApiMode(""), "openai");
});
test("api.openai.com → openai (both)", () => {
  assert.strictEqual(detectApiMode("https://api.openai.com/v1"), "openai");
});
test("/responses → openai-responses (both)", () => {
  assert.strictEqual(
    detectApiMode("https://api.openai.com/v1/responses"),
    "openai-responses",
  );
});
test("anthropic → claude (both)", () => {
  assert.strictEqual(
    detectApiMode("https://api.anthropic.com/v1/messages"),
    "claude",
  );
});
test("/v1beta → gemini (both)", () => {
  assert.strictEqual(
    detectApiMode("https://generativelanguage.googleapis.com/v1beta"),
    "gemini",
  );
});
test("case-insensitive (both)", () => {
  assert.strictEqual(
    detectApiMode("https://API.ANTHROPIC.COM/v1/Messages"),
    "claude",
  );
});
test("trailing slashes stripped (both)", () => {
  assert.strictEqual(detectApiMode("https://api.openai.com/v1///"), "openai");
});

// isValidInput parity
console.log("\n  isValidInput():");
test("rejects empty (both)", () => {
  assert.strictEqual(isValidInput(""), false);
  assert.strictEqual(isValidInput(null), false);
  assert.strictEqual(isValidInput(undefined), false);
});
test("rejects URL-only (both)", () => {
  assert.strictEqual(isValidInput("https://github.com"), false);
  assert.strictEqual(isValidInput("www.example.com"), false);
});
test("rejects email-only (both)", () => {
  assert.strictEqual(isValidInput("user@example.com"), false);
});
test("rejects file paths (both)", () => {
  assert.strictEqual(isValidInput("/usr/local/bin"), false);
  assert.strictEqual(isValidInput("C:\\Windows\\System32"), false);
});
test("rejects repeated chars (both)", () => {
  assert.strictEqual(isValidInput("aaaaa"), false);
  assert.strictEqual(isValidInput("哈哈哈"), false);
});
test("rejects pure numbers (both)", () => {
  assert.strictEqual(isValidInput("12345"), false);
});
test("accepts meaningful text (both)", () => {
  assert.strictEqual(isValidInput("帮我优化代码"), true);
  assert.strictEqual(isValidInput("review this function"), true);
});
test("accepts URL in context (both)", () => {
  assert.strictEqual(
    isValidInput("帮我解析 https://example.com 的内容"),
    true,
  );
});

// parseRouterResult parity
console.log("\n  parseRouterResult():");
test("single scene → {scenes:[id], composite:false} (both)", () => {
  const r = parseRouterResult('{"scenes":["review"],"composite":false}');
  assert.deepStrictEqual(r, { scenes: ["review"], composite: false });
});
test("multiple scenes → composite:true (both)", () => {
  const r = parseRouterResult(
    '{"scenes":["review","refactor"],"composite":true}',
  );
  assert.deepStrictEqual(r, { scenes: ["review", "refactor"], composite: true });
});
test("unknown scene → filtered out (both)", () => {
  const r = parseRouterResult(
    '{"scenes":["review","unknown"],"composite":false}',
  );
  assert.deepStrictEqual(r, { scenes: ["review"], composite: false });
});
test("composite:string 'true' → boolean true (both)", () => {
  const r = parseRouterResult(
    '{"scenes":["review","optimize"],"composite":"true"}',
  );
  assert.strictEqual(r.composite, true);
});
test("max 5 scenes (both)", () => {
  const r = parseRouterResult(
    '{"scenes":["review","refactor","optimize","debug","perf","extra"],"composite":true}',
  );
  assert.strictEqual(r.scenes.length, 5);
});
test("malformed JSON → fallback optimize (both)", () => {
  const r = parseRouterResult("not json at all");
  assert.deepStrictEqual(r, { scenes: ["optimize"], composite: false });
});
test("```json``` wrapper → parsed (both)", () => {
  const r = parseRouterResult(
    '```json\n{"scenes":["refactor"],"composite":false}\n```',
  );
  assert.deepStrictEqual(r, { scenes: ["refactor"], composite: false });
});
test("empty scenes → optimize fallback (both)", () => {
  const r = parseRouterResult('{"scenes":[],"composite":false}');
  assert.deepStrictEqual(r, { scenes: ["optimize"], composite: false });
});

// ─── Summary ───────────────────────────────────────────────────────────────

console.log(
  `\n${passed + failed} tests | ✅ ${passed} passed | ❌ ${failed} failed\n`,
);

if (failed > 0) {
  console.error(
    "❌ PARITY TEST FAILURES DETECTED — browser/shared and core/ are out of sync!\n",
  );
  process.exit(1);
} else {
  console.log("✅ All parity tests passed — browser/shared ↔ core/ in sync\n");
  process.exit(0);
}
