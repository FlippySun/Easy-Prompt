# Easy Prompt — 项目脚本集

> 2026-04-08 创建 — 统一管理各端的开发、构建、测试、部署命令

所有脚本均支持 `--help` 参数查看用法。

---

## 📁 脚本索引

### Backend（后端服务）

| 脚本                | 说明                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------- |
| `backend-dev.sh`    | 启动后端 dev 服务器（自动拉起 SSH 隧道；本地 cron 默认关闭，`--allow-cron` 显式开启） |
| `backend-build.sh`  | 编译 TypeScript → dist/（可选 `--clean`）                                             |
| `backend-test.sh`   | 运行测试（backend Vitest 在 shared/protected DB 上默认锁定，需显式 unlock）           |
| `backend-deploy.sh` | 部署到 VPS（rsync + pm2 reload，支持 `--dry-run`）                                    |
| `backend-tunnel.sh` | SSH Tunnel 管理（`start\|stop\|status\|restart`）                                     |
| `backend-db.sh`     | Prisma 数据库操作（protected/shared DB 上会阻断 `migrate` 或要求 typed confirmation） |

### Browser（浏览器扩展）

| 脚本               | 说明                                                             |
| ------------------ | ---------------------------------------------------------------- |
| `browser-dev.sh`   | 启动 WXT 开发服务器（`--browser=chrome\|firefox\|safari\|edge`） |
| `browser-build.sh` | 构建扩展（`--browser=chrome\|...\|all`，可选 `--zip`）           |
| `browser-test.sh`  | 运行测试（`--mode=unit\|e2e\|all`，可选 `--watch`）              |

### PromptHub（web-hub）

| 脚本              | 说明                              |
| ----------------- | --------------------------------- |
| `webhub-dev.sh`   | 启动 Vite 开发服务器              |
| `webhub-build.sh` | 构建生产产物（可选 `--preview`）  |
| `webhub-lint.sh`  | 代码检查（可选 `--fix` 自动修复） |

### Web（prompt.zhiz.chat）

| 脚本                     | 说明                                  |
| ------------------------ | ------------------------------------- |
| `published/web-build.sh` | 构建 Web 生产产物（可选 `--preview`） |

### VS Code 扩展

| 脚本                | 说明                                      |
| ------------------- | ----------------------------------------- |
| `vscode-package.sh` | 打包 .vsix（可选 `--install` 安装到本地） |

### IntelliJ 插件

| 脚本                | 说明                                                |
| ------------------- | --------------------------------------------------- |
| `intellij-build.sh` | Gradle 构建（可选 `--run` 启动 sandbox，`--clean`） |

### 跨项目工具

| 脚本              | 说明                                                          |
| ----------------- | ------------------------------------------------------------- |
| `test-all.sh`     | 全项目测试（可选 `--quick` 跳过 integration/e2e）             |
| `release-gate.sh` | Task 8 跨端发布门禁（支持 `--quick` / 可选 integration、E2E） |
| `status.sh`       | 项目状态总览（版本、依赖、隧道、VPS 健康、Git）               |
| `clean.sh`        | 清理构建产物（可选 `--node-modules`）                         |
| `install-all.sh`  | 安装所有端依赖 + prisma generate                              |

---

## 🚀 快速开始

```bash
# 首次 clone 后安装所有依赖
./scripts/install-all.sh

# 查看项目状态
./scripts/status.sh

# 启动后端开发（自动拉起 SSH tunnel，本地 cron 默认关闭）
./scripts/backend-dev.sh

# 如需本地调试 cron，显式开启
./scripts/backend-dev.sh --allow-cron

# 启动浏览器扩展开发
./scripts/browser-dev.sh

# 启动 PromptHub 开发
./scripts/webhub-dev.sh

# 运行全部测试
./scripts/test-all.sh

# 快速测试（仅 unit）
./scripts/test-all.sh --quick

# Task 8：跨端快速门禁（跳过 VS Code package，IntelliJ 仅 compileKotlin）
./scripts/release-gate.sh --quick

# Task 8：完整离线发布门禁
./scripts/release-gate.sh

# 部署后端到 VPS（先 dry-run 确认）
./scripts/backend-deploy.sh --dry-run
./scripts/backend-deploy.sh
```

---

## 📝 约定

- 所有脚本使用 `set -euo pipefail`（严格模式）
- 脚本通过 `cd "$(dirname "$0")/..."` 自动定位到正确目录，可从任意位置调用
- 破坏性操作（db reset、deploy）均有确认提示或 `--dry-run` 支持
- 输出使用统一的 `╔══╗` 标题格式 + emoji 日志
- **SSH 隧道自动管理**：需要远端 DB/Redis 的脚本会自动检测并拉起 SSH 隧道（幂等），无需手动启动。传入 `--no-tunnel` 可跳过（本地 DB 或 CI 环境）
- **Batch B shared-DB 安全门**：保留 shared/prod DB 直连工作流，但 backend Vitest 已永久禁止在 shared/prod DB 上执行；如需运行，请把 `DATABASE_URL` 显式切到 `*_test` / `*_ci` / `*_spec` 数据库
- **本地 cron 默认关闭**：`backend-dev.sh` 会默认导出 `CRON_ENABLED=false`，避免本地 shared-DB 开发进程重复执行后台副作用任务；传 `--allow-cron` 可显式开启
- **Protected DB 运维确认**：`backend-db.sh` 在 protected/shared DB 上会阻断 `migrate`，并要求对 `seed` / `migrate-prod` / `studio` 输入当前数据库名确认；`reset` 还需额外导出 `ALLOW_PROTECTED_DB_RESET=I_ACK_PROTECTED_DB_RESET`

## 🌐 环境区分契约（2026-04-17 冻结）

> 适用范围：`backend`、`web`、`web-hub`、`browser`，以及后续 VS Code / IntelliJ 本地调试默认值注入。

<!--
2026-04-17 新增 — 环境区分任务 1
变更类型：新增/文档/配置
功能描述：把多端环境区分的共享语义、各端 env 文件映射与发布门禁原则集中写入脚本文档，降低后续继续漂移的概率。
设计思路：
  1. 先冻结共享语义，再允许各端按原生框架前缀（VITE_/WXT_）做适配。
  2. 严格区分 A=app 基准地址、B=客户端 callback scheme、C=第三方 OAuth 上游地址，避免把客户端机制误当作 localhost app 地址。
  3. 把 localhost 泄漏门禁约束到“已发布/可运行工件”，不对整个仓库粗暴全量 grep。
参数与返回值：本节为文档约束，无运行时参数与返回值。
影响范围：scripts/README.md、env 示例文件、后续任务 2~8 的实现与验收口径。
潜在风险：若后续某端未按本节契约接线，会形成“env 已冻结但运行时代码未消费”的过渡态，需要在对应任务中补齐。
-->

### 共享语义源

- `APP_ENV`
- `BACKEND_PUBLIC_BASE_URL`
- `WEB_PUBLIC_BASE_URL`
- `WEB_HUB_PUBLIC_BASE_URL`
- `SSO_HUB_BASE_URL`
- `CORS_ORIGINS`
- `COOKIE_DOMAIN`
- `AUTH_WEB_BASE_URL`
- `OAUTH_CALLBACK_BASE_URL`
- **排除项**：`DATABASE_URL` 不纳入本次环境分流，继续沿用 shared-DB 策略与现有安全门

### 环境资产分类

- **A 类：app 基准地址（随 development/production 切换）**
  - `BACKEND_PUBLIC_BASE_URL`
  - `WEB_PUBLIC_BASE_URL`
  - `WEB_HUB_PUBLIC_BASE_URL`
  - `SSO_HUB_BASE_URL`
  - `AUTH_WEB_BASE_URL`
  - `OAUTH_CALLBACK_BASE_URL`
- **B 类：客户端 callback / redirect 机制（不粗暴简化成 localhost 端口）**
  - Browser：`chromiumapp.org` / `chrome-extension://` / `safari-web-extension://` / `moz-extension://`
  - VS Code：`vscode://flippysun.easy-prompt-ai/...`
  - IntelliJ：`http://localhost:<random-port>/...`
- **C 类：第三方 OAuth 上游地址（按 development/production 分流，但后缀路径保持不变）**
  - `OAUTH_ZHIZ_BASE_URL`
  - `OAUTH_ZHIZ_AUTH_PAGE_URL`

### 当前冻结的默认映射

- **development**
  - backend：`http://localhost:3000`
  - web：`http://localhost:5174`
  - web-hub / SSO hub：`http://localhost:5173`
  - Zhiz token / skill upstream：`https://sit.zhiz.com.cn/tpt-infinity`
  - Zhiz 授权页：`https://sit.zhiz.me/#/oauth/authorize`
  - browser dev server：`3002`（仅 WXT HMR，不代表扩展真实 origin/callback）
- **production**
  - backend：`https://api.zhiz.chat`
  - web：`https://prompt.zhiz.chat`
  - web-hub / SSO hub：`https://zhiz.chat`
  - Zhiz token / skill upstream：`https://zhiz.com.cn/tpt-infinity`
  - Zhiz 授权页：`https://zhiz.me/#/oauth/authorize`

### 各端 env 文件映射

- **backend**：原始变量名（见 `backend/.env.example`）
- **web / web-hub**：使用 `VITE_` 前缀映射共享语义
  - 例：`VITE_BACKEND_PUBLIC_BASE_URL`、`VITE_SSO_HUB_BASE_URL`
  - 过渡兼容：`VITE_API_BASE`
- **browser (WXT)**：使用 `WXT_` 前缀映射共享语义
  - 例：`WXT_BACKEND_PUBLIC_BASE_URL`、`WXT_SSO_HUB_BASE_URL`
- **VS Code / IntelliJ**：后续任务中通过调试态默认值注入对齐共享语义；正式发布默认值保持 production

### 发布门禁原则

- **开发态缺少关键 env 时，不允许静默回退到生产公网地址**
- **生产构建残留 localhost 默认值视为发布阻断项**
- localhost 泄漏检查只扫描**已发布/可运行工件**中的项目约定开发地址（`localhost:3000/5173/5174` 或 `127.0.0.1:3000/5173/5174`），例如：
  - `web/dist`
  - `web-hub/dist`
  - Browser 最终 build / zip 产物
  - VS Code / IntelliJ 最终 package 或运行时注入结果
- **不要**对整个仓库做粗暴全量 grep，以免误伤测试/E2E/fixture 中保留的合法样例

## ✅ Task 8 — 跨端 Release Gate（2026-04-17）

`release-gate.sh` 是环境区分任务收尾阶段新增的统一门禁入口，用于把分散的 parity/build/package/local-host-leak 检查收敛成一个明确执行顺序。

### 推荐执行顺序

- **高频回归**：`./scripts/release-gate.sh --quick`
  - 适合本地频繁改动后快速确认
  - 跳过 VS Code package
  - IntelliJ 只跑 `compileKotlin`
- **发布前门禁**：`./scripts/release-gate.sh`
  - 适合正式发布前或大批量修改后
  - 会额外执行 VS Code `.vsix` 打包与 IntelliJ `buildPlugin`
- **增强验证**：`./scripts/release-gate.sh --with-backend-integration --with-browser-e2e`
  - 在默认 gate 之外追加 backend HTTP integration smoke 与 browser Playwright E2E

### 默认覆盖范围

- **Cross-platform parity**：`tests/test-parity.js`
- **Backend**：`scripts/backend-build.sh`
- **Browser**：`scripts/browser-test.sh --mode=unit` + `scripts/browser-build.sh`
- **Web**：`scripts/published/web-build.sh`
- **PromptHub**：`scripts/webhub-build.sh` + `scripts/webhub-lint.sh`
- **VS Code**：`scripts/vscode-package.sh`（full 模式）
- **IntelliJ**：`compileKotlin`（quick）或 `scripts/intellij-build.sh`（full）
- **发布工件 localhost 泄漏门禁**：扫描 `browser/dist`（兼容旧 `.output`）、`web/dist`、`web-hub/dist` 中的项目约定开发地址

### 不纳入默认 gate 的检查

- 依赖 shared/protected DB unlock 的 backend Vitest
- 需要外部凭证或人工交互的真实 SSO / Marketplace 发布动作
- 需要人工观感判断的 UI/UAT 步骤
