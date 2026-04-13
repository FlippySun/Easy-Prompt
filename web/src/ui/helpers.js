/**
 * Easy Prompt Web — UI 工具函数
 * 2026-04-13 Vite 迁移：从 app.js §8 提取为独立 ESM 模块
 *
 * [类型]     重构（模块化）
 * [描述]     将 DOM 查询、Toast、面板/模态框控制等 UI 工具函数提取为独立模块
 * [影响范围] ui/index.js, ui/effects.js 以及所有 UI 交互逻辑
 * [潜在风险] 无已知风险
 */

/* ─── DOM Helpers ─── */

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ─── Toast ─── */

let toastTimer = null;

export function showToast(message, type = "error") {
  const toast = $("#toast");
  const text = $("#toast-text");

  clearTimeout(toastTimer);
  toast.hidden = false;
  toast.classList.remove("is-success", "is-dismissing");
  if (type === "success") toast.classList.add("is-success");

  text.textContent = message;

  // Force reflow for animation
  toast.classList.remove("is-visible");
  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  toastTimer = setTimeout(() => {
    toast.classList.add("is-dismissing");
    toast.classList.remove("is-visible");
    setTimeout(() => {
      toast.classList.remove("is-dismissing");
      toast.hidden = true;
    }, 400);
  }, 5000);
}

/* ─── Body Scroll Lock ─── */

/**
 * 锁定/解锁 body 滚动 — 补偿滚动条宽度防止布局跳动
 */
export function lockBodyScroll() {
  const scrollbarWidth =
    window.innerWidth - document.documentElement.clientWidth;
  document.body.style.overflow = "hidden";
  document.body.style.paddingRight = scrollbarWidth + "px";
}

export function unlockBodyScroll() {
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
}

/* ─── Panels & Modals ─── */

export function openPanel(name) {
  const panel = $(`#${name}-panel`);
  const overlay = $(`#${name}-overlay`);
  panel.hidden = false;
  overlay.hidden = false;
  requestAnimationFrame(() => {
    panel.classList.add("is-visible");
    overlay.classList.add("is-visible");
  });
  lockBodyScroll();
}

export function closePanel(name) {
  const panel = $(`#${name}-panel`);
  const overlay = $(`#${name}-overlay`);
  // 添加离场动画类
  panel.classList.add("is-dismissing");
  overlay.classList.add("is-dismissing");
  panel.classList.remove("is-visible");
  overlay.classList.remove("is-visible");
  setTimeout(() => {
    panel.hidden = true;
    overlay.hidden = true;
    panel.classList.remove("is-dismissing");
    overlay.classList.remove("is-dismissing");
    unlockBodyScroll();
  }, 400);
}

export function openModal(name) {
  const modal = $(`#${name}-modal`);
  const overlay = $(`#${name}-overlay`);
  modal.hidden = false;
  overlay.hidden = false;
  requestAnimationFrame(() => {
    modal.classList.add("is-visible");
    overlay.classList.add("is-visible");
  });
  lockBodyScroll();

  // Focus search
  const searchInput = modal.querySelector('input[type="text"]');
  if (searchInput) setTimeout(() => searchInput.focus(), 100);
}

export function closeModal(name) {
  const modal = $(`#${name}-modal`);
  const overlay = $(`#${name}-overlay`);
  // 添加离场动画类
  modal.classList.add("is-dismissing");
  overlay.classList.add("is-dismissing");
  modal.classList.remove("is-visible");
  overlay.classList.remove("is-visible");
  setTimeout(() => {
    modal.hidden = true;
    overlay.hidden = true;
    modal.classList.remove("is-dismissing");
    overlay.classList.remove("is-dismissing");
    unlockBodyScroll();
  }, 350);
}
