# Easy Prompt — Browser Platform Polish Milestone

## What This Is

Easy Prompt 是一个多平台 AI 智能 Prompt 增强工具（v5.3.6），通过两步意图识别 + 专业场景路由，将简单描述自动扩写为大师级 Prompt。当前项目正在进行 **v5.4 里程碑**（Browser Platform Polish），目标是将浏览器扩展从旧架构迁移到 WXT 统一构建系统，并建立完善的自动化测试体系。

## Core Value

让用户在任意浏览器环境中，随时获得专业级 Prompt 增强体验，并确保跨 Chrome / Firefox / Safari / Edge 四浏览器平台的一致性与高质量。

## Requirements

### Validated

- ✓ 浏览器扩展支持 Chrome MV3 — 现有
- ✓ 浏览器扩展支持 Firefox MV3 — 现有（使用 background.scripts 兼容）
- ✓ 浏览器扩展支持 Safari MV3 — 现有（使用 Safari Web Extension Adapter 转换）
- ✓ WXT 0.20.20 构建系统引入 — 2026-03-24 完成
- ✓ WXT popup/background/content 入口点已创建 — 2026-03-24 完成
- ✓ PNG 图标集（16/32/48/128px）已生成 — 2026-03-24 完成
- ✓ SVG 图标集已生成 — 2026-03-24 完成
- ✓ public/scenes.json 迁移到 WXT public 目录 — 2026-03-24 完成
- ✓ browser/shared 共享模块（api/storage/router/scenes/defaults/icons）保留 — 现有
- ✓ 旧 popup/options HTML + 脚本文件存在 — 待清理
- ✓ browser/options/options.js 已重构为 ESM 模块模式 — 2026-03-24 完成
- ✓ browser/options/options.css 保持复用 — 现有
- ✓ wxt-entrypoints/options/index.html + main.js 已创建（复用 options.js）— 2026-03-24 完成
- ✓ browser/options/options.html 旧文件残留 — 待删除

### Active

- [x] 删除 `browser/options/options.html` 旧文件，完成 WXT 迁移清理
- [x] 验证 Chrome / Firefox / Safari 三浏览器 WXT 构建正常
- [x] 新增 Microsoft Edge 浏览器支持（Chromium 内核，与 Chrome 类似）
- [x] WXT 配置中为 Edge 添加 manifest browser_specific_settings
- [x] 添加 Edge 应用商店发布配置
- [x] 建立统一测试运行器（Vitest）
- [x] 添加 browser/shared 共享模块的单元测试
- [x] 建立浏览器扩展端到端测试（Playwright + Chrome/Firefox/Edge）
- [x] 添加跨平台 parity 测试（browser vs core vs web）
- [x] CI 集成测试运行
- [x] 更新 `test.js` 场景数量警告（85 → 97）

### Out of Scope

- Web / IntelliJ / VSCode 端的修改 — 属于其他里程碑
- PromptHub 应用改动
- API 多模式实现（web/app.js、IntelliJ Kotlin 端）— 进行中，属于 v5.3 遗留任务
- Safari 应用商店签名和发布流程自动化

## Context

### 浏览器扩展当前状态

**已完成 WXT 迁移的部分：**
- `browser/wxt.config.ts` — 主配置文件，定义 manifest hook、Firefox 兼容性、图标
- `browser/wxt-entrypoints/background.js` — Service Worker 入口
- `browser/wxt-entrypoints/easy-prompt.content.js` — Content Script 入口
- `browser/wxt-entrypoints/popup/index.html` + `main.js` — Popup UI 入口
- `browser/wxt-entrypoints/options/index.html` + `main.js` — Options UI 入口（复用 `browser/options/options.js` 和 `options.css`）
- `browser/public/` — WXT public 目录（scenes.json、icons/）
- `browser/tsconfig.json` + `wxt-env.d.ts` — TypeScript 配置
- PNG + SVG 图标集（16/32/48/128px）
- `browser/package.json` + `package-lock.json` — 独立 WXT 依赖

**残留旧文件（需清理）：**
- `browser/options/options.html` — 应由 `wxt-entrypoints/options/index.html` 替代（冗余）
- `browser/popup/popup.html` — 已由 `wxt-entrypoints/popup/index.html` 替代（已删除，git 显示已删除）
- `browser/manifest.chrome.json` / `.firefox.json` / `.safari.json` — 已由 `wxt.config.ts` 动态生成（已删除）

**未完成迁移：**
- `browser/popup/popup.js` — 尚未迁移到 WXT popup 入口
- `browser/popup/popup.css` — 尚未迁移到 WXT popup 入口
- `browser/background/service-worker.js` — 尚未迁移到 WXT background 入口
- `browser/content/content.js` + `content.css` — 尚未迁移到 WXT content 入口

### 测试现状

- `test.js` — 根目录 Node 脚本，验证 scenes.js 导出，检查路由完整性（场景数量警告：85 vs 97）
- `test-full.js` — 更广泛的检查，包括 API key 加密验证、API 调用
- `test-api.js` — 实时 API 烟雾测试
- **无 Vitest / Jest 等单元测试框架**
- **无 Playwright 等 E2E 测试框架**
- **无跨平台 parity 测试**
- PromptHub 有完整的 lint + typecheck + build 脚本

### 关键架构文档

参考 `.planning/codebase/` 下的分析文档：
- `ARCHITECTURE.md` — 分层架构、Canonical-vs-Port 模式
- `CONCERNS.md` — 技术债务、测试缺口（P0 级别）
- `CONVENTIONS.md` — 命名规范、重用模式
- `STACK.md` — 技术栈（WXT 0.20.20 / Vitest / Playwright 待引入）
- `TESTING.md` — 当前测试缺口分析

## Constraints

- **WXT 框架**：必须使用 WXT 0.20.20 构建系统，不能回退到旧 manifest.json
- **Edge 兼容性**：Edge 基于 Chromium，manifest 与 Chrome 高度兼容，但需要独立的 `browser_specific_settings`
- **Firefox 特殊处理**：Firefox MV3 仍需 `background.scripts`（非 `service_worker`），已在 `wxt.config.ts` 中处理
- **Safari 转换**：使用 `@sentry/safari-web-extension-cli` 脚本从 Chrome MV3 转换，需验证兼容性
- **测试隔离**：browser/ 与根 core/ 测试需独立运行，browser/ 使用 Playwright + 浏览器扩展测试环境
- **跨平台 parity**：browser/ 的 `api.js` / `router.js` / `scenes.js` / `storage.js` 与根 `core/` 等效模块行为需保持一致

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 使用 WXT 0.20.20 构建浏览器扩展 | 统一多浏览器构建流程，自动化 manifest 生成和打包 | ✓ 正确，2026-03-24 已采用 |
| browser/options/options.js 重构为 ESM 模块 | 消除全局脚本注入顺序依赖，兼容 WXT entrypoints 模式 | ✓ 正确，已完成 |
| wxt-entrypoints 复用 browser/options/options.js | 避免重复逻辑，渐进式迁移 | ✓ 正确 |
| Options 页面保留旧 HTML 结构 | 渐进式迁移优先，保持功能稳定 | ✓ 正确 |
| Vitest 作为单元测试框架 | 轻量、快速、ESM-first，与 Vite 项目集成良好 | — Pending |
| Playwright 作为 E2E 测试框架 | 支持多浏览器、扩展测试（launchPersistentContext） | — Pending |
| Edge 支持通过 WXT manifest hook 实现 | 复用 Chromium 内核兼容代码，仅需独立 browser_specific_settings | — Pending |

---

*Last updated: 2026-03-25 after v5.4 milestone initialization*
