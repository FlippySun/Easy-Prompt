# Changelog

All notable changes to the Easy Prompt project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.2.0] - 2026-02-14

### ✨ Added

- **Ctrl+Alt+H 快捷键**：随时打开使用教程引导页
- **状态栏常驻入口**：底部状态栏显示 ✨ Easy Prompt，点击打开快捷菜单
- **场景使用频率排序**：场景列表按命中次数降序排列，显示 🔥 命中计数
- **状态栏快捷菜单**：6 项快速操作（输入增强/选中增强/指定场景/浏览场景/使用教程/API 配置）

### 🔄 Changed

- Welcome 引导页新增 Ctrl+Alt+H 快捷键说明和状态栏使用提示
- 场景浏览和指定场景增强均按使用频率智能排序

### 🐛 Fixed

- IntelliJ 端从状态栏菜单触发"增强选中文本"时，无编辑器会显示提示而非静默失败
- IntelliJ StatusBarWidget DataContext 改用 CommonDataKeys 规范引用

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
