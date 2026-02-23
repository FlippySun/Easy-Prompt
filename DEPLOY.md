# 🚀 CI/CD & 发版流程

> **本项目使用本地 CI/CD 脚本进行全端构建、发布和部署。所有脚本位于 `deploy/` 目录下（已 .gitignore，不会提交到仓库）。**
>
> 本文件从 `.github/copilot-instructions.md` 拆出，包含完整的 CI/CD 参考文档。

---

## 1. deploy/ 目录结构

```
deploy/
├── config.sh             # 凭证配置（Token/VPS/JAVA_HOME）— 必须存在
├── deploy.sh             # 全端构建 & 发布主脚本
├── inject-provider.js    # Provider 动态注入引擎
└── providers/            # Provider 配置文件
    ├── modelverse.json   # 当前活跃提供商
    ├── yyds168.json      # 备用提供商
    └── template.json     # 新 Provider 模板
```

## 2. config.sh 凭证配置

`config.sh` 包含所有发布所需凭证，**永远不得提交到 Git**：

| 配置项                    | 说明                         | 用途                             |
| ------------------------- | ---------------------------- | -------------------------------- |
| `VSCE_PAT`                | VSCode Marketplace PAT Token | `npx @vscode/vsce publish`       |
| `JETBRAINS_TOKEN`         | JetBrains Marketplace Token  | `./gradlew publishPlugin`        |
| `VPS_HOST/PORT/USER/PASS` | VPS SSH 凭证                 | Web / Web-Hub SCP 部署           |
| `VPS_WEB_PATH`            | Web 端 VPS 目标路径          | `/www/wwwroot/prompt.zhiz.chat/` |
| `VPS_WEBHUB_PATH`         | Web-Hub 端 VPS 目标路径      | `/www/wwwroot/zhiz.chat/`        |
| `JAVA_HOME`               | JDK 路径                     | IntelliJ Gradle 构建             |
| `GIT_REMOTE/BRANCH`       | Git 远程仓库配置             | 自动 push                        |

## 3. deploy.sh 主脚本

### 所有可用 Target

| Target      | 作用                                       | 是否需要网络 |
| ----------- | ------------------------------------------ | :----------: |
| `all`       | 全端构建 + 发布 + 部署 + Git 提交          |      是      |
| `vscode`    | 仅 VSCode 构建 + 发布                      |      是      |
| `intellij`  | 仅 IntelliJ 构建 + 发布                    |      是      |
| `web`       | 仅 Web 端部署到 VPS (prompt.zhiz.chat)     |      是      |
| `web-hub`   | 仅 PromptHub 构建 + 部署到 VPS (zhiz.chat) |      是      |
| `browser`   | 仅浏览器扩展构建                           |      否      |
| `git`       | 仅 Git 提交 + 推送                         |      是      |
| `build`     | 全端构建（不发布不部署）                   |      否      |
| `inject`    | 仅注入 Provider（需 `--provider`）         |      否      |
| `providers` | 列出可用 Provider                          |      否      |
| `verify`    | 验证全端 Provider 配置一致性               |      否      |
| `help`      | 打印帮助信息                               |      否      |

### Options

| Option                         | 说明                                     |
| ------------------------------ | ---------------------------------------- |
| `--bump <major\|minor\|patch>` | 构建前自动递增版本号（同步到 10 个文件） |
| `--provider <name>`            | 构建前注入指定 Provider 的默认配置       |
| `--no-publish`                 | 仅构建不发布到 Marketplace               |

### 版本号同步范围（--bump 自动更新的 10 个文件）

1. `package.json` — `"version"` 字段
2. `intellij/build.gradle.kts` — `version = "x.y.z"`
3. `browser/manifest.chrome.json` — `"version"`
4. `browser/manifest.firefox.json` — `"version"`
5. `browser/manifest.safari.json` — `"version"`
6. `welcomeView.js` — `Easy Prompt vX.Y.Z`
7. `web/index.html` — `Easy Prompt vX.Y.Z`
8. `README.md` — version badge `version-X.Y.Z-blue`
9. `README.md` — vsix 文件名引用
10. `README.md` — IntelliJ zip 文件名引用

> **注意：** `--bump` 不会自动更新 `CHANGELOG.md` 和 `intellij/build.gradle.kts` 的 `changeNotes`，这两项需手动编写。

### Pre-flight 检查

脚本启动时自动执行依赖检查：

| 工具        | 级别 | 缺失时行为                |
| ----------- | ---- | ------------------------- |
| `node`      | 必要 | 直接退出（die）           |
| `npx`       | 必要 | 直接退出（die）           |
| `git`       | 必要 | 直接退出（die）           |
| `sshpass`   | 可选 | 警告（Web 部署需要）      |
| `JAVA_HOME` | 可选 | 警告（IntelliJ 构建需要） |

## 4. Provider 动态注入系统

### 原理

Provider 注入引擎（`inject-provider.js`）读取 `deploy/providers/<name>.json` 中的明文配置，使用 AES-256-CBC 加密后，替换 4 个目标文件中的加密默认值：

| 目标文件                          | 注入方式                         | 匹配策略                        |
| --------------------------------- | -------------------------------- | ------------------------------- |
| `core/defaults.js`                | Marker 定位 + charCode 数组替换  | 起始/结束注释标记行             |
| `browser/shared/defaults.js`      | 正则替换 `const _vault = {...};` | 1 个匹配（已验证唯一）          |
| `web/app.js`                      | 正则替换 `const _vault = {...};` | 1 个匹配（已验证唯一）          |
| `intellij/.../BuiltinDefaults.kt` | 正则替换 3 个 `intArrayOf(...)`  | 预校验 `.test()` + `.replace()` |

### 安全特性

- 每次注入使用随机 IV，即使相同 Provider 也产生不同密文（防止模式分析）
- 注入前校验目标文件存在性（`fs.existsSync`）
- Kotlin 注入前使用 `.test()` 预校验正则匹配，失败时抛出明确错误
- 注入后自动解密验证全部 4 端配置一致性

### CLI 用法

```bash
# 注入 Provider
node deploy/inject-provider.js yyds168

# 列出可用 Provider
node deploy/inject-provider.js --list

# 验证全端一致性
node deploy/inject-provider.js --verify

# 帮助
node deploy/inject-provider.js --help
```

### 添加新 Provider

1. 复制 `deploy/providers/template.json` 为 `deploy/providers/<name>.json`
2. 填入 `name`、`description`、`baseUrl`、`apiKey`、`model`
3. 执行 `node deploy/inject-provider.js <name>` 注入
4. 执行 `node deploy/inject-provider.js --verify` 验证一致性

## 5. 标准发版流程（Copilot 执行 SOP）

> **当用户要求发版时，Copilot 必须严格按照以下步骤执行。每一步都需确认前一步成功后再继续。**

### Phase 0: 预检

```bash
# 1. 确认 deploy/ 目录完整
ls deploy/config.sh deploy/deploy.sh deploy/inject-provider.js

# 2. 确认 Git 工作区干净
git status --short

# 3. 确认当前版本号
grep '"version"' package.json | head -1
```

### Phase 1: 版本与变更日志（如需升版本）

1. 决定版本类型（patch/minor/major）
2. 手动更新 `CHANGELOG.md`，添加新版本条目
3. 手动更新 `intellij/build.gradle.kts` 中的 `changeNotes`

### Phase 2: Provider 注入（如需切换 Provider）

```bash
# 注入并验证
./deploy/deploy.sh inject --provider <name>
```

### Phase 3: 全端构建 & 发布

```bash
# 方式 A: 一键全端（推荐）
./deploy/deploy.sh all --bump patch --provider <name>

# 方式 B: 分步执行
./deploy/deploy.sh all --bump patch    # 不切换 Provider
./deploy/deploy.sh build               # 仅构建不发布（验证用）
./deploy/deploy.sh vscode              # 单独发布 VSCode
./deploy/deploy.sh intellij            # 单独发布 IntelliJ
./deploy/deploy.sh web                 # 单独部署 Web (prompt.zhiz.chat)
./deploy/deploy.sh web-hub             # 单独构建 + 部署 PromptHub (zhiz.chat)
./deploy/deploy.sh browser             # 单独构建浏览器扩展
```

### Phase 4: 验证

1. **构建产物检查：**
   - VSCode: 确认 `easy-prompt-ai-x.y.z.vsix` 存在 + 文件大小合理（~130KB）
   - IntelliJ: 确认 `intellij/build/distributions/easy-prompt-x.y.z.zip` 存在（~2MB）
   - Browser: 确认 `browser/dist/` 下 3 个 zip 文件存在（各 ~100KB）
   - Web: SSH 验证 VPS 文件版本号（prompt.zhiz.chat）
   - Web-Hub: 确认 `web-hub/dist/` 存在且含 `index.html`，SSH 验证 VPS 部署（zhiz.chat）

2. **Marketplace 发布确认：**
   - VSCode: 命令输出 "Publishing..." 成功
   - IntelliJ: 查看 Gradle 日志末尾确认上传成功

3. **浏览器扩展手动上传提醒：**
   - Chrome: https://chrome.google.com/webstore/devconsole
   - Firefox: https://addons.mozilla.org/developers/
   - Safari: Xcode -> Safari Web Extension

### Phase 5: Git 提交

```bash
# deploy.sh all 包含自动 git commit + push
# 如果分步执行，最后手动提交：
./deploy/deploy.sh git
```

## 6. 错误处理 & 日志追溯

### 日志文件位置

| 操作               | 日志文件                         | 保留策略 |
| ------------------ | -------------------------------- | -------- |
| IntelliJ 构建      | `/tmp/gradle-build-<PID>.log`    | 临时     |
| IntelliJ 发布      | `/tmp/gradle-publish-<PID>.log`  | 临时     |
| deploy.sh 控制台   | 终端直接输出（带颜色标记）       | 手动保存 |
| inject-provider.js | 终端直接输出（带 [INFO]/[FAIL]） | 手动保存 |

> **建议：** 执行 deploy.sh 时可用 `script` 或 `tee` 保存完整日志：`./deploy/deploy.sh all 2>&1 | tee deploy-$(date +%Y%m%d-%H%M%S).log`

### 错误标记与退出码

| 标记     | 含义               | 退出码 |
| -------- | ------------------ | :----: |
| `[INFO]` | 正常信息           |   —    |
| `[DONE]` | 步骤成功           |   —    |
| `[WARN]` | 警告（不中断执行） |   —    |
| `[FAIL]` | 错误（脚本终止）   |   1    |

### 常见错误排查

| 错误现象                      | 排查方向                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| `die "配置文件不存在"`        | `deploy/config.sh` 未创建，需从 template 复制并填入凭证                                               |
| `die "缺少必要工具: node"`    | Node.js 未安装或不在 PATH 中                                                                          |
| IntelliJ 构建失败             | 查看 `/tmp/gradle-build-*.log` 末尾 20 行，确认 JAVA_HOME                                             |
| IntelliJ 发布失败             | 查看 `/tmp/gradle-publish-*.log`，确认 Token 有效性                                                   |
| VSCode 发布失败               | 确认 `VSCE_PAT` 未过期，同版本号不可重复发布                                                          |
| Web 部署失败                  | 确认 `sshpass` 已安装，VPS 凭证正确，网络连通                                                         |
| Web-Hub 构建失败              | 检查 `web-hub/node_modules` 是否存在，运行 `npm install`；检查 TypeScript 类型错误 `npx tsc --noEmit` |
| Web-Hub 部署失败              | 确认 `web-hub/dist/` 存在（先 `npm run build`），确认 `sshpass` 已安装，VPS 凭证正确                  |
| Provider 注入失败             | 确认 JSON 文件存在且格式正确，目标源文件未被意外修改                                                  |
| `inject: 目标需要 --provider` | `inject` target 必须搭配 `--provider <name>` 参数                                                     |
| 注入后验证不一致              | 目标文件结构被手动修改，Marker/正则无法匹配                                                           |
| 版本号同步不全                | `--bump` 依赖 `sed` 精确匹配旧版本号，确认文件中版本格式                                              |

## 7. 强制规则

- ❌ 不得在没有 `config.sh` 的情况下运行 `deploy.sh`
- ❌ 不得手动修改 4 个目标文件中的加密默认值（必须通过 `inject-provider.js`）
- ❌ 不得将 `deploy/` 目录提交到 Git（已在 `.gitignore` 中）
- ❌ 不得在发版前跳过 `--verify` 验证全端配置一致性
- ❌ 同版本号不可重复发布到 Marketplace（必须先 `--bump`）
- ✅ 每次发版前必须确认 CHANGELOG.md 已更新
- ✅ 每次发版前必须确认 IntelliJ changeNotes 已更新
- ✅ 发版完成后必须执行 Git 提交并推送
- ✅ 浏览器扩展构建后需提醒用户手动上传到三个商店
