# Phase 5：web-hub 前端对接

> 预估工期：1-2 周 | 任务数：12 项
> 里程碑：M5 — PromptHub 从静态 mock 数据完全迁移到后端 API
> 前置条件：Phase 3 M3 + Phase 4 M4 验收通过

---

## 5A — API 客户端层（P5.01 - P5.03）

### P5.01 — API Client 封装

- **目标文件**：
  - `web-hub/src/lib/api/client.ts`（新增）
  - `web-hub/src/lib/api/types.ts`（新增）
  - `web-hub/src/lib/api/index.ts`（新增）
- **预期行为**：
  - 统一 API 客户端（§7.1）：
    - base URL: `api.zhiz.chat`（生产）/ `localhost:3000`（开发）
    - 自动带 `credentials: 'include'`（cookie 跨域）
    - 自动带 `X-Request-Id: uuid` 请求头
    - 请求拦截：附加 access_token（如有）
    - 响应拦截：
      - 401 → 尝试自动 refresh token → 重试原请求
      - 其他错误 → 解析 ApiErrorResponse → 映射到 i18n 消息
    - 请求超时：15s
    - TypeScript 泛型封装：`api.get<T>(url, params)`, `api.post<T>(url, body)` 等
  - 导出各模块 API 方法：
    - `authApi.login()`, `authApi.register()`, `authApi.refresh()`, `authApi.me()`, `authApi.logout()`
    - `promptApi.list()`, `promptApi.detail()`, `promptApi.like()`, `promptApi.save()` 等
    - `collectionApi.list()`, `collectionApi.detail()` 等
    - `trendingApi.prompts()`, `trendingApi.categories()`, `trendingApi.daily()`
    - `userApi.profile()`, `userApi.stats()`, `userApi.favorites()` 等
    - `metaApi.categories()`, `metaApi.models()`
- **验证方式**：build + lint
- **回滚方案**：删除 `lib/api/` 目录
- **依赖关系**：P1.36（后端 API 可用）
- **风险等级**：中
- **对应章节**：§7.1

### P5.02 — Auth Context + Hook

- **目标文件**：
  - `web-hub/src/app/hooks/useAuth.ts`（新增）
  - `web-hub/src/app/components/AuthProvider.tsx`（新增）
- **预期行为**：
  - `AuthProvider` 包裹应用根节点，管理认证状态：
    - 启动时调用 `/auth/me` 检查登录状态
    - 管理 `user`, `isAuthenticated`, `isLoading` 状态
    - 提供 `login()`, `logout()`, `refresh()` 方法
  - `useAuth()` hook：
    - 返回 `{ user, isAuthenticated, isLoading, login, logout }`
    - 任意组件可获取认证状态
  - Token 刷新策略：
    - access_token 过期前 1 分钟自动刷新
    - 刷新失败 → 清除状态 → 可选跳转登录页
  - 页面路由守卫：需登录页面检查认证状态
- **验证方式**：手工（登录/登出/刷新/过期场景）
- **回滚方案**：删除文件
- **依赖关系**：P5.01
- **风险等级**：中
- **对应章节**：§7.1

### P5.03 — Auth UI 组件

- **目标文件**：
  - `web-hub/src/app/components/AuthButton.tsx`（新增）
  - `web-hub/src/app/components/UserMenu.tsx`（新增）
- **预期行为**：
  - `AuthButton`：
    - 未登录 → 显示"登录"按钮 → 跳转 `/auth/login`
    - 已登录 → 显示用户头像/名称 → 点击展开 `UserMenu`
  - `UserMenu` 下拉菜单：
    - 个人主页、我的收藏、我的 Prompt、设置、退出登录
  - 集成到现有 Header/Navbar 组件
  - 响应式设计（移动端适配）
- **验证方式**：手工（视觉 + 交互）
- **回滚方案**：删除文件，Header 恢复原状
- **依赖关系**：P5.02, P4.09（登录页）
- **风险等级**：低
- **对应章节**：§7.1

---

## 5B — 数据层迁移（P5.04 - P5.09）

> 核心策略（§7.1）：渐进式迁移，每个 data hook 从 mock → API 逐步切换

### P5.04 — usePrompts Hook 迁移

- **目标文件**：
  - `web-hub/src/app/hooks/usePrompts.ts`（修改或新增）
  - 涉及页面：PromptList, PromptDetail, SearchResults 等
- **预期行为**：
  - 替换 `MOCK_PROMPTS` 静态数据为 API 调用：
    - 列表：`promptApi.list(filters, pagination)` → React Query / SWR 缓存
    - 详情：`promptApi.detail(id)` → 缓存 + 乐观更新
    - 搜索：`promptApi.list({ search: keyword })`
    - 随机：`promptApi.random()`
  - 数据加载状态管理：loading / error / empty
  - 分页：滚动加载或翻页组件
  - 前端缓存策略：stale-while-revalidate
  - **降级方案**：API 不可用时 fallback 到 mock 数据
- **验证方式**：手工（页面数据加载、搜索、分页、离线降级）
- **回滚方案**：恢复 mock 数据导入
- **依赖关系**：P5.01, P3.03
- **风险等级**：高（PromptHub 核心数据，影响面广）
- **对应章节**：§7.1

### P5.05 — useCollections Hook 迁移

- **目标文件**：
  - `web-hub/src/app/hooks/useCollections.ts`（修改或新增）
- **预期行为**：
  - 替换 `COLLECTIONS` 静态数据为 API 调用
  - 合集列表 + 详情 + 收藏操作
  - 加载/错误/空状态处理
- **验证方式**：手工
- **回滚方案**：恢复 mock 数据
- **依赖关系**：P5.01, P3.09
- **风险等级**：中
- **对应章节**：§7.1

### P5.06 — useAchievements Hook 迁移

- **目标文件**：
  - `web-hub/src/app/hooks/useAchievements.ts`（修改或新增）
- **预期行为**：
  - 替换 `ACHIEVEMENTS` 静态数据为 API 调用
  - 含用户解锁状态（需登录）
  - 未登录用户显示所有成就但不显示解锁状态
- **验证方式**：手工
- **回滚方案**：恢复 mock 数据
- **依赖关系**：P5.01, P5.02, P3.07
- **风险等级**：低
- **对应章节**：§7.1

### P5.07 — useTrending Hook

- **目标文件**：
  - `web-hub/src/app/hooks/useTrending.ts`（新增）
- **预期行为**：
  - Trending 数据获取：
    - `trendingApi.prompts(period)` → 热门 Prompt 列表
    - `trendingApi.categories(period)` → 热门分类
    - `trendingApi.daily()` → 每日精选
  - 缓存策略：5min stale time
  - 周期切换（day/week/month）无需重新加载整页
- **验证方式**：手工
- **回滚方案**：删除 hook
- **依赖关系**：P5.01, P4.02
- **风险等级**：低
- **对应章节**：§7.1

### P5.08 — useMeta Hook（Categories + Models）

- **目标文件**：
  - `web-hub/src/app/hooks/useMeta.ts`（新增）
- **预期行为**：
  - 替换 `CATEGORY_CONFIG` / `MODEL_CONFIG` 静态数据：
    - `metaApi.categories()` → 分类列表（含 i18n）
    - `metaApi.models()` → 模型列表
  - 长缓存（1h stale time）
  - 启动时预加载
- **验证方式**：手工
- **回滚方案**：恢复 constants.ts 导入
- **依赖关系**：P5.01, P1.33
- **风险等级**：中（分类/模型数据影响多个页面的筛选器）
- **对应章节**：§7.1

### P5.09 — 交互操作集成

- **目标文件**：
  - 涉及多个页面组件（PromptCard, PromptDetail 等）
- **预期行为**：
  - Like/Save/Copy 按钮对接后端 API：
    - 点赞：`promptApi.like(id)` → 乐观更新计数 + toggle 状态
    - 收藏：`promptApi.save(id)` → 乐观更新
    - 复制：`promptApi.copy(id)` → 记录（复制操作本身仍在前端执行）
    - 浏览：`promptApi.view(id)` → 页面打开时静默调用
  - 未登录用户点击交互按钮 → 提示登录
  - 乐观更新 + 错误回滚
  - 防抖：连续快速点击限流
- **验证方式**：手工（交互响应、登录提示、错误回滚、网络断开场景）
- **回滚方案**：恢复前端本地计数逻辑
- **依赖关系**：P5.02, P5.04, P3.05
- **风险等级**：中（乐观更新与服务端同步需仔细处理）
- **对应章节**：§7.1

---

## 5C — 页面对接（P5.10 - P5.12）

### P5.10 — Profile 页面对接

- **目标文件**：
  - `web-hub/src/app/pages/profile/`（修改现有或新增）
- **预期行为**：
  - 个人中心页：
    - 显示用户统计（总点赞、总浏览、总复制、创作数）
    - 我的 Prompt 列表（可切换 draft/published/pending/rejected）
    - 我的收藏列表
    - 我的成就展示
    - 编辑个人信息入口
  - 公开 Profile 页（`/user/:username`）：
    - 公开统计 + 公开 Prompt + 公开 Collection + 成就
  - 数据从 `userApi` 获取
- **验证方式**：手工
- **回滚方案**：隐藏 Profile 页面路由
- **依赖关系**：P5.02, P3.11
- **风险等级**：中
- **对应章节**：§7.1, §7.1.1

### P5.11 — Trending 页面对接

- **目标文件**：
  - `web-hub/src/app/pages/trending/`（修改现有或新增）
- **预期行为**：
  - Trending 页面：
    - 热门 Prompt 排行榜（可切换 day/week/month）
    - 热门分类卡片
    - 每日精选展示区
  - 数据从 `useTrending` hook 获取
  - 动画效果：排名变动动画、新上榜高亮
- **验证方式**：手工
- **回滚方案**：隐藏 Trending 页面路由
- **依赖关系**：P5.07
- **风险等级**：低
- **对应章节**：§7.1

### P5.12 — 错误处理统一

- **目标文件**：
  - `web-hub/src/app/components/ErrorBoundary.tsx`（增强）
  - `web-hub/src/lib/api/errorHandler.ts`（新增）
- **预期行为**：
  - 全局错误处理（§5.2 + §7.1）：
    - API 错误 → 解析 error code → 查找 i18n 消息 → toast 通知
    - 网络错误 → "网络连接异常，请检查网络"
    - 401 → 自动刷新 token → 重试 → 最终失败 → 跳转登录
    - 403 → "没有权限执行此操作"
    - 429 → "请求过于频繁，请 {retry_after} 秒后重试"
    - 500 → "服务器异常，请稍后重试"
  - ErrorBoundary 捕获渲染错误 → 友好降级页面
  - 所有 toast 使用 sonner 组件
- **验证方式**：手工（模拟各类错误场景）
- **回滚方案**：恢复简单错误处理
- **依赖关系**：P5.01, P4.08
- **风险等级**：中
- **对应章节**：§5.2, §7.1

---

## Phase 5 完成标志

- [x] PromptHub 首页从后端 API 加载数据 — usePrompts() in Home.tsx + Layout.tsx
- [x] 搜索功能对接后端全文检索 — promptApi.search() in usePrompts
- [x] Prompt 详情页从 API 加载（含交互状态） — usePromptDetail() + useInteractions()
- [x] Like/Save/Copy/View 操作写入后端 — useInteractions() 乐观更新+API同步 (2026-04-10)
- [x] Collection 页面从 API 加载 — useCollections() + useCollectionDetail() (2026-04-10)
- [x] Achievement 页面从 API 加载（含用户解锁状态） — useAchievements() in Profile.tsx (2026-04-10)
- [x] Trending 页面显示后端计算的排名 — useTrending\*() hooks
- [x] Profile 页面显示后端用户数据 — useAuth() + useMyPrompts() + useAchievements()
- [x] 登录/注册/退出流程完整可用 — authApi.login/register() (2026-04-10)
- [x] 分类/模型筛选器从 API 加载元数据 — useMeta() 预热 in Layout.tsx (2026-04-10)
- [x] 错误处理统一，用户提示友好 — ApiError + errorHandler + ErrorBoundary
- [x] API 不可用时降级到 mock 数据（不白屏） — 所有 hooks 均包含 fallback 逻辑
- [x] `web-hub/src/app/data/` 中的 mock 数据仅作为 fallback，不再作为主数据源

> **Phase 5 完成时间**: 2026-04-10
> **验证方式**: tsc --noEmit ✅ | vite build ✅ | eslint ✅
