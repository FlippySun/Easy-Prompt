# Easy Prompt — AI 智能 Prompt 增强器

> 两步 AI 意图识别 + 38 个专业场景，将你的简单描述自动扩写为大师级 Prompt。

![Version](https://img.shields.io/badge/version-3.0.0-blue)
![VSCode](https://img.shields.io/badge/VSCode-1.85%2B-blue)
![IntelliJ](https://img.shields.io/badge/IntelliJ-2024.1%2B-orange)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ 核心功能

- 🧠 **两步智能路由**：先识别意图场景，再用对应专业 Prompt 生成
- 🔀 **复合意图支持**：一句话包含多个意图也能精准处理
- ⚡ **快捷键操作**：`Ctrl+Alt+P` 一键增强选中文本
- 📦 **38 个场景**：覆盖开发全流程（需求→代码→测试→部署→运维）
- 🔌 **多平台支持**：VSCode + IntelliJ IDEA
- 🔑 **多供应商兼容**：OpenAI / Azure / 中转站 / 本地 Ollama

## 📦 安装

### VSCode

```bash
# 方式 1：从项目安装
cd vscode && npm install && code --install-extension .

# 方式 2：打包后安装
cd vscode && npx vsce package && code --install-extension easy-prompt-3.0.0.vsix
```

### IntelliJ IDEA

```bash
# 构建插件
cd intellij && ./gradlew buildPlugin

# 安装：Settings → Plugins → ⚙️ → Install Plugin from Disk
# 选择 intellij/build/distributions/easy-prompt-intellij-3.0.0.zip
```

## ⚙️ 配置

### VSCode

打开 Settings（`Cmd+,`），搜索 `Easy Prompt`：

| 配置项 | 说明 | 示例 |
|--------|------|------|
| `easyPrompt.apiBaseUrl` | API 地址（必须以 `/v1` 结尾） | `https://api.openai.com/v1` |
| `easyPrompt.apiKey` | API Key | `sk-xxxx` |
| `easyPrompt.model` | 模型名称 | `gpt-4o` / `gemini-3-pro-preview` |

### IntelliJ IDEA

Settings → Tools → Easy Prompt

## 🎯 使用方式

### 快捷键

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Ctrl+Alt+P` | 增强选中文本 | 选中文本 → AI 分析意图 → 原地替换为专业 Prompt |
| `Ctrl+Alt+O` | 快速输入增强 | 弹出输入框 → 输入描述 → 新标签页显示结果 |
| `Ctrl+Alt+L` | 浏览场景列表 | 查看所有 38 个可用场景 |

### 使用流程

1. 在编辑器中写下你的需求（可以很简单、很混乱）
2. 选中文本，按 `Ctrl+Alt+P`
3. 等待 AI 两步处理：
   - 🔍 Step 1：意图识别（~1-2 秒）
   - ✍️ Step 2：专业 Prompt 生成（~3-5 秒）
4. 选中文本被自动替换为专业级 Prompt
5. 将生成的 Prompt 发给 Copilot / ChatGPT 获得高质量回答

## 📋 38 个场景

| 场景 | ID | 说明 |
|------|----|------|
| 需求扩写 | `optimize` | 将简单描述扩写为专业 Prompt |
| 任务拆解 | `split-task` | 大需求拆解为可执行的小任务 |
| 技术选型 | `techstack` | 多维度技术方案对比 |
| API 设计 | `api-design` | RESTful/GraphQL API 设计 |
| 代码重构 | `refactor` | 识别坏味道、渐进式重构 |
| 性能优化 | `perf` | 性能瓶颈定位和优化 |
| 正则生成 | `regex` | 根据描述生成正则 |
| SQL 生成 | `sql` | 根据描述生成 SQL |
| 代码转换 | `convert` | 跨语言/框架代码迁移 |
| TypeScript | `typescript` | TS 类型难题 |
| CSS 方案 | `css` | 布局/动画/响应式 |
| 状态管理 | `state` | Vue/React 状态架构 |
| 组件设计 | `component` | 组件 API 设计 |
| 表单方案 | `form` | 表单验证和错误处理 |
| 异步方案 | `async` | 并发/重试/竞态 |
| 数据库设计 | `schema` | ER 建模和建表 |
| Bug 排查 | `debug` | 模糊 bug → 排查方案 |
| 报错分析 | `error` | 报错翻译和修复 |
| 追问纠偏 | `followup` | AI 答偏了怎么追问 |
| 概念解释 | `explain` | 分层讲解技术概念 |
| 代码审查 | `review` | 专业 Code Review |
| 测试生成 | `test` | 全面测试方案 |
| 安全审计 | `security` | 安全漏洞扫描 |
| 代码注释 | `comment` | JSDoc/TSDoc 注释 |
| 模拟数据 | `mock` | Mock 数据生成 |
| 文档生成 | `doc` | README/API 文档 |
| Commit | `commit` | Conventional Commits |
| 技术方案 | `proposal` | 技术提案文档 |
| 翻译 | `translate` | 技术中英翻译 |
| 变更日志 | `changelog` | CHANGELOG 生成 |
| 技术演示 | `present` | 演讲/PPT 大纲 |
| DevOps | `devops` | CI/CD/Docker 配置 |
| 环境排查 | `env` | 开发环境问题修复 |
| 脚本生成 | `script` | 自动化脚本 |
| 依赖管理 | `deps` | npm 依赖冲突 |
| Git 操作 | `git` | 安全的 Git 操作 |
| 线上排查 | `incident` | 生产事故排查 |
| 算法题解 | `algo` | LeetCode 解题 |

## 🏗️ 项目结构

```
easy-prompt/
├── core/                    # 共享核心逻辑（平台无关）
│   ├── index.js             # 入口
│   ├── scenes.js            # 38 个场景定义
│   ├── router.js            # 意图识别路由器
│   ├── composer.js           # Prompt 合成器
│   └── api.js               # API 调用层
├── vscode/                  # VSCode 扩展
│   ├── package.json         # 扩展清单
│   └── extension.js         # 扩展入口
├── intellij/                # IntelliJ IDEA 插件
│   ├── build.gradle.kts     # Gradle 构建
│   └── src/main/kotlin/     # Kotlin 源码
└── README.md
```

## 📄 License

MIT
