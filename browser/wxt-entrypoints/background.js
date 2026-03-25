// ========================== 变更记录 ==========================
// [日期]     2026-03-24
// [类型]     新增功能
// [描述]     新增 WXT Background 入口，承接 Easy Prompt 的 MV3 Service Worker 初始化。
// [思路]     让 WXT 在 main() 中再调用 setupBackground()，避免构建期访问浏览器 API。
// [参数与返回值] 无外部参数；导出 defineBackground 配置对象，供 WXT 生成 manifest 与后台脚本。
// [影响范围] browser/wxt-entrypoints/background.js、browser/background/service-worker.js。
// [潜在风险] 为兼容 Firefox MV3 的 background.scripts 语义，当前不启用 ESM background type。
// ==============================================================

import { setupBackground } from "../background/service-worker.js";

export default defineBackground({
  main() {
    setupBackground();
  },
});
