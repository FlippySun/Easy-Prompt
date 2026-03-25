// ========================== 变更记录 ==========================
// [日期]     2026-03-24
// [类型]     新增功能
// [描述]     新增 WXT Content Script 入口，用于接管现有网页内联增强脚本与样式注入。
// [思路]     入口文件只负责声明匹配规则与注入时机，具体交互逻辑继续复用既有 content.js，降低迁移成本。
// [参数与返回值] 无外部参数；导出 defineContentScript 配置对象，main() 在页面命中后异步加载旧脚本。
// [影响范围] browser/wxt-entrypoints/easy-prompt.content.js、browser/content/content.js、browser/content/content.css。
// [潜在风险] 若后续 content.js 在顶层依赖构建期变量，需要继续保持只在 main() 内动态导入。
// ==============================================================

import "../content/content.css";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  cssInjectionMode: "manifest",
  async main() {
    await import("../content/content.js");
  },
});
