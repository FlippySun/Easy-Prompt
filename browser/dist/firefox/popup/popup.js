/**
 * Easy Prompt Browser Extension — Popup Logic
 * 主界面交互：输入 → 智能路由/指定场景 → 生成 Prompt → 历史
 */

/* ─── State ─── */
let isGenerating = false;
let currentAbortController = null;
let selectedScene = null;
let _historyData = []; // 事件委托用, 避免每张卡片创建闭包
let _currentOutputText = ""; // P02: 共享变量存储当前输出文本, 避免每次重建 copy button
let _currentOutputScenes = []; // 用于状态持久化
let _currentOutputComposite = false; // 用于状态持久化

/* ─── DOM ─── */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ─── Utils ─── */
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/* ─── State Persistence ─── */
const _savePopupState = debounce(async () => {
  await Storage.savePopupState({
    inputText: ($("#input-text").value || "").trim() ? $("#input-text").value : "",
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
          selectScene(saved.selectedScene);
        }
        if (saved.outputText) {
          showOutput(saved.outputText, saved.outputScenes || [], saved.outputComposite || false);
        }
      }
    } catch {
      /* state restore failed — ignore */
    }
  }
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
  $("#logo-icon").innerHTML = Icons.sparkles;
  $("#btn-clear").innerHTML = Icons.eraser;
  $("#btn-history").innerHTML = Icons.history;
  $("#btn-theme").innerHTML =
    getEffectiveTheme() === "light" ? Icons.moon : Icons.sun;
  $("#btn-settings").innerHTML = Icons.settings;
  $("#btn-generate-icon").innerHTML = Icons.send;
  $("#scene-select-chevron").innerHTML = Icons.chevronDown;
  $("#picker-search-icon").innerHTML = Icons.search;
  $("#empty-icon").innerHTML = Icons.sparkles
    .replace('width="16"', 'width="36"')
    .replace('height="16"', 'height="36"')
    .replace('stroke-width="2"', 'stroke-width="1.5"');
  // History panel icons
  $("#btn-history-back").innerHTML = Icons.arrowLeft;
  $("#btn-history-clear").innerHTML = Icons.trash;
  // Scene modal icons
  $("#btn-scenes-close").innerHTML = Icons.close;
  $("#scenes-search-icon").innerHTML = Icons.search;
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
  const hasText = ($("#input-text").value || "").trim().length > 0;
  $("#btn-generate").disabled = !hasText && !isGenerating;
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
    $$(".scene-tag").forEach((t) => t.classList.remove("is-active"));
    // Hide output, show empty state
    $("#output-area").hidden = true;
    $("#empty-state").hidden = false;
    // Clear session state
    await Storage.clearPopupState();
    showToast("已清除", "success");
    $("#input-text").focus();
  });

  // Theme toggle
  $("#btn-theme").addEventListener("click", async () => {
    const current = getEffectiveTheme();
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    await Storage.saveTheme(next);
    $("#btn-theme").innerHTML = next === "light" ? Icons.moon : Icons.sun;
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

    // Show output
    showOutput(result.result, result.scenes, result.composite);

    // Save to history
    const scenes = Scenes.getScenes();
    const sceneNames = Scenes.getSceneNames();
    const sceneName = result.scenes.map((s) => sceneNames[s] || s).join(" + ");
    const mode = result.composite ? "composite" : "single";
    await Storage.saveHistoryRecord(
      text,
      result.result,
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
    $("#btn-generate-icon").innerHTML = Icons.stop;
    $("#btn-generate-text").textContent = "停止";
  } else {
    btn.classList.remove("is-generating");
    $("#btn-generate-icon").innerHTML = Icons.send;
    $("#btn-generate-text").textContent = "生成";
    updateGenerateButton();
  }
}

function showStatus(stage, message) {
  const bar = $("#status-bar");
  bar.hidden = false;
  const icon = $("#status-icon");
  icon.innerHTML = Icons.loader;
  icon.classList.toggle("is-spinning", stage !== "done");
  $("#status-text").textContent = message;
}

function hideStatus() {
  $("#status-bar").hidden = true;
}

function showOutput(text, sceneIds, composite) {
  const scenes = Scenes.getSceneNames();
  const badge = sceneIds
    .map((s) => scenes[s] || s)
    .join(composite ? " + " : "");

  // Store current output for copy button and state persistence
  _currentOutputText = text;
  _currentOutputScenes = sceneIds;
  _currentOutputComposite = composite;

  // Hide empty state, show output
  $("#empty-state").hidden = true;
  const area = $("#output-area");
  const wasHidden = area.hidden;
  area.hidden = false;
  // Trigger reveal animation only on fresh show
  if (wasHidden) {
    area.classList.remove("is-entering");
    void area.offsetWidth; // force reflow
    area.classList.add("is-entering");
  }
  $("#output-scene-badge").textContent = badge;
  $("#output-content").textContent = text;

  // Reset copy button icon (reuse same button, no cloneNode needed)
  $("#btn-copy").innerHTML = Icons.copy;

  // Persist state
  _savePopupState();
}

async function handleCopy(text) {
  try {
    await navigator.clipboard.writeText(text);
    const btn = $("#btn-copy");
    btn.innerHTML = Icons.check;
    btn.classList.add("is-copied");
    showToast("已复制到剪贴板", "success");
    setTimeout(() => {
      btn.innerHTML = Icons.copy;
      btn.classList.remove("is-copied");
    }, 2000);
  } catch {
    showToast("复制失败", "error");
  }
}

function bindCopyButton() {
  $("#btn-copy").innerHTML = Icons.copy;
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
  browseTag.innerHTML = `${Icons.grid} 全部场景`;
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

function openPicker() {
  const picker = $("#scene-picker");
  picker.hidden = false;
  $("#btn-scene-select").setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => picker.classList.add("is-visible"));
  setTimeout(() => $("#picker-search").focus(), 50);
}

function closePicker() {
  const picker = $("#scene-picker");
  picker.classList.remove("is-visible");
  $("#btn-scene-select").setAttribute("aria-expanded", "false");
  setTimeout(() => {
    picker.hidden = true;
    $("#picker-search").value = "";
    filterPicker("");
  }, 200);
}

function renderScenePicker() {
  const list = $("#picker-list");
  list.innerHTML = "";
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

function selectScene(sceneId) {
  selectedScene = sceneId;
  $$(".scene-tag").forEach((t) =>
    t.classList.toggle("is-active", t.dataset.scene === sceneId),
  );
  updateSceneButton();
  _savePopupState();
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
  modal.hidden = false;
  setTimeout(() => $("#scenes-search").focus(), 100);

  // A02: Focus trap within modal
  modal._focusTrap = (e) => {
    if (e.key === "Escape") {
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
  modal.classList.add("is-leaving");
  const onEnd = () => {
    modal.hidden = true;
    modal.classList.remove("is-leaving");
    $("#scenes-search").value = "";
    filterSceneBrowser("");
    if (modal._focusTrap) {
      document.removeEventListener("keydown", modal._focusTrap);
      modal._focusTrap = null;
    }
  };
  modal.addEventListener("animationend", onEnd, { once: true });
}

function renderSceneBrowser() {
  const container = $("#scenes-list");
  container.innerHTML = "";
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
  container.innerHTML = "";

  for (const persona of Scenes.PERSONAS) {
    const tab = document.createElement("button");
    tab.className =
      "persona-tab" + (persona.id === activePersona ? " is-active" : "");
    tab.dataset.persona = persona.id;
    tab.setAttribute("aria-label", persona.name);
    const icon = Icons.persona[persona.id];
    if (icon) tab.insertAdjacentHTML("beforeend", icon);
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
  bindHistoryListDelegation();
}

async function openHistoryPanel() {
  const records = await Storage.loadHistory();
  renderHistoryList(records);
  $("#history-panel").hidden = false;
}

function closeHistoryPanel() {
  const panel = $("#history-panel");
  panel.classList.add("is-leaving");
  panel.addEventListener(
    "animationend",
    () => {
      panel.hidden = true;
      panel.classList.remove("is-leaving");
    },
    { once: true },
  );
}

function renderHistoryList(records) {
  const list = $("#history-list");
  const empty = $("#history-empty");
  list.innerHTML = "";

  // 存储记录数据供事件委托使用
  _historyData = records || [];

  if (!_historyData.length) {
    empty.hidden = false;
    list.hidden = true;
    return;
  }
  empty.hidden = true;
  list.hidden = false;

  for (const rec of _historyData) {
    const card = document.createElement("div");
    card.className = "history-card";
    card.dataset.id = rec.id;
    const time = new Date(rec.timestamp).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    card.innerHTML = `
      <div class="history-card__header">
        <span class="history-card__scene">${escapeHtml(rec.sceneName || "智能")}</span>
        <span class="history-card__time">${time}</span>
      </div>
      <div class="history-card__original">${escapeHtml(rec.originalText || "")}</div>
      <div class="history-card__actions">
        <button class="icon-btn icon-btn--sm" data-action="copy" title="复制结果" aria-label="复制结果">${Icons.copy}</button>
        <button class="icon-btn icon-btn--sm icon-btn--danger" data-action="delete" title="删除" aria-label="删除">${Icons.trash}</button>
      </div>`;
    list.appendChild(card);
  }
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
    if (action === "copy") {
      e.stopPropagation();
      handleCopy(rec.enhancedText || "");
    } else if (action === "delete") {
      e.stopPropagation();
      await Storage.deleteHistoryRecord(id);
      _historyData = _historyData.filter((r) => r.id !== id);
      card.remove();
      if (!list.querySelectorAll(".history-card").length) {
        $("#history-empty").hidden = false;
        list.hidden = true;
      }
    } else {
      // Click card → reuse result
      closeHistoryPanel();
      showOutput(
        rec.enhancedText || "",
        rec.sceneIds || [],
        rec.mode === "composite",
      );
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
