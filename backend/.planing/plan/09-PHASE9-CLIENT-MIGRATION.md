# Phase 9：全端客户端迁移 — 后端 API 对接

> 预估工期：3-4 周 | 任务数：12 项
> 里程碑：M9 — 至少 2 端完成后端对接 + 双轨模式验证
> 前置条件：
>   - Phase 2 后端服务层已交付（P2.01-P2.08, P2.15-P2.18）
>   - VPS 基础设施就绪（PostgreSQL, Redis, Nginx, PM2）
>   - `api.zhiz.chat` DNS + SSL 已配置
>   - 后端服务在 VPS 上可正常运行 + 通过健康检查
>
> 来源：从 Phase 2（P2.10-P2.14）拆分
> 拆分原因：客户端迁移涉及 4 个平台前端改动，风险高、前置条件多（DNS/SSL/Cookie/VPS 部署），
>   与后端服务层开发解耦后可独立排期、独立验收
>
> 参考文档：`CLIENT_MIGRATION_GUIDE.md`（P2.09 已完成，280 行详细迁移方案）

---

## 前置检查清单

开始本 Phase 前必须确认以下条件全部满足：

| # | 条件 | 验证方式 | 状态 |
|---|------|---------|------|
| 1 | `api.zhiz.chat` DNS A 记录指向 VPS | `dig api.zhiz.chat` | 待配置 |
| 2 | SSL 证书已签发 | `curl https://api.zhiz.chat/health` | 待配置 |
| 3 | Nginx 反向代理配置完成 | `curl https://api.zhiz.chat/health` 返回 200 | 待配置 |
| 4 | 后端 PM2 进程正常运行 | `pm2 status` 显示 online | 待部署 |
| 5 | Cookie 跨子域配置 | `domain=.zhiz.chat, SameSite=Lax` | 待配置 |
| 6 | CORS 允许各端 origin | `.env CORS_ORIGINS` 包含各端域名 | ✅ 已配置 |
| 7 | 匿名用户限流策略已验证 | `POST /api/v1/ai/enhance` 无 token | 待验证 |

---

## 9A — 基础设施配置（P9.01 - P9.02）

### P9.01 — DNS + SSL 配置
- **目标**：`api.zhiz.chat` 可通过 HTTPS 访问
- **操作步骤**：
  1. 在域名解析商添加 A 记录：`api.zhiz.chat → 107.151.137.198`
  2. VPS 宝塔面板申请 SSL 证书（Let's Encrypt）
  3. 配置 Nginx 反向代理（→ P9.02）
- **验证方式**：`curl -I https://api.zhiz.chat/health` 返回 200
- **风险等级**：低
- **依赖关系**：无

### P9.02 — Nginx 反向代理 + Cookie 配置
- **目标文件**：VPS Nginx 配置（宝塔面板）
- **预期行为**：
  - `api.zhiz.chat:443` → `127.0.0.1:3000`
  - 设置 `proxy_set_header` 传递真实 IP（X-Forwarded-For, X-Real-IP）
  - Cookie domain `.zhiz.chat` 跨子域支持
  - WebSocket 升级支持（备用，SSE 可能需要）
  - 请求体大小限制 `client_max_body_size 1m`
- **验证方式**：curl + 浏览器 DevTools 检查 Set-Cookie header
- **风险等级**：中
- **依赖关系**：P9.01
- **对应章节**：ARCHITECTURE.md §9.2

---

## 9B — 各端客户端迁移（P9.03 - P9.06）

> 迁移顺序按风险和复杂度排列：Web → Browser → VS Code → IntelliJ
> 每端改造包含：后端 API 封装、双轨增强逻辑、Token 管理、错误提示映射、配置开关

### P9.03 — Web SPA 后端对接
- **目标文件**：
  - `web/app.js` — 新增 `callBackendApi()` + `callEnhance()` 双轨改造
- **改动范围**：~50-100 行
- **预期行为**：
  - `callBackendApi(endpoint, options)` 使用 `credentials: 'include'` 跨子域 Cookie
  - AI 增强优先调用后端 `POST /api/v1/ai/enhance`，失败回退本地直连
  - 回退时 console.warn 记录，结果标记 `source: 'local-fallback'`
  - 未登录用户引导到 `zhiz.chat/auth/login?redirect_uri=prompt.zhiz.chat`
  - 后端错误码 → 用户友好中文提示映射
  - 配置开关：localStorage `ep-backend-enabled`（默认 true）
- **验证方式**：
  - 手工：正常增强、后端不可用回退、匿名限流
  - E2E（可选）：Playwright 模拟增强流程
- **回滚方案**：关闭 `ep-backend-enabled` 恢复纯本地模式
- **风险等级**：高（monolithic app.js 2888 行，改动需精确定位）
- **依赖关系**：P9.01, P9.02
- **对应章节**：§7.2, CLIENT_MIGRATION_GUIDE §3.1

### P9.04 — Browser Extension 后端对接
- **目标文件**：
  - `browser/shared/api.js` — 新增 `callBackendEnhance(input, config)`
  - `browser/background/service-worker.js` — `ENHANCE_INLINE` 处理增加双轨逻辑
  - `browser/popup/popup.js` — Token 管理 UI（登录/登出）
  - `browser/options/options.js` — 后端连接开关 + Token 配置
- **改动范围**：~80-120 行（跨 4 文件）
- **预期行为**：
  - `shared/api.js` 新增后端 API 调用封装
  - `service-worker.js` 的 `ENHANCE_INLINE` 增加双轨：后端优先 → 本地回退
  - Token 存储在 `chrome.storage.local` key `ep-auth-token`
  - Options 页面增加"后端连接"开关和 Token 输入
  - Popup 显示当前连接模式（后端/本地）
- **验证方式**：
  - 手工：Chrome + Firefox 双浏览器测试
  - E2E：`browser/e2e/popup.spec.ts` 补充后端模式用例
- **回滚方案**：Options 关闭后端开关
- **风险等级**：高（22 个 AI 站点适配，inline + popup 双路径）
- **依赖关系**：P9.01, P9.02
- **对应章节**：§7.3, CLIENT_MIGRATION_GUIDE §3.2

### P9.05 — VS Code Extension 后端对接
- **目标文件**：
  - `extension.js` — 新增 `callBackendApi()` + `smartEnhance()` 双轨
- **改动范围**：~30-50 行
- **预期行为**：
  - `callBackendApi()` 使用 Node.js `fetch`（Node 18+）
  - `smartEnhance()` 增加双轨逻辑
  - Token 通过 `context.secrets.store('ep-auth-token', token)` 安全存储
  - 设置项新增 `easyPrompt.backendEnabled` (boolean) 和 `easyPrompt.backendUrl` (string)
  - 命令面板增加 "Login to Easy Prompt Backend" 命令
- **验证方式**：
  - 手工：VS Code 中触发增强，检查后端调用 + 回退
  - 单元测试：mock fetch 验证双轨逻辑
- **回滚方案**：设置 `easyPrompt.backendEnabled: false`
- **风险等级**：中（成熟架构，改动集中）
- **依赖关系**：P9.01, P9.02
- **对应章节**：§7.4, CLIENT_MIGRATION_GUIDE §3.3

### P9.06 — IntelliJ Plugin 后端对接
- **目标文件**：
  - `intellij/src/main/kotlin/com/easyprompt/core/ApiClient.kt` — 新增 `callBackendEnhance()`
  - `intellij/src/main/kotlin/com/easyprompt/settings/EasyPromptSettings.kt` — 新增后端配置
  - `intellij/src/main/kotlin/com/easyprompt/actions/EnhanceAction.kt` — 双轨逻辑
- **改动范围**：~60-80 行（跨 3 文件）
- **预期行为**：
  - `ApiClient.kt` 新增 `callBackendEnhance()` 方法（JVM HTTP）
  - 双轨逻辑在 `EnhanceAction.kt` 中实现
  - Token 通过 `PasswordSafe` 安全存储
  - Settings 新增 Backend URL、Enable Backend 选项
- **验证方式**：手工测试（IntelliJ 无自动化测试）
- **回滚方案**：Settings 关闭 Backend 选项
- **风险等级**：中（独立代码库，影响范围可控）
- **依赖关系**：P9.01, P9.02
- **对应章节**：§7.5, CLIENT_MIGRATION_GUIDE §3.4

---

## 9C — 协议统一 + 验证（P9.07 - P9.12）

### P9.07 — requestId 端到端透传
- **目标文件**：各端 API 模块
- **预期行为**：
  - 客户端生成 requestId（UUID v4），随请求发送
  - 后端在响应中回传 requestId
  - 客户端日志/历史记录中标记 requestId，支持跨系统追踪
- **验证方式**：手工检查请求/响应 header + 后端日志
- **风险等级**：低
- **依赖关系**：P9.03-P9.06

### P9.08 — 错误码映射表
- **目标文件**：各端错误处理模块
- **预期行为**：
  - 后端错误码统一映射为用户友好提示（中/英双语）
  - 覆盖：RATE_LIMITED, AI_PROVIDER_ERROR, AI_TIMEOUT, BLACKLISTED, UNAUTHORIZED 等
  - 网络不可达特殊处理（区分后端不可达 vs AI Provider 不可达）
- **验证方式**：手工模拟各类错误场景
- **风险等级**：低
- **依赖关系**：P9.03-P9.06

### P9.09 — 双轨开关统一
- **目标文件**：各端配置模块
- **预期行为**：
  - 三种模式：`auto`（后端优先+回退）、`backend-only`、`local-only`
  - 默认 `auto`
  - 各端 UI 提供模式切换入口
- **验证方式**：手工切换模式验证
- **风险等级**：低
- **依赖关系**：P9.03-P9.06

### P9.10 — SSO Login Flow
- **目标文件**：
  - 各端登录 UI 组件
  - 后端 `routes/auth.ts` SSO 端点（已实现）
- **预期行为**：
  - Web SPA：redirect 到 zhiz.chat 登录页 → callback → cookie 写入
  - Browser/VS Code/IntelliJ：OAuth 授权码流 → 后端 exchange → token 存储
  - 匿名用户可使用（受更严格限流）
- **验证方式**：手工登录/登出流程
- **风险等级**：高
- **依赖关系**：P9.03-P9.06, Phase 1 auth 模块

### P9.11 — 跨端集成测试
- **目标文件**：
  - `tests/test-backend-integration.js`（新建）
- **预期行为**：
  - 对每端执行：正常增强、后端不可用回退、匿名限流、错误映射
  - 自动化脚本调用后端 API + 验证响应格式
- **验证方式**：`npm run test:integration`
- **风险等级**：低
- **依赖关系**：P9.03-P9.06

### P9.12 — 迁移文档更新 + 发布检查
- **目标文件**：
  - `CLIENT_MIGRATION_GUIDE.md` — 更新实际实现状态
  - `RELEASE_CHECKLIST.md` — 增加后端对接检查项
  - `CHANGELOG.md` — 记录各端后端对接
- **预期行为**：
  - 迁移文档更新各端实际改动 diff
  - 发布检查清单增加后端模式验证
- **验证方式**：文档审阅
- **风险等级**：低
- **依赖关系**：P9.03-P9.11

---

## 执行顺序建议

```
P9.01 DNS+SSL ─→ P9.02 Nginx ─→ ┬─ P9.03 Web (1st, cookie 最简单)
                                  ├─ P9.05 VS Code (2nd, 改动少)
                                  ├─ P9.04 Browser (3rd, 风险高需充分测试)
                                  └─ P9.06 IntelliJ (4th, 独立可控)
                                  ↓
                              P9.07 requestId + P9.08 错误码 + P9.09 双轨开关
                                  ↓
                              P9.10 SSO Login
                                  ↓
                              P9.11 集成测试
                                  ↓
                              P9.12 文档 + 发布
```

---

## 里程碑验收标准（M9）

- [ ] `api.zhiz.chat` HTTPS 可访问，`/health` 返回 200
- [ ] 至少 2 端完成后端对接 + 双轨模式可用
- [ ] 匿名用户可正常增强（受限流）
- [ ] 后端不可用时自动回退到本地直连
- [ ] 错误提示用户友好（中文）
- [ ] 性能无明显退化（后端增加一跳延迟 < 200ms）
- [ ] 各端配置开关可正常切换模式

---

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| Web SPA monolithic 改动破坏现有功能 | 中 | 高 | 改动前 snapshot 测试，双轨开关可快速回退 |
| Browser 22 站点适配受影响 | 低 | 高 | inline/popup 双路径独立测试 |
| Cookie 跨子域不生效 | 中 | 中 | 提前验证 Cookie 配置，备用 Bearer Token 方案 |
| SSO 登录流程复杂度 | 高 | 中 | 首期仅实现 Token 手动输入，SSO 自动流后续迭代 |
| VPS 网络延迟影响用户体验 | 低 | 中 | 双轨模式保底，CDN 加速可后续添加 |
