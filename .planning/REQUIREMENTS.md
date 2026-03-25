# Requirements: Easy Prompt — Browser Platform Polish

**Defined:** 2026-03-25
**Core Value:** 让用户在任意浏览器环境中，随时获得专业级 Prompt 增强体验，并确保跨 Chrome / Firefox / Safari / Edge 四浏览器平台的一致性与高质量。

## v1 Requirements

### 平台迁移（MIG-）

- [ ] **MIG-01**: 删除 `browser/options/options.html` 旧文件，确认 WXT entrypoints 完全接管
- [ ] **MIG-02**: 验证 Chrome MV3 WXT 构建生成有效 zip 包
- [ ] **MIG-03**: 验证 Firefox MV3 WXT 构建生成有效 zip 包
- [ ] **MIG-04**: 验证 Safari MV3 WXT 构建生成有效 zip 包
- [ ] **MIG-05**: 删除残留的未使用目录 `browser/entrypoints/`（迁移中产生）
- [ ] **MIG-06**: 更新 `test.js` 场景数量警告（从 85 更新到 97）

### Edge 浏览器支持（EDGE-）

- [ ] **EDGE-01**: 在 `wxt.config.ts` 的 manifest hook 中添加 Edge 浏览器检测
- [ ] **EDGE-02**: 为 Edge 添加 `browser_specific_settings.gecko` 等效配置（Microsoft Add-ons）
- [ ] **EDGE-03**: Edge 构建生成有效 zip 包，manifest 通过 Microsoft 验证
- [ ] **EDGE-04**: 更新 README 文档，添加 Edge 安装说明（加载扩展或 Microsoft Add-ons）
- [ ] **EDGE-05**: 验证 Edge 扩展权限和功能与 Chrome 一致

### 统一测试运行器（TEST-）

- [ ] **TEST-01**: 在 browser/ 子项目引入 Vitest 测试框架
- [ ] **TEST-02**: 为 `browser/shared/api.js` 添加单元测试（4 种 API 模式调用）
- [ ] **TEST-03**: 为 `browser/shared/router.js` 添加单元测试（场景路由逻辑）
- [ ] **TEST-04**: 为 `browser/shared/storage.js` 添加单元测试（配置加载/保存）
- [ ] **TEST-05**: 在根目录 `core/` 模块添加 Vitest 测试
- [ ] **TEST-06**: 配置 Vitest 与 Vite/TypeScript 兼容（tsconfig.json vitest aware）
- [ ] **TEST-07**: 根目录 package.json 添加 `test:unit` 脚本，browser/ 添加 `test:unit` 脚本
- [ ] **TEST-08**: `test.js` / `test-full.js` 迁移为 Vitest 测试格式（或保留作为 smoke test）

### 自动化回归 + Parity 测试（E2E-）

- [ ] **E2E-01**: 在 browser/ 子项目引入 Playwright 测试框架
- [ ] **E2E-02**: 浏览器扩展选项页面（Options）的 E2E 测试（Vitest+Playwright）
- [ ] **E2E-03**: Popup UI E2E 测试（场景选择、增强流程）
- [ ] **E2E-04**: 多浏览器 E2E 测试（Chrome/Firefox/Edge，通过 Playwright launch options）
- [ ] **E2E-05**: 跨平台 parity 测试：browser/shared/api.js vs core/api.js 行为一致
- [ ] **E2E-06**: 跨平台 parity 测试：browser/shared/router.js vs core/router.js 行为一致
- [ ] **E2E-07**: CI 集成：在根目录 GitHub Actions 中添加 browser test 任务
- [ ] **E2E-08**: 测试覆盖率报告（Vitest coverage）

## v2 Requirements

### 跨平台一致性监控

- **PARITY-01**: 添加 CI 检查，检测 core/ 与 browser/shared/ 代码 drift
- **PARITY-02**: 场景数量一致性检查（core/scenes.js vs browser/shared/scenes.js）
- **PARITY-03**: API 默认值一致性检查（core/defaults.js vs browser/shared/defaults.js）

### Content Script 测试

- **CONTENT-01**: Content script 与 background 消息通信的自动化测试
- **CONTENT-02**: 22 个 AI 网站适配器的回归测试
- **CONTENT-03**: Smart Nudge 自动弹出功能的 E2E 测试

### Safari 专项

- **SAFARI-01**: Safari 扩展签名和发布流程自动化
- **SAFARI-02**: Safari 内容安全策略合规性测试

## Out of Scope

| Feature | Reason |
|---------|--------|
| Web / IntelliJ / VSCode 端改动 | 属于其他里程碑 |
| PromptHub 应用改动 | 独立演进 |
| API 多模式实现（web/app.js、IntelliJ） | v5.3 遗留任务，独立 track |
| 移动端浏览器支持（iOS Safari/Android Chrome） | 需要独立测试基础设施 |
| 性能基准测试 | 可在 v2 中添加 |
| Lighthouse CI 集成 | 可在 v2 中添加 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MIG-01 | Phase 1 | ✅ Complete |
| MIG-02 | Phase 1 | ✅ Complete |
| MIG-03 | Phase 1 | ✅ Complete |
| MIG-04 | Phase 1 | ✅ Complete |
| MIG-05 | Phase 1 | ✅ Complete |
| MIG-06 | Phase 1 | ✅ Complete |
| EDGE-01 | Phase 2 | ✅ Complete |
| EDGE-02 | Phase 2 | ✅ Complete |
| EDGE-03 | Phase 2 | ✅ Complete |
| EDGE-04 | Phase 2 | ✅ Complete |
| EDGE-05 | Phase 2 | ✅ Complete |
| TEST-01 | Phase 3 | ✅ Complete |
| TEST-02 | Phase 3 | ✅ Complete |
| TEST-03 | Phase 3 | ✅ Complete |
| TEST-04 | Phase 3 | ✅ Complete |
| TEST-05 | Phase 3 | ✅ Complete |
| TEST-06 | Phase 3 | ✅ Complete |
| TEST-07 | Phase 3 | ✅ Complete |
| TEST-08 | Phase 3 | ✅ Complete |
| E2E-01 | Phase 4 | ✅ Complete |
| E2E-02 | Phase 4 | ✅ Complete |
| E2E-03 | Phase 4 | ✅ Complete |
| E2E-04 | Phase 4 | ✅ Complete |
| E2E-05 | Phase 4 | ✅ Complete |
| E2E-06 | Phase 4 | ✅ Complete |
| E2E-07 | Phase 4 | ✅ Complete |
| E2E-08 | Phase 4 | ✅ Complete |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Completed: 27 ✅
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after v5.4 milestone initialization*
