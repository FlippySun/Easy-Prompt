/**
 * Easy Prompt Browser Extension — Options Page Logic
 * API 配置（Mode / Host / Path / API Key / Model）+ 测试连接 + 获取模型
 */

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

  await Storage.saveConfig({
    apiMode,
    apiHost,
    apiPath,
    baseUrl,
    apiKey,
    model,
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
