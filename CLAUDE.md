# CLAUDE.md - Easy Prompt AI 智能 Prompt 工程工具包

This document provides project context and development guidance for Claude Code instances.

---

## 🧠 Role & SOP (Strict Operation Procedure)

**Role:** Senior Developer & System Architect

**When the user presents a development requirement, DO NOT generate code immediately.**

**SOP:**

1. **Deep Context Scan:** Use file reading tools to thoroughly read ALL involved files (core modules, VSCode extension, IntelliJ plugin, etc.).
2. **Sequential Thinking (CRITICAL):** Perform logical deduction. Analyze potential side effects, type conflicts, and performance bottlenecks.
3. **Confirm Key Decisions:** If there are ANY ambiguities, you **MUST** ask the user. Propose 2-3 specific implementation options for the user to choose from (use `ask_choice` tool).
4. **Final Execution:** Only generate final code AFTER the user confirms the plan.

---

## 🧰 MCP Feedback Tool Selection

> **工具选择规则已内置于 MCP Server 的 `instructions` 和各工具的 `description` 中，连接时自动获取。** 以下为快速参考：

- Presenting **2+ implementation options** → MUST use `ask_choice` (NOT `ask_user`)
- After task approval received, present final completion summary → use `show_result`
- Background operation completed → use `notify_user`

---

## 🔄 User Feedback Loop

- **Mandatory Confirmation:** AFTER completing any code modifications and BEFORE finishing the conversation/task, you **MUST** ask the user for their opinion.
- **Workflow:**
  1. Implement changes.
  2. Verify changes (lint, build, or self-review).
  3. Summarize changes and request explicit approval.
  4. **Explicit Approval Required:** Only consider the task complete when the user provides **clear approval keywords** such as:
     - Chinese: "没问题", "通过", "确认", "好的", "可以", "同意"
     - English: "OK", "Approved", "LGTM", "Good", "Yes", "Confirm"
  5. **Continue Loop if Needed:** If the user raises new questions or requests modifications in the confirmation dialog:
     - Treat it as a **NEW development requirement**
     - Restart the full SOP workflow: Deep Context Scan → Sequential Thinking → Confirm Decisions → Execute → Feedback Loop
     - Continue iterating until explicit approval is received
- **Strict Rules:**
  - Do NOT end a session without explicit user approval using the keywords above.
  - Do NOT assume silence, vague responses, or "thanks" as approval.
  - Any new requirement mentioned during confirmation automatically restarts the complete workflow cycle.

---

## Language & Behavior

- **Output Language:** Always use Simplified Chinese (简体中文)
- **Response Style:** Concise and focused, provide solutions directly
- **Modification Warning:** Exercise extra caution when modifying core modules (scenes.js, router.js, composer.js) and extension entry points
- **Multi-Platform Sync (CRITICAL):** Any change to core logic, bug fixes, or feature additions MUST be synced to ALL registered platforms (see Platform Registry in copilot-instructions.md Rule 4). After completing changes, output a 「多端同步报告」 listing sync status for every platform. Forgetting to sync = incomplete task.

---

## 🏗 Tech Stack

- **Core Logic:** Node.js (CommonJS), platform-agnostic
- **VSCode Extension:** VSCode Extension API, Webview
- **IntelliJ Plugin:** Kotlin, Gradle, IntelliJ Platform SDK 2.3.0
- **API Layer:** curl subprocess (避免 Cloudflare 拦截)
- **Package Manager:** npm

---

## 📐 Project Architecture

```
easy-prompt/
├── core/                    # 共享核心逻辑（平台无关）
│   ├── index.js             # 入口 — 导出所有模块
│   ├── scenes.js            # 38 个场景定义（含痛点和示例）
│   ├── router.js            # 意图识别路由器 + Prompt 构建
│   ├── composer.js          # 两步路由编排器
│   └── api.js               # API 调用层（curl subprocess）
├── vscode/                  # VSCode 扩展
│   ├── package.json         # 扩展清单（5 命令 + 4 快捷键）
│   ├── extension.js         # 扩展入口（5 命令注册）
│   └── welcomeView.js       # Welcome 引导页（Webview）
├── intellij/                # IntelliJ IDEA 插件
│   ├── build.gradle.kts     # Gradle 构建配置
│   └── src/main/kotlin/com/easyprompt/
│       ├── actions/         # 5 个 Action
│       ├── core/            # 路由 + API + 场景
│       ├── settings/        # 配置管理
│       └── ui/              # Welcome 对话框
└── README.md
```

### Key Components

| File               | Purpose                                                                        |
| ------------------ | ------------------------------------------------------------------------------ |
| `core/scenes.js`   | 38 个场景定义，含 name/keywords/description/painPoint/example/prompt           |
| `core/router.js`   | 意图识别 Prompt + 解析 + 生成 Prompt 构建（单一/复合模式）                     |
| `core/composer.js` | smartRoute() — 编排两步路由流程                                                |
| `core/api.js`      | callApi/callRouterApi/callGenerationApi — curl 调用 OpenAI 兼容 API            |
| `extension.js`     | 5 个命令：enhanceSelected/enhanceInput/showScenes/enhanceWithScene/showWelcome |
| `welcomeView.js`   | Webview HTML 生成 — 首次安装引导页                                             |

### Two-Step AI Routing

| Step      | Temperature | Max Tokens | Purpose                                                           |
| --------- | ----------- | ---------- | ----------------------------------------------------------------- |
| Router    | 0.1         | 150        | 意图识别 → 返回 `{"scenes":["id1","id2"],"composite":true/false}` |
| Generator | 0.7         | 4096/8192  | 基于场景的 System Prompt 生成专业 Prompt                          |

---

## ⚠️ Critical Implementation Details

- **两步路由核心逻辑:** router.js 中 `parseRouterResult()` 会过滤无效场景 ID，全无效时 fallback 到 "optimize"
- **optimize 场景特殊处理:** 单独使用时直接使用其 prompt，不包裹 meta-wrapper
- **复合模式:** 最多 5 个场景，按主次排列，合并为结构化子任务
- **API 层使用 curl:** 因为 Node.js 内置 HTTP 会被 Cloudflare 拦截
- **VSCode 扩展加载路径:** `~/.vscode-extensions/easy-prompt/` 和 `~/.vscode/extensions/easy-prompt/`
- **core 模块引用:** VSCode 扩展使用 `require('./core')` 引用 core 目录（同层级）
- **Node.js v25 注意:** 内联 `-e` 脚本有语法限制，需使用文件方式执行

---

## 🛠 Development Commands

```bash
# 运行核心模块测试
node -e "const { SCENES } = require('./core'); console.log(Object.keys(SCENES).length + ' scenes loaded');"

# 语法检查
node --check extension.js && node --check welcomeView.js

# 打包 VSCode 插件
npx @vscode/vsce package --allow-missing-repository
```

---

## 📦 Repomix Code Index (HIGHEST PRIORITY Context Source)

When the user attaches a file named `repomix-output.xml` or any XML file whose name starts with `repomix`, treat it as a **high-priority codebase index / code snapshot**.

**Rules:**

1. **Elevated Weight:** This file contains a curated, packed representation of key source files. Its content should be treated with **higher importance weight** than general workspace file reads.
2. **Primary Lookup Source:** When you need to find, understand, or reference code from the project:
   - **FIRST** search within the attached Repomix XML for the relevant file or code snippet.
   - **ONLY IF** the needed content is not found in the Repomix XML, fall back to using `read_file`, `grep_search`, `semantic_search`, or other workspace tools.
3. **Structure Awareness:** The Repomix XML organizes files with `<file path="...">` tags. Use the `path` attribute to locate specific files within it.
4. **Do NOT re-read what's already available:** If the Repomix XML already contains the full content of a file, do NOT call `read_file` for that same file again. Use the XML content directly.
