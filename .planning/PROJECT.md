# Easy Prompt — Browser Platform Polish Milestone

## What This Is

Easy Prompt 是一个多平台 AI 智能 Prompt 增强工具（v5.4），通过两步意图识别 + 专业场景路由，将简单描述自动扩写为大师级 Prompt。当前项目已完成 **v5.4 里程碑**（Browser Platform Polish），建立了完整的浏览器扩展测试体系，支持 Chrome / Firefox / Safari / Edge 四浏览器平台。

## Core Value

让用户在任意浏览器环境中，随时获得专业级 Prompt 增强体验，并确保跨四浏览器平台的一致性与高质量。

## Requirements

### Validated

- ✓ 浏览器扩展支持 Chrome MV3 — v5.4 完成
- ✓ 浏览器扩展支持 Firefox MV3 — v5.4 完成
- ✓ 浏览器扩展支持 Safari MV3 — v5.4 完成
- ✓ WXT 0.20.20 构建系统 — v5.4 完成
- ✓ WXT popup/background/content 入口点已创建 — v5.4 完成
- ✓ PNG 图标集（16/32/48/128px）已生成 — v5.4 完成
- ✓ SVG 图标集已生成 — v5.4 完成
- ✓ browser/shared 共享模块（api/storage/router/scenes/defaults/icons）保留 — v5.4 完成
- ✓ Microsoft Edge 浏览器支持（Chromium 内核）— v5.4 完成
- ✓ Vitest 单元测试框架（90 tests）— v5.4 完成
- ✓ Playwright E2E 测试框架（Chromium/Firefox/Edge）— v5.4 完成
- ✓ 跨平台 parity 测试（23 tests, browser ↔ core）— v5.4 完成
- ✓ GitHub Actions CI 流水线（4 jobs）— v5.4 完成
- ✓ WXT 迁移清理完成 — v5.4 完成

### Active

- [ ] web/app.js — 4-mode API 支持（claude/gemini）、fetchModels、settings UI 更新
- [ ] intellij/ApiClient.kt — 4-mode callApiOnce + fetchModels
- [ ] intellij/EasyPromptSettings.kt — apiMode/apiHost/apiPath 字段
- [ ] intellij/EasyPromptConfigurable.kt — mode dropdown + host/path + fetch models
- [ ] Safari 应用商店签名和发布流程自动化（v5.5）

### Out of Scope

- Web / IntelliJ / VSCode 端的 UI 改动（API 逻辑除外）— 属于其他里程碑
- PromptHub 应用改动
- 移动端浏览器支持（iOS Safari/Android Chrome）— 需要独立测试基础设施
- Lighthouse CI 集成

## Context

### 浏览器扩展当前状态（v5.4 完成）

**已完成：**
- `browser/wxt.config.ts` — WXT 主配置，支持 Chrome/Firefox/Safari/Edge 四浏览器
- `browser/wxt-entrypoints/` — 有效入口（background/popup/options/content）
- `browser/public/` — scenes.json、icons/
- `browser/tsconfig.json` + `wxt-env.d.ts`
- `browser/vitest.config.js` + `browser/__tests__/` — 90 Vitest 测试
- `browser/e2e/` — Playwright E2E（options/popup），支持 Chromium/Firefox/Edge
- `browser/playwright.config.ts`
- `.github/workflows/browser-test.yml` — CI：unit-tests / build-browsers / e2e-tests / typecheck

**残留待清理（v5.5+）：**
- `browser/popup/popup.js` / `popup.css` — 尚未迁移到 WXT popup
- `browser/background/service-worker.js` — 尚未迁移到 WXT background
- `browser/content/content.js` / `content.css` — 尚未迁移到 WXT content

### 测试现状（v5.4）

- ✅ Vitest — 90 个单元测试（browser/shared api + router）
- ✅ Playwright — E2E 测试（Chromium/Firefox/Edge）
- ✅ Parity — 23 个跨平台一致性测试
- ✅ CI — GitHub Actions 4-job 流水线

## Constraints

- **WXT 框架**：使用 WXT 0.20.20 构建系统
- **Edge 兼容性**：Edge 基于 Chromium，与 Chrome 高度兼容，独立 `browser_specific_settings`
- **Firefox 特殊处理**：MV3 需 `background.scripts`（非 `service_worker`）
- **Safari 转换**：使用 `@sentry/safari-web-extension-cli`
- **跨平台 parity**：browser/shared 与 root core/ 行为需保持一致

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 使用 WXT 0.20.20 构建浏览器扩展 | 统一多浏览器构建流程，自动化 manifest 生成和打包 | ✓ 正确 |
| browser/options/options.js 重构为 ESM 模块 | 消除全局脚本注入顺序依赖，兼容 WXT entrypoints 模式 | ✓ 正确 |
| wxt-entrypoints 复用 browser/options/options.js | 避免重复逻辑，渐进式迁移 | ✓ 正确 |
| Options 页面保留旧 HTML 结构 | 渐进式迁移优先，保持功能稳定 | ✓ 正确 |
| Vitest 作为单元测试框架 | 轻量、快速、ESM-first，与 Vite 项目集成良好 | ✓ 正确，90 tests 通过 |
| Playwright 作为 E2E 测试框架 | 支持多浏览器、扩展测试（launchPersistentContext） | ✓ 正确，E2E + CI 完成 |
| Edge 支持通过 WXT manifest hook 实现 | 复用 Chromium 内核兼容代码，仅需独立 browser_specific_settings | ✓ 正确 |
| EDGE-04 README 更新 errata 发现 | 首次 commit 未实际写入 Edge 内容，后续修正 commit 补充 | ⚠️ 教训：Verify before claiming |
| Storage 模块跳过单元测试 | chrome.storage API 在 Node 环境不可 mock，依赖 E2E 覆盖 | ✓ 务实方案 |

---
*Last updated: 2026-03-27 after v5.4 milestone shipped*
