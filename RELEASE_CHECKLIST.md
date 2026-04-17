# Easy Prompt - 发布前检查清单

## ✅ 必须完成项

### 代码质量

- [x] API 安全性修复（stdin 传递数据）
- [x] JSON 解析健壮性增强
- [x] 配置验证（Base URL、API Key 格式）—— v3.2.1 取消 /v1 强制校验，改为智能 URL 拼接
- [x] Windows curl 兼容性处理
- [x] 输入长度限制（10000 字符）
- [x] 友好错误提示（中文化、分类）
- [x] 取消操作优雅处理
- [x] 性能优化（缓存 routerPrompt）

### VSCode 插件

- [x] package.json 配置完整（9 命令 + 7 快捷键）
- [x] .vscodeignore 文件
- [x] CHANGELOG.md
- [x] handleCommandError 集中错误处理
- [x] **128x128 图标资源**（`assets/images/logo-vscode@128x128.png`）
- [ ] README.md 截图/GIF 演示
- [ ] 测试所有命令功能（含智能增强 Ctrl+Alt+I）
- [ ] 测试快捷键（7 个）

### IntelliJ 插件

- [x] build.gradle.kts 配置完整（需 JDK 17）
- [x] plugin.xml 配置完整（8 个 Action + 7 快捷键）
- [x] ScratchRootType 替代 LightVirtualFile
- [x] WriteCommandAction 支持撤销
- [x] 竞态条件修复（选区偏移量保存）
- [x] NotificationGroupManager 非阻塞通知
- [x] WelcomeDialog 97 场景全覆盖
- [ ] 测试所有 Action 功能（含智能增强 Ctrl+Alt+I）
- [ ] 测试快捷键（7 个）
- [x] 检查资源文件（图标）

### 文档

- [x] 项目根目录 README.md
- [x] CHANGELOG.md
- [ ] 添加使用截图/GIF
- [x] FAQ 常见问题
- [x] API 提供商配置示例

### 测试

- [ ] macOS + VSCode + OpenAI
- [ ] Windows + VSCode + OpenAI
- [ ] macOS + IntelliJ + OpenAI
- [ ] 测试不同 API 提供商（Azure/Gemini/DeepSeek）
- [ ] 测试网络异常情况
- [ ] 测试超长输入
- [ ] 测试特殊字符（emoji、中文、换行）

## 🔵 可选优化项

### 功能增强

- [ ] 结果缓存（相同输入直接返回）
- [ ] 请求去重（防止重复点击）
- [ ] 配置测试功能（Test Connection）
- [ ] 使用统计（匿名）

### 代码改进

- [ ] 单元测试（core/router.js、core/composer.js）
- [ ] TypeScript 类型定义（JSDoc）
- [ ] 错误日志记录
- [ ] 性能监控

### 文档完善

- [ ] 贡献指南（CONTRIBUTING.md）
- [ ] 开发者文档
- [ ] 架构说明
- [ ] API 文档

## 📦 发布步骤

### VSCode Marketplace

1. **准备发布物料 / 凭证**

   ```bash
   # 在项目根目录操作
   # 确保 icon.png 存在
   # 确保 README.md 有截图
   # 若走自动发布，需先在 deploy/config.sh 中配置 VSCE_PAT
   ```

2. **构建插件**

   ```bash
   npm install
   npx vsce package
   ```

3. **测试安装**

   ```bash
   code --install-extension easy-prompt-ai-5.3.8.vsix
   ```

4. **发布途径**

   **方式 A：自动发布（推荐）**

   ```bash
   ./deploy/deploy.sh vscode
   ```

   - 读取 `deploy/config.sh` 中的 `VSCE_PAT`
   - 自动执行打包，并调用 `npx @vscode/vsce publish --pat "$VSCE_PAT"`

   **方式 B：命令行直发**

   ```bash
   source deploy/config.sh
   npx @vscode/vsce publish --pat "$VSCE_PAT"
   ```

   **方式 C：后台手动上传**
   - 访问 https://marketplace.visualstudio.com/manage
   - 登录 Microsoft 账号
   - 创建 Publisher（如果还没有）
   - 上传 `.vsix` 文件

### JetBrains Marketplace

1. **构建插件（需 JDK 21）**

   ```bash
   cd intellij
   JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew buildPlugin
   # 输出：build/distributions/easy-prompt-intellij-5.3.8.zip
   ```

2. **测试安装**
   - IntelliJ IDEA → Settings → Plugins → ⚙️ → Install Plugin from Disk
   - 选择 ZIP 文件

3. **发布途径**

   **方式 A：自动发布（推荐）**

   ```bash
   ./deploy/deploy.sh intellij
   ```

   - 读取 `deploy/config.sh` 中的 `JETBRAINS_TOKEN` 与 `JAVA_HOME`
   - 自动执行构建，并调用 `./gradlew --no-daemon publishPlugin`

   **方式 B：Gradle 命令行直发**

   ```bash
   source deploy/config.sh
   cd intellij
   JAVA_HOME="$JAVA_HOME" PUBLISH_TOKEN="$JETBRAINS_TOKEN" ./gradlew --no-daemon publishPlugin
   ```

   **方式 C：后台手动上传**
   - 访问 https://plugins.jetbrains.com/
   - 登录 JetBrains 账号
   - 上传插件 ZIP 文件

### 浏览器扩展

1. **构建**

   ```bash
   cd browser && node build.js chrome firefox
   # 输出：dist/easy-prompt-chrome.zip / easy-prompt-firefox.zip
   ```

2. **Chrome Web Store**
   - 访问 https://chrome.google.com/webstore/devconsole
   - 上传 `dist/easy-prompt-chrome.zip`

3. **Firefox Add-ons**
   - 访问 https://addons.mozilla.org/developers/
   - 上传 `dist/easy-prompt-firefox.zip`

4. **Safari Extensions（本次 5.3.8 不包含）**
   - 本轮发版不打包 Safari，不提交 App Store Connect

## 🌐 Task 8 — 环境区分发布门禁（2026-04-17）

<!--
2026-04-17 新增 — 环境区分任务 8
变更类型：新增/文档/测试/发布
功能描述：用统一 release gate 替换旧的 Phase 9 dual-mode 验收口径，明确多端环境区分收尾阶段的命令门禁、验证矩阵与人工 smoke 范围。
设计思路：
  1. 复用 `scripts/release-gate.sh` 作为唯一统一入口，避免不同客户端各跑各的导致遗漏。
  2. 默认 gate 聚焦离线可跑的 parity/build/package/artifact 检查；外部服务依赖项降为可选或人工 smoke。
  3. 明确“localhost 泄漏只查可运行工件”的原则，和 scripts/README 的环境契约保持一致。
参数与返回值：本节为发布文档，无运行时参数与返回值；命令入口见下方 checklist。
影响范围：RELEASE_CHECKLIST.md、Task 8 执行口径、跨端 env separation 发布验收。
潜在风险：若只通过 quick gate 而未执行 full gate，可能遗漏 VS Code / IntelliJ 最终 package 级问题；需按发布阶段选择合适门禁。
-->

### 统一门禁命令

- [ ] 高频回归：`./scripts/release-gate.sh --quick`
- [ ] 发布前完整门禁：`./scripts/release-gate.sh`
- [ ] 如需追加外部依赖验证：`./scripts/release-gate.sh --with-backend-integration --with-browser-e2e`

### 默认离线 Gate 覆盖矩阵

- [ ] **Cross-platform parity** — `tests/test-parity.js` 通过
- [ ] **Backend build** — `scripts/backend-build.sh` 通过
- [ ] **Browser unit/build** — `scripts/browser-test.sh --mode=unit` 与 `scripts/browser-build.sh` 通过
- [ ] **Web build** — `scripts/published/web-build.sh` 通过
- [ ] **PromptHub build/lint** — `scripts/webhub-build.sh` 与 `scripts/webhub-lint.sh` 通过
- [ ] **VS Code package** — `scripts/vscode-package.sh` 通过（full gate）
- [ ] **IntelliJ** — `compileKotlin`（quick）或 `scripts/intellij-build.sh`（full）通过

### 发布工件 localhost 泄漏门禁

- [ ] `browser/dist`（兼容旧 `.output`）中无 `localhost:3000/5173/5174` 或 `127.0.0.1:3000/5173/5174` 残留
- [ ] `web/dist` 中无 `localhost:3000/5173/5174` 或 `127.0.0.1:3000/5173/5174` 残留
- [ ] `web-hub/dist` 中无 `localhost:3000/5173/5174` 或 `127.0.0.1:3000/5173/5174` 残留

### 环境区分人工 Smoke Matrix

- [ ] **Browser**
  - 开发态登录 / profile / enhance 走 localhost 环境
  - 生产构建默认不回落到 localhost
- [ ] **VS Code**
  - 调试态 login / token exchange / refresh / profile / enhance 指向 localhost 契约
  - 打包产物默认指向生产公网地址
- [ ] **IntelliJ**
  - 调试态 login / token exchange / refresh / profile / enhance 指向 localhost 契约
  - `compileKotlin` 与 `buildPlugin` 通过后，发布默认值保持生产公网地址
- [ ] **Web / PromptHub**
  - 本地 dev 环境与生产 dist 的 backend / web / web-hub URL 各自正确
  - 生产 dist 不残留 localhost 默认值

### 可选增强验证

- [ ] Backend HTTP integration smoke 通过
- [ ] Browser Playwright E2E 通过
- [ ] README / 发布说明中的截图、演示、手工安装步骤已更新

## ⚠️ 当前发布阻断项

- [ ] Full release gate 尚未完整跑通
- [ ] 跨端人工 smoke matrix 尚未逐项打勾
- [ ] README 截图 / 演示物料仍需补齐（如本次发版需要）

## 🎯 当前状态

- ✅ Task 1 ~ Task 7 已完成
- ✅ IntelliJ Task 7 `compileKotlin` 已通过
- ✅ 统一 `release-gate.sh` 入口已建立
- ⚠️ Task 8 仍需按本清单完成 full gate + 人工 smoke 才可视为发布就绪
