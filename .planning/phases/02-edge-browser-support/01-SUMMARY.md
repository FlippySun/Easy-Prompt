---
name: "02-edge-browser-support"
phase: 2
status: complete
---

# Phase 2 Summary: Edge Browser Support

## Outcome

Microsoft Edge 浏览器支持已添加，扩展现在支持 Chrome/Firefox/Safari/Edge 四大浏览器。

## What Was Done

1. **EDGE-01** — `wxt.config.ts` manifest hook 中添加 `browser === "edge"` 检测分支
   - 文件: `browser/wxt.config.ts`
   - diff: `+ browser === "edge"` 分支，添加 `browser_specific_settings.edge.strict_min_version: "130"`
   - 验证: `git show HEAD -- browser/wxt.config.ts | grep -A5 'browser === "edge"'`

2. **EDGE-02** — Edge 添加 `browser_specific_settings.edge.strict_min_version: "130"`
   - 文件: `browser/wxt.config.ts`
   - diff: `+ edge: { strict_min_version: "130" }`
   - 验证: `grep -q "strict_min_version" browser/wxt.config.ts`

3. **EDGE-03** — Edge MV3 构建通过
   - 文件: `browser/dist/edge-mv3/`（构建产物）
   - 验证: `npm run build:edge` → 313.66 kB，`dist/edge-mv3/manifest.json` 包含 `"browser_specific_settings": { "edge": { "strict_min_version": "130" } }`

4. **EDGE-04** — README.md 更新（2026-03-25 修正）：
   - 文件: `browser/README.md`（初始 commit `0a2cb15` 未包含 Edge 内容，见 Errata）
   - 验证: `grep -qi "edge" browser/README.md`
   - 内容: Edge 安装步骤（`edge://extensions`）、`dev:edge`/`build:edge` 命令、§7 Edge 加载指南
   - 修正 commit: `3104716` — docs(browser): add Edge support to browser README

5. **EDGE-05** — Edge manifest 与 Chrome 一致
   - 文件: `browser/dist/edge-mv3/manifest.json`
   - 验证: `grep -q "service_worker" browser/dist/edge-mv3/manifest.json`

## Verification

```bash
npm run build:edge  # 313.66 kB, dist/edge-mv3/
# manifest.json 包含: "browser_specific_settings": { "edge": { "strict_min_version": "130" } }
grep -qi "edge" browser/README.md  # §7 Edge 加载指南存在
```

## Files Modified

- `browser/wxt.config.ts` — manifest hook 添加 Edge 分支
- `browser/package.json` — 添加 build:edge / dev:edge / zip:edge / build:all / zip:all 脚本
- `browser/README.md` — 更新 badge + 浏览器安装说明（初始 commit 未包含 Edge，2026-03-25 修正）

## Git Commits

- `b083f1f` — feat(browser): add Microsoft Edge support via WXT
- `0a2cb15` — docs(browser): add browser README with Edge support documentation（内容缺失，见 Errata）
- `3104716` — docs(browser): add Edge support to browser README（补充 Edge 内容）

---

## Errata

| 日期 | 修正内容 | 原因 |
|------|----------|------|
| 2026-03-25 | EDGE-04：补充 README.md 中 Edge 内容验证方式和修正 commit | 初始 `0a2cb15` commit 声称 README 包含 Edge 文档，但未执行 Grep 核实；实际文件中无 Edge 内容。后续 `3104716` 才真正添加了 Edge 相关章节、命令和构建产物记录。 |

---

*Completed: 2026-03-25*
*Last corrected: 2026-03-25*
