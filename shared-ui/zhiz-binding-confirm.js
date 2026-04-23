/**
 * 2026-04-22
 * 变更类型：新增
 * 功能描述：提供一个共享的 Zhiz 未绑定确认压窗组件，替换 Web / Browser 里的原生 window.confirm。
 * 设计思路：
 *   1. 参考 Material 的 headline/content/actions 分层、Ant 的 centered floating layer、Radix Alert Dialog 的语义化确认结构，
 *      再结合 Easy Prompt 现有紫色渐变与暗色玻璃感表面，做成一个不依赖宿主站点样式的 Shadow DOM 弹框。
 *   2. 浏览器插件内容脚本运行在第三方站点时容易被页面样式污染，因此整个确认层都封装在独立 shadowRoot 中，
 *      只暴露 Promise<boolean> 结果给宿主逻辑，不污染既有 skill-panel 稳定 shell。
 * 参数与返回值：`showZhizBindingConfirmDialog(options?)` 接收可选标题/文案/按钮文本/主题；返回 Promise<boolean> 表示用户是否确认继续。
 * 影响范围：web/src/ui/index.js、browser/content/content.js 的“已登录但未绑定 Zhiz”分流提示。
 * 潜在风险：当前实现做了 ESC / Tab 焦点循环 / backdrop 取消；若未来需要多步骤表单，需要升级为更完整的 dialog 状态机。
 */

import confirmDialogCss from "./zhiz-binding-confirm.css?raw";

const ICON_SPARKLES = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/></svg>`;
const ICON_LINK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.05" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l2.92-2.92a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54L3.54 13.38a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

const DEFAULT_OPTIONS = {
  accentLabel: "Zhiz 技能管理",
  title: "先完成 Zhiz 授权",
  message:
    "当前账号尚未绑定 Zhiz。\n前往 PromptHub 个人页中的第三方 OAuth 授权专区完成绑定后，即可继续编辑和管理你的 Zhiz skills。",
  noteTitle: "绑定完成后自动进入目标页",
  noteText:
    "本次确认不会中断当前操作意图；授权完成后，系统会自动把你送回 Zhiz 技能管理页。",
  confirmText: "前往绑定 Zhiz",
  cancelText: "暂不前往",
  theme: "dark",
};

let activeHost = null;

function normalizeSvgSource(svgText) {
  const raw = String(svgText || "").trim();
  if (!raw) return "";
  if (/^<svg\b/i.test(raw) && !/\bxmlns=/.test(raw)) {
    return raw.replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return raw;
}

function svgToDataUrl(svgText) {
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    normalizeSvgSource(svgText),
  )}")`;
}

function createNode(tag, { className, text, type } = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (typeof text === "string") el.textContent = text;
  if (type) el.type = type;
  return el;
}

function createMaskIcon(svgText, className) {
  const icon = createNode("span", { className });
  const dataUrl = svgToDataUrl(svgText);
  icon.style.webkitMaskImage = dataUrl;
  icon.style.maskImage = dataUrl;
  return icon;
}

function resolveTheme(preferredTheme) {
  if (preferredTheme === "light" || preferredTheme === "dark") {
    return preferredTheme;
  }
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

function collectFocusableElements(root) {
  return Array.from(
    root.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

/**
 * 2026-04-22 新增 — 展示 Zhiz 未绑定确认压窗
 * 变更类型：新增/交互
 * 功能描述：渲染一个带毛玻璃遮罩、渐变图标与双按钮操作区的压窗确认层，替代系统原生 confirm。
 * 设计思路：保持调用端只关心 Promise<boolean> 结果；组件内部自行处理挂载、动画、ESC / Tab 焦点循环与回收。
 * 参数与返回值：`showZhizBindingConfirmDialog(options?)` 返回 Promise<boolean>，true=确认继续，false=取消/关闭。
 * 影响范围：Web 宿主与 Browser content script 的未绑定 Zhiz 提示。
 * 潜在风险：若调用方并发打开多个确认框，新框会先关闭旧框；这是为了保证当前全局只存在一个压窗实例。
 */
export function showZhizBindingConfirmDialog(options = {}) {
  if (activeHost?.isConnected) {
    activeHost.dispatchEvent(
      new CustomEvent("ep-confirm-force-close", {
        detail: { confirmed: false },
      }),
    );
  }

  const merged = {
    ...DEFAULT_OPTIONS,
    ...options,
    theme: resolveTheme(options.theme),
  };

  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });
  const styleNode = createNode("style");
  styleNode.textContent = confirmDialogCss;

  const titleId = `ep-confirm-title-${Date.now()}`;
  const descId = `ep-confirm-desc-${Date.now()}`;
  const overlay = createNode("div", { className: "ep-confirm-root" });
  const dialog = createNode("section", { className: "ep-confirm-dialog" });
  dialog.setAttribute("role", "alertdialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", titleId);
  dialog.setAttribute("aria-describedby", descId);

  const content = createNode("div", { className: "ep-confirm-content" });
  const header = createNode("div", { className: "ep-confirm-header" });
  const iconShell = createNode("div", { className: "ep-confirm-icon-shell" });
  iconShell.appendChild(createMaskIcon(ICON_SPARKLES, "ep-confirm-icon"));

  const textBlock = createNode("div");
  const eyebrow = createNode("div", {
    className: "ep-confirm-eyebrow",
    text: merged.accentLabel,
  });
  eyebrow.prepend(createMaskIcon(ICON_LINK, "ep-confirm-icon"));

  const title = createNode("h2", {
    className: "ep-confirm-title",
    text: merged.title,
  });
  title.id = titleId;

  const body = createNode("p", {
    className: "ep-confirm-body",
    text: merged.message,
  });
  body.id = descId;

  textBlock.append(eyebrow, title, body);
  header.append(iconShell, textBlock);

  const highlight = createNode("div", { className: "ep-confirm-highlight" });
  const highlightIcon = createMaskIcon(ICON_SPARKLES, "ep-confirm-icon ep-confirm-highlight-icon");
  const highlightText = createNode("div");
  highlightText.append(
    createNode("div", {
      className: "ep-confirm-highlight-title",
      text: merged.noteTitle,
    }),
    createNode("div", {
      className: "ep-confirm-highlight-text",
      text: merged.noteText,
    }),
  );
  highlight.append(highlightIcon, highlightText);

  content.append(header, highlight);

  const footer = createNode("div", { className: "ep-confirm-footer" });
  const cancelButton = createNode("button", {
    className: "ep-confirm-button ep-confirm-button--ghost",
    text: merged.cancelText,
    type: "button",
  });
  const confirmButton = createNode("button", {
    className: "ep-confirm-button ep-confirm-button--primary",
    type: "button",
  });
  confirmButton.appendChild(
    createNode("span", {
      className: "ep-confirm-button-label",
      text: merged.confirmText,
    }),
  );
  footer.append(cancelButton, confirmButton);

  dialog.append(content, footer);
  overlay.appendChild(dialog);
  shadow.append(styleNode, overlay);
  host.setAttribute("theme", merged.theme);

  const previousActiveElement =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  activeHost = host;

  return new Promise((resolve) => {
    let closing = false;

    /**
     * 2026-04-22 新增 — 统一回收确认压窗实例
     * 变更类型：新增/交互
     * 功能描述：在确认、取消、遮罩点击、ESC 或并发覆盖时统一回收当前 shadow 宿主并恢复焦点。
     * 设计思路：所有关闭路径都走同一个 finalize，避免某个分支漏解绑事件或漏 resolve Promise。
     * 参数与返回值：`finalize(confirmed)` 接收 boolean；在动画结束后 resolve 并移除宿主。
     * 影响范围：shared-ui/zhiz-binding-confirm.js 的生命周期管理。
     * 潜在风险：若宿主站点同步移除 body，焦点恢复会静默失败；不影响 Promise 返回。
     */
    const finalize = (confirmed) => {
      if (closing) {
        return;
      }
      closing = true;
      overlay.removeAttribute("data-open");
      document.removeEventListener("keydown", handleKeyDown, true);
      host.removeEventListener("ep-confirm-force-close", handleForceClose);
      window.setTimeout(() => {
        if (activeHost === host) {
          activeHost = null;
        }
        host.remove();
        if (previousActiveElement?.isConnected) {
          previousActiveElement.focus({ preventScroll: true });
        }
        resolve(Boolean(confirmed));
      }, 190);
    };

    const handleForceClose = (event) => {
      finalize(Boolean(event.detail?.confirmed));
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        finalize(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusables = collectFocusableElements(dialog);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const currentIndex = focusables.indexOf(document.activeElement);
      const nextIndex = event.shiftKey
        ? currentIndex <= 0
          ? focusables.length - 1
          : currentIndex - 1
        : currentIndex === -1 || currentIndex === focusables.length - 1
          ? 0
          : currentIndex + 1;
      event.preventDefault();
      focusables[nextIndex]?.focus();
    };

    cancelButton.addEventListener("click", () => finalize(false));
    confirmButton.addEventListener("click", () => finalize(true));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        finalize(false);
      }
    });
    host.addEventListener("ep-confirm-force-close", handleForceClose);
    document.addEventListener("keydown", handleKeyDown, true);

    (document.body || document.documentElement).appendChild(host);

    requestAnimationFrame(() => {
      overlay.setAttribute("data-open", "true");
      confirmButton.focus({ preventScroll: true });
    });
  });
}
