# Changelog

All notable changes to the Easy Prompt project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] - 2026-02-16

### 🌐 Web 端正式上线 — 三端覆盖，全场景触达

Easy Prompt 迎来首个大版本升级。全新 Web 在线版正式上线，与 VSCode 扩展、IntelliJ 插件形成三端矩阵，让 Prompt 增强能力触手可及。

#### 🚀 全新 Web 在线版

- **纯前端 SPA 架构**：`index.html` + `style.css` + `app.js` + `scenes.json`，零后端依赖，部署到任意静态服务器即可使用
- **专业级视觉设计**：参考 Linear / Vercel / Raycast 设计语言，高斯模糊背景 + 渐变光影 + 流畅微交互动画
- **完整 38 场景支持**：场景选择器 + 实时搜索筛选 + 分类浏览 + 使用频率统计
- **双模式增强**：智能路由（AI 自动识别意图）+ 指定场景（手动精准选择）
- **全设备响应式**：桌面端与移动端自适应布局，支持所有主流浏览器
- **Lucide SVG 图标体系**：全部使用专业内联 SVG 图标，零外部 CDN 依赖
- **暗色主题**：与 VSCode / IntelliJ 端视觉风格统一

#### 🔧 全平台质量审查

- **VSCode** Welcome 引导页版本号显示修正
- **IntelliJ** 38 个场景补齐「痛点」(painPoint) 数据，与 core 模块完全同步
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
- IntelliJ WelcomeDialog 场景分类扩展至全部 38 个场景（6 个分类，与 VSCode 端完全对齐）

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

- 38 个场景添加痛点描述和示例
- 增强进度反馈：显示每步耗时
- 优化用户体验：添加「撤销」快捷提示

## [3.0.0] - 2026-02-01

### ✨ Added

- 首次发布
- 两步 AI 智能路由：意图识别 + 专业 Prompt 生成
- 38 个专业场景覆盖开发全流程
- 支持复合意图识别
- VSCode 和 IntelliJ IDEA 双平台支持
- 多 API 提供商兼容（OpenAI / Azure / Gemini / DeepSeek / Ollama）
- Welcome 引导页（首次安装自动显示）
- 场景浏览功能（Ctrl+Alt+L）
- 快捷键操作：
  - Ctrl+Alt+P：增强选中文本
  - Ctrl+Alt+O：快速输入增强
  - Ctrl+Alt+L：浏览场景列表
