# 🧠 Copilot Instructions — Easy Prompt 项目

> 本文件为 GitHub Copilot 在 Easy Prompt 项目中的行为规范，所有交互必须遵守以下规则。

---

## 🚫 不可违反的规则（Inviolable Rules）

### 规则 1：先理解再行动（Context-First）

在修改任何代码之前，**必须先完整阅读**所有相关文件。

- 修改 core/ 模块 → 必须同时检查 extension.js 和 intellij/ 中的调用方
- 修改 scenes.js → 必须验证 38 个场景的完整性和数据结构一致性
- 修改 router.js → 必须理解两步路由流程（router → generator）

### 规则 2：最小改动原则（Minimal Change）

- 每次修改只改必须改的内容，不做"顺手"重构
- 修改前考虑对所有已注册平台端的影响（见规则 4 平台注册表）
- 不主动重命名变量、不重排代码块、不修改无关格式

### 规则 3：核心模块保护（Core Protection）

以下文件为核心模块，修改需额外谨慎：

- `core/scenes.js` — 38 个场景定义（~40KB），修改需保持数据结构一致
- `core/router.js` — 意图识别逻辑，`parseRouterResult()` 有 fallback 机制
- `core/composer.js` — 两步路由编排，smartRoute() 是核心入口
- `core/api.js` — API 调用层使用 curl（非 Node.js HTTP）

### 规则 4：多端同步协议（Multi-Platform Sync Protocol）🔴 最高优先级

Easy Prompt 是一个多端产品，任何功能变更、Bug 修复、行为调整都**必须同步到所有已注册平台端**。遗漏任何一端视为未完成任务。

#### 4.1 平台注册表（Platform Registry）

> ⚠️ 新增平台时必须更新此表。每次修改前必须查阅此表确认受影响的端。

| 平台 ID    | 类型          | 入口文件 / 目录                                    | 核心依赖方式        | 状态    |
| ---------- | ------------- | -------------------------------------------------- | ------------------- | ------- |
| `vscode`   | VSCode 扩展   | `extension.js` + `welcomeView.js` + `package.json` | `require('./core')` | ✅ 已有 |
| `intellij` | IntelliJ 插件 | `intellij/src/main/kotlin/com/easyprompt/`         | Kotlin 独立实现     | ✅ 已有 |
| `web`      | Web 端        | _待建_                                             | _待定_              | 🔲 规划 |
| `browser`  | 浏览器插件    | _待建_                                             | _待定_              | 🔲 规划 |
| `desktop`  | 桌面应用      | _待建_                                             | _待定_              | 🔲 规划 |

#### 4.2 变更影响分类（Change Impact Matrix）

每次修改前，先判断属于哪类变更，然后按对应规则同步：

| 变更类型                        | 需同步的端                     | 同步内容                                 |
| ------------------------------- | ------------------------------ | ---------------------------------------- |
| `core/scenes.js` 场景增删改     | **所有端**（含独立实现的端）   | 场景 ID、名称、关键词、Prompt 全部同步   |
| `core/router.js` 路由逻辑变更   | **所有端**（含独立实现的端）   | 解析逻辑、fallback 策略、温度/Token 参数 |
| `core/api.js` API 层变更        | **所有端**（含独立实现的端）   | 重试策略、错误处理、友好消息、超时配置   |
| `core/composer.js` 编排逻辑变更 | **所有端**（含独立实现的端）   | smartRoute 流程、进度回调、onRetry 机制  |
| UI/UX 交互变更（命令、快捷键）  | **所有端**                     | 命令名、快捷键映射、用户提示文案         |
| 配置项变更（settings）          | **所有端**                     | 配置键名、默认值、校验规则               |
| Bug 修复                        | **检查所有端是否存在相同 Bug** | 修复逻辑、边界条件、错误处理             |
| 内置默认配置变更（defaults）    | **所有端**                     | API Key、Base URL、Model                 |

#### 4.3 强制同步检查清单（Mandatory Sync Checklist）

**每次提交修改前，必须逐项确认**（不可跳过）：

```
□ 1. 查阅「平台注册表」→ 列出所有状态为 ✅ 的端
□ 2. 对每个 ✅ 端，检查该修改是否需要同步
□ 3. 对需要同步的端，完成代码修改
□ 4. 对每个修改过的端，运行其语法检查/编译验证
□ 5. 在回复中输出「多端同步报告」（格式见 4.4）
```

#### 4.4 多端同步报告格式（必须输出）

每次涉及跨端修改时，**必须在回复末尾**附上以下格式的报告：

```
📋 多端同步报告
┌─────────────┬────────┬─────────────────────────┐
│ 平台        │ 状态   │ 变更说明                │
├─────────────┼────────┼─────────────────────────┤
│ vscode      │ ✅ 已同步 │ xxx                     │
│ intellij    │ ✅ 已同步 │ xxx                     │
│ web         │ 🔲 未建  │ —                       │
│ browser     │ 🔲 未建  │ —                       │
│ desktop     │ 🔲 未建  │ —                       │
└─────────────┴────────┴─────────────────────────┘
```

如果某个已有端**未同步**，必须标注 ❌ 并说明原因和后续计划。

#### 4.5 特殊规则

- **IntelliJ 独立实现**：IntelliJ 端用 Kotlin 独立实现了 core 逻辑（Scenes.kt, Router.kt, ApiClient.kt），不共享 Node.js core/。因此 core/ 的任何逻辑变更必须手动同步到对应 Kotlin 文件。
- **新端接入时**：必须更新本注册表，并回顾 core/ 中所有现有功能确保新端完整覆盖。
- **Bug 修复的额外义务**：修复一个端的 Bug 时，必须主动检查其他端是否存在相同问题。如果存在，一并修复。如果不确定，在报告中标注 ⚠️ 需排查。

---

## 📐 项目架构

```
easy-prompt/
├── core/                    # 共享核心逻辑（CommonJS，平台无关）
│   ├── index.js             # 统一导出
│   ├── scenes.js            # 38 个场景（含 painPoint + example）
│   ├── router.js            # 意图路由 + Prompt 构建
│   ├── composer.js          # 两步路由编排
│   └── api.js               # curl subprocess API 调用
├── extension.js             # VSCode 扩展入口（命令注册 + 核心逻辑）
├── welcomeView.js           # Welcome Webview
├── package.json             # VSCode 扩展清单（6 命令 + 4 快捷键）
├── intellij/                # IntelliJ IDEA 插件（Kotlin）
│   ├── build.gradle.kts
│   └── src/main/kotlin/com/easyprompt/
│       ├── actions/         # 5 个 Action
│       ├── core/            # 路由 + API + 场景
│       ├── settings/        # 配置页
│       └── ui/              # Welcome 对话框
├── README.md
├── CLAUDE.md
└── .github/
    ├── copilot-instructions.md   # 本文件
    ├── prompts/                  # Prompt 模板
    ├── agents/                   # Agent 定义
    └── skills/                   # Skills 目录
```

---

## 🔧 技术栈

| 组件          | 技术                                                            |
| ------------- | --------------------------------------------------------------- |
| 核心逻辑      | Node.js (CommonJS)，无第三方依赖                                |
| API 调用      | curl subprocess（绕过 Cloudflare）                              |
| VSCode 扩展   | VS Code Extension API + Webview                                 |
| IntelliJ 插件 | Kotlin + Gradle + IntelliJ Platform SDK 2.3.0                   |
| 目标平台      | VSCode + IntelliJ IDEA 2024.1+（规划：Web/浏览器插件/桌面应用） |

---

## 🔄 两步 AI 路由机制

### Step 1 — 意图识别 (Router)

- Temperature: 0.1, Max Tokens: 500
- 输出格式: `{"scenes": ["scene_id"], "composite": false}`
- `parseRouterResult()` 过滤无效场景，全无效时 fallback 到 "optimize"

### Step 2 — Prompt 生成 (Generator)

- Temperature: 0.7, Max Tokens: 4096 (单一) / 8192 (复合)
- 单一模式: 直接使用对应场景的 System Prompt
- 复合模式: 最多 5 个场景，按主次排列，合并为结构化子任务

---

## ⚠️ 关键注意事项

1. **API 层使用 curl:** Node.js 内置 HTTP 模块会被 Cloudflare 拦截，因此使用 `child_process.execSync('curl ...')` 方式
2. **VSCode 加载路径:** 扩展安装在 `~/.vscode-extensions/easy-prompt/`，core 在 `~/.vscode-extensions/core/`
3. **Node.js v25 限制:** 避免在 `node -e` 中使用复杂语法
4. **场景数据完整性:** 每个场景必须包含: id, name, keywords, description, painPoint, example.before/after, prompt
5. **optimize 场景特殊:** 单独使用时不包裹 meta-wrapper，直接使用其原始 prompt

---

## 🛠️ 常用开发命令

```bash
# 验证场景完整性
node -e "const { SCENES } = require('./core'); console.log(Object.keys(SCENES).length + ' scenes');"

# 语法检查
node --check extension.js && node --check welcomeView.js && node --check core/index.js

# 打包 VSCode 插件
npx @vscode/vsce package --allow-missing-repository

# IntelliJ 构建
cd intellij && ./gradlew buildPlugin
```

---

## 📝 代码规范

- 使用 2 空格缩进（JavaScript/JSON）、4 空格缩进（Kotlin）
- 中文注释用于业务逻辑说明，英文用于 API/技术注释
- 错误处理必须有 fallback 机制
- 新增功能必须同步到「平台注册表」中所有 ✅ 状态的端（见规则 4）

---

## 🔍 排错指南

| 问题              | 排查方向                                          |
| ----------------- | ------------------------------------------------- |
| 意图识别错误      | 检查 router.js 中的场景关键词匹配 + API 返回解析  |
| API 调用失败      | 检查 curl 命令拼装、API Key 有效性、endpoint URL  |
| 复合模式质量差    | 检查 buildCompositePrompt() 中的子任务拆分逻辑    |
| VSCode 扩展无响应 | 检查 extension.js 中 CancellationToken 处理       |
| IntelliJ 编译失败 | 检查 Kotlin 版本兼容性 + Gradle 配置              |
| 多端行为不一致    | 按规则 4 检查「平台注册表」，逐端核对变更是否同步 |

---

## 📣 Feedback MCP 工具使用规范

本项目已集成 Easy Feedback MCP，提供 5 个 macOS 原生用户交互工具。根据交互模式选择正确工具：

| 场景                                    | 使用工具                   | 不要用   |
| --------------------------------------- | -------------------------- | -------- |
| 开放式问题、自由文本输入、方案确认      | `mcp_feedback_ask_user`    | —        |
| YES/NO 二元决策（批准/拒绝、继续/取消） | `mcp_feedback_ask_confirm` | ask_user |
| 2+ 具体选项供用户选择                   | `mcp_feedback_ask_choice`  | ask_user |
| 展示只读结果/报告/分析                  | `mcp_feedback_show_result` | ask_user |
| 非阻塞状态通知（构建完成、保存成功）    | `mcp_feedback_notify_user` | ask_user |

### 反模式（避免）

- ❌ 用 ask_user 做 YES/NO 决策 → 用 `ask_confirm`
- ❌ 用 ask_user 呈现 2+ 选项 → 用 `ask_choice`
- ❌ 用 ask_user 展示报告无需输入 → 用 `show_result`
- ❌ 用阻塞工具发简短状态更新 → 用 `notify_user`
