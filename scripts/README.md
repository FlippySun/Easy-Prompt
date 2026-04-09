# Easy Prompt — 项目脚本集

> 2026-04-08 创建 — 统一管理各端的开发、构建、测试、部署命令

所有脚本均支持 `--help` 参数查看用法。

---

## 📁 脚本索引

### Backend（后端服务）

| 脚本                | 说明                                                                                |
| ------------------- | ----------------------------------------------------------------------------------- |
| `backend-dev.sh`    | 启动后端 dev 服务器（自动拉起 SSH 隧道，`--no-tunnel` 跳过）                        |
| `backend-build.sh`  | 编译 TypeScript → dist/（可选 `--clean`）                                           |
| `backend-test.sh`   | 运行测试（`--mode=unit\|integration\|coverage\|all`，integration/all 自动拉起隧道） |
| `backend-deploy.sh` | 部署到 VPS（rsync + pm2 reload，支持 `--dry-run`）                                  |
| `backend-tunnel.sh` | SSH Tunnel 管理（`start\|stop\|status\|restart`）                                   |
| `backend-db.sh`     | Prisma 数据库操作（`migrate\|seed\|studio\|generate\|reset`，自动拉起隧道）         |

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

### VS Code 扩展

| 脚本                | 说明                                      |
| ------------------- | ----------------------------------------- |
| `vscode-package.sh` | 打包 .vsix（可选 `--install` 安装到本地） |

### IntelliJ 插件

| 脚本                | 说明                                                |
| ------------------- | --------------------------------------------------- |
| `intellij-build.sh` | Gradle 构建（可选 `--run` 启动 sandbox，`--clean`） |

### 跨项目工具

| 脚本             | 说明                                              |
| ---------------- | ------------------------------------------------- |
| `test-all.sh`    | 全项目测试（可选 `--quick` 跳过 integration/e2e） |
| `status.sh`      | 项目状态总览（版本、依赖、隧道、VPS 健康、Git）   |
| `clean.sh`       | 清理构建产物（可选 `--node-modules`）             |
| `install-all.sh` | 安装所有端依赖 + prisma generate                  |

---

## 🚀 快速开始

```bash
# 首次 clone 后安装所有依赖
./scripts/install-all.sh

# 查看项目状态
./scripts/status.sh

# 启动后端开发（自动拉起 SSH tunnel）
./scripts/backend-dev.sh

# 启动浏览器扩展开发
./scripts/browser-dev.sh

# 启动 PromptHub 开发
./scripts/webhub-dev.sh

# 运行全部测试
./scripts/test-all.sh

# 快速测试（仅 unit）
./scripts/test-all.sh --quick

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
