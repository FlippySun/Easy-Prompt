# 已确认决策 + VPS 基础设施状态

> 确认日期：2026-04-07

---

## 一、技术选型确认

| #   | 决策项   | 确认结果         | 备注                         |
| --- | -------- | ---------------- | ---------------------------- |
| 1   | Web 框架 | **Express 5**    | 生态成熟，中间件丰富         |
| 2   | 密码哈希 | **bcrypt**       | 无 native binding 编译问题   |
| 3   | Redis    | **首期必装**     | VPS 已有 Redis 7 Docker 实例 |
| 4   | OAuth    | Phase 6 实现     | 首期仅邮箱注册/登录          |
| 5   | SSE 流式 | Phase 6 实现     | Phase 1 仅同步接口           |
| 6   | GeoIP    | 首期跳过         | country/region 字段留 null   |
| 7   | SSL 证书 | 沿用宝塔面板方案 | 已有证书管理                 |

---

## 二、VPS 基础设施状态（107.151.137.198）

### ✅ Node.js — 就绪

- **版本**：v22.22.0（远超 20+ 要求）
- **管理**：nvm
- **路径**：`/root/.nvm/versions/node/v22.22.0/`

### ✅ PostgreSQL 16 — 就绪（Docker 容器）

- **容器名**：`PostgreSQL-VPS`（已从 `humanizer-db` 重命名）
- **镜像**：`postgres:16-alpine`
- **版本**：PostgreSQL 16.13
- **监听**：`127.0.0.1:5432`
- **用户**：`humanizer`
- **现有数据库**：`humanizer`（属于 easy-humanizer 项目）
- **docker-compose**：`/opt/easy-humanizer/docker-compose.db.yml`
- **已完成**：✅ `easy_prompt` 数据库已创建（2026-04-07）
- **连接串**：`postgresql://humanizer:<password>@127.0.0.1:5432/easy_prompt`

### ✅ Redis 7 — 就绪（Docker 容器）

- **容器名**：`Redis-VPS`（已从 `humanizer-redis` 重命名）
- **镜像**：`redis:7-alpine`
- **版本**：Redis 7.4.8
- **监听**：`127.0.0.1:6379`
- **配置**：maxmemory 256mb, allkeys-lru
- **认证**：requirepass 已设置
- **策略**：共享实例，Easy Prompt 使用 key 前缀 `ep:` 隔离
  - 限流：`ep:rate:{identifier}`
  - 黑名单缓存：`ep:bl:{type}`
  - 会话/SSO code：`ep:sso:{code}`
  - 缓存：`ep:cache:{key}`
- **连接串**：`redis://:<password>@127.0.0.1:6379/0`（使用 DB 0 + 前缀隔离）

### ✅ PM2 — 就绪

- **版本**：6.0.14（全局安装）

### ✅ Nginx — 就绪

- **管理方式**：宝塔面板
- **监听端口**：80, 443
- **SSL**：宝塔管理

### ✅ api.zhiz.chat DNS — 已解析

### 宝塔面板

- **路径**：`/www/server/panel/`
- **已安装服务**：Nginx, Node.js, PHP, Python, Pure-FTPd 等
- **SSL 方案**：通过宝塔面板申请/管理 SSL 证书

---

## 三、现有 Docker 服务一览

| 容器名             | 镜像                             | 端口           | 归属项目                     |
| ------------------ | -------------------------------- | -------------- | ---------------------------- |
| PostgreSQL-VPS     | postgres:16-alpine               | 127.0.0.1:5432 | easy-humanizer + easy-prompt |
| Redis-VPS          | redis:7-alpine                   | 127.0.0.1:6379 | easy-humanizer + easy-prompt |
| wechatpadpro-redis | redis:6                          | (internal)     | 微信                         |
| (其他)             | crowdsec, nps, xray, openclaw 等 | 各端口         | 其他服务                     |

---

## 四、Phase 1 启动前需执行的基础设施准备

### 4.1 ~~创建 easy_prompt 数据库~~ ✅ 已完成

```bash
# 已于 2026-04-07 执行
docker exec PostgreSQL-VPS psql -U humanizer -c "CREATE DATABASE easy_prompt OWNER humanizer;"
```

### 4.2 ~~通过宝塔面板为 api.zhiz.chat 配置站点 + SSL~~ ✅ 已完成

- ✅ 新建站点 `api.zhiz.chat`（2026-04-07）
- ✅ SSL 证书：复用 `*.zhiz.chat` 通配符证书（有效至 2026-06-10）
- ✅ 反向代理到 `127.0.0.1:3000`
- ✅ HTTP→HTTPS 301 重定向
- ✅ SSE 支持（`proxy_buffering off`）
- ✅ 安全头（HSTS, X-Content-Type-Options, X-Frame-Options）
- ✅ `/health` 端点日志静默
- 配置文件：`/www/server/panel/vhost/nginx/api.zhiz.chat.conf`
- 验证结果：HTTP 301 ✓ | HTTPS 502（预期，后端未部署）✓ | SSL ✓

### 4.3 生产环境 .env 关键变量

```env
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
DATABASE_URL=postgresql://humanizer:<pg_password>@127.0.0.1:5432/easy_prompt
REDIS_URL=redis://:<redis_password>@127.0.0.1:6379/0
JWT_SECRET=<随机生成 64 字符>
PROVIDER_ENCRYPTION_KEY=<随机生成 32 字节 hex>
CORS_ORIGINS=https://zhiz.chat,https://prompt.zhiz.chat
COOKIE_DOMAIN=.zhiz.chat
LOG_LEVEL=info
```

---

## 五、对执行计划的调整

### 调整 1：P1.03 Prisma Schema

- 连接使用现有 Docker PostgreSQL，用户 `humanizer`
- 需启用 `pg_trgm` 扩展（在 easy_prompt 库中）

### 调整 2：P1.19/P1.23 黑名单 + 限流

- Redis 首期可用（不再需要内存 Map 降级方案）
- 使用 `ep:` 前缀隔离 key space

### 调整 3：P2.16 Nginx 配置

- 通过宝塔面板操作，不直接编辑 Nginx 配置文件
- SSL 证书由宝塔管理

### 调整 4：P2.15 PM2

- PM2 已全局安装，无需额外安装
