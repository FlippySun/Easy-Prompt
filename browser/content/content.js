import {
  assertSkillProxySuccess,
  loadSkillProxyPayload,
} from "../../core/skill-fetch-client.mjs";
import { Sso } from "../shared/sso.js";
import { BACKEND_API_BASE } from "../shared/env.js";

/**
 * Easy Prompt Browser Extension — Content Script
 * On AI chat sites: persistent trigger icon + preview panel + undo + keyboard shortcut.
 */

(function () {
  "use strict";

  /* ═══════════════════════════════════════════════════════
   * Shared Utilities
   * ═══════════════════════════════════════════════════════ */

  /* ─── SVG Icons ─── */
  const ICON_SPARKLES = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/></svg>`;
  const ICON_SPARKLES_SM = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/></svg>`;
  const ICON_WAND = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>`;
  const ICON_LOADER = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ep-spin"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>`;
  const ICON_CHECK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
  const ICON_X = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
  const ICON_COPY = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
  const ICON_REPLACE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z"/><path d="M2 14a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/><path d="m7 21 3.37-3.37M21 7l-3.37 3.37"/><path d="M10 14 7.5 11.5"/><path d="M14 10l-2.5-2.5"/></svg>`;
  const ICON_UNDO = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 0 1 15-6.7L21 9"/></svg>`;
  const ICON_ARROW_DOWN = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>`;

  const _svgDataUrlCache = new Map();

  // 2026-04-13 修复：content.js 内建 ICON_* 常量和部分共享 SVG 可能缺少 xmlns，
  //   直接转成 data URL 后会导致 mask 图标在 Gemini 等站点不可见。
  //   统一在这里补齐命名空间，确保 trigger / preview / undo / nudge 图标一致渲染。
  // [参数与返回值] 输入原始 SVG 字符串，返回规范化后的 SVG 字符串。
  // [影响范围] browser/content/content.js 所有 parser-free 图标渲染路径。
  // [潜在风险] 无已知风险。
  function _normalizeSvgSource(svgText) {
    const raw = String(svgText || "").trim();
    if (!raw) return "";
    if (/^<svg\b/i.test(raw) && !/\bxmlns=/.test(raw)) {
      return raw.replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    return raw;
  }

  function _svgToDataUrl(svgText) {
    if (!svgText) return "";
    const normalizedSvg = _normalizeSvgSource(svgText);
    if (_svgDataUrlCache.has(normalizedSvg)) {
      return _svgDataUrlCache.get(normalizedSvg);
    }
    const dataUrl = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      normalizedSvg,
    )}")`;
    _svgDataUrlCache.set(normalizedSvg, dataUrl);
    return dataUrl;
  }

  // 2026-04-13 修复：Gemini 等 Trusted Types 页面会拦截 innerHTML，
  //   所有落到页面文档的扩展 UI 统一改为 DOM API 构建。
  // [参数与返回值] 根据输入返回已配置好的 DOM 节点/按钮；无副作用外部返回值。
  // [影响范围] browser/content/content.js 预览面板、撤销条、提示气泡、图标按钮。
  // [潜在风险] 无已知风险。
  function _createDomNode(tag, { className, id, title, text } = {}) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (id) el.id = id;
    if (title) el.title = title;
    if (typeof text === "string") el.textContent = text;
    if (tag === "button") el.type = "button";
    return el;
  }

  function _createMaskIconNode(svgText, { size = 14, className = "" } = {}) {
    const dataUrl = _svgToDataUrl(svgText);
    if (!dataUrl) return null;
    const icon = _createDomNode("span", {
      className: className ? `ep-mask-icon ${className}` : "ep-mask-icon",
    });
    icon.style.display = "inline-block";
    icon.style.width = `${size}px`;
    icon.style.height = `${size}px`;
    icon.style.minWidth = `${size}px`;
    icon.style.flexShrink = "0";
    icon.style.backgroundColor = "currentColor";
    icon.style.webkitMaskImage = dataUrl;
    icon.style.maskImage = dataUrl;
    icon.style.webkitMaskRepeat = "no-repeat";
    icon.style.maskRepeat = "no-repeat";
    icon.style.webkitMaskSize = "contain";
    icon.style.maskSize = "contain";
    icon.style.webkitMaskPosition = "center";
    icon.style.maskPosition = "center";
    return icon;
  }

  function _appendSvgNodes(container, svgText, options = {}) {
    const iconNode = _createMaskIconNode(svgText, options);
    if (iconNode) {
      container.appendChild(iconNode);
    }
  }

  function _setIconNode(container, svgText, options = {}) {
    const iconNode = _createMaskIconNode(svgText, options);
    container.replaceChildren(...(iconNode ? [iconNode] : []));
  }

  function _setButtonIconLabel(button, iconSvg, label, options = {}) {
    const labelNode = _createDomNode("span", { text: label || "" });
    const iconNode = _createMaskIconNode(iconSvg, options);
    button.replaceChildren(...(iconNode ? [iconNode, labelNode] : [labelNode]));
  }

  function _createIconButton({
    className,
    id,
    title,
    iconSvg,
    label,
    iconSize = 14,
    iconClassName = "",
  }) {
    const button = _createDomNode("button", { className, id, title });
    if (typeof label === "string") {
      _setButtonIconLabel(button, iconSvg, label, {
        size: iconSize,
        className: iconClassName,
      });
    } else {
      _setIconNode(button, iconSvg, {
        size: iconSize,
        className: iconClassName,
      });
    }
    return button;
  }

  const isMac = navigator.platform?.toUpperCase().includes("MAC");
  const SHORTCUT_LABEL = isMac ? "⌘⇧E" : "Ctrl+Shift+E";

  /* ═══════════════════════════════════════════════════════
   * AI Chat Site Inline Enhance
   *   - Persistent trigger icon (non-intrusive)
   *   - Preview panel (original vs enhanced)
   *   - Undo mechanism
   *   - Keyboard shortcut (⌘⇧E / Ctrl+Shift+E)
   * ═══════════════════════════════════════════════════════ */

  /* ─── AI Site Configs ─── */
  const AI_SITE_CONFIGS = [
    // ProseMirror
    {
      name: "ChatGPT",
      urlPattern: /chat(gpt)?\.openai\.com|chatgpt\.com/,
      selectors: ["#prompt-textarea"],
      type: "prosemirror",
    },
    {
      name: "Claude",
      urlPattern: /claude\.ai/,
      selectors: ['.ProseMirror[contenteditable="true"]'],
      type: "prosemirror",
    },
    {
      name: "Grok",
      urlPattern: /grok\.com|x\.com\/i\/grok/,
      selectors: ['div.ProseMirror[contenteditable="true"]'],
      type: "prosemirror",
    },
    {
      name: "天工",
      urlPattern: /tiangong\.cn/,
      selectors: ['div.tiptap.ProseMirror[contenteditable="true"]'],
      type: "prosemirror",
    },
    // Quill
    {
      name: "Gemini",
      urlPattern: /gemini\.google\.com/,
      selectors: ['.ql-editor[contenteditable="true"]'],
      type: "quill",
    },
    {
      name: "腾讯元宝",
      urlPattern: /yuanbao\.tencent\.com/,
      selectors: ['.ql-editor[contenteditable="true"]'],
      type: "quill",
    },
    // Slate.js
    {
      name: "通义千问",
      urlPattern: /qianwen\.com|tongyi\.aliyun\.com/,
      selectors: ['[data-slate-node="value"][role="textbox"]'],
      type: "slate",
    },
    {
      name: "文心一言",
      urlPattern: /yiyan\.baidu\.com/,
      selectors: ['[data-slate-node="value"][role="textbox"]'],
      type: "slate",
    },
    // CodeMirror
    {
      name: "扣子/Coze",
      urlPattern: /coze\.(cn|com)/,
      selectors: ['.cm-content[contenteditable="true"]'],
      type: "codemirror",
    },
    // Custom contenteditable / Lexical
    {
      name: "Kimi",
      urlPattern: /kimi\.moonshot\.cn|kimi\.com/,
      selectors: [
        '.chat-input-editor[contenteditable="true"]',
        '[data-lexical-editor="true"]',
      ],
      type: "contenteditable",
    },
    {
      name: "Perplexity",
      urlPattern: /perplexity\.ai/,
      selectors: [
        '#ask-input[contenteditable="true"]',
        '[data-lexical-editor="true"]',
      ],
      type: "contenteditable",
    },
    // textarea
    {
      name: "DeepSeek",
      urlPattern: /chat\.deepseek\.com/,
      selectors: ["textarea#chat-input", "textarea"],
      type: "textarea",
    },
    {
      name: "豆包",
      urlPattern: /doubao\.com/,
      selectors: ["textarea.semi-input-textarea"],
      type: "textarea",
    },
    {
      name: "智谱清言",
      urlPattern: /chatglm\.cn/,
      selectors: [".input-box-inner textarea", "textarea.scroll-display-none"],
      type: "textarea",
    },
    {
      name: "讯飞星火",
      urlPattern: /xinghuo\.xfyun\.cn/,
      selectors: ["textarea#login-askwindow-textarea"],
      type: "textarea",
    },
    {
      name: "Mistral",
      urlPattern: /chat\.mistral\.ai/,
      selectors: ['textarea[placeholder="Ask Le Chat"]', "textarea"],
      type: "textarea",
    },
    {
      name: "HuggingChat",
      urlPattern: /huggingface\.co\/chat/,
      selectors: ['textarea[placeholder="Ask anything"]', "textarea"],
      type: "textarea",
    },
    {
      name: "百小应",
      urlPattern: /ying\.baichuan-ai\.com/,
      selectors: ["textarea"],
      type: "textarea",
    },
    {
      name: "OpenRouter",
      urlPattern: /openrouter\.ai\/chat/,
      selectors: ["textarea"],
      type: "textarea",
    },
    {
      name: "LM Arena",
      urlPattern: /arena\.ai|lmarena\.ai/,
      selectors: ["textarea"],
      type: "textarea",
    },
    {
      name: "Vercel AI",
      urlPattern: /ai-sdk\.dev\/playground|sdk\.vercel\.ai/,
      selectors: ["textarea"],
      type: "textarea",
    },
    // input
    {
      name: "Meta AI",
      urlPattern: /meta\.ai/,
      selectors: ['input[type="text"]'],
      type: "input",
    },
  ];

  /* ─── Detect Current Site ─── */
  function detectAISite() {
    const url = window.location.href;
    for (const cfg of AI_SITE_CONFIGS) {
      if (cfg.urlPattern.test(url)) return cfg;
    }
    return null;
  }

  const currentSite = detectAISite();
  if (!currentSite) return; // Not an AI chat site — skip Part 2

  /* ─── State ─── */
  let triggerIcon = null; // Persistent ✨ icon near input
  let previewPanel = null; // Preview panel (original vs enhanced)
  let undoBar = null; // Undo toast
  let nudgeBubble = null; // Smart nudge bubble
  let trackedInput = null;
  let isEnhancing = false;
  let observer = null;
  let undoTimer = null;
  let nudgeTimer = null; // Debounce timer for nudge
  let inputResizeObserver = null;
  let savedOriginalText = ""; // For undo
  let repositionRaf = null;
  let nudgeShownThisSession = false; // Only show once per page load
  let hasUsedEnhance = false; // Track if user has used enhance this session

  // --- 2026-04-13 Skill 浮窗状态 ---
  // 依赖通过异步动态 import() 加载，避免阻塞主 IIFE（若加载失败仅影响 skill 浮窗）
  let _skillPanel = null; // <ep-skill-panel> 元素
  let _skillPanelVisible = false;
  let _skillSlashIndex = -1; // 2026-04-13 修复：记录触发 "/" 在文本中的位置（光标感知）
  let _skillDepsLoaded = false;
  let _skillFilterDebounceTimer = null;
  let _SKILLS = [];
  let _SKILL_TYPE_MAP = { 1: "通用", 2: "写作", 3: "制图", 4: "编程" };
  let _SKILL_ICON_MAP = {};
  let _FOLDER_ICON_SVG = "";
  const SKILL_FILTER_DEBOUNCE_MS = 160;
  let _skillPanelResizeObserver = null;
  const SKILL_PROXY_URL = `${BACKEND_API_BASE}/api/v1/auth/oauth/zhiz/skills`;
  const SKILL_FETCH_TIMEOUT_MS = 15000;
  const SSO_ACCESS_TOKEN_KEY = "ep-sso-access-token";
  const SSO_USER_KEY = "ep-sso-user";
  let _skillDataLoadPromise = null;
  let _skillDataSource = "mock";

  /**
   * 2026-04-16 新增 — Browser Skill Proxy 拉取超时信号
   * 变更类型：新增/兼容
   * 功能描述：为浏览器内容脚本的 skill 数据请求提供超时保护，避免上游或后端异常时预加载链路长时间悬挂。
   * 设计思路：优先使用 AbortSignal.timeout；运行时不支持时退化为无超时但保持功能可用。
   * 参数与返回值：_getSkillRequestSignal() 无参数；返回 AbortSignal 或 undefined。
   * 影响范围：browser/content/content.js skill 真实数据拉取。
   * 潜在风险：无已知风险。
   */
  function _getSkillRequestSignal() {
    if (
      typeof AbortSignal !== "undefined" &&
      typeof AbortSignal.timeout === "function"
    ) {
      return AbortSignal.timeout(SKILL_FETCH_TIMEOUT_MS);
    }
    return undefined;
  }

  /**
   * 2026-04-16 新增 — Browser 端读取已存储 SSO token
   * 变更类型：新增/安全
   * 功能描述：从 chrome.storage.local 读取浏览器扩展 SSO access token，供 skill proxy 请求在已登录时透传 Bearer token。
   * 设计思路：直接复用既有 ep-sso-* 存储 schema，不在 content script 内复制完整 SSO 模块。
   * 参数与返回值：_getStoredSkillSsoToken() 返回 Promise<string|null>。
   * 影响范围：browser/content/content.js skill 数据请求鉴权。
   * 潜在风险：无已知风险。
   */
  async function _getStoredSkillSsoToken() {
    try {
      const stored = await chrome.storage.local.get(SSO_ACCESS_TOKEN_KEY);
      return stored[SSO_ACCESS_TOKEN_KEY] || null;
    } catch {
      return null;
    }
  }

  /**
   * 2026-04-16 修复 — Browser Skill 鉴权重试失败日志收口
   * 变更类型：修复/兼容/安全
   * 功能描述：在浏览器内容脚本的 skill proxy access token 刷新失败时输出最小必要日志，帮助定位为何从已登录态退化到匿名 skill。
   * 设计思路：
   *   1. 只记录 refresh 失败这一阶段性事实，不打印 token、用户信息或 storage 明细。
   *   2. 让 401 刷新重试逻辑复用共享 helper；content script 只负责记录诊断与 fallback 到当前 skill 数据。
   * 参数与返回值：_logSkillAuthRetryFailure(error) 无返回值。
   * 影响范围：browser/content/content.js 的 401 -> refresh -> retry -> anonymous fallback 观测。
   * 潜在风险：无已知风险。
   */
  function _logSkillAuthRetryFailure(error) {
    console.warn(
      "[Easy Prompt] Skill proxy token refresh failed, fallback to anonymous skills:",
      error,
    );
  }

  /**
   * 2026-04-16 新增 — Browser Slash 首开是否需要补拉真实 Skill
   * 变更类型：新增/兼容/优化
   * 功能描述：为内容脚本提供一个最小判断，决定 `/` 首次打开 skill 面板时是否应补拉一次真实 skill 数据。
   * 设计思路：
   *   1. 当前缓存仍是 mock/fallback 时，slash 首开作为恢复性 force refresh 触发点。
   *   2. 最近一次成功拿到真实数据后，不在每次输入 `/` 时重复强刷，避免内容脚本高频请求。
   * 参数与返回值：_shouldRefreshSkillsOnPanelOpen() 无参数；返回 boolean。
   * 影响范围：browser/content/content.js 的 slash 首开条件重拉逻辑。
   * 潜在风险：无已知风险。
   */
  function _shouldRefreshSkillsOnPanelOpen() {
    return _skillDataSource !== "remote";
  }

  /**
   * 2026-04-16 新增 — Browser Skill 面板数据同步到自定义元素
   * 变更类型：新增/兼容
   * 功能描述：当 skill 数据更新时，仅同步 `skills` attribute 到已创建的 `<ep-skill-panel>`，不重建节点。
   * 设计思路：保持 shared-ui/skill-panel.js 的稳定 Shadow DOM shell 与隐藏态逻辑不变，只做最小数据更新。
   * 参数与返回值：_syncSkillPanelSkills() 无参数；无返回值。
   * 影响范围：browser/content/content.js 与 shared-ui/skill-panel.js 的数据桥接。
   * 潜在风险：skills JSON 变大时 attribute 会随之增长，但当前数据规模可控。
   */
  function _syncSkillPanelSkills() {
    if (!_skillPanel) return;
    const serializedSkills = JSON.stringify(
      Array.isArray(_SKILLS) ? _SKILLS : [],
    );
    if (_skillPanel.getAttribute("skills") !== serializedSkills) {
      _skillPanel.setAttribute("skills", serializedSkills);
    }
  }

  /**
   * 2026-04-16 新增 — Browser Skill 数据真实拉取 + mock 兜底
   * 变更类型：新增/兼容/安全
   * 功能描述：优先从 backend Zhiz skill proxy 拉取真实 skill 列表；失败时保留当前 mock 数据，不让内容脚本 skill 面板空白。
   * 设计思路：
   *   1. 已登录时先尝试 Bearer；若收到 401 则刷新一次 token 后重试，再匿名退化，与 Web 端行为保持一致。
   *   2. 继续保留 core/mock.json 作为预加载兜底，保证 `/` 首次触发不会因网络而失去反馈。
   *   3. 用 in-flight promise 去重，避免 storage 变更、首次预加载与 slash 首开补拉并发触发重复请求。
   * 参数与返回值：_loadSkillData({ forceRefresh }) 返回 Promise<object[]>。
   * 影响范围：browser/content/content.js skill 数据预加载、登录态切换刷新。
   * 潜在风险：若后端 route 返回结构变化，会保守回退到当前 `_SKILLS` 而不是写入脏数据。
   */
  async function _loadSkillData(options = {}) {
    const forceRefresh = Boolean(options.forceRefresh);
    if (_skillDataLoadPromise) {
      return _skillDataLoadPromise;
    }

    _skillDataLoadPromise = (async () => {
      try {
        const result = await loadSkillProxyPayload({
          requestUrl: SKILL_PROXY_URL,
          fetchImpl: fetch,
          getAccessToken: _getStoredSkillSsoToken,
          refreshAccessToken: Sso.refreshAccessToken,
          getRequestSignal: _getSkillRequestSignal,
          onAuthRetryFailure: _logSkillAuthRetryFailure,
        });

        _SKILLS = assertSkillProxySuccess(result);
        _skillDataSource = "remote";
        return _SKILLS;
      } catch (err) {
        console.warn(
          "[Easy Prompt] Skill proxy fetch failed, fallback to current skills:",
          err,
        );
        _skillDataSource = "mock";
        return _SKILLS;
      } finally {
        _skillDataLoadPromise = null;
      }
    })();

    return _skillDataLoadPromise;
  }

  async function _refreshSkillPanelSkills(options = {}) {
    await _loadSkillData(options);
    _syncSkillPanelSkills();
  }

  function _shouldRefreshSkillsForSsoChange(changes) {
    const userChange = changes[SSO_USER_KEY];
    if (userChange && userChange.newValue !== userChange.oldValue) {
      return true;
    }

    const tokenChange = changes[SSO_ACCESS_TOKEN_KEY];
    if (!tokenChange) {
      return false;
    }

    return Boolean(tokenChange.oldValue) !== Boolean(tokenChange.newValue);
  }

  if (chrome.storage?.onChanged?.addListener) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local" || !_skillDepsLoaded) {
        return;
      }
      if (!_shouldRefreshSkillsForSsoChange(changes)) {
        return;
      }
      void _refreshSkillPanelSkills({ forceRefresh: true });
    });
  }

  // 异步预加载 skill 依赖（不阻塞主流程）
  (async () => {
    try {
      // 2026-04-13 修复：custom element 注册与 CSS 注入改由 WXT 注入的
      //   MAIN world registrar 负责；isolated content script 仅加载数据与图标。
      // [影响范围] browser/wxt-entrypoints/easy-prompt.content.js + skill panel 预加载链路
      // [潜在风险] 若 MAIN world 注入被页面 CSP 拦截，_createSkillPanel 会在升级校验处降级失败。
      const [dataMod, iconsMod] = await Promise.all([
        import("../../core/mock.json"),
        import("../../shared-ui/icons/index.js"),
      ]);
      _SKILLS = Array.isArray(dataMod.default) ? dataMod.default : [];
      _SKILL_ICON_MAP = iconsMod.SKILL_ICON_MAP || {};
      _FOLDER_ICON_SVG = iconsMod.FOLDER_ICON_SVG || "";
      _skillDepsLoaded = true;
      void _refreshSkillPanelSkills();
    } catch (e) {
      console.warn("[Easy Prompt] Skill panel deps failed to load:", e);
    }
  })();

  /** 检查输入是否适合进行 Prompt 增强 */
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

  /* ─── Extract Text from Element ─── */
  function extractText(el) {
    if (!el) return "";
    const tag = el.tagName;
    if (tag === "TEXTAREA" || tag === "INPUT") return el.value || "";
    return (el.innerText || el.textContent || "").trim();
  }

  /* ─── Inject Text into Element ─── */
  function injectText(el, text) {
    if (!el) return;

    // Auto-detect editor type from element for resilient injection
    let type;
    if (el.tagName === "TEXTAREA") type = "textarea";
    else if (el.tagName === "INPUT") type = "input";
    else if (el.hasAttribute("data-slate-node")) type = "slate";
    else if (
      el.hasAttribute("data-lexical-editor") ||
      el.closest("[data-lexical-editor]")
    )
      type = "lexical";
    else type = currentSite.type; // prosemirror/quill/codemirror/contenteditable — all use execCommand

    if (type === "textarea" || type === "input") {
      const proto =
        el.tagName === "INPUT"
          ? HTMLInputElement.prototype
          : HTMLTextAreaElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (nativeSetter) {
        nativeSetter.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    if (type === "slate") {
      el.focus();
      // Select all, then use InputEvent for Slate
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      el.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          inputType: "insertReplacementText",
          data: text,
          dataTransfer: dt,
          cancelable: true,
        }),
      );
      return;
    }

    if (type === "lexical") {
      el.focus();
      // Select all content
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
      // Simulate paste — most reliable for Lexical editors
      const clipboardData = new DataTransfer();
      clipboardData.setData("text/plain", text);
      el.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: clipboardData,
        }),
      );
      return;
    }

    // ProseMirror / Quill / CodeMirror / contenteditable
    // execCommand('insertText') — widely supported for contenteditable
    el.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand("insertText", false, text);
  }

  /* ─── Find Input Element ─── */
  /* Generic fallback selectors for when site-specific selectors fail */
  const FALLBACK_SELECTORS = [
    '[contenteditable="true"][role="textbox"]',
    '[data-lexical-editor="true"]',
    '[data-slate-editor="true"]',
    '.ProseMirror[contenteditable="true"]',
    '.ql-editor[contenteditable="true"]',
    '[data-slate-node="value"][role="textbox"]',
    'textarea:not([disabled]):not([type="hidden"])',
  ];

  function isVisibleAndEnabled(el) {
    if (!el) return false;
    if (el.disabled) return false;
    if (el.getAttribute("aria-disabled") === "true") return false;
    if (el.offsetParent !== null) return true;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function findInputElement() {
    // 1. Try site-specific selectors
    for (const sel of currentSite.selectors) {
      const el = document.querySelector(sel);
      if (el && isVisibleAndEnabled(el)) {
        return el;
      }
    }
    // 2. Fallback: try generic selectors
    for (const sel of FALLBACK_SELECTORS) {
      const el = document.querySelector(sel);
      if (el && isVisibleAndEnabled(el)) {
        return el;
      }
    }
    return null;
  }

  /* ═══════════════════════════════
   * Trigger Icon (persistent ✨)
   * ═══════════════════════════════ */

  function createTriggerIcon() {
    if (triggerIcon) return triggerIcon;

    triggerIcon = document.createElement("div");
    triggerIcon.id = "ep-trigger-icon";
    triggerIcon.title = `Easy Prompt 增强 (${SHORTCUT_LABEL})`;
    _setIconNode(triggerIcon, ICON_SPARKLES_SM, { size: 14 });

    triggerIcon.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerEnhance();
    });

    document.body.appendChild(triggerIcon);
    return triggerIcon;
  }

  /**
   * Walk up from the tracked input to find the visible "input box" container.
   * Most AI chat sites wrap the editor in a container with border-radius / border / background.
   * Positioning relative to this container ensures consistent icon placement.
   */
  function getInputContainer(el) {
    let node = el;
    const elRect = el.getBoundingClientRect();
    for (
      let i = 0;
      i < 6 && node.parentElement && node.parentElement !== document.body;
      i++
    ) {
      node = node.parentElement;
      const st = window.getComputedStyle(node);
      const hasBorder = parseFloat(st.borderWidth) > 0;
      const hasBg =
        st.backgroundColor !== "rgba(0, 0, 0, 0)" &&
        st.backgroundColor !== "transparent";
      // Must have a VISIBLE background or border to count as the visual container
      // (border-radius alone with transparent bg is just an internal layout detail)
      if ((hasBg || hasBorder) && node.offsetWidth >= elRect.width * 0.9) {
        return node;
      }
    }
    return el; // fallback to input element itself
  }

  function positionTriggerIcon() {
    if (!triggerIcon || !trackedInput) return;
    const container = getInputContainer(trackedInput);
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const size = 28;
    // Account for container border-radius: push icon inward to avoid rounded corners
    const st = window.getComputedStyle(container);
    const radius = parseFloat(st.borderRadius) || 0;
    const margin = 6 + Math.min(Math.ceil(radius * 0.3), 6); // cap at 12px total
    // Position at top-right inside the visible container
    let top = rect.top + margin;
    let left = rect.right - size - margin;
    // For short containers (single-line), vertically center
    if (rect.height < size + margin * 3) {
      top = rect.top + (rect.height - size) / 2;
    }
    // Clamp to viewport
    top = Math.max(4, Math.min(top, window.innerHeight - size - 4));
    left = Math.max(4, Math.min(left, window.innerWidth - size - 4));
    triggerIcon.style.top = `${top}px`;
    triggerIcon.style.left = `${left}px`;
  }

  function updateTriggerIconState() {
    if (!triggerIcon || !trackedInput) return;
    const text = extractText(trackedInput);
    if (text && isValidInput(text)) {
      triggerIcon.classList.add("is-active");
    } else {
      triggerIcon.classList.remove("is-active");
    }
  }

  function showTriggerIcon() {
    const icon = createTriggerIcon();
    positionTriggerIcon();
    updateTriggerIconState();
    icon.classList.add("is-visible");
  }

  function hideTriggerIcon() {
    if (!triggerIcon) return;
    triggerIcon.classList.remove("is-visible");
  }

  /* ═══════════════════════════════
   * Preview Panel
   * ═══════════════════════════════ */

  function createPreviewPanel() {
    if (previewPanel) return previewPanel;

    previewPanel = document.createElement("div");
    previewPanel.id = "ep-preview-panel";
    const header = _createDomNode("div", { className: "ep-preview-header" });
    const headerIcon = _createDomNode("span", { className: "ep-preview-icon" });
    _appendSvgNodes(headerIcon, ICON_SPARKLES, { size: 16 });
    const headerTitle = _createDomNode("span", {
      className: "ep-preview-title",
      text: "Prompt 增强预览",
    });
    const closeBtn = _createIconButton({
      className: "ep-preview-close",
      title: "关闭",
      iconSvg: ICON_X,
      iconSize: 12,
    });
    header.append(headerIcon, headerTitle, closeBtn);

    const body = _createDomNode("div", { className: "ep-preview-body" });
    const originalSection = _createDomNode("div", {
      className: "ep-preview-section ep-preview-original",
    });
    originalSection.append(
      _createDomNode("div", {
        className: "ep-preview-section-label",
        text: "原始 Prompt",
      }),
      _createDomNode("div", {
        className: "ep-preview-section-text",
        id: "ep-original-text",
      }),
    );
    const arrow = _createDomNode("div", { className: "ep-preview-arrow" });
    _appendSvgNodes(arrow, ICON_ARROW_DOWN, { size: 12 });
    const enhancedSection = _createDomNode("div", {
      className: "ep-preview-section ep-preview-enhanced",
    });
    enhancedSection.append(
      _createDomNode("div", {
        className: "ep-preview-section-label",
        text: "增强后",
      }),
      _createDomNode("div", {
        className: "ep-preview-section-text",
        id: "ep-enhanced-text",
      }),
    );
    body.append(originalSection, arrow, enhancedSection);

    const loading = _createDomNode("div", {
      className: "ep-preview-loading",
      id: "ep-preview-loading",
    });
    const loadingIcon = _createDomNode("span", {
      className: "ep-preview-loading-icon",
    });
    _appendSvgNodes(loadingIcon, ICON_LOADER, {
      size: 16,
      className: "ep-spin",
    });
    loading.append(
      loadingIcon,
      _createDomNode("span", {
        id: "ep-loading-text",
        text: "正在识别意图...",
      }),
    );

    const error = _createDomNode("div", {
      className: "ep-preview-error",
      id: "ep-preview-error",
    });
    const retryBtn = _createDomNode("button", {
      className: "ep-preview-retry",
      id: "ep-retry-btn",
      text: "重试",
    });
    error.append(
      _createDomNode("span", {
        className: "ep-preview-error-msg",
        id: "ep-error-msg",
      }),
      retryBtn,
    );

    const actions = _createDomNode("div", {
      className: "ep-preview-actions",
      id: "ep-preview-actions",
    });
    const cancelBtn = _createDomNode("button", {
      className: "ep-preview-btn ep-btn-cancel",
      id: "ep-btn-cancel",
      text: "取消",
    });
    const copyBtn = _createIconButton({
      className: "ep-preview-btn ep-btn-copy",
      id: "ep-btn-copy",
      iconSvg: ICON_COPY,
      label: "复制",
      iconSize: 14,
    });
    const replaceBtn = _createIconButton({
      className: "ep-preview-btn ep-btn-replace",
      id: "ep-btn-replace",
      iconSvg: ICON_REPLACE,
      label: "替换原文",
      iconSize: 14,
    });
    actions.append(cancelBtn, copyBtn, replaceBtn);

    previewPanel.append(header, body, loading, error, actions);

    // Event listeners
    closeBtn.addEventListener("click", () => hidePreviewPanel());
    cancelBtn.addEventListener("click", () => hidePreviewPanel());
    copyBtn.addEventListener("click", handleCopy);
    replaceBtn.addEventListener("click", handleReplace);
    retryBtn.addEventListener("click", () => triggerEnhance());

    document.body.appendChild(previewPanel);
    return previewPanel;
  }

  function positionPreviewPanel() {
    if (!previewPanel || !trackedInput) return;
    const rect = trackedInput.getBoundingClientRect();
    const panelWidth = 420;
    const gap = 8;

    // Get actual panel height for positioning bottom-edge above input
    const panelRect = previewPanel.getBoundingClientRect();
    const panelHeight = panelRect.height || 200; // fallback estimate

    // Position panel so its BOTTOM edge is above input's top edge
    let left = rect.left + rect.width / 2 - panelWidth / 2;
    let top = rect.top - panelHeight - gap;

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));
    if (top < 8) top = rect.bottom + gap; // Fallback: below input

    previewPanel.style.left = `${left}px`;
    previewPanel.style.top = `${top}px`;
    previewPanel.style.maxWidth = `${panelWidth}px`;
    // Transform origin from bottom for upward animation
    previewPanel.style.transformOrigin = "center bottom";
  }

  function showPreviewPanel() {
    const panel = createPreviewPanel();
    // Set state BEFORE positioning so panel height includes loading content
    panel.classList.remove("is-loaded", "is-error");
    panel.classList.add("is-loading");
    panel.querySelector("#ep-original-text").textContent = "";
    panel.querySelector("#ep-enhanced-text").textContent = "";
    panel.querySelector("#ep-error-msg").textContent = "";
    // Position after state is set for accurate height calculation
    positionPreviewPanel();
    // Make visible last to trigger transition
    panel.classList.add("is-visible");
  }

  function hidePreviewPanel() {
    if (!previewPanel) return;
    previewPanel.classList.remove(
      "is-visible",
      "is-loading",
      "is-loaded",
      "is-error",
    );
  }

  function setPreviewLoaded(originalText, enhancedText) {
    if (!previewPanel) return;
    previewPanel.querySelector("#ep-original-text").textContent = originalText;
    previewPanel.querySelector("#ep-enhanced-text").textContent = enhancedText;
    previewPanel.classList.remove("is-loading", "is-error");
    previewPanel.classList.add("is-loaded");

    // Re-position after content is rendered (size may change)
    requestAnimationFrame(() => positionPreviewPanel());
  }

  function setPreviewError(msg) {
    if (!previewPanel) return;
    previewPanel.querySelector("#ep-error-msg").textContent = msg;
    previewPanel.classList.remove("is-loading", "is-loaded");
    previewPanel.classList.add("is-error");
  }

  let _enhancedResult = ""; // Temp storage for copy/replace

  /* ─── Actions ─── */
  function handleCopy() {
    if (!_enhancedResult) return;
    navigator.clipboard
      .writeText(_enhancedResult)
      .then(() => {
        // Brief feedback
        const btn = previewPanel.querySelector("#ep-btn-copy");
        _setButtonIconLabel(btn, ICON_CHECK, "已复制", { size: 14 });
        btn.classList.add("is-copied");
        setTimeout(() => {
          _setButtonIconLabel(btn, ICON_COPY, "复制", { size: 14 });
          btn.classList.remove("is-copied");
        }, 1500);
      })
      .catch(() => {
        // Clipboard API failed — fallback: select text for manual copy
        const textEl = previewPanel?.querySelector("#ep-enhanced-text");
        if (textEl) {
          const range = document.createRange();
          range.selectNodeContents(textEl);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      });
  }

  function handleReplace() {
    if (!_enhancedResult || !trackedInput) return;
    // Save original for undo
    savedOriginalText = extractText(trackedInput);
    // Inject enhanced text
    injectText(trackedInput, _enhancedResult);
    hidePreviewPanel();
    showUndoBar();
  }

  /* ═══════════════════════════════
   * Undo Bar
   * ═══════════════════════════════ */

  function createUndoBar() {
    if (undoBar) return undoBar;

    undoBar = document.createElement("div");
    undoBar.id = "ep-undo-bar";
    const undoIcon = _createDomNode("span", { className: "ep-undo-icon" });
    _appendSvgNodes(undoIcon, ICON_CHECK, { size: 14 });
    const undoLabel = _createDomNode("span", {
      className: "ep-undo-label",
      text: "Prompt 已增强替换",
    });
    const undoBtn = _createIconButton({
      className: "ep-undo-btn",
      id: "ep-undo-btn",
      iconSvg: ICON_UNDO,
      label: "撤销",
      iconSize: 14,
    });
    undoBar.append(undoIcon, undoLabel, undoBtn);

    undoBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleUndo();
    });

    document.body.appendChild(undoBar);
    return undoBar;
  }

  function showUndoBar() {
    const bar = createUndoBar();
    // Position near input
    if (trackedInput) {
      const rect = trackedInput.getBoundingClientRect();
      bar.style.top = `${rect.bottom + 8}px`;
      bar.style.left = `${rect.left + rect.width / 2}px`;
    }
    bar.classList.add("is-visible");
    clearTimeout(undoTimer);
    // Auto-dismiss after 8 seconds
    undoTimer = setTimeout(hideUndoBar, 8000);
  }

  function hideUndoBar() {
    if (!undoBar) return;
    undoBar.classList.remove("is-visible");
    clearTimeout(undoTimer);
    savedOriginalText = "";
  }

  function handleUndo() {
    if (!savedOriginalText || !trackedInput) return;
    injectText(trackedInput, savedOriginalText);
    hideUndoBar();
  }

  /* ═══════════════════════════════
   * Smart Nudge Bubble
   * ═══════════════════════════════ */

  const NUDGE_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/></svg>`;

  /**
   * Check if nudge is permanently dismissed via chrome.storage.local.
   * Returns a Promise<boolean>.
   */
  async function isNudgeDismissed() {
    try {
      const result = await chrome.storage.local.get("ep_nudge_dismissed");
      return !!result.ep_nudge_dismissed;
    } catch {
      return false;
    }
  }

  /**
   * Permanently dismiss the nudge.
   */
  async function dismissNudgePermanently() {
    try {
      await chrome.storage.local.set({ ep_nudge_dismissed: true });
    } catch {
      /* storage unavailable */
    }
  }

  function createNudgeBubble() {
    if (nudgeBubble) return nudgeBubble;

    nudgeBubble = document.createElement("div");
    nudgeBubble.id = "ep-nudge-bubble";
    const content = _createDomNode("div", { className: "ep-nudge-content" });
    const nudgeIcon = _createDomNode("span", { className: "ep-nudge-icon" });
    _appendSvgNodes(nudgeIcon, NUDGE_ICON, { size: 18 });
    const nudgeText = _createDomNode("span", { className: "ep-nudge-text" });
    nudgeText.append(
      document.createTextNode("试试用 AI 增强你的 Prompt？"),
      _createDomNode("kbd", {
        className: "ep-nudge-kbd",
        text: SHORTCUT_LABEL,
      }),
    );
    content.append(nudgeIcon, nudgeText);

    const actions = _createDomNode("div", { className: "ep-nudge-actions" });
    const enhanceBtn = _createDomNode("button", {
      className: "ep-nudge-btn ep-nudge-enhance",
      id: "ep-nudge-enhance",
      text: "增强",
    });
    const dismissBtn = _createDomNode("button", {
      className: "ep-nudge-btn ep-nudge-dismiss",
      id: "ep-nudge-dismiss",
      text: "不再提醒",
    });
    actions.append(enhanceBtn, dismissBtn);
    nudgeBubble.append(content, actions);

    // Enhance button
    enhanceBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideNudgeBubble();
      triggerEnhance();
    });

    // Dismiss permanently
    dismissBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideNudgeBubble();
      dismissNudgePermanently();
    });

    document.body.appendChild(nudgeBubble);
    return nudgeBubble;
  }

  function positionNudgeBubble() {
    if (!nudgeBubble || !trackedInput) return;
    const container = getInputContainer(trackedInput);
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const bubbleWidth = 360;
    const gap = 10;

    // Position above input, centered
    let left = rect.left + rect.width / 2 - bubbleWidth / 2;
    let top = rect.top - gap;

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - bubbleWidth - 8));
    if (top < 60) top = rect.bottom + gap; // Fallback: below input

    nudgeBubble.style.left = `${left}px`;
    nudgeBubble.style.top = `${top}px`;
    nudgeBubble.style.maxWidth = `${bubbleWidth}px`;
  }

  function showNudgeBubble() {
    const bubble = createNudgeBubble();
    positionNudgeBubble();
    // Use transform for bottom-anchored slide-up
    bubble.style.transformOrigin = "center bottom";
    requestAnimationFrame(() => {
      bubble.classList.add("is-visible");
    });
  }

  function hideNudgeBubble() {
    if (!nudgeBubble) return;
    nudgeBubble.classList.remove("is-visible");
    clearTimeout(nudgeTimer);
  }

  /**
   * Called on input changes to potentially trigger the nudge.
   * Shows the nudge only once per session, when text is long enough,
   * after a 3-second pause.
   */
  function scheduleNudge() {
    // Skip if already shown, already enhancing, or dismissed
    if (nudgeShownThisSession || hasUsedEnhance || isEnhancing) return;
    // Skip if preview panel is visible
    if (previewPanel?.classList.contains("is-visible")) return;

    clearTimeout(nudgeTimer);

    const text = extractText(trackedInput);
    if (!text || text.trim().length < 10) return;
    if (!isValidInput(text)) return;

    nudgeTimer = setTimeout(async () => {
      // Double-check conditions after timeout
      if (nudgeShownThisSession || hasUsedEnhance || isEnhancing) return;
      if (previewPanel?.classList.contains("is-visible")) return;

      // Check permanent dismissal
      const dismissed = await isNudgeDismissed();
      if (dismissed) return;

      // Re-check text hasn't changed significantly
      const currentText = extractText(trackedInput);
      if (!currentText || currentText.trim().length < 10) return;

      nudgeShownThisSession = true;
      showNudgeBubble();

      // Auto-hide after 10 seconds if not interacted
      setTimeout(() => {
        if (nudgeBubble?.classList.contains("is-visible")) {
          hideNudgeBubble();
        }
      }, 10000);
    }, 3000);
  }

  /**
   * ═══════════════════════════════
   * Skill Panel（"/" 触发浮窗）
   * 2026-04-13 新增：在输入框键入 "/" 时弹出 skill 选择列表
   *
   * [类型]       新增功能
   * [功能描述]   用户在支持的 AI 站点输入框中键入 "/" 时，弹出类似 slash command 的
   *              skill 选择浮窗；选中后将对应 instructions 注入到输入框。
   * [设计思路]   用户在输入框键入 "/" 时弹出 skill 列表，选中后将 instructions
   *              注入到输入框，替换 "/" 前缀。自定义元素由 MAIN world registrar
   *              注册，isolated content script 仅消费升级后的元素实例。
   * [影响范围]   content.js（新增）, shared-ui/skill-panel.js（复用）
   * [潜在风险] 目标站点若拦截主世界脚本注入，则元素不会升级，skill 浮窗安全降级不可用。
   * ═══════════════════════════════ */

  function _createSkillPanel() {
    if (_skillPanel) return _skillPanel;
    // 依赖尚未加载完成时跳过（异步预加载中）
    if (!_skillDepsLoaded) return null;
    _skillPanel = document.createElement("ep-skill-panel");
    // 2026-04-13 修复：isolated world 不再尝试直接访问 customElements。
    //   这里通过 ShadowRoot 升级结果校验主世界注册器是否生效。
    // [参数与返回值] 若元素未升级为真实 Web Component，则返回 null。
    // [影响范围] browser/content/content.js skill panel 创建路径。
    // [潜在风险] 无——未升级时只阻止浮窗创建，不影响其余增强能力。
    if (!_skillPanel.shadowRoot) {
      console.warn(
        "[Easy Prompt] Skill panel element was not upgraded by main-world registrar.",
      );
      _skillPanel = null;
      return null;
    }
    // 2026-04-13 修复：MAIN world custom element 与 isolated content script
    //   间通过 DOM attribute 传递状态，避免自定义属性 setter 跨 world 丢失。
    // [参数与返回值] 无外部参数；将 panel 初始状态序列化到 attribute。
    // [影响范围] browser/content/content.js → shared-ui/skill-panel.js 状态同步链路。
    // [潜在风险] skills/iconMap JSON 会增加 attribute 长度，但数据量在可接受范围内。
    _skillPanel.setAttribute("skills", JSON.stringify(_SKILLS));
    _skillPanel.setAttribute("skill-type-map", JSON.stringify(_SKILL_TYPE_MAP));
    _skillPanel.setAttribute("icon-map", JSON.stringify(_SKILL_ICON_MAP));
    _skillPanel.setAttribute("folder-icon", _FOLDER_ICON_SVG || "");

    // 固定定位，避免页面 CSS 干扰
    _skillPanel.style.cssText =
      "position:fixed;z-index:2147483645;display:none;";

    // 深色/浅色模式自动检测 + 不透明背景色覆盖
    // 2026-04-13 修复：外部站点无 CSS 变量，硬编码不透明背景以遮盖页面内容
    const syncTheme = () => {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      _skillPanel.classList.toggle("dark", isDark);
      if (isDark) {
        // 不透明深色背景（匹配 web端 input-box: color-mix(--bg-elevated 97%, --accent 3%) ≈ #1f1e28）
        _skillPanel.style.setProperty("--ep-panel-bg", "#1f1e28");
        _skillPanel.style.setProperty(
          "--ep-panel-border",
          "rgba(255,255,255,0.12)",
        );
        _skillPanel.style.setProperty(
          "--ep-panel-shadow",
          "inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.15), inset 0 0 0 0.5px rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)",
        );
      } else {
        _skillPanel.style.setProperty("--ep-panel-bg", "#ffffff");
        _skillPanel.style.setProperty("--ep-panel-border", "#e5e7eb");
        _skillPanel.style.removeProperty("--ep-panel-shadow");
      }
    };
    syncTheme();
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", syncTheme);

    // 选中 skill：移除 "/" + filter 文本，注入 instructions
    // 2026-04-13 修复：使用 _skillSlashIndex 精确定位 "/" 位置，
    //   保留 "/" 前的文本 + "/" 后 filter 之后的文本，中间插入 instructions。
    _skillPanel.addEventListener("skill-select", (e) => {
      const skill = e.detail;
      if (!trackedInput) return;

      const text = extractText(trackedInput);
      let before = "";
      let after = "";

      if (_skillSlashIndex >= 0) {
        before = text.substring(0, _skillSlashIndex);
        // filter 长度 = 当前面板 filter attribute 的值长度
        const filterText = _skillPanel.getAttribute("filter") || "";
        const filterLen = filterText.length;
        after = text.substring(_skillSlashIndex + 1 + filterLen);
      } else {
        before = text;
      }

      // 拼接：instructions + before（保留原文） + after
      let newVal = before.trimEnd();
      if (skill.instructions) {
        newVal = (newVal ? newVal + "\n" : "") + skill.instructions;
      }
      if (after.trimStart()) {
        newVal += "\n" + after.trimStart();
      }
      _skillSlashIndex = -1;
      injectText(trackedInput, newVal);
      _hideSkillPanel();
    });

    _skillPanel.addEventListener("panel-close", () => {
      _hideSkillPanel();
    });

    document.body.appendChild(_skillPanel);
    // 2026-04-13 修复：skill 面板高度会随过滤结果变化，监听 host 尺寸变化后
    //   复用统一的 scheduleReposition 链路，确保浮窗底边始终贴住输入框。
    // [参数与返回值] 无外部参数；建立 ResizeObserver；无返回值。
    // [影响范围] browser/content/content.js skill panel 定位链路。
    // [潜在风险] 无已知风险。
    if (_skillPanelResizeObserver) {
      _skillPanelResizeObserver.disconnect();
    }
    _skillPanelResizeObserver = new ResizeObserver(() => {
      if (_skillPanelVisible) {
        scheduleReposition();
      }
    });
    _skillPanelResizeObserver.observe(_skillPanel);
    return _skillPanel;
  }

  function _positionSkillPanel() {
    if (!_skillPanel || !trackedInput) return;
    const container = getInputContainer(trackedInput);
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // 2026-04-13 修复：使用面板实际高度做 bottom-anchor 定位，避免
    //   过滤结果变少时仍按旧估算高度顶边对齐，导致面板漂移离开输入框。
    // [参数与返回值] 无外部参数；直接更新 panel 的 top/left/transformOrigin。
    // [影响范围] browser/content/content.js skill panel 绝对定位。
    // [潜在风险] 无已知风险。
    const panelRect = _skillPanel.getBoundingClientRect();
    const panelHeight = panelRect.height || 240;
    const panelWidth = panelRect.width || 300;
    const gap = 4;
    let top = rect.top - panelHeight - gap;
    let left = rect.left;
    let placeBelow = false;

    // 若上方空间不足，放到下方
    if (top < 4) {
      top = rect.bottom + gap;
      placeBelow = true;
    }
    // 限制在视口内
    top = Math.max(4, Math.min(top, window.innerHeight - panelHeight - 4));
    left = Math.max(4, Math.min(left, window.innerWidth - panelWidth - 4));

    _skillPanel.style.top = `${top}px`;
    _skillPanel.style.left = `${left}px`;
    _skillPanel.style.transformOrigin = placeBelow ? "left top" : "left bottom";
  }

  function _showSkillPanel() {
    const panel = _createSkillPanel();
    if (!panel) return; // 依赖未就绪，静默跳过
    panel.style.display = "";
    _skillPanelVisible = true;
    panel.setAttribute("visible", "true");
    _positionSkillPanel();
  }

  // 2026-04-14 优化：skill 浮窗已打开后，字符过滤更新走轻量 trailing debounce，
  //   降低高频输入时的重渲染密度，保持首次 "/" 唤起仍然即时。
  // [参数与返回值] 无参数；清理待执行的过滤同步计时器。
  // [影响范围] browser/content/content.js skill 过滤输入体验与性能。
  // [潜在风险] 无已知风险。
  function _clearSkillFilterDebounce() {
    if (_skillFilterDebounceTimer) {
      clearTimeout(_skillFilterDebounceTimer);
      _skillFilterDebounceTimer = null;
    }
  }

  function _scheduleSkillTriggerCheck() {
    if (!_skillPanelVisible) {
      _checkSkillTrigger();
      return;
    }
    _clearSkillFilterDebounce();
    _skillFilterDebounceTimer = setTimeout(() => {
      _skillFilterDebounceTimer = null;
      _checkSkillTrigger();
    }, SKILL_FILTER_DEBOUNCE_MS);
  }

  function _hideSkillPanel() {
    if (!_skillPanel) return;
    _clearSkillFilterDebounce();
    _skillPanelVisible = false;
    _skillPanel.removeAttribute("visible");
    _skillPanel.style.display = "none";
  }

  /**
   * 获取输入元素中光标在纯文本中的偏移位置
   * 2026-04-13 新增：支持 textarea/input（selectionStart）和 contenteditable（Selection API）
   * @param {HTMLElement} el - 输入元素
   * @returns {number} 光标偏移，-1 表示无法获取
   */
  function _getCursorOffset(el) {
    if (!el) return -1;
    const tag = el.tagName;
    if (tag === "TEXTAREA" || tag === "INPUT") {
      return el.selectionStart ?? -1;
    }
    // contenteditable: 通过 Selection API 计算光标在 innerText 中的等效偏移
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return -1;
    try {
      const range = sel.getRangeAt(0);
      const preRange = document.createRange();
      preRange.selectNodeContents(el);
      preRange.setEnd(range.startContainer, range.startOffset);
      return preRange.toString().length;
    } catch {
      return -1;
    }
  }

  /**
   * "/" 触发检测：基于光标位置检测输入框中的 "/"
   * 支持 textarea/input 和 contenteditable 两类输入元素
   * 2026-04-13 修复两个 bug：
   *   (1) 原 startsWith("/") 导致"输入文字后键入 /"不触发；
   *   (2) 原 substring(1) 导致光标在行首键入 "/" 时 filter 包含光标后全部文本。
   * [设计思路] 从光标位置向前查找最近的 "/"，取 slash→cursor 之间文本作为 filter。
   *            排除 "://" URL 模式防止误触发。
   * [影响范围] content.js（_checkSkillTrigger + skill-select 事件）
   * [潜在风险] contenteditable Selection API 在极端 DOM 结构下可能返回 -1，此时不触发（安全降级）
   */
  function _checkSkillTrigger() {
    if (!trackedInput) return;
    const text = extractText(trackedInput);
    const cursorPos = _getCursorOffset(trackedInput);

    // 无法获取光标位置时，回退到检查全文末尾（兼容极端情况）
    const effectiveCursor = cursorPos >= 0 ? cursorPos : text.length;
    const textBeforeCursor = text.substring(0, effectiveCursor);
    const slashPos = textBeforeCursor.lastIndexOf("/");
    const hasValidSlash =
      slashPos >= 0 && !(slashPos > 0 && text[slashPos - 1] === ":");

    if (hasValidSlash) {
      // 找到 "/"，且不是 "://" URL 模式 → 触发 skill 浮窗
      const filter = textBeforeCursor.substring(slashPos + 1);
      _skillSlashIndex = slashPos;
      if (!_skillPanelVisible) {
        if (_shouldRefreshSkillsOnPanelOpen()) {
          void _refreshSkillPanelSkills({ forceRefresh: true });
        }
        _showSkillPanel();
      }
      if (_skillPanel) {
        const currentFilter = _skillPanel.getAttribute("filter") || "";
        // 2026-04-14 修复：Gemini 等 contenteditable 编辑器会在同一次交互中连续触发
        //   input + keyup。若重复写入相同 filter，会导致 skill panel 无意义重渲染，
        //   进而表现为过滤闪烁、方向键高亮被立即重置。
        // [参数与返回值] 比较当前/新 filter，相同则仅做定位，不写 attribute。
        // [影响范围] browser/content/content.js → skill panel 过滤与键盘导航链路。
        // [潜在风险] 无已知风险。
        if (currentFilter !== filter) {
          _skillPanel.setAttribute("filter", filter);
        }
        _positionSkillPanel();
      }
    } else {
      // 未找到有效 "/" → 关闭浮窗
      _skillSlashIndex = -1;
      if (_skillPanelVisible) {
        _hideSkillPanel();
      }
    }
  }

  /* ═══════════════════════════════
   * Core Enhance Trigger
   * ═══════════════════════════════ */

  async function triggerEnhance() {
    if (isEnhancing || !trackedInput) return;

    const text = extractText(trackedInput);
    if (!isValidInput(text)) return;

    hasUsedEnhance = true;
    hideNudgeBubble();

    isEnhancing = true;
    _enhancedResult = "";
    hideUndoBar();
    showPreviewPanel();

    // Set trigger icon to loading state
    if (triggerIcon) {
      triggerIcon.classList.add("is-loading");
      _setIconNode(triggerIcon, ICON_LOADER, {
        size: 16,
        className: "ep-spin",
      });
    }

    try {
      if (!chrome.runtime?.id) throw new Error("扩展上下文已失效，请刷新页面");

      const response = await chrome.runtime.sendMessage({
        type: "ENHANCE_INLINE",
        text,
      });

      if (!response || !response.ok) {
        throw new Error(response?.error || "增强失败");
      }

      _enhancedResult = response.result;
      setPreviewLoaded(text, response.result);
    } catch (err) {
      setPreviewError(err.message || "增强失败");
    } finally {
      isEnhancing = false;
      // Reset trigger icon
      if (triggerIcon) {
        triggerIcon.classList.remove("is-loading");
        _setIconNode(triggerIcon, ICON_SPARKLES_SM, { size: 14 });
        updateTriggerIconState();
      }
    }
  }

  /* ═══════════════════════════════
   * Keyboard Shortcut
   * ═══════════════════════════════ */

  document.addEventListener("keydown", (e) => {
    // ⌘⇧E (Mac) / Ctrl+Shift+E (Win/Linux)
    const isShortcut =
      e.shiftKey && (e.metaKey || e.ctrlKey) && e.key.toUpperCase() === "E";
    if (!isShortcut) return;

    // Only trigger if we're on an AI site and have an input tracked
    if (!currentSite || !trackedInput) return;

    e.preventDefault();
    e.stopPropagation();
    triggerEnhance();
  });

  /* ═══════════════════════════════
   * Input Tracking + Trigger Icon
   * ═══════════════════════════════ */

  function onInputActivity() {
    updateTriggerIconState();
    positionTriggerIcon();
    scheduleNudge();
    _scheduleSkillTriggerCheck(); // 2026-04-13 Skill 浮窗 "/" 触发检测
  }

  function attachInputListeners(el) {
    if (trackedInput === el) return;
    detachInputListeners();
    trackedInput = el;

    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      el.addEventListener("input", onInputActivity);
      el.addEventListener("focus", onFocusInput);
      el.addEventListener("blur", onBlurInput);
    } else {
      el.addEventListener("input", onInputActivity);
      el.addEventListener("keyup", onInputActivity);
      el.addEventListener("focus", onFocusInput);
      el.addEventListener("blur", onBlurInput);
    }

    // Watch for input element size changes (e.g. auto-grow/shrink)
    if (inputResizeObserver) inputResizeObserver.disconnect();
    inputResizeObserver = new ResizeObserver(() => {
      positionTriggerIcon();
      if (previewPanel?.classList.contains("is-visible"))
        positionPreviewPanel();
      if (undoBar?.classList.contains("is-visible")) {
        const r = trackedInput?.getBoundingClientRect();
        if (r) {
          undoBar.style.top = `${r.bottom + 8}px`;
          undoBar.style.left = `${r.left + r.width / 2}px`;
        }
      }
      if (_skillPanelVisible) {
        _positionSkillPanel();
      }
    });
    inputResizeObserver.observe(el);

    // Show trigger icon immediately
    showTriggerIcon();
  }

  function detachInputListeners() {
    if (!trackedInput) return;
    trackedInput.removeEventListener("input", onInputActivity);
    trackedInput.removeEventListener("keyup", onInputActivity);
    trackedInput.removeEventListener("focus", onFocusInput);
    trackedInput.removeEventListener("blur", onBlurInput);
    _clearSkillFilterDebounce();
    if (inputResizeObserver) {
      inputResizeObserver.disconnect();
      inputResizeObserver = null;
    }
    trackedInput = null;
    hideTriggerIcon();
    // Clean up any open UI to prevent orphaned panels
    hidePreviewPanel();
    hideUndoBar();
    hideNudgeBubble();
    _hideSkillPanel(); // 2026-04-13 Skill 浮窗清理
    if (nudgeTimer) {
      clearTimeout(nudgeTimer);
      nudgeTimer = null;
    }
  }

  function onFocusInput() {
    showTriggerIcon();
  }

  function onBlurInput() {
    // Delay hide to allow clicking on trigger icon
    setTimeout(() => {
      if (
        document.activeElement !== trackedInput &&
        !triggerIcon?.matches(":hover") &&
        !previewPanel?.classList.contains("is-visible")
      ) {
        hideTriggerIcon();
      }
    }, 200);
  }

  /* ─── Reposition on scroll/resize ─── */
  function scheduleReposition(e) {
    // Skip scroll events from the tracked input itself (content scrolling)
    // Input internal scroll doesn't change the element's viewport position
    if (e && e.target === trackedInput) return;
    if (repositionRaf) return;
    repositionRaf = requestAnimationFrame(() => {
      positionTriggerIcon();
      if (previewPanel?.classList.contains("is-visible")) {
        positionPreviewPanel();
      }
      if (undoBar?.classList.contains("is-visible") && trackedInput) {
        const rect = trackedInput.getBoundingClientRect();
        undoBar.style.top = `${rect.bottom + 8}px`;
        undoBar.style.left = `${rect.left + rect.width / 2}px`;
      }
      if (nudgeBubble?.classList.contains("is-visible")) {
        positionNudgeBubble();
      }
      if (_skillPanelVisible) {
        _positionSkillPanel();
      }
      repositionRaf = null;
    });
  }

  window.addEventListener("scroll", scheduleReposition, {
    passive: true,
    capture: true,
  });
  window.addEventListener("resize", scheduleReposition, { passive: true });

  /* ─── Input Discovery with MutationObserver ─── */
  function tryAttachInput() {
    const el = findInputElement();
    if (el) {
      attachInputListeners(el);
      // Once found, disconnect observer to save resources
      // But we still need it for SPA route changes, so don't disconnect
      return true;
    }
    return false;
  }

  // Try immediately
  tryAttachInput();

  // Observe DOM for dynamically loaded inputs (SPA)
  let observerThrottleTimer = null;
  observer = new MutationObserver(() => {
    // Throttle: check at most every 300ms
    if (observerThrottleTimer) return;
    observerThrottleTimer = setTimeout(() => {
      observerThrottleTimer = null;
      if (
        !trackedInput ||
        !trackedInput.isConnected ||
        !isVisibleAndEnabled(trackedInput)
      ) {
        tryAttachInput();
      }
    }, 300);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // SPA navigation detection — covers pushState, replaceState, popstate, hashchange
  let _lastUrl = window.location.href;
  function _checkUrlChange() {
    const newUrl = window.location.href;
    if (newUrl !== _lastUrl) {
      _lastUrl = newUrl;
      setTimeout(() => {
        if (
          !trackedInput ||
          !trackedInput.isConnected ||
          !isVisibleAndEnabled(trackedInput)
        ) {
          detachInputListeners();
          tryAttachInput();
        }
      }, 500);
    }
  }
  window.addEventListener("popstate", _checkUrlChange);
  window.addEventListener("hashchange", _checkUrlChange);
  // Poll for pushState-based SPA navigation (content scripts can't intercept page-level pushState)
  setInterval(_checkUrlChange, 1000);

  /* ─── Progress Updates from Service Worker ─── */
  if (chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (
        message.type === "ENHANCE_PROGRESS" &&
        previewPanel?.classList.contains("is-visible")
      ) {
        const loadingText = previewPanel.querySelector("#ep-loading-text");
        if (loadingText && message.message) {
          loadingText.textContent = message.message;
        }
      }
    });
  }

  /* ─── Close preview / skill panel on Escape ─── */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (_skillPanelVisible) {
        e.preventDefault();
        _hideSkillPanel();
        return;
      }
      if (previewPanel?.classList.contains("is-visible")) {
        e.preventDefault();
        hidePreviewPanel();
      }
    }
  });

  /* ─── Close preview / skill panel on click outside ─── */
  document.addEventListener("mousedown", (e) => {
    // Skill panel click-outside
    if (
      _skillPanelVisible &&
      _skillPanel &&
      !_skillPanel.contains(e.target) &&
      e.target !== trackedInput
    ) {
      _hideSkillPanel();
    }
    // Preview panel click-outside
    if (
      previewPanel?.classList.contains("is-visible") &&
      !previewPanel.contains(e.target) &&
      e.target !== triggerIcon &&
      !triggerIcon?.contains(e.target)
    ) {
      hidePreviewPanel();
    }
  });
})();
