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

- [x] package.json 配置完整（8 命令 + 6 快捷键）
- [x] .vscodeignore 文件
- [x] CHANGELOG.md
- [x] handleCommandError 集中错误处理
- [ ] **icon.png （128x128）** ⚠️ 需要设计师制作
- [ ] README.md 截图/GIF 演示
- [ ] 测试所有命令功能（含智能增强 Ctrl+Alt+I）
- [ ] 测试快捷键（6 个）

### IntelliJ 插件

- [x] build.gradle.kts 配置完整（需 JDK 17）
- [x] plugin.xml 配置完整（7 个 Action + 6 快捷键）
- [x] ScratchRootType 替代 LightVirtualFile
- [x] WriteCommandAction 支持撤销
- [x] 竞态条件修复（选区偏移量保存）
- [x] NotificationGroupManager 非阻塞通知
- [x] WelcomeDialog 85 场景全覆盖
- [ ] 测试所有 Action 功能（含智能增强 Ctrl+Alt+I）
- [ ] 测试快捷键（6 个）
- [ ] 检查资源文件（图标）

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

1. **准备发布物料**

   ```bash
   # 在项目根目录操作
   # 确保 icon.png 存在
   # 确保 README.md 有截图
   ```

2. **构建插件**

   ```bash
   npm install
   npx vsce package
   ```

3. **测试安装**

   ```bash
   code --install-extension easy-prompt-ai-5.0.1.vsix
   ```

4. **发布到市场**
   - 访问 https://marketplace.visualstudio.com/manage
   - 登录 Microsoft 账号
   - 创建 Publisher（如果还没有）
   - 上传 .vsix 文件

### JetBrains Marketplace

1. **构建插件（需 JDK 17）**

   ```bash
   cd intellij
   JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew buildPlugin
   # 输出：build/distributions/easy-prompt-5.0.1.zip
   ```

2. **测试安装**
   - IntelliJ IDEA → Settings → Plugins → ⚙️ → Install Plugin from Disk
   - 选择 ZIP 文件

3. **发布到市场**
   - 访问 https://plugins.jetbrains.com/
   - 登录 JetBrains 账号
   - 上传插件 ZIP 文件

### 浏览器扩展

1. **构建**

   ```bash
   cd browser && node build.js
   # 输出：dist/easy-prompt-chrome.zip / easy-prompt-firefox.zip / easy-prompt-safari.zip
   ```

2. **Chrome Web Store**
   - 访问 https://chrome.google.com/webstore/devconsole
   - 上传 `dist/easy-prompt-chrome.zip`

3. **Firefox Add-ons**
   - 访问 https://addons.mozilla.org/developers/
   - 上传 `dist/easy-prompt-firefox.zip`

4. **Safari Extensions**
   - 需要通过 Xcode 打包并提交至 App Store Connect

## ⚠️ 阻塞发布的问题

### 高优先级

1. **VSCode icon.png 缺失** - 需要设计 128x128 PNG 图标
2. **IntelliJ 插件图标** - 检查是否需要额外图标资源
3. **完整测试** - 至少在 macOS + VSCode 环境完整测试一遍

### 中优先级

4. **README 截图** - 添加使用演示 GIF 或截图
5. **FAQ 文档** - 整理常见问题和解决方案

## 📝 发布后待办

1. 监控用户反馈和 Issue
2. 收集使用统计（如果实现了）
3. 根据反馈迭代优化
4. 准备下一版本计划

## 🎯 当前状态

- ✅ 核心功能完整
- ✅ 代码质量优化完成
- ✅ 基础文档齐全
- ⚠️ 缺少图标文件
- ⚠️ 缺少使用演示
- ⚠️ 需要完整测试

**建议：先完成图标和演示，再进行完整测试后发布。**
