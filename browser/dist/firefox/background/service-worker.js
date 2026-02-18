/**
 * Easy Prompt Browser Extension — Service Worker (Background)
 * 1. Context menu: right-click → "Easy Prompt 增强"
 * 2. Keyboard shortcut routing
 * 3. Message relay between content ↔ popup
 * 4. Inline enhance: AI 聊天网站原地增强 Prompt
 */

/* ─── Import Shared Modules ─── */
importScripts(
  "../shared/storage.js",
  "../shared/defaults.js",
  "../shared/api.js",
  "../shared/icons.js",
  "../shared/scenes.js",
  "../shared/router.js",
);

/* ─── Helpers ─── */

/**
 * 将待增强文本传递给 popup 并打开
 * 优先使用 storage.session（无竞态），fallback 到 URL 参数（Firefox tab 场景）
 */
async function openPopupWithText(text) {
  // 写入 session storage（Chrome/Safari 支持，Firefox 115+ 支持）
  try {
    await chrome.storage.session.set({ _pendingText: text });
  } catch {
    /* storage.session 不可用时 fallback 到 URL 参数 */
  }

  try {
    await chrome.action.openPopup();
  } catch {
    // Firefox 不支持 openPopup → 在新标签页打开（用 URL 参数作为 fallback）
    const encoded = encodeURIComponent(text);
    chrome.tabs.create({ url: `popup/popup.html?text=${encoded}` });
  }
}

/* ─── Context Menu ─── */
chrome.runtime.onInstalled.addListener(() => {
  // 先清除旧菜单再创建, 避免扩展更新时重复 ID 报错
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "easy-prompt-enhance",
      title: "Easy Prompt 增强",
      contexts: ["selection"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "easy-prompt-enhance" && info.selectionText) {
    openPopupWithText(info.selectionText.trim());
  }
});

/* ─── Keyboard Shortcuts ─── */
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "smart-enhance") {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return;
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection()?.toString().trim() || "",
      });
      const selectedText = result?.result || "";
      if (selectedText) {
        await openPopupWithText(selectedText);
      } else {
        try {
          await chrome.action.openPopup();
        } catch {
          chrome.tabs.create({ url: "popup/popup.html" });
        }
      }
    } catch {
      try {
        await chrome.action.openPopup();
      } catch {
        chrome.tabs.create({ url: "popup/popup.html" });
      }
    }
  }
});

/* ─── Message Relay ─── */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ENHANCE_TEXT") {
    openPopupWithText(message.text).then(() => sendResponse({ ok: true }));
    return true; // Keep channel open for async
  }

  if (message.type === "ENHANCE_INLINE") {
    const tabId = sender.tab?.id;
    handleInlineEnhance(message.text, tabId)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // Keep channel open for async
  }
});

/* ─── Inline Enhance (AI 聊天网站原地增强) ─── */

/**
 * 获取有效 API 配置（用户配置 + 内置默认值合并）
 */
async function getEffectiveConfig() {
  let config = await Storage.loadConfig();
  if (!config.apiKey || !config.baseUrl || !config.model) {
    const defaults = await Defaults.getBuiltinDefaults();
    if (!defaults) throw new Error("请先在设置中配置 API");
    config = {
      baseUrl: config.baseUrl || defaults.baseUrl,
      apiKey: config.apiKey || defaults.apiKey,
      model: config.model || defaults.model,
    };
  }
  return config;
}

/**
 * 处理内联增强请求
 * @param {string} text — 用户输入的原始文本
 * @returns {{ ok: boolean, result?: string, scenes?: string[], error?: string }}
 */
async function handleInlineEnhance(text, tabId) {
  if (!text || !text.trim()) {
    return { ok: false, error: "输入为空" };
  }
  if (!Router.isValidInput(text)) {
    return { ok: false, error: "输入内容无效，请输入有意义的文本内容" };
  }
  if (text.length > Api.MAX_INPUT_LENGTH) {
    return { ok: false, error: `输入文本过长（最多 ${Api.MAX_INPUT_LENGTH} 字）` };
  }

  // Progress callback — send updates to content script
  const onProgress = tabId ? (stage, message) => {
    try {
      chrome.tabs.sendMessage(tabId, { type: "ENHANCE_PROGRESS", stage, message });
    } catch { /* tab may have closed */ }
  } : null;

  try {
    // Ensure scenes are loaded
    const scenesOk = await Scenes.loadScenes();
    if (!scenesOk) {
      return { ok: false, error: "场景数据加载失败\n\n请刷新页面后重试" };
    }

    const config = await getEffectiveConfig();
    const result = await Router.smartRoute(config, text.trim(), onProgress);

    return {
      ok: true,
      result: result.result,
      scenes: result.scenes,
      composite: result.composite,
    };
  } catch (err) {
    // Provide user-friendly error messages
    let errorMsg = err.message || "增强失败";
    if (errorMsg.includes("fetch") || errorMsg.includes("network") || errorMsg.includes("Failed")) {
      errorMsg = "网络连接失败\n\n请检查网络连接后重试";
    } else if (errorMsg.includes("401") || errorMsg.includes("Unauthorized")) {
      errorMsg = "API Key 无效\n\n请在扩展设置中检查 API 配置";
    } else if (errorMsg.includes("429") || errorMsg.includes("rate") || errorMsg.includes("quota")) {
      errorMsg = "API 调用频率超限\n\n请稍后重试";
    } else if (errorMsg.includes("timeout") || errorMsg.includes("Timeout")) {
      errorMsg = "请求超时\n\n服务器响应过慢，请重试";
    }
    return { ok: false, error: errorMsg };
  }
}
