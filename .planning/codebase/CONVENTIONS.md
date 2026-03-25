# Code Conventions

**Analysis Date:** 2026-03-24

## Module Style

**Main enhancer code:**
- Root and shared JS use CommonJS exports/imports — `core/index.js`, `core/router.js`, `extension.js`, `welcomeView.js`
- Browser extension uses plain scripts plus browser globals/importScripts rather than ES modules — `browser/background/service-worker.js`, `browser/shared/*.js`, `browser/popup/popup.js`
- Web app is plain browser JS in one file rather than componentized modules — `web/app.js`
- IntelliJ code follows standard Kotlin classes/packages — `intellij/src/main/kotlin/com/easyprompt/**`
- PromptHub follows modern TS/React module conventions — `web-hub/src/app/**/*.tsx`

## Naming Patterns

- Functions and variables are mostly `camelCase`
- Constants are mostly `UPPER_SNAKE_CASE` (`MAX_INPUT_LENGTH`, `DEFAULT_API_PATHS`, `HOT_SCENES`)
- Scene IDs use kebab-case string keys (`split-task`, `api-design`, `design-brief`)
- UI state variables often begin with `_` when intended as module-private (`_historyData`, `_builtinCache`, `_listeners`)
- IntelliJ classes use descriptive suffixes like `Action`, `Settings`, `Configurable`, `ToolWindowFactory`

## Reuse Patterns

**Canonical-vs-port pattern:**
- VS Code + root tests use `core/`
- Browser reimplements equivalent behavior in `browser/shared/`
- Web ports similar logic inline into `web/app.js`
- IntelliJ ports similar logic into Kotlin files under `intellij/src/main/kotlin/com/easyprompt/core/`

**Configuration fallback pattern:**
- User settings first
- Legacy base URL migration second
- Builtin encrypted defaults last
- Seen in `extension.js`, `browser/background/service-worker.js`, `web/app.js`, `EasyPromptSettings.kt` / `ApiClient.kt`

## Error Handling Conventions

- Provider/transport errors are normalized through `friendlyError(...)`
- Retry behavior is limited to a short allowlist of transient/network/provider overload patterns
- User-visible messages are localized mostly in Chinese
- Browser/web/desktop each keep their own variant of the same error taxonomy

## UI / Rendering Conventions

- VS Code webviews and some browser UI are assembled with large template strings rather than separate templates/components — `extension.js`, `welcomeView.js`
- Browser popup/options use helper shorthands like `$()` / `$$()` and direct DOM mutation
- Browser popup uses safe parsing helper `_setHTML()` instead of raw `innerHTML` in some paths for AMO compliance — `browser/popup/popup.js`
- PromptHub alone uses declarative React components and route-level lazy loading — `web-hub/src/app/routes.tsx`

## Comments and Documentation Style

- Comments are generally bilingual or Chinese-first with English product framing
- Larger files often include section banners and sometimes change-log comment blocks, e.g. `core/api.js`, `web/app.js`
- Comment quality is uneven: some files are heavily documented while others rely on implicit behavior
- Repository includes multiple markdown docs at root, but product code is still the source of truth for platform parity

## Storage and Data Conventions

- History lists are capped at 100 records across VS Code, browser, web and IntelliJ implementations
- Theme/config/history keys are stored in local platform-specific stores rather than a versioned schema layer
- Scene names are cached in maps derived from scene definitions (`SCENE_NAMES`, `_sceneNames`)

## Testing / Quality Conventions Observed

- Quality checks are mostly ad-hoc scripts and manual tests rather than a unified test framework
- PromptHub is the only subproject with explicit lint/format/typecheck tooling (`web-hub/eslint.config.js`, `web-hub/package.json`)
- No repo-wide formatter/linter config governs the plain JS root/browser/web code

## Practical Guidance for New Changes

- Mirror behavior changes across `core/`, browser, web and IntelliJ when touching provider logic or routing semantics
- Prefer keeping user-facing config names aligned (`apiMode`, `apiHost`, `apiPath`, `model`, `enhanceMode`)
- Be cautious when editing large UI template strings in `extension.js`, `welcomeView.js`, `web/app.js`
- Validate browser changes in popup, background and content-script paths together because they communicate via storage + runtime messaging

---

## Artifact 与变更验证规则

> **背景（2026-03-25 事故）：** Phase 2 SUMMARY 声称 EDGE-04 更新了 README.md 添加 Edge 文档，但实际 commit 中该文件从未包含 Edge 内容。SUMMARY 复制了 commit message 而非核实实际变更，导致虚假的完成记录进入文档。**本规则组旨在防止此类 SUMMARY 与实际代码脱节的问题再次发生。**

### A. SUMMARY 内容约束

SUMMARY 中的每一条"已完成的变更"**必须**包含以下两类信息：

**1. 文件路径 + 内容验证方式（代码/文档改动通用）**

```markdown
4. **EDGE-04** — README.md 更新：
   - 文件: `browser/README.md`
   - 验证: `grep -qi "edge" browser/README.md`
   - 内容片段: "edge://extensions"、"build:edge"、"Microsoft Add-ons"
```

**禁止**只写功能描述而不列举文件路径。禁止如下写法：

```markdown
❌ 4. **EDGE-04** — README.md 更新：badge 添加 Edge、安装说明添加 Edge
✅ 4. **EDGE-04** — README.md 更新：
   - 文件: `browser/README.md`
   - 验证: `grep -qi "edge" browser/README.md`
```

**2. 明确区分"代码改动"与"文档改动"**

- **代码改动**：写清文件路径 + 关键 diff 片段（至少一行）
- **文档改动**：写清文件路径 + grep/内容验证命令或关键内容片段
- **禁止**在 SUMMARY 中用 commit message 代替实际核实

### B. Artifact 创建时的自检流程

在生成 SUMMARY 之前，必须执行以下自检：

1. **读文件核实**：对 SUMMARY 中声称修改的每个文件，执行 `Read` 工具确认实际内容
2. **grep 验证**：对文档改动，执行 `Grep` 工具验证声称包含的关键字确实存在
3. **git diff 核实**：对代码改动，确认关键 diff 存在
4. **禁止跳过**：不允许仅凭 commit message 或 git log 判断变更完成

### C. UAT 与 Summary 的一致性

UAT 中的每一条测试用例必须：
- 对应 SUMMARY 中声称的变更
- 对应实际 commit 中的文件路径
- 如有不一致，**UAT 优先**——SUMMARY 必须修正

### D. CI 友好验证格式

建议每个 phase 的 SUMMARY 在 "Verification" 区块中使用结构化格式：

```bash
# 每条变更的验证命令（可被脚本解析）
verify:EDGE-04="grep -qi 'edge' browser/README.md"
```

---

*Convention analysis completed against repository state on 2026-03-24.*
