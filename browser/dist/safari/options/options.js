/**
 * Easy Prompt Browser Extension — Options Page Logic
 * API 配置（Base URL / API Key / Model）+ 测试连接
 */

const $ = (sel) => document.querySelector(sel);

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
  $("#btn-theme").innerHTML =
    getEffectiveTheme() === "light" ? ICON_MOON : ICON_SUN;

  // Logo icon (sparkles)
  $("#logo-icon").innerHTML =
    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/></svg>`;

  // Load saved config
  const config = await Storage.loadConfig();
  if (config.baseUrl) $("#input-base-url").value = config.baseUrl;
  if (config.apiKey) $("#input-api-key").value = config.apiKey;
  if (config.model) $("#input-model").value = config.model;

  // Toggle key visibility
  $("#btn-toggle-key").addEventListener("click", () => {
    const input = $("#input-api-key");
    input.type = input.type === "password" ? "text" : "password";
  });

  // Theme toggle
  $("#btn-theme").addEventListener("click", async () => {
    const current = getEffectiveTheme();
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    await Storage.saveTheme(next);
    $("#btn-theme").innerHTML = next === "light" ? ICON_MOON : ICON_SUN;
  });

  // Save
  $("#btn-save").addEventListener("click", handleSave);

  // Test
  $("#btn-test").addEventListener("click", handleTest);
});

async function handleSave() {
  const baseUrl = ($("#input-base-url").value || "").trim().replace(/\/+$/, "");
  const apiKey = ($("#input-api-key").value || "").trim();
  const model = ($("#input-model").value || "").trim();

  await Storage.saveConfig({ baseUrl, apiKey, model });
  showToast("配置已保存", "success");
}

async function handleTest() {
  const baseUrl = ($("#input-base-url").value || "").trim().replace(/\/+$/, "");
  const apiKey = ($("#input-api-key").value || "").trim();
  const model = ($("#input-model").value || "").trim();

  // Merge with builtin defaults if needed
  let config = { baseUrl, apiKey, model };
  if (!config.baseUrl || !config.apiKey || !config.model) {
    try {
      const defaults = await Defaults.getBuiltinDefaults();
      if (defaults) {
        config = {
          baseUrl: config.baseUrl || defaults.baseUrl,
          apiKey: config.apiKey || defaults.apiKey,
          model: config.model || defaults.model,
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
      $("#test-result-icon").innerHTML =
        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`;
      $("#test-result-text").textContent = `连接成功 · ${result.latency}ms`;
    } else {
      resultEl.className = "test-result is-error";
      $("#test-result-icon").innerHTML =
        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`;
      $("#test-result-text").textContent = result.message;
    }
  } catch (err) {
    resultEl.hidden = false;
    resultEl.className = "test-result is-error";
    $("#test-result-icon").innerHTML =
      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`;
    $("#test-result-text").textContent = err.message;
  } finally {
    btn.disabled = false;
    $("#btn-test-text").textContent = "测试连接";
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
