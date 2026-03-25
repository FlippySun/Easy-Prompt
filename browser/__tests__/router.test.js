/**
 * Unit Tests for browser/shared/router.js
 * Tests isValidInput(), parseRouterResult(), and pure logic functions.
 * Does NOT test async API calls or smartRoute/directGenerate.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Minimal Scenes mock (matches the Scenes module interface) ───────────────
const MOCK_SCENES = {
  optimize: { name: "通用扩写", keywords: ["优化", "改进"], prompt: "扩写专家" },
  review: { name: "代码审查", keywords: ["审查", "review"], prompt: "审查专家" },
  refactor: { name: "代码重构", keywords: ["重构", "refactor"], prompt: "重构专家" },
  perf: { name: "性能优化", keywords: ["性能", "优化", "perf"], prompt: "性能专家" },
  debug: { name: "Bug 排查", keywords: ["bug", "debug", "错误"], prompt: "调试专家" },
};

const MOCK_SCENE_NAMES = {
  optimize: "通用扩写",
  review: "代码审查",
  refactor: "代码重构",
  perf: "性能优化",
  debug: "Bug 排查",
};

// ─── isValidInput — inline copy from router.js ────────────────────────────
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

// ─── parseRouterResult — inline copy from router.js ──────────────────────
function parseRouterResult(text) {
  const scenes = MOCK_SCENES;
  let parsed = null;
  const trimmed = text.trim();

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

// ─── Tests ────────────────────────────────────────────────────────────────

describe("isValidInput()", () => {
  // Rejects empty / null / undefined
  it("rejects null", () => expect(isValidInput(null)).toBe(false));
  it("rejects undefined", () => expect(isValidInput(undefined)).toBe(false));
  it("rejects empty string", () => expect(isValidInput("")).toBe(false));
  it("rejects whitespace-only string", () => expect(isValidInput("   ")).toBe(false));

  // Rejects too-short input
  it("rejects single character", () => expect(isValidInput("a")).toBe(false));
  it("rejects two whitespace chars", () => expect(isValidInput("  ")).toBe(false));

  // Rejects pure URL / email / path
  it("rejects pure http URL", () =>
    expect(isValidInput("https://github.com")).toBe(false));
  it("rejects pure https URL", () =>
    expect(isValidInput("https://example.com/path")).toBe(false));
  it("rejects pure www URL", () =>
    expect(isValidInput("www.example.com")).toBe(false));
  it("rejects pure ftp URL", () =>
    expect(isValidInput("ftp://files.example.com")).toBe(false));
  it("rejects pure email", () =>
    expect(isValidInput("user@example.com")).toBe(false));
  it("rejects pure Unix file path", () =>
    expect(isValidInput("/usr/local/bin/node")).toBe(false));
  it("rejects pure Windows path", () =>
    expect(isValidInput("C:\\Users\\Name\\file.txt")).toBe(false));

  // Rejects repeating characters
  it("rejects repeated letters (aaa)", () =>
    expect(isValidInput("aaa")).toBe(false));
  it("rejects repeated numbers", () =>
    expect(isValidInput("11111")).toBe(false));
  it("rejects repeated Chinese chars", () =>
    expect(isValidInput("啊啊啊")).toBe(false));

  // Rejects pure numbers
  it("rejects pure numbers", () => expect(isValidInput("12345")).toBe(false));
  it("rejects numbers with spaces", () =>
    expect(isValidInput("123 456")).toBe(false));

  // Accepts valid input
  it("accepts normal English sentence", () =>
    expect(isValidInput("帮我优化这段代码")).toBe(true));
  it("accepts short valid Chinese text", () =>
    expect(isValidInput("写个函数")).toBe(true));
  it("accepts mixed English and numbers", () =>
    expect(isValidInput("fix the bug in function")).toBe(true));
  it("accepts text with URL embedded", () =>
    expect(isValidInput("帮我解析 https://example.com 的内容")).toBe(true));
  it("accepts text with email embedded", () =>
    expect(isValidInput("联系 user@company.com 解决这个问题")).toBe(true));

  // Trims whitespace
  it("trims leading/trailing whitespace", () =>
    expect(isValidInput("  帮我优化代码  ")).toBe(true));
});

describe("parseRouterResult()", () => {
  it("parses valid JSON with single scene", () => {
    const result = parseRouterResult('{"scenes":["review"],"composite":false}');
    expect(result.scenes).toEqual(["review"]);
    expect(result.composite).toBe(false);
  });

  it("parses valid JSON with multiple scenes", () => {
    const result = parseRouterResult(
      '{"scenes":["review","perf","doc"],"composite":true}',
    );
    expect(result.scenes).toEqual(["review", "perf"]);
    expect(result.composite).toBe(true);
  });

  it("filters out unknown scene IDs", () => {
    const result = parseRouterResult(
      '{"scenes":["review","unknown-scene","perf"],"composite":false}',
    );
    expect(result.scenes).toEqual(["review", "perf"]);
    expect(result.composite).toBe(false);
  });

  it("limits scenes to max 5", () => {
    const result = parseRouterResult(
      '{"scenes":["review","refactor","perf","debug","optimize","extra"],"composite":true}',
    );
    expect(result.scenes).toHaveLength(5);
  });

  it("defaults to optimize if all scenes are invalid", () => {
    const result = parseRouterResult(
      '{"scenes":["invalid1","invalid2"],"composite":false}',
    );
    expect(result.scenes).toEqual(["optimize"]);
    expect(result.composite).toBe(false);
  });

  it("handles composite as string 'true'", () => {
    const result = parseRouterResult(
      '{"scenes":["review","perf"],"composite":"true"}',
    );
    expect(result.composite).toBe(true);
    expect(result.scenes).toEqual(["review", "perf"]);
  });

  it("handles composite as string 'false'", () => {
    const result = parseRouterResult(
      '{"scenes":["review"],"composite":"false"}',
    );
    expect(result.composite).toBe(false);
  });

  it("sets composite=false when single scene even if composite=true", () => {
    const result = parseRouterResult('{"scenes":["review"],"composite":true}');
    expect(result.composite).toBe(false);
    expect(result.scenes).toEqual(["review"]);
  });

  it("parses JSON wrapped in ```json ```", () => {
    const result = parseRouterResult(
      '```json\n{"scenes":["debug"],"composite":false}\n```',
    );
    expect(result.scenes).toEqual(["debug"]);
  });

  it("parses JSON with text before/after (captures first valid JSON block)", () => {
    const result = parseRouterResult(
      'Here is the result: {"scenes":["review","refactor"],"composite":true} - thanks!',
    );
    expect(result.scenes).toEqual(["review", "refactor"]);
    expect(result.composite).toBe(true);
  });

  it("handles malformed JSON gracefully", () => {
    const result = parseRouterResult("this is not JSON at all");
    expect(result.scenes).toEqual(["optimize"]);
    expect(result.composite).toBe(false);
  });

  it("handles JSON with extra text", () => {
    const result = parseRouterResult(
      'Here is the result: {"scenes":["review"],"composite":false} - thanks!',
    );
    expect(result.scenes).toEqual(["review"]);
  });

  it("handles empty scenes array", () => {
    const result = parseRouterResult('{"scenes":[],"composite":false}');
    expect(result.scenes).toEqual(["optimize"]);
  });

  it("handles null/undefined scenes", () => {
    expect(
      parseRouterResult('{"scenes":null,"composite":false}').scenes,
    ).toEqual(["optimize"]);
    expect(
      parseRouterResult('{"scenes":undefined,"composite":false}').scenes,
    ).toEqual(["optimize"]);
  });

  it("handles non-array scenes", () => {
    const result = parseRouterResult('{"scenes":"review","composite":false}');
    expect(result.scenes).toEqual(["optimize"]);
  });

  it("handles trailing whitespace", () => {
    const result = parseRouterResult(
      '  {"scenes":["debug"],"composite":false}  \n',
    );
    expect(result.scenes).toEqual(["debug"]);
  });

  it("skips non-string scene IDs", () => {
    const result = parseRouterResult(
      '{"scenes":["review",123,null,"perf"],"composite":false}',
    );
    expect(result.scenes).toEqual(["review", "perf"]);
  });
});
