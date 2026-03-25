---
name: "03-unified-test-runner"
phase: 3
status: completed
created: "2026-03-25"
---

# Phase 3 Plan: Unified Test Runner

## Objective

在 browser/ 和根目录搭建 Vitest 单元测试框架，为共享模块建立可维护的测试覆盖。

## Requirements

- [ ] **TEST-01**: 在 browser/ 子项目引入 Vitest 测试框架
- [ ] **TEST-02**: 为 `browser/shared/api.js` 添加单元测试（4 种 API 模式调用）
- [ ] **TEST-03**: 为 `browser/shared/router.js` 添加单元测试（场景路由逻辑）
- [ ] **TEST-04**: 为 `browser/shared/storage.js` 添加单元测试（配置加载/保存）
- [ ] **TEST-05**: 在根目录 `core/` 模块添加 Vitest 测试
- [ ] **TEST-06**: 配置 Vitest 与 Vite/TypeScript 兼容（tsconfig.json vitest aware）
- [ ] **TEST-07**: 根目录 package.json 添加 `test:unit` 脚本，browser/ 添加 `test:unit` 脚本
- [ ] **TEST-08**: `test.js` / `test-full.js` 迁移为 Vitest 测试格式（或保留作为 smoke test）

## Success Criteria

1. `npm run test:unit` 在 browser/ 成功运行，输出测试报告
2. `npm run test:parity` 在根目录成功运行
3. Vitest 配置与 browser/tsconfig.json 正确集成
4. 所有测试文件在 `browser/__tests__/` 目录下
5. `test.js` 场景数量警告已修复（85 → 97）
6. 测试覆盖率报告生成（Vitest --coverage）

## Files Created

- `browser/vitest.config.js` — Vitest 配置（jsdom 环境）
- `browser/__tests__/api.test.js` — 49 个测试（API 层）
- `browser/__tests__/router.test.js` — 41 个测试（路由器）
- `tests/test-parity.js` — 23 个跨平台 parity 测试
- `browser/package.json` — 添加 test:unit / test:unit:watch 脚本
- `package.json` — 添加 test:parity 脚本

## Test Results

- **90 Vitest unit tests** passing
- **23 parity tests** passing
- All tests run clean with zero failures

---
*Created: 2026-03-25*
