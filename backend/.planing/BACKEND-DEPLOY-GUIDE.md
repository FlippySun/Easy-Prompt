# Easy Prompt 后端部署手册

> 基于 2026-04-08 实际部署经验编写，所有命令均已验证可执行
> 最后更新：2026-04-08

---

## 目录

1. [基础设施概览](#1-基础设施概览)
2. [本地开发环境](#2-本地开发环境)
3. [SSH 连接](#3-ssh-连接)
4. [首次部署](#4-首次部署全新安装)
5. [日常更新部署](#5-日常更新部署)
6. [数据库操作](#6-数据库操作)
7. [PM2 进程管理](#7-pm2-进程管理)
8. [Nginx 配置](#8-nginx-配置宝塔面板)
9. [环境变量配置](#9-环境变量配置)
10. [日志管理](#10-日志管理)
11. [健康检查与验证](#11-健康检查与验证)
12. [故障排查](#12-故障排查)
13. [回滚操作](#13-回滚操作)

---

## 1. 基础设施概览

| 项目 | 值 |
| ---- | -- |
| VPS IP | `107.151.137.198` |
| SSH 用户 | `root` |
| SSH 密钥 | `~/.ssh/easy-prompt-vps`（ed25519） |
| API 域名 | `api.zhiz.chat` |
| 后端部署路径 | `/www/wwwroot/api.zhiz.chat` |
| Node.js | v22.22.0（NVM 管理） |
| NPM | v10.9.4 |
| PM2 | v6.0.14（全局安装） |
| 数据库 | PostgreSQL 16（Docker 容器） |
| 缓存 | Redis（Docker 容器） |
| Web 面板 | 宝塔面板（Nginx 配置管理） |
| SSL 证书 | 宝塔自动管理（Let's Encrypt） |

### 服务器资源（2026-04-08 快照）

- 磁盘：77G 总量，约 12G 可用（84% 使用率，需关注）
- 内存：7.7Gi 总量，约 5.0Gi 可用
- PM2 实例：2 个 cluster，每个约 235MB

### 关键路径

```
/www/wwwroot/api.zhiz.chat/          # 后端部署根目录
  dist/                               # TypeScript 编译产物
  prisma/                             # Prisma schema + 迁移文件
    schema.prisma
    migrations/
    data/                             # 种子数据
  node_modules/                       # 生产依赖
  logs/                               # 日志文件
    app.log.1                         # Pino 应用日志（pino-roll 轮转）
    audit.log.1                       # 审计日志
    ai-request.log.1                  # AI 请求日志
    out.log                           # PM2 stdout
    error.log                         # PM2 stderr
    combined.log                      # PM2 combined（Pino 不写此文件）
  ecosystem.config.js                 # PM2 配置
  package.json
  package-lock.json
  .env                                # 生产环境变量（不入 Git）
```

### Nginx 相关路径

```
/www/server/panel/vhost/nginx/api.zhiz.chat.conf     # Nginx server block
/www/server/panel/vhost/cert/api.zhiz.chat/           # SSL 证书
/www/wwwlogs/api.zhiz.chat.log                        # Nginx access log
/www/wwwlogs/api.zhiz.chat.error.log                  # Nginx error log
```

---

## 2. 本地开发环境

### 前置条件

```bash
# 本地项目目录
cd /Users/flippysun/mcp-tools/easy-prompt/backend

# 确认 Node.js 版本 >= 20
node -v

# 确认 SSH 密钥存在
ls -la ~/.ssh/easy-prompt-vps
```

### SSH Tunnel（本地连接远程数据库）

```bash
# 启动隧道（PostgreSQL 5432 + Redis 6379）
npm run tunnel:start

# 检查隧道状态
npm run tunnel:status

# 停止隧道
npm run tunnel:stop
```

### 本地构建

```bash
# TypeScript 编译
npm run build

# 运行测试
npm test

# Lint 检查
npm run lint
```

---

## 3. SSH 连接

### 直接连接

```bash
# 使用 ~/.ssh/config（已配置）
ssh root@107.151.137.198

# 或显式指定密钥
ssh -i ~/.ssh/easy-prompt-vps root@107.151.137.198
```

### 已配置的 SSH Config（~/.ssh/config）

```
Host 107.151.137.198
    HostName 107.151.137.198
    User root
    IdentityFile ~/.ssh/easy-prompt-vps
    ServerAliveInterval 60
```

### 远程执行单条命令（重要！）

```bash
# NVM 环境需显式加载，否则 pm2/node 命令不在 PATH 中
ssh -i ~/.ssh/easy-prompt-vps root@107.151.137.198 \
  "export NVM_DIR=\$HOME/.nvm && . \$NVM_DIR/nvm.sh && <你的命令>"
```

> **踩坑记录**：非交互式 SSH 不会加载 `~/.bashrc` 中的 NVM 初始化，
> 必须在每条远程命令前显式 `source nvm.sh`，否则 `pm2`/`node`/`npm` 命令找不到。

---

## 4. 首次部署（全新安装）

> 仅在全新 VPS 或全新目录时使用

### 4.1 创建部署目录

```bash
ssh -i ~/.ssh/easy-prompt-vps root@107.151.137.198 \
  "mkdir -p /www/wwwroot/api.zhiz.chat/logs"
```

### 4.2 上传文件

```bash
LOCAL_BACKEND="/Users/flippysun/mcp-tools/easy-prompt/backend"
VPS="root@107.151.137.198"
VPS_DIR="/www/wwwroot/api.zhiz.chat"
SSH_KEY="$HOME/.ssh/easy-prompt-vps"

# 1. 本地构建
cd "$LOCAL_BACKEND" && npm run build

# 2. 上传编译产物
scp -i "$SSH_KEY" -r "$LOCAL_BACKEND/dist" "$VPS:$VPS_DIR/"

# 3. 上传 Prisma 文件
scp -i "$SSH_KEY" -r "$LOCAL_BACKEND/prisma" "$VPS:$VPS_DIR/"

# 4. 上传包管理文件
scp -i "$SSH_KEY" "$LOCAL_BACKEND/package.json" "$LOCAL_BACKEND/package-lock.json" "$VPS:$VPS_DIR/"

# 5. 上传 PM2 配置
scp -i "$SSH_KEY" "$LOCAL_BACKEND/ecosystem.config.js" "$VPS:$VPS_DIR/"
```

### 4.3 远程安装依赖 + 迁移 + 启动

```bash
ssh -i ~/.ssh/easy-prompt-vps root@107.151.137.198 << 'EOF'
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"

cd /www/wwwroot/api.zhiz.chat

# 安装生产依赖（不装 devDependencies）
npm ci --omit=dev

# 生成 Prisma Client
npx prisma generate

# 执行数据库迁移
npx prisma migrate deploy

# 启动 PM2 进程
pm2 start ecosystem.config.js --env production

# 保存 PM2 进程列表（重启后自动恢复）
pm2 save

# 设置 PM2 开机自启
pm2 startup
EOF
```

### 4.4 配置 .env

```bash
# 上传 .env 模板
scp -i ~/.ssh/easy-prompt-vps \
  "$LOCAL_BACKEND/.env.production" \
  root@107.151.137.198:/www/wwwroot/api.zhiz.chat/.env

# SSH 到服务器编辑 .env，填入真实凭证
ssh -i ~/.ssh/easy-prompt-vps root@107.151.137.198 \
  "vi /www/wwwroot/api.zhiz.chat/.env"
```

### 4.5 配置 Nginx（宝塔面板）

1. 登录宝塔面板
2. 网站 > 添加站点 > 域名填 `api.zhiz.chat`
3. SSL > 申请 Let's Encrypt 证书
4. 配置文件 > 参考 `backend/scripts/setup-nginx-bt.conf` 的内容
5. 或直接编辑 `/www/server/panel/vhost/nginx/api.zhiz.chat.conf`

### 4.6 验证首次部署

```bash
curl -s https://api.zhiz.chat/health
# 预期: {"status":"ok","timestamp":"..."}
```

---

## 5. 日常更新部署

> 这是最常用的操作，每次代码更新后执行

### 5.1 完整更新（依赖 + 迁移 + 代码）

```bash
LOCAL_BACKEND="/Users/flippysun/mcp-tools/easy-prompt/backend"
SSH_KEY="$HOME/.ssh/easy-prompt-vps"
VPS="root@107.151.137.198"
VPS_DIR="/www/wwwroot/api.zhiz.chat"

echo "[1/5] 本地构建..."
cd "$LOCAL_BACKEND" && npm run build

echo "[2/5] 上传编译产物..."
scp -i "$SSH_KEY" -r "$LOCAL_BACKEND/dist" "$VPS:$VPS_DIR/"

echo "[3/5] 上传 Prisma 文件..."
scp -i "$SSH_KEY" -r "$LOCAL_BACKEND/prisma" "$VPS:$VPS_DIR/"

echo "[4/5] 上传包管理文件..."
scp -i "$SSH_KEY" "$LOCAL_BACKEND/package.json" "$LOCAL_BACKEND/package-lock.json" "$VPS:$VPS_DIR/"
scp -i "$SSH_KEY" "$LOCAL_BACKEND/ecosystem.config.js" "$VPS:$VPS_DIR/"

echo "[5/5] 远程安装依赖 + 迁移 + 重启..."
ssh -i "$SSH_KEY" "$VPS" << 'REMOTE'
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
cd /www/wwwroot/api.zhiz.chat
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy
pm2 reload ecosystem.config.js --env production
REMOTE

echo "Done! Verify: curl -s https://api.zhiz.chat/health"
```

### 5.2 仅更新代码（无依赖变更，最快）

```bash
# 本地构建
cd /Users/flippysun/mcp-tools/easy-prompt/backend && npm run build

# 上传 dist 目录
scp -i ~/.ssh/easy-prompt-vps -r dist root@107.151.137.198:/www/wwwroot/api.zhiz.chat/

# 远程 reload（graceful，零停机）
ssh -i ~/.ssh/easy-prompt-vps root@107.151.137.198 \
  "export NVM_DIR=\$HOME/.nvm && . \$NVM_DIR/nvm.sh && pm2 reload easy-prompt-api"
```

### 5.3 仅更新数据库迁移

```bash
# 上传 Prisma 文件
scp -i ~/.ssh/easy-prompt-vps -r prisma root@107.151.137.198:/www/wwwroot/api.zhiz.chat/

# 远程执行迁移 + 重启
ssh -i ~/.ssh/easy-prompt-vps root@107.151.137.198 \
  "export NVM_DIR=\$HOME/.nvm && . \$NVM_DIR/nvm.sh && cd /www/wwwroot/api.zhiz.chat && npx prisma generate && npx prisma migrate deploy && pm2 reload easy-prompt-api"
```

---

## 6. 数据库操作

### VPS 上执行 Prisma 命令

```bash
# SSH 到 VPS 后：
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
cd /www/wwwroot/api.zhiz.chat

# 执行生产迁移
npx prisma migrate deploy

# 生成 Prisma Client
npx prisma generate

# 运行种子脚本
npx prisma db seed

# 检查迁移状态
npx prisma migrate status
```

### 本地通过 SSH Tunnel 操作

```bash
cd /Users/flippysun/mcp-tools/easy-prompt/backend

# 启动隧道
npm run tunnel:start

# 打开 Prisma Studio（浏览器 GUI）
npm run db:studio

# 创建新迁移（本地开发用）
npm run db:migrate
```

---

## 7. PM2 进程管理

> VPS 上执行 PM2 命令前必须先加载 NVM：
> `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"`

### 常用命令速查

| 操作 | 命令 |
| ---- | ---- |
| 查看进程列表 | `pm2 list` |
| 查看详细信息 | `pm2 describe easy-prompt-api` |
| 优雅重启（推荐） | `pm2 reload easy-prompt-api` |
| 强制重启 | `pm2 restart easy-prompt-api` |
| 停止 | `pm2 stop easy-prompt-api` |
| 删除进程 | `pm2 delete easy-prompt-api` |
| 从配置启动 | `pm2 start ecosystem.config.js --env production` |
| 查看实时日志 | `pm2 logs easy-prompt-api --lines 50` |
| 清空日志 | `pm2 flush` |
| 保存进程列表 | `pm2 save` |
| 监控面板 | `pm2 monit` |

### PM2 配置要点（ecosystem.config.js）

| 参数 | 值 | 说明 |
| ---- | -- | ---- |
| name | `easy-prompt-api` | 进程名称 |
| script | `dist/server.js` | 入口文件 |
| instances | `2` | cluster 实例数 |
| exec_mode | `cluster` | 集群模式 |
| max_memory_restart | `500M` | 内存超限自动重启 |
| kill_timeout | `5000` | graceful shutdown 超时 |
| listen_timeout | `10000` | 启动超时 |

### reload vs restart

- `pm2 reload`：graceful reload，逐个实例重启，零停机（**推荐**）
- `pm2 restart`：直接杀进程重启，会有短暂不可用

---

## 8. Nginx 配置（宝塔面板）

### 配置文件位置

```
/www/server/panel/vhost/nginx/api.zhiz.chat.conf
```

### 当前配置要点

| 特性 | 配置 |
| ---- | ---- |
| HTTP 跳转 | 80 端口 301 到 443 |
| 反向代理 | `proxy_pass http://127.0.0.1:3000` |
| SSL | 宝塔管理的 Let's Encrypt |
| 安全头 | HSTS、X-Content-Type-Options、X-Frame-Options |
| 请求体限制 | `client_max_body_size 10m` |
| Gzip | 开启，压缩 JSON/text/SSE |
| SSE 支持 | `proxy_buffering off`、`proxy_cache off` |
| 超时 | connect 60s、read 120s、send 60s |
| 健康检查 | `/health` 不记录 access log |

### 修改 Nginx 配置后

```bash
# 测试配置语法
nginx -t

# 重新加载（不中断连接）
nginx -s reload
```

---

## 9. 环境变量配置

### .env 文件位置

```
/www/wwwroot/api.zhiz.chat/.env
```

### 环境变量列表

| 变量 | 说明 | 敏感 |
| ---- | ---- | ---- |
| `NODE_ENV` | `production` | 否 |
| `PORT` | `3000` | 否 |
| `HOST` | `0.0.0.0` | 否 |
| `DATABASE_URL` | PostgreSQL 连接串 | 是 |
| `REDIS_URL` | Redis 连接串 | 是 |
| `JWT_SECRET` | JWT 签名密钥（256-bit） | 是 |
| `JWT_ACCESS_EXPIRES` | Access Token 过期时间 | 否 |
| `JWT_REFRESH_EXPIRES` | Refresh Token 过期时间 | 否 |
| `CORS_ORIGINS` | 允许的跨域源 | 否 |
| `COOKIE_DOMAIN` | Cookie 域 | 否 |
| `COOKIE_SECRET` | Cookie 签名密钥 | 是 |
| `LOG_LEVEL` | 日志级别 | 否 |
| `PROVIDER_ENCRYPTION_KEY` | Provider 密钥加密 key（32字节hex） | 是 |
| `RATE_LIMIT_*` | 各类限流参数 | 否 |
| `ADMIN_EMAILS` | 管理员邮箱列表（逗号分隔） | 否 |
| `CRON_ENABLED` | Cron 任务开关（true/false） | 否 |

### 修改环境变量后

```bash
# 修改 .env 后需重启 PM2 使变量生效
pm2 reload easy-prompt-api --update-env
```

---

## 10. 日志管理

### 日志架构

后端使用 Pino 日志库，通过 pino-roll 实现日志轮转。

| 日志文件 | 内容 | 轮转 | 保留 |
| -------- | ---- | ---- | ---- |
| `logs/app.log.1` | 应用日志（HTTP、业务） | 每日 | 30 天 |
| `logs/audit.log.1` | 管理员操作审计 | 每日 | 90 天 |
| `logs/ai-request.log.1` | AI 增强请求详情 | 每日 | 60 天 |
| `logs/out.log` | PM2 stdout | PM2 管理 | - |
| `logs/error.log` | PM2 stderr | PM2 管理 | - |

> **注意**：`combined.log` 虽由 PM2 配置创建，但 Pino 通过 pino-roll 写入
> `app.log.{N}` 文件。查看业务日志请看 `app.log.1`，不是 `combined.log`。

### 查看日志

```bash
# 查看实时 PM2 日志
pm2 logs easy-prompt-api --lines 50

# 查看 Pino 应用日志（JSON 格式）
tail -50 /www/wwwroot/api.zhiz.chat/logs/app.log.1

# 查看 Pino 应用日志（美化格式，需安装 pino-pretty）
tail -50 /www/wwwroot/api.zhiz.chat/logs/app.log.1 | npx pino-pretty

# 查看 Cron 任务执行日志
grep 'Cron job' /www/wwwroot/api.zhiz.chat/logs/app.log.1 | tail -20

# 查看审计日志
tail -20 /www/wwwroot/api.zhiz.chat/logs/audit.log.1

# 查看 AI 请求日志
tail -20 /www/wwwroot/api.zhiz.chat/logs/ai-request.log.1

# 查看 Nginx 访问日志
tail -50 /www/wwwlogs/api.zhiz.chat.log

# 查看 Nginx 错误日志
tail -50 /www/wwwlogs/api.zhiz.chat.error.log
```

---

## 11. 健康检查与验证

### 快速检查（从本地执行）

```bash
# 1. 健康检查
curl -s https://api.zhiz.chat/health
# 预期: {"status":"ok","timestamp":"..."}

# 2. 检查 PM2 状态
ssh -i ~/.ssh/easy-prompt-vps root@107.151.137.198 \
  "export NVM_DIR=\$HOME/.nvm && . \$NVM_DIR/nvm.sh && pm2 list"

# 3. 检查端口监听
ssh -i ~/.ssh/easy-prompt-vps root@107.151.137.198 \
  "netstat -tuln | grep 3000"

# 4. 检查 Cron 任务日志
ssh -i ~/.ssh/easy-prompt-vps root@107.151.137.198 \
  "grep 'Cron job' /www/wwwroot/api.zhiz.chat/logs/app.log.1 | tail -5"
```

### 完整验证脚本

```bash
# 上传并运行验证脚本
scp -i ~/.ssh/easy-prompt-vps \
  /Users/flippysun/mcp-tools/easy-prompt/backend/scripts/verify-deployment.sh \
  root@107.151.137.198:/tmp/

ssh -i ~/.ssh/easy-prompt-vps root@107.151.137.198 \
  "bash /tmp/verify-deployment.sh"
```

验证脚本位置：`backend/scripts/verify-deployment.sh`

检查项目：
1. 后端目录存在
2. .env 关键配置项
3. PM2 进程状态（自动加载 NVM）
4. 端口 3000 监听
5. Nginx 配置（宝塔路径）
6. DNS 解析
7. HTTPS 访问
8. /health 端点响应
9. Cron 任务日志（检查 `app.log.1`）

---

## 12. 故障排查

### 常见问题

#### PM2 命令找不到

```
原因：非交互式 SSH 不加载 NVM
解决：命令前加 export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
```

#### 端口 3000 未监听

```bash
# 检查 PM2 进程
pm2 list

# 如果进程停止，查看错误日志
pm2 logs easy-prompt-api --err --lines 100

# 重新启动
pm2 start ecosystem.config.js --env production
```

#### 502 Bad Gateway

```bash
# 检查后端进程是否存活
pm2 list

# 检查 Nginx 错误日志
tail -20 /www/wwwlogs/api.zhiz.chat.error.log

# 检查 Nginx 配置
nginx -t
```

#### 数据库连接失败

```bash
# 检查 Docker 中 PostgreSQL 是否运行
docker ps | grep postgres

# 检查 .env 中 DATABASE_URL 是否正确
grep DATABASE_URL /www/wwwroot/api.zhiz.chat/.env

# 测试连接
cd /www/wwwroot/api.zhiz.chat && npx prisma migrate status
```

#### Redis 连接失败

```bash
# 检查 Docker 中 Redis 是否运行
docker ps | grep redis

# 测试 Redis 连接
redis-cli ping
```

#### Cron 任务不执行

```bash
# 检查 CRON_ENABLED 是否为 true
grep CRON_ENABLED /www/wwwroot/api.zhiz.chat/.env

# 检查最近 Cron 日志
grep 'Cron job' /www/wwwroot/api.zhiz.chat/logs/app.log.1 | tail -10

# 检查 cron 注册日志（启动时输出）
grep 'cron' /www/wwwroot/api.zhiz.chat/logs/app.log.1 | head -20
```

#### 磁盘空间不足

```bash
# 检查磁盘使用
df -h /

# 清理 PM2 日志
pm2 flush

# 清理旧的 npm 缓存
npm cache clean --force

# 清理 Docker 无用镜像
docker system prune -f
```

---

## 13. 回滚操作

### 代码回滚

```bash
# 1. 本地切换到上一个版本
cd /Users/flippysun/mcp-tools/easy-prompt/backend
git checkout HEAD~1

# 2. 重新构建
npm run build

# 3. 上传并重启（同 5.2 仅更新代码流程）
scp -i ~/.ssh/easy-prompt-vps -r dist root@107.151.137.198:/www/wwwroot/api.zhiz.chat/
ssh -i ~/.ssh/easy-prompt-vps root@107.151.137.198 \
  "export NVM_DIR=\$HOME/.nvm && . \$NVM_DIR/nvm.sh && pm2 reload easy-prompt-api"

# 4. 切回最新代码
git checkout main
```

### 数据库回滚

```bash
# 回滚最近一次迁移（危险操作！）
# 需要 SSH 到 VPS 执行
cd /www/wwwroot/api.zhiz.chat
npx prisma migrate reset --skip-seed  # 重置所有迁移（开发环境）
# 生产环境建议手动编写回滚 SQL
```

### PM2 进程回滚

```bash
# 停止当前进程
pm2 stop easy-prompt-api

# 重新从配置启动
pm2 start ecosystem.config.js --env production
```

---

## 附录：快速命令参考卡

```bash
# ===== 本地 =====
cd /Users/flippysun/mcp-tools/easy-prompt/backend
npm run build                    # 构建
npm test                         # 测试
npm run tunnel:start             # SSH 隧道

# ===== 部署 =====
# 仅代码更新（最快）
npm run build && \
scp -i ~/.ssh/easy-prompt-vps -r dist root@107.151.137.198:/www/wwwroot/api.zhiz.chat/ && \
ssh -i ~/.ssh/easy-prompt-vps root@107.151.137.198 \
  "export NVM_DIR=\$HOME/.nvm && . \$NVM_DIR/nvm.sh && pm2 reload easy-prompt-api"

# ===== VPS 操作 =====
# SSH 登录
ssh -i ~/.ssh/easy-prompt-vps root@107.151.137.198

# 加载 NVM（每次 SSH 后首先执行）
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"

# PM2 常用
pm2 list                         # 进程列表
pm2 reload easy-prompt-api       # 优雅重启
pm2 logs easy-prompt-api         # 实时日志

# 验证
curl -s https://api.zhiz.chat/health
```
