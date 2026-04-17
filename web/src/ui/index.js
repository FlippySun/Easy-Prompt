/**
 * Easy Prompt Web — UI 控制器
 * 2026-04-13 Vite 迁移：从 app.js §8 提取为独立 ESM 模块
 *
 * [类型]     重构（模块化）
 * [描述]     将 UI 控制器逻辑（事件绑定、渲染、交互）提取为独立模块
 * [影响范围] main.js（initApp 调用）
 * [潜在风险] 无已知风险
 */

import {
  $,
  $$,
  escapeHtml,
  showToast,
  openPanel,
  closePanel,
  openModal,
  closeModal,
} from "./helpers.js";

import {
  initCursorLight,
  initButtonRipples,
  initCardSpotlight,
  initScrollReveal,
  initCardTilt,
} from "./effects.js";

import {
  MAX_INPUT_LENGTH,
  SCENE_CATEGORIES,
  HOT_SCENES,
  PERSONAS,
  ENHANCE_MODES,
  DEFAULT_ENHANCE_MODE,
  DEFAULT_API_PATHS,
  MODEL_LIST,
} from "../constants.js";

import {
  THEME_KEY,
  loadConfig,
  saveConfig,
  getEffectiveConfig,
  _splitBaseUrl,
  loadHistory,
  saveHistoryRecord,
  deleteHistoryRecord,
  clearHistory,
  formatHistoryTime,
} from "../config.js";

import { SCENES, SCENE_NAMES } from "../scenes.js";

// --- 2026-04-13 Skill 浮窗：导入 skill 数据层（含 WC 注册 + CSS 注入）---
import {
  SKILLS,
  loadSkills,
  shouldRefreshSkillsOnPanelOpen,
  SKILL_TYPE_MAP,
  SKILL_ICON_MAP,
  FOLDER_ICON_SVG,
} from "../skill.js";

import { testApiConfig, fetchModels, detectApiMode } from "../api.js";

import {
  isAuthenticated,
  ssoLogin,
  ssoLogout,
  openProfilePage,
  handleSsoCallbackOnLoad,
  onSsoStateChange,
  onSsoStorageChange,
  updateSsoUI,
  SSO_KEYS,
  scheduleSsoRefresh,
  dualTrackEnhance,
} from "../backend.js";

/* ─── State ─── */

let isGenerating = false;
let currentAbortController = null;
let selectedScene = null;
let activePersona = "all";

// --- 2026-04-13 Skill 浮窗状态 ---
let _skillPanel = null; // <ep-skill-panel> 实例引用
let _skillSlashIndex = -1; // 2026-04-13 修复：记录触发 "/" 在文本中的位置（光标感知）
let _disposeSkillSsoSync = null;
let _disposeSkillStorageSync = null;

/* ─── Init ─── */

export function initApp() {
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

  // Initialize visual effects
  initCursorLight();
  initButtonRipples();
  initCardSpotlight();
  initScrollReveal();
  initCardTilt();

  // 2026-04-13 Skill 浮窗初始化
  initSkillPanel();

  // 2026-04-16 新增 — Skill 面板与 SSO 登录态刷新桥接
  bindSkillPanelSsoSync();
  bindSkillPanelStorageSync();
  void bootstrapSsoStateAndSkills();
}

/**
 * 2026-04-16 新增 — Web SSO 启动阶段与 Skill 数据同步
 * 变更类型：新增/兼容
 * 功能描述：在页面初始化时统一处理 SSO 回调恢复、登录 UI 恢复、定时刷新恢复与 skill 数据真实拉取。
 * 设计思路：
 *   1. 继续保持 initApp 同步入口不变，异步部分单独收敛到 bootstrapSsoStateAndSkills()。
 *   2. handleSsoCallbackOnLoad() 完成 code exchange 后，复用同一 skill 刷新逻辑更新面板数据。
 *   3. 若后端 skill proxy 失败，loadSkills() 会自动回退 mock，不阻断页面初始化。
 * 参数与返回值：bootstrapSsoStateAndSkills() 无参数；返回 Promise<void>。
 * 影响范围：web/src/ui/index.js 的 Skill 面板初始化、SSO 回调恢复、登录态切换后的数据刷新。
 * 潜在风险：无已知风险。
 */
async function bootstrapSsoStateAndSkills() {
  await handleSsoCallbackOnLoad();
  updateSsoUI();
  const savedExpiry = localStorage.getItem(SSO_KEYS.EXPIRES_AT);
  if (savedExpiry) {
    scheduleSsoRefresh(Number(savedExpiry));
  }
  await refreshSkillPanelSkills({ forceRefresh: true });
}

/**
 * 2026-04-16 新增 — Skill 面板订阅 SSO 状态变化
 * 变更类型：新增/兼容
 * 功能描述：在登录/退出导致本地 SSO 状态变化后，刷新 Skill 面板使用的后端数据源。
 * 设计思路：
 *   1. 仅建立一次订阅，避免 initApp 重入时重复绑定事件造成多次请求。
 *   2. 订阅回调只做 forceRefresh，不直接操作 token，保持鉴权来源仍在 skill.js 内部。
 *   3. 保持 shared-ui/skill-panel.js 完全不动，避免破坏既有隐藏态与防闪烁约束。
 * 参数与返回值：bindSkillPanelSsoSync() 无参数；无返回值。
 * 影响范围：web/src/ui/index.js、web/src/backend.js 的 SSO 状态广播链路。
 * 潜在风险：无已知风险。
 */
function bindSkillPanelSsoSync() {
  if (_disposeSkillSsoSync) {
    return;
  }
  _disposeSkillSsoSync = onSsoStateChange(() => {
    void refreshSkillPanelSkills({ forceRefresh: true });
  });
}

/**
 * 2026-04-16 新增 — Skill 面板订阅跨标签页 SSO storage 变化
 * 变更类型：新增/兼容
 * 功能描述：激活 Web 端 `storage` 监听桥接，让其他标签页登录/退出/refresh 后当前页的 skill 面板也能收到刷新事件。
 * 设计思路：
 *   1. `onSsoStorageChange()` 内部会把跨 tab storage 变化转成既有 `ep:sso-state-change` 事件，这里只负责确保桥接监听被注册一次。
 *   2. 不在这里重复直接刷新 skill，避免与 `bindSkillPanelSsoSync()` 双重触发同一轮 forceRefresh。
 * 参数与返回值：bindSkillPanelStorageSync() 无参数；无返回值。
 * 影响范围：web/src/ui/index.js、web/src/backend.js 的跨标签页登录态同步。
 * 潜在风险：无已知风险。
 */
function bindSkillPanelStorageSync() {
  if (_disposeSkillStorageSync) {
    return;
  }
  _disposeSkillStorageSync = onSsoStorageChange();
}

/* ─── Header ─── */

function bindHeaderEvents() {
  $("#btn-theme").addEventListener("click", toggleTheme);
  $("#btn-settings").addEventListener("click", () => openPanel("settings"));
  $("#btn-scenes-browser").addEventListener("click", () => openModal("scenes"));

  // 2026-04-17 修复 — SSO 按钮改为"主按钮 + Chevron 下拉菜单"模式
  // 变更类型：修复 / 交互
  // 功能描述：
  //   1. 主按钮 #btn-sso：未登录 → 触发登录；已登录 → 打开 Web-Hub 个人主页。
  //      （替代旧版"已登录点击即 logout"的误导行为，根除跨端交互分叉。）
  //   2. Chevron 按钮 #btn-sso-menu：仅在已登录时显示，点击切换下拉菜单。
  //   3. 菜单项 #btn-sso-profile / #btn-sso-logout：分别承载"跳个人主页"与"显式退出"。
  //   4. 点击菜单外部 / 按 Escape → 自动关闭菜单并恢复焦点。
  // 设计思路：
  //   - 登录态真相统一来自 isAuthenticated()，handler 内部按需分支，UI 可见性由 updateSsoUI() 统一控制。
  //   - 使用 stopPropagation() 防止 Chevron 自身点击被 outside-click 立即关闭。
  //   - 菜单项点击后主动关闭菜单并复位 aria-expanded，避免屏幕阅读器状态漂移。
  //   - outside-click/Escape 监听走 document 级，避免每次菜单展开都重新绑定。
  // 参数与返回值：无；bindHeaderEvents() 为 UI 初始化副作用型函数。
  // 影响范围：web/index.html 新增的 Chevron/menu DOM、web/src/backend.js 的 updateSsoUI、openProfilePage。
  // 潜在风险：initApp 重入时 bindHeaderEvents 也会重入，但该函数仅在 initApp 启动时调用一次；若未来改为热更新需引入一次性守卫。
  $("#btn-sso").addEventListener("click", () => {
    if (isAuthenticated()) {
      openProfilePage();
    } else {
      ssoLogin();
    }
  });

  const ssoMenuBtn = document.getElementById("btn-sso-menu");
  const ssoMenu = document.getElementById("sso-menu");
  const ssoProfileBtn = document.getElementById("btn-sso-profile");
  const ssoLogoutBtn = document.getElementById("btn-sso-logout");

  function closeSsoMenu({ returnFocus = false } = {}) {
    if (!ssoMenu || ssoMenu.hidden) return;
    ssoMenu.hidden = true;
    if (ssoMenuBtn) ssoMenuBtn.setAttribute("aria-expanded", "false");
    if (returnFocus && ssoMenuBtn && !ssoMenuBtn.hidden) ssoMenuBtn.focus();
  }

  if (ssoMenuBtn && ssoMenu) {
    ssoMenuBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = ssoMenu.hidden;
      ssoMenu.hidden = !willOpen;
      ssoMenuBtn.setAttribute("aria-expanded", String(willOpen));
    });
  }

  if (ssoProfileBtn) {
    ssoProfileBtn.addEventListener("click", () => {
      closeSsoMenu();
      openProfilePage();
    });
  }

  if (ssoLogoutBtn) {
    ssoLogoutBtn.addEventListener("click", () => {
      closeSsoMenu();
      ssoLogout();
    });
  }

  document.addEventListener("click", (event) => {
    if (!ssoMenu || ssoMenu.hidden) return;
    const target = event.target;
    if (ssoMenu.contains(target)) return;
    if (ssoMenuBtn && ssoMenuBtn.contains(target)) return;
    closeSsoMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && ssoMenu && !ssoMenu.hidden) {
      closeSsoMenu({ returnFocus: true });
    }
  });
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  // Enable theme transition
  document.documentElement.classList.add("theme-transitioning");
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
  // Remove transition class after animation completes
  setTimeout(() => {
    document.documentElement.classList.remove("theme-transitioning");
  }, 600);
}

/* ─── Input ─── */

function bindInputEvents() {
  const textarea = $("#input-textarea");
  const counter = $("#char-counter");
  const clearBtn = $("#btn-clear");

  textarea.addEventListener("input", () => {
    const len = textarea.value.length;
    counter.textContent = `${len.toLocaleString()} / 10,000`;
    counter.classList.toggle("is-warning", len > 8000 && len <= 9500);
    counter.classList.toggle("is-danger", len > 9500);
    // Show/hide clear button based on content
    clearBtn.hidden = len === 0;
    // Toggle has-content class for visual state
    textarea.closest(".input-box").classList.toggle("has-content", len > 0);

    // --- 2026-04-13 Skill 浮窗："/" 触发检测 ---
    handleSkillTrigger(textarea);
  });

  clearBtn.addEventListener("click", handleClear);
  $("#btn-generate").addEventListener("click", handleGenerate);

  // 输入框聚焦时复位 3D 倾斜
  const inputBox = textarea.closest(".input-box");
  textarea.addEventListener("focus", () => {
    if (inputBox && inputBox.classList.contains("tilt-card")) {
      inputBox.classList.add("tilt-resetting");
      inputBox.style.setProperty("--tilt-x", "0deg");
      inputBox.style.setProperty("--tilt-y", "0deg");
      inputBox.style.setProperty("--tilt-scale", "1");
      inputBox.dataset.tiltLocked = "1";
    }
  });
  textarea.addEventListener("blur", () => {
    if (inputBox) {
      delete inputBox.dataset.tiltLocked;
      inputBox.classList.remove("tilt-resetting");
    }
  });
}

/* ─── Skill Panel ─── */

/**
 * 2026-04-16 新增 — Web Skill 面板异步数据刷新
 * 变更类型：新增/兼容
 * 功能描述：在不打断当前面板生命周期的前提下，用后端 skill proxy 返回的新数据替换当前面板 skills。
 * 设计思路：
 *   1. 面板仍以本地 mock 立即可用，随后异步刷新真实数据，保持 `/` 首次触发即时反馈。
 *   2. 仅替换 `.skills` 属性，不重新创建自定义元素，避免触碰共享面板的隐藏态/防闪烁实现。
 *   3. loadSkills() 已含 mock 兜底，因此这里无需额外兜底分支，只在极端异常时打 warn。
 * 参数与返回值：refreshSkillPanelSkills({ forceRefresh }) 返回 Promise<void>。
 * 影响范围：web/src/ui/index.js 与 web/src/skill.js 之间的 skill 数据同步。
 * 潜在风险：无已知风险。
 */
async function refreshSkillPanelSkills(options = {}) {
  if (!_skillPanel) {
    return;
  }
  try {
    const nextSkills = await loadSkills(options);
    _skillPanel.skills = Array.isArray(nextSkills) ? nextSkills : SKILLS;
  } catch (err) {
    console.warn("[EP] Failed to refresh skill panel skills:", err);
  }
}

// --- 2026-04-13 Skill 浮窗初始化 ---
// [类型]     新增
// [描述]     创建 <ep-skill-panel> 实例，设置数据，绑定事件，定位在输入框上方。
// [思路]     复用 Web Component，通过 JS 属性传入 SKILLS 数据和 SKILL_TYPE_MAP。
//            监听 skill-select 事件：将 instructions 拼接到输入框内容前。
//            监听 panel-close 事件：隐藏浮窗。
// [影响范围] web/src/ui/index.js
// [潜在风险] 无已知风险（仅增不删）
function initSkillPanel() {
  const inputBox = $("#input-box");
  if (!inputBox) return;

  // 创建 <ep-skill-panel> 元素
  _skillPanel = document.createElement("ep-skill-panel");
  _skillPanel.skills = SKILLS;
  _skillPanel.skillTypeMap = SKILL_TYPE_MAP;
  _skillPanel.iconMap = SKILL_ICON_MAP;
  _skillPanel.folderIcon = FOLDER_ICON_SVG;

  // 2026-04-13 修复：绝对定位到输入框左上角，不挤占文档流
  // z-index 足够高以盖住页面文字（hero 标题等）
  _skillPanel.style.cssText =
    "position:absolute;bottom:100%;left:0;z-index:999999;margin-bottom:8px;";

  // 同步深色/浅色主题 + 背景色对齐 input-box
  // 2026-04-13 修复：skill 浮窗背景必须与 input-box 一致（使用页面 CSS 变量）
  // CSS custom properties 通过 Shadow DOM 继承，可在 host 上 set 后供内部使用
  const syncTheme = () => {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    _skillPanel.classList.toggle("dark", isDark);

    if (isDark) {
      // 对齐 .input-box.has-content 的背景色：color-mix(in srgb, --bg-elevated 97%, --accent 3%)
      _skillPanel.style.setProperty(
        "--ep-panel-bg",
        "color-mix(in srgb, var(--bg-elevated) 97%, var(--accent) 3%)",
      );
      _skillPanel.style.setProperty("--ep-panel-border", "var(--border-hover)");
      _skillPanel.style.setProperty(
        "--ep-panel-shadow",
        "inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.15), inset 0 0 0 0.5px rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)",
      );
    } else {
      // 浅色模式：对齐 [data-theme=light] .input-box 的背景
      _skillPanel.style.setProperty(
        "--ep-panel-bg",
        "rgba(255, 255, 255, 0.98)",
      );
      _skillPanel.style.setProperty(
        "--ep-panel-border",
        "rgba(255, 255, 255, 0.5)",
      );
      _skillPanel.style.removeProperty("--ep-panel-shadow");
    }
  };
  syncTheme();
  // 监听主题切换
  const observer = new MutationObserver(syncTheme);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  // 插入到 .input-section 容器中（input-box 有 overflow:hidden 会裁剪）
  const inputSection = inputBox.closest(".input-section");
  if (!inputSection) return;
  inputSection.style.position = "relative";
  inputSection.style.zIndex = "10"; // 2026-04-13 提升层级，使 skill 浮窗能盖住 hero 文字
  inputSection.insertBefore(_skillPanel, inputBox);

  // 监听 skill-select：移除 "/" + filter 文本，注入 instructions
  // 2026-04-13 修复：使用 _skillSlashIndex 精确定位 "/" 位置，
  //   保留 "/" 前的文本 + "/" 后 filter 之后的文本，中间插入 instructions。
  _skillPanel.addEventListener("skill-select", (e) => {
    const skill = e.detail;
    const textarea = $("#input-textarea");
    if (!textarea) return;

    const currentVal = textarea.value;
    let before = "";
    let after = "";

    if (_skillSlashIndex >= 0) {
      before = currentVal.substring(0, _skillSlashIndex);
      // filter 长度 = 当前面板的 filter 值长度
      const filterLen = _skillPanel.filter ? _skillPanel.filter.length : 0;
      after = currentVal.substring(_skillSlashIndex + 1 + filterLen);
    } else {
      before = currentVal;
    }

    // 拼接：before + instructions + after
    let newVal = before.trimEnd();
    if (skill.instructions) {
      newVal = (newVal ? newVal + "\n" : "") + skill.instructions;
    }
    if (after.trimStart()) {
      newVal += "\n" + after.trimStart();
    }
    textarea.value = newVal;
    _skillSlashIndex = -1;

    // 触发 input 事件以更新计数器等状态
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();

    // 设置 placeholder 提示（如果有）
    if (skill.placeholder) {
      textarea.setAttribute("placeholder", skill.placeholder);
    }
  });

  // 监听 panel-close
  _skillPanel.addEventListener("panel-close", () => {
    // 浮窗已自行隐藏，无需额外操作
  });
}

// --- 2026-04-13 Skill 浮窗触发检测 ---
// [描述]     检测输入框中光标前是否存在 "/"，触发或关闭 Skill 浮窗。
// [思路]     基于光标位置向前查找最近的 "/"，取 slash→cursor 之间文本作为 filter。
//            排除 "://" URL 模式防止误触发。
// [修复]     2026-04-13 修复两个 bug：
//            (1) 原 startsWith("/") 导致"输入文字后键入 /"不触发；
//            (2) 原 substring(1) 导致光标在行首键入 "/" 时 filter 包含光标后全部文本。
// [影响范围] web/src/ui/index.js（handleSkillTrigger + skill-select 事件）
// [潜在风险] 无已知风险
function handleSkillTrigger(textarea) {
  if (!_skillPanel) return;

  const val = textarea.value;
  const cursorPos = textarea.selectionStart;

  // 从光标位置向前查找最近的 "/"
  const textBeforeCursor = val.substring(0, cursorPos);
  const slashPos = textBeforeCursor.lastIndexOf("/");

  if (slashPos >= 0 && !(slashPos > 0 && val[slashPos - 1] === ":")) {
    // 找到 "/"，且不是 "://" URL 模式 → 触发 skill 浮窗
    const filterText = textBeforeCursor.substring(slashPos + 1);
    _skillSlashIndex = slashPos;
    if (!_skillPanel.visible && shouldRefreshSkillsOnPanelOpen()) {
      void refreshSkillPanelSkills({ forceRefresh: true });
    }
    _skillPanel.filter = filterText;
    _skillPanel.visible = true;
  } else {
    // 未找到有效 "/" → 关闭浮窗
    if (_skillPanel.visible) {
      _skillPanel.visible = false;
    }
    _skillSlashIndex = -1;
  }
}

function handleClear() {
  // Cancel in-progress generation
  if (isGenerating && currentAbortController) {
    currentAbortController.abort();
  }

  // Clear input
  const textarea = $("#input-textarea");
  textarea.value = "";
  textarea.closest(".input-box").classList.remove("has-content");
  $("#char-counter").textContent = "0 / 10,000";
  $("#char-counter").classList.remove("is-warning", "is-danger");

  // Hide clear button
  $("#btn-clear").hidden = true;

  // Hide output & progress
  hideOutput();
  hideProgress();

  // Reset scene selection
  selectedScene = null;
  $$(".scene-tag").forEach((t) => t.classList.remove("is-active"));
  updateSceneButton();

  // Focus textarea
  textarea.focus();

  showToast("已清除", "success");
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

  // Transition: dim input section
  $(".input-section").classList.add("is-generating");

  const config = await getEffectiveConfig();

  try {
    // 2026-04-09 架构重构：统一后端增强（backend-only）
    const result = await dualTrackEnhance(
      config,
      input,
      selectedScene,
      (stage, text) => {
        updateProgress(text);
      },
      signal,
    );
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
    $(".input-section").classList.remove("is-generating");
  }
}

/* ─── Progress ─── */

function showProgress(text) {
  const el = $("#progress");
  el.hidden = false;
  el.classList.remove("is-entering");
  // Trigger reflow for re-animation
  void el.offsetWidth;
  el.classList.add("is-entering");
  $("#progress-text").textContent = text;
}

function updateProgress(text) {
  $("#progress-text").textContent = text;
}

function hideProgress() {
  const el = $("#progress");
  el.classList.remove("is-entering");
  el.hidden = true;
}

/* ─── Output ─── */

function bindOutputEvents() {
  $("#btn-copy").addEventListener("click", handleCopy);
}

function showOutput(content, sceneIds, composite) {
  const section = $("#output-section");
  section.hidden = false;
  section.classList.remove("is-entering");
  void section.offsetWidth;
  section.classList.add("is-entering");

  // Render scene badges
  const badgesEl = $("#output-badges");
  badgesEl.innerHTML = "";
  for (const id of sceneIds) {
    const badge = document.createElement("span");
    badge.className = "output-badge" + (composite ? " is-composite" : "");
    badge.textContent = SCENE_NAMES[id] || id;
    badgesEl.appendChild(badge);
  }

  // Render content with line-by-line reveal
  const outputEl = $("#output-content");
  outputEl.innerHTML = "";
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    const span = document.createElement("div");
    span.className = "output-line";
    span.textContent = line || "\u200B"; // zero-width space for empty lines
    span.style.animationDelay = `${Math.min(i * 60, 3000)}ms`;
    outputEl.appendChild(span);
  });

  // Scroll to output with offset for header spacing
  setTimeout(() => {
    const rect = section.getBoundingClientRect();
    const offset = 80; // header height + breathing room
    window.scrollTo({
      top: window.scrollY + rect.top - offset,
      behavior: "smooth",
    });
  }, 100);
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

    // Pulse animation
    const btn = $("#btn-copy");
    btn.classList.add("is-copied");
    setTimeout(() => btn.classList.remove("is-copied"), 350);

    setTimeout(() => {
      copyIcon.style.display = "";
      checkIcon.style.display = "none";
      copyText.textContent = "复制";
    }, 2000);
  } catch (e) {
    showToast("复制失败，请手动复制", "error");
  }
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
  initModelCombo();

  // API 模式切换 → 自动填充路径
  const modeSelect = $("#setting-api-mode");
  if (modeSelect) {
    modeSelect.addEventListener("change", () => {
      const mode = modeSelect.value;
      if (mode && DEFAULT_API_PATHS[mode]) {
        $("#setting-api-path").value = DEFAULT_API_PATHS[mode];
      }
    });
  }

  // 获取模型列表按钮
  const btnFetch = $("#btn-fetch-models");
  if (btnFetch) {
    btnFetch.addEventListener("click", async () => {
      const apiHost = ($("#setting-api-host").value || "")
        .trim()
        .replace(/\/+$/, "");
      let apiPath = ($("#setting-api-path").value || "").trim();
      const apiMode = ($("#setting-api-mode").value || "").trim();
      // 若未填写路径且当前模式有默认路径，自动填充
      if (!apiPath && apiMode && DEFAULT_API_PATHS[apiMode]) {
        apiPath = DEFAULT_API_PATHS[apiMode];
        $("#setting-api-path").value = apiPath;
      }
      const apiKey = ($("#setting-api-key").value || "").trim();
      if (!apiHost || !apiKey) {
        showToast("请先填写 API Host 和 API Key", "error");
        return;
      }
      btnFetch.disabled = true;
      try {
        const config = {
          baseUrl: apiHost + apiPath,
          apiKey,
          model: "",
          apiMode,
        };
        const result = await fetchModels(config);
        if (result.ok && result.models.length > 0) {
          showToast(`获取到 ${result.models.length} 个模型`, "success");
          renderFetchedModels(result.models);
        } else {
          showToast(result.message || "未获取到模型", "error");
        }
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        btnFetch.disabled = false;
      }
    });
  }
}

/** 渲染获取到的模型列表（点击选中） */
function renderFetchedModels(models) {
  const container = $("#fetched-models-list");
  if (!container) return;
  container.hidden = false;
  container.innerHTML = "";
  models.forEach((m) => {
    const chip = document.createElement("span");
    chip.className = "model-chip";
    chip.textContent = m;
    chip.addEventListener("click", () => {
      $("#setting-model").value = m;
      showToast(`已选择模型: ${m}`, "success");
    });
    container.appendChild(chip);
  });
}

/* ─── Model Combobox ─── */

function initModelCombo() {
  const combo = $("#model-combo");
  const input = $("#setting-model");
  const toggle = combo.querySelector(".combo__toggle");
  const list = $("#model-list");
  let focusIdx = -1;

  // 渲染模型列表
  function renderList(filter) {
    list.innerHTML = "";
    const q = (filter || "").toLowerCase();
    let hasResults = false;
    let currentGroup = null;

    MODEL_LIST.forEach((item) => {
      if (item.group) {
        currentGroup = item.group;
        return;
      }
      if (
        q &&
        !item.id.toLowerCase().includes(q) &&
        !item.desc.toLowerCase().includes(q)
      )
        return;

      // 插入分组标题
      if (currentGroup) {
        const groupEl = document.createElement("div");
        groupEl.className = "combo__group";
        groupEl.textContent = currentGroup;
        list.appendChild(groupEl);
        currentGroup = null;
      }

      const opt = document.createElement("div");
      opt.className = "combo__option";
      if (item.id === input.value) opt.classList.add("is-selected");
      opt.innerHTML = `<span class="combo__option-id">${item.id}</span><span class="combo__option-desc">${item.desc}</span>`;
      opt.addEventListener("click", () => {
        input.value = item.id;
        closeCombo();
      });
      list.appendChild(opt);
      hasResults = true;
    });

    if (!hasResults) {
      const empty = document.createElement("div");
      empty.className = "combo__empty";
      empty.textContent = q ? "无匹配模型，可直接输入自定义名称" : "无可用模型";
      list.appendChild(empty);
    }
    focusIdx = -1;
  }

  function openCombo() {
    renderList(input.value);

    // 动态判断下拉框是向下展开还是向上展开，并限制高度
    const rect = combo.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const idealMax = 280;
    const dropdown = combo.querySelector(".combo__dropdown");

    if (spaceBelow >= Math.min(idealMax, 160)) {
      combo.classList.remove("is-dropup");
      dropdown.style.maxHeight = `${Math.min(idealMax, spaceBelow)}px`;
    } else if (spaceAbove > spaceBelow) {
      combo.classList.add("is-dropup");
      dropdown.style.maxHeight = `${Math.min(idealMax, spaceAbove)}px`;
    } else {
      combo.classList.remove("is-dropup");
      dropdown.style.maxHeight = `${Math.max(spaceBelow, 120)}px`;
    }

    combo.classList.add("is-open");
    // 滚动到选中项
    const selected = list.querySelector(".is-selected");
    if (selected) selected.scrollIntoView({ block: "nearest" });
  }

  function closeCombo() {
    combo.classList.remove("is-open");
    combo.classList.remove("is-dropup");
    focusIdx = -1;
  }

  function isOpen() {
    return combo.classList.contains("is-open");
  }

  // 点击展开按钮
  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    if (isOpen()) closeCombo();
    else {
      openCombo();
      input.focus();
    }
  });

  // 输入过滤
  input.addEventListener("input", () => {
    if (!isOpen()) openCombo();
    renderList(input.value);
  });

  // 聚焦打开
  input.addEventListener("focus", () => {
    if (!isOpen()) openCombo();
  });

  // 键盘导航
  input.addEventListener("keydown", (e) => {
    if (!isOpen()) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        openCombo();
        return;
      }
      return;
    }
    const options = list.querySelectorAll(".combo__option");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusIdx = Math.min(focusIdx + 1, options.length - 1);
      updateFocus(options);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusIdx = Math.max(focusIdx - 1, 0);
      updateFocus(options);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusIdx >= 0 && options[focusIdx]) options[focusIdx].click();
      else closeCombo();
    } else if (e.key === "Escape") {
      closeCombo();
    }
  });

  function updateFocus(options) {
    options.forEach((o, i) => o.classList.toggle("is-focused", i === focusIdx));
    if (options[focusIdx])
      options[focusIdx].scrollIntoView({ block: "nearest" });
  }

  // 点击外部关闭
  document.addEventListener("click", (e) => {
    if (!combo.contains(e.target)) closeCombo();
  });

  // 初始渲染
  renderList("");
}

function populateSettings() {
  const cfg = loadConfig();
  // API 模式
  const modeEl = $("#setting-api-mode");
  if (modeEl) modeEl.value = cfg.apiMode || "";

  // Host / Path（兼容旧 baseUrl，必要时拆分；复用 _splitBaseUrl）
  let host = (cfg.apiHost || "").trim();
  let path = (cfg.apiPath || "").trim();
  if (!host && cfg.baseUrl) {
    const parts = _splitBaseUrl(cfg.baseUrl);
    if (parts.host) host = parts.host;
    if (!path && parts.path) path = parts.path;
  }
  $("#setting-api-host").value = host;
  $("#setting-api-path").value = path;

  // 若未填 path 且当前模式有默认值，自动补全
  const modeForDefault = modeEl ? modeEl.value : "";
  if (!path && modeForDefault && DEFAULT_API_PATHS[modeForDefault]) {
    $("#setting-api-path").value = DEFAULT_API_PATHS[modeForDefault];
  }

  $("#setting-api-key").value = cfg.apiKey || "";
  $("#setting-model").value = cfg.model || "";
  const enhanceModeEl = $("#setting-enhance-mode");
  if (enhanceModeEl) {
    enhanceModeEl.value =
      cfg.enhanceMode === ENHANCE_MODES.DEEP
        ? ENHANCE_MODES.DEEP
        : DEFAULT_ENHANCE_MODE;
  }
  // 隐藏模型列表
  const fetchedList = $("#fetched-models-list");
  if (fetchedList) {
    fetchedList.hidden = true;
    fetchedList.innerHTML = "";
  }
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

  // 2026-04-09 架构重构：测试连接仅使用用户填写的配置，不再回退到内置 Provider
  const rawHost = ($("#setting-api-host").value || "")
    .trim()
    .replace(/\/+$/, "");
  const rawPath = ($("#setting-api-path").value || "").trim();
  const rawMode = ($("#setting-api-mode").value || "").trim();
  const rawKey = ($("#setting-api-key").value || "").trim();
  const rawModel = ($("#setting-model").value || "").trim();

  if (!rawHost) {
    resultEl.hidden = false;
    resultEl.className = "panel__test-result is-error";
    resultText.textContent = "请先填写 API Host";
    btn.disabled = false;
    btn.innerHTML = origHTML;
    return;
  }

  let apiHost = rawHost;
  let apiPath = rawPath;
  // 若未填写路径且当前模式有默认路径，自动填充
  if (!apiPath && rawMode && DEFAULT_API_PATHS[rawMode]) {
    apiPath = DEFAULT_API_PATHS[rawMode];
    $("#setting-api-path").value = apiPath;
  }
  const config = {
    baseUrl: apiHost + apiPath,
    apiKey: rawKey,
    model: rawModel,
    apiMode: rawMode || detectApiMode(apiHost + apiPath),
  };

  const res = await testApiConfig(config);

  resultEl.hidden = false;
  resultEl.className = "panel__test-result " + (res.ok ? "is-ok" : "is-error");
  resultText.textContent = res.message;

  btn.disabled = false;
  btn.innerHTML = origHTML;
}

function handleSaveSettings() {
  const enhanceModeEl = $("#setting-enhance-mode");
  const cfg = {
    apiMode: ($("#setting-api-mode").value || "").trim(),
    apiHost: ($("#setting-api-host").value || "").trim().replace(/\/+$/, ""),
    apiPath: ($("#setting-api-path").value || "").trim(),
    apiKey: ($("#setting-api-key").value || "").trim(),
    model: ($("#setting-model").value || "").trim(),
    enhanceMode:
      (enhanceModeEl?.value || DEFAULT_ENHANCE_MODE).trim() ===
      ENHANCE_MODES.DEEP
        ? ENHANCE_MODES.DEEP
        : DEFAULT_ENHANCE_MODE,
  };
  saveConfig(cfg);

  showToast("配置已保存", "success");
  closePanel("settings");
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
  const gap = 8;
  const viewportH = window.innerHeight;
  const spaceBelow = viewportH - rect.bottom - gap;
  const spaceAbove = rect.top - gap;
  const idealMax = 320;

  // Use fixed positioning to avoid scroll offset issues
  picker.style.position = "fixed";
  picker.style.right = `${window.innerWidth - rect.right}px`;
  picker.style.left = "auto";

  if (spaceBelow >= Math.min(idealMax, 200)) {
    // 向下展开
    picker.style.top = `${rect.bottom + gap}px`;
    picker.style.bottom = "auto";
    picker.style.maxHeight = `${Math.min(idealMax, spaceBelow - 12)}px`;
  } else if (spaceAbove > spaceBelow) {
    // 向上展开
    picker.style.top = "auto";
    picker.style.bottom = `${viewportH - rect.top + gap}px`;
    picker.style.maxHeight = `${Math.min(idealMax, spaceAbove - 12)}px`;
  } else {
    // 空间都不够，向下展开并限制高度
    picker.style.top = `${rect.bottom + gap}px`;
    picker.style.bottom = "auto";
    picker.style.maxHeight = `${Math.max(spaceBelow - 12, 120)}px`;
  }

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

/* ─── History Panel ─── */

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
      <div class="history-card__header">
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

  // Delegated events for expand/collapse, copy & delete inside history list
  $("#history-list").addEventListener("click", (e) => {
    // Copy button
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

    // Delete button
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

    // Expand/collapse card header
    const header = e.target.closest(".history-card__header");
    if (header) {
      const card = header.closest(".history-card");
      if (card) card.classList.toggle("is-expanded");
      return;
    }
  });
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
