// ========================== 变更记录 ==========================
// [日期]     2026-04-13
// [类型]     新增
// [描述]     Web 端引入 Vite 构建工具配置
// [思路]     使用 Vite 替代纯静态文件加载，获得 HMR、ESM 模块化、
//            构建优化等能力，为后续与浏览器插件端共享组件打基础。
//            配置保持最小化：仅指定 root/publicDir/build 输出。
// [影响范围] web/ 目录开发与构建流程
// [潜在风险] deploy.sh 中 web target 需适配 build 产物路径
// ==============================================================

import { defineConfig } from "vite";

export default defineConfig({
  // 项目根目录即 web/
  root: ".",

  // 静态资源目录（scenes.json、字体 CSS 等不经 Vite 处理）
  publicDir: "public",

  server: {
    port: 5174,
    open: true,
  },

  build: {
    // 构建产物输出到 web/dist/
    outDir: "dist",
    emptyOutDir: true,

    // 兼容性：支持原生 ESM 的浏览器即可
    target: "es2020",

    rollupOptions: {
      input: "index.html",
    },
  },
});
