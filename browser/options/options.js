/**
 * Easy Prompt Browser Extension — Options Page Logic
 * API 配置（Mode / Host / Path / API Key / Model）+ 测试连接 + 获取模型
 */

// ========================== 变更记录 ==========================
// [日期]     2026-03-24
// [类型]     配置变更
// [描述]     将 Options 脚本切换为 WXT ESM 入口模式，显式导入配置与 API 模块。
// [思路]     延续原有表单交互与校验逻辑，仅移除对全局脚本注入顺序的隐式依赖。
// [影响范围] browser/options/options.js、browser/shared/storage.js、browser/shared/defaults.js、browser/shared/api.js。
// [潜在风险] 旧版经典 script 装载方式不再适用；WXT 构建链路不受影响。
// ==============================================================

// 2026-04-08 P9.04: 新增后端开关 UI + 健康检测
// 设计思路：读写 chrome.storage.local 中的 ep-backend-enabled，与 shared/api.js 的 isBackendEnabled() 对齐
// 影响范围：options 页面新增「后端服务」卡片
// 潜在风险：无已知风险
import { Storage } from "../shared/storage.js";
import { Defaults } from "../shared/defaults.js";
import { Api } from "../shared/api.js";
// 2026-04-10 SSO B1: SSO 登录/退出/状态管理
import { Sso } from "../shared/sso.js";

/**
 * 2026-04-15
 * 变更类型：修复/交互
 * 功能描述：为浏览器扩展 options 页已登录用户名徽标增加点击直达 Web-Hub 个人页能力，统一“点击用户名”语义。
 * 设计思路：继续保留独立退出按钮，只把用户名徽标作为高频正向入口；避免用户在扩展端登录后找不到个人资料页。
 * 参数与返回值：常量 `SSO_PROFILE_URL` 指向 `https://zhiz.chat/profile`；`handleSsoOpenProfile()` 无入参，成功时新开标签页到个人页。
 * 影响范围：browser/options/options.js、browser/wxt-entrypoints/options/index.html、browser/options/options.css。
 * 潜在风险：若浏览器使用的站点登录上下文与当前扩展触发时所在 profile 不一致，个人页仍可能需要重新识别登录态。
 */
const SSO_PROFILE_URL = "https://zhiz.chat/profile";

const $ = (sel) => document.querySelector(sel);

/* ─── Safe DOM Helper (avoids innerHTML for Firefox AMO compliance) ─── */
const _htmlParser = new DOMParser();
function _setHTML(el, html) {
  el.replaceChildren(
    ..._htmlParser.parseFromString(html, "text/html").body.childNodes,
  );
}

/* ─── Theme Helper ─── */
function getEffectiveTheme() {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr) return attr;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

const ICON_SUN =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>';
const ICON_MOON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';

document.addEventListener("DOMContentLoaded", async () => {
  // Apply theme (if saved → explicit; otherwise let CSS prefers-color-scheme handle it)
  const theme = await Storage.loadTheme();
  if (theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  // Update theme button icon
  _setHTML(
    $("#btn-theme"),
    getEffectiveTheme() === "light" ? ICON_MOON : ICON_SUN,
  );

  // Logo icon (sparkles)
  _setHTML(
    $("#logo-icon"),
    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/></svg>`,
  );

  // Load saved config
  const config = await Storage.loadConfig();
  if (config.apiMode) $("#input-api-mode").value = config.apiMode;

  // Split host/path first; then fallback to defaults
  let host = (config.apiHost || "").trim();
  let path = (config.apiPath || "").trim();
  if (!host && config.baseUrl) {
    try {
      const u = new URL(config.baseUrl);
      host = u.origin;
      const rawPath = u.pathname === "/" ? "" : u.pathname;
      path = path || rawPath;
    } catch {
      /* ignore */
    }
  }
  $("#input-api-host").value = host;
  $("#input-api-path").value = path;

  // If mode has default path and path empty → autofill
  const modeForDefault = $("#input-api-mode").value;
  if (!path && modeForDefault && Api.DEFAULT_API_PATHS[modeForDefault]) {
    $("#input-api-path").value = Api.DEFAULT_API_PATHS[modeForDefault];
  }

  if (config.apiKey) $("#input-api-key").value = config.apiKey;
  if (config.model) $("#input-model").value = config.model;
  const enhanceModeEl = $("#input-enhance-mode");
  if (enhanceModeEl) {
    enhanceModeEl.value = config.enhanceMode === "deep" ? "deep" : "fast";
  }

  // Mode change → auto-fill path
  $("#input-api-mode").addEventListener("change", () => {
    const mode = $("#input-api-mode").value;
    if (mode && Api.DEFAULT_API_PATHS[mode]) {
      $("#input-api-path").value = Api.DEFAULT_API_PATHS[mode];
    }
  });

  // Toggle key visibility
  $("#btn-toggle-key").addEventListener("click", () => {
    const input = $("#input-api-key");
    input.type = input.type === "password" ? "text" : "password";
  });

  // Theme toggle
  $("#btn-theme").addEventListener("click", async () => {
    const current = getEffectiveTheme();
    const next = current === "light" ? "dark" : "light";
    document.documentElement.classList.add("theme-transitioning");
    document.documentElement.setAttribute("data-theme", next);
    await Storage.saveTheme(next);
    _setHTML($("#btn-theme"), next === "light" ? ICON_MOON : ICON_SUN);
    setTimeout(() => {
      document.documentElement.classList.remove("theme-transitioning");
    }, 500);
  });

  // Save
  $("#btn-save").addEventListener("click", handleSave);

  // Test
  $("#btn-test").addEventListener("click", handleTest);

  // Fetch models
  $("#btn-fetch-models").addEventListener("click", handleFetchModels);

  // 2026-04-09 架构重构：三模式选择器已移除，统一走 backend API
  // 如果页面还保留了 mode selector DOM，设为固定值并禁用
  const backendModeSelect = $("#input-backend-mode");
  if (backendModeSelect) {
    backendModeSelect.value = "backend-only";
    backendModeSelect.disabled = true;
  }

  // Backend health check button
  const btnBackendTest = $("#btn-backend-test");
  if (btnBackendTest) {
    btnBackendTest.addEventListener("click", handleBackendHealthCheck);
  }

  // 2026-04-10 SSO B1: SSO 登录/退出 + 状态显示
  // 设计思路：替换旧的手动 Token 输入，改用 SSO 单点登录
  // 影响范围：options 页面「后端服务」卡片中的账号区域
  // 潜在风险：Safari 使用 Tab redirect（异步完成，页面无法感知登录完成）
  await updateSsoStatus();

  const btnSsoLogin = $("#btn-sso-login");
  if (btnSsoLogin) {
    btnSsoLogin.addEventListener("click", handleSsoLogin);
  }

  const btnSsoLogout = $("#btn-sso-logout");
  if (btnSsoLogout) {
    btnSsoLogout.addEventListener("click", handleSsoLogout);
  }

  const btnSsoProfile = $("#btn-sso-profile");
  if (btnSsoProfile) {
    btnSsoProfile.addEventListener("click", handleSsoOpenProfile);
  }

  // 旧版手动 Token 迁移检测（B1a）
  const hadLegacy = await Sso.migrateLegacyToken();
  if (hadLegacy) {
    showToast("旧版 Token 已清除，请使用 SSO 登录", "info");
  }

  // 监听 storage 变化，Tab redirect（Safari）完成后自动刷新状态
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[Sso.SSO_KEYS.ACCESS_TOKEN] || changes[Sso.SSO_KEYS.USER]) {
      updateSsoStatus();
    }
  });
});

/** 从表单读取当前值 */
function getFormValues() {
  const apiMode = ($("#input-api-mode").value || "").trim();
  const apiHost = ($("#input-api-host").value || "").trim().replace(/\/+$/, "");
  const apiPath = ($("#input-api-path").value || "").trim();
  const apiKey = ($("#input-api-key").value || "").trim();
  const model = ($("#input-model").value || "").trim();
  const baseUrl = apiHost ? apiHost + apiPath : "";
  return { apiMode, apiHost, apiPath, apiKey, model, baseUrl };
}

async function handleSave() {
  const { apiMode, apiHost, apiPath, apiKey, model, baseUrl } = getFormValues();
  const enhanceModeEl = $("#input-enhance-mode");
  const enhanceMode =
    (enhanceModeEl?.value || "fast") === "deep" ? "deep" : "fast";

  await Storage.saveConfig({
    apiMode,
    apiHost,
    apiPath,
    baseUrl,
    apiKey,
    model,
    enhanceMode,
  });
  showToast("配置已保存", "success");
}

async function handleTest() {
  const vals = getFormValues();

  // Merge with builtin defaults if needed
  let config = {
    baseUrl: vals.baseUrl,
    apiKey: vals.apiKey,
    model: vals.model,
    apiMode: vals.apiMode,
  };
  if (!config.baseUrl || !config.apiKey || !config.model) {
    try {
      const defaults = await Defaults.getBuiltinDefaults();
      if (defaults) {
        config = {
          baseUrl: config.baseUrl || defaults.baseUrl,
          apiKey: config.apiKey || defaults.apiKey,
          model: config.model || defaults.model,
          apiMode: config.apiMode || "",
        };
      }
    } catch {
      /* ignore */
    }
  }

  const btn = $("#btn-test");
  const resultEl = $("#test-result");
  btn.disabled = true;
  $("#btn-test-text").textContent = "测试中…";
  resultEl.hidden = true;

  try {
    const result = await Api.testApiConfig(config);
    resultEl.hidden = false;
    if (result.ok) {
      resultEl.className = "test-result is-success";
      _setHTML(
        $("#test-result-icon"),
        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`,
      );
      $("#test-result-text").textContent = `连接成功 · ${result.latency}ms`;
    } else {
      resultEl.className = "test-result is-error";
      _setHTML(
        $("#test-result-icon"),
        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`,
      );
      $("#test-result-text").textContent = result.message;
    }
  } catch (err) {
    resultEl.hidden = false;
    resultEl.className = "test-result is-error";
    _setHTML(
      $("#test-result-icon"),
      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`,
    );
    $("#test-result-text").textContent = err.message;
  } finally {
    btn.disabled = false;
    $("#btn-test-text").textContent = "测试连接";
  }
}

async function handleFetchModels() {
  const vals = getFormValues();
  if (!vals.apiHost || !vals.apiKey) {
    showToast("请先填写 API Host 和 API Key", "error");
    return;
  }

  const config = {
    baseUrl: vals.baseUrl,
    apiKey: vals.apiKey,
    model: vals.model,
    apiMode: vals.apiMode,
  };
  const btn = $("#btn-fetch-models");
  btn.disabled = true;

  try {
    const result = await Api.fetchModels(config);
    if (result.ok && result.models.length > 0) {
      showToast(`获取到 ${result.models.length} 个模型`, "success");
      renderModelsList(result.models);
    } else {
      showToast(result.message || "未获取到模型", "error");
    }
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

function renderModelsList(models) {
  const container = $("#models-list");
  container.hidden = false;
  // Clear existing chips
  while (container.firstChild) container.removeChild(container.firstChild);
  models.forEach((m) => {
    const chip = document.createElement("span");
    chip.className = "model-chip";
    chip.textContent = m;
    chip.addEventListener("click", () => {
      $("#input-model").value = m;
      showToast(`已选择模型: ${m}`, "success");
    });
    container.appendChild(chip);
  });
}

/**
 * 2026-04-08 P9.04: 检测后端健康状态
 * 调用 https://api.zhiz.chat/health 检查后端是否可用
 */
async function handleBackendHealthCheck() {
  const btn = $("#btn-backend-test");
  const statusEl = $("#backend-status");
  const dotEl = $("#backend-status-dot");
  const textEl = $("#backend-status-text");

  btn.disabled = true;
  btn.querySelector("span").textContent = "检测中…";
  statusEl.hidden = false;
  dotEl.className = "status-dot status-dot--pending";
  textEl.textContent = "正在连接后端服务...";

  try {
    const start = Date.now();
    const resp = await fetch(`${Api.BACKEND_API_BASE}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(10000),
    });
    const latency = Date.now() - start;

    if (resp.ok) {
      const data = await resp.json();
      if (data.status === "ok") {
        dotEl.className = "status-dot status-dot--ok";
        textEl.textContent = `后端服务正常 · ${latency}ms`;
      } else {
        dotEl.className = "status-dot status-dot--warn";
        textEl.textContent = `后端返回异常状态: ${data.status}`;
      }
    } else {
      dotEl.className = "status-dot status-dot--error";
      textEl.textContent = `后端 HTTP ${resp.status}`;
    }
  } catch (err) {
    dotEl.className = "status-dot status-dot--error";
    textEl.textContent = `连接失败: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.querySelector("span").textContent = "检测后端连接";
  }
}

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

/* ═══════════════════════════════════════════════════
   SSO 登录/退出/状态管理
   2026-04-10 新增 — SSO Plan v2 B1 + B3
   设计思路：
     1. updateSsoStatus() 读取 storage 中的 SSO 用户信息，切换显示已登录/未登录状态
     2. handleSsoLogin() 调用 Sso.ssoLogin() 触发双路径登录
     3. handleSsoLogout() 调用 Sso.ssoLogout() 清除 tokens
     4. storage.onChanged 监听器（DOMContentLoaded 中注册）处理 Safari Tab redirect 异步完成
   影响范围：options 页面「后端服务」卡片
   潜在风险：Safari Tab redirect 是异步的，用户需在 callback 页面完成后回到 options 页面
   ═══════════════════════════════════════════════════ */

/**
 * 读取 SSO 登录状态并更新 UI
 * 已登录 → 显示个人页入口 + 退出按钮
 * 未登录 → 显示登录按钮
 */
async function updateSsoStatus() {
  const loggedInEl = $("#sso-logged-in");
  const loggedOutEl = $("#sso-logged-out");
  const usernameEl = $("#sso-username");

  if (!loggedInEl || !loggedOutEl || !usernameEl) return;

  const user = await Sso.getSsoUser();
  const token = await Sso.getAccessToken();

  if (user && token) {
    // 已登录
    usernameEl.textContent =
      user.displayName || user.username || user.email || "当前账号";
    loggedInEl.hidden = false;
    loggedOutEl.hidden = true;
  } else {
    // 未登录
    loggedInEl.hidden = true;
    loggedOutEl.hidden = false;
  }
}

/**
 * SSO 登录按钮点击处理
 * 路径 A（Chrome/Firefox/Edge）：launchWebAuthFlow 弹窗 → 自动完成
 * 路径 B（Safari）：打开新 Tab → 用户在 Tab 中完成 → storage listener 刷新状态
 */
async function handleSsoLogin() {
  const btn = $("#btn-sso-login");
  if (btn) btn.disabled = true;

  try {
    const user = await Sso.ssoLogin();

    if (user) {
      // 路径 A：同步完成，直接更新 UI
      const displayName =
        user.displayName || user.username || user.email || "当前账号";
      showToast(`登录成功：${displayName}`, "success");
      await updateSsoStatus();
    } else {
      // 路径 B（Safari Tab redirect）：异步完成
      // storage.onChanged 监听器会在 callback 页面写入 token 后自动刷新状态
      showToast("已打开登录页面，请在新标签页中完成登录", "info");
    }
  } catch (err) {
    showToast(err.message || "登录失败，请重试", "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

/**
 * SSO 退出登录按钮点击处理
 */
async function handleSsoLogout() {
  try {
    await Sso.ssoLogout();
    showToast("已退出登录", "success");
    await updateSsoStatus();
  } catch (err) {
    showToast("退出失败: " + err.message, "error");
  }
}

/**
 * 2026-04-15 修复 — Browser options 已登录用户名点击直达个人页
 * 变更类型：修复/交互
 * 功能描述：用户在扩展 options 页登录成功后，点击用户名徽标直接打开 Web-Hub 个人页。
 * 设计思路：不复用退出按钮，避免误操作；通过 `chrome.tabs.create(...)` 新开标签，保持当前配置页上下文不丢失。
 * 参数与返回值：无入参；成功时创建新标签页到 `SSO_PROFILE_URL`，失败时通过 toast 暴露错误。
 * 影响范围：浏览器扩展 options 登录状态区域。
 * 潜在风险：若浏览器限制创建标签页或站点登录态已过期，用户仍可能在目标页看到未登录态。
 */
async function handleSsoOpenProfile() {
  try {
    await chrome.tabs.create({ url: SSO_PROFILE_URL });
  } catch (err) {
    showToast("打开个人主页失败: " + (err?.message || "未知错误"), "error");
  }
}
