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
  {
    id: "writing",
    name: "内容创作",
    scenes: [
      "topic-gen",
      "outline",
      "copy-polish",
      "style-rewrite",
      "word-adjust",
      "headline",
      "fact-check",
      "research",
      "platform-adapt",
      "compliance",
      "seo-write",
      "social-post",
    ],
  },
  {
    id: "product",
    name: "产品管理",
    scenes: [
      "prd",
      "user-story",
      "competitor",
      "data-analysis",
      "meeting-notes",
      "acceptance",
    ],
  },
  {
    id: "marketing",
    name: "市场运营",
    scenes: [
      "ad-copy",
      "brand-story",
      "email-marketing",
      "event-plan",
      "growth-hack",
    ],
  },
  {
    id: "design",
    name: "设计体验",
    scenes: ["design-brief", "ux-review", "design-spec", "copy-ux"],
  },
  {
    id: "data",
    name: "数据分析",
    scenes: ["data-report", "ab-test", "metric-define", "data-viz"],
  },
  {
    id: "hr",
    name: "HR 人事",
    scenes: [
      "jd-write",
      "interview-guide",
      "performance-review",
      "onboarding-plan",
    ],
  },
  {
    id: "service",
    name: "客户服务",
    scenes: ["faq-write", "response-template", "feedback-analysis"],
  },
  {
    id: "startup",
    name: "创业管理",
    scenes: ["business-plan", "pitch-deck", "okr", "swot", "risk-assess"],
  },
  {
    id: "education",
    name: "学习教育",
    scenes: ["study-plan", "summary", "essay", "quiz-gen"],
  },
  { id: "general", name: "综合工具", scenes: ["translate", "mock", "algo"] },
];

// 热门场景（首页快捷标签）
const HOT_SCENES = [
  "optimize",
  "refactor",
  "debug",
  "review",
  "copy-polish",
  "topic-gen",
  "platform-adapt",
  "headline",
];

// 10 个使用画像 → 对应场景分类
const PERSONAS = [
  { id: "all", name: "全部", categories: null },
  {
    id: "engineer",
    name: "软件工程师",
    categories: [
      "requirement",
      "development",
      "quality",
      "docs",
      "ops",
      "general",
    ],
  },
  { id: "creator", name: "内容创作者", categories: ["writing"] },
  { id: "pm", name: "产品经理", categories: ["product"] },
  { id: "marketer", name: "市场运营", categories: ["marketing"] },
  { id: "designer", name: "设计师", categories: ["design"] },
  { id: "analyst", name: "数据分析师", categories: ["data"] },
  { id: "hr", name: "HR 人事", categories: ["hr"] },
  { id: "service", name: "客户服务", categories: ["service"] },
  { id: "founder", name: "创业者", categories: ["startup"] },
  { id: "student", name: "学生/教育", categories: ["education"] },
];

/* ═══════════════════════════════════════════════════
   §2. Built-in Default Config (AES-256-CBC Encrypted)
   ═══════════════════════════════════════════════════ */

// Key fragments (same as core/defaults.js)
const _k = [
  "\x45\x50",
  "\x2d\x53",
  "\x65\x63",
  "\x72\x65",
  "\x74\x2d",
  "\x4b\x33",
  "\x79\x21",
  "\x40\x32",
  "\x30\x32",
  "\x36\x23",
  "\x46\x6c",
  "\x69\x70",
  "\x70\x79",
  "\x53\x75",
  "\x6e\x58",
  "\x39",
];
const _seq = [0, 10, 4, 2, 14, 8, 6, 12, 1, 11, 5, 3, 15, 9, 7, 13];
const _order = [0, 8, 1, 9, 2, 10, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];

function _dk() {
  return _order.map((i) => _k[_seq[i]]).join("");
}

// Pre-encrypted vault (AES-256-CBC, base64 iv:ciphertext)
const _vault = {
  _a: "nsyr2IS/y/d+/SjcQWWnMw==:QH+2F+3pvndj0tDx173pncFD8sjIXx7UVwJeFtOyTL4=",
  _b: "dsTXcwfRJa0zhYDUl6QHFA==:hxcqQTO75KRuSwC/9FoijhfiK/aA1fmjdhdQUNaJJwMmE9RJew0tbaNpLxef62nIoBZ/OLAfPJfK6V09oSAF7Q==",
  _c: "hStx3/BP4Pnf59dLvPg8VA==:kHqUSzkgftdvUmtb3K0eM6KC26J9s6gy7QvhcZi0x5c=",
};

let _builtinCache = null;

async function _decAES(ct) {
  const [ivB64, encB64] = ct.split(":");
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const enc = Uint8Array.from(atob(encB64), (c) => c.charCodeAt(0));
  const rawKey = new TextEncoder().encode(_dk());
  const hash = await crypto.subtle.digest("SHA-256", rawKey);
  const key = await crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-CBC" },
    false,
    ["decrypt"],
  );
  const dec = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, enc);
  return new TextDecoder().decode(dec);
}

async function _getBuiltinDefaults() {
  if (_builtinCache) return _builtinCache;
  const [baseUrl, apiKey, model] = await Promise.all([
    _decAES(_vault._a),
    _decAES(_vault._b),
    _decAES(_vault._c),
  ]);
  _builtinCache = { baseUrl, apiKey, model };
  return _builtinCache;
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

async function getEffectiveConfig() {
  const user = loadConfig();
  const builtin = await _getBuiltinDefaults();
  return {
    baseUrl: (user.baseUrl || "").trim() || builtin.baseUrl,
    apiKey: (user.apiKey || "").trim() || builtin.apiKey,
    model: (user.model || "").trim() || builtin.model,
  };
}

/* ═══════════════════════════════════════════════════
   §3b. History Management (localStorage)
   ═══════════════════════════════════════════════════ */

const HISTORY_KEY = "easy-prompt-history";
const MAX_HISTORY = 100;

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    /* ignore */
  }
  return [];
}

function saveHistoryRecord(
  originalText,
  enhancedText,
  mode,
  sceneIds,
  sceneName,
) {
  const history = loadHistory();
  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: Date.now(),
    mode, // 'smart' | 'scene'
    sceneIds: sceneIds || [],
    sceneName: sceneName || "",
    originalText,
    enhancedText,
  };
  history.unshift(record);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    /* ignore */
  }
  return record;
}

function deleteHistoryRecord(id) {
  const history = loadHistory().filter((r) => r.id !== id);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    /* ignore */
  }
}

function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (e) {
    /* ignore */
  }
}

function formatHistoryTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return `今天 ${time}`;
  if (diffDays === 1) return `昨天 ${time}`;
  if (diffDays < 7) return `${diffDays} 天前 ${time}`;

  const month = d.getMonth() + 1;
  const day = d.getDate();
  if (d.getFullYear() === now.getFullYear())
    return `${month}月${day}日 ${time}`;
  return `${d.getFullYear()}/${month}/${day} ${time}`;
}

function renderHistoryPanel() {
  const list = $("#history-list");
  const countEl = $("#history-count");
  const history = loadHistory();

  countEl.textContent = history.length > 0 ? `${history.length} 条` : "";

  if (history.length === 0) {
    list.innerHTML = `
      <div class="history-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
          <path d="M12 7v5l4 2"/>
        </svg>
        <span class="history-empty__title">暂无增强记录</span>
        <span class="history-empty__desc">使用 Prompt 增强后，历史记录会自动保存在这里</span>
      </div>
    `;
    return;
  }

  list.innerHTML = history
    .map(
      (r) => `
    <div class="history-card" data-id="${r.id}">
      <div class="history-card__header" onclick="this.parentElement.classList.toggle('is-expanded')">
        <div class="history-card__meta">
          <div class="history-card__top-row">
            <span class="history-card__time">${formatHistoryTime(r.timestamp)}</span>
            <span class="history-card__badge history-card__badge--${r.mode}">
              ${r.mode === "smart" ? "智能路由" : r.sceneName || r.sceneIds[0] || "场景"}
            </span>
          </div>
          <div class="history-card__preview">${escapeHtml(r.originalText.slice(0, 80))}${r.originalText.length > 80 ? "..." : ""}</div>
        </div>
        <svg class="history-card__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </div>
      <div class="history-card__body">
        <div class="history-diff">
          <div class="history-diff__section">
            <div class="history-diff__label history-diff__label--before">
              <span>原始文本</span>
              <button class="history-diff__copy" data-copy="original" data-id="${r.id}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                复制
              </button>
            </div>
            <div class="history-diff__text">${escapeHtml(r.originalText)}</div>
          </div>
          <div class="history-diff__section">
            <div class="history-diff__label history-diff__label--after">
              <span>增强结果</span>
              <button class="history-diff__copy" data-copy="enhanced" data-id="${r.id}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                复制
              </button>
            </div>
            <div class="history-diff__text">${escapeHtml(r.enhancedText)}</div>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:8px;">
          <button class="history-card__delete" data-delete="${r.id}" title="删除此记录">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    </div>
  `,
    )
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function bindHistoryEvents() {
  // Open history panel
  $("#btn-history").addEventListener("click", () => {
    renderHistoryPanel();
    openPanel("history");
  });

  // Close history panel
  $("#btn-history-close").addEventListener("click", () =>
    closePanel("history"),
  );
  $("#history-overlay").addEventListener("click", () => closePanel("history"));

  // Clear all history
  $("#btn-clear-history").addEventListener("click", () => {
    if (!confirm("确定要清空所有增强历史记录吗？此操作不可撤销。")) return;
    clearHistory();
    renderHistoryPanel();
    showToast("历史记录已清空", "success");
  });

  // Delegated events for copy & delete inside history list
  $("#history-list").addEventListener("click", (e) => {
    const copyBtn = e.target.closest(".history-diff__copy");
    if (copyBtn) {
      e.stopPropagation();
      const id = copyBtn.dataset.id;
      const type = copyBtn.dataset.copy;
      const record = loadHistory().find((r) => r.id === id);
      if (!record) return;
      const text =
        type === "original" ? record.originalText : record.enhancedText;
      navigator.clipboard.writeText(text).then(() => {
        showToast("已复制到剪贴板", "success");
      });
      return;
    }

    const delBtn = e.target.closest(".history-card__delete");
    if (delBtn) {
      e.stopPropagation();
      const id = delBtn.dataset.delete;
      deleteHistoryRecord(id);
      const card = delBtn.closest(".history-card");
      if (card) card.remove();
      renderHistoryPanel(); // refresh count
      return;
    }
  });
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

  // 外部取消信号联动内部 controller
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
        if (errBody.error) {
          errorMsg = errBody.error.message || JSON.stringify(errBody.error);
        }
      } catch (e) {
        // couldn't parse error body
      }
      throw new Error(errorMsg);
    }

    // 安全限制：响应体最大 2MB
    const MAX_RESPONSE_SIZE = 2 * 1024 * 1024;
    const text = await resp.text();
    if (text.length > MAX_RESPONSE_SIZE) {
      throw new Error("响应体过大（超过 2MB），已中断");
    }
    const data = JSON.parse(text);
    if (data.error) {
      throw new Error(data.error.message || JSON.stringify(data.error));
    }

    const content = data.choices?.[0]?.message?.content;
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

async function callRouterApi(
  config,
  systemPrompt,
  userMessage,
  onRetry,
  signal,
) {
  return callApi(config, systemPrompt, userMessage, {
    temperature: 0.1,
    maxTokens: 500,
    timeout: 30,
    onRetry,
    signal,
  });
}

async function callGenerationApi(
  config,
  systemPrompt,
  userMessage,
  isComposite,
  onRetry,
  signal,
) {
  return callApi(config, systemPrompt, userMessage, {
    temperature: 0.7,
    maxTokens: isComposite ? 8192 : 4096,
    timeout: 120,
    onRetry,
    signal,
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

async function smartRoute(config, userInput, onProgress, signal) {
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
    signal,
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
    signal,
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
async function directGenerate(config, userInput, sceneId, onProgress, signal) {
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
    signal,
  );

  return { result, scenes: [sceneId], composite: false };
}

/* ═══════════════════════════════════════════════════
   §8. UI Controller
   ═══════════════════════════════════════════════════ */

// State
let isGenerating = false;
let currentAbortController = null; // 用于取消正在进行的生成
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
  bindHistoryEvents();
  bindKeyboardShortcuts();

  // Render dynamic content
  renderSceneTags();
  renderPersonaTabs();
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
  // 生成中点击 → 取消
  if (isGenerating) {
    if (currentAbortController) currentAbortController.abort();
    return;
  }

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
  currentAbortController = new AbortController();
  const { signal } = currentAbortController;

  const btn = $("#btn-generate");
  btn.disabled = false;
  btn.classList.add("btn--generating");
  const btnText = btn.querySelector("span");
  const origText = btnText.textContent;
  btnText.textContent = "取消生成";

  showProgress("正在连接 AI 服务...");
  hideOutput();

  const config = await getEffectiveConfig();

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
        signal,
      );
    } else {
      result = await smartRoute(
        config,
        input,
        (stage, text) => {
          updateProgress(text);
        },
        signal,
      );
    }
    hideProgress();
    showOutput(result.result, result.scenes, result.composite);
    // Save to history
    const mode = selectedScene ? "scene" : "smart";
    const sceneName = result.scenes
      .map((id) => SCENE_NAMES[id] || id)
      .join(" + ");
    saveHistoryRecord(input, result.result, mode, result.scenes, sceneName);
  } catch (err) {
    hideProgress();
    if (err.message !== "已取消") {
      showToast(err.message, "error");
    }
  } finally {
    currentAbortController = null;
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
  const builtin = await _getBuiltinDefaults();
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

let activePersona = "all";

function renderPersonaTabs() {
  const container = $("#persona-tabs");
  container.innerHTML = "";

  // Lucide SVG icons for each persona (16x16, stroke)
  const personaIcons = {
    all: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/></svg>',
    engineer:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    creator:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/></svg>',
    pm: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 12h4"/><path d="M10 16h4"/></svg>',
    marketer:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg>',
    designer:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="6.5" cy="13.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
    analyst:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
    hr: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    service:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"/></svg>',
    founder:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
    student:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 6 3 6 3s3 0 6-3v-5"/></svg>',
  };

  for (const persona of PERSONAS) {
    const tab = document.createElement("button");
    tab.className =
      "persona-tab" + (persona.id === activePersona ? " is-active" : "");
    tab.dataset.persona = persona.id;
    tab.innerHTML = `${personaIcons[persona.id] || ""}${persona.name}`;
    tab.addEventListener("click", () => {
      activePersona = persona.id;
      $$(".persona-tab").forEach((t) =>
        t.classList.toggle("is-active", t.dataset.persona === persona.id),
      );
      filterByPersona(persona.id);
    });
    container.appendChild(tab);
  }
}

function filterByPersona(personaId) {
  const persona = PERSONAS.find((p) => p.id === personaId);
  const categories = persona && persona.categories;

  $$("#scenes-list .scene-category").forEach((catEl) => {
    if (!categories) {
      catEl.style.display = "";
    } else {
      catEl.style.display = categories.includes(catEl.dataset.category)
        ? ""
        : "none";
    }
  });
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
      if (!$("#history-panel").hidden) closePanel("history");
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
