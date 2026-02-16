/**
 * Easy Prompt Browser Extension — Service Worker (Background)
 * 1. Context menu: right-click → "Easy Prompt 增强"
 * 2. Keyboard shortcut routing
 * 3. Message relay between content ↔ popup
 */

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
});
