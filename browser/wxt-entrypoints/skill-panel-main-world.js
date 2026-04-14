import { defineUnlistedScript } from "wxt/utils/define-unlisted-script";

import "../../shared-ui/skill-panel.js";
import skillPanelCss from "../../shared-ui/skill-panel.css?raw";

// ========================== 变更记录 ==========================
// [日期]     2026-04-13
// [类型]     新增 / 修复
// [描述]     新增 MAIN world skill panel 注册器：在页面主世界中注册
//            <ep-skill-panel>，并在主世界内预注入 CSS，供隔离 content script
//            后续通过 document.createElement("ep-skill-panel") 直接消费。
// [思路]     Chrome/WXT 的 isolated content script 中 customElements registry
//            不可用；因此将自定义元素注册下沉到主世界，同时保留原 content
//            script 的 extension API 能力。
// [参数与返回值] 无外部参数；执行后在主世界完成 custom element 注册与 CSS 注入。
// [影响范围] browser/wxt-entrypoints/easy-prompt.content.js、browser/content/content.js、shared-ui/skill-panel.js。
// [潜在风险] 若目标站点 CSP 拦截主世界脚本注入，则仍需进一步改为浏览器端非 Custom Element 方案。
// ==============================================================

function getCustomElementRegistry() {
  if (typeof globalThis !== "undefined" && globalThis.customElements) {
    return globalThis.customElements;
  }
  if (typeof window !== "undefined" && window.customElements) {
    return window.customElements;
  }
  if (
    typeof document !== "undefined" &&
    document.defaultView &&
    document.defaultView.customElements
  ) {
    return document.defaultView.customElements;
  }
  return null;
}

export default defineUnlistedScript(() => {
  const registry = getCustomElementRegistry();
  const EpSkillPanel = registry ? registry.get("ep-skill-panel") : null;

  if (!EpSkillPanel) {
    console.warn(
      "[Easy Prompt] Skill panel main-world registrar could not resolve ep-skill-panel.",
    );
    return;
  }

  if (EpSkillPanel.injectCss) {
    EpSkillPanel.injectCss(skillPanelCss);
  }
});
