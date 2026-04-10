/**
 * Easy Prompt Browser Extension — Service Worker (Background)
 * 1. Context menu: right-click → "Easy Prompt 增强"
 * 2. Keyboard shortcut routing
 * 3. Message relay between content ↔ popup
 * 4. Inline enhance: AI 聊天网站原地增强 Prompt
 */

// ========================== 变更记录 ==========================
// [日期]     2026-03-24
// [类型]     配置变更
// [描述]     将 Background Service Worker 改造成 WXT MV3 模块入口可复用的 setup 形式。
// [思路]     把运行期监听器注册集中到 setupBackground() 中，规避 WXT 在构建期导入入口文件时执行浏览器 API 的问题。
// [影响范围] browser/background/service-worker.js、browser/wxt-entrypoints/background.js、browser/shared/*。
// [潜在风险] 若重复调用 setupBackground() 会导致重复注册监听器；当前已加幂等保护。
// ==============================================================

import { Storage } from "../shared/storage.js";
import { Defaults } from "../shared/defaults.js";
import { Api } from "../shared/api.js";
import { Scenes } from "../shared/scenes.js";
import { Router } from "../shared/router.js";
// 2026-04-10 SSO B2: Token 自动刷新
import { Sso } from "../shared/sso.js";

let _backgroundInitialized = false;

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
    chrome.tabs.create({
      url: chrome.runtime.getURL(`/popup.html?text=${encoded}`),
    });
  }
}

/**
 * 注册后台监听器。
 *
 * @returns {void} 无返回值；重复调用时会被幂等保护直接忽略。
 */
export function setupBackground() {
  if (_backgroundInitialized) return;
  _backgroundInitialized = true;

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
            chrome.tabs.create({ url: chrome.runtime.getURL("/popup.html") });
          }
        }
      } catch {
        try {
          await chrome.action.openPopup();
        } catch {
          chrome.tabs.create({ url: chrome.runtime.getURL("/popup.html") });
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

  /* ─── SSO Token Refresh Alarm (B2) ─── */
  // 2026-04-10 新增 — SSO Plan v2 B2
  // 设计思路：
  //   1. 扩展安装/启动时检查 token 过期时间，设置 chrome.alarms 定时刷新
  //   2. Alarm 在 token 过期前 5 分钟触发（最小间隔 50 分钟）
  //   3. 刷新失败不阻塞正常功能（匿名模式仍可用）
  // 影响范围：background service-worker，不影响 popup/content
  // 潜在风险：service worker 被浏览器休眠后 alarm 可能延迟，但 401 重试兜底

  const SSO_REFRESH_ALARM = "ep-sso-token-refresh";
  const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 提前 5 分钟刷新
  const MIN_ALARM_INTERVAL_MIN = 50; // 最小定时间隔（分钟）

  /**
   * 根据 token 过期时间调度下次刷新 alarm
   * 无 token 时清除 alarm
   */
  async function scheduleTokenRefresh() {
    const expiresAt = await Sso.getExpiresAt();
    if (!expiresAt) {
      // 无 token，清除 alarm
      chrome.alarms.clear(SSO_REFRESH_ALARM);
      return;
    }

    const now = Date.now();
    const refreshAt = expiresAt - REFRESH_BUFFER_MS;
    const delayMs = Math.max(refreshAt - now, 60 * 1000); // 至少 1 分钟后
    const delayMin = delayMs / 60000;

    // 设置一次性 alarm + 周期性兜底（防止单次 alarm 丢失）
    chrome.alarms.create(SSO_REFRESH_ALARM, {
      delayInMinutes: delayMin,
      periodInMinutes: MIN_ALARM_INTERVAL_MIN,
    });
  }

  // 安装/启动时调度
  chrome.runtime.onInstalled.addListener(() => scheduleTokenRefresh());
  chrome.runtime.onStartup.addListener(() => scheduleTokenRefresh());

  // Alarm 触发时刷新 token
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== SSO_REFRESH_ALARM) return;

    const token = await Sso.getAccessToken();
    if (!token) {
      // 用户已退出，清除 alarm
      chrome.alarms.clear(SSO_REFRESH_ALARM);
      return;
    }

    try {
      await Sso.refreshAccessToken();
      // 刷新成功，重新调度下次刷新
      await scheduleTokenRefresh();
      console.log("[EP] SSO token refreshed successfully");
    } catch (err) {
      // 刷新失败（refresh token 过期等），清除 alarm
      // 用户下次请求会收到 401，需重新登录
      console.warn("[EP] SSO token refresh failed:", err.message);
      chrome.alarms.clear(SSO_REFRESH_ALARM);
    }
  });

  // 监听 storage 变化：登录/退出时重新调度
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[Sso.SSO_KEYS.EXPIRES_AT]) {
      scheduleTokenRefresh();
    }
  });

  /* ─── Inline Enhance (AI 聊天网站原地增强) ─── */

  /**
   * 获取有效配置（用户偏好）
   * 2026-04-09 架构重构：backend-only 模式下不需要本地 API 配置
   * 后端自行管理 provider 和 model，只读取 enhanceMode 用户偏好
   */
  async function getEffectiveConfig() {
    const config = await Storage.loadConfig();
    config.enhanceMode = config.enhanceMode === "deep" ? "deep" : "fast";
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
      return {
        ok: false,
        error: `输入文本过长（最多 ${Api.MAX_INPUT_LENGTH} 字）`,
      };
    }

    // Progress callback — send updates to content script
    const onProgress = tabId
      ? (stage, message) => {
          try {
            chrome.tabs.sendMessage(tabId, {
              type: "ENHANCE_PROGRESS",
              stage,
              message,
            });
          } catch {
            /* tab may have closed */
          }
        }
      : null;

    try {
      // Ensure scenes are loaded
      const scenesOk = await Scenes.loadScenes();
      if (!scenesOk) {
        return { ok: false, error: "场景数据加载失败\n\n请刷新页面后重试" };
      }

      const config = await getEffectiveConfig();

      // 2026-04-09 架构重构：统一后端增强（backend-only），不再有本地直连回退
      const result = await Api.dualTrackEnhance(
        config,
        text.trim(),
        null, // localEnhanceFn 已废弃，保留参数位
        onProgress,
      );

      // Save to history (mirrors popup.js handleGenerate)
      try {
        const sceneNames = Scenes.getSceneNames();
        const sceneName = result.scenes
          .map((s) => sceneNames[s] || s)
          .join(result.composite ? " + " : ", ");
        const mode = result.composite ? "composite" : "single";
        await Storage.saveHistoryRecord(
          text.trim(),
          result.result,
          mode,
          result.scenes,
          sceneName,
        );
      } catch (e) {
        console.warn("[EP] Failed to save inline enhance to history:", e);
      }

      return {
        ok: true,
        result: result.result,
        scenes: result.scenes,
        composite: result.composite,
        source: result.source || "local",
      };
    } catch (err) {
      // Provide user-friendly error messages
      let errorMsg = err.message || "增强失败";
      if (
        errorMsg.includes("fetch") ||
        errorMsg.includes("network") ||
        errorMsg.includes("Failed")
      ) {
        errorMsg = "网络连接失败\n\n请检查网络连接后重试";
      } else if (
        errorMsg.includes("401") ||
        errorMsg.includes("Unauthorized")
      ) {
        errorMsg = "API Key 无效\n\n请在扩展设置中检查 API 配置";
      } else if (
        errorMsg.includes("429") ||
        errorMsg.includes("rate") ||
        errorMsg.includes("quota")
      ) {
        errorMsg = "API 调用频率超限\n\n请稍后重试";
      } else if (errorMsg.includes("timeout") || errorMsg.includes("Timeout")) {
        errorMsg = "请求超时\n\n服务器响应过慢，请重试";
      }
      return { ok: false, error: errorMsg };
    }
  }
}
