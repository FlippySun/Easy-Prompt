/**
 * Easy Prompt Web — 主应用逻辑
 * 浏览器端实现：场景数据加载、两步 AI 路由、fetch API 调用、UI 控制
 */

/* ═══════════════════════════════════════════════════
   §1. Constants & Configuration
   ═══════════════════════════════════════════════════ */

const MAX_INPUT_LENGTH = 10000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

// 场景分类（用于 Browser 和 Picker）
const SCENE_CATEGORIES = [
  {
    id: "requirement",
    name: "需求工程",
    scenes: ["optimize", "split-task", "techstack", "api-design"],
  },
  {
    id: "development",
    name: "代码开发",
    scenes: [
      "refactor",
      "perf",
      "regex",
      "sql",
      "convert",
      "typescript",
      "css",
      "state",
      "component",
      "form",
      "async",
      "schema",
    ],
  },
  {
    id: "quality",
    name: "质量保障",
    scenes: ["review", "test", "debug", "error", "security", "comment"],
  },
  {
    id: "docs",
    name: "文档沟通",
    scenes: [
      "doc",
      "changelog",
      "commit",
      "proposal",
      "present",
      "explain",
      "followup",
    ],
  },
  {
    id: "ops",
    name: "工程运维",
    scenes: ["devops", "env", "script", "deps", "git", "incident"],
  },
  { id: "general", name: "综合工具", scenes: ["translate", "mock", "algo"] },
];

// 热门场景（首页快捷标签）
const HOT_SCENES = [
  "optimize",
  "refactor",
  "debug",
  "review",
  "test",
  "doc",
  "perf",
  "split-task",
];

/* ═══════════════════════════════════════════════════
   §2. Built-in Default Config (Obfuscated)
   ═══════════════════════════════════════════════════ */

function _getBuiltinDefaults() {
  const _p1 = [104, 116, 116, 112, 115, 58, 47, 47]; // https://
  const _p2 = [97, 112, 105, 46]; // api.
  const _p3 = [121, 121, 100, 115, 49, 54, 56]; // yyds168
  const _p4 = [46, 110, 101, 116, 47, 118, 49]; // .net/v1
  const baseUrl = String.fromCharCode(..._p1, ..._p2, ..._p3, ..._p4);

  const _s1 = [115, 107, 45]; // sk-
  const _s2 = [76, 100, 78, 85, 84, 71, 118, 51]; // LdNUTGv3
  const _s3 = [120, 110, 109, 74, 101, 118, 115, 115]; // xnmJevss
  const _s4 = [50, 81, 97, 90, 78, 81, 117, 81]; // 2QaZNQuQ
  const _s5 = [66, 57, 51, 71, 84, 112, 112, 121]; // B93GTppy
  const _s6 = [56, 110, 98, 111, 50, 87, 71, 106]; // 8nbo2WGj
  const _s7 = [115, 89, 48, 85, 117, 114, 109, 55]; // sY0Uurm7
  const apiKey = String.fromCharCode(
    ..._s1,
    ..._s2,
    ..._s3,
    ..._s4,
    ..._s5,
    ..._s6,
    ..._s7,
  );

  const _m1 = [103, 101, 109, 105, 110, 105]; // gemini
  const _m2 = [45, 51, 45, 112, 114, 111]; // -3-pro
  const _m3 = [45, 112, 114, 101, 118, 105, 101, 119]; // -preview
  const model = String.fromCharCode(..._m1, ..._m2, ..._m3);

  return { baseUrl, apiKey, model };
}

/* ═══════════════════════════════════════════════════
   §3. Config Management (localStorage)
   ═══════════════════════════════════════════════════ */

const STORAGE_KEY = "easy-prompt-config";
const THEME_KEY = "easy-prompt-theme";

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    /* ignore */
  }
  return {};
}

function saveConfig(cfg) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) {
    /* ignore */
  }
}

function getEffectiveConfig() {
  const user = loadConfig();
  const builtin = _getBuiltinDefaults();
  return {
    baseUrl: (user.baseUrl || "").trim() || builtin.baseUrl,
    apiKey: (user.apiKey || "").trim() || builtin.apiKey,
    model: (user.model || "").trim() || builtin.model,
  };
}

/* ═══════════════════════════════════════════════════
   §4. Scene Data (loaded from scenes.json)
   ═══════════════════════════════════════════════════ */

let SCENES = {};
let SCENE_NAMES = {};

async function loadScenes() {
  try {
    const resp = await fetch("scenes.json");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    SCENES = await resp.json();
    SCENE_NAMES = {};
    for (const [id, s] of Object.entries(SCENES)) {
      SCENE_NAMES[id] = s.name;
    }
    window.SCENES = SCENES;
    return true;
  } catch (e) {
    console.error("Failed to load scenes:", e);
    return false;
  }
}

/* ═══════════════════════════════════════════════════
   §5. Router Logic (ported from core/router.js)
   ═══════════════════════════════════════════════════ */

let cachedRouterPrompt = null;

function buildRouterPrompt() {
  if (cachedRouterPrompt) return cachedRouterPrompt;

  const sceneList = Object.entries(SCENES)
    .map(([id, s]) => `- ${id}: ${s.keywords.join("/")} → ${s.name}`)
    .join("\n");

  cachedRouterPrompt = `你是一个意图分类器。分析用户输入，识别其中包含的所有意图场景。

场景列表：
${sceneList}

规则：
1. 返回 JSON，格式：{"scenes":["场景ID1","场景ID2",...],"composite":true/false}
2. 如果用户只有单一意图：{"scenes":["场景ID"],"composite":false}
3. 如果用户有多个意图（如"审查代码并优化性能再写文档"）：{"scenes":["review","perf","doc"],"composite":true}
4. scenes 数组按主次顺序排列，最重要的在前面，最多 5 个
5. 如果都不太匹配，返回 {"scenes":["optimize"],"composite":false}
6. 不要返回任何其他文字，只返回 JSON`;

  return cachedRouterPrompt;
}

function parseRouterResult(text) {
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
      .filter((s) => typeof s === "string" && SCENES[s])
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

function buildGenerationPrompt(routerResult) {
  const validScenes = routerResult.scenes.filter((s) => SCENES[s]);
  if (validScenes.length === 0) validScenes.push("optimize");

  if (validScenes.length === 1 && validScenes[0] === "optimize") {
    return {
      prompt: SCENES.optimize.prompt,
      sceneNames: [SCENES.optimize.name],
    };
  }

  const sceneNames = validScenes.map((s) => SCENE_NAMES[s] || s);

  if (routerResult.composite && validScenes.length > 1) {
    const sceneSections = validScenes
      .map(
        (s, i) =>
          `### 子任务 ${i + 1}：${SCENE_NAMES[s]}
以下是该领域的专家知识（作为参考素材，用于生成该子任务的专业 Prompt）：
${SCENES[s].prompt}`,
      )
      .join("\n\n");

    const prompt = `⚠️ 核心原则：你是一个「Prompt 生成器」，不是「任务执行者」。你的任务是「写出一个专业 Prompt」，不是去执行用户的任务。

用户的复合需求涉及 ${validScenes.length} 个方面：${sceneNames.join("、")}。

${sceneSections}

请基于以上参考素材，将用户的复合需求重写为一个**结构化的专业 Prompt**：

1. 设定一个能覆盖所有子任务的综合专家角色
2. 将复合需求拆分为清晰的子任务章节
3. 每个子任务引用对应领域的专家方法论
4. 子任务间标明依赖和执行顺序
5. 给出统一的输出格式要求

⚠️ Prompt 末尾必须包含执行力约束：
- 要求 AI 直接动手实现/修改，不只给方案
- 分步执行，每步有具体代码改动
- 每步验证确认后再继续
- 以"请立即开始执行第一步"结尾

只输出生成的 Prompt，不要前言。`;

    return { prompt, sceneNames };
  } else {
    const sceneId = validScenes[0];
    const prompt = `⚠️ 核心原则：你是一个「Prompt 生成器」，不是「任务执行者」。你的任务是「写出一个专业 Prompt」，不是去执行用户的任务。

以下是「${SCENE_NAMES[sceneId]}」领域的专家知识（作为参考素材）：
${SCENES[sceneId].prompt}

请基于以上参考素材，将用户的输入重写为一个**专业级 Prompt**：
1. 设定该领域的专家角色
2. 结构化任务要求
3. 补全隐含约束和边界条件
4. 明确输出格式

⚠️ Prompt 末尾必须包含执行力约束：
- 要求 AI 直接动手实现/修改，不只给方案
- 分步执行，每步有具体代码改动
- 每步验证确认后再继续
- 以"请立即开始执行"结尾

只输出生成的 Prompt，不要前言。`;

    return { prompt, sceneNames };
  }
}

/* ═══════════════════════════════════════════════════
   §6. API Client (fetch-based, replaces curl)
   ═══════════════════════════════════════════════════ */

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

  return `API 调用出错: ${errorMsg}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callApiOnce(config, systemPrompt, userMessage, options = {}) {
  const { temperature = 0.7, maxTokens = 4096, timeout = 60 } = options;

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
        if (errBody.error) {
          errorMsg = errBody.error.message || JSON.stringify(errBody.error);
        }
      } catch (e) {
        // couldn't parse error body
      }
      throw new Error(errorMsg);
    }

    const data = await resp.json();
    if (data.error) {
      throw new Error(data.error.message || JSON.stringify(data.error));
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("返回为空");
    return content;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new Error("请求超时");
    }
    throw err;
  }
}

async function callApi(config, systemPrompt, userMessage, options = {}) {
  const { onRetry, ...callOptions } = options;

  if (userMessage.length > MAX_INPUT_LENGTH) {
    throw new Error(
      friendlyError(`输入文本过长（${userMessage.length} 字符）`, config.model),
    );
  }

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callApiOnce(config, systemPrompt, userMessage, callOptions);
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err) || attempt >= MAX_RETRIES) {
        throw new Error(friendlyError(err.message, config.model));
      }
      const delayMs = RETRY_DELAYS[attempt] || 8000;
      if (onRetry) onRetry(attempt + 1, MAX_RETRIES, delayMs);
      await delay(delayMs);
    }
  }
  throw new Error(friendlyError(lastError.message, config.model));
}

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
  isComposite,
  onRetry,
) {
  return callApi(config, systemPrompt, userMessage, {
    temperature: 0.7,
    maxTokens: isComposite ? 8192 : 4096,
    timeout: 120,
    onRetry,
  });
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
    const latency = Date.now() - start;
    return {
      ok: false,
      message: friendlyError(err.message, config.model),
      latency,
    };
  }
}

/* ═══════════════════════════════════════════════════
   §7. Smart Route (Composer)
   ═══════════════════════════════════════════════════ */

async function smartRoute(config, userInput, onProgress) {
  const onRetry = (attempt, maxRetries, delayMs) => {
    if (onProgress)
      onProgress(
        "retrying",
        `服务器繁忙，正在第 ${attempt}/${maxRetries} 次重试（${delayMs / 1000}s 后）...`,
      );
  };

  // Step 1: Intent recognition
  if (onProgress) onProgress("routing", "正在识别意图...");
  const routerPrompt = buildRouterPrompt();
  const routerText = await callRouterApi(
    config,
    routerPrompt,
    userInput,
    onRetry,
  );
  const routerResult = parseRouterResult(routerText);

  const sceneNames = routerResult.scenes.map((s) => SCENE_NAMES[s] || s);
  if (onProgress) {
    const label = routerResult.composite
      ? `复合任务：${sceneNames.join(" + ")}`
      : `场景：${sceneNames[0]}`;
    onProgress("generating", `意图识别完成 → ${label}，正在生成 Prompt...`);
  }

  // Step 2: Generate professional prompt
  const { prompt: genPrompt } = buildGenerationPrompt(routerResult);
  const result = await callGenerationApi(
    config,
    genPrompt,
    userInput,
    routerResult.composite,
    onRetry,
  );

  return {
    result,
    scenes: routerResult.scenes,
    composite: routerResult.composite || false,
  };
}

/**
 * Direct scene generation (skip router, use specified scene)
 */
async function directGenerate(config, userInput, sceneId, onProgress) {
  const onRetry = (attempt, maxRetries, delayMs) => {
    if (onProgress)
      onProgress(
        "retrying",
        `服务器繁忙，正在第 ${attempt}/${maxRetries} 次重试（${delayMs / 1000}s 后）...`,
      );
  };

  if (onProgress)
    onProgress(
      "generating",
      `正在使用「${SCENE_NAMES[sceneId]}」场景生成 Prompt...`,
    );

  const routerResult = { scenes: [sceneId], composite: false };
  const { prompt: genPrompt } = buildGenerationPrompt(routerResult);
  const result = await callGenerationApi(
    config,
    genPrompt,
    userInput,
    false,
    onRetry,
  );

  return { result, scenes: [sceneId], composite: false };
}

/* ═══════════════════════════════════════════════════
   §8. UI Controller
   ═══════════════════════════════════════════════════ */

// State
let isGenerating = false;
let selectedScene = null; // null = auto (smartRoute), string = specific scene

// DOM references (populated on init)
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function initApp() {
  // Apply saved theme
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme)
    document.documentElement.setAttribute("data-theme", savedTheme);

  // Bind events
  bindHeaderEvents();
  bindInputEvents();
  bindSettingsEvents();
  bindSceneBrowserEvents();
  bindScenePickerEvents();
  bindOutputEvents();
  bindKeyboardShortcuts();

  // Render dynamic content
  renderSceneTags();
  renderSceneBrowser();
  renderScenePicker();

  // Populate settings fields from saved config
  populateSettings();
}

/* ─── Header ─── */

function bindHeaderEvents() {
  $("#btn-theme").addEventListener("click", toggleTheme);
  $("#btn-settings").addEventListener("click", () => openPanel("settings"));
  $("#btn-scenes-browser").addEventListener("click", () => openModal("scenes"));
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
}

/* ─── Input ─── */

function bindInputEvents() {
  const textarea = $("#input-textarea");
  const counter = $("#char-counter");

  textarea.addEventListener("input", () => {
    const len = textarea.value.length;
    counter.textContent = `${len.toLocaleString()} / 10,000`;
    counter.classList.toggle("is-warning", len > 8000 && len <= 9500);
    counter.classList.toggle("is-danger", len > 9500);
  });

  $("#btn-generate").addEventListener("click", handleGenerate);
}

async function handleGenerate() {
  if (isGenerating) return;

  const textarea = $("#input-textarea");
  const input = textarea.value.trim();
  if (!input) {
    showToast("请输入你的需求内容", "error");
    textarea.focus();
    return;
  }

  if (input.length > MAX_INPUT_LENGTH) {
    showToast(
      `输入文本过长（${input.length} 字符），最大 ${MAX_INPUT_LENGTH}`,
      "error",
    );
    return;
  }

  isGenerating = true;
  const btn = $("#btn-generate");
  btn.disabled = true;
  btn.classList.add("btn--generating");
  const btnText = btn.querySelector("span");
  const origText = btnText.textContent;
  btnText.textContent = "生成中...";

  showProgress("正在连接 AI 服务...");
  hideOutput();

  const config = getEffectiveConfig();

  try {
    let result;
    if (selectedScene) {
      result = await directGenerate(
        config,
        input,
        selectedScene,
        (stage, text) => {
          updateProgress(text);
        },
      );
    } else {
      result = await smartRoute(config, input, (stage, text) => {
        updateProgress(text);
      });
    }
    hideProgress();
    showOutput(result.result, result.scenes, result.composite);
  } catch (err) {
    hideProgress();
    showToast(err.message, "error");
  } finally {
    isGenerating = false;
    btn.disabled = false;
    btn.classList.remove("btn--generating");
    btnText.textContent = origText;
  }
}

/* ─── Progress ─── */

function showProgress(text) {
  const el = $("#progress");
  el.hidden = false;
  $("#progress-text").textContent = text;
}

function updateProgress(text) {
  $("#progress-text").textContent = text;
}

function hideProgress() {
  $("#progress").hidden = true;
}

/* ─── Output ─── */

function bindOutputEvents() {
  $("#btn-copy").addEventListener("click", handleCopy);
}

function showOutput(content, sceneIds, composite) {
  const section = $("#output-section");
  section.hidden = false;

  // Render scene badges
  const badgesEl = $("#output-badges");
  badgesEl.innerHTML = "";
  for (const id of sceneIds) {
    const badge = document.createElement("span");
    badge.className = "output-badge" + (composite ? " is-composite" : "");
    badge.textContent = SCENE_NAMES[id] || id;
    badgesEl.appendChild(badge);
  }

  // Render content
  $("#output-content").textContent = content;

  // Scroll to output
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hideOutput() {
  $("#output-section").hidden = true;
}

async function handleCopy() {
  const content = $("#output-content").textContent;
  if (!content) return;

  try {
    await navigator.clipboard.writeText(content);

    // Swap icons
    const copyIcon = $("#btn-copy .icon-copy");
    const checkIcon = $("#btn-copy .icon-check");
    const copyText = $("#copy-text");

    copyIcon.style.display = "none";
    checkIcon.style.display = "block";
    copyText.textContent = "已复制";

    setTimeout(() => {
      copyIcon.style.display = "";
      checkIcon.style.display = "none";
      copyText.textContent = "复制";
    }, 2000);
  } catch (e) {
    showToast("复制失败，请手动复制", "error");
  }
}

/* ─── Toast ─── */

let toastTimer = null;

function showToast(message, type = "error") {
  const toast = $("#toast");
  const text = $("#toast-text");

  clearTimeout(toastTimer);
  toast.hidden = false;
  toast.classList.remove("is-success");
  if (type === "success") toast.classList.add("is-success");

  text.textContent = message;

  // Force reflow for animation
  toast.classList.remove("is-visible");
  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  toastTimer = setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => {
      toast.hidden = true;
    }, 300);
  }, 5000);
}

/* ─── Settings Panel ─── */

function bindSettingsEvents() {
  $("#btn-settings-close").addEventListener("click", () =>
    closePanel("settings"),
  );
  $("#settings-overlay").addEventListener("click", () =>
    closePanel("settings"),
  );
  $("#btn-toggle-key").addEventListener("click", toggleKeyVisibility);
  $("#btn-test-api").addEventListener("click", handleTestApi);
  $("#btn-save-settings").addEventListener("click", handleSaveSettings);
}

function populateSettings() {
  const cfg = loadConfig();
  $("#setting-base-url").value = cfg.baseUrl || "";
  $("#setting-api-key").value = cfg.apiKey || "";
  $("#setting-model").value = cfg.model || "";
}

function toggleKeyVisibility() {
  const input = $("#setting-api-key");
  const eyeOpen = $("#btn-toggle-key .icon-eye");
  const eyeOff = $("#btn-toggle-key .icon-eye-off");
  if (input.type === "password") {
    input.type = "text";
    eyeOpen.style.display = "none";
    eyeOff.style.display = "block";
  } else {
    input.type = "password";
    eyeOpen.style.display = "block";
    eyeOff.style.display = "none";
  }
}

async function handleTestApi() {
  const btn = $("#btn-test-api");
  const resultEl = $("#test-result");
  const resultText = $("#test-result-text");

  btn.disabled = true;
  const origHTML = btn.innerHTML;
  btn.innerHTML = "<span>测试中...</span>";

  // Gather config (use form values or fallback to builtin)
  const builtin = _getBuiltinDefaults();
  const config = {
    baseUrl: ($("#setting-base-url").value || "").trim() || builtin.baseUrl,
    apiKey: ($("#setting-api-key").value || "").trim() || builtin.apiKey,
    model: ($("#setting-model").value || "").trim() || builtin.model,
  };

  const res = await testApiConfig(config);

  resultEl.hidden = false;
  resultEl.className = "panel__test-result " + (res.ok ? "is-ok" : "is-error");
  resultText.textContent = res.message;

  btn.disabled = false;
  btn.innerHTML = origHTML;
}

function handleSaveSettings() {
  const cfg = {
    baseUrl: ($("#setting-base-url").value || "").trim(),
    apiKey: ($("#setting-api-key").value || "").trim(),
    model: ($("#setting-model").value || "").trim(),
  };
  saveConfig(cfg);

  // Clear router prompt cache since config may affect behavior
  cachedRouterPrompt = null;

  showToast("配置已保存", "success");
  closePanel("settings");
}

/* ─── Panels & Modals ─── */

function openPanel(name) {
  const panel = $(`#${name}-panel`);
  const overlay = $(`#${name}-overlay`);
  panel.hidden = false;
  overlay.hidden = false;
  requestAnimationFrame(() => {
    panel.classList.add("is-visible");
    overlay.classList.add("is-visible");
  });
  document.body.style.overflow = "hidden";
}

function closePanel(name) {
  const panel = $(`#${name}-panel`);
  const overlay = $(`#${name}-overlay`);
  panel.classList.remove("is-visible");
  overlay.classList.remove("is-visible");
  setTimeout(() => {
    panel.hidden = true;
    overlay.hidden = true;
    document.body.style.overflow = "";
  }, 400);
}

function openModal(name) {
  const modal = $(`#${name}-modal`);
  const overlay = $(`#${name}-overlay`);
  modal.hidden = false;
  overlay.hidden = false;
  requestAnimationFrame(() => {
    modal.classList.add("is-visible");
    overlay.classList.add("is-visible");
  });
  document.body.style.overflow = "hidden";

  // Focus search
  const searchInput = modal.querySelector('input[type="text"]');
  if (searchInput) setTimeout(() => searchInput.focus(), 100);
}

function closeModal(name) {
  const modal = $(`#${name}-modal`);
  const overlay = $(`#${name}-overlay`);
  modal.classList.remove("is-visible");
  overlay.classList.remove("is-visible");
  setTimeout(() => {
    modal.hidden = true;
    overlay.hidden = true;
    document.body.style.overflow = "";
  }, 300);
}

/* ─── Scene Tags (hot scenes) ─── */

function renderSceneTags() {
  const container = $("#scene-tags");
  for (const id of HOT_SCENES) {
    if (!SCENES[id]) continue;
    const tag = document.createElement("button");
    tag.className = "scene-tag";
    tag.textContent = SCENES[id].name;
    tag.dataset.scene = id;
    tag.title = SCENES[id].description;
    tag.addEventListener("click", () => {
      // Toggle selection
      if (selectedScene === id) {
        selectedScene = null;
        $$(".scene-tag").forEach((t) => t.classList.remove("is-active"));
      } else {
        selectedScene = id;
        $$(".scene-tag").forEach((t) => t.classList.remove("is-active"));
        tag.classList.add("is-active");
      }
      updateSceneButton();
    });
    container.appendChild(tag);
  }
}

function updateSceneButton() {
  const btn = $("#btn-scene-select");
  const text = btn.querySelector("span");
  if (selectedScene) {
    text.textContent = SCENE_NAMES[selectedScene];
    btn.classList.add("is-active");
  } else {
    text.textContent = "指定场景";
    btn.classList.remove("is-active");
  }
}

/* ─── Scene Browser Modal ─── */

function bindSceneBrowserEvents() {
  $("#btn-scenes-close").addEventListener("click", () => closeModal("scenes"));
  $("#scenes-overlay").addEventListener("click", () => closeModal("scenes"));
  $("#scene-search").addEventListener("input", (e) =>
    filterSceneBrowser(e.target.value),
  );
}

function renderSceneBrowser() {
  const container = $("#scenes-list");
  container.innerHTML = "";

  for (const cat of SCENE_CATEGORIES) {
    const catEl = document.createElement("div");
    catEl.className = "scene-category";
    catEl.dataset.category = cat.id;

    catEl.innerHTML = `<div class="scene-category__title">${cat.name}</div>`;
    const grid = document.createElement("div");
    grid.className = "scene-category__grid";

    for (const sceneId of cat.scenes) {
      if (!SCENES[sceneId]) continue;
      const scene = SCENES[sceneId];
      const card = document.createElement("div");
      card.className = "scene-card";
      card.dataset.scene = sceneId;
      card.dataset.search =
        `${scene.name} ${scene.nameEn} ${scene.keywords.join(" ")} ${scene.description}`.toLowerCase();
      card.innerHTML = `
        <div class="scene-card__name">${scene.name}</div>
        <div class="scene-card__name-en">${scene.nameEn}</div>
        <div class="scene-card__desc">${scene.description}</div>
      `;
      card.addEventListener("click", () => {
        selectScene(sceneId);
        closeModal("scenes");
      });
      grid.appendChild(card);
    }

    catEl.appendChild(grid);
    container.appendChild(catEl);
  }
}

function filterSceneBrowser(query) {
  const q = query.toLowerCase().trim();
  $$("#scenes-list .scene-card").forEach((card) => {
    const match = !q || card.dataset.search.includes(q);
    card.style.display = match ? "" : "none";
  });
  // Hide empty categories
  $$("#scenes-list .scene-category").forEach((cat) => {
    const visibleCards = cat.querySelectorAll(
      '.scene-card:not([style*="display: none"])',
    );
    cat.style.display = visibleCards.length > 0 ? "" : "none";
  });
}

/* ─── Scene Picker Dropdown ─── */

function bindScenePickerEvents() {
  const btn = $("#btn-scene-select");
  const picker = $("#scene-picker");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (picker.hidden) {
      openPicker();
    } else {
      closePicker();
    }
  });

  document.addEventListener("click", (e) => {
    if (
      !picker.contains(e.target) &&
      !$("#btn-scene-select").contains(e.target)
    ) {
      closePicker();
    }
  });

  $("#picker-search").addEventListener("input", (e) =>
    filterPicker(e.target.value),
  );
}

function openPicker() {
  const picker = $("#scene-picker");
  const btn = $("#btn-scene-select");
  const rect = btn.getBoundingClientRect();

  // Use fixed positioning to avoid scroll offset issues
  picker.style.position = "fixed";
  picker.style.top = `${rect.bottom + 8}px`;
  picker.style.right = `${window.innerWidth - rect.right}px`;
  picker.style.left = "auto";

  picker.hidden = false;
  requestAnimationFrame(() => picker.classList.add("is-visible"));
  setTimeout(() => $("#picker-search").focus(), 50);
}

function closePicker() {
  const picker = $("#scene-picker");
  picker.classList.remove("is-visible");
  setTimeout(() => {
    picker.hidden = true;
    $("#picker-search").value = "";
    filterPicker("");
  }, 200);
}

function renderScenePicker() {
  const list = $("#picker-list");
  list.innerHTML = "";

  // Add "Auto detect" option
  const autoItem = document.createElement("div");
  autoItem.className = "dropdown__item";
  autoItem.innerHTML = `
    <span class="dropdown__item-name">智能识别（自动）</span>
    <span class="dropdown__item-desc">AI 自动分析意图并选择最佳场景</span>
  `;
  autoItem.addEventListener("click", () => {
    selectScene(null);
    closePicker();
  });
  list.appendChild(autoItem);

  // Add all scenes grouped
  for (const cat of SCENE_CATEGORIES) {
    for (const sceneId of cat.scenes) {
      if (!SCENES[sceneId]) continue;
      const scene = SCENES[sceneId];
      const item = document.createElement("div");
      item.className = "dropdown__item";
      item.dataset.scene = sceneId;
      item.dataset.search =
        `${scene.name} ${scene.nameEn} ${scene.keywords.join(" ")}`.toLowerCase();
      item.innerHTML = `
        <span class="dropdown__item-name">${scene.name}</span>
        <span class="dropdown__item-desc">${scene.description}</span>
      `;
      item.addEventListener("click", () => {
        selectScene(sceneId);
        closePicker();
      });
      list.appendChild(item);
    }
  }
}

function filterPicker(query) {
  const q = query.toLowerCase().trim();
  $$("#picker-list .dropdown__item").forEach((item) => {
    if (!item.dataset.scene) {
      item.style.display = "";
      return;
    } // Keep auto item
    const match = !q || (item.dataset.search || "").includes(q);
    item.style.display = match ? "" : "none";
  });
}

function selectScene(sceneId) {
  selectedScene = sceneId;
  // Update active states
  $$(".scene-tag").forEach((t) => {
    t.classList.toggle("is-active", t.dataset.scene === sceneId);
  });
  updateSceneButton();
}

/* ─── Keyboard Shortcuts ─── */

function bindKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Ctrl+Enter / Cmd+Enter = Generate
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleGenerate();
      return;
    }
    // Escape = close modals/panels
    if (e.key === "Escape") {
      closePicker();
      if (!$("#settings-panel").hidden) closePanel("settings");
      if (!$("#scenes-modal").hidden) closeModal("scenes");
    }
  });
}

/* ═══════════════════════════════════════════════════
   §9. Initialization
   ═══════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", async () => {
  const loaded = await loadScenes();
  if (!loaded) {
    showToast("场景数据加载失败，请刷新页面重试", "error");
    return;
  }
  initApp();
});
