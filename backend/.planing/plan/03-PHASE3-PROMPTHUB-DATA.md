# Phase 3：PromptHub 数据层

> 预估工期：1-2 周 | 任务数：14 项
> 里程碑：M3 — Prompt CRUD API 完整可用、用户交互（点赞/收藏/复制）API 可用
> 前置条件：Phase 1 M1 验收通过（Phase 2 可并行）

---

## 3A — Prompt 模块（P3.01 - P3.07）

### P3.01 — Prompt Service（CRUD）
- **目标文件**：
  - `backend/src/services/prompt.service.ts`
- **预期行为**：
  - `list(filters, pagination, sort)` → PaginatedResponse<PromptSummary>
    - 筛选：category, model, tags, status, author_id, search(关键词)
    - 排序：created_at, like_count, view_count, copy_count
    - 分页：page + pageSize（默认 20，最大 100）
    - 非 admin 只返回 status=published
  - `detail(id, userId?)` → PromptDetail（含 author 信息、用户是否已点赞/收藏）
  - `create(data, authorId)` → Prompt（status=draft 或 pending）
  - `update(id, data, userId)` → Prompt（仅作者或 admin 可修改）
  - `delete(id, userId)` → void（仅作者或 admin 可删除，软删除或硬删除待定）
  - `random(count?, category?)` → Prompt[]（随机推荐）
  - `featured(limit?)` → Prompt[]（精选列表，is_featured=true）
  - `galaxy()` → 全量 Prompt 坐标数据（用于 3D 星空可视化）
    - 返回精简字段：id, title, category, like_count, created_at
    - 缓存（TTL 30min）
- **验证方式**：test（各查询场景 + 权限边界）
- **回滚方案**：删除文件
- **依赖关系**：P1.03, P1.06
- **风险等级**：中
- **对应章节**：§5.3 Prompts, §7.1.1

### P3.02 — Prompt Search（全文检索）
- **目标文件**：
  - `backend/src/services/prompt.service.ts`（增强 search 逻辑）
  - `backend/prisma/migrations/YYYYMMDD_search_vector/migration.sql`（如需自定义 SQL）
- **预期行为**：
  - 利用 PostgreSQL `search_vector` tsvector 列 + `pg_trgm` 扩展（§4.1）
  - 搜索策略（§7.1.1）：
    1. 精确匹配标题 → 权重最高
    2. tsvector 全文搜索（title + description + content）
    3. trigram 模糊匹配（容错拼写）
  - 搜索结果含相关度评分，按评分 + like_count 排序
  - 高亮匹配片段（ts_headline）
  - 搜索限流：30 req/min per IP
- **验证方式**：test（中英文搜索、模糊匹配、空结果、SQL 注入防护）
- **回滚方案**：回退到简单 LIKE 查询
- **依赖关系**：P3.01, P1.03
- **风险等级**：中（PostgreSQL 全文搜索配置复杂）
- **对应章节**：§4.1, §7.1.1

### P3.03 — Prompt Routes
- **目标文件**：
  - `backend/src/routes/prompt.routes.ts`
  - `backend/src/validators/prompt.validators.ts`
- **预期行为**：
  - 端点（§5.3）：
    - `GET    /api/v1/prompts` → optionalAuth + validate → list
    - `GET    /api/v1/prompts/random` → random
    - `GET    /api/v1/prompts/featured` → featured
    - `GET    /api/v1/prompts/galaxy` → galaxy
    - `GET    /api/v1/prompts/:id` → optionalAuth → detail
    - `POST   /api/v1/prompts` → authenticate → create
    - `PUT    /api/v1/prompts/:id` → authenticate → update
    - `DELETE /api/v1/prompts/:id` → authenticate → delete
  - 请求体/查询参数 Zod 校验
  - 响应格式统一
- **验证方式**：test（Supertest 全路径）
- **回滚方案**：删除文件
- **依赖关系**：P3.01, P1.14, P1.09
- **风险等级**：中
- **对应章节**：§5.3 Prompts

### P3.04 — 用户交互 Service（Like/Save/Copy/View）
- **目标文件**：
  - `backend/src/services/interaction.service.ts`
- **预期行为**：
  - `like(userId, promptId)` → toggle（已赞→取消，未赞→点赞）
    - 更新 user_likes 表 + prompts.like_count（原子操作）
    - 返回 `{ liked: boolean, likeCount: number }`
  - `save(userId, promptId)` → toggle
    - 更新 user_saves 表 + prompts.save_count
    - 返回 `{ saved: boolean, saveCount: number }`
  - `copy(userId, promptId)` → 记录（允许多次）
    - 更新 user_copies 表 + prompts.copy_count
    - 返回 `{ copyCount: number }`
  - `view(promptId, userId?, fingerprint?, ip?)` → 记录浏览
    - 去重逻辑：同一 fingerprint/userId 24h 内只计一次 view_count
    - 更新 user_views 表 + prompts.view_count
  - `saveCollection(userId, collectionId)` → toggle 收藏合集
  - 所有计数更新使用 Prisma 原子操作（`increment`/`decrement`）避免竞态
- **验证方式**：test（toggle 逻辑、并发安全、去重逻辑）
- **回滚方案**：删除文件
- **依赖关系**：P1.03
- **风险等级**：中（并发计数需原子操作）
- **对应章节**：§5.3 Prompts (like/save/copy/view)

### P3.05 — 交互 Routes
- **目标文件**：
  - `backend/src/routes/prompt.routes.ts`（追加交互端点）
- **预期行为**：
  - 追加端点：
    - `POST /api/v1/prompts/:id/like` → authenticate → like
    - `POST /api/v1/prompts/:id/save` → authenticate → save
    - `POST /api/v1/prompts/:id/copy` → authenticate → copy
    - `POST /api/v1/prompts/:id/view` → optionalAuth + fingerprint → view
- **验证方式**：test（Supertest）
- **回滚方案**：移除追加的路由
- **依赖关系**：P3.04, P3.03
- **风险等级**：低
- **对应章节**：§5.3 Prompts

### P3.06 — Achievement Service
- **目标文件**：
  - `backend/src/services/achievement.service.ts`
- **预期行为**：
  - `list(userId?)` → Achievement[]（全部成就 + 用户已解锁状态）
  - `check(userId)` → 检查并解锁新成就
    - 读取 achievements.condition jsonb → 评估用户数据是否满足
    - 自动解锁满足条件的成就 → 写入 user_achievements
    - 返回新解锁的成就列表
  - `unlock(userId, achievementId)` → 手动解锁（admin）
  - 成就条件类型（从 web-hub 现有数据推断）：
    - prompt_count >= N, like_count >= N, copy_count >= N
    - category_visited >= N, consecutive_days >= N 等
- **验证方式**：test（条件评估逻辑、边界场景）
- **回滚方案**：删除文件
- **依赖关系**：P1.03, P1.05（成就种子数据）
- **风险等级**：中（condition jsonb 评估引擎需健壮）
- **对应章节**：§5.3 Achievements

### P3.07 — Achievement Routes
- **目标文件**：
  - `backend/src/routes/achievement.routes.ts`
- **预期行为**：
  - `GET  /api/v1/achievements` → optionalAuth → list
  - `POST /api/v1/achievements/check` → authenticate → check（触发解锁检查）
- **验证方式**：test（Supertest）
- **回滚方案**：删除文件
- **依赖关系**：P3.06
- **风险等级**：低
- **对应章节**：§5.3 Achievements

---

## 3B — Collection 模块（P3.08 - P3.09）

### P3.08 — Collection Service
- **目标文件**：
  - `backend/src/services/collection.service.ts`
- **预期行为**：
  - `list(filters, pagination)` → PaginatedResponse<Collection>
    - 筛选：author_id, is_public, search
    - 仅返回 is_public=true 或当前用户自己的
  - `detail(id, userId?)` → CollectionDetail（含 prompts 列表 + 用户收藏状态）
  - `create(data, authorId)` → Collection（含初始 prompts 关联）
  - `save(userId, collectionId)` → toggle 收藏
- **验证方式**：test
- **回滚方案**：删除文件
- **依赖关系**：P1.03
- **风险等级**：低
- **对应章节**：§5.3 Collections

### P3.09 — Collection Routes
- **目标文件**：
  - `backend/src/routes/collection.routes.ts`
  - `backend/src/validators/collection.validators.ts`
- **预期行为**：
  - `GET  /api/v1/collections` → optionalAuth → list
  - `GET  /api/v1/collections/:id` → optionalAuth → detail
  - `POST /api/v1/collections` → authenticate → create
  - `POST /api/v1/collections/:id/save` → authenticate → save
- **验证方式**：test（Supertest）
- **回滚方案**：删除文件
- **依赖关系**：P3.08
- **风险等级**：低
- **对应章节**：§5.3 Collections

---

## 3C — User 模块（P3.10 - P3.14）

### P3.10 — User Service
- **目标文件**：
  - `backend/src/services/user.service.ts`
- **预期行为**：
  - `getProfile(userId)` → UserProfile（完整个人信息）
  - `updateProfile(userId, data)` → UserProfile（更新 display_name, avatar_url, bio）
  - `getPublicProfile(username)` → UserPublicProfile（公开信息 + 统计）
  - `getFavorites(userId, pagination)` → PaginatedResponse<PromptSummary>（收藏的 prompt）
  - `getLiked(userId, pagination)` → PaginatedResponse<PromptSummary>（点赞的 prompt）
  - `getMyPrompts(userId, pagination, status?)` → PaginatedResponse<PromptSummary>（自己创建的）
  - `getStats(userId)` → 用户统计（总点赞收到、总浏览、总复制、创作数等）
  - `getCategoryStats(userId)` → 各分类访问统计
  - `visitCategory(userId, category)` → 记录分类访问 + 更新 user_visited_categories
- **验证方式**：test
- **回滚方案**：删除文件
- **依赖关系**：P1.03
- **风险等级**：低
- **对应章节**：§5.3 Users

### P3.11 — User Routes
- **目标文件**：
  - `backend/src/routes/user.routes.ts`
  - `backend/src/validators/user.validators.ts`
- **预期行为**：
  - `GET    /api/v1/users/me` → authenticate → getProfile
  - `PUT    /api/v1/users/me` → authenticate + validate → updateProfile
  - `GET    /api/v1/users/me/favorites` → authenticate → getFavorites
  - `GET    /api/v1/users/me/liked` → authenticate → getLiked
  - `GET    /api/v1/users/me/prompts` → authenticate → getMyPrompts
  - `GET    /api/v1/users/me/achievements` → authenticate → (调用 achievement.service)
  - `GET    /api/v1/users/me/stats` → authenticate → getStats
  - `GET    /api/v1/users/me/category-stats` → authenticate → getCategoryStats
  - `POST   /api/v1/users/me/visit-category` → authenticate → visitCategory
  - `GET    /api/v1/users/:username` → optionalAuth → getPublicProfile
- **验证方式**：test（Supertest）
- **回滚方案**：删除文件
- **依赖关系**：P3.10, P1.14
- **风险等级**：低
- **对应章节**：§5.3 Users

### P3.12 — Prisma 中间件 / 扩展
- **目标文件**：
  - `backend/src/lib/prisma.ts`
- **预期行为**：
  - 单例 PrismaClient 实例（连接池）
  - 可选 Prisma middleware：
    - 自动更新 `updated_at` 时间戳
    - 软删除逻辑（如果采用）
    - 查询日志（开发环境）
  - 导出 `prisma` 实例供全局使用
- **验证方式**：test
- **回滚方案**：简化为无中间件版本
- **依赖关系**：P1.03
- **风险等级**：低
- **对应章节**：§2.2

### P3.13 — 分页/排序工具
- **目标文件**：
  - `backend/src/utils/pagination.ts`
- **预期行为**：
  - `parsePagination(query)` → `{ page, pageSize, skip, take }`
    - 默认 page=1, pageSize=20, 最大 pageSize=100
  - `parseSort(query, allowedFields)` → Prisma orderBy 对象
    - 格式：`sort=created_at:desc,like_count:asc`
    - 白名单验证排序字段
  - `buildPaginatedResponse(data, total, page, pageSize)` → PaginatedResponse<T>
    - 含 `{ data, pagination: { page, pageSize, total, totalPages, hasMore } }`
- **验证方式**：test
- **回滚方案**：删除文件
- **依赖关系**：P1.06
- **风险等级**：低
- **对应章节**：§5.1

### P3.14 — 测试数据工厂
- **目标文件**：
  - `backend/tests/factories/index.ts`
  - `backend/tests/factories/user.factory.ts`
  - `backend/tests/factories/prompt.factory.ts`
  - `backend/tests/helpers/setup.ts`
- **预期行为**：
  - 测试用数据工厂：快速创建 User, Prompt, Collection 等测试数据
  - 测试 setup/teardown：测试前清库、创建基础数据
  - 复用于 Phase 3+ 所有 service/route 测试
- **验证方式**：test（工厂函数自身的测试）
- **回滚方案**：删除文件
- **依赖关系**：P1.03
- **风险等级**：低
- **对应章节**：§2.2 Vitest+Supertest

---

## Phase 3 完成标志

- [ ] `GET /api/v1/prompts` 返回分页 Prompt 列表
- [ ] `GET /api/v1/prompts/:id` 返回详情（含用户交互状态）
- [ ] 全文搜索可用（中英文 + 模糊匹配）
- [ ] Like/Save/Copy/View 交互 API 全部可用
- [ ] `GET /api/v1/collections` 返回合集列表
- [ ] `GET /api/v1/users/me/stats` 返回用户统计
- [ ] Achievement 检查与解锁逻辑正常
- [ ] 所有 service 测试覆盖率 > 80%
