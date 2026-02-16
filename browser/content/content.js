/**
 * Easy Prompt Browser Extension — Content Script
 * Shows a floating "enhance" button when the user selects text on any webpage.
 * Click → sends selected text to the popup via background message relay.
 */

(function () {
  "use strict";

  let floatBtn = null;
  let hideTimer = null;
  let scrollRafPending = false;

  /* ─── Float Button SVG (sparkles) ─── */
  const ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/></svg>`;

  /* ─── Create Button ─── */
  function createFloatButton() {
    if (floatBtn) return floatBtn;
    floatBtn = document.createElement("div");
    floatBtn.id = "easy-prompt-float-btn";
    floatBtn.innerHTML = ICON;
    floatBtn.title = "Easy Prompt 增强";
    floatBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const text = window.getSelection()?.toString().trim();
      if (text) {
        try {
          // 扩展更新/卸载后上下文可能失效, 需要 catch
          if (chrome.runtime?.id) {
            chrome.runtime.sendMessage({ type: "ENHANCE_TEXT", text });
          }
        } catch {
          /* Extension context invalidated — ignore */
        }
      }
      hideFloatButton();
    });
    document.body.appendChild(floatBtn);
    return floatBtn;
  }

  /* ─── Position ─── */
  function showFloatButton(x, y) {
    clearTimeout(hideTimer);
    const btn = createFloatButton();
    // Place button above selection, clamped to viewport (fixed positioning)
    const bw = 32,
      bh = 32,
      gap = 8;
    let left = x - bw / 2;
    let top = y - bh - gap;
    left = Math.max(4, Math.min(left, window.innerWidth - bw - 4));
    if (top < 4) top = y + gap; // Below if no room above
    btn.style.left = `${left}px`;
    btn.style.top = `${top}px`;
    btn.classList.add("is-visible");
  }

  function hideFloatButton() {
    if (!floatBtn) return;
    floatBtn.classList.remove("is-visible");
  }

  /* ─── Selection Listener ─── */
  document.addEventListener("mouseup", (e) => {
    // Ignore clicks on our own button
    if (
      e.target.id === "easy-prompt-float-btn" ||
      e.target.closest("#easy-prompt-float-btn")
    )
      return;

    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (text && text.length > 1) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        showFloatButton(rect.left + rect.width / 2, rect.top);
      } else {
        hideFloatButton();
      }
    }, 200);
  });

  // Hide on click elsewhere
  document.addEventListener("mousedown", (e) => {
    if (
      e.target.id !== "easy-prompt-float-btn" &&
      !e.target.closest("#easy-prompt-float-btn")
    ) {
      hideFloatButton();
    }
  });

  // Hide on scroll (RAF throttled)
  window.addEventListener(
    "scroll",
    () => {
      if (scrollRafPending) return;
      scrollRafPending = true;
      requestAnimationFrame(() => {
        hideFloatButton();
        scrollRafPending = false;
      });
    },
    { passive: true },
  );
})();
