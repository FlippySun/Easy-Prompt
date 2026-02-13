# Copilot Prompt — Easy Prompt 项目

## 项目概述
Easy Prompt 是一个 AI 驱动的 Prompt 智能增强工具包，通过两步 AI 路由实现 38 种场景的精准 Prompt 优化。

## 技术栈
- **Core:** Node.js (CommonJS), 无第三方依赖
- **VSCode:** Extension API + Webview
- **IntelliJ:** Kotlin + Gradle + IntelliJ Platform SDK

## 核心流程
1. 用户输入原始 Prompt
2. Router（低温 AI）识别意图 → 匹配 1-5 个场景
3. Generator（高温 AI）基于场景 System Prompt 生成优化后的 Prompt

## 开发规范
- 修改 core/ 时确保不破坏两端（VSCode / IntelliJ）兼容
- 场景数据结构：{ id, name, keywords, description, painPoint, example, prompt }
- API 层使用 curl subprocess，非 Node.js HTTP
- 提交遵循 Conventional Commits 规范

## 快速上下文
- 38 个场景定义在 `core/scenes.js`
- 意图路由在 `core/router.js`
- VSCode 扩展入口 `vscode/extension.js`
- IntelliJ 插件入口 `intellij/src/main/resources/META-INF/plugin.xml`
