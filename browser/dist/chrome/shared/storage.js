/**
 * Easy Prompt Browser Extension — Storage Layer
 * 统一封装 chrome.storage.local / browser.storage.local
 * 兼容 Chrome、Firefox、Safari、Edge、Opera、QQ 浏览器
 */

/* global chrome */
const _storage =
  typeof browser !== "undefined" && browser.storage
    ? browser.storage
    : chrome.storage;

const KEYS = {
  CONFIG: "ep-config",
  HISTORY: "ep-history",
  THEME: "ep-theme",
};

const MAX_HISTORY = 100;

/* ─── Config ─── */

async function loadConfig() {
  try {
    const res = await _storage.local.get(KEYS.CONFIG);
    return res[KEYS.CONFIG] || {};
  } catch {
    return {};
  }
}

async function saveConfig(cfg) {
  await _storage.local.set({ [KEYS.CONFIG]: cfg });
}

/* ─── History ─── */

async function loadHistory() {
  try {
    const res = await _storage.local.get(KEYS.HISTORY);
    return res[KEYS.HISTORY] || [];
  } catch {
    return [];
  }
}

async function saveHistoryRecord(
  originalText,
  enhancedText,
  mode,
  sceneIds,
  sceneName,
) {
  const history = await loadHistory();
  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: Date.now(),
    mode,
    sceneIds: sceneIds || [],
    sceneName: sceneName || "",
    originalText,
    enhancedText,
  };
  history.unshift(record);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  await _storage.local.set({ [KEYS.HISTORY]: history });
  return record;
}

async function deleteHistoryRecord(id) {
  const history = (await loadHistory()).filter((r) => r.id !== id);
  await _storage.local.set({ [KEYS.HISTORY]: history });
}

async function clearHistory() {
  await _storage.local.remove(KEYS.HISTORY);
}

/* ─── Popup Session State (survives popup close, not browser restart) ─── */

const _sessionStorage =
  typeof browser !== "undefined" && browser.storage?.session
    ? browser.storage.session
    : chrome.storage?.session;

async function savePopupState(state) {
  if (!_sessionStorage) return;
  try {
    await _sessionStorage.set({ "ep-popup-state": state });
  } catch {
    /* session storage unavailable */
  }
}

async function loadPopupState() {
  if (!_sessionStorage) return null;
  try {
    const res = await _sessionStorage.get("ep-popup-state");
    return res["ep-popup-state"] || null;
  } catch {
    return null;
  }
}

async function clearPopupState() {
  if (!_sessionStorage) return;
  try {
    await _sessionStorage.remove("ep-popup-state");
  } catch {
    /* ignore */
  }
}

/* ─── Theme ─── */

async function loadTheme() {
  try {
    const res = await _storage.local.get(KEYS.THEME);
    return res[KEYS.THEME] || null; // null = 跟随系统 prefers-color-scheme
  } catch {
    return null;
  }
}

async function saveTheme(theme) {
  await _storage.local.set({ [KEYS.THEME]: theme });
}

/* ─── Export (module-like for shared use) ─── */
// eslint-disable-next-line no-unused-vars
const Storage = {
  KEYS,
  MAX_HISTORY,
  loadConfig,
  saveConfig,
  loadHistory,
  saveHistoryRecord,
  deleteHistoryRecord,
  clearHistory,
  loadTheme,
  saveTheme,
  savePopupState,
  loadPopupState,
  clearPopupState,
};
