# GSD Workflow Standards

**创建日期：** 2026-03-25
**背景：** Phase 2 SUMMARY EDGE-04 虚报文档变更，SUMMARY 与实际代码脱节。本文档作为 GSD 工作流约束的单一入口，与 `CONVENTIONS.md` 中的 Artifact 验证规则协同生效。

---

## 1. 铁律：SUMMARY 必须独立核实，不得复制 commit message

SUMMARY 是"实际做了什么"的记录，不是 commit message 的副本。

**操作约束：**
- 在生成 SUMMARY 之前，**必须对每个声称修改的文件执行 Read/Grep 工具**，确认内容存在
- 不得仅凭 `git log`、`git diff --stat` 或 commit message 推断变更完成
- 对于文档改动，**必须执行 grep 验证**声称包含的关键字确实在文件中
- 对于代码改动，**必须读取文件或执行 git show 确认关键 diff 存在**

**违规示例：**

```markdown
# ❌ 错误：复制了 commit message，未核实实际内容
4. **EDGE-04** — README.md 更新：badge 添加 Edge、安装说明添加 Edge

# ✅ 正确：列举文件路径 + grep 验证
4. **EDGE-04** — README.md 更新：
   - 文件: `browser/README.md`
   - 验证: `grep -qi "edge" browser/README.md`
   - 内容: "edge://extensions"、"build:edge"、"Microsoft Add-ons"
```

---

## 2. 每条变更的强制记录字段

SUMMARY 中每个变更条目必须包含：

| 字段 | 说明 | 代码改动 | 文档改动 |
|------|------|----------|----------|
| **文件路径** | 明确列出改动的文件 | 必须 | 必须 |
| **验证方式** | grep 命令或关键 diff 片段 | 至少一行 diff | 必须有 grep 验证 |
| **内容片段** | 文件中实际存在的关键文本 | diff 中的关键行 | grep 命中的行 |

**三者缺一不可。**

---

## 3. Artifact 创建自检流程

在创建 SUMMARY 之前，必须按顺序执行：

```
STEP 1 → 对每个文件路径执行 Read 工具 → 确认文件存在且内容匹配
   ↓
STEP 2 → 对文档类改动执行 Grep 工具 → 确认关键字在文件中
   ↓
STEP 3 → 对代码类改动执行 git show 或读取文件 → 确认 diff 存在
   ↓
STEP 4 → 仅当 STEP 1-3 全部通过时才写入 SUMMARY
```

**禁止跳过任意步骤。**

---

## 4. UAT 与 SUMMARY 的一致性要求

- UAT 中的每条测试必须对应 SUMMARY 中声称的变更
- UAT 测试结果必须关联到实际文件路径（不是功能描述）
- 如 UAT 发现 SUMMARY 记录与实际不符，**SUMMARY 必须修正**，不得以"UAT 未覆盖"为由放行虚假的完成记录

---

## 5. Commit 质量约束

- commit message 描述的是"计划做什么"
- SUMMARY 记录的是"实际做了什么"
- 两者可以不同：commit message 宽泛，但 SUMMARY 必须精确到文件路径和验证结果

---

## 6. 模板：正确的 SUMMARY 变更条目

```markdown
## What Was Done

1. **CODE-01** — [功能名称]：
   - 文件: `src/file.js`
   - diff: `+ 新增 xxx 函数，接收 yyy 参数`
   - 验证: `git show HEAD -- src/file.js | grep -i "xxx"`

2. **DOC-01** — [文档名称]：
   - 文件: `docs/guide.md`
   - 验证: `grep -qi "edge" docs/guide.md`
   - 内容: "edge://extensions"、"build:edge"

3. **CONFIG-01** — [配置变更]：
   - 文件: `wxt.config.ts`
   - diff: `+ browser === "edge" 分支，添加 edge strict_min_version`
   - 验证: `git show HEAD -- wxt.config.ts | grep -A5 'browser === "edge"'`
```

---

## 7. 事后修复：当发现 SUMMARY 有误时的操作

当发现历史 SUMMARY 有虚假记录时：

1. **立即修正** SUMMARY 中的错误记录（不得删除，须注明"已修正"）
2. 在 SUMMARY 底部添加 **Errata** 区块，记录发现的问题和修正方式
3. 如有必要，更新受影响的 commit message 或添加 fixup commit

**示例 Errata 区块：**

```markdown
## Errata

| 日期 | 修正内容 | 原因 |
|------|----------|------|
| 2026-03-25 | EDGE-04：补充 README.md 中 Edge 内容验证方式 | 原始记录声称 README 包含 Edge 内容，但未执行 Grep 核实 |
```

---

## 8. 与 CONVENTIONS.md 的关系

本文档侧重 **GSD 工作流中的时序约束**（SUMMARY 何时、如何生成），`CONVENTIONS.md` 侧重 **代码规范和架构约定**。两者均具有同等约束力，共同防止 SUMMARY 与实际代码脱节的问题再次发生。

---

*Standards established: 2026-03-25*
