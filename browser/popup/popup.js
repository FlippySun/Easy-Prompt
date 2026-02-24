/**
 * Easy Prompt Browser Extension — Popup Logic
 * 主界面交互：输入 → 智能路由/指定场景 → 生成 Prompt → 历史
 */

/* ─── Safe DOM Helper (avoids innerHTML for Firefox AMO compliance) ─── */
const _htmlParser = new DOMParser();
function _setHTML(el, html) {
  el.replaceChildren(
    ..._htmlParser.parseFromString(html, "text/html").body.childNodes,
  );
}

/* ─── State ─── */
let isGenerating = false;
let currentAbortController = null;
let selectedScene = null;
let _historyData = []; // 事件委托用, 避免每张卡片创建闭包
let _historyQuery = "";
let _historyExpandedId = null;
let _currentOutputText = ""; // P02: 共享变量存储当前输出文本, 避免每次重建 copy button
let _currentOutputScenes = []; // 用于状态持久化
let _currentOutputComposite = false; // 用于状态持久化

/* ─── DOM ─── */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ─── Utils ─── */
function debounce(fn, ms) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

const FLIP_HIDE_BACK_AT_MS = 145; // 背面先收起
const FLIP_REVEAL_FRONT_AT_MS = 150; // 近同步揭示正面，进一步减少等待感

function _clearCloseTimers(el) {
  if (!el || !el._closeTimers) return;
  for (const t of el._closeTimers) clearTimeout(t);
  el._closeTimers = null;
}

function _replayRiseIn(el) {
  if (!el) return;
  el.classList.remove("view-rise-in");
  void el.offsetWidth;
  el.classList.add("view-rise-in");
}

function _scheduleFlipMidSwitch(
  el,
  { onHideBack, onRevealFront, onAfterClose } = {},
) {
  _clearCloseTimers(el);
  let hiddenBack = false;
  let revealedFront = false;
  const hideBack = () => {
    if (hiddenBack) return;
    hiddenBack = true;
    if (onHideBack) onHideBack();
    el.hidden = true;
    el.classList.remove("is-leaving");
    if (onAfterClose) onAfterClose();
  };

  const revealFront = () => {
    if (revealedFront) return;
    revealedFront = true;
    if (onRevealFront) onRevealFront();
  };

  const hideTimer = setTimeout(hideBack, FLIP_HIDE_BACK_AT_MS);
  const revealTimer = setTimeout(revealFront, FLIP_REVEAL_FRONT_AT_MS);
  // fallback: 页面卡顿时确保最终收尾
  const fallbackTimer = setTimeout(() => {
    hideBack();
    revealFront();
    _clearCloseTimers(el);
  }, FLIP_REVEAL_FRONT_AT_MS + 260);
  el._closeTimers = [hideTimer, revealTimer, fallbackTimer];
}

/* ─── State Persistence ─── */
const _savePopupState = debounce(async () => {
  await Storage.savePopupState({
    inputText: ($("#input-text").value || "").trim()
      ? $("#input-text").value
      : "",
    outputText: _currentOutputText || "",
    outputScenes: _currentOutputScenes || [],
    outputComposite: _currentOutputComposite || false,
    selectedScene: selectedScene || null,
  });
}, 300);

/* ═══ Init ═══ */
document.addEventListener("DOMContentLoaded", async () => {
  // Load theme (if saved → explicit; otherwise let CSS prefers-color-scheme handle it)
  const theme = await Storage.loadTheme();
  if (theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  // Inject icons into static elements
  injectIcons();

  // Load scenes
  const ok = await Scenes.loadScenes();
  if (!ok) {
    showToast("场景数据加载失败", "error");
    return;
  }

  // Render UI
  renderHotTags();
  renderScenePicker();
  renderSceneBrowser();
  renderPersonaTabs();
  updateCharCount();

  // Bind events
  bindInputEvents();
  bindHeaderEvents();
  bindGenerateEvents();
  bindCopyButton();
  bindScenePickerEvents();
  bindHistoryEvents();
  bindScenesModalEvents();
  bindKeyboardShortcuts();
  bindTiltEffect();

  // Check if text was passed from service worker (via storage.session or URL params)
  let initialText = null;
  // 优先从 storage.session 读取（无竞态, Chrome/Safari/Firefox 115+）
  try {
    const result = await chrome.storage.session.get("_pendingText");
    if (result._pendingText) {
      initialText = result._pendingText;
      await chrome.storage.session.remove("_pendingText");
    }
  } catch {
    /* storage.session 不可用 — fallback 到 URL 参数 */
  }
  // Fallback: URL 参数（Firefox 新标签页场景）
  if (!initialText) {
    const params = new URLSearchParams(window.location.search);
    initialText = params.get("text") || null;
  }
  if (initialText) {
    // S01: Truncate URL param text to MAX_INPUT_LENGTH
    if (initialText.length > Api.MAX_INPUT_LENGTH) {
      initialText = initialText.slice(0, Api.MAX_INPUT_LENGTH);
    }
    $("#input-text").value = initialText;
    updateCharCount();
    updateGenerateButton();
  } else {
    // Restore saved popup state (only when no new text is incoming)
    try {
      const saved = await Storage.loadPopupState();
      if (saved) {
        if (saved.inputText) {
          $("#input-text").value = saved.inputText;
          updateCharCount();
          updateGenerateButton();
        }
        if (saved.selectedScene) {
          selectScene(saved.selectedScene, true);
        }
        if (saved.outputText) {
          showOutput(
            saved.outputText,
            saved.outputScenes || [],
            saved.outputComposite || false,
            false,
          );
        }
      }
    } catch {
      /* state restore failed — ignore */
    }
  }

  // Flush pending state save before popup closes (bypass debounce)
  window.addEventListener("pagehide", () => {
    _savePopupState.cancel(); // Cancel pending debounced save to avoid stale overlap
    Storage.savePopupState({
      inputText: ($("#input-text").value || "").trim()
        ? $("#input-text").value
        : "",
      outputText: _currentOutputText || "",
      outputScenes: _currentOutputScenes || [],
      outputComposite: _currentOutputComposite || false,
      selectedScene: selectedScene || null,
    });
  });
});

/* ─── Theme Helper ─── */
function getEffectiveTheme() {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr) return attr;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/* ═══ Icon Injection ═══ */
function injectIcons() {
  _setHTML($("#logo-icon"), Icons.sparkles);
  _setHTML($("#btn-clear"), Icons.eraser);
  _setHTML($("#btn-history"), Icons.history);
  _setHTML(
    $("#btn-theme"),
    getEffectiveTheme() === "light" ? Icons.moon : Icons.sun,
  );
  _setHTML($("#btn-settings"), Icons.settings);
  _setHTML($("#btn-generate-icon"), Icons.send);
  _setHTML($("#scene-select-chevron"), Icons.chevronDown);
  _setHTML($("#picker-search-icon"), Icons.search);
  _setHTML(
    $("#empty-icon"),
    Icons.sparkles
      .replace('width="16"', 'width="36"')
      .replace('height="16"', 'height="36"')
      .replace('stroke-width="2"', 'stroke-width="1.5"'),
  );
  // History panel icons
  _setHTML($("#btn-history-back"), Icons.arrowLeft);
  _setHTML($("#btn-history-clear"), Icons.trash);
  _setHTML($("#history-search-icon"), Icons.search);
  // Scene modal icons
  _setHTML($("#btn-scenes-close"), Icons.close);
  _setHTML($("#scenes-search-icon"), Icons.search);
}

/* ═══ Input Events ═══ */
function bindInputEvents() {
  const textarea = $("#input-text");
  textarea.addEventListener("input", () => {
    updateCharCount();
    updateGenerateButton();
    _savePopupState();
  });
}

function updateCharCount() {
  const len = ($("#input-text").value || "").length;
  $("#char-count").textContent = `${len} / 10000`;
}

function updateGenerateButton() {
  const text = ($("#input-text").value || "").trim();
  const hasValidText = Router.isValidInput(text);
  $("#btn-generate").disabled = !hasValidText && !isGenerating;
}

/* ═══ 3D Tilt Effect on Input ═══ */
function bindTiltEffect() {
  const wrap = $(".input-area__textarea-wrap");
  const MAX_TILT = 3; // degrees
  wrap.addEventListener("mousemove", (e) => {
    const rect = wrap.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const tiltX = (0.5 - y) * MAX_TILT * 2;
    const tiltY = (x - 0.5) * MAX_TILT * 2;
    wrap.style.transition = "none";
    wrap.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  });
  wrap.addEventListener("mouseleave", () => {
    wrap.style.transition = "";
    wrap.style.transform = "";
  });
}

/* ═══ Header Events ═══ */
function bindHeaderEvents() {
  // Clear button — reset all input/output state
  $("#btn-clear").addEventListener("click", async () => {
    if (isGenerating) cancelGeneration();
    $("#input-text").value = "";
    _currentOutputText = "";
    _currentOutputScenes = [];
    _currentOutputComposite = false;
    selectedScene = null;
    updateCharCount();
    updateGenerateButton();
    updateSceneButton();
    hideStatus();
    $$(".scene-tag").forEach((t) => t.classList.remove("is-active"));
    // Hide output, show empty state — with transition
    const outputArea = $("#output-area");
    const emptyState = $("#empty-state");
    if (!outputArea.hidden) {
      outputArea.classList.remove("is-entering");
      outputArea.classList.add("is-leaving");
      outputArea.addEventListener(
        "animationend",
        () => {
          outputArea.hidden = true;
          outputArea.classList.remove("is-leaving");
          emptyState.hidden = false;
          emptyState.classList.remove("is-entering");
          void emptyState.offsetWidth;
          emptyState.classList.add("is-entering");
        },
        { once: true },
      );
    } else {
      emptyState.hidden = false;
    }
    // Clear session state
    await Storage.clearPopupState();
    showToast("已清除", "success");
    $("#input-text").focus();
  });

  // Theme toggle — circular reveal with CSS mask
  $("#btn-theme").addEventListener("click", async () => {
    const current = getEffectiveTheme();
    const next = current === "light" ? "dark" : "light";
    const btn = $("#btn-theme");
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = Math.ceil(
      Math.hypot(
        Math.max(cx, document.body.clientWidth - cx),
        Math.max(cy, document.body.clientHeight - cy),
      ),
    );
    // Capture old bg before switching
    const oldBg = getComputedStyle(document.body).backgroundColor;
    // Apply new theme immediately — content updates
    document.documentElement.setAttribute("data-theme", next);
    _setHTML(btn, next === "light" ? Icons.moon : Icons.sun);
    await Storage.saveTheme(next);
    // Overlay old bg with expanding transparent hole (mask)
    const mask = document.createElement("div");
    mask.className = "theme-reveal-mask";
    mask.style.background = oldBg;
    const grad = `radial-gradient(circle at ${cx}px ${cy}px, transparent var(--hole-r), black var(--hole-r))`;
    mask.style.setProperty("-webkit-mask-image", grad);
    mask.style.setProperty("mask-image", grad);
    document.body.appendChild(mask);
    void mask.offsetWidth; // force initial layout with --hole-r: 0px
    mask.style.setProperty("--hole-r", maxR + "px");
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      mask.remove();
    };
    mask.addEventListener("transitionend", cleanup, { once: true });
    setTimeout(cleanup, 650);
  });

  // History panel
  $("#btn-history").addEventListener("click", () => openHistoryPanel());

  // Settings — open options page
  $("#btn-settings").addEventListener("click", () => {
    if (chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });
}

/* ═══ Generate ═══ */
function bindGenerateEvents() {
  const btn = $("#btn-generate");
  btn.addEventListener("click", () => {
    if (isGenerating) {
      cancelGeneration();
    } else {
      handleGenerate();
    }
  });
}

async function handleGenerate() {
  const text = ($("#input-text").value || "").trim();
  if (!text) return;
  if (text.length > 10000) {
    showToast("输入文本过长（最多 10000 字）", "error");
    return;
  }

  // Load config (merge with builtin defaults)
  let config = await Storage.loadConfig();
  if (!config.apiKey || !config.baseUrl || !config.model) {
    try {
      const defaults = await Defaults.getBuiltinDefaults();
      if (!defaults) throw new Error("no defaults");
      config = {
        baseUrl: config.baseUrl || defaults.baseUrl,
        apiKey: config.apiKey || defaults.apiKey,
        model: config.model || defaults.model,
      };
    } catch (e) {
      showToast("请先在设置中配置 API", "error");
      return;
    }
  }

  // UI → generating state
  isGenerating = true;
  currentAbortController = new AbortController();
  setGenerating(true);

  try {
    let result;
    if (selectedScene) {
      result = await Router.directGenerate(
        config,
        text,
        selectedScene,
        onProgress,
        currentAbortController.signal,
      );
    } else {
      result = await Router.smartRoute(
        config,
        text,
        onProgress,
        currentAbortController.signal,
      );
    }

    const promptOnlyResult = sanitizeEnhancedPrompt(result.result);

    // Show output (prompt-only)
    showOutput(promptOnlyResult, result.scenes, result.composite);

    // Save to history
    const sceneNames = Scenes.getSceneNames();
    const sceneName = result.scenes.map((s) => sceneNames[s] || s).join(" + ");
    const mode = result.composite ? "composite" : "single";
    await Storage.saveHistoryRecord(
      text,
      promptOnlyResult,
      mode,
      result.scenes,
      sceneName,
    );
  } catch (err) {
    if (err.message !== "已取消") {
      showToast(err.message, "error");
    }
  } finally {
    isGenerating = false;
    currentAbortController = null;
    setGenerating(false);
    hideStatus();
  }
}

function cancelGeneration() {
  if (currentAbortController) currentAbortController.abort();
}

function onProgress(stage, message) {
  showStatus(stage, message);
}

function setGenerating(active) {
  const btn = $("#btn-generate");
  if (active) {
    btn.classList.add("is-generating");
    btn.disabled = false;
    _setHTML($("#btn-generate-icon"), Icons.stop);
    $("#btn-generate-text").textContent = "停止";
  } else {
    btn.classList.remove("is-generating");
    _setHTML($("#btn-generate-icon"), Icons.send);
    $("#btn-generate-text").textContent = "生成";
    updateGenerateButton();
  }
}

function showStatus(stage, message) {
  const bar = $("#status-bar");
  bar.hidden = false;
  const icon = $("#status-icon");
  _setHTML(icon, Icons.loader);
  icon.classList.toggle("is-spinning", stage !== "done");
  $("#status-text").textContent = message;
}

function hideStatus() {
  $("#status-bar").hidden = true;
}

function showOutput(text, sceneIds, composite, animate = true) {
  const scenes = Scenes.getSceneNames();
  const badge = sceneIds
    .map((s) => scenes[s] || s)
    .join(composite ? " + " : ", ");

  // Store current output for copy button and state persistence
  _currentOutputText = text;
  _currentOutputScenes = sceneIds;
  _currentOutputComposite = composite;

  // Hide empty state, show output
  $("#empty-state").hidden = true;
  const area = $("#output-area");
  const wasHidden = area.hidden;
  area.hidden = false;
  // Trigger reveal animation only on fresh show (skip on state restore)
  if (wasHidden && animate) {
    area.classList.remove("is-entering");
    void area.offsetWidth; // force reflow
    area.classList.add("is-entering");
    area.addEventListener(
      "animationend",
      () => area.classList.remove("is-entering"),
      { once: true },
    );
  }
  $("#output-scene-badge").textContent = badge;
  $("#output-content").textContent = text;

  // Reset copy button icon (reuse same button, no cloneNode needed)
  _setHTML($("#btn-copy"), Icons.copy);

  // Persist state
  _savePopupState();
}

async function handleCopy(text) {
  try {
    await navigator.clipboard.writeText(text);
    const btn = $("#btn-copy");
    _setHTML(btn, Icons.check);
    btn.classList.add("is-copied");
    showToast("已复制到剪贴板", "success");
    setTimeout(() => {
      _setHTML(btn, Icons.copy);
      btn.classList.remove("is-copied");
    }, 2000);
  } catch {
    showToast("复制失败", "error");
  }
}

function bindCopyButton() {
  _setHTML($("#btn-copy"), Icons.copy);
  $("#btn-copy").addEventListener("click", () => {
    if (_currentOutputText) handleCopy(_currentOutputText);
  });
}

/* ═══ Hot Tags ═══ */
function renderHotTags() {
  const container = $("#hot-tags");
  const scenes = Scenes.getScenes();
  if (!scenes) return;

  for (const sid of Scenes.HOT_SCENES) {
    if (!scenes[sid]) continue;
    const tag = document.createElement("button");
    tag.className = "scene-tag";
    tag.dataset.scene = sid;
    tag.textContent = scenes[sid].name;
    tag.addEventListener("click", () => selectScene(sid));
    container.appendChild(tag);
  }

  // Browse all button
  const browseTag = document.createElement("button");
  browseTag.className = "scene-tag scene-tag--browse";
  _setHTML(browseTag, `${Icons.grid} 全部场景`);
  browseTag.addEventListener("click", () => openScenesModal());
  container.appendChild(browseTag);
}

/* ═══ Scene Picker ═══ */
function bindScenePickerEvents() {
  const btn = $("#btn-scene-select");
  const picker = $("#scene-picker");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    picker.hidden ? openPicker() : closePicker();
  });

  document.addEventListener("click", (e) => {
    if (!picker.contains(e.target) && !btn.contains(e.target)) closePicker();
  });

  $("#picker-search").addEventListener(
    "input",
    debounce((e) => filterPicker(e.target.value), 120),
  );
}

let _pickerCloseTimer = null;

function openPicker() {
  clearTimeout(_pickerCloseTimer);
  _pickerCloseTimer = null;
  const picker = $("#scene-picker");
  const btn = $("#btn-scene-select");
  picker.removeAttribute("hidden");

  // Position absolute picker relative to body
  const rect = btn.getBoundingClientRect();
  const GAP = 6;
  const pickerH = 320;
  const bodyH = document.body.clientHeight;
  const spaceAbove = rect.top - GAP;
  const spaceBelow = bodyH - rect.bottom - GAP;

  if (spaceAbove >= Math.min(pickerH, spaceBelow)) {
    // Show above the button
    picker.style.bottom = bodyH - rect.top + GAP + "px";
    picker.style.top = "auto";
    picker.style.maxHeight = Math.min(pickerH, spaceAbove) + "px";
  } else {
    // Show below the button
    picker.style.top = rect.bottom + GAP + "px";
    picker.style.bottom = "auto";
    picker.style.maxHeight = Math.min(pickerH, spaceBelow) + "px";
  }
  picker.style.left = rect.left + "px";

  btn.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => picker.classList.add("is-visible"));
  });
  setTimeout(() => $("#picker-search").focus(), 50);
}

function closePicker() {
  const picker = $("#scene-picker");
  picker.classList.remove("is-visible");
  $("#btn-scene-select").setAttribute("aria-expanded", "false");
  clearTimeout(_pickerCloseTimer);
  _pickerCloseTimer = setTimeout(() => {
    _pickerCloseTimer = null;
    picker.setAttribute("hidden", "");
    $("#picker-search").value = "";
    filterPicker("");
  }, 200);
}

function renderScenePicker() {
  const list = $("#picker-list");
  list.replaceChildren();
  const scenes = Scenes.getScenes();
  if (!scenes) return;

  // Auto item
  const autoItem = document.createElement("div");
  autoItem.className = "dropdown__item";
  autoItem.dataset.scene = "";
  const autoName = document.createElement("span");
  autoName.className = "dropdown__item-name";
  autoName.textContent = "智能识别（自动）";
  const autoDesc = document.createElement("span");
  autoDesc.className = "dropdown__item-desc";
  autoDesc.textContent = "AI 自动分析意图并选择最佳场景";
  autoItem.appendChild(autoName);
  autoItem.appendChild(autoDesc);
  list.appendChild(autoItem);

  for (const cat of Scenes.SCENE_CATEGORIES) {
    for (const sid of cat.scenes) {
      if (!scenes[sid]) continue;
      const s = scenes[sid];
      const item = document.createElement("div");
      item.className = "dropdown__item";
      item.dataset.scene = sid;
      item.dataset.search =
        `${s.name} ${s.nameEn} ${s.keywords.join(" ")}`.toLowerCase();
      item.setAttribute("role", "option");
      const nameEl = document.createElement("span");
      nameEl.className = "dropdown__item-name";
      nameEl.textContent = s.name;
      const descEl = document.createElement("span");
      descEl.className = "dropdown__item-desc";
      descEl.textContent = s.description;
      item.appendChild(nameEl);
      item.appendChild(descEl);
      list.appendChild(item);
    }
  }

  // P01: Event delegation for picker list
  list.addEventListener("click", (e) => {
    const item = e.target.closest(".dropdown__item");
    if (!item) return;
    const sid = item.dataset.scene;
    selectScene(sid || null);
    closePicker();
  });
}

function filterPicker(query) {
  const q = query.toLowerCase().trim();
  $$("#picker-list .dropdown__item").forEach((item) => {
    if (!item.dataset.scene) {
      item.style.display = "";
      return;
    }
    const match = !q || (item.dataset.search || "").includes(q);
    item.style.display = match ? "" : "none";
  });
}

function selectScene(sceneId, skipSave = false) {
  selectedScene = sceneId;
  $$(".scene-tag").forEach((t) =>
    t.classList.toggle("is-active", t.dataset.scene === sceneId),
  );
  updateSceneButton();
  if (!skipSave) _savePopupState();
}

function updateSceneButton() {
  const btn = $("#btn-scene-select");
  const label = $("#scene-select-label");
  if (selectedScene) {
    const scenes = Scenes.getScenes();
    label.textContent = scenes[selectedScene]?.name || selectedScene;
    btn.classList.add("has-scene");
  } else {
    label.textContent = "智能识别";
    btn.classList.remove("has-scene");
  }
}

/* ═══ Scenes Browser Modal ═══ */
function bindScenesModalEvents() {
  $("#btn-scenes-close").addEventListener("click", closeScenesModal);
  $(".modal__backdrop").addEventListener("click", closeScenesModal);
  $("#scenes-search").addEventListener(
    "input",
    debounce((e) => filterSceneBrowser(e.target.value), 120),
  );
}

function openScenesModal() {
  const modal = $("#scenes-modal");
  _clearCloseTimers(modal);
  modal.classList.remove("is-leaving");
  $("#main-view").classList.add("is-behind");
  modal.hidden = false;
  _replayRiseIn(modal.querySelector(".modal__content"));
  setTimeout(() => $("#scenes-search").focus(), 100);

  // A02: Focus trap within modal
  modal._focusTrap = (e) => {
    if (e.key === "Escape") {
      e.stopImmediatePropagation(); // 阻止同一元素上的其他 keydown listener 重复调用 closeScenesModal
      closeScenesModal();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener("keydown", modal._focusTrap);
}

function closeScenesModal() {
  const modal = $("#scenes-modal");
  if (modal.hidden || modal.classList.contains("is-leaving")) return;
  modal.classList.add("is-leaving");
  _scheduleFlipMidSwitch(modal, {
    onRevealFront: () => {
      $("#main-view").classList.remove("is-behind");
      _replayRiseIn($("#main-view"));
    },
    onAfterClose: () => {
      $("#scenes-search").value = "";
      filterSceneBrowser("");
      if (modal._focusTrap) {
        document.removeEventListener("keydown", modal._focusTrap);
        modal._focusTrap = null;
      }
    },
  });
}

function renderSceneBrowser() {
  const container = $("#scenes-list");
  container.replaceChildren();
  const scenes = Scenes.getScenes();
  if (!scenes) return;

  for (const cat of Scenes.SCENE_CATEGORIES) {
    const catEl = document.createElement("div");
    catEl.className = "scene-category";
    catEl.dataset.category = cat.id;
    const title = document.createElement("div");
    title.className = "scene-category__title";
    title.textContent = cat.name;
    catEl.appendChild(title);
    const grid = document.createElement("div");
    grid.className = "scene-category__grid";

    for (const sid of cat.scenes) {
      if (!scenes[sid]) continue;
      const s = scenes[sid];
      const card = document.createElement("div");
      card.className = "scene-card";
      card.setAttribute("role", "button");
      card.dataset.scene = sid;
      card.dataset.search =
        `${s.name} ${s.nameEn} ${s.keywords.join(" ")} ${s.description}`.toLowerCase();
      const nameEl = document.createElement("div");
      nameEl.className = "scene-card__name";
      nameEl.textContent = s.name;
      const nameEnEl = document.createElement("div");
      nameEnEl.className = "scene-card__name-en";
      nameEnEl.textContent = s.nameEn;
      const descEl = document.createElement("div");
      descEl.className = "scene-card__desc";
      descEl.textContent = s.description;
      card.appendChild(nameEl);
      card.appendChild(nameEnEl);
      card.appendChild(descEl);
      grid.appendChild(card);
    }

    catEl.appendChild(grid);
    container.appendChild(catEl);
  }

  // P01: Event delegation for scene browser
  container.addEventListener("click", (e) => {
    const card = e.target.closest(".scene-card");
    if (!card) return;
    const sid = card.dataset.scene;
    if (sid) {
      selectScene(sid);
      closeScenesModal();
    }
  });
}

function filterSceneBrowser(query) {
  const q = query.toLowerCase().trim();
  $$("#scenes-list .scene-card").forEach((card) => {
    card.style.display = !q || card.dataset.search.includes(q) ? "" : "none";
  });
  $$("#scenes-list .scene-category").forEach((cat) => {
    const visible = cat.querySelectorAll(
      '.scene-card:not([style*="display: none"])',
    );
    cat.style.display = visible.length > 0 ? "" : "none";
  });
}

/* ─── Persona Tabs ─── */
let activePersona = "all";

function renderPersonaTabs() {
  const container = $("#persona-tabs");
  container.replaceChildren();

  for (const persona of Scenes.PERSONAS) {
    const tab = document.createElement("button");
    tab.className =
      "persona-tab" + (persona.id === activePersona ? " is-active" : "");
    tab.dataset.persona = persona.id;
    tab.setAttribute("aria-label", persona.name);
    const icon = Icons.persona[persona.id];
    if (icon) {
      const frag = _htmlParser.parseFromString(icon, "text/html").body;
      tab.appendChild(document.adoptNode(frag.firstChild));
    }
    tab.appendChild(document.createTextNode(persona.name));
    container.appendChild(tab);
  }

  // P01: Event delegation for persona tabs
  container.addEventListener("click", (e) => {
    const tab = e.target.closest(".persona-tab");
    if (!tab) return;
    const personaId = tab.dataset.persona;
    activePersona = personaId;
    $$(".persona-tab").forEach((t) =>
      t.classList.toggle("is-active", t.dataset.persona === personaId),
    );
    filterByPersona(personaId);
  });
}

function filterByPersona(personaId) {
  const persona = Scenes.PERSONAS.find((p) => p.id === personaId);
  const categories = persona && persona.categories;
  $$("#scenes-list .scene-category").forEach((catEl) => {
    catEl.style.display =
      !categories || categories.includes(catEl.dataset.category) ? "" : "none";
  });
}

/* ═══ History Panel ═══ */
function bindHistoryEvents() {
  $("#btn-history-back").addEventListener("click", closeHistoryPanel);
  $("#btn-history-clear").addEventListener("click", async () => {
    await Storage.clearHistory();
    renderHistoryList([]);
    showToast("历史已清空", "success");
  });
  $("#history-search").addEventListener(
    "input",
    debounce((e) => {
      _historyQuery = (e.target.value || "").trim();
      renderHistoryList(_historyData);
    }, 100),
  );
  bindHistoryListDelegation();
}

async function openHistoryPanel() {
  const records = await Storage.loadHistory();
  _historyQuery = "";
  _historyExpandedId = null;
  $("#history-search").value = "";
  renderHistoryList(records);
  const panel = $("#history-panel");
  _clearCloseTimers(panel);
  panel.classList.remove("is-leaving");
  $("#main-view").classList.add("is-behind");
  panel.hidden = false;
  _replayRiseIn(panel);
}

function closeHistoryPanel() {
  const panel = $("#history-panel");
  if (panel.hidden || panel.classList.contains("is-leaving")) return;
  panel.classList.add("is-leaving");
  _scheduleFlipMidSwitch(panel, {
    onRevealFront: () => {
      $("#main-view").classList.remove("is-behind");
      _replayRiseIn($("#main-view"));
    },
  });
}

function sanitizeEnhancedPrompt(text) {
  const raw = (text || "").trim();
  if (!raw) return "";
  const markers = [
    /(?:^|\n)\s*(?:assistant|ai)\s*[:：]/i,
    /(?:^|\n)\s*(?:回答|回复|response)\s*[:：]/i,
    /(?:^|\n)\s*#{1,3}\s*(?:assistant|ai|回答|response)\b/i,
  ];
  let cut = -1;
  for (const re of markers) {
    const m = raw.match(re);
    if (m && typeof m.index === "number" && m.index > 60) {
      cut = cut === -1 ? m.index : Math.min(cut, m.index);
    }
  }
  return cut > 0 ? raw.slice(0, cut).trim() : raw;
}

function formatHistoryDateKey(timestamp) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function formatHistoryDateLabel(dateKey) {
  const now = new Date();
  const todayKey = formatHistoryDateKey(now.getTime());
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = formatHistoryDateKey(yesterday.getTime());
  if (dateKey === todayKey) return "今天";
  if (dateKey === yesterdayKey) return "昨天";
  const [y, m, d] = dateKey.split("-");
  return `${y}年${m}月${d}日`;
}

function renderHistoryList(records) {
  const list = $("#history-list");
  const empty = $("#history-empty");
  list.replaceChildren();

  // 存储记录数据供事件委托使用
  _historyData = records || [];

  const q = (_historyQuery || "").toLowerCase();
  const filtered = _historyData.filter((rec) => {
    if (!q) return true;
    const haystack =
      `${rec.sceneName || ""}\n${rec.originalText || ""}\n${sanitizeEnhancedPrompt(rec.enhancedText || "")}`.toLowerCase();
    return haystack.includes(q);
  });

  if (!filtered.length) {
    empty.hidden = false;
    empty.textContent = _historyQuery ? "未找到匹配历史" : "暂无历史记录";
    list.hidden = true;
    _historyExpandedId = null;
    return;
  }

  const visibleIds = new Set(filtered.map((r) => r.id));
  if (_historyExpandedId && !visibleIds.has(_historyExpandedId)) {
    _historyExpandedId = null;
  }

  empty.hidden = true;
  empty.textContent = "暂无历史记录";
  list.hidden = false;

  const sorted = [...filtered].sort(
    (a, b) => (b.timestamp || 0) - (a.timestamp || 0),
  );
  const grouped = new Map();
  for (const rec of sorted) {
    const key = formatHistoryDateKey(rec.timestamp);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(rec);
  }

  for (const [dateKey, items] of grouped.entries()) {
    const groupEl = document.createElement("section");
    groupEl.className = "history-group";

    const headerEl = document.createElement("div");
    headerEl.className = "history-group__header";
    _setHTML(
      headerEl,
      `<span class="history-group__title">${escapeHtml(formatHistoryDateLabel(dateKey))}</span><span class="history-group__line"></span>`,
    );
    groupEl.appendChild(headerEl);

    for (const rec of items) {
      const card = document.createElement("div");
      const isExpanded = _historyExpandedId === rec.id;
      card.className = "history-card" + (isExpanded ? " is-expanded" : "");
      card.dataset.id = rec.id;
      const time = new Date(rec.timestamp).toLocaleString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const original = rec.originalText || "";
      const enhanced = sanitizeEnhancedPrompt(rec.enhancedText || "");
      _setHTML(
        card,
        `
      <div class="history-card__header">
        <span class="history-card__scene">${escapeHtml(rec.sceneName || "智能")}</span>
        <span class="history-card__time">${escapeHtml(time)}</span>
      </div>
      <div class="history-card__block">
        <div class="history-card__label">用户输入</div>
        <div class="history-card__text history-card__text--clamp">${escapeHtml(original)}</div>
      </div>
      <div class="history-card__block">
        <div class="history-card__label">扩写结果</div>
        <div class="history-card__text history-card__text--clamp">${escapeHtml(enhanced)}</div>
        <div class="history-card__enhanced-full"><div class="history-card__enhanced-full-inner">${escapeHtml(enhanced)}</div></div>
      </div>
      <div class="history-card__actions">
        <button class="icon-btn icon-btn--sm history-card__toggle ${isExpanded ? "is-open" : ""}" data-action="toggle" title="${isExpanded ? "收起详情" : "展开详情"}" aria-label="${isExpanded ? "收起详情" : "展开详情"}">${Icons.chevronDown}</button>
        <button class="icon-btn icon-btn--sm" data-action="apply" title="应用到正面" aria-label="应用到正面">${Icons.externalLink}</button>
        <button class="icon-btn icon-btn--sm" data-action="copy" title="复制结果" aria-label="复制结果">${Icons.copy}</button>
        <button class="icon-btn icon-btn--sm icon-btn--danger" data-action="delete" title="删除" aria-label="删除">${Icons.trash}</button>
      </div>`,
      );
      groupEl.appendChild(card);
    }

    list.appendChild(groupEl);
  }
}

function updateHistoryExpandedState(listEl) {
  listEl.querySelectorAll(".history-card").forEach((card) => {
    const id = card.dataset.id;
    const isExpanded = _historyExpandedId === id;
    card.classList.toggle("is-expanded", isExpanded);

    const toggleBtn = card.querySelector('[data-action="toggle"]');
    if (toggleBtn) {
      toggleBtn.classList.toggle("is-open", isExpanded);
      toggleBtn.title = isExpanded ? "收起详情" : "展开详情";
      toggleBtn.setAttribute(
        "aria-label",
        isExpanded ? "收起详情" : "展开详情",
      );
    }

    const fullEl = card.querySelector(".history-card__enhanced-full");
    if (fullEl) fullEl.style.removeProperty("--expanded-h");
  });
}

/**
 * 历史列表事件委托（绑定在 #history-list 上, 一次性注册）
 */
function bindHistoryListDelegation() {
  const list = $("#history-list");
  list.addEventListener("click", async (e) => {
    const card = e.target.closest(".history-card");
    if (!card) return;
    const id = card.dataset.id;
    const rec = _historyData.find((r) => r.id === id);
    if (!rec) return;

    const actionEl = e.target.closest("[data-action]");
    const action =
      actionEl && card.contains(actionEl) ? actionEl.dataset.action : null;
    if (action === "toggle") {
      e.stopPropagation();
      _historyExpandedId = _historyExpandedId === id ? null : id;
      updateHistoryExpandedState(list);
    } else if (action === "apply") {
      e.stopPropagation();
      closeHistoryPanel();
      const enhanced = sanitizeEnhancedPrompt(rec.enhancedText || "");
      showOutput(enhanced, rec.sceneIds || [], rec.mode === "composite");
    } else if (action === "copy") {
      e.stopPropagation();
      handleCopy(sanitizeEnhancedPrompt(rec.enhancedText || ""));
    } else if (action === "delete") {
      e.stopPropagation();
      await Storage.deleteHistoryRecord(id);
      _historyData = _historyData.filter((r) => r.id !== id);
      if (_historyExpandedId === id) _historyExpandedId = null;
      renderHistoryList(_historyData);
    } else {
      // 卡片主体点击不触发跳转，避免误触
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ═══ Keyboard Shortcuts ═══ */
function bindKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Ctrl+Enter = Generate
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (isGenerating) cancelGeneration();
      else handleGenerate();
      return;
    }
    // Escape = close panels/modals
    if (e.key === "Escape") {
      closePicker();
      if (!$("#history-panel").hidden) closeHistoryPanel();
      if (!$("#scenes-modal").hidden) closeScenesModal();
    }
  });
}

/* ═══ Toast ═══ */
function showToast(message, type = "info") {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className =
    "toast" +
    (type === "error" ? " is-error" : type === "success" ? " is-success" : "");
  toast.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.hidden = true;
  }, 3000);
}
