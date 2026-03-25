// ========================== 变更记录 ==========================
// [日期]     2026-03-24
// [类型]     新增功能
// [描述]     新增 WXT Options 页面入口，负责加载设置页样式与逻辑模块。
// [思路]     保持现有表单与行为不变，仅将资源组织方式切换到 WXT 约定。
// [参数与返回值] 无外部参数与返回值；模块导入完成后由 options.js 自行绑定页面事件。
// [影响范围] browser/wxt-entrypoints/options/main.js、browser/options/options.js、browser/options/options.css。
// [潜在风险] 无已知风险。
// ==============================================================

import "../../options/options.css";
import "../../options/options.js";
