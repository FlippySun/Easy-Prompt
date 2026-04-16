# Easy Prompt 统一后端架构设计方案

> 日期：2026-04-07 | 基于项目 v5.3.7 审计 | v1.7 日志体系补丁 (2026-04-08)

---

## 一、审计摘要

### 1.1 现状总览

Easy Prompt 当前是一个纯前端多端产品，包含 5 个交付面：

| 端        | 位置                     | 技术栈                 | 存储方式                   | AI 调用方式                     |
| --------- | ------------------------ | ---------------------- | -------------------------- | ------------------------------- |
| VS Code   | `extension.js` + `core/` | CommonJS, Node.js      | VS Code Settings           | `curl`（child_process）         |
| Browser   | `browser/`               | WXT + Plain JS         | `chrome.storage.local`     | `fetch`                         |
| Web SPA   | `web/`                   | 纯浏览器 JS            | `localStorage`             | `fetch` + Nginx `/ep-api/` 代理 |
| IntelliJ  | `intellij/`              | Kotlin                 | `PersistentStateComponent` | JVM HTTP                        |
| PromptHub | `web-hub/`               | React 18 + Vite 6 + TS | `localStorage`             | 无 AI 调用                      |

### 1.2 核心问题

| #   | 问题                                                                                            | 影响                               | 优先级 |
| --- | ----------------------------------------------------------------------------------------------- | ---------------------------------- | ------ |
| 1   | **PromptHub 全量 mock 数据** — `MOCK_PROMPTS`、`COLLECTIONS`、`ACHIEVEMENTS` 硬编码在前端       | 无法动态管理内容、无法支持用户贡献 | P0     |
| 2   | **无用户系统** — 所有用户交互（点赞、收藏、复制、浏览、成就）存 `localStorage`                  | 数据不可跨设备、清缓存即丢失       | P0     |
| 3   | **无内容提交通道** — `CreatePromptDrawer` 提交只显示 toast，数据未持久化                        | 社区贡献功能名存实亡               | P0     |
| 4   | **内置 API Key 客户端可解密** — `defaults.js` 的 AES-256-CBC 加密客户端可逆                     | 安全风险：Key 暴露                 | **P0** |
| 5   | **AI 传输逻辑 4 份拷贝** — `core/api.js`, `browser/shared/api.js`, `web/app.js`, `ApiClient.kt` | 维护成本高、易漂移                 | **P0** |
| 6   | **无请求分析能力** — 各端直连第三方，无法统计用户行为/用量/成本                                 | 运营盲区                           | **P0** |
| 7   | **无滥用封禁能力** — 无法按账号/IP/指纹维度封禁恶意请求                                         | 安全风险：无法止血                 | **P0** |
| 8   | **多域名登录不互通** — Web(prompt.zhiz.chat) 和 PromptHub(zhiz.chat) 需各自登录                 | 用户体验割裂                       | **P0** |
| 9   | **场景数据 3 份拷贝** — `core/scenes.js`, `browser/scenes.json`, `web/scenes.json`              | 手动同步易出错                     | P1     |
| 10  | **增强历史不互通** — 各端历史独立存储，无法跨端查看                                             | 用户体验割裂                       | P2     |

### 1.3 web-hub 详细数据审计

**静态 Mock 数据（需迁移到数据库）：**

- `data/prompts.ts` — `MOCK_PROMPTS: Prompt[]`：每条含 id, title, description, content, tags[], category, likes, views, copies, author, date, model
- `data/collections.ts` — `COLLECTIONS: Collection[]`：含 id, title, description, icon, gradientFrom/To, promptIds[], tags[], savedCount, difficulty, estimatedTime
- `data/achievements.ts` — `ACHIEVEMENTS: Achievement[]`：含 id, title, description, icon, category, rarity, condition

**用户状态（`usePromptStore` → `localStorage`，需迁移到用户表）：**

```typescript
interface PromptStore {
  liked: Set<string>; // 点赞的 prompt ID
  saved: Set<string>; // 收藏的 prompt ID
  savedCollections: Set<string>; // 收藏的合集 ID
  copied: Record<string, number>; // 每个 prompt 的复制次数
  viewed: string[]; // 浏览历史
  achievements: Set<string>; // 已解锁成就 ID
  visitedCategories: Set<string>; // 已访问分类
}
```

**需要后端支撑的页面/组件：**

| 页面/组件            | 需要的后端能力                                      |
| -------------------- | --------------------------------------------------- |
| `Home`               | Prompt 列表（分页、排序、筛选）、每日精选、分类计数 |
| `Trending`           | 真实排行榜（按 likes/copies/views）、每日趋势数据   |
| `Favorites`          | 用户收藏/点赞列表（需登录）                         |
| `Profile`            | 用户信息、统计、成就、提交的 Prompt、分类偏好分析   |
| `Collections`        | 合集列表、合集详情、收藏合集                        |
| `Galaxy`             | 所有 Prompt 数据（3D 可视化）                       |
| `PromptDetailDrawer` | 点赞/收藏/复制/浏览记录、相关推荐                   |
| `CreatePromptDrawer` | Prompt 提交 + 审核流程                              |
| `Navbar`             | 登录/注册入口、用户头像                             |
| `FloatingActions`    | 随机探索（需从数据库随机取）、对比功能              |

---

## 二、技术选型

### 2.1 决策依据

- VPS 已有（107.151.137.198），运行 Nginx，需轻量级部署
- 项目以 JavaScript/TypeScript 为主，团队熟悉度高
- PromptHub 已是 React/TS，后端用 TS 可共享类型定义
- 数据模型以关系型为主（用户-Prompt-交互），适合 SQL

### 2.2 推荐技术栈

| 层         | 选型                         | 理由                                        |
| ---------- | ---------------------------- | ------------------------------------------- |
| **运行时** | Node.js 20+                  | 与前端同语言，VPS 已有 Node 环境            |
| **框架**   | Express 5 / Fastify 5        | 成熟稳定，社区生态好；Fastify 性能更优      |
| **语言**   | TypeScript                   | 类型安全，与 web-hub 共享类型               |
| **数据库** | PostgreSQL 16                | 关系型数据天然适配，支持 JSON/全文搜索      |
| **ORM**    | Prisma                       | 类型安全、迁移管理好、与 TS 深度集成        |
| **认证**   | JWT (access + refresh token) | 无状态、多端友好、适合 SPA                  |
| **密码**   | bcrypt / argon2              | 行业标准哈希                                |
| **缓存**   | Redis                        | 热门数据缓存、Rate limiting、排行榜         |
| **验证**   | Zod                          | 与 TypeScript 深度集成，前后端可共享 schema |
| **日志**   | Pino                         | 高性能结构化日志                            |
| **测试**   | Vitest + Supertest           | 与 web-hub 测试框架统一                     |

---

## 三、目录结构

```
backend/
├── src/
│   ├── config/
│   │   ├── env.ts              — 环境变量加载与校验
│   │   ├── database.ts         — Prisma client 初始化
│   │   ├── auth.ts             — JWT 密钥、过期时间等
│   │   └── providers.ts        — AI Provider 配置加载（热加载 JSON）
│   │
│   ├── middleware/
│   │   ├── authenticate.ts     — JWT 校验中间件
│   │   ├── optionalAuth.ts     — 可选认证（游客也能访问但登录用户有额外数据）
│   │   ├── fingerprint.ts      — 浏览器指纹/IP/UA 提取中间件
│   │   ├── errorHandler.ts     — 全局错误处理
│   │   ├── rateLimiter.ts      — ⭐ 渐进式限流（滑动窗口 + fail2ban 阶梯升级）
│   │   ├── blacklist.ts        — ⭐ 黑名单拦截中间件（账号/IP/指纹）
│   │   └── validate.ts         — Zod schema 校验中间件
│   │
│   ├── routes/
│   │   ├── auth.ts             — 注册/登录/刷新/登出
│   │   ├── prompts.ts          — Prompt CRUD + 交互
│   │   ├── collections.ts      — 合集 CRUD + 交互
│   │   ├── users.ts            — 用户信息/收藏/成就/统计
│   │   ├── achievements.ts     — 成就列表/解锁
│   │   ├── trending.ts         — 排行榜/趋势
│   │   ├── ai.ts               — ⭐ AI 代理网关（全端统一入口）
│   │   ├── providers.ts        — ⭐ Provider 管理（管理员快捷切换）
│   │   ├── analytics.ts        — ⭐ 请求分析/统计查询
│   │   ├── blacklist.ts        — ⭐ 黑名单管理（封禁/解封）
│   │   ├── meta.ts             — ⭐ 元数据 API（分类/模型配置，对应前端 constants.ts）
│   │   ├── admin.ts            — ⭐ 管理员 Prompt 审核（approve/reject）
│   │   ├── health.ts           — 健康检查（存活 + 就绪）
│   │   └── scenes.ts           — 场景数据服务
│   │
│   ├── services/               — 业务逻辑层（与路由解耦）
│   │   ├── auth.service.ts
│   │   ├── prompt.service.ts
│   │   ├── collection.service.ts
│   │   ├── user.service.ts
│   │   ├── achievement.service.ts
│   │   ├── trending.service.ts
│   │   ├── ai-gateway.service.ts    — ⭐ AI 代理核心：路由/中转/重试
│   │   ├── ai-analytics.service.ts  — ⭐ 请求日志写入与统计聚合
│   │   ├── provider.service.ts      — ⭐ Provider CRUD + 激活/切换
│   │   ├── blacklist.service.ts     — ⭐ 黑名单 CRUD + 匹配检查
│   │   └── rate-limiter.service.ts  — ⭐ 渐进式限流：滑动窗口 + 违规阶梯 + 自动封禁
│   │
│   ├── shared/                 — 前后端共享类型（可被 web-hub 引用）
│   │   ├── types.ts            — Prompt, Collection, Achievement, User 类型
│   │   ├── error-codes.ts      — ⭐ 统一错误码常量注册表（前后端共享）
│   │   ├── error-messages.ts   — ⭐ 错误码 → 用户可见消息映射（i18n，zh/en）
│   │   └── schemas.ts          — Zod validation schemas
│   │
│   ├── utils/
│   │   ├── jwt.ts              — Token 签发/校验
│   │   ├── password.ts         — 哈希/验证
│   │   ├── pagination.ts       — 分页辅助
│   │   ├── fingerprint.ts      — 浏览器指纹解析辅助
│   │   └── app-error.ts        — ⭐ 统一错误类 AppError（throw → errorHandler 自动序列化）
│   │
│   └── index.ts                — 应用入口
│
├── prisma/
│   ├── schema.prisma           — 数据库 schema
│   ├── migrations/             — 迁移文件
│   └── seed.ts                 — 种子数据（从 MOCK_PROMPTS/COLLECTIONS/ACHIEVEMENTS 导入）
│
├── providers/                  — ⭐ Provider 配置文件（JSON，热加载）
│   ├── vpsairobot.json         — 当前默认 Provider
│   ├── openai.json.example     — OpenAI 配置模板
│   ├── claude.json.example     — Claude 配置模板
│   └── gemini.json.example     — Gemini 配置模板
│
├── tests/
│   ├── auth.test.ts
│   ├── prompts.test.ts
│   ├── ai-gateway.test.ts
│   └── ...
│
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## 四、数据库设计

### 4.1 ER 关系图（文字版）

```
users ─┬─< user_likes >─── prompts
       ├─< user_saves >─── prompts
       ├─< user_copies >── prompts
       ├─< user_views >─── prompts
       ├─< user_achievements >── achievements
       ├─< user_collection_saves >── collections
       ├─< prompts (author_id)
       └─< ai_request_logs ───── ai_providers

collections ──< collection_prompts >── prompts

ai_providers (独立表，管理员 CRUD)
blacklist_rules (独立表，管理员 CRUD / 自动生成，拦截 user_id / IP / fingerprint)
rate_violations ──> blacklist_rules (active_rule_id FK，渐进式限流驱动封禁阶梯升级)
```

### 4.2 表结构

```sql
-- ═══ 用户 ═══
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  username        VARCHAR(50) UNIQUE NOT NULL,
  display_name    VARCHAR(100),
  password_hash   VARCHAR(255) NOT NULL,
  avatar_url      VARCHAR(500),
  bio             TEXT,
  role            VARCHAR(20) DEFAULT 'user',  -- user / admin / moderator
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ Prompt ═══
CREATE TABLE prompts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  content         TEXT NOT NULL,
  tags            TEXT[] DEFAULT '{}',
  category        VARCHAR(50) NOT NULL,
  model           VARCHAR(50),
  author_id       UUID REFERENCES users(id),
  status          VARCHAR(20) DEFAULT 'published',  -- draft / pending / published / rejected
  likes_count     INT DEFAULT 0,
  views_count     INT DEFAULT 0,
  copies_count    INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_prompts_category ON prompts(category);
CREATE INDEX idx_prompts_status ON prompts(status);
CREATE INDEX idx_prompts_author ON prompts(author_id);
CREATE INDEX idx_prompts_likes ON prompts(likes_count DESC);

-- ═══ 合集 ═══
CREATE TABLE collections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  icon            VARCHAR(10),
  gradient_from   VARCHAR(20),
  gradient_to     VARCHAR(20),
  tags            TEXT[] DEFAULT '{}',
  difficulty      VARCHAR(20),     -- 入门 / 进阶 / 专业
  estimated_time  VARCHAR(50),
  created_by      UUID REFERENCES users(id),
  saved_count     INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE collection_prompts (
  collection_id   UUID REFERENCES collections(id) ON DELETE CASCADE,
  prompt_id       UUID REFERENCES prompts(id) ON DELETE CASCADE,
  position        INT DEFAULT 0,
  PRIMARY KEY (collection_id, prompt_id)
);

-- ═══ 用户交互 ═══
CREATE TABLE user_likes (
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  prompt_id       UUID REFERENCES prompts(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, prompt_id)
);

CREATE TABLE user_saves (
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  prompt_id       UUID REFERENCES prompts(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, prompt_id)
);

CREATE TABLE user_collection_saves (
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  collection_id   UUID REFERENCES collections(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, collection_id)
);

CREATE TABLE user_copies (
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  prompt_id       UUID REFERENCES prompts(id) ON DELETE CASCADE,
  count           INT DEFAULT 1,
  last_copied_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, prompt_id)
);

CREATE TABLE user_views (
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  prompt_id       UUID REFERENCES prompts(id) ON DELETE CASCADE,
  count           INT DEFAULT 1,
  last_viewed_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, prompt_id)
);

-- ═══ 成就 ═══
CREATE TABLE achievements (
  id              VARCHAR(50) PRIMARY KEY,  -- 与前端 ID 对齐，如 'first_like'
  title           VARCHAR(100) NOT NULL,
  description     TEXT,
  icon            VARCHAR(10),
  color           VARCHAR(20),              -- 主题色（如 '#10b981'），用于前端徽章/特效渲染
  category        VARCHAR(50),
  rarity          VARCHAR(20),              -- common / rare / epic / legendary
  condition_type  VARCHAR(50),              -- likes_given / saves_count / copies_count / ...
  condition_value INT                       -- 达成阈值
);

CREATE TABLE user_achievements (
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  achievement_id  VARCHAR(50) REFERENCES achievements(id),
  unlocked_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);

-- ═══ 用户分类访问记录 ═══
CREATE TABLE user_visited_categories (
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  category        VARCHAR(50) NOT NULL,
  first_visited   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, category)
);

-- ═══ 元数据：分类与模型配置 ═══
-- 2026-04-07 新增 — 对应前端 constants.ts 的 CATEGORY_CONFIG / MODEL_CONFIG
-- 设计思路：前端当前硬编码分类/模型的标签、颜色、emoji 等样式信息，
--   迁移到后端后由管理员可动态调整，前端通过 API 或种子数据获取
-- 影响范围：Sidebar 分类列表、PromptCard 标签渲染、Trending 分类图表
-- 潜在风险：无已知风险（只读配置表）
CREATE TABLE categories (
  slug            VARCHAR(50) PRIMARY KEY,  -- 'coding', 'writing', 'marketing' 等
  label           VARCHAR(100) NOT NULL,    -- 中文显示名 '编程开发'
  label_en        VARCHAR(100),             -- 英文显示名 'Coding'
  emoji           VARCHAR(10),              -- 分类 emoji '💻'
  icon            VARCHAR(30),              -- Lucide 图标名（如 'Code2', 'PenTool'），Sidebar 导航用
  color           VARCHAR(20),              -- 主题色 '#3b82f6'
  bg_color        VARCHAR(20),              -- 浅色背景 '#eff6ff'
  dark_bg_color   VARCHAR(30),              -- 暗色背景 'rgba(59,130,246,0.1)'
  dark_color      VARCHAR(20),              -- 暗色主题色 '#60a5fa'
  sort_order      INT DEFAULT 0,            -- 排序权重
  is_active       BOOLEAN DEFAULT TRUE
);

CREATE TABLE models (
  slug            VARCHAR(50) PRIMARY KEY,  -- 'gpt4', 'claude', 'gemini' 等
  label           VARCHAR(100) NOT NULL,    -- 显示名 'GPT-4'
  color           VARCHAR(20),              -- 主题色 '#10a37f'
  sort_order      INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE
);

-- ═══════════════════════════════════════════════════════
-- ⭐ AI 代理网关 — P0 核心表
-- ═══════════════════════════════════════════════════════

-- ═══ AI Provider 配置（管理员可热切换）═══
-- 2026-04-07 新增 — 支持多家供应商快捷切换
-- 设计思路：每个 provider 对应一组 API 凭证和协议配置，
--   通过 is_active 标记当前使用哪家，支持运行时切换无需重启
-- 影响范围：ai-gateway.service.ts, provider.service.ts
-- 潜在风险：切换 provider 时需确认目标 provider 可用，建议先 test 再 activate
CREATE TABLE ai_providers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) UNIQUE NOT NULL, -- 显示名称，如 'VPS AI Robot', 'OpenAI Direct'
  slug            VARCHAR(50) UNIQUE NOT NULL,  -- 机器标识，如 'vpsairobot', 'openai-direct'
  api_mode        VARCHAR(20) NOT NULL,         -- openai / openai-responses / claude / gemini
  base_url        VARCHAR(500) NOT NULL,        -- 完整 base URL（含路径前缀）
  api_key         VARCHAR(500) NOT NULL,        -- 加密存储（应用层加解密）
  default_model   VARCHAR(100) NOT NULL,        -- 该 provider 的默认模型
  models          TEXT[] DEFAULT '{}',           -- 可用模型列表（空=不限制）
  is_active       BOOLEAN DEFAULT FALSE,        -- ⭐ 当前是否为激活的 provider（全局唯一一个 true）
  priority        INT DEFAULT 0,                -- 优先级/排序（用于 fallback 链）
  max_rpm         INT DEFAULT 60,               -- 每分钟最大请求数（限流）
  max_tokens      INT DEFAULT 4096,             -- 默认最大 token
  timeout_ms      INT DEFAULT 30000,            -- 请求超时（毫秒）
  extra_headers   JSONB DEFAULT '{}',           -- 额外请求头（如 anthropic-version）
  notes           TEXT,                         -- 管理员备注
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
-- 保证全局只有一个 active provider 的部分唯一索引
CREATE UNIQUE INDEX idx_providers_active ON ai_providers(is_active) WHERE is_active = TRUE;

-- ═══ AI 请求日志（全量记录）═══
-- 2026-04-07 新增 — 详细记录每次 AI 请求的完整上下文
-- 设计思路：每次客户端发起增强请求，后端中转给第三方 provider 前后，
--   完整记录请求元数据（指纹/IP/UA）和业务数据（prompt 输入/输出），
--   用于运营分析、成本核算、滥用检测、调试排错
-- 影响范围：ai-analytics.service.ts, analytics.ts (route)
-- 潜在风险：高频写入，需定期归档/分区；大 prompt 内容占存储
CREATE TABLE ai_request_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── 请求来源标识 ──
  request_id        UUID NOT NULL DEFAULT gen_random_uuid(), -- 请求追踪 ID（与 X-Request-Id 响应头一致，详见 §8B.2）
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,  -- NULL = 匿名/游客
  client_type       VARCHAR(20) NOT NULL,       -- vscode / browser / web / intellij / web-hub
  client_version    VARCHAR(20),                -- 客户端版本号，如 '5.3.7'
  client_platform   VARCHAR(20),                -- 操作系统：macos / windows / linux（从 User-Agent 解析）
  language          VARCHAR(10),                -- 客户端语言偏好：zh-CN / en

  -- ── 设备指纹与网络信息 ──
  ip_address        INET,                       -- 客户端 IP（支持 IPv4/IPv6）
  user_agent        TEXT,                       -- 完整 User-Agent 字符串
  fingerprint       VARCHAR(64),                -- 浏览器指纹哈希（客户端生成，如 FingerprintJS）
  country           VARCHAR(10),                -- GeoIP 国家代码（后端解析，如 'CN', 'US'）
  region            VARCHAR(100),               -- GeoIP 区域（如 '上海', 'California'）

  -- ── 业务数据 ──
  enhance_mode      VARCHAR(20),                -- fast / deep
  original_input    TEXT NOT NULL,               -- 用户原始输入
  router_result     JSONB,                      -- 路由结果 {scenes[], composite}
  system_prompt     TEXT,                       -- 最终发送给 AI 的 system prompt
  ai_output         TEXT,                       -- AI 返回的增强结果
  scene_ids         TEXT[] DEFAULT '{}',         -- 识别到的场景 ID 列表
  is_composite      BOOLEAN DEFAULT FALSE,      -- 是否复合场景

  -- ── Provider 与模型 ──
  provider_id       UUID REFERENCES ai_providers(id) ON DELETE SET NULL,
  provider_slug     VARCHAR(50),                -- 冗余存储，防 provider 删除后丢失
  model_used        VARCHAR(100),               -- 实际使用的模型
  api_mode          VARCHAR(20),                -- 实际使用的 API 协议

  -- ── 性能与计费 ──
  duration_ms       INT,                        -- 总耗时（毫秒）
  router_duration_ms INT,                       -- 第一步（路由）耗时
  gen_duration_ms   INT,                        -- 第二步（生成）耗时
  prompt_tokens     INT,                        -- 输入 token 数（provider 返回）
  completion_tokens INT,                        -- 输出 token 数
  total_tokens      INT,                        -- 总 token 数
  estimated_cost    DECIMAL(10, 6),             -- 估算成本（USD）

  -- ── 状态 ──
  status            VARCHAR(20) DEFAULT 'success', -- success / error / timeout / rate_limited
  error_message     TEXT,                       -- 错误信息（如有）
  retry_count       INT DEFAULT 0,              -- 重试次数

  -- ── 时间戳 ──
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
-- 核心查询索引
CREATE INDEX idx_ai_logs_user ON ai_request_logs(user_id, created_at DESC);
CREATE INDEX idx_ai_logs_provider ON ai_request_logs(provider_id, created_at DESC);
CREATE INDEX idx_ai_logs_created ON ai_request_logs(created_at DESC);
CREATE INDEX idx_ai_logs_status ON ai_request_logs(status, created_at DESC);
CREATE INDEX idx_ai_logs_ip ON ai_request_logs(ip_address);
CREATE INDEX idx_ai_logs_fingerprint ON ai_request_logs(fingerprint);
CREATE INDEX idx_ai_logs_client_type ON ai_request_logs(client_type, created_at DESC); -- §8B 按端统计
CREATE INDEX idx_ai_logs_request_id ON ai_request_logs(request_id);                   -- §8B.6 日志关联
-- 按月分区建议（生产环境）：
-- CREATE TABLE ai_request_logs (...) PARTITION BY RANGE (created_at);

-- ═══ 每日统计快照（用于趋势图 + 成本分析）═══
CREATE TABLE daily_stats (
  date            DATE NOT NULL,
  -- PromptHub 统计
  total_views     INT DEFAULT 0,
  total_copies    INT DEFAULT 0,
  total_likes     INT DEFAULT 0,
  new_prompts     INT DEFAULT 0,
  new_users       INT DEFAULT 0,
  -- AI 代理统计（总量）
  ai_requests     INT DEFAULT 0,               -- 当日 AI 请求总数
  ai_tokens       INT DEFAULT 0,               -- 当日总 token 消耗
  ai_cost         DECIMAL(10, 4) DEFAULT 0,    -- 当日总成本（USD）
  ai_errors       INT DEFAULT 0,               -- 当日错误数
  -- AI 代理统计（按端分拆，详见 §8B 日志体系）
  ai_req_vscode   INT DEFAULT 0,               -- VS Code 端请求数
  ai_req_browser  INT DEFAULT 0,               -- 浏览器扩展端请求数
  ai_req_web      INT DEFAULT 0,               -- Web SPA 端请求数
  ai_req_intellij INT DEFAULT 0,               -- IntelliJ 端请求数
  ai_req_webhub   INT DEFAULT 0,               -- PromptHub 端请求数
  PRIMARY KEY (date)
);

-- ═══════════════════════════════════════════════════════
-- ⭐ 黑名单封禁系统 — P0 核心表
-- ═══════════════════════════════════════════════════════

-- ═══ 封禁规则（多维度：账号/IP/指纹）═══
-- 2026-04-07 新增 — 支持按账号、IP、浏览器指纹维度封禁恶意请求
-- 设计思路：每条规则对应一种封禁维度（type + value），
--   中间件在请求链最前端匹配规则，命中即拦截（403）。
--   支持永久封禁和限时封禁（expires_at）。
-- 影响范围：blacklist 中间件（全局挂载）、blacklist.service.ts
-- 潜在风险：规则过多时需用缓存（Redis Set）加速匹配
CREATE TABLE blacklist_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── 封禁维度 ──
  type            VARCHAR(20) NOT NULL,        -- user / ip / fingerprint / ip_range
  value           VARCHAR(255) NOT NULL,        -- 具体值：user UUID / IP 地址 / 指纹哈希 / CIDR
  -- type + value 联合唯一，避免重复封禁
  UNIQUE(type, value),

  -- ── 封禁来源 ──
  source          VARCHAR(20) DEFAULT 'admin', -- ⭐ admin（管理员手动）/ auto（渐进式限流自动生成）
  violation_level INT DEFAULT 0,               -- ⭐ 当前违规等级（0=手动封禁，1-7=渐进式升级阶梯）

  -- ── 封禁信息 ──
  reason          TEXT NOT NULL,               -- 封禁原因（管理员填写 / 系统自动生成）
  blocked_by      UUID REFERENCES users(id),   -- 执行封禁的管理员（auto 时为 NULL）
  severity        VARCHAR(20) DEFAULT 'block', -- block（完全拦截）/ warn（记录但放行）/ throttle（极低限流）

  -- ── 时间控制 ──
  expires_at      TIMESTAMPTZ,                 -- NULL = 永久封禁；有值 = 到期自动解封
  is_active       BOOLEAN DEFAULT TRUE,        -- 手动停用（不删除记录）

  -- ── 统计 ──
  hit_count       INT DEFAULT 0,               -- 命中次数（被拦截的请求数）
  last_hit_at     TIMESTAMPTZ,                 -- 最后一次命中时间

  -- ── 时间戳 ──
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
-- 查询索引：中间件需快速匹配
CREATE INDEX idx_blacklist_type_value ON blacklist_rules(type, value) WHERE is_active = TRUE;
CREATE INDEX idx_blacklist_expires ON blacklist_rules(expires_at) WHERE expires_at IS NOT NULL AND is_active = TRUE;
CREATE INDEX idx_blacklist_source ON blacklist_rules(source) WHERE is_active = TRUE;

-- ═══ 渐进式限流违规记录（fail2ban 风格）═══
-- 2026-04-07 新增 — 记录每个实体的违规历史，用于驱动封禁阶梯升级
-- 设计思路：
--   1. 滑动窗口（Redis）检测短时间内请求超阈值 → 触发 violation
--   2. violation 记录持久化到此表，并根据历史 violation 次数决定封禁时长
--   3. 解封后再次违规 → violation_count + 1 → 封禁时长升级
--   4. 阶梯：5min → 30min → 1h → 6h → 1d → 7d → 永久
-- 影响范围：rateLimiter 中间件 → blacklist.service.ts → blacklist 中间件
-- 潜在风险：Redis 故障时降级为仅 DB 查询（性能下降但功能不丢失）
CREATE TABLE rate_violations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── 违规实体 ──
  entity_type     VARCHAR(20) NOT NULL,        -- ip / fingerprint / user
  entity_value    VARCHAR(255) NOT NULL,        -- 具体值
  -- 同一实体的违规历史聚合
  UNIQUE(entity_type, entity_value),

  -- ── 违规累计 ──
  violation_count INT DEFAULT 1,               -- 累计违规次数（驱动阶梯升级）
  current_level   INT DEFAULT 1,               -- 当前阶梯等级（1-7）
  -- 阶梯映射：1=5min, 2=30min, 3=1h, 4=6h, 5=1d, 6=7d, 7=永久

  -- ── 最近一次违规详情 ──
  last_window_hits INT DEFAULT 0,              -- 最近一次违规时滑动窗口内的请求数
  last_threshold   INT DEFAULT 0,              -- 触发时的阈值
  last_violation_at TIMESTAMPTZ DEFAULT NOW(),  -- 最近违规时间

  -- ── 关联的封禁规则 ──
  active_rule_id  UUID REFERENCES blacklist_rules(id) ON DELETE SET NULL, -- 当前生效的封禁规则

  -- ── 冷却与衰减 ──
  last_unban_at   TIMESTAMPTZ,                 -- 最近一次解封时间
  -- 如果解封后连续 N 天无违规，violation_count 可衰减（见 §5.8.3 衰减策略）

  -- ── 时间戳 ──
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rate_violations_entity ON rate_violations(entity_type, entity_value);
CREATE INDEX idx_rate_violations_level ON rate_violations(current_level) WHERE current_level >= 5;
```

### 4.3 Prisma Schema 对应

上述 SQL 将转换为等价的 `prisma/schema.prisma`，利用 Prisma 的迁移管理。

---

## 五、API 设计

### 5.1 基础约定

- **前缀**：`/api/v1`
- **认证**：`Authorization: Bearer <access_token>`
- **分页**：`?page=1&limit=20`，响应含 `{ data, meta: { total, page, limit, totalPages } }`
- **排序**：`?sort=likes_count&order=desc`
- **错误格式**：`{ error: { code: string, message: string, details?: any } }`（详见 §5.2 统一错误码体系）

### 5.2 统一错误码体系

> 前后端共享的错误码管理系统。
> 后端返回结构化错误码，前端根据错误码映射用户可见消息和建议操作。
> 所有端（Web / Browser / VS Code / IntelliJ）共用同一套错误码语义。

#### 5.2.1 错误响应统一格式

```typescript
// 后端所有错误响应的标准结构
// 2026-04-07 新增 — 统一错误码体系
// 设计思路：code 为机器可读的唯一标识，message 为开发调试信息（英文），
//           前端根据 code 查本地 i18n 映射表显示用户友好消息
// 影响范围：所有 API 端点的错误响应
// 潜在风险：无已知风险
interface ApiErrorResponse {
  error: {
    code: string; // 机器可读错误码（如 AUTH_TOKEN_EXPIRED）
    message: string; // 开发者调试信息（英文，不直接展示给用户）
    details?: Record<string, any>; // 可选的结构化附加信息
    httpStatus: number; // HTTP 状态码镜像（方便客户端解析）
    timestamp: string; // ISO 8601 时间戳
    requestId?: string; // 请求追踪 ID（可选，便于日志关联）
  };
}
```

**成功响应保持不变**：`{ data: T, meta?: PaginationMeta }`

#### 5.2.2 错误码分类注册表

**编码规则**：`{CATEGORY}_{SPECIFIC}`，全大写下划线分隔

| 分类前缀      | 说明          | HTTP 状态码范围 |
| ------------- | ------------- | --------------- |
| `AUTH_`       | 认证与授权    | 401, 403        |
| `VALIDATION_` | 输入校验      | 400             |
| `RATE_`       | 限流与封禁    | 429             |
| `BLACKLIST_`  | 黑名单拦截    | 403             |
| `AI_`         | AI 网关与增强 | 400, 502, 503   |
| `PROVIDER_`   | Provider 管理 | 400, 404, 503   |
| `RESOURCE_`   | 资源操作      | 404, 409        |
| `PERMISSION_` | 权限不足      | 403             |
| `SYSTEM_`     | 系统内部错误  | 500, 503        |

#### 5.2.3 完整错误码清单

##### AUTH — 认证与授权

| 错误码                  | HTTP | 触发场景                     | details 字段    |
| ----------------------- | ---- | ---------------------------- | --------------- |
| `AUTH_TOKEN_MISSING`    | 401  | 请求头无 Authorization       | —               |
| `AUTH_TOKEN_INVALID`    | 401  | Token 格式错误或签名无效     | —               |
| `AUTH_TOKEN_EXPIRED`    | 401  | Access Token 过期            | `{ expiredAt }` |
| `AUTH_REFRESH_INVALID`  | 401  | Refresh Token 无效或已被吊销 | —               |
| `AUTH_REFRESH_EXPIRED`  | 401  | Refresh Token 过期           | `{ expiredAt }` |
| `AUTH_LOGIN_FAILED`     | 401  | 邮箱或密码错误               | —               |
| `AUTH_EMAIL_EXISTS`     | 409  | 注册时邮箱已存在             | `{ email }`     |
| `AUTH_USERNAME_EXISTS`  | 409  | 注册时用户名已存在           | `{ username }`  |
| `AUTH_ACCOUNT_DISABLED` | 403  | 账号已被禁用                 | `{ reason }`    |

##### VALIDATION — 输入校验

| 错误码                       | HTTP | 触发场景                        | details 字段                  |
| ---------------------------- | ---- | ------------------------------- | ----------------------------- |
| `VALIDATION_FAILED`          | 400  | Zod schema 校验失败             | `{ fields: ZodError[] }`      |
| `VALIDATION_INPUT_TOO_SHORT` | 400  | 增强输入 < 2 字符               | `{ minLength, actualLength }` |
| `VALIDATION_INPUT_TOO_LONG`  | 400  | 增强输入超长                    | `{ maxLength, actualLength }` |
| `VALIDATION_INPUT_INVALID`   | 400  | 输入不符合增强规则（纯 URL 等） | `{ reason }`                  |
| `VALIDATION_MISSING_FIELD`   | 400  | 必填字段缺失                    | `{ field }`                   |
| `VALIDATION_INVALID_FORMAT`  | 400  | 字段格式错误（邮箱、UUID 等）   | `{ field, expected }`         |

##### RATE — 限流与封禁

| 错误码                | HTTP | 触发场景                       | details 字段                                                                  |
| --------------------- | ---- | ------------------------------ | ----------------------------------------------------------------------------- |
| `RATE_LIMITED`        | 429  | 滑动窗口超阈值，触发渐进式封禁 | `{ banLevel, banDuration, retryAfter, violationCount, dimension, expiresAt }` |
| `RATE_GLOBAL_LIMITED` | 429  | 全局限流（系统级保护）         | `{ retryAfter }`                                                              |

##### BLACKLIST — 黑名单拦截

| 错误码                | HTTP | 触发场景                         | details 字段                   |
| --------------------- | ---- | -------------------------------- | ------------------------------ |
| `BLACKLIST_BLOCKED`   | 403  | 命中 severity=block 封禁规则     | `{ type, reason, expiresAt }`  |
| `BLACKLIST_THROTTLED` | 429  | 命中 severity=throttle 规则      | `{ type, retryAfter }`         |
| `BLACKLIST_WARNED`    | 200  | 命中 severity=warn（放行但标记） | — （响应正常，仅后端记录日志） |

##### AI — AI 网关与增强

| 错误码                    | HTTP | 触发场景                           | details 字段                           |
| ------------------------- | ---- | ---------------------------------- | -------------------------------------- |
| `AI_ENHANCE_FAILED`       | 502  | AI Provider 返回错误               | `{ provider, originalError }`          |
| `AI_ROUTING_FAILED`       | 502  | 意图识别（Router 步骤）失败        | `{ step: 'routing' }`                  |
| `AI_GENERATION_FAILED`    | 502  | Prompt 生成（Generation 步骤）失败 | `{ step: 'generation' }`               |
| `AI_TIMEOUT`              | 504  | AI Provider 响应超时               | `{ timeoutMs, provider }`              |
| `AI_NO_ACTIVE_PROVIDER`   | 503  | 无可用的 AI Provider               | —                                      |
| `AI_ALL_PROVIDERS_FAILED` | 502  | 所有 Provider fallback 均失败      | `{ attemptedProviders: string[] }`     |
| `AI_INVALID_MODE`         | 400  | 不支持的增强模式                   | `{ mode, supported: ['fast','deep'] }` |

##### PROVIDER — Provider 管理

| 错误码                    | HTTP | 触发场景                | details 字段          |
| ------------------------- | ---- | ----------------------- | --------------------- |
| `PROVIDER_NOT_FOUND`      | 404  | 指定 Provider 不存在    | `{ providerId }`      |
| `PROVIDER_ALREADY_EXISTS` | 409  | Provider 名称重复       | `{ name }`            |
| `PROVIDER_TEST_FAILED`    | 400  | Provider 连通性测试失败 | `{ provider, error }` |
| `PROVIDER_DISABLED`       | 403  | Provider 已被禁用       | `{ providerId }`      |

##### RESOURCE — 资源操作

| 错误码               | HTTP | 触发场景               | details 字段          |
| -------------------- | ---- | ---------------------- | --------------------- |
| `RESOURCE_NOT_FOUND` | 404  | 请求的资源不存在       | `{ resource, id }`    |
| `RESOURCE_CONFLICT`  | 409  | 资源冲突（如重复创建） | `{ resource, field }` |
| `RESOURCE_FORBIDDEN` | 403  | 无权操作该资源         | `{ resource, id }`    |

##### PERMISSION — 权限不足

| 错误码                      | HTTP | 触发场景             | details 字段           |
| --------------------------- | ---- | -------------------- | ---------------------- |
| `PERMISSION_DENIED`         | 403  | 当前用户无此操作权限 | `{ action, resource }` |
| `PERMISSION_ADMIN_REQUIRED` | 403  | 需要管理员权限       | —                      |

##### SYSTEM — 系统内部错误

| 错误码                  | HTTP | 触发场景                   | details 字段           |
| ----------------------- | ---- | -------------------------- | ---------------------- |
| `SYSTEM_INTERNAL_ERROR` | 500  | 未预期的内部错误           | `{ requestId }`        |
| `SYSTEM_DATABASE_ERROR` | 500  | 数据库连接/查询异常        | `{ requestId }`        |
| `SYSTEM_REDIS_ERROR`    | 500  | Redis 连接异常（降级处理） | `{ requestId }`        |
| `SYSTEM_MAINTENANCE`    | 503  | 系统维护中                 | `{ estimatedEndTime }` |

#### 5.2.4 前端错误码映射（i18n）

前端通过**错误码 → 本地化消息映射表**展示用户友好信息，而非直接显示后端 `message` 字段。

```typescript
// shared/error-messages.ts — 前后端共享的错误码映射
// 2026-04-07 新增 — 统一错误码的用户可见消息映射
// 设计思路：后端返回机器可读 code，前端根据此映射表查找当地语言的用户友好消息
// 影响范围：所有前端项目（web-hub / web / browser / vscode / intellij）
// 潜在风险：新增错误码时需同步更新此映射表

type ErrorMessageEntry = {
  zh: string; // 中文（主语言）
  en: string; // 英文
  action?: {
    zh: string; // 建议操作（中文）
    en: string; // 建议操作（英文）
  };
};

export const ERROR_MESSAGES: Record<string, ErrorMessageEntry> = {
  // ── AUTH ──
  AUTH_TOKEN_MISSING: {
    zh: '请先登录',
    en: 'Please log in first',
    action: { zh: '点击登录', en: 'Click to log in' },
  },
  AUTH_TOKEN_EXPIRED: {
    zh: '登录已过期，请重新登录',
    en: 'Session expired, please log in again',
    action: { zh: '重新登录', en: 'Log in again' },
  },
  AUTH_LOGIN_FAILED: { zh: '邮箱或密码错误', en: 'Invalid email or password' },
  AUTH_EMAIL_EXISTS: {
    zh: '该邮箱已注册',
    en: 'Email already registered',
    action: { zh: '直接登录', en: 'Log in instead' },
  },
  AUTH_ACCOUNT_DISABLED: {
    zh: '账号已被禁用，请联系管理员',
    en: 'Account disabled, contact admin',
  },

  // ── VALIDATION ──
  VALIDATION_FAILED: {
    zh: '输入内容有误，请检查后重试',
    en: 'Invalid input, please check and retry',
  },
  VALIDATION_INPUT_TOO_SHORT: {
    zh: '输入内容太短，请至少输入 2 个字符',
    en: 'Input too short, minimum 2 characters',
  },
  VALIDATION_INPUT_INVALID: {
    zh: '输入内容不符合增强要求',
    en: 'Input does not meet enhancement requirements',
  },

  // ── RATE ──
  RATE_LIMITED: {
    zh: '请求过于频繁，请稍后再试',
    en: 'Too many requests, please try again later',
    action: { zh: '等待倒计时结束', en: 'Wait for cooldown' },
  },
  RATE_GLOBAL_LIMITED: {
    zh: '系统繁忙，请稍后再试',
    en: 'System busy, please try again later',
  },

  // ── BLACKLIST ──
  BLACKLIST_BLOCKED: {
    zh: '您的访问已被限制',
    en: 'Your access has been restricted',
    action: {
      zh: '如有疑问请联系管理员',
      en: 'Contact admin if you have questions',
    },
  },
  BLACKLIST_THROTTLED: {
    zh: '您的访问受到限制，请稍后再试',
    en: 'Access throttled, please try again later',
  },

  // ── AI ──
  AI_ENHANCE_FAILED: {
    zh: 'AI 增强失败，请重试',
    en: 'AI enhancement failed, please retry',
    action: { zh: '点击重试', en: 'Click to retry' },
  },
  AI_TIMEOUT: {
    zh: 'AI 响应超时，请重试',
    en: 'AI response timed out, please retry',
  },
  AI_NO_ACTIVE_PROVIDER: {
    zh: 'AI 服务暂时不可用',
    en: 'AI service temporarily unavailable',
  },
  AI_ALL_PROVIDERS_FAILED: {
    zh: 'AI 服务异常，请稍后再试',
    en: 'AI service error, please try again later',
  },

  // ── PROVIDER ──
  PROVIDER_NOT_FOUND: { zh: 'AI 配置不存在', en: 'AI provider not found' },
  PROVIDER_TEST_FAILED: {
    zh: 'AI 连通性测试失败',
    en: 'AI connectivity test failed',
  },

  // ── RESOURCE ──
  RESOURCE_NOT_FOUND: {
    zh: '请求的内容不存在',
    en: 'Requested content not found',
  },
  RESOURCE_FORBIDDEN: {
    zh: '无权访问此内容',
    en: 'No permission to access this content',
  },

  // ── PERMISSION ──
  PERMISSION_DENIED: { zh: '权限不足', en: 'Permission denied' },
  PERMISSION_ADMIN_REQUIRED: {
    zh: '需要管理员权限',
    en: 'Admin privileges required',
  },

  // ── SYSTEM ──
  SYSTEM_INTERNAL_ERROR: {
    zh: '系统异常，请稍后重试',
    en: 'System error, please try again later',
  },
  SYSTEM_MAINTENANCE: {
    zh: '系统维护中，请稍后访问',
    en: 'System under maintenance',
  },
};

// 前端使用示例
function getErrorMessage(code: string, lang: 'zh' | 'en' = 'zh'): string {
  return ERROR_MESSAGES[code]?.[lang] ?? ERROR_MESSAGES['SYSTEM_INTERNAL_ERROR'][lang];
}
function getErrorAction(code: string, lang: 'zh' | 'en' = 'zh'): string | undefined {
  return ERROR_MESSAGES[code]?.action?.[lang];
}
```

#### 5.2.5 后端错误抛出工具

```typescript
// utils/app-error.ts — 后端统一错误类
// 2026-04-07 新增 — 统一错误抛出，errorHandler 中间件自动捕获并格式化响应
// 设计思路：业务代码 throw new AppError(code, details)，中间件统一序列化
// 影响范围：所有 service / middleware / route handler
// 潜在风险：无已知风险

// HTTP 状态码映射（从错误码前缀推导，也可逐个覆盖）
const DEFAULT_STATUS: Record<string, number> = {
  AUTH: 401,
  VALIDATION: 400,
  RATE: 429,
  BLACKLIST: 403,
  AI: 502,
  PROVIDER: 400,
  RESOURCE: 404,
  PERMISSION: 403,
  SYSTEM: 500,
};

class AppError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly details?: Record<string, any>;

  constructor(
    code: string,
    options?: {
      message?: string;
      httpStatus?: number;
      details?: Record<string, any>;
    },
  ) {
    super(options?.message ?? code);
    this.code = code;
    this.httpStatus = options?.httpStatus ?? DEFAULT_STATUS[code.split('_')[0]] ?? 500;
    this.details = options?.details;
  }
}

// 使用示例
throw new AppError('AUTH_TOKEN_EXPIRED', { details: { expiredAt: '...' } });
throw new AppError('RATE_LIMITED', {
  httpStatus: 429,
  details: { banLevel: 2, retryAfter: 1800 },
});
throw new AppError('AI_TIMEOUT', {
  details: { timeoutMs: 30000, provider: 'openai' },
});
throw new AppError('RESOURCE_NOT_FOUND', {
  details: { resource: 'prompt', id: 'xxx' },
});
```

#### 5.2.6 errorHandler 中间件

```typescript
// middleware/errorHandler.ts — 全局错误处理中间件
// 2026-04-07 更新 — 集成统一错误码体系
// 设计思路：捕获所有 AppError 和未知异常，统一序列化为 ApiErrorResponse 格式
// 影响范围：Express 错误处理管道末端
// 潜在风险：未知异常可能泄露堆栈（生产环境需屏蔽）

function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.httpStatus).json({
      error: {
        code: err.code,
        message: err.message, // 开发信息，前端不直接展示
        details: err.details,
        httpStatus: err.httpStatus,
        timestamp: new Date().toISOString(),
        requestId: req.id, // 由 request-id 中间件注入
      },
    });
  }

  // Zod 校验错误 → 转换为 VALIDATION_FAILED
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: { fields: err.errors },
        httpStatus: 400,
        timestamp: new Date().toISOString(),
        requestId: req.id,
      },
    });
  }

  // 未知错误 → SYSTEM_INTERNAL_ERROR（生产环境不暴露堆栈）
  logger.error({ err, requestId: req.id }, 'Unhandled error');
  return res.status(500).json({
    error: {
      code: 'SYSTEM_INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      httpStatus: 500,
      timestamp: new Date().toISOString(),
      requestId: req.id,
    },
  });
}
```

#### 5.2.7 各端错误处理策略

| 端               | 错误处理方式                                                              |
| ---------------- | ------------------------------------------------------------------------- |
| **Web SPA**      | `fetch` 拦截器解析 `error.code` → 查 `ERROR_MESSAGES` → Toast 提示        |
| **PromptHub**    | fetch wrapper 拦截器（`lib/api.ts`）+ React Error Boundary + sonner Toast |
| **Browser 扩展** | `fetch` 拦截器 → 查映射表 → popup/content 分别渲染错误 UI                 |
| **VS Code**      | HTTP client 解析 code → `vscode.window.showErrorMessage()`                |
| **IntelliJ**     | HTTP client 解析 code → `Messages.showErrorDialog()` / Notification       |

**前端通用错误处理伪代码：**

```typescript
// 各端共用的错误处理逻辑（伪代码）
async function handleApiError(response: Response) {
  const body = await response.json();
  const { code, details } = body.error;

  // 1. Token 过期 → 尝试静默刷新
  if (code === 'AUTH_TOKEN_EXPIRED') {
    const refreshed = await tryRefreshToken();
    if (refreshed) return retry(originalRequest);
    return redirectToLogin();
  }

  // 2. 限流 → 显示倒计时
  if (code === 'RATE_LIMITED') {
    showCountdown(details.retryAfter);
    return;
  }

  // 3. 黑名单 → 显示封禁信息
  if (code === 'BLACKLIST_BLOCKED') {
    showBlockedMessage(details.reason, details.expiresAt);
    return;
  }

  // 4. 通用 → 查映射表显示消息
  const msg = getErrorMessage(code, currentLang);
  const action = getErrorAction(code, currentLang);
  showToast(msg, action);
}
```

### 5.3 端点清单

#### 认证 (`/api/v1/auth`)

| 方法 | 路径               | 说明                                  | 认证                  |
| ---- | ------------------ | ------------------------------------- | --------------------- |
| POST | `/register`        | 邮箱注册                              | ✗                     |
| POST | `/login`           | 邮箱登录，返回 access + refresh token | ✗                     |
| POST | `/refresh`         | 刷新 access token                     | ✗（需 refresh token） |
| GET  | `/me`              | 获取当前用户信息                      | ✓                     |
| POST | `/exchange`        | 一次性授权码换取 token（桌面端/插件） | ✗                     |
| POST | `/logout`          | 登出（可选：加入 token 黑名单）       | ✓                     |
| POST | `/oauth/:provider` | 第三方登录（GitHub/Google）           | ✗                     |

#### Prompts (`/api/v1/prompts`)

| 方法   | 路径        | 说明                                                   | 认证   |
| ------ | ----------- | ------------------------------------------------------ | ------ |
| GET    | `/`         | 列表（支持 search, category, model, tags, sort, page） | 可选\* |
| GET    | `/:id`      | 详情                                                   | 可选\* |
| POST   | `/`         | 提交新 Prompt                                          | ✓      |
| PUT    | `/:id`      | 更新（作者/管理员）                                    | ✓      |
| DELETE | `/:id`      | 删除（作者/管理员）                                    | ✓      |
| POST   | `/:id/like` | 切换点赞                                               | ✓      |
| POST   | `/:id/save` | 切换收藏                                               | ✓      |
| POST   | `/:id/copy` | 记录复制                                               | ✓      |
| POST   | `/:id/view` | 记录浏览                                               | 可选\* |
| GET    | `/random`   | 随机返回 1 条                                          | ✗      |
| GET    | `/featured` | 每日精选（热度+时间衰减+分类多样性算法，详见 §7.1.1②） | ✗      |
| GET    | `/galaxy`   | Galaxy 3D 可视化用精简全量数据（无分页，详见 §7.1.1③） | ✗      |

> \*可选认证：游客可访问公开数据，登录用户额外返回 `isLiked`, `isSaved` 等个人状态字段

**`GET /prompts` 查询参数详细说明：**

| 参数       | 类型   | 说明                                                                                                       | 示例               |
| ---------- | ------ | ---------------------------------------------------------------------------------------------------------- | ------------------ |
| `search`   | string | 标题/描述/内容全文搜索（PostgreSQL tsvector/trigram）                                                      | `search=代码审查`  |
| `category` | string | 按分类筛选（slug）                                                                                         | `category=coding`  |
| `model`    | string | 按模型筛选（slug）                                                                                         | `model=gpt4`       |
| `tags`     | string | 按标签筛选（逗号分隔，OR 匹配）                                                                            | `tags=安全,性能`   |
| `sort`     | string | 排序：`popular`（默认，likes_count DESC）/ `newest`（created_at DESC）/ `most_copied`（copies_count DESC） | `sort=newest`      |
| `author`   | string | 按作者筛选，`me` 表示当前用户                                                                              | `author=me`        |
| `status`   | string | 按状态筛选（仅作者/管理员可见 draft/pending/rejected）                                                     | `status=published` |
| `page`     | number | 页码（从 1 开始，默认 1）                                                                                  | `page=2`           |
| `limit`    | number | 每页数量（默认 20，最大 50）                                                                               | `limit=12`         |

**`POST /prompts` 请求体（对应 CreatePromptDrawer 表单字段）：**

```json
{
  "title": "全能代码审查专家",
  "description": "对代码进行深度审查...",
  "content": "你是一位拥有10年以上经验的资深软件工程师...",
  "category": "coding",
  "model": "gpt4",
  "tags": ["代码审查", "安全", "性能优化"]
}
```

> 提交后 `status` 自动设为 `pending`，需管理员审核后变为 `published`（详见 §10 Phase 4 审核流程）。

#### Collections (`/api/v1/collections`)

| 方法 | 路径        | 说明                            | 认证   |
| ---- | ----------- | ------------------------------- | ------ |
| GET  | `/`         | 合集列表                        | ✗      |
| GET  | `/:id`      | 合集详情（含 prompts）          | 可选\* |
| POST | `/`         | 创建合集（P1，管理员/高级用户） | ✓      |
| POST | `/:id/save` | 切换收藏合集                    | ✓      |

#### Users (`/api/v1/users`)

| 方法 | 路径                 | 说明                               | 认证 |
| ---- | -------------------- | ---------------------------------- | ---- |
| GET  | `/me`                | 当前用户完整信息                   | ✓    |
| PUT  | `/me`                | 更新个人信息                       | ✓    |
| GET  | `/me/favorites`      | 我的收藏列表                       | ✓    |
| GET  | `/me/liked`          | 我的点赞列表                       | ✓    |
| GET  | `/me/prompts`        | 我提交的 Prompt 列表（含所有状态） | ✓    |
| GET  | `/me/achievements`   | 我的成就                           | ✓    |
| GET  | `/me/stats`          | 我的统计（总点赞/收藏/复制/浏览）  | ✓    |
| GET  | `/me/category-stats` | 分类偏好分析                       | ✓    |
| POST | `/me/visit-category` | 记录访问分类（成就系统用）         | ✓    |
| GET  | `/:id/profile`       | 查看他人公开信息                   | ✗    |

#### Achievements (`/api/v1/achievements`)

| 方法 | 路径         | 说明                             | 认证 |
| ---- | ------------ | -------------------------------- | ---- |
| GET  | `/`          | 所有成就定义                     | ✗    |
| POST | `/:id/check` | 检查并解锁成就（服务端验证条件） | ✓    |

**成就条件映射表（`condition_type` → 服务端检查逻辑）：**

> 2026-04-08 新增 — 深度审查补全成就自动解锁的服务端验证逻辑
> 设计思路：前端 `usePromptStore.checkAndUnlock` 当前在客户端判定条件，
> 迁移后由 `POST /achievements/:id/check` 在服务端验证，防止伪造解锁。
> 影响范围：achievement.service.ts
> 潜在风险：无已知风险

| condition_type          | condition_value | 检查 SQL / 逻辑                                                   | 对应前端触发点                                                 |
| ----------------------- | --------------- | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| `likes_given`           | 1 / 5 / 10      | `SELECT COUNT(*) FROM user_likes WHERE user_id = $1`              | `toggleLike` → `first_like` / `like_5` / `like_10`             |
| `saves_count`           | 1 / 5 / 10      | `SELECT COUNT(*) FROM user_saves WHERE user_id = $1`              | `toggleSave` → `first_save` / `save_5` / `save_10`             |
| `copies_count`          | 1 / 5 / 10 / 25 | `SELECT SUM(count) FROM user_copies WHERE user_id = $1`           | `recordCopy` → `first_copy` / `copy_5` / `copy_10` / `copy_25` |
| `views_count`           | 1 / 10 / 20     | `SELECT COUNT(*) FROM user_views WHERE user_id = $1`              | `recordView` → `first_view` / `explorer_10` / `explorer_20`    |
| `categories_visited`    | 8               | `SELECT COUNT(*) FROM user_visited_categories WHERE user_id = $1` | `recordCategory` → `all_categories`                            |
| `achievements_unlocked` | 10              | `SELECT COUNT(*) FROM user_achievements WHERE user_id = $1`       | 任意成就解锁后 → `power_user`                                  |

> **批量检查优化**：每次用户交互（like/save/copy/view）时，后端可在同一事务中检查相关成就条件，
> 避免前端多次调用 `POST /achievements/:id/check`。推荐在 `prompt.service.ts` 的交互方法中
> 内联调用 `achievement.service.checkRelated(userId, 'likes_given')`。

#### Trending (`/api/v1/trending`)

| 方法 | 路径          | 说明                                                                            | 认证 |
| ---- | ------------- | ------------------------------------------------------------------------------- | ---- |
| GET  | `/prompts`    | 热门 Prompt 排行（支持 metric: likes/copies/views, period: day/week/month/all） | ✗    |
| GET  | `/categories` | 分类热度排行                                                                    | ✗    |
| GET  | `/daily`      | 每日趋势数据（14 天）                                                           | ✗    |

#### ⭐ AI 代理网关 (`/api/v1/ai`) — P0 核心

> 全端统一走后端中转，不再直连第三方 provider。
> 后端负责：路由编排(smartRoute) → 中转请求 → 记录完整日志 → 返回结果。

| 方法 | 路径              | 说明                              | 认证    |
| ---- | ----------------- | --------------------------------- | ------- |
| POST | `/enhance`        | ⭐ 统一增强入口（全端调用此接口） | 可选\*  |
| POST | `/enhance/stream` | 流式增强（SSE）                   | 可选\*  |
| GET  | `/models`         | 当前激活 provider 可用模型列表    | ✗       |
| POST | `/test`           | 测试当前 provider 连通性          | ✓ admin |

> \*可选认证：匿名用户也可使用（通过指纹+IP 限流），登录用户有更高配额

**`POST /ai/enhance` 请求体：**

```json
{
  "input": "帮我写一个代码审查的 prompt",
  "mode": "fast",
  "clientType": "browser",
  "clientVersion": "5.3.7",
  "fingerprint": "a1b2c3d4e5f6...",
  "language": "zh-CN"
}
```

**`POST /ai/enhance` 响应体：**

```json
{
  "result": "你是一位拥有10年以上经验的资深软件工程师...",
  "scenes": ["code-review", "optimize"],
  "composite": true,
  "requestId": "uuid-for-tracking"
}
```

**后端内部处理流程：**

```
客户端 POST /ai/enhance
  → fingerprint 中间件提取 IP / UA / 指纹
  → optionalAuth 中间件解析用户（可选）
  → rateLimiter 中间件限流（per-IP / per-user / per-fingerprint）
  → ai-gateway.service:
      1. 从 ai_providers 表读取 is_active=true 的 provider
      2. 执行 smartRoute（路由 + 生成两步 AI 调用）
      3. 中转请求到第三方 provider
      4. 解析 provider 响应（token 用量等）
  → ai-analytics.service:
      5. 异步写入 ai_request_logs（完整上下文）
      6. 更新 daily_stats 计数器
  → 返回结果给客户端
```

#### ⭐ Provider 管理 (`/api/v1/providers`) — P0 核心

> 管理员通过此接口快捷切换使用哪家第三方模型供应商，无需重启服务。

| 方法   | 路径            | 说明                                     | 认证    |
| ------ | --------------- | ---------------------------------------- | ------- |
| GET    | `/`             | 列出所有 provider（脱敏，不返回 apiKey） | ✓ admin |
| POST   | `/`             | 新增 provider                            | ✓ admin |
| PUT    | `/:id`          | 更新 provider 配置                       | ✓ admin |
| DELETE | `/:id`          | 删除 provider（不可删除激活中的）        | ✓ admin |
| POST   | `/:id/activate` | ⭐ 激活指定 provider（自动停用其他）     | ✓ admin |
| POST   | `/:id/test`     | 测试 provider 连通性（发送测试请求）     | ✓ admin |
| GET    | `/active`       | 获取当前激活的 provider 信息（脱敏）     | ✗       |

**Provider 配置示例（`POST /providers`）：**

```json
{
  "name": "VPS AI Robot",
  "slug": "vpsairobot",
  "apiMode": "openai",
  "baseUrl": "https://vpsairobot.com/v1",
  "apiKey": "sk-xxxx",
  "defaultModel": "gpt-5.4",
  "models": ["gpt-5.4", "gpt-5.3", "gpt-4.1"],
  "maxRpm": 60,
  "maxTokens": 4096,
  "timeoutMs": 30000,
  "extraHeaders": {},
  "notes": "当前主力 provider"
}
```

**快捷切换 Provider 示例：**

```bash
# 1. 查看所有 provider
GET /api/v1/providers
# → [{ id: "uuid-1", slug: "vpsairobot", isActive: true, ... },
#    { id: "uuid-2", slug: "openai-direct", isActive: false, ... }]

# 2. 激活另一个 provider（原来的自动停用）
POST /api/v1/providers/uuid-2/activate
# → { success: true, activated: "openai-direct", deactivated: "vpsairobot" }

# 3. 此刻所有客户端的 AI 请求自动走新 provider，零停机
```

#### ⭐ 请求分析 (`/api/v1/analytics`) — P0 核心

> 查询 AI 请求日志，用于运营分析、成本核算、滥用检测。

| 方法 | 路径            | 说明                                    | 认证    |
| ---- | --------------- | --------------------------------------- | ------- |
| GET  | `/requests`     | 请求日志列表（分页、筛选）              | ✓ admin |
| GET  | `/requests/:id` | 单条请求详情（含完整 prompt 输入/输出） | ✓ admin |
| GET  | `/summary`      | 统计摘要（总请求/token/成本/错误率）    | ✓ admin |
| GET  | `/daily`        | 每日趋势数据（14/30/90 天）             | ✓ admin |
| GET  | `/by-client`    | 按客户端类型分布统计                    | ✓ admin |
| GET  | `/by-scene`     | 按场景使用频率统计                      | ✓ admin |
| GET  | `/by-ip`        | 按 IP 请求频率排行（反滥用）            | ✓ admin |
| GET  | `/by-user`      | 按用户请求量排行                        | ✓ admin |
| GET  | `/cost`         | 成本分析（按 provider/天/周/月）        | ✓ admin |

**`GET /analytics/summary` 响应示例：**

```json
{
  "period": "last_7_days",
  "totalRequests": 12580,
  "successRate": 0.973,
  "totalTokens": 8234500,
  "estimatedCost": 12.45,
  "uniqueUsers": 342,
  "uniqueIPs": 1205,
  "avgDurationMs": 2340,
  "topScenes": [
    { "sceneId": "code-review", "count": 1832 },
    { "sceneId": "optimize", "count": 1456 }
  ],
  "clientDistribution": {
    "browser": 5420,
    "web": 3200,
    "vscode": 2100,
    "intellij": 1860
  }
}
```

**`GET /analytics/requests` 筛选参数：**

| 参数          | 说明                                  |
| ------------- | ------------------------------------- |
| `clientType`  | 按端过滤：vscode/browser/web/intellij |
| `status`      | 按状态过滤：success/error/timeout     |
| `userId`      | 按用户过滤                            |
| `ip`          | 按 IP 过滤                            |
| `fingerprint` | 按指纹过滤                            |
| `scene`       | 按场景过滤                            |
| `provider`    | 按 provider 过滤                      |
| `dateFrom`    | 起始日期                              |
| `dateTo`      | 截止日期                              |

#### ⭐ 黑名单管理 (`/api/v1/blacklist`) — P0 核心

> 管理员封禁/解封恶意账号、IP、浏览器指纹。黑名单中间件全局挂载，在请求链最前端拦截。

| 方法   | 路径              | 说明                                         | 认证    |
| ------ | ----------------- | -------------------------------------------- | ------- |
| GET    | `/`               | 列出所有封禁规则（分页、筛选）               | ✓ admin |
| POST   | `/`               | ⭐ 新增封禁规则                              | ✓ admin |
| PUT    | `/:id`            | 更新封禁规则（修改原因/severity/过期时间）   | ✓ admin |
| DELETE | `/:id`            | 删除封禁规则（永久移除）                     | ✓ admin |
| POST   | `/:id/deactivate` | 临时停用规则（保留记录）                     | ✓ admin |
| POST   | `/:id/activate`   | 重新启用已停用的规则                         | ✓ admin |
| POST   | `/check`          | 检查某个值是否被封禁（调试用）               | ✓ admin |
| GET    | `/stats`          | 封禁命中统计（top blocked IPs/fingerprints） | ✓ admin |

**`POST /blacklist` 请求体（封禁某个账号）：**

```json
{
  "type": "user",
  "value": "uuid-of-malicious-user",
  "reason": "批量刷请求，1小时内发送 500+ 次 AI 增强",
  "severity": "block",
  "expiresAt": null
}
```

**`POST /blacklist` 请求体（封禁某个 IP）：**

```json
{
  "type": "ip",
  "value": "203.0.113.42",
  "reason": "疑似自动化脚本攻击",
  "severity": "block",
  "expiresAt": "2026-04-14T00:00:00Z"
}
```

**`POST /blacklist` 请求体（封禁某个浏览器指纹）：**

```json
{
  "type": "fingerprint",
  "value": "a1b2c3d4e5f6...",
  "reason": "多次使用不同 IP 绕过限制",
  "severity": "block",
  "expiresAt": null
}
```

**封禁 severity 级别：**

| 级别       | 行为                                       |
| ---------- | ------------------------------------------ |
| `block`    | 完全拦截，返回 403 Forbidden               |
| `throttle` | 极低限流（如 1 次/分钟），降级而非完全封禁 |
| `warn`     | 放行但记录到日志，用于观察期               |

**黑名单中间件处理流程：**

```
请求进入
  → 提取 IP / fingerprint / userId（如有 token）
  → 查询 blacklist_rules（优先 Redis 缓存）：
      1. 匹配 type=ip, value=请求IP
      2. 匹配 type=fingerprint, value=请求指纹
      3. 匹配 type=user, value=userId（如已认证）
      4. 匹配 type=ip_range, CIDR 包含请求IP
  → 检查 is_active=true 且未过期
  → 命中 block → 403 + 更新 hit_count
  → 命中 throttle → 极低限流
  → 命中 warn → 放行 + 记录日志
  → 未命中 → 正常放行
```

**与 Analytics 联动：**

管理员可从 `/analytics/by-ip` 或 `/analytics/by-user` 发现异常后，
直接调用 `POST /blacklist` 快速封禁，形成"发现→封禁"闭环。

#### ⭐ 渐进式自动限流（fail2ban 风格）— P0 核心

> 自动检测异常请求频率，超阈值后渐进式封禁，
> 与黑名单系统深度融合。封禁时长随违规次数阶梯升级，类似 fail2ban。

**设计原则：**

- 正常 prompt 增强不会短时间内高频请求（正常用户 ~1-3 次/分钟）
- 检测到超阈值后，**自动创建** `blacklist_rules`（`source='auto'`），无需管理员介入
- 解封后再次违规 → 违规次数累加 → 封禁时长阶梯升级
- 管理员可随时查看/覆盖自动封禁规则

**封禁阶梯（7 级）：**

| 等级 | 违规次数 | 封禁时长    | 说明                           |
| ---- | -------- | ----------- | ------------------------------ |
| 1    | 第 1 次  | **5 分钟**  | 首次违规，轻度警告性封禁       |
| 2    | 第 2 次  | **30 分钟** | 短期内再犯，加重               |
| 3    | 第 3 次  | **1 小时**  | 持续违规                       |
| 4    | 第 4 次  | **6 小时**  | 明显恶意倾向                   |
| 5    | 第 5 次  | **1 天**    | 严重违规                       |
| 6    | 第 6 次  | **7 天**    | 长期封禁                       |
| 7    | 第 7+ 次 | **永久**    | 达到最高等级，需管理员手动解封 |

**阈值配置（可通过环境变量调整）：**

| 参数                  | 默认值         | 说明                                      |
| --------------------- | -------------- | ----------------------------------------- |
| `RATE_WINDOW_SECONDS` | 60             | 滑动窗口大小（秒）                        |
| `RATE_MAX_REQUESTS`   | 10             | 窗口内最大请求数（超过即触发违规）        |
| `RATE_DECAY_DAYS`     | 30             | 无违规天数后违规等级衰减 1 级（0=不衰减） |
| `RATE_DIMENSIONS`     | ip,fingerprint | 限流维度（逗号分隔，可加 user）           |

**完整处理流程：**

```
请求进入
  │
  ├── 1. blacklist 中间件（最前端）
  │     → 检查 blacklist_rules 是否命中（含自动封禁规则）
  │     → 命中 block → 403 Forbidden（附带封禁剩余时间和原因）
  │     → 命中 throttle / warn → 按策略处理
  │     → 未命中 → 放行到下一步
  │
  ├── 2. rateLimiter 中间件（黑名单后、业务前）
  │     → 提取请求 IP / fingerprint（/ userId 如已认证）
  │     → 对每个维度，Redis ZRANGEBYSCORE 统计滑动窗口内请求数
  │     → 未超阈值 → ZADD 记录本次请求 → 放行
  │     → ⚡ 超过阈值 → 触发违规处理流程（见下）
  │
  ├── 3. 正常业务处理（auth → validate → handler）
  │
  └── 4. 响应
```

**⚡ 违规触发流程（rateLimiter → blacklist 融合）：**

```
检测到超阈值
  │
  ├── 查询 rate_violations 表：该实体是否有历史违规记录？
  │
  ├── [无记录] → 创建 rate_violations（violation_count=1, current_level=1）
  │           → 创建 blacklist_rules（source='auto', violation_level=1, expires_at=now+5min）
  │           → 返回 429 Too Many Requests + Retry-After: 300
  │
  ├── [有记录] → violation_count++ , current_level = min(violation_count, 7)
  │           → 查阶梯表得到新封禁时长
  │           → 更新/新建 blacklist_rules（source='auto', violation_level=N, expires_at=计算值）
  │           → level 7 时 expires_at=NULL（永久封禁）
  │           → 返回 429 + Retry-After + X-Ban-Level: N
  │
  └── 记录到 ai_request_logs（status='rate_limited', 含违规详情）
```

**429 响应体示例：**

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "请求过于频繁，已被暂时限制。请稍后再试。",
    "details": {
      "banLevel": 2,
      "banDuration": "30m",
      "retryAfter": 1800,
      "violationCount": 2,
      "dimension": "ip",
      "expiresAt": "2026-04-07T15:30:00Z"
    }
  }
}
```

**违规等级衰减策略：**

```
解封后开始计时
  → 连续 RATE_DECAY_DAYS（默认 30）天无违规
  → current_level 减 1（最低到 0）
  → violation_count 保持不变（历史记录不清除）

实现方式：
  - 后台定时任务（每日 cron）
  - 扫描 rate_violations 表中 last_violation_at 早于 N 天且 current_level > 0 的记录
  - 逐级衰减，不一次性清零
```

**管理员覆盖能力：**

| 操作                            | 说明                                |
| ------------------------------- | ----------------------------------- |
| `DELETE /blacklist/:id`         | 删除自动封禁规则 → 立即解封         |
| `PUT /blacklist/:id`            | 修改自动规则（如延长/缩短封禁时间） |
| `POST /blacklist`(source=admin) | 手动封禁覆盖自动规则（优先级更高）  |
| `GET /blacklist?source=auto`    | 筛选查看所有自动封禁规则            |
| `GET /blacklist/stats`          | 查看自动封禁命中排行                |

**Redis 数据结构设计：**

```
# 滑动窗口（Sorted Set，score=timestamp）
rate:ip:{ip_address}           → ZADD score=now member=requestId
rate:fp:{fingerprint_hash}     → ZADD score=now member=requestId
rate:user:{user_id}            → ZADD score=now member=requestId

# 窗口清理：每次查询前 ZREMRANGEBYSCORE 移除过期条目

# 黑名单缓存（Set，避免每次查 DB）
blacklist:ip                   → SADD {ip1, ip2, ...}
blacklist:fp                   → SADD {fp1, fp2, ...}
blacklist:user                 → SADD {uid1, uid2, ...}

# 缓存刷新：封禁/解封时同步更新 Redis Set
# TTL：与最长非永久封禁时间对齐（7d），永久封禁无 TTL
```

**与现有系统的融合关系：**

```
┌─────────────────────────────────────────────────────────┐
│                    请求处理管道                            │
│                                                           │
│  blacklist MW ──→ rateLimiter MW ──→ auth ──→ business    │
│       ↑                │                                  │
│       │                │ 超阈值                            │
│       │                ↓                                  │
│       │    ┌──────────────────────┐                       │
│       │    │  rate_violations 表   │ ← 历史违规记录        │
│       │    │  (violation_count,    │                       │
│       │    │   current_level)      │                       │
│       │    └──────┬───────────────┘                       │
│       │           │ 创建/更新                              │
│       │           ↓                                       │
│       │    ┌──────────────────────┐                       │
│       └────│  blacklist_rules 表   │ ← source='auto'       │
│            │  (自动封禁规则)        │   violation_level=N    │
│            └──────────────────────┘                       │
│                                                           │
│  管理员手动封禁 ──→ blacklist_rules (source='admin') ──┘  │
│  Analytics 发现  ──→ POST /blacklist ──────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

#### Scenes (`/api/v1/scenes`)

| 方法 | 路径          | 说明                             | 认证 |
| ---- | ------------- | -------------------------------- | ---- |
| GET  | `/`           | 获取场景列表（canonical 数据源） | ✗    |
| GET  | `/categories` | 场景分类结构                     | ✗    |

#### 元数据 (`/api/v1/meta`) — 对应前端 constants.ts

> 前端 `CATEGORY_CONFIG` 和 `MODEL_CONFIG` 当前硬编码在 `data/constants.ts`，
> 迁移后由此 API 提供，支持管理员动态调整分类/模型元数据而无需前端发版。

| 方法 | 路径                | 说明                                     | 认证    |
| ---- | ------------------- | ---------------------------------------- | ------- |
| GET  | `/categories`       | 分类列表（slug, label, emoji, color 等） | ✗       |
| GET  | `/models`           | AI 模型列表（slug, label, color）        | ✗       |
| POST | `/categories`       | 新增分类                                 | ✓ admin |
| PUT  | `/categories/:slug` | 更新分类（修改标签/颜色/排序）           | ✓ admin |
| POST | `/models`           | 新增模型                                 | ✓ admin |
| PUT  | `/models/:slug`     | 更新模型                                 | ✓ admin |

> 前端可在应用启动时一次性请求 `GET /meta/categories` + `GET /meta/models` 并缓存，
> 或打包进 SSR/SSG 构建，无需每次页面都重新拉取。

#### 管理员 Prompt 审核 (`/api/v1/admin/prompts`)

> `CreatePromptDrawer` 提交的 Prompt 进入 `pending` 状态，
> 管理员通过此接口审核后发布或拒绝。

| 方法 | 路径           | 说明                                           | 认证    |
| ---- | -------------- | ---------------------------------------------- | ------- |
| GET  | `/`            | 待审核列表（status=pending，分页）             | ✓ admin |
| POST | `/:id/approve` | 审核通过 → status 改为 published               | ✓ admin |
| POST | `/:id/reject`  | 审核拒绝 → status 改为 rejected（附带 reason） | ✓ admin |

#### 健康检查 (`/api/v1/health`)

| 方法 | 路径     | 说明                                                     | 认证 |
| ---- | -------- | -------------------------------------------------------- | ---- |
| GET  | `/`      | 应用存活检查（返回 `{ status: 'ok', uptime, version }`） | ✗    |
| GET  | `/ready` | 就绪检查（DB + Redis 连通性）                            | ✗    |

---

## 六、认证方案

### 6.1 统一 SSO 登录页 + JWT 双 Token

> **核心设计**：所有端共享同一个 Web 登录页面（`zhiz.chat/auth/login`），
> 桌面端/插件点击"登录"后拉起系统浏览器进入该页面，登录成功后通过回调将凭证传回原端。
> Web 端直接在站内导航或重定向到该页面。

```
                    ┌──────────────────────────────┐
                    │  zhiz.chat/auth/login         │
                    │  （统一 SSO 登录/注册页面）     │
                    │                                │
                    │  ┌──────────────────────────┐ │
                    │  │  邮箱 + 密码              │ │
                    │  │  [登录]  [注册]           │ │
                    │  │  ── 或 ──                 │ │
                    │  │  [GitHub 登录]            │ │
                    │  └──────────────────────────┘ │
                    └──────────────────────────────┘
                         ↑                   ↓
                    用户从各端           登录成功后
                    打开此页面           按来源回调
```

**Token 机制：**

```
accessToken:  短期有效（15 分钟），存内存，每次请求 Authorization 头携带
refreshToken: 长期有效（7 天），Web 端存 httpOnly cookie，桌面端/插件存平台安全存储
```

### 6.2 各端登录流程

#### ⭐ Web 端 — zhiz.chat（PromptHub）

用户在站内直接操作，登录页属于同域：

```
1. 用户点击 Navbar "登录" 按钮
   → 前端路由导航到 /auth/login 页面

2. 用户提交邮箱+密码
   → POST /api/v1/auth/login
   → 后端验证通过后返回：
     - Body: { accessToken, user }
     - Set-Cookie: ep_refresh=xxx; Domain=.zhiz.chat; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=7d

3. 前端存储 accessToken 到内存（React context）
   → 路由重定向回登录前页面
   → 用户已登录状态
```

#### ⭐ Web 端 — prompt.zhiz.chat（Web SPA）

跨子域 SSO，利用 `.zhiz.chat` 父域 cookie 共享：

```
1. 用户点击"登录"
   → 重定向到 zhiz.chat/auth/login?redirect=https://prompt.zhiz.chat

2. 在 zhiz.chat 完成登录（同上流程）
   → 后端 Set-Cookie: ep_refresh（Domain=.zhiz.chat，所有子域共享）
   → 后端返回重定向到 redirect 参数指定的地址

3. 回到 prompt.zhiz.chat
   → 浏览器已持有 ep_refresh cookie（因为 Domain=.zhiz.chat 匹配）
   → 前端启动时自动调用 POST /api/v1/auth/refresh（cookie 自动携带）
   → 后端验证 cookie → 返回新 accessToken
   → 用户自动登录
```

#### ⭐ 浏览器扩展（Browser Extension）

点击登录 → 拉起浏览器 Tab 打开 SSO 页 → 登录成功后通过消息回传凭证：

```
1. 用户在 popup/options 点击"登录"
   → 扩展生成一次性 state 随机串（防 CSRF）
   → chrome.tabs.create({
       url: 'https://zhiz.chat/auth/login?callback=extension&state=xxx'
     })

2. 用户在 SSO 页面完成登录
   → 后端颁发 accessToken + refreshToken
   → SSO 页面识别 callback=extension
   → 页面重定向到 zhiz.chat/auth/callback/extension?code=临时授权码&state=xxx

3. 扩展监听回调（两种方式，按优先级选择）

   方式 A — chrome.tabs.onUpdated 监听（推荐）：
   → 扩展 background 监听 tab URL 变化
   → 匹配到 zhiz.chat/auth/callback/extension?code=xxx&state=xxx
   → 验证 state 一致性
   → 用 code 调用 POST /api/v1/auth/exchange（一次性换取 accessToken + refreshToken）
   → 存储 refreshToken 到 chrome.storage.local
   → 自动关闭该 tab
   → popup 显示已登录状态

   方式 B — postMessage（备选，需要 content script 在 zhiz.chat 注入）：
   → 回调页面通过 chrome.runtime.sendMessage 发送 token 给扩展
   → 扩展 background 接收并存储
```

#### ⭐ VS Code 扩展

点击登录 → 拉起系统浏览器 → 登录成功后通过 URI Handler 回调：

```
1. 用户执行 "Easy Prompt: Login" 命令或点击登录按钮
   → 扩展生成一次性 state
   → vscode.env.openExternal(Uri.parse(
       'https://zhiz.chat/auth/login?callback=vscode&state=xxx'
     ))

2. 用户在浏览器中完成登录
   → SSO 页面识别 callback=vscode
   → 登录成功后重定向到自定义 URI：
     vscode://easyprompt.easy-prompt/auth-callback?code=xxx&state=xxx

3. VS Code 接收回调
   → 扩展注册 UriHandler（在 package.json 中声明）
   → handleUri(uri) 方法被调用
   → 验证 state → 用 code 换取 accessToken + refreshToken
   → refreshToken 存入 vscode.secrets（SecretStorage）
   → 状态栏显示已登录用户名
```

**VS Code package.json 注册 URI Handler：**

```json
{
  "contributes": {
    "uriHandlers": [
      {
        "scheme": "vscode",
        "authority": "easyprompt.easy-prompt"
      }
    ]
  }
}
```

#### ⭐ IntelliJ 插件

点击登录 → 拉起系统浏览器 → 登录成功后通过 localhost 回调：

```
1. 用户在 Settings / Tool Window 点击"登录"
   → 插件启动一个临时 localhost HTTP 服务器（随机端口，如 :51234）
   → 生成一次性 state
   → BrowserUtil.browse(
       'https://zhiz.chat/auth/login?callback=localhost&port=51234&state=xxx'
     )

2. 用户在浏览器中完成登录
   → SSO 页面识别 callback=localhost
   → 登录成功后重定向到：
     http://localhost:51234/auth-callback?code=xxx&state=xxx

3. IntelliJ 接收回调
   → 临时 HTTP 服务器收到请求
   → 验证 state → 返回"登录成功，请返回 IntelliJ"的 HTML 页面
   → 关闭临时服务器
   → 用 code 换取 accessToken + refreshToken
   → refreshToken 存入 PasswordSafe
   → 通知 UI 更新已登录状态
```

### 6.3 登录页回调路由汇总

SSO 登录页根据 `callback` 参数决定登录成功后的回调方式：

| callback 值 | 回调方式                                                              | 适用端           |
| ----------- | --------------------------------------------------------------------- | ---------------- |
| 无 / `web`  | 重定向到 `redirect` 参数（默认 `/`）                                  | zhiz.chat 站内   |
| `redirect`  | 重定向到 `redirect` URL（跨子域 SSO）                                 | prompt.zhiz.chat |
| `extension` | 重定向到 `zhiz.chat/auth/callback/extension?code=&state=`             | 浏览器扩展       |
| `vscode`    | 重定向到 `vscode://easyprompt.easy-prompt/auth-callback?code=&state=` | VS Code          |
| `localhost` | 重定向到 `http://localhost:{port}/auth-callback?code=&state=`         | IntelliJ         |

**`code` 授权码机制：**

- 登录成功后后端生成一次性短期授权码 `code`（有效期 60 秒）
- 客户端用 `code` + `state` 调用 `POST /api/v1/auth/exchange` 换取 accessToken + refreshToken
- `code` 一次性使用，用后即销毁，防止重放攻击
- Web 端（zhiz.chat 同域）直接使用 cookie，不需要 code 换取

### 6.3.1 SSO 边界情况与错误处理

> 2026-04-08 新增 — 深度审查补全 SSO 流程的边界情况
> 设计思路：确保每种异常场景都有明确的处理路径，避免用户卡死在登录流程中
> 影响范围：SSO 登录页、各端回调逻辑、auth.service.ts
> 潜在风险：无已知风险

#### ① redirect URL 白名单校验

SSO 登录页的 `redirect` 和 `callback` 参数必须经过白名单验证，防止开放重定向攻击：

```typescript
// auth.service.ts — redirect URL 白名单校验
const ALLOWED_REDIRECT_ORIGINS = ['https://zhiz.chat', 'https://prompt.zhiz.chat'];
const ALLOWED_CALLBACK_SCHEMES = [
  'extension', // 浏览器扩展
  'vscode', // VS Code URI Handler
  'localhost', // IntelliJ localhost 回调
  'web', // zhiz.chat 站内
  'redirect', // 跨子域重定向
];

function validateRedirect(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_REDIRECT_ORIGINS.some((origin) => url.startsWith(origin));
  } catch {
    return false; // 非法 URL 直接拒绝
  }
}
// 验证失败 → 重定向到默认首页 zhiz.chat，并记录安全日志
```

#### ② state 存储机制

各端生成的 CSRF `state` 随机串存储位置：

| 端                | state 存储位置                                            | 生命周期                 |
| ----------------- | --------------------------------------------------------- | ------------------------ |
| Browser Extension | `chrome.storage.session`（首选）或 background SW 内存变量 | 单次登录流程，回调后清除 |
| VS Code           | 扩展内存变量（`_pendingState`）                           | 单次登录流程，回调后清除 |
| IntelliJ          | 临时 HTTP 服务器绑定的局部变量                            | 服务器关闭时自动释放     |

> **安全要求**：state 必须使用密码学安全随机（`crypto.randomUUID()` / `SecureRandom`），长度 ≥ 32 字符。

#### ③ 登录超时处理

各端在打开 SSO 页面后设置超时计时器，超时未收到回调则自动取消：

| 端                | 超时时长 | 超时行为                                             |
| ----------------- | -------- | ---------------------------------------------------- |
| Browser Extension | 5 分钟   | 清除 state，停止 `tabs.onUpdated` 监听，提示用户重试 |
| VS Code           | 5 分钟   | 清除 state，显示通知 "登录超时，请重试"              |
| IntelliJ          | 3 分钟   | 关闭临时 HTTP 服务器，显示气泡通知 "登录超时"        |

#### ④ 并发登录防护

防止用户连续点击"登录"按钮导致多个 SSO 流程并存：

- **浏览器扩展**：点击登录后按钮变为 disabled + "登录中..." 状态；如果已有 pending state，先取消旧的（关闭旧 tab + 清除旧 state），再发起新流程。
- **VS Code**：检测 `_pendingState` 是否存在，如有则先清除并提示"已取消上一次登录"，再发起新流程。
- **IntelliJ**：检测临时 HTTP 服务器是否已运行，如有则先关闭，再启动新的。

#### ⑤ 错误场景处理

| 错误场景                       | 处理方式                                                        |
| ------------------------------ | --------------------------------------------------------------- |
| state 不匹配                   | 拒绝回调，提示 "安全验证失败，请重新登录"                       |
| code 已过期（>60s）            | 返回 401 `AUTH_CODE_EXPIRED`，客户端提示重新登录                |
| code 已使用（重放）            | 返回 401 `AUTH_CODE_USED`，并吊销该 code 关联的所有 token       |
| 用户在 SSO 页面点击取消/关闭   | 无回调发生，客户端超时后自动清理（见③）                         |
| 网络中断导致 exchange 请求失败 | 客户端重试 1 次，仍失败则提示 "网络异常，请稍后重试"            |
| SSO 页面本身加载失败           | 客户端检测到 tab 加载错误 / 浏览器未打开，提示 "无法打开登录页" |
| IntelliJ localhost 端口被占用  | 重试 3 个随机端口（49152-65535 范围），全部失败则提示用户       |
| VS Code URI Handler 未注册成功 | 降级到浏览器内展示 code，用户手动粘贴到 VS Code 输入框          |

### 6.4 Cookie 配置（Web 端跨域 SSO）

```typescript
// 后端设置 refreshToken cookie（仅 Web 端登录时设置）
// 2026-04-07 — SSO cookie 配置
// 设计思路：父域 cookie 实现 zhiz.chat ↔ prompt.zhiz.chat 无缝 SSO
// 影响范围：auth.service.ts, auth.ts 路由
// 潜在风险：Safari ITP 可能限制第三方 cookie，但 .zhiz.chat 属第一方不受影响
res.cookie('ep_refresh', refreshToken, {
  domain: '.zhiz.chat', // 父域，所有子域共享
  path: '/api/v1/auth', // 仅在 auth 路径发送（减少不必要的传输）
  httpOnly: true, // JS 不可读取（防 XSS）
  secure: true, // 仅 HTTPS 传输
  sameSite: 'Lax', // 允许同站顶级导航携带
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
});
```

### 6.5 各端认证方式对比

| 端                         | 登录触发                    | 回调机制              | refreshToken 存储            | 跨域 SSO |
| -------------------------- | --------------------------- | --------------------- | ---------------------------- | -------- |
| PromptHub (zhiz.chat)      | 站内导航到 /auth/login      | 站内重定向 + Cookie   | httpOnly cookie (.zhiz.chat) | ✓        |
| Web SPA (prompt.zhiz.chat) | 重定向到 zhiz.chat/auth     | Cookie 共享 + refresh | httpOnly cookie (.zhiz.chat) | ✓        |
| Browser Extension          | chrome.tabs.create 打开 SSO | tabs.onUpdated + code | chrome.storage.local         | —        |
| VS Code                    | openExternal 打开 SSO       | URI Handler + code    | SecretStorage                | —        |
| IntelliJ                   | BrowserUtil.browse 打开 SSO | localhost + code      | PasswordSafe                 | —        |

### 6.6 前端存储策略

**Web 端（zhiz.chat + prompt.zhiz.chat）：**

- **accessToken** → 内存（React state / context / JS 变量）
- **refreshToken** → `httpOnly` secure cookie（`Domain=.zhiz.chat`，浏览器自动管理）
- 应用启动时自动调用 `POST /auth/refresh`（cookie 自动携带），恢复会话
- 如果 refresh 失败（cookie 过期/无效）→ 显示未登录状态

**桌面端/插件（VS Code / IntelliJ / Browser Extension）：**

- **accessToken** → 内存
- **refreshToken** → 平台安全存储（见上表）
- 应用启动时手动附带 refreshToken 调用 `POST /auth/refresh`（Body 方式）
- 如果 refresh 失败 → 显示未登录状态，引导用户重新打开 SSO 页登录

### 6.7 可选认证中间件

关键设计：大部分读接口同时支持**游客**和**登录用户**。

```typescript
// optionalAuth 中间件：不强制 401，但如果有 token 则解析出 userId
// 2026-04-07 — 可选认证中间件
// 设计思路：读接口支持游客（公开数据）和登录用户（额外返回个人状态字段）
// 影响范围：prompts 列表/详情、collections 列表/详情
// 潜在风险：无已知风险
async function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      /* ignore invalid token for optional routes */
    }
  }
  next();
}
```

游客看到公开数据，登录用户额外获取 `isLiked`, `isSaved` 等个人状态。

### 6.8 Auth API 端点

| 方法 | 路径             | 说明                                         | Cookie / Token 行为                |
| ---- | ---------------- | -------------------------------------------- | ---------------------------------- |
| POST | `/auth/register` | 注册（邮箱+密码）                            | Web: Set cookie; 桌面端: 返回 code |
| POST | `/auth/login`    | 登录                                         | Web: Set cookie; 桌面端: 返回 code |
| POST | `/auth/exchange` | ⭐ 一次性授权码换取 token（桌面端/插件专用） | 返回 { accessToken, refreshToken } |
| POST | `/auth/refresh`  | 续签 accessToken                             | Cookie 或 Body 方式传 refreshToken |
| POST | `/auth/logout`   | 登出                                         | Clear cookie + 服务端吊销 refresh  |
| GET  | `/auth/me`       | 获取当前用户信息                             | —                                  |

> `POST /auth/refresh` 同时支持两种方式传递 refreshToken：
>
> 1. **Cookie 方式**（Web 端优先）：从 `ep_refresh` cookie 自动读取
> 2. **Body 方式**（桌面端/插件）：`{ refreshToken: "xxx" }`

> `POST /auth/exchange` 请求体：`{ code: "一次性授权码", state: "CSRF 验证串" }`
> 返回：`{ accessToken, refreshToken, user }`
> 授权码有效期 60 秒，使用后立即销毁。

---

## 七、与各端的集成方案

### 7.0 全端 AI 调用架构变更 — P0

> 所有端的 AI 增强请求统一改为调用后端 `/api/v1/ai/enhance`，
> 不再直连第三方 provider。后端负责中转、日志记录和 provider 管理。

**变更前（各端直连第三方）：**

```
VS Code   ──curl──→  第三方 Provider
Browser   ──fetch─→  第三方 Provider
Web SPA   ──fetch─→  Nginx /ep-api/ ──→ 第三方 Provider
IntelliJ  ──HTTP──→  第三方 Provider
```

**变更后（全端统一走后端）：**

```
VS Code   ──HTTP──→  后端 /api/v1/ai/enhance ──→ 第三方 Provider
Browser   ──fetch─→  后端 /api/v1/ai/enhance ──→ 第三方 Provider
Web SPA   ──fetch─→  后端 /api/v1/ai/enhance ──→ 第三方 Provider
IntelliJ  ──HTTP──→  后端 /api/v1/ai/enhance ──→ 第三方 Provider
                          │
                          ├── 提取 IP / UA / 指纹
                          ├── 记录完整请求日志
                          ├── 读取 active provider 配置
                          └── 统计 token / 成本
```

**各端改造要点：**

| 端       | 当前 AI 传输                                   | 改造方案                                         | 改造量 |
| -------- | ---------------------------------------------- | ------------------------------------------------ | ------ |
| VS Code  | `core/api.js` curl → 第三方                    | 改为 HTTP → 后端 `/ai/enhance`                   | 中     |
| Browser  | `browser/shared/api.js` fetch → 第三方         | 改为 fetch → 后端 `/ai/enhance`                  | 中     |
| Web SPA  | `web/app.js` fetch → Nginx `/ep-api/` → 第三方 | 改为 fetch → 后端 `/ai/enhance`，淘汰 `/ep-api/` | 中     |
| IntelliJ | `ApiClient.kt` HTTP → 第三方                   | 改为 HTTP → 后端 `/ai/enhance`                   | 小     |

**客户端需上报的额外字段（新增）：**

```typescript
// 所有端在调用 /ai/enhance 时需附带：
{
  input: string;           // 用户原始输入（已有）
  mode: 'fast' | 'deep';  // 增强模式（已有）
  clientType: string;      // ⭐ 'vscode' | 'browser' | 'web' | 'intellij'
  clientVersion: string;   // ⭐ 客户端版本号
  fingerprint?: string;    // ⭐ 浏览器指纹（Browser/Web 端）
  language?: string;       // 用户语言偏好
}
// IP 和 User-Agent 由后端从 HTTP 请求头自动提取，客户端无需关心
```

**关键收益：**

1. **API Key 不再暴露** — 各端不再持有第三方 Key，`defaults.js` 加密注入机制可废弃
2. **完整请求日志** — 每次增强的指纹/IP/UA/输入/输出全量记录
3. **Provider 热切换** — 管理员切换 provider 后全端立即生效，无需发版
4. **统一限流** — 后端统一 rate limiting，防止滥用
5. **成本可控** — 实时 token 消耗统计和成本分析
6. **消除代码重复** — 4 份传输逻辑简化为 1 个 HTTP 调用

### 7.1 PromptHub (web-hub/) — P0

**改造点：**

1. **新增 API Client 层**：`web-hub/src/lib/api.ts`，封装所有后端请求
2. **新增 Auth Context**：`web-hub/src/app/hooks/useAuth.ts`，管理登录状态
3. **渐进替换**：先用 feature flag 并行 mock/API，逐步迁移
4. **usePromptStore 改造**：
   - 登录用户 → API 持久化，`localStorage` 作为离线缓存
   - 游客 → 保持现有 `localStorage` 行为
5. **新增登录/注册 UI**：Navbar 中添加入口
6. **⭐ SSO 集成**：登录后 refreshToken 写入 `Domain=.zhiz.chat` cookie，用户跳转到 prompt.zhiz.chat 自动登录

**迁移顺序：**

```
Phase 1: Auth + Prompt 列表 API（替换 MOCK_PROMPTS import）
Phase 2: 用户交互 API（like/save/copy/view）
Phase 3: Collections + Achievements API
Phase 4: Trending + Analytics API（替换 seededRandom 假数据）
Phase 5: CreatePrompt 接通真实提交
```

### 7.1.1 关键数据检索策略

> **审查发现**：以下前端功能需要明确的后端实现策略，否则存在"文档定义了端点但实现时无从下手"的风险。

**① Prompt 搜索实现**

前端 `Home` 页支持关键词搜索，`GET /prompts?search=xxx` 需后端全文检索能力：

```sql
-- PostgreSQL 全文搜索方案（推荐，无需额外依赖）
-- 2026-04-07 新增 — 搜索实现策略
-- 设计思路：利用 PG 内置 tsvector + GIN 索引实现中文全文搜索
-- 影响范围：prompts 表查询、prompt.service.ts
-- 潜在风险：中文分词需安装 pg_jieba 或使用 unaccent + 空格分词降级

ALTER TABLE prompts ADD COLUMN search_vector tsvector;
-- 触发器自动维护（insert/update 时重建）
CREATE INDEX idx_prompts_search ON prompts USING GIN(search_vector);

-- 降级方案（无需额外插件）：ILIKE + trigram
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_prompts_title_trgm ON prompts USING GIN(title gin_trgm_ops);
CREATE INDEX idx_prompts_desc_trgm ON prompts USING GIN(description gin_trgm_ops);

-- prompt.service.ts 查询伪代码
function searchPrompts(query: string) {
  // 优先 tsvector 全文搜索
  // 降级为 ILIKE '%query%'（trigram 加速）
  // 支持按 tags 精确匹配 && ARRAY['tag1']
}
```

**② 每日精选逻辑（`GET /prompts/featured`）**

```typescript
// trending.service.ts — 每日精选选取算法
// 2026-04-07 新增 — 定义 featured prompt 的选取策略
// 设计思路：综合热度分 + 时间衰减 + 分类多样性，每日自动刷新
// 影响范围：trending.service.ts, daily_stats cron
// 潜在风险：新 prompt 较少时可能重复推荐，需加去重窗口

function getFeaturedPrompts(count: number = 5): Prompt[] {
  // 热度分 = likes * 3 + copies * 5 + views * 1
  // 时间衰减 = score / (daysSinceCreated + 2)^1.5
  // 分类约束 = 每个分类最多占 featured 的 40%
  // 去重窗口 = 最近 7 天已推荐过的排除
  // 最终取 top N
}
```

**③ Galaxy 页面批量数据**

`Galaxy` 页需加载所有 Prompt 用于 3D 星空可视化，当前 `MOCK_PROMPTS`（40+ 条）直接全量渲染。后端策略：

```
GET /api/v1/prompts/galaxy
  — 返回精简字段版全量数据（仅 id, title, category, likes, views, copies, model, date）
  — 不含 content/description（大字段），减少传输体积
  — 无分页，一次性返回（当前数据量级 <1000 条，压缩后 <100KB）
  — 未来数据量增长时可降级为 top 500 + 随机采样
```

**④ Trending 页面数据（替换 seededRandom 假数据）**

当前 `Trending.tsx` 使用 `seededRandom()` 生成 14 天假趋势图数据和假增长百分比。
迁移后：

- 趋势图数据 → `GET /trending/daily`（读取 `daily_stats` 表，真实数据）
- 统计卡片 → `GET /trending/prompts?metric=likes&period=week` 配合总计计算
- 增长百分比 → 后端 `daily_stats` 对比本周 vs 上周

**⑤ Profile 页面数据（替换 MOCK_PROMPTS 引用）**

当前 `Profile.tsx` 直接引用 `MOCK_PROMPTS` 计算探索覆盖率、分类偏好等。
迁移后：

- 探索覆盖率 → `GET /users/me/stats` 返回 `{ viewedCount, totalPrompts, coverage }`
- 分类偏好 → `GET /users/me/category-stats`（已有端点）
- 高频复制 → `GET /users/me/stats` 含 `topCopied: [{promptId, count}]`
- 已提交 Prompt → `GET /prompts?authorId=me&status=all`

**⑥ 错误处理策略修正**

> 审查发现：§5.2.7 写"PromptHub 使用 Axios 拦截器"，但 web-hub 实际使用原生 `fetch`（无 Axios 依赖）。

web-hub 错误处理策略修正为：

- **fetch wrapper**（`web-hub/src/lib/api.ts`）统一封装 `fetch` 请求
- 响应非 2xx → 解析 `error.code` → 查 `ERROR_MESSAGES` → `sonner` toast 提示
- Token 过期 → 静默调用 `/auth/refresh` → 重试原请求

### 7.2 Web SPA (web/) — P0

- **AI 调用改造**：`web/app.js` 中的 `callApiOnce()` 改为调用后端 `/api/v1/ai/enhance`
- **废弃 Nginx `/ep-api/` 代理**：不再需要 `_proxyUrl()` 机制
- **废弃 `_getBuiltinDefaults()` / `_vault`**：不再需要客户端持有加密 Key
- **上报 clientType/clientVersion**：附加 `{ clientType: 'web', clientVersion: '5.3.7' }` 到请求
- 增强历史自动记录在后端（替代 localStorage 历史）
- **⭐ SSO 集成**：启动时调用 `POST /auth/refresh`（cookie 自动携带），如有效则自动登录；点击登录重定向到 `zhiz.chat/auth/login`（详见 §6.2）

### 7.3 Browser Extension (browser/) — P0

- **AI 调用改造**：`browser/shared/api.js` 中的 `callApi()` 改为 fetch → 后端 `/api/v1/ai/enhance`
- **废弃 `browser/shared/defaults.js`**：不再需要客户端持有加密 Key
- **上报浏览器指纹**：集成 FingerprintJS 或轻量哈希，附加到请求
- **上报 clientType/clientVersion**：`{ clientType: 'browser', clientVersion: '5.3.7' }`
- **设置页简化**：不再需要用户配置 API Host / API Key / API Mode（使用后端统一 provider）
- **保留用户自定义 Provider 选项**：高级用户可选择“使用自定义 Provider”直连（跳过后端）
- **⭐ SSO 集成**：点击登录 → `chrome.tabs.create` 打开 `zhiz.chat/auth/login?callback=extension` → 登录成功后通过 `tabs.onUpdated` + 授权码回调（详见 §6.2）

### 7.4 VS Code (extension.js + core/) — P0

- **AI 调用改造**：`core/api.js` 中的 curl 调用改为 Node.js HTTP → 后端 `/api/v1/ai/enhance`
- **废弃 `core/defaults.js`**：不再需要客户端持有加密 Key
- **上报 clientType/clientVersion**：`{ clientType: 'vscode', clientVersion: '5.3.7' }`
- **设置简化**：VS Code settings 中不再需要 apiHost/apiKey/apiMode（使用后端）
- **保留用户自定义 Provider 选项**：高级用户可在设置中选择“使用自定义 Provider”
- **⭐ SSO 集成**：点击登录 → `vscode.env.openExternal` 打开 `zhiz.chat/auth/login?callback=vscode` → 登录成功后通过 URI Handler 回调（详见 §6.2）

### 7.5 IntelliJ (intellij/) — P0

- **AI 调用改造**：`ApiClient.kt` 改为 HTTP → 后端 `/api/v1/ai/enhance`
- **上报 clientType/clientVersion**：`{ clientType: 'intellij', clientVersion: '5.3.7' }`
- **Settings 简化**：不再需要 API Host / API Key / Model 配置
- **保留用户自定义 Provider 选项**：高级用户可在设置中选择“使用自定义 Provider”
- **⭐ SSO 集成**：点击登录 → `BrowserUtil.browse` 打开 `zhiz.chat/auth/login?callback=localhost&port=N` → 登录成功后通过 localhost 回调（详见 §6.2）

---

## 八、安全设计

| 威胁                 | 对策                                                                         |
| -------------------- | ---------------------------------------------------------------------------- |
| API Key 客户端暴露   | ⭐ **P0** 全端改走后端代理，Key 仅存服务端 `ai_providers` 表（应用层加密）   |
| Provider Key 泄露    | `ai_providers.api_key` 应用层加密存储，API 响应脱敏不返回 Key                |
| AI 请求滥用          | 三维限流：per-IP + per-fingerprint + per-user，匿名配额低于登录用户          |
| Prompt 注入攻击      | 后端 smartRoute 固定 system prompt，用户输入仅作为 user message              |
| JWT 泄露             | 短期 accessToken（15min）+ refresh rotation                                  |
| XSS                  | refreshToken 存 httpOnly cookie；CSP headers                                 |
| CSRF                 | SameSite cookie + CORS 白名单                                                |
| 暴力登录             | Rate limiting（per-IP + per-account）                                        |
| SQL 注入             | Prisma ORM 参数化查询                                                        |
| 输入注入             | Zod schema 前后端双重校验                                                    |
| 敏感数据日志         | Pino 配置 redact 字段（password, token, apiKey）                             |
| 请求日志隐私         | `ai_request_logs` 中 IP 地址定期脱敏/归档，遵守隐私法规                      |
| ⭐ 恶意用户滥用      | `blacklist_rules` 多维封禁（账号/IP/指纹/IP段）+ 限时/永久 + 自动过期        |
| ⭐ 封禁绕过          | 三维交叉检查（IP+指纹+账号同时匹配），难以单一维度绕过                       |
| ⭐ 跨域 Cookie 劫持  | refreshToken cookie: httpOnly + Secure + SameSite=Lax + Domain=.zhiz.chat    |
| ⭐ SSO Token 泄露    | Cookie path 限制为 `/api/v1/auth`，减少不必要传输；Refresh Rotation 每次续签 |
| ⭐ 自动化脚本刷量    | fail2ban 渐进式封禁（5min→30min→1h→6h→1d→7d→永久），阶梯不可逆               |
| ⭐ 限流绕过（换 IP） | 多维度交叉限流（IP + fingerprint + user），单换 IP 仍被指纹拦截              |
| ⭐ SSO 授权码劫持    | code 一次性使用 + 60 秒过期 + state CSRF 验证 + HTTPS 传输                   |
| ⭐ SSO 开放重定向    | redirect URL 白名单校验，仅允许 `*.zhiz.chat`（详见 §6.3.1①）                |
| ⭐ SSO 并发登录竞态  | 各端强制单一登录流程，新请求取消旧的 pending state（详见 §6.3.1④）           |
| ⭐ SSO 超时悬挂      | 各端设置 3-5 分钟超时自动清理 state 和监听器（详见 §6.3.1③）                 |

---

## 八(B)、日志体系设计

> 2026-04-08 新增 — 深度审查补全后端日志策略
> 设计思路：后端日志分两层——应用运行日志（Pino 结构化 JSON，stdout/文件）和业务审计日志（DB `ai_request_logs` 表）。
> AI 增强请求是核心业务链路，必须做到**全链路可追踪、每条请求可回溯到具体客户端**。
> 影响范围：所有中间件、service 层、cron 任务
> 潜在风险：日志量大时磁盘/存储膨胀，需配合 logrotate + DB 分区归档

### 8B.1 结构化日志规范（Pino）

所有应用日志使用 Pino JSON 格式输出，**每条日志必须包含以下字段**：

```typescript
// src/lib/logger.ts — Pino 日志配置
// 2026-04-08 新增 — 全局结构化日志
// 设计思路：统一字段命名，便于 ELK/Loki 等日志系统索引和聚合
// 影响范围：全局
// 潜在风险：无已知风险

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // 敏感字段脱敏（永远不打印到日志）
  redact: [
    'req.headers.authorization',
    'req.headers.cookie',
    'password',
    'apiKey',
    'token',
    'refreshToken',
    'accessToken',
  ],
  // 自定义序列化：为每条日志注入 service 标识
  base: { service: 'easy-prompt-api', env: process.env.NODE_ENV },
  // 格式化时间为 ISO 8601
  timestamp: pino.stdTimeFunctions.isoTime,
});
```

**日志字段标准结构（每条日志 JSON 行）：**

| 字段            | 类型    | 说明                            | 示例                                                  |
| --------------- | ------- | ------------------------------- | ----------------------------------------------------- |
| `level`         | number  | Pino 日志级别                   | 30 (info)                                             |
| `time`          | string  | ISO 8601 时间戳                 | `2026-04-08T12:34:56.789Z`                            |
| `service`       | string  | 服务名（固定）                  | `easy-prompt-api`                                     |
| `requestId`     | string  | 请求追踪 ID（UUID，全链路唯一） | `a1b2c3d4-...`                                        |
| `clientType`    | string  | 发起请求的客户端类型            | `vscode` / `browser` / `web` / `intellij` / `web-hub` |
| `clientVersion` | string  | 客户端版本号                    | `5.3.7`                                               |
| `userId`        | string? | 已认证用户 ID（匿名为 null）    | `uuid` / `null`                                       |
| `ip`            | string  | 客户端 IP                       | `1.2.3.4`                                             |
| `method`        | string  | HTTP 方法                       | `POST`                                                |
| `path`          | string  | 请求路径                        | `/api/v1/ai/enhance`                                  |
| `statusCode`    | number  | 响应状态码                      | 200                                                   |
| `durationMs`    | number  | 请求处理耗时（毫秒）            | 1234                                                  |
| `msg`           | string  | 人类可读日志消息                | `AI enhance completed`                                |

### 8B.2 请求级日志中间件

**每个 HTTP 请求自动注入 requestId + clientType，贯穿整个处理链路：**

```typescript
// src/middleware/request-logger.ts
// 2026-04-08 新增 — 请求级日志中间件
// 设计思路：在请求入口生成 requestId，注入 clientType/clientVersion（从请求头提取），
//   所有后续 service 调用共享同一 requestId，实现全链路追踪
// 影响范围：所有路由
// 潜在风险：无已知风险

import { randomUUID } from 'crypto';
import { logger } from '../lib/logger';

export function requestLogger(req, res, next) {
  const requestId = req.headers['x-request-id'] || randomUUID();
  const clientType = req.headers['x-client-type'] || 'unknown';
  const clientVersion = req.headers['x-client-version'] || 'unknown';

  // 注入到 req 对象，后续 service 层可访问
  req.requestId = requestId;
  req.clientType = clientType;
  req.clientVersion = clientVersion;

  // 创建子 logger（自动携带 requestId + clientType）
  req.log = logger.child({ requestId, clientType, clientVersion });

  const startTime = Date.now();

  // 响应完成时打印请求摘要日志
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const logData = {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      userId: req.user?.id || null,
      ip: req.ip,
    };

    if (res.statusCode >= 500) {
      req.log.error(logData, 'Request failed');
    } else if (res.statusCode >= 400) {
      req.log.warn(logData, 'Request rejected');
    } else {
      req.log.info(logData, 'Request completed');
    }
  });

  // 设置响应头，便于客户端关联日志
  res.setHeader('X-Request-Id', requestId);
  next();
}
```

**各端客户端必须发送的请求头：**

| 请求头             | 来源                           | 示例                                                  |
| ------------------ | ------------------------------ | ----------------------------------------------------- |
| `X-Client-Type`    | 客户端硬编码                   | `vscode` / `browser` / `web` / `intellij` / `web-hub` |
| `X-Client-Version` | 客户端版本号                   | `5.3.7`                                               |
| `X-Fingerprint`    | 浏览器指纹（Browser/Web 端）   | `a1b2c3d4e5f6...`                                     |
| `Authorization`    | Bearer accessToken（登录用户） | `Bearer eyJ...`                                       |

> **CORS 已配置允许这些自定义 Header**（详见 §9.2 Nginx `Access-Control-Allow-Headers`）。

### 8B.3 AI 增强请求专项日志

AI 增强请求（`POST /ai/enhance`）是核心链路，需要**比普通请求更详细**的日志：

```typescript
// ai-gateway.service.ts — 增强请求日志（示例）
// 2026-04-08 新增 — AI 请求全链路日志
// 设计思路：每次增强请求记录 4 个关键节点，便于排障和性能分析
// 影响范围：ai-gateway.service.ts
// 潜在风险：大量 debug 日志会增加 IO，生产环境建议 level=info

async function enhance(req: Request): Promise<EnhanceResponse> {
  const { log, requestId, clientType, clientVersion } = req;

  // ① 请求接收 — 记录完整入参（脱敏后）
  log.info(
    {
      phase: 'enhance:received',
      input: truncate(req.body.input, 200), // 截断防日志膨胀
      mode: req.body.mode,
      fingerprint: req.body.fingerprint?.slice(0, 8) + '...', // 脱敏
    },
    `AI enhance request from ${clientType}@${clientVersion}`,
  );

  // ② 路由完成 — 记录 smartRoute 结果
  const routerResult = await smartRoute(req.body.input);
  log.info(
    {
      phase: 'enhance:routed',
      scenes: routerResult.scenes,
      composite: routerResult.composite,
      routerDurationMs: routerResult.durationMs,
    },
    `Routed to ${routerResult.scenes.length} scenes`,
  );

  // ③ Provider 调用 — 记录 provider 选择和模型
  const provider = await getActiveProvider();
  log.info(
    {
      phase: 'enhance:calling_provider',
      providerSlug: provider.slug,
      model: provider.defaultModel,
      apiMode: provider.apiMode,
    },
    `Calling provider ${provider.slug}`,
  );

  // ④ 完成/失败 — 记录结果摘要 + token 用量
  try {
    const result = await callProvider(provider, routerResult, req.body);
    log.info(
      {
        phase: 'enhance:completed',
        durationMs: result.totalDurationMs,
        routerDurationMs: result.routerDurationMs,
        genDurationMs: result.genDurationMs,
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
        totalTokens: result.usage?.totalTokens,
        estimatedCost: result.estimatedCost,
        outputLength: result.output?.length,
      },
      `AI enhance completed in ${result.totalDurationMs}ms`,
    );
    return result;
  } catch (err) {
    log.error(
      {
        phase: 'enhance:failed',
        errorCode: err.code,
        errorMessage: err.message,
        retryCount: err.retryCount || 0,
        providerSlug: provider.slug,
      },
      `AI enhance failed: ${err.message}`,
    );
    throw err;
  }
}
```

**日志级别与输出策略：**

| 级别    | 场景                                                       | 生产环境输出 |
| ------- | ---------------------------------------------------------- | ------------ |
| `fatal` | 进程无法启动（DB 连接失败、端口占用）                      | ✅ 必须      |
| `error` | AI 请求失败、Provider 超时、未捕获异常                     | ✅ 必须      |
| `warn`  | 限流触发、黑名单命中(warn 级)、慢请求(>5s)、认证失败       | ✅ 必须      |
| `info`  | 请求完成摘要、AI 增强 4 阶段节点、Provider 切换、cron 执行 | ✅ 必须      |
| `debug` | 完整 SQL 查询、AI 原始响应体、中间件链详情                 | ❌ 仅开发    |
| `trace` | 逐行执行追踪                                               | ❌ 仅调试    |

### 8B.4 审计日志（管理员操作）

所有管理员操作必须记录审计日志，不可删除：

| 操作                         | 日志级别 | 记录内容                                          |
| ---------------------------- | -------- | ------------------------------------------------- |
| Provider 新增/修改/删除/激活 | `info`   | `{ action, adminId, providerId, changes }`        |
| 黑名单规则增删改             | `info`   | `{ action, adminId, ruleId, type, value }`        |
| Prompt 审核通过/拒绝         | `info`   | `{ action, adminId, promptId, decision, reason }` |
| 用户封禁/解封                | `warn`   | `{ action, adminId, targetUserId, reason }`       |

### 8B.5 日志轮转与归档

| 层级                                | 策略                                  | 工具                        |
| ----------------------------------- | ------------------------------------- | --------------------------- |
| **应用日志** (stdout JSON)          | PM2 日志轮转：单文件 50MB，保留 30 天 | `pm2-logrotate`             |
| **DB 请求日志** (`ai_request_logs`) | 按月分区，90 天后归档到冷存储         | PostgreSQL PARTITION + cron |
| **Nginx access_log**                | 按天轮转，保留 90 天                  | `logrotate`                 |

### 8B.6 客户端 requestId 关联

后端返回的 `X-Request-Id` 响应头和 `EnhanceResponse.requestId` 字段，各端应保存并在以下场景使用：

- **错误上报**：客户端捕获到 API 错误时，将 `requestId` 附在用户可见的错误消息中，便于用户反馈时快速定位后端日志
- **历史记录**：将 `requestId` 存入本地增强历史，管理员可通过 `GET /analytics/requests/:id` 查看完整上下文
- **性能监控**：客户端可记录从发起请求到收到响应的端到端耗时，与后端 `durationMs` 对比分析网络延迟

---

## 八(C)、定时任务（Cron Jobs）集中配置

> 以下为所有后端定时任务的统一配置清单。

| 任务 ID                 | 调度频率   | 说明                                                                            | 依赖       |
| ----------------------- | ---------- | ------------------------------------------------------------------------------- | ---------- |
| `daily-stats-aggregate` | 每日 00:05 | 聚合前一天 PromptHub + AI 请求统计写入 `daily_stats` 表（含按端分拆，详见 §8B） | PostgreSQL |
| `rate-decay`            | 每日 03:00 | 扫描 `rate_violations`，连续 N 天无违规 → `current_level` 减 1                  | PostgreSQL |
| `blacklist-cleanup`     | 每日 04:00 | 清理已过期且 `is_active=false` 的封禁规则（保留 90 天历史）                     | PostgreSQL |
| `blacklist-cache-sync`  | 每 5 分钟  | 将活跃封禁规则同步到 Redis Set（防 Redis 与 DB 漂移）                           | Redis + PG |
| `ai-logs-archive`       | 每月 1 日  | 归档 90 天前的 `ai_request_logs` 到冷存储/分区表                                | PostgreSQL |
| `featured-refresh`      | 每日 06:00 | 刷新每日精选 Prompt 缓存（算法详见 §7.1.1②）                                    | Redis + PG |

**实现方式**：使用 `node-cron` 或 PM2 cron 配置（单实例场景），生产环境可迁移到系统 crontab。

```typescript
// src/cron/index.ts — 定时任务注册
// 2026-04-07 新增 — 集中管理所有定时任务
// 设计思路：应用启动时注册所有 cron job，日志通过 Pino 记录
// 影响范围：daily_stats, rate_violations, blacklist_rules, ai_request_logs
// 潜在风险：单实例部署下无竞争问题；多实例需加分布式锁（Redis SETNX）

import cron from 'node-cron';

cron.schedule('5 0 * * *', aggregateDailyStats);
cron.schedule('0 3 * * *', decayRateViolations);
cron.schedule('0 4 * * *', cleanupExpiredBlacklist);
cron.schedule('*/5 * * * *', syncBlacklistCache);
cron.schedule('0 0 1 * *', archiveOldAiLogs);
cron.schedule('0 6 * * *', refreshFeaturedPrompts);
```

---

## 九、部署方案

### 9.1 单 VPS 部署拓扑

```
                    ┌──────────────────────────────────────────┐
                    │           VPS (107.151.137.198)            │
                    │                                            │
  Internet ────────→│  Nginx (443/80)                            │
                    │    ├── zhiz.chat → /www/.../web-hub/       │ (PromptHub 静态)
                    │    ├── zhiz.chat/api/* → localhost:3000    │ (后端 API 反代)
                    │    ├── prompt.zhiz.chat → /www/.../web/    │ (Web SPA 静态)
                    │    ├── prompt.zhiz.chat/api/* → :3000      │ (Web 端也走后端)
                    │    └── api.zhiz.chat/* → localhost:3000    │ (⭐ 全端统一 API)
                    │                                            │
                    │  Node.js Backend (port 3000)               │
                    │    ├── /api/v1/ai/enhance → 第三方 Provider │ (⭐ AI 代理网关)
                    │    ├── /api/v1/providers → ai_providers 表  │ (⭐ Provider 管理)
                    │    ├── /api/v1/analytics → ai_request_logs  │ (⭐ 请求分析)
                    │    ├── /api/v1/blacklist → blacklist_rules  │ (⭐ 黑名单管理)
                    │    └── Prisma → PostgreSQL (5432)           │
                    │                                            │
                    │  PostgreSQL 16                              │
                    │  Redis (可选, port 6379)                    │
                    └──────────────────────────────────────────┘

# ─── zhiz.chat (PromptHub) 后端 API 反向代理 ───
server {
    server_name zhiz.chat;
    # ...existing static file config...

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # ⭐ SSO：后端 Set-Cookie Domain=.zhiz.chat，Nginx 直接透传
        # 浏览器会自动将 ep_refresh cookie 发送到所有 *.zhiz.chat 子域
    }
}

# ─── prompt.zhiz.chat (Web SPA) 也需要访问后端 ───
server {
    server_name prompt.zhiz.chat;
    # ...existing static file config...

    # ⭐ 新增：Web SPA 的 AI 请求 + SSO 认证走后端
    # SSO：ep_refresh cookie (Domain=.zhiz.chat) 浏览器自动携带
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 旧 AI 代理（迁移完成后废弃）
    location /ep-api/ { ... }
}

# ─── api.zhiz.chat (全端统一 API 入口) ───
# 用于 VS Code / IntelliJ / Browser 等非 Web 端
server {
    server_name api.zhiz.chat;
    # SSL config...

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # CORS：允许浏览器扩展和各端跨域调用
        add_header Access-Control-Allow-Origin $http_origin always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Client-Type, X-Client-Version, X-Fingerprint" always;
        add_header Access-Control-Allow-Credentials true always;

        if ($request_method = OPTIONS) {
            return 204;
        }
    }
}
```

### 9.3 进程管理

使用 PM2 管理后端进程：

```bash
pm2 start backend/dist/index.js --name easy-prompt-api
pm2 save
pm2 startup
```

### 9.4 deploy.sh 集成

在现有 `deploy/deploy.sh` 中新增 `backend` target：

```bash
# deploy.sh 新增
deploy_backend() {
  cd backend
  npm ci
  npx prisma migrate deploy
  npm run build
  scp -r dist/ $VPS_HOST:/path/to/backend/
  ssh $VPS_HOST "cd /path/to/backend && pm2 restart easy-prompt-api"
}
```

---

## 十、开发路线图

### Phase 1 — 基础骨架 + AI 代理网关（2 周）⭐ P0

- [x] 架构设计文档（本文档）
- [ ] 项目初始化（package.json, tsconfig, Prisma 配置）
- [ ] 数据库 schema 定义 + 首次迁移（含 `ai_providers` + `ai_request_logs` + `blacklist_rules` + `rate_violations` + `categories` + `models` 表）
- [ ] 种子数据脚本（从 MOCK_PROMPTS/COLLECTIONS/ACHIEVEMENTS/CATEGORY_CONFIG/MODEL_CONFIG 导入）
- [ ] Auth 模块（register/login/refresh/me）
  - [ ] ⭐ 跨域 SSO：refreshToken cookie `Domain=.zhiz.chat`，zhiz.chat ↔ prompt.zhiz.chat 自动共享
  - [ ] refresh 端点同时支持 Cookie 方式（Web）和 Body 方式（桌面端/插件）
- [ ] ⭐ **统一错误码体系**（`shared/error-codes.ts` + `shared/error-messages.ts` + `utils/app-error.ts`）
  - [ ] 错误码常量注册表（9 大分类 40+ 错误码）
  - [ ] `AppError` 类 + `errorHandler` 中间件（Zod/未知异常统一转换）
  - [ ] 前端 i18n 映射表（zh/en 双语 + 建议操作）
  - [ ] 各端接入：统一 `handleApiError()` 拦截器
- [ ] ⭐ **黑名单 + 渐进式限流系统**（`blacklist.service.ts` + `rate-limiter.service.ts` + 中间件）
  - [ ] `blacklist_rules` 表 CRUD（type: user / ip / fingerprint / ip_range）
  - [ ] `rate_violations` 表（违规历史 + 阶梯升级驱动）
  - [ ] 全局拦截中间件（请求链最前端，优先 Redis 缓存）
  - [ ] severity 三级：block / throttle / warn
  - [ ] 限时封禁自动过期 + 手动停用/启用
  - [ ] ⭐ **fail2ban 渐进式限流**（`rateLimiter.ts` 中间件 + `rate-limiter.service.ts`）
    - [ ] Redis 滑动窗口检测（默认 60s / 10 次）
    - [ ] 超阈值 → 自动创建 blacklist_rules（source='auto'）
    - [ ] 7 级阶梯：5min → 30min → 1h → 6h → 1d → 7d → 永久
    - [ ] 违规等级衰减 cron（默认 30 天无违规降 1 级）
    - [ ] 429 响应含 banLevel / retryAfter / violationCount
- [ ] ⭐ **AI 代理网关核心**（`ai-gateway.service.ts`）
  - [ ] smartRoute 服务端执行（移植 `core/composer.js` + `core/router.js`）
  - [ ] 多协议适配器（openai / openai-responses / claude / gemini）
  - [ ] Provider 配置从 `ai_providers` 表读取
  - [ ] 请求重试 + 错误归一化
- [ ] ⭐ **Provider 管理**（`provider.service.ts`）
  - [ ] Provider CRUD API
  - [ ] 激活/切换机制（全局唯一 active）
  - [ ] 连通性测试接口
  - [ ] 种子数据：导入当前默认 provider (vpsairobot)
- [ ] **健康检查端点**（`health.ts`）
  - [ ] `GET /health` — 存活检查（uptime, version）
  - [ ] `GET /health/ready` — 就绪检查（DB + Redis 连通性）
- [ ] **元数据 API**（`meta.ts`）
  - [ ] `GET /meta/categories` — 分类元数据（替代前端硬编码 `CATEGORY_CONFIG`）
  - [ ] `GET /meta/models` — 模型元数据（替代前端硬编码 `MODEL_CONFIG`）
  - [ ] 管理员 CRUD 接口（POST/PUT）

### Phase 2 — 请求分析 + 全端接入（2 周）⭐ P0

- [ ] ⭐ **请求分析系统**（`ai-analytics.service.ts`）
  - [ ] `fingerprint` 中间件：IP / UA / 指纹提取
  - [ ] `ai_request_logs` 异步写入（不阻塞主请求）
  - [ ] `daily_stats` 每日聚合（cron job）
  - [ ] 分析查询 API（summary / daily / by-client / by-scene / cost）
- [ ] ⭐ **全端 AI 调用改造**
  - [ ] Web SPA (`web/app.js`)：改为 fetch → 后端 `/ai/enhance`
  - [ ] Browser (`browser/shared/api.js`)：改为 fetch → 后端 `/ai/enhance`
  - [ ] VS Code (`core/api.js`)：改为 HTTP → 后端 `/ai/enhance`
  - [ ] IntelliJ (`ApiClient.kt`)：改为 HTTP → 后端 `/ai/enhance`
- [ ] 渐进式限流与 Analytics 深度联动（异常检测 → 自动封禁 → 管理员复核闭环）
- [ ] GeoIP 解析（IP → 国家/地区）
- [ ] 违规等级衰减 cron job（每日扫描 rate_violations，30 天无违规降级）

### Phase 3 — PromptHub 数据层（1-2 周）

- [ ] Prompt CRUD + 列表分页/搜索/筛选
- [ ] Like/Save/Copy/View 交互 API
- [ ] 计数器原子更新（避免竞态）
- [ ] Collections API
- [ ] 成就系统服务端逻辑
- [ ] 用户统计/收藏列表 API
- [ ] `GET /users/me/prompts` — 我提交的 Prompt 列表（Profile 页用）
- [ ] `POST /users/me/visit-category` — 记录用户访问分类（成就系统用）

### Phase 4 — 内容管理 + Trending（1 周）

- [ ] Trending/排行榜 API（真实数据，替换 `seededRandom` 假数据）
- [ ] 每日趋势统计（PromptHub 维度，复用 daily_stats cron）
- [ ] 每日精选算法实现（热度+时间衰减+分类多样性，详见 §7.1.1②）
- [ ] Prompt 提交审核流程
- [ ] **管理员审核 API**（`/api/v1/admin/prompts`）
  - [ ] `GET /` — 待审核列表
  - [ ] `POST /:id/approve` — 审核通过
  - [ ] `POST /:id/reject` — 审核拒绝（附 reason）
- [ ] **Prompt 搜索**（PostgreSQL 全文搜索 / trigram 降级，详见 §7.1.1①）
- [ ] Galaxy 精简全量端点 `GET /prompts/galaxy`（详见 §7.1.1③）

### Phase 5 — web-hub 前端对接（1-2 周）

- [ ] web-hub fetch wrapper API Client 层（`lib/api.ts`，非 Axios）
- [ ] Auth Context + 登录/注册 UI + SSO 集成
- [ ] 渐进替换 mock 数据为 API 调用（含 CATEGORY_CONFIG/MODEL_CONFIG → `/meta/*` API）
- [ ] usePromptStore 改造（API 权威 + localStorage 离线缓存 + 写操作同步策略）
- [ ] 前端降级策略（API 不可用时显示"离线模式" + 缓存数据只读）
- [ ] Trending 页对接（替换 `seededRandom` 为 `/trending/daily` 真实数据）
- [ ] Profile 页对接（替换 `MOCK_PROMPTS` 引用为 `/users/me/stats` + `/me/category-stats`）

### Phase 6 — 跨端增强 + 管理后台（P2）

- [ ] 增强历史跨端同步
- [ ] 用户偏好设置同步
- [ ] ⭐ 管理后台（Provider 管理 UI + 请求分析仪表盘）
- [ ] 场景数据服务（单一数据源，替代 3 份拷贝）
- [ ] 流式增强（SSE）
- [ ] 评论/社区功能

---

## 十一、数据迁移策略

### 11.1 种子数据脚本

```typescript
// prisma/seed.ts
import { MOCK_PROMPTS } from '../../web-hub/src/app/data/prompts';
import { COLLECTIONS } from '../../web-hub/src/app/data/collections';
import { ACHIEVEMENTS } from '../../web-hub/src/app/data/achievements';

async function seed() {
  // 1. 创建系统用户（mock 数据中的 author）
  const systemUser = await prisma.user.create({
    data: { email: 'system@zhiz.chat', username: 'system', displayName: 'PromptHub', ... }
  });

  // 2. 导入 prompts
  for (const p of MOCK_PROMPTS) {
    await prisma.prompt.create({
      data: {
        title: p.title,
        description: p.description,
        content: p.content,
        tags: p.tags,
        category: p.category,
        model: p.model,
        authorId: systemUser.id,
        likesCount: p.likes,
        viewsCount: p.views,
        copiesCount: p.copies,
        createdAt: new Date(p.date),
      }
    });
  }

  // 3. 导入 achievements（含 color 字段）
  for (const a of ACHIEVEMENTS) {
    await prisma.achievement.create({
      data: {
        id: a.id,
        title: a.title,
        description: a.description,
        icon: a.icon,
        color: a.color,
        category: a.category,
        rarity: a.rarity,
        // conditionType / conditionValue 由业务逻辑定义，种子脚本可从映射表补充
      }
    });
  }

  // 4. 导入 collections（需先完成 prompts 导入，建立 oldId → newUUID 映射）
  const promptIdMap = new Map<string, string>(); // 在步骤 2 中填充
  for (const c of COLLECTIONS) {
    const collection = await prisma.collection.create({
      data: {
        title: c.title,
        description: c.description,
        icon: c.icon,
        gradientFrom: c.gradientFrom,
        gradientTo: c.gradientTo,
        tags: c.tags,
        difficulty: c.difficulty,
        estimatedTime: c.estimatedTime,
        createdBy: systemUser.id,
        savedCount: c.savedCount,
      }
    });
    // 关联 collection ↔ prompts
    for (let i = 0; i < c.promptIds.length; i++) {
      const newPromptId = promptIdMap.get(c.promptIds[i]);
      if (newPromptId) {
        await prisma.collectionPrompt.create({
          data: { collectionId: collection.id, promptId: newPromptId, position: i }
        });
      }
    }
  }

  // 5. 导入分类元数据（从 CATEGORY_CONFIG + CATEGORY_BASE 合并生成）
  import { CATEGORY_CONFIG, MODEL_CONFIG } from '../../web-hub/src/app/data/constants';
  // CATEGORY_BASE 中的 icon（Lucide 图标名）+ nameEn 需要合并
  const ICON_MAP: Record<string, string> = {
    writing: 'PenTool', coding: 'Code2', marketing: 'Megaphone', art: 'Image',
    productivity: 'Zap', education: 'GraduationCap', business: 'BarChart2', life: 'Heart',
  };
  for (const [slug, cfg] of Object.entries(CATEGORY_CONFIG)) {
    await prisma.category.create({
      data: { slug, label: cfg.label, emoji: cfg.emoji, icon: ICON_MAP[slug],
              color: cfg.color, bgColor: cfg.bg, darkBgColor: cfg.darkBg, darkColor: cfg.darkColor }
    });
  }

  // 6. 导入模型元数据（从 MODEL_CONFIG 生成）
  for (const [slug, cfg] of Object.entries(MODEL_CONFIG)) {
    await prisma.model.create({
      data: { slug, label: cfg.label, color: cfg.color }
    });
  }

  // 7. 导入默认 AI Provider
  await prisma.aiProvider.create({
    data: {
      name: 'VPS AI Robot',
      slug: 'vpsairobot',
      apiMode: 'openai',
      baseUrl: 'https://vpsairobot.com/v1',
      apiKey: encrypt(process.env.AI_DEFAULT_API_KEY), // 应用层加密
      defaultModel: 'gpt-5.4',
      models: ['gpt-5.4', 'gpt-5.3', 'gpt-4.1'],
      isActive: true,  // 设为默认激活
      priority: 0,
      maxRpm: 60,
      maxTokens: 4096,
      timeoutMs: 30000,
      notes: '初始默认 provider，从 deploy/providers/vpsairobot.json 迁移'
    }
  });
}
```

### 11.2 ID 映射

Mock 数据使用简单数字 ID（'1', '2', ...），数据库使用 UUID。需要：

1. 种子脚本维护 `oldId → newUUID` 映射表
2. `collection_prompts` 引用需通过映射转换
3. 前端迁移期间支持两种 ID 格式（feature flag）

---

## 十二、共享类型定义

为避免前后端类型不一致，建议将核心类型提取为共享模块：

```
backend/src/shared/types.ts  ←  web-hub 通过 TypeScript path alias 或 npm workspace 引用
```

```typescript
// shared/types.ts — 前后端共享
export interface Prompt {
  id: string;
  title: string;
  description: string;
  content: string;
  tags: string[];
  category: string;
  likes: number;
  views: number;
  copies: number;
  author: UserBrief;
  date: string;
  model?: string;
  // 登录用户额外字段
  isLiked?: boolean;
  isSaved?: boolean;
}

export interface UserBrief {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export interface Collection {
  id: string;
  title: string;
  description: string;
  icon: string;
  gradientFrom: string;
  gradientTo: string;
  prompts: Prompt[]; // 详情接口展开，列表接口可返回 promptIds: string[]
  tags: string[];
  savedCount: number;
  difficulty: '入门' | '进阶' | '专业';
  estimatedTime: string;
  createdBy?: UserBrief;
  // 登录用户额外字段
  isSaved?: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string; // 主题色，用于徽章渲染和 confetti 特效
  category: 'explorer' | 'collector' | 'creator' | 'social' | 'power';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  conditionType?: string; // 达成条件类型（前端可选显示进度）
  conditionValue?: number; // 达成阈值
}

// 元数据共享类型（对应前端 constants.ts）

export interface CategoryMeta {
  slug: string; // 'coding', 'writing' 等
  label: string; // 中文显示名
  labelEn?: string; // 英文显示名
  emoji: string; // 分类 emoji
  icon?: string; // Lucide 图标名（如 'Code2', 'PenTool'），Sidebar 导航用
  color: string; // 主题色
  bgColor: string; // 浅色背景
  darkBgColor?: string; // 暗色背景
  darkColor?: string; // 暗色主题色
}

export interface ModelMeta {
  slug: string; // 'gpt4', 'claude' 等
  label: string; // 显示名 'GPT-4'
  color: string; // 主题色
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// AI 代理网关共享类型

export interface EnhanceRequest {
  input: string; // 用户原始输入
  mode: 'fast' | 'deep'; // 增强模式
  clientType: 'vscode' | 'browser' | 'web' | 'intellij'; // 客户端标识
  clientVersion: string; // 客户端版本号
  fingerprint?: string; // 浏览器指纹哈希（Browser/Web 端）
  language?: string; // 用户语言偏好
}

export interface EnhanceResponse {
  result: string; // AI 增强结果
  scenes: string[]; // 识别到的场景 ID
  composite: boolean; // 是否复合场景
  requestId: string; // 请求跟踪 ID
}

export interface ProviderInfo {
  id: string;
  name: string;
  slug: string;
  apiMode: string;
  defaultModel: string;
  models: string[];
  isActive: boolean;
  maxRpm: number;
  // 注意：apiKey 和 baseUrl 不返回给前端（脱敏）
}

export interface AnalyticsSummary {
  period: string;
  totalRequests: number;
  successRate: number;
  totalTokens: number;
  estimatedCost: number;
  uniqueUsers: number;
  uniqueIPs: number;
  avgDurationMs: number;
  topScenes: { sceneId: string; count: number }[];
  // ── 按端分拆统计（详见 §8B 日志体系 + daily_stats 表）──
  clientDistribution: {
    vscode: number;
    browser: number;
    web: number;
    intellij: number;
    webhub: number;
    unknown: number; // 未发送 X-Client-Type 的请求
  };
  // ── 按操作系统分拆（从 User-Agent 解析）──
  platformDistribution: {
    macos: number;
    windows: number;
    linux: number;
    unknown: number;
  };
}

// 黑名单共享类型

export interface BlacklistRule {
  id: string;
  type: 'user' | 'ip' | 'fingerprint' | 'ip_range'; // 封禁维度
  value: string; // 具体值
  reason: string; // 封禁原因
  severity: 'block' | 'throttle' | 'warn'; // 封禁级别
  expiresAt: string | null; // 过期时间（null=永久）
  isActive: boolean;
  hitCount: number; // 命中次数
  lastHitAt: string | null;
  createdAt: string;
}

export interface BlacklistCheckResult {
  blocked: boolean;
  rule?: BlacklistRule; // 命中的规则（如有）
  severity?: string;
}

// 渐进式限流共享类型

/** 封禁阶梯配置（7 级） */
export const BAN_LADDER = [
  { level: 1, duration: 5 * 60 }, // 5 分钟
  { level: 2, duration: 30 * 60 }, // 30 分钟
  { level: 3, duration: 60 * 60 }, // 1 小时
  { level: 4, duration: 6 * 60 * 60 }, // 6 小时
  { level: 5, duration: 24 * 60 * 60 }, // 1 天
  { level: 6, duration: 7 * 24 * 60 * 60 }, // 7 天
  { level: 7, duration: Infinity }, // 永久
] as const;

export interface RateViolation {
  id: string;
  entityType: 'ip' | 'fingerprint' | 'user';
  entityValue: string;
  violationCount: number; // 累计违规次数
  currentLevel: number; // 当前阶梯等级（1-7）
  lastWindowHits: number; // 最近违规时窗口内请求数
  lastThreshold: number; // 触发阈值
  lastViolationAt: string;
  activeRuleId: string | null; // 关联的 blacklist_rules.id
  lastUnbanAt: string | null;
  createdAt: string;
}

export interface RateLimitError {
  code: 'RATE_LIMITED';
  message: string;
  details: {
    banLevel: number; // 当前封禁等级
    banDuration: string; // 封禁时长（如 "30m", "6h", "永久"）
    retryAfter: number; // 秒数（永久封禁时为 -1）
    violationCount: number; // 累计违规次数
    dimension: string; // 触发维度（ip / fingerprint / user）
    expiresAt: string | null; // 解封时间（永久封禁时为 null）
  };
}

// 统一错误码共享类型（详见 §5.2）

/** 后端所有错误响应的标准结构 */
export interface ApiErrorResponse {
  error: {
    code: string; // 机器可读错误码（如 AUTH_TOKEN_EXPIRED）
    message: string; // 开发者调试信息（英文）
    details?: Record<string, any>; // 结构化附加信息
    httpStatus: number; // HTTP 状态码
    timestamp: string; // ISO 8601
    requestId?: string; // 请求追踪 ID
  };
}

/** 错误码分类前缀枚举 */
export type ErrorCategory =
  | 'AUTH'
  | 'VALIDATION'
  | 'RATE'
  | 'BLACKLIST'
  | 'AI'
  | 'PROVIDER'
  | 'RESOURCE'
  | 'PERMISSION'
  | 'SYSTEM';

/** 前端 i18n 错误消息条目 */
export interface ErrorMessageEntry {
  zh: string;
  en: string;
  action?: { zh: string; en: string };
}
```

> **注**：完整错误码清单、i18n 映射表、`AppError` 工具类和 `errorHandler` 中间件
> 详见 [§5.2 统一错误码体系](#52-统一错误码体系)。

---

## 十三、风险与注意事项

| 风险                       | 缓解措施                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 单 VPS 单点故障            | P0 阶段可接受；后续可迁移到容器化部署                                                                         |
| 数据库备份                 | 配置 PostgreSQL 自动备份（pg_dump cron）                                                                      |
| 流量增长                   | Redis 缓存热点数据；后端无状态，可水平扩展                                                                    |
| 现有前端破坏               | 渐进式迁移，feature flag 切换，mock 数据作为 fallback                                                         |
| OAuth 集成复杂度           | 首期仅做邮箱注册，OAuth 放 P1                                                                                 |
| IntelliJ 端 Kotlin 对接    | 标准 REST API，Kotlin HTTP client 对接无障碍                                                                  |
| ⭐ AI 代理单点瓶颈         | 后端无状态可水平扩展；Provider fallback 链自动切换                                                            |
| ⭐ 第三方 Provider 宕机    | `ai_providers` 支持多个 provider + priority 排序，可自动 fallback                                             |
| ⭐ 请求日志存储膨胀        | `ai_request_logs` 按月分区，90 天后归档/清理                                                                  |
| ⭐ Provider Key 轮换       | 更新 `ai_providers` 表即可，无需重启服务或发版                                                                |
| ⭐ 全端迁移过渡期          | 各端保留「自定义 Provider」选项，用户可选择直连或走后端                                                       |
| ⭐ 黑名单规则膨胀          | Redis Set 缓存活跃规则，过期规则定期清理；CIDR 合并减少冗余条目                                               |
| ⭐ 封禁误伤正常用户        | severity=warn 观察期机制；管理员可一键停用/删除规则；命中统计可追溯                                           |
| ⭐ 跨域 Cookie 兼容性      | Safari ITP 可能限制第三方 cookie；同站（.zhiz.chat）属第一方，不受影响                                        |
| ⭐ SSO 登出不同步          | logout 清除 `.zhiz.chat` cookie + 后端 token 黑名单，全子域同时失效                                           |
| ⭐ 渐进式限流 Redis 故障   | 降级为仅 DB 查询（性能下降但不丢功能）；PM2 监控 Redis 连接状态                                               |
| ⭐ 自动封禁误伤正常用户    | 首次仅封 5 分钟（极短），30 天无违规自动衰减；管理员可即时解封                                                |
| ⭐ 阶梯升级过激            | 阈值可通过环境变量调整（默认 60s/10 次），不同端可差异化配置                                                  |
| ⭐ 错误码映射表不同步      | `error-codes.ts` + `error-messages.ts` 为单一来源；新增错误码需同步映射表，CI 可加 lint 检查                  |
| ⭐ 用户头像上传            | P1 阶段实现：`POST /users/me/avatar`（multer + S3/本地存储），首期可用 Gravatar 或 DiceBear 自动生成          |
| ⭐ usePromptStore 缓存失效 | API 响应作为权威数据，localStorage 作为离线缓存；写操作走 API 成功后同步更新本地缓存；启动时 API 数据覆盖本地 |
| ⭐ API 不可用时前端降级    | 游客模式降级为只读 localStorage 数据；登录用户 API 超时后显示"离线模式"提示 + 缓存数据                        |

---

## 附录 A：环境变量模板

```env
# .env.example
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/easy_prompt

# Auth
JWT_SECRET=<your-jwt-secret>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ⭐ SSO Cookie（跨域单点登录）
COOKIE_DOMAIN=.zhiz.chat
COOKIE_SECURE=true

# Redis（渐进式限流 + 黑名单缓存必需）
REDIS_URL=redis://localhost:6379

# ⭐ 渐进式限流（fail2ban 风格）
RATE_WINDOW_SECONDS=60
RATE_MAX_REQUESTS=10
RATE_DECAY_DAYS=30
RATE_DIMENSIONS=ip,fingerprint

# ⭐ AI Proxy (P0) — 初始 provider 种子数据
# 注：正式运行后 provider 配置存储在 ai_providers 表中，以下仅用于首次种子
AI_DEFAULT_BASE_URL=https://vpsairobot.com/v1
AI_DEFAULT_API_KEY=<key>
AI_DEFAULT_MODEL=gpt-5.4

# ⭐ Provider API Key 加密密钥（用于 ai_providers.api_key 的应用层加解密）
PROVIDER_ENCRYPTION_KEY=<32-byte-hex-key>

# ⭐ GeoIP（可选，用于请求日志中的国家/地区解析）
GEOIP_DB_PATH=/path/to/GeoLite2-City.mmdb

# CORS
CORS_ORIGINS=https://zhiz.chat,https://prompt.zhiz.chat,https://api.zhiz.chat,http://localhost:5173
```

## 附录 B：与现有 deploy.sh 的关系

```
deploy/deploy.sh targets:
  existing: all | vscode | intellij | web | web-hub | browser | git | build
  new:      backend   ← 新增 target

deploy/config.sh:
  new vars: DB_URL, JWT_SECRET, PROVIDER_ENCRYPTION_KEY（加入 .gitignore 排除的凭证文件）
```

**对 deploy.sh 的影响：**

| 变更                        | 说明                                                    |
| --------------------------- | ------------------------------------------------------- |
| `deploy/inject-provider.js` | 全端迁移完成后可废弃（Provider 配置改为后端数据库管理） |
| `deploy/providers/*.json`   | 迁移到 `ai_providers` 表后可废弃                        |
| 各端 `defaults.js` 加密注入 | 全端迁移完成后可移除（客户端不再持有 API Key）          |
| `deploy.sh verify`          | 需新增后端 provider 一致性检查                          |

---

## 附录 C：Provider 配置文件格式

`backend/providers/` 目录下的 JSON 文件用于初始化和备份，格式如下：

```json
// backend/providers/vpsairobot.json
{
  "name": "VPS AI Robot",
  "slug": "vpsairobot",
  "apiMode": "openai",
  "baseUrl": "https://vpsairobot.com/v1",
  "apiKey": "sk-xxxx",
  "defaultModel": "gpt-5.4",
  "models": ["gpt-5.4", "gpt-5.3", "gpt-4.1"],
  "isActive": true,
  "priority": 0,
  "maxRpm": 60,
  "maxTokens": 4096,
  "timeoutMs": 30000,
  "extraHeaders": {},
  "notes": "默认 provider"
}
```

```json
// backend/providers/openai.json.example
{
  "name": "OpenAI Direct",
  "slug": "openai-direct",
  "apiMode": "openai",
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-xxxx",
  "defaultModel": "gpt-4o",
  "models": ["gpt-4o", "gpt-4o-mini", "o4-mini"],
  "isActive": false,
  "priority": 1,
  "maxRpm": 500,
  "maxTokens": 4096,
  "timeoutMs": 30000,
  "extraHeaders": {},
  "notes": "OpenAI 官方直连"
}
```

> 注意：`backend/providers/` 目录应加入 `.gitignore`（含 API Key），仅 `.example` 文件可提交。

---

## 附录 D：Zhiz OAuth T4 邮件验证码流上线 SOP（2026-04-14）

### D.1 适用范围

本附录适用于 Zhiz OAuth T4 方案 B，即历史 OAuth-only 账号的邮件验证码补完流程，覆盖：

- `POST /api/v1/auth/oauth/zhiz/password-setup/start`
- `POST /api/v1/auth/oauth/zhiz/password-setup/complete`
- `backend/src/services/mail.service.ts`
- `web-hub/src/app/pages/auth/ZhizCompletePage.tsx`

### D.2 上线前冻结

- 确认 `.continue-here.md` 已更新为 Phase 6 完成态
- 确认本轮验证已全部通过：
  - backend `tsc --noEmit`
  - backend `eslint`（仅既有 warning 可接受）
  - backend `src/__tests__/oauth.integration.test.ts` 17/17
  - backend `npm run build`
  - web-hub `npm run typecheck`
  - web-hub `npm run lint`
  - web-hub `npm run build`

### D.3 生产环境变量核对

#### Zhiz OAuth

- `OAUTH_ZHIZ_CLIENT_ID`
- `OAUTH_ZHIZ_CLIENT_SECRET`
- `OAUTH_ZHIZ_BASE_URL`
- `OAUTH_ZHIZ_AUTH_PAGE_URL`
- `OAUTH_CALLBACK_BASE_URL`
- `AUTH_WEB_BASE_URL`

#### Token 安全

- `OAUTH_TOKEN_ENCRYPTION_KEY`
  - 必须为 64 位 hex
  - 若生产库中已有已加密 Zhiz token，禁止无计划轮换

#### SMTP 发信

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

#### 验证码策略

- `AUTH_EMAIL_CODE_TTL_SEC`
- `AUTH_EMAIL_CODE_RESEND_COOLDOWN_SEC`
- `AUTH_EMAIL_CODE_MAX_ATTEMPTS`

推荐生产默认值：

- `AUTH_EMAIL_CODE_TTL_SEC=600`
- `AUTH_EMAIL_CODE_RESEND_COOLDOWN_SEC=60`
- `AUTH_EMAIL_CODE_MAX_ATTEMPTS=5`

### D.4 上线前人工联调清单

#### 新用户链路

- Zhiz 首登 → 补邮箱 + 密码 → 直接完成登录

#### 已有本地密码账号链路

- Zhiz 首登 → 输入已有邮箱 + 正确密码 → 成功绑定
- Zhiz 首登 → 输入已有邮箱 + 错误密码 → 明确失败

#### 历史 OAuth-only 账号链路

- Zhiz 首登 → 进入 `verify_email_and_set_password`
- 发送验证码成功
- 冷却中重发被拒绝
- 错误验证码返回剩余次数
- 正确验证码 + 新密码 → 成功绑定并登录

### D.5 后端部署顺序

1. 更新生产环境变量（含 SMTP 与验证码策略）
2. 构建 backend
3. reload / restart PM2 后端进程
4. 验证 `/health`
5. 验证 Zhiz OAuth 状态 / password-setup API 可访问

### D.6 Web-Hub 部署顺序

1. 使用最新 `web-hub build` 产物
2. 发布到 PromptHub 部署目录
3. 清理浏览器缓存或 CDN 缓存（如存在）
4. 打开 `/auth/zhiz/complete?ticket=...` 做真实链路验证

### D.7 上线后观测

重点错误码：

- `AUTH_ZHIZ_EMAIL_SEND_FAILED`
- `AUTH_ZHIZ_EMAIL_CODE_RATE_LIMITED`
- `AUTH_ZHIZ_EMAIL_CODE_INVALID`
- `AUTH_ZHIZ_EMAIL_CODE_EXPIRED`

重点指标：

- SMTP 发信成功率
- challenge 创建成功率
- password-setup 完成率
- `start -> complete` 转化率

### D.8 回滚策略

- 若仅 SMTP 配置错误：优先修环境变量，不必立刻回滚代码
- 若大量用户无法完成 `verify_email_and_set_password`：
  - 先冻结入口
  - 保留日志
  - 回滚到上一版 web-hub / backend

---

## 附录 E：Zhiz OAuth T4 生产环境变量最终值检查模板（2026-04-14）

> 说明：本模板用于上线前人工核对最终值。
> 不要把真实密钥提交到 Git。请在本地安全环境、`.env.production`、`secrets.json` 或受控部署系统中填写。

### E.1 最终值模板（占位版）

```env
# Zhiz OAuth T4 — production final values checklist template
# Fill locally only. DO NOT commit real secrets.

# ── Zhiz OAuth ──
OAUTH_ZHIZ_CLIENT_ID=__FILL_PRODUCTION_VALUE__
OAUTH_ZHIZ_CLIENT_SECRET=__FILL_PRODUCTION_SECRET__
OAUTH_ZHIZ_BASE_URL=https://http://localhost:8060
OAUTH_ZHIZ_AUTH_PAGE_URL=__FILL_PRODUCTION_AUTH_PAGE_URL__
OAUTH_CALLBACK_BASE_URL=__FILL_PRODUCTION_API_BASE_URL__
AUTH_WEB_BASE_URL=__FILL_PRODUCTION_WEB_HUB_URL__

# ── OAuth token security ──
OAUTH_TOKEN_ENCRYPTION_KEY=__FILL_64_HEX_KEY__

# ── SMTP ──
SMTP_HOST=__FILL_SMTP_HOST__
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=__FILL_SMTP_USER__
SMTP_PASS=__FILL_SMTP_PASSWORD__
SMTP_FROM=__FILL_VERIFIED_FROM_ADDRESS__

# ── Email challenge policy ──
AUTH_EMAIL_CODE_TTL_SEC=600
AUTH_EMAIL_CODE_RESEND_COOLDOWN_SEC=60
AUTH_EMAIL_CODE_MAX_ATTEMPTS=5
```

### E.2 人工核对项

- [ ] `AUTH_WEB_BASE_URL` 指向当前正式 PromptHub 域名
- [ ] `OAUTH_CALLBACK_BASE_URL` 指向当前正式 API 域名
- [ ] `SMTP_FROM` 属于 SMTP 服务商允许的已验证域
- [ ] `SMTP_USER/SMTP_PASS` 已验证可登录且支持当前发信方式
- [ ] `SMTP_SECURE` 与端口匹配（例如 465/true、587/false）
- [ ] `OAUTH_TOKEN_ENCRYPTION_KEY` 为 64 位 hex，且与现网历史数据兼容
- [ ] `AUTH_EMAIL_CODE_TTL_SEC / RESEND_COOLDOWN_SEC / MAX_ATTEMPTS` 已与产品预期一致

### E.3 发布前最终口令

只有在以下条件全部满足后，才允许执行正式发布：

- 后端与 web-hub 构建通过
- SMTP 已用真实账号完成一次发信验证
- 历史 OAuth-only 账号链路已在预发布或生产受控账号上实测通过
- 所有真实 secrets 均存于受控位置，未写入版本库
