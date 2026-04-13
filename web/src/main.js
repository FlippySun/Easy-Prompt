/**
 * Easy Prompt Web — 应用入口
 * 2026-04-13 Vite 迁移：从 app.js §9 提取为独立 ESM 入口模块
 *
 * [类型]     重构（模块化）
 * [描述]     Vite 应用入口，负责 DOMContentLoaded 初始化流程
 * [影响范围] 替代原 app.js 的 §9 Initialization 块
 * [潜在风险] 无已知风险
 */

import "./style.css";

import { loadScenes } from "./scenes.js";
import { showToast } from "./ui/helpers.js";
import { initApp } from "./ui/index.js";

/* ═══════════════════════════════════════════════════
   §9. Initialization
   ═══════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", async () => {
  // ── Cross-Product Guide Bar ──
  const guideBar = document.getElementById("guide-bar");
  const guideClose = document.getElementById("guide-bar-close");
  const GUIDE_KEY = "ep_guide_dismissed";

  if (guideBar && !localStorage.getItem(GUIDE_KEY)) {
    setTimeout(() => {
      guideBar.removeAttribute("hidden");
      // Force reflow then trigger animation
      void guideBar.offsetHeight;
      guideBar.classList.add("guide-bar--enter");
    }, 1200);
  }

  if (guideClose) {
    guideClose.addEventListener("click", () => {
      guideBar.classList.add("guide-bar--hiding");
      try {
        localStorage.setItem(GUIDE_KEY, "1");
      } catch {}
      guideBar.addEventListener(
        "animationend",
        () => {
          guideBar.setAttribute("hidden", "");
        },
        { once: true },
      );
    });
  }

  // ── Hub Bubble Tooltip ──
  const hubBubble = document.getElementById("hub-bubble");
  const BUBBLE_KEY = "ep_hub_bubble_dismissed";

  if (hubBubble && !localStorage.getItem(BUBBLE_KEY)) {
    setTimeout(() => {
      hubBubble.removeAttribute("hidden");
    }, 2000);
  }

  const dismissBubble = () => {
    if (!hubBubble || hubBubble.hidden) return;
    hubBubble.classList.add("hub-bubble--hiding");
    try {
      localStorage.setItem(BUBBLE_KEY, "1");
    } catch {}
    hubBubble.addEventListener(
      "animationend",
      () => {
        hubBubble.setAttribute("hidden", "");
      },
      { once: true },
    );
  };

  if (hubBubble) {
    hubBubble.addEventListener("click", dismissBubble);
  }

  // Also dismiss bubble when hub-link is clicked
  const hubLink = document.querySelector(".header__hub-link");
  if (hubLink) {
    hubLink.addEventListener("click", dismissBubble);
  }

  // ── Cross-Product Referral Welcome ──
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") === "hub") {
      setTimeout(
        () =>
          showToast("👋 欢迎从 PromptHub 过来！试试 AI Prompt 增强", "success"),
        1500,
      );
      const url = new URL(window.location.href);
      url.searchParams.delete("from");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  } catch {}

  const loaded = await loadScenes();
  if (!loaded) {
    showToast("场景数据加载失败，请刷新页面重试", "error");
    return;
  }
  initApp();
});
