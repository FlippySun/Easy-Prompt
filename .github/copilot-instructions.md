# 🧠 Copilot Instructions — Easy Prompt 项目

> 本文件为 GitHub Copilot 在 Easy Prompt 项目中的行为规范，所有交互必须遵守以下规则。

---

## 🚫 不可违反的规则（Inviolable Rules）

### 规则 1：先理解再行动（Context-First）
在修改任何代码之前，**必须先完整阅读**所有相关文件。
- 修改 core/ 模块 → 必须同时检查 vscode/extension.js 和 intellij/ 中的调用方
- 修改 scenes.js → 必须验证 38 个场景的完整性和数据结构一致性
- 修改 router.js → 必须理解两步路由流程（router → generator）

### 规则 2：最小改动原则（Minimal Change）
- 每次修改只改必须改的内容，不做"顺手"重构
- 修改前考虑对两个平台（VSCode + IntelliJ）的影响
- 不主动重命名变量、不重排代码块、不修改无关格式

### 规则 3：核心模块保护（Core Protection）
以下文件为核心模块，修改需额外谨慎：
- `core/scenes.js` — 38 个场景定义（~40KB），修改需保持数据结构一致
- `core/router.js` — 意图识别逻辑，`parseRouterResult()` 有 fallback 机制
- `core/composer.js` — 两步路由编排，smartRoute() 是核心入口
- `core/api.js` — API 调用层使用 curl（非 Node.js HTTP）

### 规则 4：跨平台一致性（Cross-Platform Parity）
修改功能时必须确保 VSCode 和 IntelliJ 两个平台的行为一致：
- 新增场景 → 同时更新 core/scenes.js + intellij/Scenes.kt
- 新增命令 → 同时实现 VSCode command + IntelliJ Action
- 快捷键保持一致

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
├── vscode/                  # VSCode 扩展
│   ├── package.json         # 5 命令 + 4 快捷键
│   ├── extension.js         # 命令注册 + 核心逻辑
│   └── welcomeView.js       # Welcome Webview
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

| 组件 | 技术 |
|------|------|
| 核心逻辑 | Node.js (CommonJS)，无第三方依赖 |
| API 调用 | curl subprocess（绕过 Cloudflare） |
| VSCode 扩展 | VS Code Extension API + Webview |
| IntelliJ 插件 | Kotlin + Gradle + IntelliJ Platform SDK 2.3.0 |
| 目标平台 | VSCode + IntelliJ IDEA 2024.1+ |

---

## 🔄 两步 AI 路由机制

### Step 1 — 意图识别 (Router)
- Temperature: 0.1, Max Tokens: 150
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
node --check vscode/extension.js && node --check vscode/welcomeView.js && node --check core/index.js

# 同步到 VSCode 扩展目录
cp vscode/*.js ~/.vscode-extensions/easy-prompt/ && cp core/*.js ~/.vscode-extensions/core/

# IntelliJ 构建
cd intellij && ./gradlew buildPlugin
```

---

## 📝 代码规范

- 使用 2 空格缩进（JavaScript/JSON）、4 空格缩进（Kotlin）
- 中文注释用于业务逻辑说明，英文用于 API/技术注释
- 错误处理必须有 fallback 机制
- 新增功能必须同时考虑 VSCode 和 IntelliJ 两端实现

---

## 🔍 排错指南

| 问题 | 排查方向 |
|------|---------|
| 意图识别错误 | 检查 router.js 中的场景关键词匹配 + API 返回解析 |
| API 调用失败 | 检查 curl 命令拼装、API Key 有效性、endpoint URL |
| 复合模式质量差 | 检查 buildCompositePrompt() 中的子任务拆分逻辑 |
| VSCode 扩展无响应 | 检查 extension.js 中 CancellationToken 处理 |
| IntelliJ 编译失败 | 检查 Kotlin 版本兼容性 + Gradle 配置 |
