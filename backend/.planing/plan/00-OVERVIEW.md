# Easy Prompt 统一后端 — 执行计划总览

> 基于 `backend/ARCHITECTURE.md` v1.7 (2026-04-08) 拆分
> 生成日期：2026-04-07

---

## 计划文件索引

| 文件                             | 内容                                                            |
| -------------------------------- | --------------------------------------------------------------- |
| `00-OVERVIEW.md`                 | 本文件：总览、统计、确认事项                                    |
| `01-PHASE1-FOUNDATION.md`        | Phase 1：基础骨架 + AI 代理网关（32 项任务）                    |
| `02-PHASE2-ANALYTICS-CLIENTS.md` | Phase 2：请求分析 + 全端接入（12 项后端 + 6 项已迁移 Phase9）✅ |
| `03-PHASE3-PROMPTHUB-DATA.md`    | Phase 3：PromptHub 数据层（14 项任务）                          |
| `04-PHASE4-CONTENT-TRENDING.md`  | Phase 4：内容管理 + Trending（10 项任务）                       |
| `05-PHASE5-WEBHUB-FRONTEND.md`   | Phase 5：web-hub 前端对接（12 项任务）                          |
| `06-PHASE6-CROSSPLATFORM.md`     | Phase 6：跨端增强 + 管理后台（8 项任务）                        |
| `07-EXECUTION-ORDER.md`          | 执行顺序（并行/串行）+ 里程碑 + 验收点                          |
| `09-PHASE9-CLIENT-MIGRATION.md`  | Phase 9：全端客户端迁移（12 项任务，从 P2.10-P2.14 拆分）       |

---

## Phase 完成状态

| Phase   | 状态          | 完成日期   | 备注                                                         |
| ------- | ------------- | ---------- | ------------------------------------------------------------ |
| Phase 1 | ✅ 已交付     | 2026-04-07 | 基础骨架 + AI 代理网关，32 项任务                            |
| Phase 2 | ✅ 后端已交付 | 2026-04-08 | 分析+审计+部署（2A+2C），VPS 验证通过；客户端迁移移至 Phase9 |
| Phase 3 | ✅ 已交付     | 2026-04-08 | PromptHub 数据层（14 项任务），145/145 测试通过              |
| Phase 4 | ✅ 已交付     | 2026-04-08 | 内容管理 + Trending（17 services + 14 routes 全部就位）      |
| Phase 5 | ⬜ 未开始     | —          | web-hub 前端对接                                             |
| Phase 6 | ⬜ 未开始     | —          | 跨端增强 + 管理后台                                          |
| Phase 9 | ⬜ 未开始     | —          | 全端客户端迁移（从 P2.09-P2.14 拆分）                        |

---

## 全局统计

- **总任务数**：~100 项（含 Phase 9 拆分新增 6 项）
- **P0 任务**：Phase 1 + Phase 2 = ~50 项
- **预估总工期**：8-10 周
- **涉及平台**：后端(新建) + web-hub + web + browser + vscode + intellij + VPS Nginx
- **核心技术栈**：Node.js 20+, TypeScript, Express/Fastify, PostgreSQL 16, Prisma, Redis, JWT, Zod, Pino

---

## 每项任务格式说明

```
### P{phase}.{seq} — {任务名}
- **目标文件**：需创建/修改的文件路径
- **预期行为**：该任务完成后系统应具备的能力
- **验证方式**：test / lint / build / curl / 手工
- **回滚方案**：失败时如何恢复
- **依赖关系**：前置任务 ID
- **风险等级**：低 / 中 / 高
- **对应架构章节**：ARCHITECTURE.md 中的具体章节
```

---

## ⚠️ 开始实施前需确认的事项

### 技术选型确认

1. **Web 框架**：Express 5 还是 Fastify 5？
   - ARCHITECTURE.md §2.2 列出两者均可，需确认最终选型
   - 影响：路由注册方式、中间件写法、插件生态

2. **密码哈希**：bcrypt 还是 argon2？
   - §2.2 列出两者均可
   - 影响：`password.ts` 实现、npm 依赖（argon2 有 native binding）

3. **Redis 是否首期必装**？
   - §2.2 标注 Redis 用于缓存/限流/排行榜
   - 若 VPS 暂无 Redis，限流可先降级为内存 Map + DB 查询
   - 影响：Phase 1 黑名单缓存、滑动窗口限流实现

### 基础设施确认

4. **VPS 上 PostgreSQL 16 是否已安装？**
   - 需要确认数据库实例是否就绪、连接凭证
   - 影响：Phase 1 所有 DB 任务的启动

5. **VPS 上 Node.js 20+ 是否已安装？**
   - 影响：后端部署

6. **`api.zhiz.chat` DNS 是否已解析？**
   - §9.2 新增了 `api.zhiz.chat` 作为全端统一 API 入口
   - 需提前配置 DNS A 记录 → VPS IP
   - 影响：Phase 2 全端客户端迁移

7. **SSL 证书**：`api.zhiz.chat` 是否需要新证书？
   - 影响：Nginx 配置

### 数据确认

8. **web-hub 现有数据格式确认**：
   - `web-hub/src/app/data/prompts.ts` 的 `MOCK_PROMPTS` 精确字段
   - `web-hub/src/app/data/collections.ts` 的 `COLLECTIONS` 精确字段
   - `web-hub/src/app/data/achievements.ts` 的 `ACHIEVEMENTS` 精确字段
   - `web-hub/src/app/data/constants.ts` 的 `CATEGORY_CONFIG` / `MODEL_CONFIG` 精确字段
   - 影响：Prisma schema 字段映射、种子脚本

9. **现有 `deploy/providers/vpsairobot.json` 内容确认**：
   - 种子数据需导入当前 provider 配置
   - 影响：ai_providers 种子数据

### 安全确认

10. **JWT_SECRET 生成方式**：是否由你提供，还是我生成随机值？
11. **PROVIDER_ENCRYPTION_KEY 生成方式**：32 字节 hex key
12. **管理员账号**：首个 admin 用户的邮箱/用户名？

### 架构确认

13. **OAuth 是否首期实现？**
    - §6.2 提到 `POST /auth/oauth/:provider`（GitHub/Google）
    - §13 风险表提到"首期仅做邮箱注册，OAuth 放 P1"
    - 确认：Phase 1 是否跳过 OAuth？

14. **流式增强（SSE）是否推迟到 Phase 6？**
    - §5.3 列出 `POST /ai/enhance/stream`
    - §10 Phase 6 提到流式增强
    - 确认：Phase 1 AI Gateway 只做同步接口？

15. **GeoIP 数据库**：是否需要购买 MaxMind GeoLite2？
    - §4.2 `ai_request_logs` 含 country/region 字段
    - 可选：首期留空，后续补充

---

## 架构文档章节 → 任务映射

| 章节                   | 对应任务                                              |
| ---------------------- | ----------------------------------------------------- |
| §2 技术选型            | P1.01                                                 |
| §3 目录结构            | P1.01, P1.02                                          |
| §4 数据库设计          | P1.03, P1.04, P1.05                                   |
| §5.1 基础约定          | P1.06                                                 |
| §5.2 统一错误码        | P1.07, P1.08, P1.09                                   |
| §5.3 Auth 端点         | P1.12-P1.17                                           |
| §5.3 Prompts 端点      | P3.01-P3.07                                           |
| §5.3 Collections 端点  | P3.08-P3.09                                           |
| §5.3 Users 端点        | P3.10-P3.13                                           |
| §5.3 Achievements 端点 | P3.14                                                 |
| §5.3 Trending 端点     | P4.01-P4.03                                           |
| §5.3 AI Gateway 端点   | P1.25-P1.28                                           |
| §5.3 Provider 端点     | P1.29-P1.32                                           |
| §5.3 Analytics 端点    | P2.04-P2.08                                           |
| §5.3 Blacklist 端点    | P1.19-P1.22                                           |
| §5.3 Rate Limiting     | P1.23-P1.24                                           |
| §5.3 Scenes 端点       | P2.09                                                 |
| §5.3 Meta 端点         | P1.33-P1.34                                           |
| §5.3 Admin 端点        | P4.06-P4.08                                           |
| §5.3 Health 端点       | P1.35                                                 |
| §6 认证方案            | P1.12-P1.18                                           |
| §6.3.1 SSO 边界        | P1.17, P1.18                                          |
| §7.0 全端 AI 架构变更  | ~~P2.10-P2.14~~ → **P9.01-P9.12**（已拆分到 Phase 9） |
| §7.1 PromptHub 集成    | P5.01-P5.12                                           |
| §7.1.1 数据检索策略    | P4.04, P4.05, P4.09, P4.10                            |
| §7.2 Web SPA 集成      | ~~P2.10~~ → P9.03                                     |
| §7.3 Browser 集成      | ~~P2.11~~ → P9.04                                     |
| §7.4 VS Code 集成      | ~~P2.12~~ → P9.05                                     |
| §7.5 IntelliJ 集成     | ~~P2.13~~ → P9.06                                     |
| §8 安全设计            | 贯穿所有 Phase                                        |
| §8B 日志体系           | P1.10, P1.11, P2.01-P2.03                             |
| §8C 定时任务           | P1.36, P2.15                                          |
| §9 部署方案            | P2.16-P2.18                                           |
| §10 路线图             | 全局组织依据                                          |
| §11 数据迁移           | P1.04, P1.05                                          |
| §12 共享类型           | P1.06                                                 |
| §13 风险               | 风险评估依据                                          |
| 附录 A 环境变量        | P1.02                                                 |
| 附录 B deploy.sh       | P2.17                                                 |
| 附录 C Provider 配置   | P1.30                                                 |
