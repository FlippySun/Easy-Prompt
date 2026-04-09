# Phase 6：跨端增强 + 管理后台

> 预估工期：2 周 | 任务数：8 项
> 里程碑：M6 — 全端功能完整、管理后台可用
> 前置条件：Phase 5 M5 验收通过
> 说明：Phase 6 为 P2 优先级，可根据实际需求调整范围

---

## 6A — 跨端增强（P6.01 - P6.04）

### P6.01 — 跨设备历史同步
- **目标文件**：
  - `backend/src/services/history.service.ts`（新增）
  - `backend/src/routes/history.routes.ts`（新增）
  - 各端存储模块（修改）
- **预期行为**：
  - 后端 API：
    - `GET  /api/v1/history` → authenticate → 分页获取用户增强历史
    - `POST /api/v1/history/sync` → authenticate → 上传本地历史（批量 upsert）
    - `GET  /api/v1/history/export` → 导出全部历史（JSON/CSV）
  - 数据模型：新增 `enhance_history` 表（或扩展 ai_request_logs）
    - user_id, input_text, output_text, scene, model, client_type, created_at
  - 各端改造：
    - 登录后自动上传本地历史 → 后端去重合并
    - 拉取云端历史 → 与本地合并
    - 冲突策略：以时间戳最新为准
  - 历史上限：每用户 500 条（超限归档旧数据）
- **验证方式**：test + 手工（多端登录验证历史同步）
- **回滚方案**：删除文件，各端恢复纯本地历史
- **依赖关系**：P1.14, P1.03
- **风险等级**：中（数据合并逻辑复杂）
- **对应章节**：§7.2, §7.3, §7.4, §7.5（各端提及历史同步）

### P6.02 — SSE 流式增强
- **目标文件**：
  - `backend/src/services/ai.service.ts`（增强 stream 方法）
  - `backend/src/routes/ai.routes.ts`（增强 stream 端点）
  - `backend/src/services/adapters/*.adapter.ts`（增强 stream 支持）
- **预期行为**：
  - `POST /api/v1/ai/enhance/stream` → SSE 响应
    - Content-Type: text/event-stream
    - 事件格式：`data: {"type":"token","content":"..."}\n\n`
    - 结束事件：`data: {"type":"done","usage":{...}}\n\n`
    - 错误事件：`data: {"type":"error","code":"...","message":"..."}\n\n`
  - 各适配器实现流式调用：
    - OpenAI: stream=true, SSE 解析
    - Claude: stream=true, SSE 解析
    - Gemini: streamGenerateContent
  - 后端作为 SSE 代理：上游 stream → 转发给客户端
  - 超时控制：30s 无数据 → 关闭连接
  - Nginx 配置：禁用 proxy_buffering for SSE
- **验证方式**：test + curl（验证 SSE 事件流）
- **回滚方案**：禁用 stream 端点，保留同步接口
- **依赖关系**：P1.26, P1.32
- **风险等级**：高（SSE + Nginx buffering + 多 adapter stream 解析）
- **对应章节**：§5.3 AI Gateway (enhance/stream)

### P6.03 — OAuth 集成（GitHub / Google）
- **目标文件**：
  - `backend/src/services/oauth.service.ts`（新增）
  - `backend/src/routes/auth.routes.ts`（增强）
  - `web-hub/src/app/pages/auth/LoginPage.tsx`（增强）
- **预期行为**：
  - `POST /api/v1/auth/oauth/:provider` → 发起 OAuth 流程
    - GitHub: OAuth Apps → authorization code → access token → user info
    - Google: OAuth 2.0 → authorization code → access token → user info
  - OAuth 回调处理：
    - 已有账号（email 匹配）→ 关联 provider → 登录
    - 新用户 → 自动注册（provider + provider_id）→ 登录
  - 环境变量：`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - 登录页面增加 OAuth 按钮
- **验证方式**：手工（GitHub/Google 登录全流程）
- **回滚方案**：移除 OAuth 路由和页面按钮
- **依赖关系**：P1.16, P4.09
- **风险等级**：中（第三方 API 依赖 + 账号关联逻辑）
- **对应章节**：§5.3 Auth (oauth/:provider), §6.2, §13

### P6.04 — 场景数据统一服务
- **目标文件**：
  - `backend/src/services/scenes.service.ts`（增强）
  - 各端场景加载模块（修改）
- **预期行为**：
  - 场景数据统一从后端 API 获取（消除三份拷贝问题）：
    - `GET /api/v1/scenes` → 返回全部场景（含 i18n）
    - `GET /api/v1/scenes/categories` → 按分类分组
  - 各端改造：
    - 启动时从 API 获取场景列表 → 缓存到本地
    - 缓存 TTL：24h（场景数据稳定）
    - 离线 fallback：使用本地内置的场景数据
  - 后端数据源：从 `core/scenes.js` 读取（单一源头）
  - 未来可扩展为 DB 管理（admin 可编辑场景）
- **验证方式**：test + 手工（验证各端场景列表一致）
- **回滚方案**：各端恢复本地场景数据
- **依赖关系**：P1.34, P2.07
- **风险等级**：中（涉及全端改动）
- **对应章节**：§5.3 Scenes, 已知技术债务#3

---

## 6B — 管理后台（P6.05 - P6.08）

### P6.05 — Admin Dashboard 页面
- **目标文件**：
  - `web-hub/src/app/pages/admin/Dashboard.tsx`（新增）
  - `web-hub/src/app/pages/admin/Layout.tsx`（新增）
- **预期行为**：
  - Admin 仪表盘（仅 admin/super_admin 可访问）：
    - 概览卡片：总用户数、总 Prompt 数、今日请求数、活跃 Provider
    - 最近 7 天请求趋势图（Recharts）
    - 最近告警：超限封禁、Provider 故障
    - 快速入口：审核队列、黑名单管理、Provider 管理
  - Admin Layout：侧边栏导航（Dashboard, Prompts, Users, Providers, Blacklist, Analytics, Settings）
  - 路由守卫：非 admin 用户访问 → 403 页面
- **验证方式**：手工
- **回滚方案**：删除 admin 页面，移除路由
- **依赖关系**：P5.02, P2.05
- **风险等级**：低
- **对应章节**：§7.1

### P6.06 — Provider 管理页面
- **目标文件**：
  - `web-hub/src/app/pages/admin/Providers.tsx`（新增）
- **预期行为**：
  - Provider 列表：名称、状态（active/inactive）、健康状态、优先级、最近请求统计
  - 创建/编辑 Provider 表单（API Base, API Key, Models, Priority）
  - 激活/停用操作
  - 测试连接按钮
  - 健康状态自动刷新（轮询 30s）
- **验证方式**：手工
- **回滚方案**：删除页面
- **依赖关系**：P5.01, P1.30
- **风险等级**：低
- **对应章节**：§5.3 Provider

### P6.07 — Blacklist 管理页面
- **目标文件**：
  - `web-hub/src/app/pages/admin/Blacklist.tsx`（新增）
- **预期行为**：
  - 黑名单规则列表：类型、值、原因、严重程度、过期时间、是否自动生成
  - 筛选：类型（IP/fingerprint/userId）、严重程度、活跃状态
  - 创建/编辑/删除规则
  - 手动检查某 IP/用户是否在黑名单
  - 统计面板：活跃规则数、按类型/严重程度分布
- **验证方式**：手工
- **回滚方案**：删除页面
- **依赖关系**：P5.01, P1.21
- **风险等级**：低
- **对应章节**：§5.3 Blacklist

### P6.08 — Analytics Dashboard 页面
- **目标文件**：
  - `web-hub/src/app/pages/admin/Analytics.tsx`（新增）
- **预期行为**：
  - 分析面板（§5.3 Analytics 全部端点的可视化）：
    - 汇总卡片：总请求、成功率、平均延迟、总费用
    - 每日趋势图（折线图）
    - 按客户端分布（饼图）
    - 按场景 Top 10（柱状图）
    - 按 IP Top 20（表格，用于发现滥用）
    - 按用户 Top 20（表格）
    - 费用报表（按 provider/model 分组）
    - 日期范围选择器
  - 图表组件使用 Recharts（web-hub 已有依赖）
  - 数据自动刷新（轮询 60s）
- **验证方式**：手工
- **回滚方案**：删除页面
- **依赖关系**：P5.01, P2.05
- **风险等级**：低
- **对应章节**：§5.3 Analytics

---

## Phase 6 完成标志

- [ ] 跨设备历史同步功能可用（至少 2 端验证）
- [ ] SSE 流式增强端点可用
- [ ] OAuth 登录（至少 GitHub）可用
- [ ] 场景数据从后端统一获取（消除三份拷贝）
- [ ] Admin Dashboard 可访问且数据正确
- [ ] Provider 管理页面 CRUD 完整
- [ ] Blacklist 管理页面 CRUD 完整
- [ ] Analytics 可视化面板数据正确
