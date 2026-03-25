---
name: "01-wxt-migration-cleanup"
phase: 1
status: completed
created: "2026-03-25"
---

# Phase 1 Plan: WXT Migration Cleanup

## Objective

完成 WXT 迁移的最后收尾工作，删除残留旧文件，验证三浏览器（Chrome/Firefox/Safari）构建正常。

## Requirements

- [ ] **MIG-01**: 删除 `browser/options/options.html` 旧文件，确认 WXT entrypoints 完全接管
- [ ] **MIG-02**: 验证 Chrome MV3 WXT 构建生成有效 zip 包
- [ ] **MIG-03**: 验证 Firefox MV3 WXT 构建生成有效 zip 包
- [ ] **MIG-04**: 验证 Safari MV3 WXT 构建生成有效 zip 包
- [ ] **MIG-05**: 删除残留的未使用目录 `browser/entrypoints/`（迁移中产生）
- [ ] **MIG-06**: 更新 `test.js` 场景数量警告（从 85 更新到 97）

## Success Criteria

1. `browser/options/options.html` 文件已删除，git status 确认
2. `browser/entrypoints/` 目录不存在
3. `npm run build:chrome` 成功，输出 `browser/dist/chrome-mv3/` 包含有效构建
4. `npm run build:firefox` 成功，输出 `browser/dist/firefox-mv3/` 包含有效构建
5. `npm run build:safari` 成功，输出 `browser/dist/safari-mv3/`
6. `test.js` 输出无场景数量警告（已修复为 97）

## Execution Notes

- `browser/options/options.html` 已从 git 中删除（状态：deleted in git index）
- `browser/entrypoints/` 目录不存在
- 三浏览器构建全部通过 WXT 验证
- `test.js` 已修复场景数量（85 → 97）

---
*Created: 2026-03-25*
