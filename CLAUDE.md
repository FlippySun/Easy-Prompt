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
- **API Layer (VSCode):** curl subprocess（避免 Cloudflare 拦截）, 含重试/响应限制/Kill Timer
- **API Layer (IntelliJ):** HttpURLConnection, 含重试/响应限制
- **Security:** AES-256-CBC 加密内置凭证（core/defaults.js + BuiltinDefaults.kt）
- **Package Manager:** npm

---

## 📐 Project Architecture

```
easy-prompt/
├── core/                    # 共享核心逻辑（平台无关）
│   ├── index.js             # 入口 — 导出所有模块
│   ├── scenes.js            # 85 个场景定义（含痛点和示例）
│   ├── router.js            # 意图识别路由器 + Prompt 构建
│   ├── composer.js          # 两步路由编排器（smartRoute）
│   ├── api.js               # API 调用层（curl subprocess + 重试 + 安全限制）
│   └── defaults.js          # 内置默认配置（AES-256-CBC 加密）
├── extension.js             # VSCode 扩展入口（8 命令注册 + handleCommandError）
├── welcomeView.js           # Welcome 引导页（Webview）
├── package.json             # VSCode 扩展清单（8 命令 + 6 快捷键）
├── intellij/                # IntelliJ IDEA 插件
│   ├── build.gradle.kts     # Gradle 构建配置
│   └── src/main/kotlin/com/easyprompt/
│       ├── actions/         # 7 个 Action（智能增强/增强选中/输入/场景/指定/教程/菜单）
│       ├── core/            # 路由 + API + 场景 + 内置默认配置
│       ├── settings/        # 配置管理（测试并保存）
│       └── ui/              # Welcome 对话框 + 状态栏 Widget + 启动检测
└── README.md
```

### Key Components

| File               | Purpose                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `core/scenes.js`   | 85 个场景定义，含 name/keywords/description/painPoint/example/prompt                                                   |
| `core/router.js`   | 意图识别 Prompt + 解析 + 生成 Prompt 构建（单一/复合模式）                                                             |
| `core/composer.js` | smartRoute() — 编排两步路由流程                                                                                        |
| `core/api.js`      | callApi — curl 调用 OpenAI 兼容 API（含重试/响应限制 2MB/Kill Timer/curl 缓存）                                        |
| `core/defaults.js` | 内置默认 API 配置（AES-256-CBC 加密 + 多层混淆）                                                                       |
| `extension.js`     | 8 个命令：enhanceSelected/smartEnhance/enhanceInput/showScenes/enhanceWithScene/showWelcome/configureApi/statusBarMenu |
| `welcomeView.js`   | Webview HTML 生成 — 首次安装引导页，含 50 场景卡片                                                                     |

### Two-Step AI Routing

| Step      | Temperature | Max Tokens | Purpose                                                           |
| --------- | ----------- | ---------- | ----------------------------------------------------------------- |
| Router    | 0.1         | 500        | 意图识别 → 返回 `{"scenes":["id1","id2"],"composite":true/false}` |
| Generator | 0.7         | 4096/8192  | 基于场景的 System Prompt 生成专业 Prompt                          |

---

## ⚠️ Critical Implementation Details

- **两步路由核心逻辑:** router.js 中 `parseRouterResult()` 会过滤无效场景 ID，全无效时 fallback 到 "optimize"，支持 3 种正则匹配模式
- **optimize 场景特殊处理:** 单独使用时直接使用其 prompt，不包裹 meta-wrapper
- **复合模式:** 最多 5 个场景，按主次排列，合并为结构化子任务
- **API 层使用 curl:** 因为 Node.js 内置 HTTP 会被 Cloudflare 拦截，使用 `child_process.spawn('curl', ...)`
- **安全限制:** 响应体最大 2MB、输入最大 10000 字符、curl 进程有 Kill Timer（超时 + 10秒强制杀死）
- **竞态保护:** 文档替换前验证选区偏移量和文档切换（savedSelStart/End + docUri 校验）
- **错误处理:** VSCode 端 `handleCommandError()` 统一处理（重试/配置/取消），消除重复代码
- **内置默认配置:** `core/defaults.js` 和 `BuiltinDefaults.kt` 使用 AES-256-CBC 加密 + 多层混淆
- **Base URL 规范化:** `getConfig()` 和 `testApiConfig()` 自动去除尾部斜杠
- **curl 可用性缓存:** 模块级 `_curlAvailable` 变量，避免重复检测
- **core 模块引用:** VSCode 扩展使用 `require('./core')` 引用 core 目录（同层级）
- **IntelliJ 独立实现:** IntelliJ 端用 Kotlin 独立实现了 core 逻辑（Scenes.kt, Router.kt, ApiClient.kt），不共享 Node.js core/

---

## 🛠 Development Commands

```bash
# 运行核心模块测试
node -e "const { SCENES } = require('./core'); console.log(Object.keys(SCENES).length + ' scenes loaded');"

# VSCode 语法检查
node --check extension.js && node --check welcomeView.js && node --check core/index.js

# 打包 VSCode 插件
npx @vscode/vsce package --allow-missing-repository

# IntelliJ 编译验证（需 JDK 17）
cd intellij && JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew compileKotlin

# IntelliJ 构建插件
cd intellij && JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew buildPlugin
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
