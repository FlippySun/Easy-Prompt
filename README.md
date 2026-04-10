# Easy Prompt — AI 智能 Prompt 增强器

> 两步 AI 意图识别 + 97 个专业场景 + 10 大用户画像，将你的简单描述自动扩写为大师级 Prompt。

![Version](https://img.shields.io/badge/version-5.3.8-blue)
![VSCode](https://img.shields.io/badge/VSCode-1.85%2B-blue)
![IntelliJ](https://img.shields.io/badge/IntelliJ-2024.1%2B-orange)
![Browser](https://img.shields.io/badge/Browser-Chrome%20%7C%20Firefox%20%7C%20Safari%20%7C%20Edge-yellow)
![Web](https://img.shields.io/badge/Web-Online-brightgreen)
![PromptHub](https://img.shields.io/badge/PromptHub-zhiz.chat-purple)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ 核心功能

- 🧠 **两步智能路由**：先识别意图场景，再用对应专业 Prompt 生成
- ⚖️ **Fast / Deep 双模式**：同模型、同接口下控制输出深度；Fast 更精炼，Deep 更完整
- 🔀 **复合意图支持**：一句话包含多个意图也能精准处理
- ⚡ **智能增强**：自动判断增强选中文本 / 当前文件 / 剪贴板内容
- 📦 **97 个场景**：覆盖开发全流程 + 内容创作 + 产品 + 营销 + 设计 + 数据 + HR + 客服 + 创业 + 教育
- 🧑‍💼 **10 大画像**：软件工程师/内容创作者/产品经理/市场运营/设计师/数据分析师/HR/客服/创业者/学生教育
- 🕐 **增强历史**：查看历史记录，支持 before/after 对比、一键复制、删除
- 🌐 **四端覆盖**：VSCode 扩展 + IntelliJ 插件 + 浏览器扩展（Chrome/Firefox/Safari/Edge） + Web 在线版，全场景使用
- 🟣 **PromptHub 精选库**：独立 AI Prompt 精选库（[zhiz.chat](https://zhiz.chat)），发现/收藏/分享高质量 Prompt，含热门榜单、银河星图、7 大精选合集
- ✨ **Smart Nudge**：浏览器扩展在 AI 网站（ChatGPT/Claude/Gemini 等 22 站）输入暂停后自动弹出增强提醒，一键增强
- 🔑 **多供应商兼容**：OpenAI / Azure / Gemini / DeepSeek / Ollama
- 🎯 **开箱即用**：内置 AI 服务，零配置即可使用（默认模型 `gpt-5.4`）
- 🔒 **安全加固**：AES-256-CBC 加密内置凭证、2MB 响应限制、7 规则智能输入验证、竞态保护

## ✨ Key Features (English)

- 🧠 **Two-step Smart Routing**: detect intent/scene first, then generate a specialized professional prompt
- ⚖️ **Fast / Deep Modes**: control output depth with the same model and endpoint; Fast is leaner, Deep is fuller
- 🔀 **Composite Intents**: accurately handles multiple intents in a single sentence
- ⚡ **Smart Enhance**: automatically enhances selection / current file / clipboard
- 📦 **97 Scenes**: covers the full dev lifecycle + content + product + marketing + design + data + HR + support + startup + education
- 🧑‍💼 **10 Personas**: engineer / creator / PM / growth / designer / analyst / HR / support / founder / student-educator
- 🕐 **History**: before/after comparison, copy, delete
- 🌐 **Multi-platform**: VSCode extension + IntelliJ plugin + Browser extension (Chrome/Firefox/Safari/Edge) + Web
- 🟣 **PromptHub Library**: Standalone AI prompt library ([zhiz.chat](https://zhiz.chat)) — discover, bookmark & share quality prompts with trending charts, Galaxy star-map & 7 curated collections
- ✨ **Smart Nudge**: (Browser Extension) pops an enhancement reminder when you pause typing on AI sites (ChatGPT/Claude/Gemini, etc.)
- 🔑 **Multi-provider**: OpenAI / Azure / Gemini / DeepSeek / Ollama
- 🎯 **Works out of the box**: built-in AI service, zero config required (default model: `gpt-5.4`)
- 🔒 **Hardened**: AES-256-CBC encrypted defaults, 2MB response cap, 7-rule input validation, race-condition protection

## 📦 安装

### 浏览器扩展（v5.0 新增）

支持 Chrome、Firefox、Safari、Edge 四大平台：

> 💡 **说明**：浏览器扩展中的 Fast / Deep 只影响第二步输出深度，不会自动切换模型，也不会修改请求接口形状；这样可以尽量避免真实浏览器环境中的跨域/超时回归。

```bash
# 方式 1：从各平台扩展商店安装（推荐）
# Chrome Web Store / Firefox Add-ons / Safari Extensions / Microsoft Add-ons 搜索 "Easy Prompt"

# 方式 2：本地构建安装（WXT）
cd browser && npm install
cd browser && node build.js          # 构建所有平台（chrome/firefox/safari/edge）
cd browser && node build.js chrome   # 仅构建 Chrome
# 输出：browser/dist/<target>-mv3/ + browser/dist/easy-prompt-browser-<version>-<target>.zip

# Chrome 开发者模式加载：
# chrome://extensions → 开启「开发者模式」→ 加载已解压的扩展程序 → 选择 browser/dist/chrome-mv3/

# Firefox 临时加载：
# about:debugging#/runtime/this-firefox → Load Temporary Add-on... → 选择 browser/dist/firefox-mv3/manifest.json

# Edge 开发者模式加载：
# edge://extensions → 开启「开发者模式」→ 加载已解压的扩展程序 → 选择 browser/dist/edge-mv3/

# Safari 本地调试：
# cd browser && npm run safari:convert
# 然后打开 browser/dist/safari-xcode/ 中生成的 Xcode 工程
```

### Web 在线版（v4.0 新增）

无需安装，打开浏览器即可使用：

- 访问 [Easy Prompt Web](https://prompt.zhiz.chat) 在线使用
- 或将 `web/` 目录部署到任意静态服务器
- 纯前端 SPA，零后端依赖，支持所有主流浏览器

### 🟣 PromptHub — AI Prompt 精选库（v5.3 新增）

独立的 AI Prompt 精选库 Web 应用，帮助发现、收藏和分享高质量 Prompt：

- 访问 [PromptHub](https://zhiz.chat) 在线使用
- **精选库首页**：分类筛选 + 难度/模型标签 + 瀑布流卡片布局
- **热门榜单**：统计图表 + 排行榜 + 趋势分析
- **Prompt 银河**：Canvas 交互式星图可视化，全新方式浏览 Prompt
- **合集系统**：7 个精选合集（开发者全套工具包 / 小红书运营 / AI 写作 / 数据分析等）
- **合集详情页**：Hero 横幅 + 分类标签 + Prompt 列表 + 一键复制
- **收藏夹管理**：收藏/取消收藏 + 搜索 + 排序
- **提交 Prompt**：分享你的高质量 Prompt 到精选库
- **暗色/亮色主题**：一键切换，oklch 色彩空间
- 技术栈：React 18 + TypeScript + Vite 6 + Tailwind CSS v4 + Framer Motion

### VSCode

```bash
# 方式 1：从 VSCode Marketplace 安装（推荐）
# 搜索 "Easy Prompt" 或访问 Marketplace 页面直接安装

# 方式 2：本地打包安装
npx @vscode/vsce package --allow-missing-repository
code --install-extension easy-prompt-ai-5.3.8.vsix

# 方式 3：开发调试
code .  # 按 F5 启动调试
```

### IntelliJ IDEA

```bash
# 方式 1：从 JetBrains Marketplace 安装（推荐）
# Settings → Plugins → Marketplace → 搜索 "Easy Prompt"

# 方式 2：本地构建安装（需要 JDK 21）
cd intellij && ./gradlew buildPlugin
# Settings → Plugins → ⚙️ → Install Plugin from Disk
# 选择 intellij/build/distributions/easy-prompt-intellij-5.3.8.zip
```

## 📦 Installation (English)

### Browser Extension (v5.0+)

Supports Chrome, Firefox and Safari.

> 💡 **Note**: Fast / Deep in the browser extension only changes second-step output depth. It does **not** switch models or alter request shape, which helps avoid real-browser CORS/timeout regressions.

- Option 1 (recommended): install from the extension stores — search "Easy Prompt"
- Option 2: build locally:

```bash
cd browser && node build.js
cd browser && node build.js chrome
```

### Web (v4.0+)

No installation required:

- Open https://prompt.zhiz.chat
- Or deploy the `web/` folder to any static host (pure frontend SPA)

### 🟣 PromptHub — AI Prompt Library (v5.3+)

A standalone AI prompt curated library web app:

- Open [https://zhiz.chat](https://zhiz.chat) to browse
- **Curated homepage**: category filters + difficulty/model tags + masonry card layout
- **Trending**: charts + leaderboard + trend analysis
- **Prompt Galaxy**: Canvas interactive star-map for visual prompt exploration
- **Collections**: 7 curated collections (Dev Toolkit / Xiaohongshu / AI Writing / Data Analysis, etc.)
- **Collection detail pages**: Hero banner + tags + prompt list + one-click copy
- **Favorites**: bookmark / search / sort
- **Submit prompts**: share your quality prompts to the library
- **Dark/light theme**: one-click toggle, oklch color space
- Tech stack: React 18 + TypeScript + Vite 6 + Tailwind CSS v4 + Framer Motion

### VSCode

- Option 1 (recommended): install from VSCode Marketplace — search "Easy Prompt"
- Option 2: package & install locally:

```bash
npx @vscode/vsce package --allow-missing-repository
code --install-extension easy-prompt-ai-5.3.8.vsix
```

### IntelliJ IDEA

- Option 1 (recommended): Settings → Plugins → Marketplace → search "Easy Prompt"
- Option 2: build & install from disk:

```bash
cd intellij && ./gradlew buildPlugin
```

Then: Settings → Plugins → ⚙️ → Install Plugin from Disk → select `intellij/build/distributions/easy-prompt-intellij-5.3.8.zip`

## ⚙️ 配置

### VSCode

打开 Settings（`Cmd+,`），搜索 `Easy Prompt`：

> 💡 **开箱即用**：安装后无需任何配置即可使用内置 AI 服务。如需使用自己的 API，可通过命令面板 `Easy Prompt: 配置自定义 API` 一键配置（支持测试验证）。

| 配置项                   | 说明                   | 默认      | 示例                        |
| ------------------------ | ---------------------- | --------- | --------------------------- |
| `easyPrompt.apiKey`      | （可选）自定义 API Key | 内置服务  | `sk-xxxx`                   |
| `easyPrompt.apiBaseUrl`  | （可选）API 地址       | 内置服务  | `https://api.openai.com/v1` |
| `easyPrompt.model`       | （可选）模型名称       | `gpt-5.4` | `gpt-4o` / `deepseek-chat`  |
| `easyPrompt.enhanceMode` | （可选）增强模式       | `fast`    | `fast` / `deep`             |

> `easyPrompt.enhanceMode` 只影响第二步生成深度：`fast` 更精炼，`deep` 更完整；不会自动切换模型，也不会修改请求接口。

### IntelliJ IDEA

Settings → Tools → Easy Prompt（支持一键「测试并保存」）

📖 **详细配置指南:** 查看 [API_CONFIG.md](./API_CONFIG.md) 了解各 API 提供商的配置示例（OpenAI / Azure / Gemini / DeepSeek / Ollama）

## ⚙️ Configuration (English)

### VSCode

Open Settings (`Cmd+,`) and search for `Easy Prompt`.

> 💡 **Works out of the box**: leave everything empty to use the built-in service. To use your own API, run the Command Palette action `Easy Prompt: 配置自定义 API` (includes connection test).

| Setting                  | Meaning                   | Default              | Example                     |
| ------------------------ | ------------------------- | -------------------- | --------------------------- |
| `easyPrompt.apiKey`      | (optional) Custom API Key | Built-in             | `sk-xxxx`                   |
| `easyPrompt.apiBaseUrl`  | (optional) API Base URL   | Built-in             | `https://api.openai.com/v1` |
| `easyPrompt.model`       | (optional) Model name     | Built-in (`gpt-5.4`) | `gpt-4o` / `deepseek-chat`  |
| `easyPrompt.enhanceMode` | (optional) Enhance mode   | `fast`               | `fast` / `deep`             |

> `easyPrompt.enhanceMode` only changes the second-step output depth: `fast` is leaner, `deep` is more complete. It does not switch models or rewrite the request endpoint.

### IntelliJ IDEA

Settings → Tools → Easy Prompt (one-click “Test & Save”).

📖 Detailed guide: see [API_CONFIG.md](./API_CONFIG.md) for provider examples (OpenAI / Azure / Gemini / DeepSeek / Ollama).

## 🎯 使用方式

### 快捷键（9 个命令 · 7 个快捷键）

| 快捷键       | 功能     | 说明                                                            |
| ------------ | -------- | --------------------------------------------------------------- |
| `Ctrl+Alt+I` | 智能增强 | 自动判断增强选中文本 / 当前文件 / 剪贴板，多来源时选择          |
| `Ctrl+Alt+P` | 增强选中 | 选中文本 → AI 自动识别意图 → 原地替换（无选中时自动转智能增强） |
| `Ctrl+Alt+O` | 快速输入 | 弹出输入框 → 输入描述 → 新标签页显示结果                        |
| `Ctrl+Alt+L` | 浏览场景 | 查看所有 97 个可用场景详情（含痛点，按画像分组）                |
| `Ctrl+Alt+M` | 指定场景 | 手动选择场景 → 跳过意图识别 → 精准定向增强                      |
| `Ctrl+Alt+H` | 使用教程 | 随时打开引导页                                                  |
| `Ctrl+Alt+Y` | 增强历史 | 查看历史增强记录，支持 before/after 对比和复制                  |
| —            | 配置 API | 命令面板 → `Easy Prompt: 配置自定义 API`（测试验证后保存）      |
| —            | 快捷菜单 | 状态栏 `✨ Easy Prompt` 图标 → 打开 7 项快捷操作菜单            |

### 使用流程

1. 在编辑器中写下你的需求（可以很简单、很混乱）
2. 选中文本，按 `Ctrl+Alt+I`（智能增强）或 `Ctrl+Alt+P`（增强选中）
3. 等待 AI 两步处理：
   - 🔍 Step 1：意图识别（~1-2 秒）
   - ✍️ Step 2：专业 Prompt 生成（~3-5 秒）
4. 选中文本被自动替换为专业级 Prompt
5. 将生成的 Prompt 发给 Copilot / ChatGPT 获得高质量回答

## 🎯 Usage (English)

### Shortcuts (9 commands · 7 keybindings)

| Shortcut     | Action             | Notes                                                                                               |
| ------------ | ------------------ | --------------------------------------------------------------------------------------------------- |
| `Ctrl+Alt+I` | Smart Enhance      | Auto-pick selection / current file / clipboard; choose when multiple sources exist                  |
| `Ctrl+Alt+P` | Enhance Selection  | Replace selection with a professional prompt (falls back to Smart Enhance when nothing is selected) |
| `Ctrl+Alt+O` | Enhance Input      | Popup input → generate → show in a new tab                                                          |
| `Ctrl+Alt+L` | Browse Scenes      | Browse all 97 scenes (grouped by personas, with pain points)                                        |
| `Ctrl+Alt+M` | Enhance with Scene | Choose a scene manually to skip intent recognition                                                  |
| `Ctrl+Alt+H` | Tutorial           | Open the onboarding page anytime                                                                    |
| `Ctrl+Alt+Y` | History            | Before/after comparison, copy, delete                                                               |
| —            | Configure API      | Command Palette → `Easy Prompt: 配置自定义 API` (test & save)                                       |
| —            | Quick Menu         | Status bar `✨ Easy Prompt` → open quick actions menu                                               |

### Workflow

1. Write your request in the editor (it can be short and messy).
2. Select the text and press `Ctrl+Alt+I` (Smart Enhance) or `Ctrl+Alt+P` (Enhance Selection).
3. Wait for the two-step pipeline:
   - 🔍 Step 1: intent/scene recognition (~1–2s)
   - ✍️ Step 2: professional prompt generation (~3–5s)
4. Your selected text will be replaced with the enhanced prompt.
5. Send the generated prompt to Copilot / ChatGPT for a much better answer.

## 📋 97 个场景

| 场景                  | ID                   | 说明                        | 痛点                     |
| --------------------- | -------------------- | --------------------------- | ------------------------ |
| 需求扩写              | `optimize`           | 将简单描述扩写为专业 Prompt | 需求描述混乱/词不达意    |
| 任务拆解              | `split-task`         | 大需求拆解为可执行的小任务  | 大需求不知从何下手       |
| 技术选型              | `techstack`          | 多维度技术方案对比          | 技术选型拍脑袋           |
| API 设计              | `api-design`         | RESTful/GraphQL API 设计    | API 设计不规范           |
| 代码重构              | `refactor`           | 识别坏味道、渐进式重构      | 想重构但怕改出 Bug       |
| 性能优化              | `perf`               | 性能瓶颈定位和优化          | 页面卡但不知道卡在哪     |
| 正则生成              | `regex`              | 根据描述生成正则            | 正则完全看不懂           |
| SQL 生成              | `sql`                | 根据描述生成 SQL            | 复杂 SQL 写不出来        |
| 代码转换              | `convert`            | 跨语言/框架代码迁移         | 迁移工作量巨大           |
| TypeScript            | `typescript`         | TS 类型难题                 | 类型体操太难了           |
| CSS 方案              | `css`                | 布局/动画/响应式            | CSS 调半天对不齐         |
| 状态管理              | `state`              | Vue/React 状态架构          | 状态乱成一锅粥           |
| 组件设计              | `component`          | 组件 API 设计               | 组件设计不合理           |
| 表单方案              | `form`               | 表单验证和错误处理          | 表单验证写到崩溃         |
| 异步方案              | `async`              | 并发/重试/竞态              | 异步 Bug 难复现          |
| 数据库设计            | `schema`             | ER 建模和建表               | 表结构改来改去           |
| Bug 排查              | `debug`              | 模糊 bug → 排查方案         | Bug 描述不清/无法复现    |
| 报错分析              | `error`              | 报错翻译和修复              | 报错信息看不懂           |
| 追问纠偏              | `followup`           | AI 答偏了怎么追问           | AI 答非所问              |
| 概念解释              | `explain`            | 分层讲解技术概念            | 文档看完还是不懂         |
| 代码审查              | `review`             | 专业 Code Review            | Review 不知道看什么      |
| 测试生成              | `test`               | 全面测试方案                | 不知道测什么/怎么测      |
| 安全审计              | `security`           | 安全漏洞扫描                | 安全漏洞不自知           |
| 代码注释              | `comment`            | JSDoc/TSDoc 注释            | 懒得写/不会写注释        |
| 模拟数据              | `mock`               | Mock 数据生成               | 造数据又假又慢           |
| 文档生成              | `doc`                | README/API 文档             | 文档永远写不完           |
| Commit                | `commit`             | Conventional Commits        | 提交信息乱七八糟         |
| 技术方案              | `proposal`           | 技术提案文档                | 方案文档憋不出来         |
| 翻译                  | `translate`          | 技术中英翻译                | 翻译不地道               |
| 变更日志              | `changelog`          | CHANGELOG 生成              | 历史变更无从查起         |
| 技术演示              | `present`            | 演讲/PPT 大纲               | 技术分享不会讲           |
| DevOps                | `devops`             | CI/CD/Docker 配置           | 部署配置一头雾水         |
| 环境排查              | `env`                | 开发环境问题修复            | 环境问题搜不到答案       |
| 脚本生成              | `script`             | 自动化脚本                  | 重复操作不会自动化       |
| 依赖管理              | `deps`               | npm 依赖冲突                | 依赖冲突解不了           |
| Git 操作              | `git`                | 安全的 Git 操作             | Git 操作怕丢代码         |
| 线上排查              | `incident`           | 生产事故排查                | 线上出事手忙脚乱         |
| 算法题解              | `algo`               | LeetCode 解题               | 算法题毫无思路           |
| 选题生成              | `topic-gen`          | 领域热点选题清单            | 不知道写什么             |
| 事实校验              | `fact-check`         | 内容真实性三级核查          | 写完不确定是否准确       |
| 背景调研              | `research`           | 素材/数据/案例资料包        | 文章缺乏素材支撑         |
| 文风改写              | `style-rewrite`      | 正式↔口语/学术↔通俗         | 文风不对味               |
| 字数调控              | `word-adjust`        | 扩写/缩写到目标字数         | 字数不达标或超标         |
| 平台适配              | `platform-adapt`     | 公众号/小红书/知乎/微博改写 | 一篇内容发所有平台效果差 |
| 合规审查              | `compliance`         | 广告法/平台规则风险审查     | 内容被删帖/限流          |
| 标题优化              | `headline`           | 10 个高点击率标题方案       | 标题没吸引力             |
| 大纲生成              | `outline`            | 文章/视频脚本结构化大纲     | 下笔没有逻辑框架         |
| SEO 优化              | `seo-write`          | 关键词/元描述/结构化优化    | 搜索排名上不去           |
| 文案润色              | `copy-polish`        | 语句/逻辑/可读性五维润色    | 写出来自己都觉得别扭     |
| 社媒文案              | `social-post`        | 5 版本社交媒体传播文案      | 长文章转发没人看         |
| **产品经理场景**      |                      |                             |                          |
| PRD 生成              | `prd`                | 完整 PRD 文档框架           | PRD 写不全面             |
| 用户故事              | `user-story`         | User Story + 验收标准       | 用户故事写不具体         |
| 竞品分析              | `competitor`         | 竞品多维度对比分析          | 竞品分析没框架           |
| 数据分析需求          | `data-analysis`      | 数据分析方案 + SQL          | 数据需求说不清           |
| 会议纪要              | `meeting-notes`      | 会议要点 + Action Items     | 会议记录又臭又长         |
| 验收标准              | `acceptance`         | 量化验收标准矩阵            | 验收标准不明确           |
| **市场运营场景**      |                      |                             |                          |
| 广告文案              | `ad-copy`            | AIDA 广告文案               | 广告没转化               |
| 品牌故事              | `brand-story`        | 品牌叙事文案                | 品牌没有记忆点           |
| 邮件营销              | `email-marketing`    | EDM 邮件文案                | 邮件打开率低             |
| 活动策划              | `event-plan`         | 活动策划全案                | 活动没创意               |
| 增长策略              | `growth-hack`        | AARRR 增长方案              | 用户增长乏力             |
| **设计师场景**        |                      |                             |                          |
| 设计 Brief            | `design-brief`       | 设计需求文档                | 设计需求说不清           |
| UX 评审               | `ux-review`          | 启发式评估 + 优化建议       | 不知道怎么评设计         |
| 设计规范              | `design-spec`        | 设计交付规范文档            | 设计还原总走样           |
| UX 文案               | `copy-ux`            | 界面微文案优化              | 界面文案不顺畅           |
| **数据分析师场景**    |                      |                             |                          |
| 数据报告              | `data-report`        | 结构化数据分析报告          | 报告没有洞察             |
| AB 测试               | `ab-test`            | AB 实验设计方案             | 实验设计不严谨           |
| 指标定义              | `metric-define`      | 北极星指标体系              | 指标定义混乱             |
| 数据可视化            | `data-viz`           | 可视化图表方案              | 图表选型不合适           |
| **HR 人事场景**       |                      |                             |                          |
| JD 编写               | `jd-write`           | 岗位 JD + 画像              | JD 千篇一律              |
| 面试指南              | `interview-guide`    | 结构化面试方案              | 面试问不出真实水平       |
| 绩效评语              | `performance-review` | 绩效评估模板                | 评语写不出区分度         |
| 入职方案              | `onboarding-plan`    | 新人入职计划                | 新人上手太慢             |
| **客户服务场景**      |                      |                             |                          |
| FAQ 编写              | `faq-write`          | FAQ 文档                    | FAQ 覆盖不全             |
| 回复模板              | `response-template`  | 客服话术模板                | 回复不专业               |
| 反馈分析              | `feedback-analysis`  | 用户反馈分类分析            | 反馈数据无法利用         |
| **创业者/管理者场景** |                      |                             |                          |
| 商业计划书            | `business-plan`      | BP 文档                     | BP 写不出说服力          |
| 路演 PPT              | `pitch-deck`         | 投资人 Pitch 大纲           | 路演抓不住重点           |
| OKR 制定              | `okr`                | OKR 目标与关键结果          | OKR 定不好               |
| SWOT 分析             | `swot`               | SWOT 四象限分析             | 分析没有系统性           |
| 风险评估              | `risk-assess`        | 风险矩阵 + 应对策略         | 风险漏评                 |
| **学生/教育场景**     |                      |                             |                          |
| 学习计划              | `study-plan`         | 费曼学习法学习计划          | 学习没规划               |
| 读书笔记              | `summary`            | 结构化读书/课程笔记         | 笔记记了等于没记         |
| 论文大纲              | `essay`              | 学术论文结构化大纲          | 论文不知道怎么写         |
| 出题生成              | `quiz-gen`           | 考试/练习题目               | 出题没有区分度           |

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
├── core/                    # 共享核心逻辑（CommonJS，平台无关）
│   ├── index.js             # 统一导出
│   ├── scenes.js            # 97 个场景定义（含痛点和示例）
│   ├── router.js            # 意图识别路由器 + Prompt 构建
│   ├── composer.js          # 两步路由编排器（smartRoute）
│   ├── api.js               # API 调用层（curl subprocess + 重试 + 安全限制）
│   └── defaults.js          # 内置默认配置（AES-256-CBC 加密）
├── extension.js             # VSCode 扩展入口（9 命令注册 + 核心逻辑）
├── welcomeView.js           # Welcome 引导页（Webview）
├── package.json             # VSCode 扩展清单（9 命令 + 7 快捷键）
├── intellij/                # IntelliJ IDEA 插件（Kotlin）
│   ├── build.gradle.kts     # Gradle 构建配置
│   └── src/main/kotlin/com/easyprompt/
│       ├── actions/         # 8 个 Action（智能增强/增强选中/输入/场景/指定/教程/菜单/历史）
│       ├── core/            # 路由 + API + 场景 + 内置默认配置
│       ├── settings/        # 配置管理（测试并保存）
│       └── ui/              # Welcome 对话框 + 状态栏 Widget + 启动检测
├── web/                     # Web 在线版（v4.0 新增）
│   ├── index.html           # 主页面（SPA 入口）
│   ├── style.css            # 样式（暗色主题 + 响应式）
│   ├── app.js               # 应用逻辑（路由 + 场景 + API 调用）
│   └── scenes.json          # 97 场景数据（由 core 生成）
├── browser/                 # 浏览器扩展（v5.0 新增，Chrome/Firefox/Safari MV3）
│   ├── package.json         # Browser 子项目依赖与脚本（WXT）
│   ├── wxt.config.ts        # WXT 配置（manifest + 多浏览器兼容）
│   ├── wxt-entrypoints/     # WXT 入口层（background/content/popup/options）
│   ├── public/              # 扩展静态资源（icons + scenes.json）
│   ├── scripts/             # 辅助脚本（Safari converter 等）
│   ├── build.js             # 兼容旧入口的 WXT 构建包装器
│   ├── popup/               # Popup 面板（输入/增强/场景/历史）
│   ├── options/             # 设置页（API 配置 + 测试连接）
│   ├── background/          # Service Worker（上下文菜单 + 快捷键）
│   ├── content/             # Content Script（浮动增强按钮）
│   └── shared/              # 共享模块（Storage/API/Router/Scenes/Defaults/Icons）
├── web-hub/                 # 🟣 PromptHub 独立 Web 应用（v5.3 新增）
│   ├── package.json         # 独立依赖（React + TypeScript + Vite + Tailwind CSS v4）
│   ├── vite.config.ts       # Vite 构建配置（代码分割策略）
│   └── src/                 # React SPA 源码
│       ├── app/components/  # UI 组件（Navbar/PromptCard/Drawer 等）
│       ├── app/pages/       # 路由页面（Home/Trending/Galaxy/Collections/Profile 等）
│       ├── app/hooks/       # 自定义 Hooks（usePromptStore 等）
│       └── app/data/        # 数据层（prompts/collections/constants）
├── README.md
├── CHANGELOG.md
└── .github/
    └── copilot-instructions.md
```

## 📚 文档

- **[PromptHub — AI Prompt 精选库](https://zhiz.chat)** — 在线浏览、收藏和分享高质量 Prompt
- **[Easy Prompt Web 在线版](https://prompt.zhiz.chat)** — 无需安装，浏览器直接使用
- **[API_CONFIG.md](./API_CONFIG.md)** — 各 API 提供商详细配置指南（OpenAI / Azure / Gemini / DeepSeek / Ollama）
- **[FAQ.md](./FAQ.md)** — 常见问题与故障排查
- **[CHANGELOG.md](./CHANGELOG.md)** — 版本更新日志
- **[RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)** — 发布前检查清单
- **[CLAUDE.md](./CLAUDE.md)** — Claude Code 项目规范

## ❓ 故障排查

### 常见问题

**Q: 提示 "请先配置 API Key"？**
A: Easy Prompt 开箱即用，无需配置。如需自定义 API，通过 `Easy Prompt: 配置自定义 API` 命令配置（支持一键测试验证）。

**Q: 提示 "未找到 curl 命令"？（VSCode 端）**
A:

- Windows: 确保 Windows 10+ 自带的 curl 在 PATH 中
- macOS/Linux: 系统自带，检查 PATH 环境变量

**Q: API 调用超时？**
A: 检查网络连接、Base URL 配置、API Key 是否有效。系统内置自动重试机制（最多 4 次，指数退避）。

**Q: AI 识别的场景不对？**
A: 使用「指定场景增强」功能（`Ctrl+Alt+M`）手动选择场景

**Q: IntelliJ 构建失败？**
A: 确保安装了 JDK 17：`brew install openjdk@17`，然后 `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew buildPlugin`

更多问题请查看 **[FAQ.md](./FAQ.md)**

## 🛡️ 安全特性

- **内置凭证加密**：AES-256-CBC + 多层混淆（分散存储 + 打乱索引 + charCode 构造）
- **响应体限制**：2MB 最大响应大小，防止 OOM
- **输入长度限制**：最大 10000 字符
- **curl 进程安全**：超时 + 10 秒强制 Kill Timer
- **竞态保护**：文档替换前验证选区偏移量 + 文档切换检查
- **Base URL 规范化**：自动去除尾部斜杠，智能拼接 `/chat/completions` 路径

## 🔧 开发与测试

### 运行核心功能测试

```bash
node test.js
```

### VSCode 插件开发

```bash
code .  # 在项目根目录按 F5 启动调试

# 语法检查
node --check extension.js && node --check welcomeView.js && node --check core/index.js

# 打包
npx @vscode/vsce package --allow-missing-repository
```

### IntelliJ 插件开发

```bash
cd intellij

# 编译验证（需 JDK 17）
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew compileKotlin

# 构建插件
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew buildPlugin

# 启动调试 IDE
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew runIde
```

### 浏览器扩展开发

```bash
cd browser

# 构建所有平台
node build.js

# 仅构建指定平台
node build.js chrome
node build.js firefox
node build.js safari

# 输出目录：browser/dist/<target>/ + browser/dist/easy-prompt-<target>.zip
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/AmazingFeature`
3. 提交更改：`git commit -m 'Add some AmazingFeature'`
4. 推送分支：`git push origin feature/AmazingFeature`
5. 提交 Pull Request

## 📄 License

MIT
