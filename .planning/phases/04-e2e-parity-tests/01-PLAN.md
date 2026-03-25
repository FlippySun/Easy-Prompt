---
name: "04-e2e-parity-tests"
phase: 4
status: completed
created: "2026-03-25"
---

# Phase 4 Plan: E2E + Parity Tests

## Objective

建立 Playwright E2E 测试和跨平台 parity 测试，确保扩展质量和四平台一致性。

## Requirements

- [ ] **E2E-01**: 在 browser/ 子项目引入 Playwright 测试框架
- [ ] **E2E-02**: 浏览器扩展选项页面（Options）的 E2E 测试
- [ ] **E2E-03**: Popup UI E2E 测试（场景选择，增强流程）
- [ ] **E2E-04**: 多浏览器 E2E 测试（Chrome/Firefox/Edge，通过 Playwright launch options）
- [ ] **E2E-05**: 跨平台 parity 测试：browser/shared/api.js vs core/api.js 行为一致
- [ ] **E2E-06**: 跨平台 parity 测试：browser/shared/router.js vs core/router.js 行为一致
- [ ] **E2E-07**: CI 集成：在根目录 GitHub Actions 中添加 browser test 任务
- [ ] **E2E-08**: 测试覆盖率报告（Vitest coverage）

## Success Criteria

1. `cd browser && npx playwright test` 成功运行所有 E2E 测试
2. Options 页面表单填写和保存测试就绪
3. Popup 场景选择和增强流程测试就绪
4. Playwright 配置支持 Chrome / Firefox / Edge 三浏览器
5. GitHub Actions workflow 包含 4 个 jobs（unit/build/E2E/typecheck）
6. 覆盖率报告生成配置就绪

## Files Created

- `browser/playwright.config.ts` — Playwright 多浏览器配置（Chromium/Firefox/Edge）
- `browser/e2e/options.spec.ts` — 12 个 Options 页面 E2E 测试用例
- `browser/e2e/popup.spec.ts` — 7 个 Popup UI E2E 测试用例
- `browser/e2e/helpers/launch-ext.ts` — 扩展上下文 fixture
- `.github/workflows/browser-test.yml` — GitHub Actions CI 工作流
- `browser/package.json` — 添加 test:e2e / playwright:install 脚本

## CI Pipeline

1. **unit-tests**: Vitest + parity tests
2. **build-browsers**: All 4 browsers (Chrome/Firefox/Safari/Edge)
3. **e2e-tests**: Playwright on all 3 engines (Chromium/Firefox/Edge)
4. **typecheck**: TypeScript type check

---
*Created: 2026-03-25*
