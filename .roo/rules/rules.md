# Easy Prompt — Roo Code 项目规则

## 项目概述

Easy Prompt 是一个 AI 驱动的 Prompt 智能增强工具包，支持 VSCode 和 IntelliJ IDEA 两个平台。

## 技术栈

- **核心逻辑:** Node.js (CommonJS)，零第三方依赖
- **VSCode 扩展:** VS Code Extension API + Webview
- **IntelliJ 插件:** Kotlin + Gradle + IntelliJ Platform SDK 2.3.0
- **API 调用:** curl subprocess（绕过 Cloudflare）

## 项目结构

```
core/           → 平台无关的共享逻辑（scenes, router, composer, api, defaults）
extension.js    → VSCode 扩展入口（根目录）
welcomeView.js  → Welcome 引导页（根目录）
package.json    → VSCode 扩展清单（根目录）
intellij/       → IntelliJ IDEA 插件（Kotlin）
```

## 开发规范

### 代码规范

- JavaScript: 2 空格缩进，CommonJS 模块
- Kotlin: 4 空格缩进，遵循 Kotlin 官方编码规范
- 注释：业务逻辑用中文，API/技术注释用英文

### 修改规则

1. **Core 模块修改**需同步检查 VSCode 和 IntelliJ 两端
2. **场景数据结构**必须保持：id, name, keywords, description, painPoint, example, prompt
3. **API 调用**使用 curl subprocess，不使用 Node.js 内置 HTTP
4. **两步路由**：Router (temp=0.1) → Generator (temp=0.7)
5. **38 个场景**的完整性不可破坏

### 测试验证

```bash
# 场景完整性
node -e "const { SCENES } = require('./core'); console.log(Object.keys(SCENES).length + ' scenes');"
# VSCode 语法检查
node --check extension.js && node --check welcomeView.js && node --check core/index.js
# IntelliJ 编译验证（需 JDK 17）
cd intellij && JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew compileKotlin
```

## 快速参考

| 文件               | 作用                                              |
| ------------------ | ------------------------------------------------- |
| `core/scenes.js`   | 38 个场景定义（~40KB）                            |
| `core/router.js`   | 意图识别 + Prompt 构建                            |
| `core/composer.js` | 两步路由编排                                      |
| `core/api.js`      | curl subprocess API（含重试/响应限制/Kill Timer） |
| `core/defaults.js` | 内置默认配置（AES-256-CBC 加密）                  |
| `extension.js`     | VSCode 扩展入口（8 命令 + handleCommandError）    |
| `welcomeView.js`   | Welcome 引导页                                    |
