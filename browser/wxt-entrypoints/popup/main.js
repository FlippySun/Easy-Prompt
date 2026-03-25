// ========================== 变更记录 ==========================
// [日期]     2026-03-24
// [类型]     新增功能
// [描述]     新增 WXT Popup 页面入口，负责加载样式与既有 Popup 逻辑模块。
// [思路]     维持原始 HTML 与 DOM 结构，只把资源装载职责转移到 WXT 入口，便于热更新与构建。
// [参数与返回值] 无外部参数与返回值；模块导入完成后由 popup.js 自行绑定页面事件。
// [影响范围] browser/wxt-entrypoints/popup/main.js、browser/popup/popup.js、browser/popup/popup.css。
// [潜在风险] 无已知风险。
// ==============================================================

import "../../popup/popup.css";
import "../../popup/popup.js";
