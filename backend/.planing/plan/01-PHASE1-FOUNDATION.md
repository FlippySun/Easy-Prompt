# Phase 1：基础骨架 + AI 代理网关

> 预估工期：2-3 周 | 任务数：36 项
> 里程碑：M1 — 后端可启动、AI 增强接口可用、认证系统可登录
> **实际完成：2026-04-07 基础完成 | 2026-04-08 补全集成测试 + 中间件挂载修复**

---

## Decisions Confirmed

| 决策项      | 结论                   | 备注                                                            |
| ----------- | ---------------------- | --------------------------------------------------------------- |
| Web 框架    | **Express 5**          | 确认不用 Fastify，与现有中间件生态匹配                          |
| 密码哈希    | **bcrypt** (rounds=12) | 确认不用 argon2                                                 |
| Redis       | **首期即接入**         | 限流/黑名单/SSO code 均用 Redis，不用内存 Map 降级              |
| SSO         | **code exchange 保留** | P1.17 保留 SSO 授权码交换流程，跳过第三方 OAuth (Google/GitHub) |
| 加密算法    | **AES-256-CBC**        | 原计划 GCM，实际采用 CBC（与客户端加密一致）                    |
| AI 适配器   | **单文件统一适配**     | 原计划 4 个文件，实际合并为 `openai.adapter.ts` 内 switch 分支  |
| Prisma 连接 | **SSH tunnel 连 VPS**  | Docker 端口绑定 127.0.0.1，无法直连，通过 SSH tunnel 转发       |
| 测试策略    | **串行执行**           | 集成测试共享 DB，fileParallelism=false                          |

### 实际交付与计划偏差

| 计划                         | 实际                                              |
| ---------------------------- | ------------------------------------------------- |
| `middleware/` 目录名         | `middlewares/`                                    |
| `routes/auth.routes.ts` 后缀 | `routes/auth.ts`（无 .routes 后缀）               |
| 独立 `validators/` 目录      | Zod schema 内联在路由文件中                       |
| `routes/index.ts` 汇总       | 路由直接在 `app.ts` 中注册                        |
| `utils/encryption.ts`        | `utils/crypto.ts`                                 |
| 4 个适配器文件               | 单文件 `adapters/openai.adapter.ts`               |
| P1.05 种子数据脚本           | 延后到 Phase 2                                    |
| P1.28 独立日志 Service       | 合并到 `ai-gateway.service.ts` 内                 |
| P1.31 Provider 配置文件类型  | 合并到 `types/ai.ts`                              |
| P1.34 Scenes Routes          | 2026-04-08 由用户手动创建，新增 Scene Prisma 模型 |

### 验证结果

- `tsc --noEmit` → **0 errors** ✅
- `vitest run` → **55/55 passed** (20 单元 + 35 集成) ✅
- Dev server + /health + /health/ready ✅

---

## 1A — 项目初始化（P1.01 - P1.02）

### P1.01 — 项目脚手架初始化

- **目标文件**：
  - `backend/package.json`
  - `backend/tsconfig.json`
  - `backend/.eslintrc.json`（或 `eslint.config.mjs`）
  - `backend/.prettierrc`
  - `backend/.gitignore`
  - `backend/nodemon.json`
  - `backend/vitest.config.ts`
- **预期行为**：
  - `npm install` 安装全部依赖（express@5, prisma, @prisma/client, jsonwebtoken, bcrypt, zod, pino, pino-pretty, ioredis, helmet, cors, cookie-parser, dotenv）
  - ✅ **已完成** — 确认使用 Express 5 + bcrypt，不用 Fastify/argon2/node-cron/uuid
  - `npm run build` 成功编译 TypeScript → `dist/`
  - `npm run lint` 通过 ESLint 检查
  - `npm run dev` 可启动开发服务器（空壳）
  - 脚本命令：`dev`, `build`, `start`, `lint`, `test`, `test:coverage`, `db:migrate`, `db:seed`, `db:studio`
- **验证方式**：build + lint
- **回滚方案**：删除 `backend/` 中新增文件，仅保留 ARCHITECTURE.md
- **依赖关系**：无（首个任务）
- **风险等级**：低
- **对应章节**：§2.2, §3

### P1.02 — 环境变量与配置模块

- **目标文件**：
  - `backend/.env.example`
  - `backend/src/config/index.ts`
  - `backend/src/config/constants.ts`
- **预期行为**：
  - `.env.example` 包含全部变量（对应 ARCHITECTURE.md 附录 A）：
    - `NODE_ENV`, `PORT`, `HOST`
    - `DATABASE_URL` (PostgreSQL 连接串)
    - `REDIS_URL`
    - `JWT_SECRET`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`
    - `CORS_ORIGINS`（白名单：zhiz.chat, prompt.zhiz.chat, chrome-extension://\*）
    - `COOKIE_DOMAIN`（`.zhiz.chat`）
    - `LOG_LEVEL`
    - `PROVIDER_ENCRYPTION_KEY`
    - `RATE_LIMIT_*`（窗口、最大请求等）
    - `ADMIN_EMAILS`
  - `config/index.ts` 用 Zod 验证并导出类型安全的配置对象
  - 缺失必填变量时启动报错并列出具体字段
  - `constants.ts` 导出 BAN_LADDER, ERROR_CODES, 分页默认值等
- **验证方式**：test（单元测试验证 Zod schema 校验逻辑）
- **回滚方案**：删除新增文件
- **依赖关系**：P1.01
- **风险等级**：低
- **对应章节**：§2.2, 附录 A

---

## 1B — 数据库层（P1.03 - P1.05）

### P1.03 — Prisma Schema 定义

- **目标文件**：
  - `backend/prisma/schema.prisma`
- **预期行为**：
  - 定义全部数据模型（严格对应 §4 DDL）：
    - `User`（id uuid PK, email unique, username unique, display_name, avatar_url, bio, role enum(user/admin/super_admin), password_hash, refresh_token_hash, provider, provider_id, last_login_at, created_at, updated_at）
    - `Prompt`（id uuid PK, title, description, content, category, model_compatibility jsonb, tags text[], author_id FK→User, status enum(draft/pending/published/rejected), view_count, like_count, save_count, copy_count, is_featured, featured_at, search_vector, created_at, updated_at）
    - `Collection`（id uuid PK, name, description, cover_image_url, author_id FK→User, is_public, prompt_count, created_at, updated_at）
    - `CollectionPrompt`（collection_id + prompt_id 联合 PK, sort_order, added_at）
    - `UserLike`（user_id + prompt_id 联合 PK + unique, created_at）
    - `UserSave`（user_id + prompt_id 联合 PK + unique, created_at）
    - `UserCollectionSave`（user_id + collection_id 联合 PK + unique, created_at）
    - `UserCopy`（id uuid PK, user_id FK, prompt_id FK, created_at）— 允许多次复制
    - `UserView`（id uuid PK, user_id FK nullable, prompt_id FK, fingerprint, ip_address, created_at）
    - `Achievement`（id text PK, name, description, icon, category, condition jsonb, points, created_at）
    - `UserAchievement`（user_id + achievement_id 联合 PK, unlocked_at）
    - `UserVisitedCategory`（user_id + category 联合 PK, visit_count, last_visited_at）
    - `Category`（id text PK, name jsonb, description jsonb, icon, sort_order, prompt_count, is_active）
    - `Model`（id text PK, name, provider, description, capabilities jsonb, is_active, sort_order）
    - `AiProvider`（id uuid PK, name unique, display_name, api_base, api_key_encrypted, supported_modes jsonb, models jsonb, is_active, priority, health_status jsonb, created_by FK→User, created_at, updated_at）+ unique partial index on (is_active=true, priority)
    - `AiRequestLog`（id uuid PK, user_id FK nullable, client_type, scene, model, provider, input_tokens, output_tokens, total_tokens, cost_usd, latency_ms, status, error_code, error_message, ip_address, country, region, fingerprint, user_agent, request_id, created_at）+ 8 个索引
    - `DailyStats`（id serial PK, date + stat_type + dimension unique, date, stat_type, dimension, value jsonb, created_at）
    - `BlacklistRule`（id uuid PK, rule_type enum, value, reason, severity enum(warning/temporary/permanent), expires_at, auto_generated, violation_count, metadata jsonb, is_active, created_by FK→User nullable, created_at, updated_at）+ 3 个索引
    - `RateViolation`（id uuid PK, identifier_type, identifier_value, endpoint, violation_type, request_count, window_seconds, metadata jsonb, created_at）+ 2 个索引
  - 启用 `pg_trgm` 扩展（trigram 模糊搜索）
  - `npx prisma validate` 通过
- **验证方式**：`npx prisma validate` + `npx prisma format`
- **回滚方案**：删除 `schema.prisma`
- **依赖关系**：P1.01
- **风险等级**：中（schema 设计错误影响全局）
- **对应章节**：§4

### P1.04 — 数据库迁移

- **目标文件**：
  - `backend/prisma/migrations/YYYYMMDD_init/migration.sql`（自动生成）
- **预期行为**：
  - `npx prisma migrate dev --name init` 成功执行
  - PostgreSQL 中创建全部表、索引、约束
  - 可通过 `npx prisma studio` 浏览空数据库
- **验证方式**：`npx prisma migrate status` + `npx prisma studio` 手工确认
- **回滚方案**：`npx prisma migrate reset`（开发阶段允许全量回滚）
- **依赖关系**：P1.03 + PostgreSQL 实例就绪
- **风险等级**：中
- **对应章节**：§4

### P1.05 — 种子数据脚本

- **目标文件**：
  - `backend/prisma/seed.ts`
  - `backend/prisma/data/categories.json`
  - `backend/prisma/data/models.json`
  - `backend/prisma/data/achievements.json`
  - `backend/prisma/data/prompts.json`
  - `backend/prisma/data/collections.json`
- **预期行为**：
  - 从 web-hub 静态数据导入（§11 数据迁移）：
    1. `CATEGORY_CONFIG` → categories 表（附 name/description i18n jsonb）
    2. `MODEL_CONFIG` → models 表
    3. `ACHIEVEMENTS` → achievements 表
    4. `MOCK_PROMPTS` → prompts 表（status=published, author=admin）
    5. `COLLECTIONS` → collections 表 + collection_prompts 关联
    6. 创建初始 admin 用户
    7. 创建默认 AI Provider（VPS AI Robot，api_key 加密存储）
  - ID 映射策略：前端 mock 的 string id → 数据库 uuid，生成 `id-mapping.json` 供前端迁移参考
  - `npx prisma db seed` 可重复执行（upsert 语义）
- **验证方式**：`npx prisma db seed` + `npx prisma studio` 手工检查数据
- **回滚方案**：`npx prisma migrate reset` 回到空库
- **依赖关系**：P1.04 + 确认事项 #8, #9
- **风险等级**：中（mock 数据字段映射可能不完全匹配）
- **对应章节**：§11

---

## 1C — 共享类型与错误系统（P1.06 - P1.09）

### P1.06 — 共享类型定义

- **目标文件**：
  - `backend/src/types/index.ts`
  - `backend/src/types/prompt.ts`
  - `backend/src/types/collection.ts`
  - `backend/src/types/user.ts`
  - `backend/src/types/achievement.ts`
  - `backend/src/types/ai.ts`
  - `backend/src/types/analytics.ts`
  - `backend/src/types/blacklist.ts`
  - `backend/src/types/meta.ts`
- **预期行为**：
  - 定义 §12 全部 TypeScript 接口：
    - `Prompt`, `PromptSummary`, `PromptDetail`
    - `Collection`, `CollectionDetail`
    - `Achievement`, `UserAchievementStatus`
    - `User`, `UserProfile`, `UserPublicProfile`
    - `CategoryMeta`, `ModelMeta`
    - `PaginatedResponse<T>`
    - `EnhanceRequest`, `EnhanceResponse`
    - `ProviderInfo`, `ProviderConfig`
    - `AnalyticsSummary`, `DailyAnalytics`
    - `BlacklistRule`, `RateViolation`
    - `ApiErrorResponse`
    - `BAN_LADDER` 常量
  - 所有类型均从 `types/index.ts` re-export
  - 后续可提取为独立 `@easy-prompt/types` 包供前端复用
- **验证方式**：build（TypeScript 编译通过）
- **回滚方案**：删除 `types/` 目录
- **依赖关系**：P1.01
- **风险等级**：低
- **对应章节**：§12

### P1.07 — 错误码注册表

- **目标文件**：
  - `backend/src/utils/errors.ts`
- **预期行为**：
  - 定义 `AppError` 类（extends Error）：
    - 属性：`code: string`, `statusCode: number`, `message: string`, `details?: Record<string,any>`
    - 静态工厂方法：`AppError.fromCode(code, overrides?)` 从注册表构建
  - 定义全部错误码常量（§5.2）：
    - AUTH 类（10 项）：`AUTH_TOKEN_EXPIRED`, `AUTH_TOKEN_INVALID`, `AUTH_REFRESH_EXPIRED`, `AUTH_UNAUTHORIZED`, `AUTH_LOGIN_FAILED`, `AUTH_EMAIL_EXISTS`, `AUTH_USERNAME_EXISTS`, `AUTH_CODE_INVALID`, `AUTH_CODE_EXPIRED`, `AUTH_PROVIDER_ERROR`
    - VALIDATION 类（5 项）：`VALIDATION_FAILED`, `VALIDATION_INPUT_TOO_LONG`, `VALIDATION_INPUT_INVALID`, `VALIDATION_MISSING_FIELD`, `VALIDATION_FORMAT_ERROR`
    - RATE 类（4 项）：`RATE_LIMIT_EXCEEDED`, `RATE_AI_LIMIT_EXCEEDED`, `RATE_LOGIN_LIMIT_EXCEEDED`, `RATE_SEARCH_LIMIT_EXCEEDED`
    - BLACKLIST 类（3 项）：`BLACKLIST_IP_BLOCKED`, `BLACKLIST_USER_BLOCKED`, `BLACKLIST_FINGERPRINT_BLOCKED`
    - AI 类（6 项）：`AI_PROVIDER_ERROR`, `AI_MODEL_UNAVAILABLE`, `AI_TIMEOUT`, `AI_RATE_LIMITED`, `AI_CONTENT_FILTERED`, `AI_INVALID_RESPONSE`
    - PROVIDER 类（4 项）：`PROVIDER_NOT_FOUND`, `PROVIDER_INACTIVE`, `PROVIDER_CONFIG_ERROR`, `PROVIDER_LIMIT_REACHED`
    - RESOURCE 类（3 项）：`RESOURCE_NOT_FOUND`, `RESOURCE_ALREADY_EXISTS`, `RESOURCE_CONFLICT`
    - PERMISSION 类（3 项）：`PERMISSION_DENIED`, `PERMISSION_ADMIN_REQUIRED`, `PERMISSION_OWNER_REQUIRED`
    - SYSTEM 类（3 项）：`SYSTEM_INTERNAL_ERROR`, `SYSTEM_MAINTENANCE`, `SYSTEM_DEPENDENCY_FAILED`
  - 每个错误码含 `httpStatus`, `defaultMessage` 映射
- **验证方式**：test（遍历所有错误码，断言 httpStatus 在有效范围内）
- **回滚方案**：删除文件
- **依赖关系**：P1.06
- **风险等级**：低
- **对应章节**：§5.2

### P1.08 — 全局错误处理中间件

- **目标文件**：
  - `backend/src/middleware/errorHandler.ts`
- **预期行为**：
  - 捕获全部未处理错误
  - `AppError` → 结构化 JSON 响应（`{ success: false, error: { code, message, details? } }`）
  - Zod `ZodError` → 400 + `VALIDATION_FAILED` + 字段级 details
  - Prisma `PrismaClientKnownRequestError` → 映射（P2002→冲突, P2025→未找到）
  - 未知错误 → 500 + `SYSTEM_INTERNAL_ERROR`（生产环境隐藏堆栈）
  - 所有错误响应记录 Pino 日志（包含 requestId）
  - 开发环境响应含 `stack` 字段
- **验证方式**：test（模拟各类错误，断言响应格式与状态码）
- **回滚方案**：删除文件
- **依赖关系**：P1.07
- **风险等级**：低
- **对应章节**：§5.2

### P1.09 — Zod 验证中间件

- **目标文件**：
  - `backend/src/middleware/validate.ts`
- **预期行为**：
  - `validate(schema)` 工厂函数返回 Express 中间件
  - 分别验证 `req.body`, `req.query`, `req.params`
  - 验证失败抛出 `AppError`（`VALIDATION_FAILED`）
  - 验证通过后将 parsed 数据赋值回 req（类型安全）
- **验证方式**：test（各验证场景）
- **回滚方案**：删除文件
- **依赖关系**：P1.07
- **风险等级**：低
- **对应章节**：§2.2, §5.2

---

## 1D — 日志系统（P1.10 - P1.11）

### P1.10 — Pino 日志初始化

- **目标文件**：
  - `backend/src/utils/logger.ts`
- **预期行为**：
  - 创建 Pino 实例，配置：
    - `level` 从环境变量读取（默认 info）
    - 开发环境使用 `pino-pretty` transport
    - 生产环境输出 JSON 到 stdout
    - 自定义序列化器：redact 敏感字段（password, token, apiKey, authorization）
    - 子 logger 工厂：`createChildLogger(module)` 自动添加 `module` 字段
  - 日志格式（§8B.1）：`{ level, time, requestId, module, msg, ...data }`
- **验证方式**：手工（启动应用看日志输出格式）
- **回滚方案**：删除文件
- **依赖关系**：P1.01
- **风险等级**：低
- **对应章节**：§8B.1

### P1.11 — 请求日志中间件

- **目标文件**：
  - `backend/src/middleware/requestLogger.ts`
- **预期行为**：
  - 为每个请求生成 `requestId`（UUID v4）
  - 注入 `req.requestId`，设置响应头 `X-Request-Id`
  - 请求开始记录：`{ method, url, ip, userAgent, requestId }`
  - 请求结束记录：`{ method, url, statusCode, responseTime, requestId }`
  - 跳过健康检查端点（`/health/*`）避免日志噪音
  - 客户端传入 `X-Request-Id` 时沿用（§8B.6 全链路追踪）
- **验证方式**：test + curl 手工验证日志输出
- **回滚方案**：删除文件
- **依赖关系**：P1.10
- **风险等级**：低
- **对应章节**：§8B.2, §8B.6

---

## 1E — 认证系统（P1.12 - P1.18）

### P1.12 — JWT 工具模块

- **目标文件**：
  - `backend/src/utils/jwt.ts`
- **预期行为**：
  - `signAccessToken(payload)` → 15 分钟有效期的 JWT
  - `signRefreshToken(payload)` → 7 天有效期的 JWT
  - `verifyAccessToken(token)` → decoded payload 或抛 `AUTH_TOKEN_INVALID` / `AUTH_TOKEN_EXPIRED`
  - `verifyRefreshToken(token)` → decoded payload 或抛 `AUTH_REFRESH_EXPIRED`
  - payload 结构：`{ userId, email, role }`
  - 使用 `config.JWT_SECRET`
- **验证方式**：test（生成 + 验证 + 过期 + 篡改场景）
- **回滚方案**：删除文件
- **依赖关系**：P1.02
- **风险等级**：中（安全关键）
- **对应章节**：§6.1

### P1.13 — 密码工具模块

- **目标文件**：
  - `backend/src/utils/password.ts`
- **预期行为**：
  - `hashPassword(plain)` → hashed string
  - `verifyPassword(plain, hash)` → boolean
  - bcrypt rounds = 12（✅ 已确认使用 bcrypt，不用 argon2）
- **验证方式**：test ✅
- **回滚方案**：删除文件
- **依赖关系**：P1.01
- **风险等级**：低
- **对应章节**：§6.1

### P1.14 — Auth 中间件（authenticate + authorize）

- **目标文件**：
  - `backend/src/middleware/auth.ts`
- **预期行为**：
  - `authenticate`：从 `Authorization: Bearer <token>` 或 cookie `access_token` 提取 JWT → 解析到 `req.user`
    - 无 token → `AUTH_UNAUTHORIZED`
    - 无效/过期 → 对应错误码
  - `optionalAuth`：同上但无 token 时不报错，`req.user = null`
  - `authorize(...roles)`：检查 `req.user.role` 是否在允许列表中
    - 不在 → `PERMISSION_DENIED` 或 `PERMISSION_ADMIN_REQUIRED`
- **验证方式**：test（覆盖有效/无效/过期/无 token/权限不足等场景）
- **回滚方案**：删除文件
- **依赖关系**：P1.12
- **风险等级**：高（认证是安全核心）
- **对应章节**：§6.1, §6.2

### P1.15 — Auth Service

- **目标文件**：
  - `backend/src/services/auth.service.ts`
- **预期行为**：
  - `register(email, username, password)` → 创建用户 + 返回 token pair
    - 检查邮箱/用户名唯一 → `AUTH_EMAIL_EXISTS` / `AUTH_USERNAME_EXISTS`
    - 密码强度校验（≥8位, 含大小写+数字）
  - `login(email, password)` → 验证凭证 + 返回 token pair + 更新 last_login_at
    - 失败 → `AUTH_LOGIN_FAILED`
    - 集成限流检查
  - `refresh(refreshToken)` → 验证 refresh token hash → 签发新 token pair + 轮转 refresh token
    - Refresh Token Rotation（§6.1）：每次刷新都更新 DB 中的 hash
    - 旧 token 即时失效
  - `exchange(code)` → 验证一次性授权码 → 返回 token pair（§6.2 SSO code exchange）
    - 授权码 5 分钟有效、一次性使用
    - 存储在 Redis（✅ 首期即接入 Redis，不用内存 Map）
  - `me(userId)` → 返回用户信息（不含密码 hash）
  - `logout(userId)` → 清除 refresh_token_hash
- **验证方式**：test（全路径覆盖，含边界场景）
- **回滚方案**：删除文件
- **依赖关系**：P1.12, P1.13, P1.03
- **风险等级**：高
- **对应章节**：§5.3 Auth, §6.1, §6.2

### P1.16 — Auth Routes

- **目标文件**：
  - `backend/src/routes/auth.routes.ts`
  - `backend/src/validators/auth.validators.ts`
- **预期行为**：
  - 路由注册（§5.3）：
    - `POST /api/v1/auth/register` → Zod 校验 → authService.register
    - `POST /api/v1/auth/login` → Zod 校验 → authService.login + 设置 cookie
    - `POST /api/v1/auth/refresh` → authService.refresh + 设置 cookie
    - `POST /api/v1/auth/exchange` → authService.exchange（SSO code exchange）
    - `GET  /api/v1/auth/me` → authenticate → authService.me
    - `POST /api/v1/auth/logout` → authenticate → authService.logout + 清除 cookie
  - Cookie 配置（§6.3.2）：
    - `access_token`: httpOnly, secure, sameSite=Lax, domain=.zhiz.chat, path=/, maxAge=15min
    - `refresh_token`: httpOnly, secure, sameSite=Strict, domain=.zhiz.chat, path=/api/v1/auth/refresh, maxAge=7d
  - 所有响应格式统一：`{ success: true, data: { ... } }`
- **验证方式**：test（Supertest 集成测试 + curl 手工测试 cookie 设置）
- **回滚方案**：删除文件
- **依赖关系**：P1.15, P1.09, P1.08
- **风险等级**：高
- **对应章节**：§5.3, §6.2, §6.3.2

### P1.17 — SSO 登录页后端支持

> ✅ **决策**：SSO code exchange 流程保留，跳过第三方 OAuth（Google/GitHub 等）
> 实际实现：`POST /api/v1/auth/sso/authorize` + `POST /api/v1/auth/sso/token` 在 `routes/auth.ts` 中，无独立 sso.service.ts

- **目标文件**：
  - `backend/src/services/sso.service.ts` → 实际合并到 `auth.service.ts` 中
  - `backend/src/routes/sso.routes.ts` → 实际合并到 `routes/auth.ts` 中
- **预期行为**：
  - SSO 授权码交换流程（§6.2）：
    - `POST /api/v1/auth/sso/authorize` → 已认证用户生成一次性 code
    - `POST /api/v1/auth/sso/token` → 验证 code → 返回 token pair
  - redirect_uri 白名单验证（§6.3.1）：
    - 允许：`zhiz.chat/*`, `prompt.zhiz.chat/*`, `chrome-extension://*`, `vscode://*`
    - state 参数透传（防 CSRF）
    - 授权码 5min 过期 + 一次性使用，存储在 Redis
  - 并发登录处理：新登录使旧 refresh token 失效
  - **跳过第三方 OAuth**：Google/GitHub 等第三方登录不在首期范围，后续 Phase 补充
- **验证方式**：test + 手工（模拟各平台登录流程）
- **回滚方案**：删除文件
- **依赖关系**：P1.15
- **风险等级**：高（SSO 安全关键）
- **对应章节**：§6.2, §6.3.1

### P1.18 — CORS + Cookie 安全配置

- **目标文件**：
  - `backend/src/middleware/cors.ts`（或在 `app.ts` 中配置）
- **预期行为**：
  - CORS 白名单（§6.3.2 + §8）：
    - `https://zhiz.chat`
    - `https://prompt.zhiz.chat`
    - `chrome-extension://*`（动态匹配）
    - 开发环境允许 `localhost:*`
  - `credentials: true`（允许 cookie 跨域携带）
  - Helmet 安全头：CSP, X-Frame-Options, X-Content-Type-Options 等
  - cookie-parser 配置 `signed: true`
- **验证方式**：curl（模拟不同 Origin 请求验证 CORS）+ test
- **回滚方案**：修改配置
- **依赖关系**：P1.02
- **风险等级**：中
- **对应章节**：§6.3.2, §8

---

## 1F — 安全模块：黑名单 + 限流（P1.19 - P1.24）

### P1.19 — 黑名单 Service

- **目标文件**：
  - `backend/src/services/blacklist.service.ts`
- **预期行为**：
  - `check(ip, fingerprint?, userId?)` → 返回 `{ blocked: boolean, rule?: BlacklistRule }`
    - 查询优先级：IP → fingerprint → userId
    - 缓存命中直接返回（Redis）
    - 检查 `expires_at`（null = 永久，过期 = 不匹配）
  - `create(rule)` → 创建黑名单规则
  - `update(id, updates)` → 更新规则
  - `deactivate(id)` / `activate(id)` → 切换 is_active
  - `delete(id)` → 物理删除
  - `stats()` → 返回活跃规则统计（by type, by severity）
  - `autoBlock(type, value, reason, severity, expiresAt)` → 自动生成的黑名单（auto_generated=true）
  - 缓存策略：活跃黑名单规则缓存在 Redis Set（key: `blacklist:{type}`）
- **验证方式**：test
- **回滚方案**：删除文件
- **依赖关系**：P1.03
- **风险等级**：中
- **对应章节**：§5.3 Blacklist

### P1.20 — 黑名单中间件

- **目标文件**：
  - `backend/src/middleware/blacklist.ts`
- **预期行为**：
  - 全局中间件（或针对特定路由）
  - 从 `req` 提取 IP（X-Forwarded-For / X-Real-IP / req.ip）、fingerprint（请求头 X-Fingerprint）、userId（如已认证）
  - 调用 `blacklistService.check()` → 命中则返回 403 + `BLACKLIST_*_BLOCKED`
  - 被封禁响应包含 `retry_after`（对 temporary 类型）
- **验证方式**：test
- **回滚方案**：删除文件，从中间件链移除
- **依赖关系**：P1.19
- **风险等级**：中
- **对应章节**：§5.3 Blacklist

### P1.21 — 黑名单 Routes

- **目标文件**：
  - `backend/src/routes/blacklist.routes.ts`
  - `backend/src/validators/blacklist.validators.ts`
- **预期行为**：
  - 管理端点（需 admin 权限）：
    - `GET    /api/v1/blacklist` → 列表（分页、筛选 type/severity/is_active）
    - `POST   /api/v1/blacklist` → 创建规则
    - `PUT    /api/v1/blacklist/:id` → 更新规则
    - `DELETE /api/v1/blacklist/:id` → 删除规则
    - `POST   /api/v1/blacklist/:id/deactivate` → 停用
    - `POST   /api/v1/blacklist/:id/activate` → 启用
    - `GET    /api/v1/blacklist/check` → 手动检查（query: ip/fingerprint/userId）
    - `GET    /api/v1/blacklist/stats` → 统计
- **验证方式**：test（Supertest）
- **回滚方案**：删除文件
- **依赖关系**：P1.19, P1.14
- **风险等级**：中
- **对应章节**：§5.3 Blacklist

### P1.22 — 指纹中间件

- **目标文件**：
  - `backend/src/middleware/fingerprint.ts`
- **预期行为**：
  - 从请求头 `X-Fingerprint` 提取客户端指纹
  - 若无则根据 User-Agent + IP + Accept-Language 生成服务端指纹（SHA-256 hash）
  - 注入 `req.fingerprint`
  - 用于限流和黑名单的多维度标识
- **验证方式**：test
- **回滚方案**：删除文件
- **依赖关系**：P1.01
- **风险等级**：低
- **对应章节**：§8

### P1.23 — 渐进式限流 Service

- **目标文件**：
  - `backend/src/services/rateLimit.service.ts`
- **预期行为**：
  - 渐进式 Fail2Ban 限流（§5.3 Rate Limiting）：
    - 多维度滑动窗口：per-IP, per-user, per-fingerprint
    - 阈值可配置（从 config）：
      - 全局 API：100 req/min per IP
      - AI 增强：20 req/min per user
      - 登录：5 req/min per IP
      - 搜索：30 req/min per IP
    - 超限触发 `BAN_LADDER`（§12）：
      - Tier 1: 警告（`warning`）→ 记录 RateViolation
      - Tier 2: 临时封禁 5 分钟
      - Tier 3: 临时封禁 30 分钟
      - Tier 4: 临时封禁 24 小时
      - Tier 5: 永久封禁
    - 违规计数存储在 Redis（✅ 首期即接入 Redis）
    - 自动创建 BlacklistRule（auto_generated=true）
  - `checkRateLimit(identifier, endpoint)` → `{ allowed: boolean, remaining: number, resetAt: Date, tier?: number }`
  - `recordViolation(identifierType, identifierValue, endpoint)` → 记录并自动升级
- **验证方式**：test（模拟连续请求验证阈值和升级逻辑）
- **回滚方案**：删除文件
- **依赖关系**：P1.19, P1.02
- **风险等级**：高（误封影响正常用户）
- **对应章节**：§5.3 Rate Limiting, §12 BAN_LADDER

### P1.24 — 限流中间件

- **目标文件**：
  - `backend/src/middleware/rateLimit.ts`
- **预期行为**：
  - `rateLimit(endpoint)` 工厂函数 → 中间件
  - 从 req 提取 IP/userId/fingerprint → 调用 rateLimitService.checkRateLimit
  - 超限 → 429 + `RATE_*_EXCEEDED` + 响应头 `Retry-After`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
  - 通过 → 设置响应头 `X-RateLimit-*`
- **验证方式**：test + curl
- **回滚方案**：删除文件
- **依赖关系**：P1.23
- **风险等级**：中
- **对应章节**：§5.3 Rate Limiting

---

## 1G — AI 网关（P1.25 - P1.32）

### P1.25 — Provider 加密工具

- **目标文件**：
  - `backend/src/utils/encryption.ts`
- **预期行为**：
  - `encrypt(plaintext)` → AES-256-CBC 加密（使用 PROVIDER_ENCRYPTION_KEY，与客户端加密算法一致）
  - `decrypt(ciphertext)` → 解密
  - 用于 AI Provider API Key 的安全存储
- **验证方式**：test（加密→解密一致性 + 篡改检测）
- **回滚方案**：删除文件
- **依赖关系**：P1.02
- **风险等级**：中（安全关键）
- **对应章节**：§5.3 Provider

### P1.26 — AI Gateway Service

- **目标文件**：
  - `backend/src/services/ai.service.ts`
- **预期行为**：
  - `enhance(request: EnhanceRequest)` → `EnhanceResponse`
    - 接收统一请求格式（§5.3 AI Gateway）：`{ text, scene?, model?, options? }`
    - 选择活跃 Provider（按 priority 排序 + 健康检查）
    - 解密 Provider API Key
    - 根据 Provider 类型构建上游请求（支持 4 种 API 模式：openai, openai-responses, claude, gemini）
    - 调用上游 AI API + 超时控制（30s）
    - 记录 AiRequestLog（异步，不阻塞响应）
    - 返回统一响应：`{ result, model, provider, usage: { inputTokens, outputTokens, totalTokens } }`
  - `testProvider(providerId)` → 发送测试请求验证 Provider 可用性
  - `listModels()` → 返回所有活跃 Provider 支持的模型列表
  - 错误处理：上游失败 → 自动 fallback 到下一个 Provider → 全部失败 → `AI_PROVIDER_ERROR`
  - 上游响应转换：统一不同 API 模式的响应格式
- **验证方式**：test（mock 上游 API）+ 手工测试实际 Provider
- **回滚方案**：删除文件
- **依赖关系**：P1.25, P1.03, P1.10
- **风险等级**：高（核心业务逻辑）
- **对应章节**：§5.3 AI Gateway

### P1.27 — AI Gateway Routes

- **目标文件**：
  - `backend/src/routes/ai.routes.ts`
  - `backend/src/validators/ai.validators.ts`
- **预期行为**：
  - 端点（§5.3）：
    - `POST /api/v1/ai/enhance` → optionalAuth + rateLimit('ai') + validate → aiService.enhance
    - `GET  /api/v1/ai/models` → 返回可用模型列表
    - `POST /api/v1/ai/test` → admin + validate → aiService.testProvider
  - 请求体 Zod 校验：
    - `text`: string, min(2), max(10000)
    - `scene`: optional string
    - `model`: optional string
    - `options`: optional object
  - 响应头：`X-Provider`, `X-Model`, `X-Latency-Ms`
- **验证方式**：test（Supertest）+ curl
- **回滚方案**：删除文件
- **依赖关系**：P1.26, P1.24
- **风险等级**：高
- **对应章节**：§5.3 AI Gateway

### P1.28 — AI 请求日志 Service

- **目标文件**：
  - `backend/src/services/aiLog.service.ts`
- **预期行为**：
  - `logRequest(data: AiRequestLogInput)` → 异步写入 ai_request_logs 表
    - 字段（§4.2 + §8B.3）：user_id, client_type, scene, model, provider, input_tokens, output_tokens, total_tokens, cost_usd, latency_ms, status(success/error), error_code, error_message, ip_address, country, region, fingerprint, user_agent, request_id
  - 使用 Pino child logger（module: 'ai-enhance'）记录结构化日志（§8B.3）
  - 批量写入优化（可选）：先缓冲再批量 insert
- **验证方式**：test
- **回滚方案**：删除文件
- **依赖关系**：P1.03, P1.10
- **风险等级**：中
- **对应章节**：§8B.3

### P1.29 — Provider Service

- **目标文件**：
  - `backend/src/services/provider.service.ts`
- **预期行为**：
  - `list()` → 返回所有 Provider（不含加密 key）
  - `create(data)` → 创建 Provider（加密 API Key）
  - `update(id, data)` → 更新（若含 key 则重新加密）
  - `delete(id)` → 物理删除
  - `activate(id)` / `deactivate(id)` → 切换 is_active
  - `test(id)` → 发送测试请求验证连接
  - `getActive()` → 返回活跃 Provider 列表（按 priority 排序）
  - `updateHealth(id, status)` → 更新 health_status jsonb
  - unique partial index 约束：同一 priority 只能有一个 active Provider
- **验证方式**：test
- **回滚方案**：删除文件
- **依赖关系**：P1.25, P1.03
- **风险等级**：中
- **对应章节**：§5.3 Provider

### P1.30 — Provider Routes

- **目标文件**：
  - `backend/src/routes/provider.routes.ts`
  - `backend/src/validators/provider.validators.ts`
- **预期行为**：
  - 管理端点（需 admin）：
    - `GET    /api/v1/providers` → list
    - `POST   /api/v1/providers` → create
    - `PUT    /api/v1/providers/:id` → update
    - `DELETE /api/v1/providers/:id` → delete
    - `POST   /api/v1/providers/:id/activate` → activate
    - `POST   /api/v1/providers/:id/test` → test
  - 公开端点：
    - `GET    /api/v1/providers/active` → 返回当前活跃 Provider 信息（脱敏）
- **验证方式**：test（Supertest）
- **回滚方案**：删除文件
- **依赖关系**：P1.29, P1.14
- **风险等级**：中
- **对应章节**：§5.3 Provider, 附录 C

### P1.31 — Provider 配置文件格式

- **目标文件**：
  - `backend/src/types/provider-config.ts`（类型定义）
- **预期行为**：
  - 定义 Provider 配置文件格式（附录 C）：
    ```typescript
    interface ProviderConfigFile {
      name: string;
      display_name: string;
      api_base: string;
      supported_modes: string[];
      models: { id: string; name: string }[];
      priority: number;
    }
    ```
  - 种子脚本可从 JSON 文件读取此格式
- **验证方式**：build
- **回滚方案**：删除文件
- **依赖关系**：P1.06
- **风险等级**：低
- **对应章节**：附录 C

### P1.32 — 上游 API 适配器

> ✅ **实际实现**：合并为单文件 `openai.adapter.ts`，内部按 apiMode switch 分支

- **目标文件**：
  - `backend/src/services/adapters/openai.adapter.ts`（单文件包含全部 4 种模式）
  - ~~`openai-responses.adapter.ts` / `claude.adapter.ts` / `gemini.adapter.ts` / `index.ts`~~ → 已合并
- **预期行为**：
  - `callAiProvider(params)` 统一入口，根据 `apiMode` 分发：
  - OpenAI: POST `{base}/chat/completions`, `Authorization: Bearer`
  - OpenAI-Responses: POST `{base}/responses`, `Authorization: Bearer`
  - Claude: POST `{base}/messages`, `x-api-key` + `anthropic-version`
  - Gemini: POST `{base}/models/{model}:generateContent?key={apiKey}`
  - 统一响应解析（提取 text, tokens）
  - 超时控制（30s）
  - 错误分类（网络/认证/限流/内容过滤/其他）
- **验证方式**：test（mock HTTP + 实际 API 手工测试）
- **回滚方案**：删除文件
- **依赖关系**：P1.06
- **风险等级**：高（4 种 API 协议差异大）
- **对应章节**：§5.3 AI Gateway, §7.0

---

## 1H — 元数据与健康检查（P1.33 - P1.35）

### P1.33 — Meta Routes（Categories + Models）

- **目标文件**：
  - `backend/src/routes/meta.routes.ts`
  - `backend/src/services/meta.service.ts`
- **预期行为**：
  - 公开端点：
    - `GET /api/v1/meta/categories` → 返回所有活跃分类（带 i18n）
    - `GET /api/v1/meta/models` → 返回所有活跃模型
  - 管理端点（admin）：
    - `POST   /api/v1/meta/categories` → 创建分类
    - `PUT    /api/v1/meta/categories/:id` → 更新
    - `POST   /api/v1/meta/models` → 创建模型
    - `PUT    /api/v1/meta/models/:id` → 更新
  - 缓存：分类和模型数据缓存（TTL 1h），admin 修改时清除
- **验证方式**：test（Supertest）
- **回滚方案**：删除文件
- **依赖关系**：P1.03, P1.14
- **风险等级**：低
- **对应章节**：§5.3 Meta

### P1.34 — Scenes Routes

- **目标文件**：
  - `backend/src/routes/scenes.routes.ts`
  - `backend/src/services/scenes.service.ts`
- **预期行为**：
  - `GET /api/v1/scenes` → 返回全部场景列表（从 core/scenes.js 读取或 DB）
  - `GET /api/v1/scenes/categories` → 按分类分组的场景
  - 缓存策略：场景数据相对稳定，长 TTL
- **验证方式**：test
- **回滚方案**：删除文件
- **依赖关系**：P1.03
- **风险等级**：低
- **对应章节**：§5.3 Scenes

### P1.35 — Health Check Routes

- **目标文件**：
  - `backend/src/routes/health.routes.ts`
- **预期行为**：
  - `GET /health/alive` → 200 `{ status: "ok", timestamp }` — 进程存活（无 DB 检查）
  - `GET /health/ready` → 200 `{ status: "ok", db: "connected", redis?: "connected" }` — 就绪检查
    - DB 连接失败 → 503 `{ status: "error", db: "disconnected" }`
    - 可选检查 Redis 连接
  - 这两个端点不需要认证，不记录请求日志
- **验证方式**：curl + test
- **回滚方案**：删除文件
- **依赖关系**：P1.03
- **风险等级**：低
- **对应章节**：§5.3 Health

---

## 1I — 应用组装与启动（P1.36）

### P1.36 — App 入口与路由注册

- **目标文件**：
  - `backend/src/app.ts`
  - `backend/src/server.ts`
  - `backend/src/routes/index.ts`
- **预期行为**：
  - `app.ts`：
    - Express 5 实例创建
    - 中间件注册顺序：helmet → cors → cookie-parser → express.json → requestLogger → fingerprint → blacklist → routes → errorHandler
    - 404 fallback → `RESOURCE_NOT_FOUND`
  - `routes/index.ts`：
    - 汇总所有路由模块，统一挂载到 `/api/v1`
    - 健康检查路由挂载到根路径 `/health`
  - `server.ts`：
    - 加载 .env → 验证 config → 连接 Prisma → 可选连接 Redis → 启动 HTTP 监听
    - 优雅关闭：SIGTERM/SIGINT → 关闭 HTTP → 断开 Prisma → 退出
    - 未捕获异常/拒绝 → 记录错误日志 → 优雅退出
- **验证方式**：`npm run dev` 启动 + `curl /health/alive` + `curl /health/ready`
- **回滚方案**：删除文件
- **依赖关系**：P1.01-P1.35 全部
- **风险等级**：中
- **对应章节**：§3, §9

---

## Phase 1 完成标志

- [x] `tsc --noEmit` 零错误 ✅ (2026-04-07)
- [x] `vitest run` 55/55 全部通过 ✅ (2026-04-08)
- [x] `/health/ready` 返回 200（探针已接入 Prisma + Redis） ✅ (2026-04-08)
- [x] `POST /api/v1/auth/register` 可注册 ✅
- [x] `POST /api/v1/auth/login` 可登录获取 JWT ✅
- [x] `POST /api/v1/ai/enhance` 可调用 AI 增强 ✅
- [x] `GET /api/v1/admin/providers/active` 返回活跃 Provider ✅
- [x] `GET /api/v1/meta/categories` 返回分类数据 ✅
- [x] 错误响应格式统一 ✅
- [x] 请求日志输出正常 ✅
- [x] 集成测试：auth 13 + blacklist 10 + ai-gateway 12 ✅ (2026-04-08)
- [x] blacklistGuard + rateLimiter 中间件实际挂载到 app.ts ✅ (2026-04-08)
- [x] fingerprint 中间件服务端 SHA-256 降级生成 ✅ (2026-04-08)
