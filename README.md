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
| `Ctrl+Alt+P` | 智能增强 | 选中文本 → AI 自动识别意图 → 原地替换为专业 Prompt |
| `Ctrl+Alt+O` | 快速输入 | 弹出输入框 → 输入描述 → 新标签页显示结果 |
| `Ctrl+Alt+L` | 浏览场景 | 查看所有 38 个可用场景详情（含痛点和示例） |
| `Ctrl+Alt+M` | 指定场景 | 手动选择场景 → 跳过意图识别 → 精准定向增强 |

### 使用流程

1. 在编辑器中写下你的需求（可以很简单、很混乱）
2. 选中文本，按 `Ctrl+Alt+P`
3. 等待 AI 两步处理：
   - 🔍 Step 1：意图识别（~1-2 秒）
   - ✍️ Step 2：专业 Prompt 生成（~3-5 秒）
4. 选中文本被自动替换为专业级 Prompt
5. 将生成的 Prompt 发给 Copilot / ChatGPT 获得高质量回答

## 📋 38 个场景

| 场景 | ID | 说明 | 痛点 |
|------|----|------|------|
| 需求扩写 | `optimize` | 将简单描述扩写为专业 Prompt | 需求描述混乱/词不达意 |
| 任务拆解 | `split-task` | 大需求拆解为可执行的小任务 | 大需求不知从何下手 |
| 技术选型 | `techstack` | 多维度技术方案对比 | 技术选型拍脑袋 |
| API 设计 | `api-design` | RESTful/GraphQL API 设计 | API 设计不规范 |
| 代码重构 | `refactor` | 识别坏味道、渐进式重构 | 想重构但怕改出 Bug |
| 性能优化 | `perf` | 性能瓶颈定位和优化 | 页面卡但不知道卡在哪 |
| 正则生成 | `regex` | 根据描述生成正则 | 正则完全看不懂 |
| SQL 生成 | `sql` | 根据描述生成 SQL | 复杂 SQL 写不出来 |
| 代码转换 | `convert` | 跨语言/框架代码迁移 | 迁移工作量巨大 |
| TypeScript | `typescript` | TS 类型难题 | 类型体操太难了 |
| CSS 方案 | `css` | 布局/动画/响应式 | CSS 调半天对不齐 |
| 状态管理 | `state` | Vue/React 状态架构 | 状态乱成一锅粥 |
| 组件设计 | `component` | 组件 API 设计 | 组件设计不合理 |
| 表单方案 | `form` | 表单验证和错误处理 | 表单验证写到崩溃 |
| 异步方案 | `async` | 并发/重试/竞态 | 异步 Bug 难复现 |
| 数据库设计 | `schema` | ER 建模和建表 | 表结构改来改去 |
| Bug 排查 | `debug` | 模糊 bug → 排查方案 | Bug 描述不清/无法复现 |
| 报错分析 | `error` | 报错翻译和修复 | 报错信息看不懂 |
| 追问纠偏 | `followup` | AI 答偏了怎么追问 | AI 答非所问 |
| 概念解释 | `explain` | 分层讲解技术概念 | 文档看完还是不懂 |
| 代码审查 | `review` | 专业 Code Review | Review 不知道看什么 |
| 测试生成 | `test` | 全面测试方案 | 不知道测什么/怎么测 |
| 安全审计 | `security` | 安全漏洞扫描 | 安全漏洞不自知 |
| 代码注释 | `comment` | JSDoc/TSDoc 注释 | 懒得写/不会写注释 |
| 模拟数据 | `mock` | Mock 数据生成 | 造数据又假又慢 |
| 文档生成 | `doc` | README/API 文档 | 文档永远写不完 |
| Commit | `commit` | Conventional Commits | 提交信息乱七八糟 |
| 技术方案 | `proposal` | 技术提案文档 | 方案文档憋不出来 |
| 翻译 | `translate` | 技术中英翻译 | 翻译不地道 |
| 变更日志 | `changelog` | CHANGELOG 生成 | 历史变更无从查起 |
| 技术演示 | `present` | 演讲/PPT 大纲 | 技术分享不会讲 |
| DevOps | `devops` | CI/CD/Docker 配置 | 部署配置一头雾水 |
| 环境排查 | `env` | 开发环境问题修复 | 环境问题搜不到答案 |
| 脚本生成 | `script` | 自动化脚本 | 重复操作不会自动化 |
| 依赖管理 | `deps` | npm 依赖冲突 | 依赖冲突解不了 |
| Git 操作 | `git` | 安全的 Git 操作 | Git 操作怕丢代码 |
| 线上排查 | `incident` | 生产事故排查 | 线上出事手忙脚乱 |
| 算法题解 | `algo` | LeetCode 解题 | 算法题毫无思路 |

### 💡 痛点示例：Before → After

<details>
<summary><b>🔴 痛点 1：需求描述混乱/词不达意（optimize）</b></summary>

**❌ 用户原始输入：**
> 帮我做个登录页面，要好看点，能记住密码，对了还要那个第三方登录

**✅ Easy Prompt 增强后：**
> 自动扩写为包含 Role/Task/Context/Output/Criteria 的结构化专业 Prompt，补全验证规则、安全要求、技术栈约束等 15+ 个隐含需求

</details>

<details>
<summary><b>🔴 痛点 2：大需求不知从何下手（split-task）</b></summary>

**❌ 用户原始输入：**
> 老板让我做一个完整的电商后台管理系统

**✅ Easy Prompt 增强后：**
> 自动拆解为 Epic→Feature→Task 三级结构，含依赖关系图、开发顺序、技术栈建议，每个 Task 附验收标准和预估复杂度

</details>

<details>
<summary><b>🔴 痛点 3：Bug 描述不清/无法复现（debug）</b></summary>

**❌ 用户原始输入：**
> 登录按钮点了没反应，不知道怎么回事

**✅ Easy Prompt 增强后：**
> 自动结构化：精确描述现象 → 推断预期行为 → 推断复现步骤和环境 → 按概率列出 5 个可能原因 → 每个方向附排查命令和修复代码

</details>

<details>
<summary><b>🔴 痛点 4：性能优化没有方向（perf）</b></summary>

**❌ 用户原始输入：**
> 我的页面首屏加载要 5 秒，太慢了怎么优化

**✅ Easy Prompt 增强后：**
> 自动生成分层诊断方案：网络层→解析层→渲染层→JS执行层逐层排查，附 DevTools 操作步骤、优化方案按 ROI 排序、前后对比 LCP/FCP/TTI 基准

</details>

<details>
<summary><b>🔴 痛点 5：报错信息完全看不懂（error）</b></summary>

**❌ 用户原始输入：**
> TypeError: Cannot read properties of undefined (reading 'map') 啥意思啊

**✅ Easy Prompt 增强后：**
> 自动翻译为人话 + 定位 5 种最常见成因 + 每种成因附修复代码片段 + 教你怎么加防御性检查避免下次再犯

</details>

<details>
<summary><b>🔴 痛点 6：线上出事手忙脚乱（incident）</b></summary>

**❌ 用户原始输入：**
> 线上接口突然大量超时，怎么排查

**✅ Easy Prompt 增强后：**
> 自动生成 SRE 排查流程：严重程度判断 P0/P1/P2 → 影响范围 → 快速止血方案 → 根因分析时间线 → 修复方案 → 验证方法 → 复盘模板

</details>

## 🏗️ 项目结构

```
easy-prompt/
├── core/                    # 共享核心逻辑（平台无关）
│   ├── index.js             # 入口
│   ├── scenes.js            # 38 个场景定义（含痛点和示例）
│   ├── router.js            # 意图识别路由器
│   ├── composer.js          # Prompt 合成器
│   └── api.js               # API 调用层
├── vscode/                  # VSCode 扩展
│   ├── package.json         # 扩展清单（5 命令 + 4 快捷键）
│   ├── extension.js         # 扩展入口
│   └── welcomeView.js       # Welcome 引导页（Webview）
├── intellij/                # IntelliJ IDEA 插件
│   ├── build.gradle.kts     # Gradle 构建
│   └── src/main/kotlin/     # Kotlin 源码
│       └── com/easyprompt/
│           ├── actions/     # 5 个 Action（增强/输入/场景/指定/教程）
│           ├── core/        # 路由 + API + 场景定义
│           ├── settings/    # 配置管理
│           └── ui/          # Welcome 对话框 + 启动检测
└── README.md
```

## 📄 License

MIT
