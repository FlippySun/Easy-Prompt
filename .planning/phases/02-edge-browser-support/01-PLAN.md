---
name: "02-edge-browser-support"
phase: 2
status: completed
created: "2026-03-25"
---

# Phase 2 Plan: Edge Browser Support

## Objective

在 WXT 配置中添加 Microsoft Edge 浏览器支持，使扩展可上架 Microsoft Add-ons 商店。

## Requirements

- [ ] **EDGE-01**: 在 `wxt.config.ts` 的 manifest hook 中添加 Edge 浏览器检测
- [ ] **EDGE-02**: 为 Edge 添加 `browser_specific_settings.edge` 配置
- [ ] **EDGE-03**: Edge 构建生成有效 zip 包，manifest 通过 Microsoft 验证
- [ ] **EDGE-04**: 更新 README 文档，添加 Edge 安装说明（加载扩展或 Microsoft Add-ons）
- [ ] **EDGE-05**: 验证 Edge 扩展权限和功能与 Chrome 一致

## Success Criteria

1. `wxt.config.ts` 中可检测 `browser === "edge"` 并生成对应 manifest
2. Edge 构建输出到 `browser/dist/edge-mv3/` 目录
3. README.md 中包含 Edge 安装步骤
4. Edge manifest 包含 `browser_specific_settings.edge.strict_min_version: "130"`

## Execution Notes

- WXT 原生支持 Edge，通过 `-b edge` 参数即可
- Edge manifest 使用 `browser_specific_settings.edge.strict_min_version: "130"`
- browser/package.json 添加了 build:edge / dev:edge / zip:edge 脚本
- README.md 更新了 Edge 安装说明

## Files Changed

- `browser/wxt.config.ts` — manifest hook 添加 Edge 检测
- `browser/package.json` — 添加 edge 构建脚本
- `README.md` — 添加 Edge 安装说明

---
*Created: 2026-03-25*
