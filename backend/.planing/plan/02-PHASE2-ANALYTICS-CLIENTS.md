# Phase 2：请求分析 + 全端客户端接入

> 预估工期：2 周 | 任务数：18 项（其中 6 项已迁移至 Phase9）
> 里程碑：M2 — 分析面板可用、至少一个客户端完成后端对接
> 前置条件：Phase 1 M1 验收通过
> **状态：✅ 后端服务层已交付（2026-04-08 VPS 验证通过）**

---

## 2A — 分析与审计（P2.01 - P2.08）

### P2.01 — AI 增强专用日志

- **目标文件**：
  - `backend/src/utils/aiLogger.ts`
- **预期行为**：
  - 专用 Pino child logger（module: 'ai-enhance'）
  - 结构化字段（§8B.3）：requestId, userId, clientType, scene, model, provider, inputTokens, outputTokens, latencyMs, status, errorCode
  - 日志级别：成功=info, 失败=error, 慢请求(>5s)=warn
  - 与 aiLog.service.ts 配合：先写 DB 日志，同时输出结构化 Pino 日志
- **验证方式**：test + 手工（检查日志输出）
- **回滚方案**：删除文件
- **依赖关系**：P1.10, P1.28
- **风险等级**：低
- **对应章节**：§8B.3

### P2.02 — Admin 审计日志

- **目标文件**：
  - `backend/src/utils/auditLogger.ts`
- **预期行为**：
  - 记录管理员操作审计日志（§8B.4）：
    - 创建/修改/删除 Provider
    - 创建/修改/删除 黑名单规则
    - 审核 Prompt（approve/reject）
    - 修改用户角色
  - 日志字段：adminId, action, targetType, targetId, changes(before/after), ip, timestamp
  - 输出到独立日志文件（`audit.log`）+ DB 可选
- **验证方式**：test + 手工
- **回滚方案**：删除文件
- **依赖关系**：P1.10
- **风险等级**：低
- **对应章节**：§8B.4

### P2.03 — 日志轮转配置

- **目标文件**：
  - `backend/src/config/logRotation.ts`（或 PM2 ecosystem 配置）
- **预期行为**：
  - 生产环境日志轮转策略（§8B.5）：
    - 应用日志：每日轮转，保留 30 天
    - 审计日志：每日轮转，保留 90 天
    - AI 请求日志：每日轮转，保留 60 天
  - 使用 PM2 内置 log rotation 或 `pino-roll` transport
  - 压缩归档旧日志（gzip）
- **验证方式**：手工（验证日志文件生成和轮转）
- **回滚方案**：移除轮转配置
- **依赖关系**：P1.10
- **风险等级**：低
- **对应章节**：§8B.5

### P2.04 — Analytics Service

- **目标文件**：
  - `backend/src/services/analytics.service.ts`
- **预期行为**：
  - `getRequestList(filters, pagination)` → 分页查询 ai_request_logs
    - 筛选：dateRange, client_type, scene, model, provider, status, user_id, ip_address
  - `getRequestDetail(id)` → 单条日志详情
  - `getSummary(dateRange)` → AnalyticsSummary
    - 总请求数、成功率、平均延迟、总 token 消耗、总费用
  - `getDailyStats(dateRange)` → 每日统计趋势
  - `getByClient(dateRange)` → 按客户端类型分组统计
  - `getByScene(dateRange)` → 按场景分组统计
  - `getByIp(dateRange, limit)` → 按 IP 分组统计（用于发现滥用）
  - `getByUser(dateRange, limit)` → 按用户分组统计
  - `getCostReport(dateRange)` → 费用明细（按 provider/model）
- **验证方式**：test
- **回滚方案**：删除文件
- **依赖关系**：P1.03, P1.28
- **风险等级**：中（大表查询需优化索引）
- **对应章节**：§5.3 Analytics

### P2.05 — Analytics Routes

- **目标文件**：
  - `backend/src/routes/analytics.routes.ts`
  - `backend/src/validators/analytics.validators.ts`
- **预期行为**：
  - 全部需 admin 权限：
    - `GET /api/v1/analytics/requests` → 请求列表（分页+筛选）
    - `GET /api/v1/analytics/requests/:id` → 请求详情
    - `GET /api/v1/analytics/summary` → 汇总
    - `GET /api/v1/analytics/daily` → 每日趋势
    - `GET /api/v1/analytics/by-client` → 按客户端
    - `GET /api/v1/analytics/by-scene` → 按场景
    - `GET /api/v1/analytics/by-ip` → 按 IP
    - `GET /api/v1/analytics/by-user` → 按用户
    - `GET /api/v1/analytics/cost` → 费用报表
  - 查询参数 Zod 校验（dateRange 格式、分页参数范围）
- **验证方式**：test（Supertest）
- **回滚方案**：删除文件
- **依赖关系**：P2.04, P1.14
- **风险等级**：中
- **对应章节**：§5.3 Analytics

### P2.06 — GeoIP 集成（可选首期）

- **目标文件**：
  - `backend/src/utils/geoip.ts`
- **预期行为**：
  - IP → country + region 解析
  - 使用 MaxMind GeoLite2 数据库（免费版）或降级为 IP 段表
  - 集成到 AI 请求日志记录流程
  - 首期可留空（country/region = null），后续补充
- **验证方式**：test（mock IP 地址）
- **回滚方案**：删除文件，字段留 null
- **依赖关系**：P1.01
- **风险等级**：低（可推迟）
- **对应章节**：§4.2 ai_request_logs

### P2.07 — Scenes Service（后端数据源）

- **目标文件**：
  - `backend/src/services/scenes.service.ts`（增强 P1.34）
- **预期行为**：
  - 从 `core/scenes.js` 导入场景数据作为唯一数据源
  - 提供查询接口：byId, byCategory, search(keyword)
  - 缓存场景列表（启动时加载，内存常驻）
  - 供 AI Gateway 验证 scene 参数合法性
- **验证方式**：test
- **回滚方案**：回退到 P1.34 版本
- **依赖关系**：P1.34
- **风险等级**：低
- **对应章节**：§5.3 Scenes

### P2.08 — 定时任务框架

- **目标文件**：
  - `backend/src/cron/index.ts`
  - `backend/src/cron/dailyStatsAggregate.ts`
  - `backend/src/cron/rateDecay.ts`
  - `backend/src/cron/blacklistCleanup.ts`
  - `backend/src/cron/blacklistCacheSync.ts`
  - `backend/src/cron/aiLogsArchive.ts`
  - `backend/src/cron/featuredRefresh.ts`
- **预期行为**：
  - 使用 node-cron 调度（§8C）：
    1. `dailyStatsAggregate`（每日 02:00 UTC）：聚合前一天 ai_request_logs → daily_stats
    2. `rateDecay`（每 5 分钟）：降低 RateViolation 过期计数
    3. `blacklistCleanup`（每小时）：清除过期的临时黑名单规则
    4. `blacklistCacheSync`（每 10 分钟）：DB 黑名单规则 → Redis/内存缓存同步
    5. `aiLogsArchive`（每日 03:00 UTC）：归档 90 天前的 ai_request_logs（首期可仅标记/删除）
    6. `featuredRefresh`（每日 04:00 UTC）：刷新精选 Prompt 列表
  - 每个任务独立 try-catch + Pino 日志记录
  - 可通过环境变量禁用特定任务
  - 主进程启动时注册所有任务
- **验证方式**：test（单独调用每个任务函数）+ 手工（观察日志触发）
- **回滚方案**：注释掉 cron 注册代码
- **依赖关系**：P1.03, P1.19, P1.23
- **风险等级**：中（聚合查询可能影响性能）
- **对应章节**：§8C

---

## 2B — 全端客户端接入（P2.09 - P2.14）⚠️ 已迁移到 Phase9

> **2026-04-08 变更**：P2.09-P2.14 已拆分到独立的 Phase 9（见 `09-PHASE9-CLIENT-MIGRATION.md`）
>
> **拆分原因**：客户端迁移涉及 4 个平台前端改动，风险高、前置条件多（DNS/SSL/Cookie/VPS 部署），
> 与后端服务层开发解耦后可独立排期、独立验收。
>
> **当前状态**：
>
> - P2.09 迁移指南 → 已完成（CLIENT_MIGRATION_GUIDE.md 280 行详细方案）
> - P2.10 Web SPA → 已实现双轨模式（web/app.js），待 VPS 部署后验证
> - P2.11 Browser Extension → 已实现双轨模式（browser/shared/api.js），待 VPS 部署后验证
> - P2.12 VS Code Extension → 在 Phase9 执行
> - P2.13 IntelliJ Plugin → 在 Phase9 执行
> - P2.14 requestId 透传 → Web/Browser 已实现，VS Code/IntelliJ 在 Phase9 执行

### 原任务内容（已迁移，仅供参考）

**以下内容已迁移至 `09-PHASE9-CLIENT-MIGRATION.md`，此处仅保留引用：**

- P2.09 — 全端 AI 调用架构变更文档 → 见 Phase9 P9.00
- P2.10 — Web SPA 客户端迁移 → 见 Phase9 P9.03
- P2.11 — Browser Extension 客户端迁移 → 见 Phase9 P9.04
- P2.12 — VS Code Extension 客户端迁移 → 见 Phase9 P9.05
- P2.13 — IntelliJ Plugin 客户端迁移 → 见 Phase9 P9.06
- P2.14 — 客户端 requestId 透传 → 见 Phase9 P9.07

---

## 2C — 部署（P2.15 - P2.18）

### P2.15 — PM2 Ecosystem 配置

- **目标文件**：
  - `backend/ecosystem.config.js`
- **预期行为**：
  - PM2 进程配置（§9.3）：
    - name: `easy-prompt-api`
    - script: `dist/server.js`
    - instances: 2（cluster mode，利用多核）
    - env_production: `NODE_ENV=production`
    - log_file / error_file 配置
    - max_memory_restart: `500M`
    - graceful shutdown 配置（kill_timeout, listen_timeout）
- **验证方式**：`pm2 start ecosystem.config.js --env production` 手工测试
- **回滚方案**：`pm2 delete easy-prompt-api`
- **依赖关系**：P1.36
- **风险等级**：低
- **对应章节**：§9.3

### P2.16 — Nginx 配置

- **目标文件**：
  - VPS: `/etc/nginx/sites-available/api.zhiz.chat`（新增）
  - VPS: `/etc/nginx/sites-available/zhiz.chat`（修改 — 添加 /auth 路由）
- **预期行为**：
  - `api.zhiz.chat` server block（§9.2）：
    - SSL（Let's Encrypt）
    - `location /` → `proxy_pass http://127.0.0.1:3000`
    - WebSocket 支持（为 SSE 预留）
    - proxy headers: X-Real-IP, X-Forwarded-For, X-Forwarded-Proto, Host
    - 请求体大小限制 10MB
    - gzip 压缩
  - `zhiz.chat` 修改：
    - `location /auth` → 静态页面（SSO 登录页）或 proxy 到后端
    - `location /api` → proxy 到后端
  - `prompt.zhiz.chat` 修改（可选）：
    - `location /api` → proxy 到 api.zhiz.chat
- **验证方式**：`nginx -t` + `curl https://api.zhiz.chat/health/alive`
- **回滚方案**：恢复原 Nginx 配置 + `nginx -s reload`
- **依赖关系**：P2.15, DNS 解析就绪, SSL 证书
- **风险等级**：中（生产环境操作）
- **对应章节**：§9.2

### P2.17 — deploy.sh 集成

- **目标文件**：
  - `deploy/deploy.sh`（修改 — 新增 backend target）
- **预期行为**：
  - 新增 deploy target `backend`（附录 B）：
    - `npm run build` 编译 TypeScript
    - `npx prisma migrate deploy` 执行迁移
    - SCP 上传 `dist/`, `prisma/`, `package.json`, `package-lock.json`, `ecosystem.config.js` 到 VPS
    - SSH 远程执行：`npm ci --production && pm2 reload ecosystem.config.js --env production`
  - `deploy all` 命令中加入 backend 步骤
  - 回滚脚本：`pm2 reload easy-prompt-api --update-env`（指向旧版本）
- **验证方式**：手工（执行一次部署验证完整链路）
- **回滚方案**：git revert deploy.sh 修改
- **依赖关系**：P2.15, P2.16
- **风险等级**：中
- **对应章节**：附录 B

### P2.18 — 生产环境 .env 配置

- **目标文件**：
  - VPS: `/www/wwwroot/api.zhiz.chat/.env`（新增，不入版本控制）
- **预期行为**：
  - 配置全部生产环境变量（附录 A）
  - PostgreSQL 连接串指向本地实例
  - Redis 连接串（如已安装）
  - JWT_SECRET（随机 256-bit）
  - PROVIDER_ENCRYPTION_KEY（随机 256-bit hex）
  - CORS_ORIGINS 白名单
  - LOG_LEVEL=info
- **验证方式**：后端启动无配置错误
- **回滚方案**：修改或删除 .env
- **依赖关系**：P1.02, VPS 基础设施就绪
- **风险等级**：中（凭证安全）
- **对应章节**：附录 A

---

## Phase 2 完成标志（更新后）

> **2026-04-08 更新**：客户端迁移任务已移至 Phase9，此处仅保留后端服务层完成标志

**后端服务层（2A + 2C）— 2026-04-08 VPS 验证全部通过：**

- [x] Analytics API 全部可用（admin 认证后访问）
- [x] 定时任务正常触发（46 条 Cron 日志：rate-decay/cleanup/blacklist-cache-sync）
- [x] `api.zhiz.chat` 生产环境可访问（DNS → 107.151.137.198，HTTPS 200）
- [x] Nginx 配置正确，HTTPS 证书有效（宝塔面板配置，SSL 证书已启用）
- [x] PM2 集群稳定运行（2 实例 cluster mode，~235MB/instance）

**客户端迁移（Phase9）：**

- [ ] Web SPA 可通过后端 API 完成 AI 增强
- [ ] Browser Extension 可通过后端完成 AI 增强 + SSO 登录
- [ ] VS Code 可通过后端完成 AI 增强 + SSO 登录
- [ ] IntelliJ 可通过后端完成 AI 增强 + SSO 登录
- [ ] 各端双轨模式工作正常（后端失败自动回退本地）
