# Changelog

All notable changes to the Easy Prompt project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.2.1] - 2026-02-20

### IntelliJ 可发现性提升 & 全端描述双语化

#### IntelliJ 插件体验升级（重点）

- **新增：ToolWindow 侧边栏面板** — 右侧 "Easy Prompt" 面板（JCEF 渲染），新手指引 + 一键触发所有功能
- **新增：右键菜单顶层入口** — 编辑器中选中文本右键，"Easy Prompt：智能增强 / 增强选中文本" 直接出现在顶层（无需子菜单）
- **新增：Tools 菜单入口** — Tools → Easy Prompt 子菜单（全部 7 个 Action）
- **新增：状态栏快捷菜单** — 右下角状态栏 "Easy Prompt"，点击弹出 7 项快捷操作
- **新增：首次安装指引通知** — 安装后自动打开 ToolWindow + 弹出通知（含多入口提示）
- **优化：插件图标** — Marketplace / 已安装列表 / ToolWindow 侧边栏均使用统一 Sparkles 风格 SVG 图标
- **优化：快捷键** — 全部统一为 Ctrl+Alt+X（含 Mac OS X keymap），与 VSCode 完全一致

#### 全端市场描述双语化

- **IntelliJ Marketplace 描述**：扩写为完整中英双语（CN 在前 + EN 在后），补齐 Smart Nudge / 多供应商 / 安全加固等卖点
- **VSCode Marketplace（README）**：核心功能 / 安装 / 配置 / 使用方式章节追加英文翻译（不改动原中文）
- **VSCode 短描述（package.json）**：更新为中英双语

#### 其他

- **修复**: README.md 中 Smart Nudge 行的乱码字符
- **同步**: 全端版本号统一升级至 5.2.1

## [5.2.0] - 2026-02-20

### 默认模型升级

- **升级**: 默认 AI 模型切换至 Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)
- **升级**: 默认 API 提供商切换至 ModelVerse (api.modelverse.cn)
- **同步**: 全端（VSCode / IntelliJ / Web / Browser）默认配置统一更新
- **同步**: 全端版本号统一升级至 5.2.0

## [5.1.1] - 2025-07-26

### 链接修正 & 多端同步

- **修正**: README.md Web 在线版链接指向 `https://prompt.zhiz.chat`
- **修正**: 浏览器扩展设置页 GitHub URL 修正为正确仓库地址
- **新增**: 浏览器扩展设置页“关于”区域添加 Web 在线版链接
- **新增**: VSCode Welcome 页面 footer 添加 Web 在线版链接
- **修正**: Web 端 GitHub URL 大小写修正
- **修正**: IntelliJ Marketplace 描述中 Web 添加超链接
- **同步**: 全端版本号统一升级至 5.1.1

## [5.1.0] - 2025-07-25

### Smart Nudge - AI 站点智能提醒

浏览器扩展新增智能提醒气泡：当用户在 AI 网站（ChatGPT、Claude、Gemini 等 22 个站点）输入内容并暂停 3 秒后，自动弹出提示气泡，引导用户使用 Prompt 增强功能。

- **智能触发**：输入 10+ 字符后暂停 3 秒自动显示，不干扰正常输入
- **一键增强**：点击气泡中的"增强"按钮或使用快捷键（Cmd+Shift+E / Ctrl+Shift+E）立即增强
- **频率控制**：每个 session 仅显示一次，10 秒自动消失，已使用增强功能则不再提醒
- **永久关闭**：点击"不再提醒"永久关闭（chrome.storage.local 持久化）
- **视觉设计**：暗色主题 (#1e1b2e)、紫色强调、滑入动画，与现有 UI 风格一致

### 智能输入验证增强

全面升级输入内容校验引擎，从 3 条基础规则升级为 7 条智能规则，有效过滤无意义输入、避免浪费 API 调用。

#### 验证规则升级（3 → 7 条）

- **最小长度放宽**：从 4 字符降至 2 字符，适配 CJK 双字词（如"翻译"、"总结"）
- **有效字符检测**：使用 Unicode `\p{L}\p{N}` 类别，支持全球脚本（CJK/拉丁/阿拉伯/西里尔等）
- **字母必须性检测**：拒绝纯数字输入（如 "12345"），要求至少包含 1 个字母字符
- **重复字符检测**：拒绝单一字符重复（如 "aaa"、"111"、"哈哈哈"），要求至少 2 个不同有效字符
- **纯 URL 检测**：拒绝仅包含 URL 的输入（如 "https://example.com"），但 "帮我解析 https://example.com" 可通过
- **纯邮箱检测**：拒绝仅包含邮箱地址的输入
- **纯文件路径检测**：拒绝仅包含 Unix/Windows 文件路径的输入

#### 五端同步

- VSCode：`extension.js` 增强选中/指定场景增强入口校验
- IntelliJ：`ApiClient.kt` 使用 Kotlin 原生正则实现等效 7 规则
- Web：`app.js` smartRoute 入口校验
- Browser Popup：使用 `Router.isValidInput()` 统一验证，消除行内重复逻辑
- Browser Content Script：AI 聊天框 inline 增强入口校验
- Browser Service Worker：`handleInlineEnhance` 入口校验

#### 其他改进

- 清理：移除 content.js 中 8 个 debugger 语句
- 清理：移除未使用的 `MIN_TEXT_LENGTH` 常量
- 优化：错误提示文案统一为"输入内容无效，请输入有意义的文本内容"

---

## [5.0.1] - 2025-07-24

### Bug 修复与稳定性改进

v5.0.0 发布后的 Bug 修复和稳定性改进，主要集中在浏览器扩展 Popup 面板和 Web 端。

#### 浏览器扩展 Popup（9 项修复）

- **debounce 状态丢失修复**：debounce 函数新增 `.cancel()` 方法，`pagehide` 处理器先取消待执行的 debounced save 再同步 flush，避免 Popup 关闭瞬间状态丢失
- **状态恢复重复保存修复**：`selectScene()` 新增 `skipSave` 参数，从 Storage 恢复状态时传入 `true`，避免恢复过程触发二次保存
- **场景方法调用错误修复**：`handleGenerate` 中修正 `Scenes.getScenes()` → `Scenes.getSceneNames()`，修复生成时场景名称获取失败
- **动画 class 残留修复**：`showOutput` 添加 `animationend` 事件监听（`{ once: true }`），动画结束后自动移除 `is-entering` class
- **清空按钮状态残留修复**：清空操作时增加 `hideStatus()` 调用 + 移除 `is-entering` class，确保 UI 状态完全重置
- **定时器泄漏修复**：新增 `_pickerCloseTimer` 变量管理 Picker 关闭定时器，open/close 时正确清理，防止泄漏
- **事件穿透修复**：`openScenesModal` 中 `e.stopPropagation()` 改为 `e.stopImmediatePropagation()`，彻底阻止事件冒泡穿透
- **模态框事件监听泄漏修复**：`closeScenesModal` 中添加 `modal.removeEventListener("animationend", onEnd)` 清理，防止 fallback timeout 触发时残留监听器

#### Web 端（3 项修复）

- **清空按钮进度条残留修复**：`handleClear()` 增加 `hideProgress()` 调用，清空时同步隐藏进度条
- **CSS 变量修复**：修复未定义变量 `--text-tertiary` → 正确引用 `--text-muted`
- **复制按钮样式修复**：补充 `#btn-copy.is-copied` 选择器，复制成功时正确显示样式变化

#### IntelliJ 插件兼容性升级（4 项）

- **SDK 升级 2024.1 -> 2024.3**：解决 `CredentialAttributes` 构造函数废弃警告，`requestor` 参数版本已在 2024.3 中标记为 ERROR 级别废弃
- **ActionUpdateThread 补全**：全部 8 个 Action 类添加 `getActionUpdateThread() = ActionUpdateThread.BGT`，解决 JetBrains Marketplace 验证警告
- **StatusBarWidget API 更新**：移除废弃的 `getPresentation()` 覆写，`getClickConsumer()` 添加 `@Suppress("DEPRECATION")`
- **构建工具链升级**：`jvmToolchain(17)` -> `jvmToolchain(21)`，`sinceBuild` 从 `241` 提升至 `243`，兼容 IntelliJ 2024.3+

#### 四端同步

- VSCode：版本号更新
- IntelliJ：版本号 + changeNotes + SDK 升级 + 废弃 API 修复
- Web：版本号 + Bug 修复
- Browser：三平台 manifest 版本号 + Popup Bug 修复

---

## [5.0.0] - 2026-02-18

### 🌐 浏览器扩展正式上线 — 四端覆盖，全渠道触达

Easy Prompt 迎来 v5.0.0 大版本。全新浏览器扩展正式上线，支持 Chrome / Firefox / Safari 三大平台（MV3），与 VSCode 扩展、IntelliJ 插件、Web 在线版形成四端矩阵。

#### 🧩 浏览器扩展功能

- **Popup 快速增强面板**：输入文本 → AI 智能路由 → 生成专业 Prompt，支持场景选择 + 画像切换 + 历史记录
- **场景选择器**：85 个场景按 15 分类 + 10 大画像分组浏览，热门标签快速选择
- **Content Script 浮动按钮**：网页中选中文本自动显示增强按钮，一键发送到 Popup 增强
- **Background Service Worker**：右键上下文菜单 + 键盘快捷键 + 消息中继
- **Options 设置页**：支持自定义 API 配置（Base URL / API Key / Model）+ 一键测试连接
- **状态持久化**：关闭再打开 Popup，输入/输出/选中场景自动恢复
- **增强历史**：本地存储增强记录，支持复制、删除、清空
- **暗色/亮色主题**：跟随系统或手动切换

#### 🐛 Popup 面板审计修复（7 项）

- **Major #1**: Escape 键双触发 — Focus Trap 和全局键盘监听同时调用 `closeScenesModal()`，导致面板关闭异常。修复：Focus Trap 中添加 `e.stopPropagation()` + 关闭函数添加幂等守卫
- **Major #2**: 动画卡死 — `animationend` 事件在某些浏览器/GPU 环境下可能不触发，面板永远卡在 `is-leaving` 状态。修复：添加 350ms `setTimeout` fallback + `cleaned` 幂等标志
- **Minor #3**: 状态恢复闪烁 — 从 Storage 恢复输出时触发 output-reveal 动画，造成视觉干扰。修复：`showOutput()` 新增 `animate` 参数，恢复时传 `false`
- **Minor #4**: Debounce 丢失 — 300ms debounced save 在 Popup 关闭瞬间可能丢失最后一次状态。修复：添加 `pagehide` 事件监听立即 flush
- **Minor #5**: Badge 分隔符缺失 — 多场景标签拼接使用空字符串，显示为 "场景A场景B"。修复：分隔符改为 `", "`
- **Minor #6**: CSS 死代码 — `.modal__content` 中 `animation: fadeIn` 已被 Section 15 动画系统覆盖。修复：移除死代码
- **Minor #7**: CSS 覆盖冲突 — `.scene-card`/`.history-card`/`.dropdown__item` 基础 `transition` 被 Section 15 完全覆盖。修复：移除基础冗余声明，添加注释指向

#### 🔧 四端同步

- VSCode: 版本号 + Welcome 页更新
- IntelliJ: 版本号 + changeNotes 更新
- Web: 版本号更新
- Browser: 三平台 manifest 版本号 + Popup/Options/Content/Background 全部审查通过

---

## [4.1.0] - 2026-02-17

### 🧑‍💼 画像系统 + 历史记录 + 35 新场景

Easy Prompt v4.1.0 全面升级。引入 10 大用户画像系统和增强历史功能，新增 35 个专业场景（总计 85 个），三端同步。

#### 🧑‍💼 10 大用户画像

场景之上抽象出用户画像层，按职业角色分组场景，降低认知负荷：

- **软件工程师**：需求分析 + 编码开发 + 质量保障 + 文档 + 运维（5 个分类）
- **内容创作者**：通用写作（12 个场景）
- **产品经理**：PRD/用户故事/竞品分析/数据分析/会议纪要/验收标准
- **市场运营**：广告文案/品牌故事/邮件营销/活动策划/增长策略
- **设计师**：设计Brief/UX评审/设计规范/UX文案
- **数据分析师**：数据报告/AB测试/指标定义/数据可视化
- **HR人事**：JD编写/面试指南/绩效评语/入职方案
- **客户服务**：FAQ编写/回复模板/反馈分析
- **创业者/管理者**：商业计划书/路演PPT/OKR/SWOT/风险评估
- **学生/教育**：学习计划/读书笔记/论文大纲/出题生成

#### 🎯 35 个新增专业场景（总计 85 个）

- 产品经理：`prd`, `user-story`, `competitor`, `data-analysis`, `meeting-notes`, `acceptance`
- 市场运营：`ad-copy`, `brand-story`, `email-marketing`, `event-plan`, `growth-hack`
- 设计师：`design-brief`, `ux-review`, `design-spec`, `copy-ux`
- 数据分析师：`data-report`, `ab-test`, `metric-define`, `data-viz`
- HR人事：`jd-write`, `interview-guide`, `performance-review`, `onboarding-plan`
- 客户服务：`faq-write`, `response-template`, `feedback-analysis`
- 创业者/管理者：`business-plan`, `pitch-deck`, `okr`, `swot`, `risk-assess`
- 学生/教育：`study-plan`, `summary`, `essay`, `quiz-gen`

#### 🕐 增强历史功能

- 新增 `Ctrl+Alt+Y` 快捷键查看增强历史
- 支持 before/after 文本对比展示
- 支持一键复制原文/增强结果
- 支持删除单条记录和清空全部
- 最多保留最近 100 条（FIFO）
- 三端存储：VSCode→globalState, IntelliJ→PersistentState, Web→localStorage

#### 📂 场景分组优化

- 场景列表/选择器按画像分组展示（取代原有的纯频率排序）
- Web 端新增画像 Tab 页快速筛选
- VSCode 端 QuickPick 添加画像分隔符
- IntelliJ 端 Popup 列表按画像分组

#### 🔧 三端同步

- VSCode: history + persona + package.json 命令注册 + 快捷键
- IntelliJ: ShowHistoryAction + PersonaConfig + 4 个 Action 文件 history save + plugin.xml 注册
- Web: history panel + persona tabs + SCENE_CATEGORIES 15 分类

---

## [4.0.0] - 2026-02-16

### 🌐 Web 端正式上线 — 三端覆盖，全场景触达

Easy Prompt 迎来首个大版本升级。全新 Web 在线版正式上线，与 VSCode 扩展、IntelliJ 插件形成三端矩阵，让 Prompt 增强能力触手可及。

#### ✍️ 12 个写作专业场景（50 场景全覆盖）

- **选题生成** (topic-gen)：根据领域/定位/热点生成选题清单，含爆款潜力评分
- **事实校验** (fact-check)：逐段核查事实性陈述，三级标注（可信/存疑/错误）
- **背景调研** (research)：整理背景资料、关键数据、权威引用、正反观点
- **文风改写** (style-rewrite)：正式↔口语/学术↔通俗/幽默↔文艺风格转换
- **字数调控** (word-adjust)：扩写或缩写到目标字数，核心信息保持率 ≥ 95%
- **平台适配** (platform-adapt)：针对公众号/小红书/知乎/微博/B站/抖音改写
- **合规审查** (compliance)：广告法/平台规则/版权风险三维审查 + 合规版全文
- **标题优化** (headline)：10 个标题方案（数字/悬念/对比/情绪/痛点/行动型）
- **大纲生成** (outline)：结构化大纲（含钩子/论点/素材/节奏/字数估算）
- **SEO 优化** (seo-write)：关键词策略 + 内容优化 + 技术 SEO + SEO 评分
- **文案润色** (copy-polish)：错别字/语法/表达/结构/风格五维润色
- **社媒文案** (social-post)：5 版本社媒文案（走心/金句/数据/悬念/互动）

#### 🚀 全新 Web 在线版

- **纯前端 SPA 架构**：`index.html` + `style.css` + `app.js` + `scenes.json`，零后端依赖，部署到任意静态服务器即可使用
- **专业级视觉设计**：参考 Linear / Vercel / Raycast 设计语言，高斯模糊背景 + 渐变光影 + 流畅微交互动画
- **完整 50 场景支持**：场景选择器 + 实时搜索筛选 + 7 大分类浏览 + 使用频率统计
- **双模式增强**：智能路由（AI 自动识别意图）+ 指定场景（手动精准选择）
- **全设备响应式**：桌面端与移动端自适应布局，支持所有主流浏览器
- **Lucide SVG 图标体系**：全部使用专业内联 SVG 图标，零外部 CDN 依赖
- **暗色主题**：与 VSCode / IntelliJ 端视觉风格统一

#### 🔧 全平台质量审查

- **VSCode** Welcome 引导页版本号显示修正
- **IntelliJ** 50 个场景补齐「痛点」(painPoint) 数据，与 core 模块完全同步
- **IntelliJ** changeNotes 补齐 v3.2.2 更新说明
- **Web** 场景选择器下拉定位修复（`position: absolute` → `position: fixed`）
- **Web** 背景装饰光影居中偏移修复
- **Web** GitHub 链接 URL 更正

---

## [3.2.2] - 2026-02-15

### 🔧 IntelliJ 平台兼容性修复（JetBrains Marketplace 验证）

- **`JBPopupFactory.createListPopupBuilder(JList)` → `createPopupChooserBuilder(List<String>)`**：3 处 deprecated API 替换（StatusBarMenuAction / EnhanceWithSceneAction / ShowScenesAction）
- **`AnAction.actionPerformed()` 直接调用 → `ActionManager.tryToExecute()`**：3 处 override-only 违规修复（StatusBarMenuAction / EasyPromptStatusBarWidgetFactory / EnhanceSelectedAction）
- **`AnActionEvent.createFromAnAction()` → 完全移除**：1 处 scheduled-for-removal API 替换（EasyPromptStatusBarWidgetFactory 改用 `tryToExecute` + `contextComponent`）
- **WelcomeDialog 启动模态阻塞 → 非阻塞气泡通知**：WelcomeStartupActivity 改为 `NotificationGroupManager` 通知 + "查看使用教程" 按钮，新增 `isHeadlessEnvironment` / `isUnitTestMode` 环境检测跳过

---

## [3.2.1] - 2026-02-14

### 🔄 Changed

- **取消 Base URL `/v1` 结尾强制校验**：现在支持任意格式的 API 地址，如 `https://api.example.com/v1` 或 `https://api.example.com/v1/chat/completions` 均可
- **智能 URL 拼接**：`callApiOnce()` 自动检测 URL 是否已包含 `/chat/completions`，避免重复拼接路径
- **配额不足错误提示升级**：`friendlyError()` 使用正则解析 `$remain` / `$need` 金额，区分内置 Key 和自定义 Key 双场景提供指导建议
- **IntelliJ 插件 ID 变更**：`com.easyprompt.intellij` → `com.easyprompt.plugin`（JetBrains Marketplace 禁止 ID 包含 "intellij"）
- **IntelliJ 插件描述改为纯英文**，符合 JetBrains Marketplace 格式要求（必须以拉丁字母开头，≥40 字符）
- **IntelliJ 新增 `publishPlugin` Gradle 任务**，支持通过 Token 自动发布到 JetBrains Marketplace
- WebView 配置面板 Base URL 提示文案更新，展示多种 URL 格式示例

### 🐛 Fixed

- 修复 JSON 解析错误提示中残留的 "/v1 结尾" 引导文案（双端同步）

---

## [3.2.0] - 2026-02-14

### ✨ Added

- **智能增强（Ctrl+Alt+I）**：一键智能增强，按优先级自动选择内容源 — 选中文本 → 当前文件（≤50 行/2000 字符）→ 剪贴板（≤10000 字符）；多来源时弹出选择列表
- **Ctrl+Alt+H 快捷键**：随时打开使用教程引导页
- **状态栏常驻入口**：底部状态栏显示 ✨ Easy Prompt，点击打开快捷菜单
- **场景使用频率排序**：场景列表按命中次数降序排列，显示 🔥 命中计数
- **状态栏快捷菜单**：6 项快速操作（智能增强/选中增强/指定场景/浏览场景/使用教程/API 配置）

### 🔄 Changed

- **增强选中文本无选区时自动 fallback 到智能增强**，不再提示"请先选中文本"
- **`handleCommandError()` 集中错误处理**：统一重试/配置/取消操作按钮，根据错误类型智能提供操作建议
- Welcome 引导页新增 Ctrl+Alt+I / Ctrl+Alt+H 快捷键说明和状态栏使用提示
- 场景浏览和指定场景增强均按使用频率智能排序
- IntelliJ WelcomeDialog 场景分类扩展至全部 50 个场景（6 个分类，与 VSCode 端完全对齐）

### 🐛 Fixed

- **5 轮深度审计（20 处修复）**：覆盖逻辑正确性、安全加固、多平台一致性、架构优化、边界条件处理
- IntelliJ: `LightVirtualFile` → `ScratchRootType` — 临时文件改为 Scratch 文件，支持语法高亮和正确的文件管理
- IntelliJ: 智能增强竞态条件修复 — 选区偏移量提前保存 + 文档切换检查，避免替换错误位置
- IntelliJ: `runWriteAction` → `WriteCommandAction` — 文档写入操作支持 Ctrl+Z 撤销
- IntelliJ: 模态对话框 → `NotificationGroupManager` 非阻塞气泡通知，不再打断用户操作
- IntelliJ: 状态栏菜单无编辑器时显示友好提示而非静默失败
- IntelliJ: StatusBarWidget DataContext 改用 `CommonDataKeys` + `FileEditorManager.selectedTextEditor` 规范引用

---

## [3.1.0] - 2026-02-13

### ✨ Added

- **开箱即用**：内置 AI 服务，安装后无需任何配置即可使用
- 支持自定义 API Key（可选）— 填入自己的 Key 后自动切换为用户配置
- 内置配置采用 AES-256-CBC 加密 + 多层混淆保护
- 新增「指定场景增强」功能（Ctrl+Alt+M）- 手动选择场景跳过 AI 意图识别
- 新增「查看使用教程」命令 - 随时查看 Welcome 引导页
- 新增输入长度限制（10000 字符）- 防止超长输入导致错误
- 新增 curl 可用性检查 - 更友好的错误提示
- 新增配置验证 - Base URL 和 API Key 格式检查

### 🔄 Changed

- 配置项全部改为可选 — 留空使用内置服务，填写则使用自定义配置
- 项目结构优化：VSCode 扩展文件提升到根目录，解决打包缺失 core/ 的致命 Bug
- 改进 API 安全性：使用 stdin 传递数据，避免 API Key 在命令行参数中暴露
- 增强 JSON 解析健壮性：支持更多格式和边界情况处理
- 优化错误提示：分类常见错误，提供更友好的中文提示和解决建议
- 改进取消操作处理：显示明确的取消确认信息

### 🐛 Fixed

- 修复 Windows 环境 curl 兼容性问题
- 修复 JSON 解析失败时的 fallback 逻辑
- 修复长文本响应可能被截断的问题

### 📋 Improvements

- 50 个场景添加痛点描述和示例
- 增强进度反馈：显示每步耗时
- 优化用户体验：添加「撤销」快捷提示

## [3.0.0] - 2026-02-01

### ✨ Added

- 首次发布
- 两步 AI 智能路由：意图识别 + 专业 Prompt 生成
- 50 个专业场景覆盖开发全流程
- 支持复合意图识别
- VSCode 和 IntelliJ IDEA 双平台支持
- 多 API 提供商兼容（OpenAI / Azure / Gemini / DeepSeek / Ollama）
- Welcome 引导页（首次安装自动显示）
- 场景浏览功能（Ctrl+Alt+L）
- 快捷键操作：
  - Ctrl+Alt+P：增强选中文本
  - Ctrl+Alt+O：快速输入增强
  - Ctrl+Alt+L：浏览场景列表
