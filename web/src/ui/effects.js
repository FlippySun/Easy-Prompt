/**
 * Easy Prompt Web — 视觉特效
 * 2026-04-13 Vite 迁移：从 app.js §8b 提取为独立 ESM 模块
 *
 * [类型]     重构（模块化）
 * [描述]     将视觉特效（光标追光、按钮涟漪、卡片聚光、滚动渐现、3D 倾斜）提取为独立模块
 * [影响范围] ui/index.js（initApp 调用）
 * [潜在风险] 无已知风险
 */

import { $$ } from "./helpers.js";

/**
 * Cursor Light — 跟随鼠标的大型径向渐变光晕
 * 动态创建 div.cursor-light 并跟随 mousemove 移动
 */
export function initCursorLight() {
  const light = document.createElement("div");
  light.className = "cursor-light";
  light.setAttribute("aria-hidden", "true");
  document.body.appendChild(light);

  let raf = null;
  document.addEventListener("mousemove", (e) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      light.style.left = e.clientX + "px";
      light.style.top = e.clientY + "px";
      light.style.opacity = "1";
      raf = null;
    });
  });

  document.addEventListener("mouseleave", () => {
    light.style.opacity = "0";
  });
}

/**
 * Button Ripple — 主按钮点击涟漪
 * 在点击位置生成 span.btn-ripple，动画结束后移除
 */
export function initButtonRipples() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn--primary");
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "btn-ripple";
    const size = Math.max(rect.width, rect.height) * 2;
    ripple.style.width = size + "px";
    ripple.style.height = size + "px";
    ripple.style.left = e.clientX - rect.left - size / 2 + "px";
    ripple.style.top = e.clientY - rect.top - size / 2 + "px";
    btn.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  });
}

/**
 * Card Spotlight — 场景卡片鼠标追光
 * 更新 CSS 变量 --spotlight-x / --spotlight-y 驱动 ::after 径向渐变
 */
export function initCardSpotlight() {
  document.addEventListener("mousemove", (e) => {
    const card = e.target.closest(".scene-card");
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--spotlight-x", e.clientX - rect.left + "px");
    card.style.setProperty("--spotlight-y", e.clientY - rect.top + "px");
  });
}

/**
 * Scroll Reveal — 滚动触发渐入动画
 * 使用 IntersectionObserver 对 .reveal-on-scroll 元素做交叉检测
 */
export function initScrollReveal() {
  // Add reveal class to target sections
  const targets = [".input-section", ".footer"];
  targets.forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) el.classList.add("reveal-on-scroll");
  });

  // Also add staggered reveal to scene tags
  $$(".scene-tag").forEach((tag, i) => {
    tag.classList.add("reveal-on-scroll");
    tag.style.transitionDelay = `${i * 40}ms`;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
  );

  $$(".reveal-on-scroll").forEach((el) => observer.observe(el));
}

/**
 * 3D Card Tilt — 主界面板块鼠标联动 3D 倾斜
 * 对 .input-box, .output-card, .scene-card 应用 perspective + rotateX/Y
 * 倾斜角度: ±6deg, 鼠标离开平滑复位
 */
export function initCardTilt() {
  const MAX_TILT = 1; // 最大倾斜角度(deg)
  const SCALE_HOVER = 1.01; // hover 微放大

  // 为目标元素添加 tilt-card class
  const selectors = [".input-box", ".output-card"];
  selectors.forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) el.classList.add("tilt-card");
  });

  // 场景卡片也参与（较小倾斜）
  $$(".scene-card").forEach((card) => card.classList.add("tilt-card"));

  let raf = null;

  document.addEventListener("mousemove", (e) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      const card = e.target.closest(".tilt-card");
      // 清除所有非 hover 的 tilt-card
      $$(".tilt-card").forEach((el) => {
        if (el !== card && !el.classList.contains("tilt-resetting")) {
          el.classList.add("tilt-resetting");
          el.style.setProperty("--tilt-x", "0deg");
          el.style.setProperty("--tilt-y", "0deg");
          el.style.setProperty("--tilt-scale", "1");
          // 复位动画结束后移除标记
          el.addEventListener("transitionend", function handler() {
            el.classList.remove("tilt-resetting");
            el.removeEventListener("transitionend", handler);
          });
        }
      });

      if (card) {
        // 输入框聚焦时跳过倾斜
        if (card.dataset.tiltLocked) {
          raf = null;
          return;
        }
        card.classList.remove("tilt-resetting");
        const rect = card.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        // 归一化到 [-1, 1]
        const normX = (e.clientX - centerX) / (rect.width / 2);
        const normY = (e.clientY - centerY) / (rect.height / 2);
        // 场景卡片用较小倾斜
        const isSmall = card.classList.contains("scene-card");
        const maxTilt = isSmall ? MAX_TILT * 0.6 : MAX_TILT;
        // rotateY 由水平偏移驱动，rotateX 由垂直偏移驱动（反向）
        const tiltY = (normX * maxTilt).toFixed(2);
        const tiltX = (-normY * maxTilt).toFixed(2);
        card.style.setProperty("--tilt-x", tiltX + "deg");
        card.style.setProperty("--tilt-y", tiltY + "deg");
        card.style.setProperty(
          "--tilt-scale",
          String(isSmall ? 1.03 : SCALE_HOVER),
        );
        // 光泽位置
        const glowX = (((normX + 1) / 2) * 100).toFixed(1);
        const glowY = (((normY + 1) / 2) * 100).toFixed(1);
        card.style.setProperty("--tilt-glow-x", glowX + "%");
        card.style.setProperty("--tilt-glow-y", glowY + "%");
      }
      raf = null;
    });
  });

  // 鼠标离开视口时全部复位
  document.addEventListener("mouseleave", () => {
    $$(".tilt-card").forEach((el) => {
      el.classList.add("tilt-resetting");
      el.style.setProperty("--tilt-x", "0deg");
      el.style.setProperty("--tilt-y", "0deg");
      el.style.setProperty("--tilt-scale", "1");
    });
  });
}
