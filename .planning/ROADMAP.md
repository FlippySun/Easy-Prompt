# Roadmap: Easy Prompt v5.4 — Browser Platform Polish

**Phases:** 4 | **Requirements:** 27 | All v1 requirements covered ✓
**Created:** 2026-03-25

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | WXT Migration Cleanup | 完成 WXT 迁移收尾，确认三浏览器构建正常 | MIG-01~06 | 6 |
| 2 | Edge Browser Support | 新增 Microsoft Edge 浏览器支持 | EDGE-01~05 | 5 |
| 3 | Unified Test Runner | 搭建 Vitest 单元测试框架，覆盖共享模块 | TEST-01~08 | 8 |
| 4 | E2E + Parity Tests | 建立 Playwright E2E + 跨平台 parity 测试 | E2E-01~08 | 8 |

---

## Phase 1: WXT Migration Cleanup

**Goal:** 完成 WXT 迁移的最后收尾工作，删除残留旧文件，验证三浏览器（Chrome/Firefox/Safari）构建正常。

### Requirements

- [ ] **MIG-01**: 删除 `browser/options/options.html` 旧文件，确认 WXT entrypoints 完全接管
- [ ] **MIG-02**: 验证 Chrome MV3 WXT 构建生成有效 zip 包
- [ ] **MIG-03**: 验证 Firefox MV3 WXT 构建生成有效 zip 包
- [ ] **MIG-04**: 验证 Safari MV3 WXT 构建生成有效 zip 包
- [ ] **MIG-05**: 删除残留的未使用目录 `browser/entrypoints/`（迁移中产生）
- [ ] **MIG-06**: 更新 `test.js` 场景数量警告（从 85 更新到 97）

### Success Criteria

1. `browser/options/options.html` 文件已删除，git status 确认
2. `browser/entrypoints/` 目录已删除
3. `npm run build:browser -- chrome` 成功，输出 `browser/dist/chrome-mv3-prod/` 包含有效 zip
4. `npm run build:browser -- firefox` 成功，输出 `browser/dist/firefox/` 包含有效 zip
5. `npm run build:browser -- safari` 成功，输出 `browser/dist/safari/` 包含 `.safariextension` 包
6. `test.js` 输出无场景数量警告（或已修复为 97）

---

## Phase 2: Edge Browser Support

**Goal:** 在 WXT 配置中添加 Microsoft Edge 浏览器支持，使扩展可上架 Microsoft Add-ons 商店。

### Requirements

- [ ] **EDGE-01**: 在 `wxt.config.ts` 的 manifest hook 中添加 Edge 浏览器检测
- [ ] **EDGE-02**: 为 Edge 添加 `browser_specific_settings.gecko` 等效配置（Microsoft Add-ons）
- [ ] **EDGE-03**: Edge 构建生成有效 zip 包，manifest 通过 Microsoft 验证
- [ ] **EDGE-04**: 更新 README 文档，添加 Edge 安装说明（加载扩展或 Microsoft Add-ons）
- [ ] **EDGE-05**: 验证 Edge 扩展权限和功能与 Chrome 一致

### Success Criteria

1. `wxt.config.ts` 中可检测 `browser === "edge-chromium"` 并生成对应 manifest
2. Edge 构建输出到 `browser/dist/edge/` 目录
3. README.md 中包含 Edge 安装步骤
4. Edge 扩展在开发者模式加载后，popup/options/content script 均正常工作

### Edge Manifest 注意事项

- Edge 基于 Chromium，内核与 Chrome 兼容
- 需要 `browser_specific_settings` 配置（类似于 Firefox 的 gecko，但为 Edge 的 AppId）
- Edge 使用 Chrome Web Store 的部分 API，manifest 格式与 Chrome MV3 高度兼容
- Edge 支持 `chrome.storage`、`chrome.runtime`、`chrome.tabs` 等核心 API

---

## Phase 3: Unified Test Runner

**Goal:** 在 browser/ 和根目录搭建 Vitest 单元测试框架，为 shared 模块建立可维护的测试覆盖。

### Requirements

- [ ] **TEST-01**: 在 browser/ 子项目引入 Vitest 测试框架
- [ ] **TEST-02**: 为 `browser/shared/api.js` 添加单元测试（4 种 API 模式调用）
- [ ] **TEST-03**: 为 `browser/shared/router.js` 添加单元测试（场景路由逻辑）
- [ ] **TEST-04**: 为 `browser/shared/storage.js` 添加单元测试（配置加载/保存）
- [ ] **TEST-05**: 在根目录 `core/` 模块添加 Vitest 测试
- [ ] **TEST-06**: 配置 Vitest 与 Vite/TypeScript 兼容（tsconfig.json vitest aware）
- [ ] **TEST-07**: 根目录 package.json 添加 `test:unit` 脚本，browser/ 添加 `test:unit` 脚本
- [ ] **TEST-08**: `test.js` / `test-full.js` 迁移为 Vitest 测试格式（或保留作为 smoke test）

### Success Criteria

1. `npm run test:unit` 在根目录成功运行，输出测试报告
2. `cd browser && npm run test:unit` 成功运行，输出测试报告
3. Vitest 配置与 browser/tsconfig.json 正确集成
4. 所有测试文件在 `browser/__tests__/` 或 `browser/tests/` 目录下
5. 根 `test.js` 场景数量警告已修复（85 → 97）
6. 测试覆盖率报告生成（`--coverage`）

### 测试文件结构

```
browser/
├── __tests__/
│   ├── api.test.js          # 4 种 API 模式
│   ├── router.test.js       # 场景路由
│   ├── storage.test.js      # 配置存储（mock chrome.storage）
│   └── defaults.test.js     # 默认配置
├── vitest.config.ts
└── package.json (test:unit 脚本)

tests/root/
├── core-api.test.js         # core/api.js 等效测试
├── core-router.test.js      # core/router.js 等效测试
└── vitest.config.ts
```

---

## Phase 4: E2E + Parity Tests

**Goal:** 建立 Playwright E2E 测试和跨平台 parity 测试，确保扩展质量和四平台一致性。

### Requirements

- [ ] **E2E-01**: 在 browser/ 子项目引入 Playwright 测试框架
- [ ] **E2E-02**: 浏览器扩展选项页面（Options）的 E2E 测试（Vitest+Playwright）
- [ ] **E2E-03**: Popup UI E2E 测试（场景选择、增强流程）
- [ ] **E2E-04**: 多浏览器 E2E 测试（Chrome/Firefox/Edge，通过 Playwright launch options）
- [ ] **E2E-05**: 跨平台 parity 测试：browser/shared/api.js vs core/api.js 行为一致
- [ ] **E2E-06**: 跨平台 parity 测试：browser/shared/router.js vs core/router.js 行为一致
- [ ] **E2E-07**: CI 集成：在根目录 GitHub Actions 中添加 browser test 任务
- [ ] **E2E-08**: 测试覆盖率报告（Vitest coverage）

### Success Criteria

1. `cd browser && npx playwright test` 成功运行所有 E2E 测试
2. Options 页面表单填写和保存测试通过
3. Popup 场景选择和增强流程测试通过
4. Playwright 配置支持 Chrome / Firefox / Edge 三浏览器
5. Parity 测试在 `core/api.js` 和 `browser/shared/api.js` 上运行相同 fixture，产生一致结果
6. GitHub Actions workflow 包含 `test` job，运行所有测试
7. 覆盖率报告生成到 `coverage/` 目录

### Playwright 测试结构

```
browser/
├── e2e/
│   ├── options.spec.ts      # Options 页面测试
│   ├── popup.spec.ts        # Popup 界面测试
│   └── helpers/
│       └── launch-ext.ts    # 扩展加载辅助函数
├── playwright.config.ts
└── package.json (test:e2e 脚本)
```

### Parity 测试策略

- 在 `tests/parity/` 目录创建 parity 测试
- 共享测试 fixture（相同输入数据）在 `core/` 和 `browser/shared/` 等效模块上运行
- 比较输出断言一致性
- 使用 Vitest 的 `test.each` 或 `describe.each` 减少重复代码

---

## Phase Details Summary

### Phase 1: WXT Migration Cleanup
- **Goal:** 完成 WXT 迁移收尾，确认三浏览器构建正常
- **Requirements:** MIG-01~06
- **Success Criteria:** 6 项可观测行为
- **Dependencies:** 无
- **Parallelizable:** MIG-02/03/04 可并行（构建验证）

### Phase 2: Edge Browser Support
- **Goal:** 新增 Microsoft Edge 浏览器支持
- **Requirements:** EDGE-01~05
- **Success Criteria:** 5 项可观测行为
- **Dependencies:** Phase 1 完成（WXT 构建基础）
- **Parallelizable:** EDGE-04（文档）与 EDGE-01~03~05（代码）可并行

### Phase 3: Unified Test Runner
- **Goal:** 搭建 Vitest 单元测试框架，覆盖共享模块
- **Requirements:** TEST-01~08
- **Success Criteria:** 6 项可观测行为
- **Dependencies:** Phase 1 完成（browser/ 项目结构稳定）
- **Parallelizable:** TEST-02/03/04/05/08 可并行（独立测试文件）

### Phase 4: E2E + Parity Tests
- **Goal:** 建立 Playwright E2E 测试和跨平台 parity 测试
- **Requirements:** E2E-01~08
- **Success Criteria:** 7 项可观测行为
- **Dependencies:** Phase 3 完成（测试框架就绪）
- **Parallelizable:** E2E-02/03 可并行（独立 E2E 测试）；E2E-05/06 可并行（独立 parity 测试）

---

## 实施顺序说明

1. **Phase 1 → Phase 2 → Phase 3 → Phase 4**：严格顺序依赖
2. Phase 1 的完成确保 WXT 构建基础稳定，是后续所有阶段的前提
3. Phase 2 依赖 Phase 1 的 WXT 配置完整性
4. Phase 3 依赖 Phase 1 的 browser/ 项目结构
5. Phase 4 依赖 Phase 3 的测试框架基础设施

---
*Roadmap created: 2026-03-25*
