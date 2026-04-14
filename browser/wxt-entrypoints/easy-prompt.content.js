// ========================== 变更记录 ==========================
// [日期]     2026-03-24
// [类型]     新增功能
// [描述]     新增 WXT Content Script 入口，用于接管现有网页内联增强脚本与样式注入。
// [思路]     入口文件负责声明匹配规则、注入 MAIN world skill panel 注册器，
//            再异步加载既有 isolated content.js，兼顾页面主世界 customElements
//            与扩展 API 能力。
// [参数与返回值] 无外部参数；导出 defineContentScript 配置对象，main() 先注入
//               主世界注册脚本，再加载既有内容脚本。
// [影响范围] browser/wxt-entrypoints/easy-prompt.content.js、browser/wxt-entrypoints/skill-panel-main-world.js、browser/content/content.js。
// [潜在风险] 若页面 CSP 拦截 injected main-world script，则 skill panel 仍需浏览器专用降级方案。
// ==============================================================

import { injectScript } from "wxt/utils/inject-script";

import "../content/content.css";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  cssInjectionMode: "manifest",
  async main() {
    try {
      await injectScript("/skill-panel-main-world.js");
    } catch (error) {
      console.warn(
        "[Easy Prompt] Skill panel main-world registrar injection failed:",
        error,
      );
    }
    await import("../content/content.js");
  },
});
