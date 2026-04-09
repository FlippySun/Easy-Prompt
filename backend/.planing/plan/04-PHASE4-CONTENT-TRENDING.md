# Phase 4：内容管理 + Trending

> 预估工期：1 周 | 任务数：10 项
> 里程碑：M4 — Trending API 可用、Admin 内容审核流程完整
> 前置条件：Phase 3 M3 验收通过

---

## 4A — Trending 模块（P4.01 - P4.03）

### P4.01 — Trending Service
- **目标文件**：
  - `backend/src/services/trending.service.ts`
- **预期行为**：
  - `trendingPrompts(period, limit)` → Prompt[]
    - period: day / week / month
    - 排名算法：`score = like_count * 3 + copy_count * 2 + view_count * 1`（时间衰减）
    - 时间衰减：score * decay_factor（越近权重越高）
    - 缓存 TTL：day=5min, week=30min, month=1h
  - `trendingCategories(period, limit)` → CategoryTrending[]
    - 统计各分类下 Prompt 的累计交互量
    - 返回 `{ category, promptCount, totalLikes, totalViews, growth }`
  - `dailyPicks(date?)` → Prompt[]
    - 每日精选：从 is_featured=true 中选 + 编辑推荐
    - 由 cron `featuredRefresh` 定时刷新
  - 所有结果缓存到 Redis/内存（避免频繁聚合查询）
- **验证方式**：test（算法正确性 + 缓存命中/失效）
- **回滚方案**：删除文件
- **依赖关系**：P3.01, P1.03
- **风险等级**：中（排名算法需调优）
- **对应章节**：§5.3 Trending, §7.1.1

### P4.02 — Trending Routes
- **目标文件**：
  - `backend/src/routes/trending.routes.ts`
- **预期行为**：
  - `GET /api/v1/trending/prompts?period=week&limit=20` → trendingPrompts
  - `GET /api/v1/trending/categories?period=month` → trendingCategories
  - `GET /api/v1/trending/daily` → dailyPicks
  - 全部公开端点（无需认证）
  - 响应头：`Cache-Control: public, max-age=300`
- **验证方式**：test（Supertest）+ curl
- **回滚方案**：删除文件
- **依赖关系**：P4.01
- **风险等级**：低
- **对应章节**：§5.3 Trending

### P4.03 — Featured 算法
- **目标文件**：
  - `backend/src/services/featured.service.ts`
- **预期行为**：
  - `refreshFeatured()` → 由 cron 任务调用
    - 算法（§7.1.1）：
      1. 最近 7 天新增 Prompt 中 like_count top 10%
      2. 排除已被标记为 featured 的
      3. 类别多样性约束：同一类别不超过 3 个
      4. 设置 `is_featured=true`, `featured_at=now()`
    - 清除超过 30 天的旧 featured 标记
  - `manualFeature(promptId, adminId)` → admin 手动标记精选
  - `unfeature(promptId, adminId)` → 取消精选
- **验证方式**：test（算法逻辑 + 多样性约束 + 清理逻辑）
- **回滚方案**：删除文件
- **依赖关系**：P3.01
- **风险等级**：低
- **对应章节**：§7.1.1, §8C featuredRefresh

---

## 4B — Admin 内容管理（P4.04 - P4.08）

### P4.04 — Admin Prompt Review Service
- **目标文件**：
  - `backend/src/services/admin.service.ts`
- **预期行为**：
  - `getPendingPrompts(pagination)` → PaginatedResponse<Prompt>（status=pending）
  - `approvePrompt(id, adminId)` → Prompt（status→published）
    - 记录审计日志
    - 触发成就检查（作者首次发布等）
  - `rejectPrompt(id, adminId, reason)` → Prompt（status→rejected）
    - 记录审计日志 + 拒绝原因
  - `bulkApprove(ids, adminId)` → 批量审核
- **验证方式**：test
- **回滚方案**：删除文件
- **依赖关系**：P3.01, P2.02（审计日志）
- **风险等级**：低
- **对应章节**：§5.3 Admin Prompts

### P4.05 — Admin Prompt Routes
- **目标文件**：
  - `backend/src/routes/admin.routes.ts`
  - `backend/src/validators/admin.validators.ts`
- **预期行为**：
  - 全部需 admin 权限：
    - `GET    /api/v1/admin/prompts/pending` → getPendingPrompts
    - `POST   /api/v1/admin/prompts/:id/approve` → approvePrompt
    - `POST   /api/v1/admin/prompts/:id/reject` → rejectPrompt（body: reason）
- **验证方式**：test（Supertest + 权限验证）
- **回滚方案**：删除文件
- **依赖关系**：P4.04, P1.14
- **风险等级**：低
- **对应章节**：§5.3 Admin Prompts

### P4.06 — Galaxy 数据优化
- **目标文件**：
  - `backend/src/services/prompt.service.ts`（增强 galaxy 方法）
- **预期行为**：
  - Galaxy 端点（§7.1.1）数据优化：
    - 返回全量 Prompt 精简数据（id, title, category, like_count, created_at, coordinates）
    - coordinates 由后端计算（基于 category 分布 + 时间轴），缓存 30min
    - 响应压缩（gzip）减小传输量
    - 支持增量更新参数 `?since=timestamp`
  - 大数据量下性能：
    - 控制返回字段（select 精简）
    - 数据量超 5000 时分片返回
- **验证方式**：test + 手工（验证响应大小和延迟）
- **回滚方案**：回退到基础版 galaxy
- **依赖关系**：P3.01
- **风险等级**：中（性能敏感）
- **对应章节**：§7.1.1

### P4.07 — 用户 Profile 增强
- **目标文件**：
  - `backend/src/services/user.service.ts`（增强公开 profile）
- **预期行为**：
  - 公开 Profile 页数据（§7.1.1）：
    - 用户基本信息 + 统计数据
    - 用户发布的 Prompt 列表（分页）
    - 用户创建的 Collection 列表
    - 用户成就展示
    - 活跃度数据（最近 30 天活动热力图）
  - 隐私保护：仅展示用户主动公开的内容
- **验证方式**：test
- **回滚方案**：回退到基础 profile
- **依赖关系**：P3.10
- **风险等级**：低
- **对应章节**：§7.1.1

### P4.08 — Error Handling 增强（前端错误码映射）
- **目标文件**：
  - `backend/src/types/error-messages.ts`（或导出为 JSON）
- **预期行为**：
  - 错误码 → 前端 i18n 映射表（§5.2）：
    ```typescript
    export const ERROR_MESSAGES = {
      'zh-CN': {
        AUTH_TOKEN_EXPIRED: '登录已过期，请重新登录',
        AUTH_LOGIN_FAILED: '邮箱或密码错误',
        RATE_LIMIT_EXCEEDED: '请求过于频繁，请稍后再试',
        AI_PROVIDER_ERROR: 'AI 服务暂时不可用，请稍后重试',
        // ... 全部错误码
      },
      'en': {
        AUTH_TOKEN_EXPIRED: 'Session expired, please login again',
        // ... 全部错误码
      }
    }
    ```
  - 可供前端直接导入使用
  - 覆盖 §5.2 中列出的全部 41 个错误码
- **验证方式**：test（验证每个错误码都有 zh-CN 和 en 翻译）
- **回滚方案**：删除文件
- **依赖关系**：P1.07
- **风险等级**：低
- **对应章节**：§5.2

### P4.09 — SSO 登录页面
- **目标文件**：
  - `web-hub/src/app/pages/auth/LoginPage.tsx`（新增）
  - `web-hub/src/app/pages/auth/CallbackPage.tsx`（新增）
- **预期行为**：
  - SSO 登录页（`zhiz.chat/auth/login`）（§6.2）：
    - 统一登录入口，所有客户端跳转到此页面
    - 表单：邮箱 + 密码登录
    - 可选：GitHub / Google OAuth 按钮（Phase 6 实现）
    - 注册链接（跳转到注册页）
    - 接收 `redirect_uri` + `state` 查询参数
    - 登录成功后：
      - 同域名（zhiz.chat）→ 直接设置 cookie + 跳回
      - 跨域名 → 生成 code → redirect 到 redirect_uri?code=xxx&state=yyy
  - Callback 页面：处理 OAuth 回调（预留）
  - 样式：与 PromptHub 一致的设计语言
- **验证方式**：手工（各端登录流程测试）
- **回滚方案**：删除页面文件
- **依赖关系**：P1.16, P1.17
- **风险等级**：高（SSO 核心入口）
- **对应章节**：§6.2

### P4.10 — SSO 注册页面
- **目标文件**：
  - `web-hub/src/app/pages/auth/RegisterPage.tsx`（新增）
- **预期行为**：
  - 注册页面（`zhiz.chat/auth/register`）：
    - 表单：邮箱 + 用户名 + 密码 + 确认密码
    - 前端校验：邮箱格式、用户名规则（3-20字符, 字母数字下划线）、密码强度
    - 调用 `POST /api/v1/auth/register`
    - 注册成功后自动登录 → 跳转逻辑同 LoginPage
    - 错误展示：邮箱已存在、用户名已存在等
  - 样式与 LoginPage 一致
- **验证方式**：手工
- **回滚方案**：删除页面文件
- **依赖关系**：P1.16, P4.09
- **风险等级**：中
- **对应章节**：§6.2

---

## Phase 4 完成标志

- [ ] `GET /api/v1/trending/prompts` 返回排名数据
- [ ] `GET /api/v1/trending/categories` 返回分类趋势
- [ ] `GET /api/v1/trending/daily` 返回每日精选
- [ ] Admin 可审核待发布 Prompt
- [ ] Featured 算法自动运行（cron 触发）
- [ ] Galaxy 端点性能满足要求（<500ms, <500KB）
- [ ] SSO 登录页可用，各端登录流程走通
- [ ] 错误码 i18n 映射完整（41 个 × 2 语言）
