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

  const _htmlParser = new DOMParser();
  function _parseSVG(svg) {
    return _htmlParser.parseFromString(svg, "text/html").body.childNodes;
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
    triggerIcon.replaceChildren(..._parseSVG(ICON_SPARKLES_SM));

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

    previewPanel.innerHTML = `
      <div class="ep-preview-header">
        <span class="ep-preview-icon">${ICON_SPARKLES}</span>
        <span class="ep-preview-title">Prompt 增强预览</span>
        <button class="ep-preview-close" title="关闭">${ICON_X}</button>
      </div>
      <div class="ep-preview-body">
        <div class="ep-preview-section ep-preview-original">
          <div class="ep-preview-section-label">原始 Prompt</div>
          <div class="ep-preview-section-text" id="ep-original-text"></div>
        </div>
        <div class="ep-preview-arrow">${ICON_ARROW_DOWN}</div>
        <div class="ep-preview-section ep-preview-enhanced">
          <div class="ep-preview-section-label">增强后</div>
          <div class="ep-preview-section-text" id="ep-enhanced-text"></div>
        </div>
      </div>
      <div class="ep-preview-loading" id="ep-preview-loading">
        <span class="ep-preview-loading-icon">${ICON_LOADER}</span>
        <span id="ep-loading-text">正在识别意图...</span>
      </div>
      <div class="ep-preview-error" id="ep-preview-error">
        <span class="ep-preview-error-msg" id="ep-error-msg"></span>
        <button class="ep-preview-retry" id="ep-retry-btn">重试</button>
      </div>
      <div class="ep-preview-actions" id="ep-preview-actions">
        <button class="ep-preview-btn ep-btn-cancel" id="ep-btn-cancel">取消</button>
        <button class="ep-preview-btn ep-btn-copy" id="ep-btn-copy">
          ${ICON_COPY}<span>复制</span>
        </button>
        <button class="ep-preview-btn ep-btn-replace" id="ep-btn-replace">
          ${ICON_REPLACE}<span>替换原文</span>
        </button>
      </div>
    `;

    // Event listeners
    previewPanel
      .querySelector(".ep-preview-close")
      .addEventListener("click", () => hidePreviewPanel());
    previewPanel
      .querySelector("#ep-btn-cancel")
      .addEventListener("click", () => hidePreviewPanel());
    previewPanel
      .querySelector("#ep-btn-copy")
      .addEventListener("click", handleCopy);
    previewPanel
      .querySelector("#ep-btn-replace")
      .addEventListener("click", handleReplace);
    previewPanel
      .querySelector("#ep-retry-btn")
      .addEventListener("click", () => triggerEnhance());

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
        const origHTML = btn.innerHTML;
        btn.innerHTML = `${ICON_CHECK}<span>已复制</span>`;
        btn.classList.add("is-copied");
        setTimeout(() => {
          btn.innerHTML = origHTML;
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
    undoBar.innerHTML = `
      <span class="ep-undo-icon">${ICON_CHECK}</span>
      <span class="ep-undo-label">Prompt 已增强替换</span>
      <button class="ep-undo-btn" id="ep-undo-btn">
        ${ICON_UNDO}<span>撤销</span>
      </button>
    `;

    undoBar.querySelector("#ep-undo-btn").addEventListener("click", (e) => {
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

    nudgeBubble.innerHTML = `
      <div class="ep-nudge-content">
        <span class="ep-nudge-icon">${NUDGE_ICON}</span>
        <span class="ep-nudge-text">试试用 AI 增强你的 Prompt？<kbd class="ep-nudge-kbd">${SHORTCUT_LABEL}</kbd></span>
      </div>
      <div class="ep-nudge-actions">
        <button class="ep-nudge-btn ep-nudge-enhance" id="ep-nudge-enhance">增强</button>
        <button class="ep-nudge-btn ep-nudge-dismiss" id="ep-nudge-dismiss">不再提醒</button>
      </div>
    `;

    // Enhance button
    nudgeBubble
      .querySelector("#ep-nudge-enhance")
      .addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideNudgeBubble();
        triggerEnhance();
      });

    // Dismiss permanently
    nudgeBubble
      .querySelector("#ep-nudge-dismiss")
      .addEventListener("click", (e) => {
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
      triggerIcon.replaceChildren(..._parseSVG(ICON_LOADER));
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
        triggerIcon.replaceChildren(..._parseSVG(ICON_SPARKLES_SM));
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

  /* ─── Close preview on Escape ─── */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (previewPanel?.classList.contains("is-visible")) {
        e.preventDefault();
        hidePreviewPanel();
      }
    }
  });

  /* ─── Close preview on click outside ─── */
  document.addEventListener("mousedown", (e) => {
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
