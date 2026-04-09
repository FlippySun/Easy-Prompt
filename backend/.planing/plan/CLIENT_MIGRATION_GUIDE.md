# 全端 AI 调用架构变更 — 客户端迁移指南

> P2.09 | 2026-04-08 | 版本 1.0
> 对应架构文档 §7.0

---

## 1. 变更概述

### 1.1 变更前（当前架构）

各端**直接调用外部 AI API**：

```
[VSCode/Browser/Web/IntelliJ] → [外部 AI API (OpenAI/Claude/Gemini)]
```

- 每个客户端持有 API Key
- 4 种 API 协议（openai / openai-responses / claude / gemini）在 4 处重复实现
- 用量无法统一监控，无法限流，无法审计

### 1.2 变更后（目标架构）

各端**统一调用后端 API**，后端代理转发到 AI 提供商：

```
[VSCode/Browser/Web/IntelliJ] → [api.zhiz.chat/api/v1/ai/enhance] → [AI Provider]
```

- 客户端无需持有 AI API Key
- 统一鉴权、限流、审计、日志
- 后端负责 Provider 管理和故障转移

### 1.3 迁移策略：双轨模式

**关键原则**：新接口失败时回退到本地直连，确保用户体验不降级。

```
callEnhance(input)
  ├─ try: 调用后端 API (api.zhiz.chat/api/v1/ai/enhance)
  │   ├─ 成功 → 返回结果
  │   └─ 失败 → 进入回退
  └─ catch: 回退到本地直连 AI API（现有逻辑）
       └─ 返回结果（标记 source: 'local-fallback'）
```

---

## 2. 后端 API 规范

### 2.1 增强接口

```
POST /api/v1/ai/enhance
Host: api.zhiz.chat
Content-Type: application/json
Authorization: Bearer <access_token>  (可选，匿名用户也可调用)
```

**Request Body:**

```json
{
  "input": "用户输入文本",
  "enhanceMode": "fast",
  "model": "gpt-4o",
  "language": "zh-CN",
  "clientType": "web"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "result": "增强后的 Prompt",
    "scenes": ["optimize", "api-design"],
    "composite": false,
    "model": "gpt-4o",
    "provider": "openai",
    "usage": {
      "promptTokens": 120,
      "completionTokens": 450,
      "totalTokens": 570
    }
  }
}
```

**Error Response (4xx/5xx):**

```json
{
  "success": false,
  "error": {
    "code": "AI_PROVIDER_ERROR",
    "message": "Provider temporarily unavailable",
    "httpStatus": 502
  }
}
```

### 2.2 认证方式

| 场景                       | 认证方式              | 说明                                             |
| -------------------------- | --------------------- | ------------------------------------------------ |
| Web SPA (prompt.zhiz.chat) | Cookie `access_token` | cross-subdomain cookie，`credentials: 'include'` |
| Browser Extension          | Bearer Token (header) | 存储在 `chrome.storage.local`                    |
| VS Code Extension          | Bearer Token (header) | 存储在 `SecretStorage`                           |
| IntelliJ Plugin            | Bearer Token (header) | 存储在 `PasswordSafe`                            |
| 匿名用户                   | 无认证                | `optionalAuth` 中间件允许匿名，受更严格限流      |

### 2.3 客户端类型标识

每个请求必须携带 `clientType` 字段：

| 客户端              | clientType 值 |
| ------------------- | ------------- |
| VS Code             | `vscode`      |
| Browser Extension   | `browser`     |
| Web SPA             | `web`         |
| IntelliJ Plugin     | `intellij`    |
| PromptHub (web-hub) | `web-hub`     |

---

## 3. 各端改动清单

### 3.1 Web SPA (`web/app.js`)

**改动范围**：~50-100 行

1. **新增 API 客户端封装**

   ```javascript
   async function callBackendApi(endpoint, options = {}) {
     const resp = await fetch(`https://api.zhiz.chat${endpoint}`, {
       ...options,
       credentials: 'include', // cross-subdomain cookie
       headers: {
         'Content-Type': 'application/json',
         ...options.headers,
       },
     });
     const data = await resp.json();
     if (!data.success) throw new Error(data.error?.message || 'Backend error');
     return data;
   }
   ```

2. **AI 增强双轨改造**

   ```javascript
   // 现有 callEnhance() 改造为：
   async function callEnhance(input, config) {
     try {
       // 优先尝试后端 API
       const resp = await callBackendApi('/api/v1/ai/enhance', {
         method: 'POST',
         body: JSON.stringify({
           input,
           enhanceMode: config.enhanceMode,
           model: config.model,
           language: config.language,
           clientType: 'web',
         }),
       });
       return { ...resp.data, source: 'backend' };
     } catch (err) {
       console.warn('[Easy Prompt] Backend fallback:', err.message);
       // 回退到本地直连
       return { ...(await localEnhance(input, config)), source: 'local-fallback' };
     }
   }
   ```

3. **登录跳转**：未登录用户引导到 `zhiz.chat/auth/login?redirect_uri=prompt.zhiz.chat`

4. **错误提示映射**：后端错误码 → 用户友好中文提示

### 3.2 Browser Extension (`browser/`)

**改动文件**：

- `browser/shared/api.js` — 新增后端 API 调用封装
- `browser/background/service-worker.js` — 增强流程改造
- `browser/popup/popup.js` — Token 管理 UI
- `browser/options/options.js` — 后端连接设置

**改动要点**：

1. `shared/api.js` 新增 `callBackendEnhance(input, config)` 函数
2. `service-worker.js` 的 `ENHANCE_INLINE` 处理增加双轨逻辑
3. Token 存储在 `chrome.storage.local` key `ep-auth-token`
4. Options 页面增加"后端连接"开关和 Token 输入

### 3.3 VS Code Extension (`extension.js`)

**改动范围**：~30-50 行

1. 新增 `callBackendApi()` 使用 Node.js `fetch`（Node 18+）
2. `smartEnhance()` 增加双轨逻辑
3. Token 通过 `context.secrets.store('ep-auth-token', token)` 存储
4. 设置项新增 `easyPrompt.backendEnabled` (boolean) 和 `easyPrompt.backendUrl` (string)

### 3.4 IntelliJ Plugin (`intellij/`)

**改动文件**：

- `core/ApiClient.kt` — 新增后端 API 调用方法
- `settings/EasyPromptSettings.kt` — 新增后端配置字段

**改动要点**：

1. `ApiClient.kt` 新增 `callBackendEnhance()` 方法
2. 双轨逻辑在 `EnhanceAction.kt` 中实现
3. Token 通过 `PasswordSafe` 存储
4. Settings 新增 Backend URL、Enable Backend 选项

---

## 4. 迁移顺序

建议按以下顺序逐端迁移，每端完成后验证再进入下一端：

| 顺序 | 端                | 任务号 | 风险              | 原因                          |
| ---- | ----------------- | ------ | ----------------- | ----------------------------- |
| 1    | Web SPA           | P2.10  | 高（monolithic）  | 与后端同域，cookie 认证最简单 |
| 2    | Browser Extension | P2.11  | 高（22 站点适配） | 用户量大，需充分测试          |
| 3    | VS Code           | P2.12  | 中                | 成熟架构，改动小              |
| 4    | IntelliJ          | P2.13  | 中                | 独立代码库，影响范围可控      |

---

## 5. 回退方案

### 5.1 双轨开关

每个客户端增加配置开关：

- **开启后端**（默认）：优先调用后端 API，失败自动回退
- **关闭后端**：完全使用本地直连（恢复原有行为）
- **仅后端**：不允许回退（适用于企业部署场景）

### 5.2 紧急回退

如果后端服务出现严重问题：

1. 各端配置默认关闭后端模式（恢复本地直连）
2. VS Code / IntelliJ 发布 hotfix 版本
3. Browser Extension 通过远程配置下发关闭信号
4. Web SPA 直接修改服务端配置

---

## 6. 测试清单

每端迁移完成后须验证：

- [ ] 正常增强流程（后端模式）
- [ ] 后端不可用时自动回退到本地直连
- [ ] 匿名用户可正常使用（受限流）
- [ ] 已登录用户增强流程正常
- [ ] 错误提示用户友好（网络错误、限流、Provider 错误）
- [ ] 历史记录正常保存
- [ ] 性能无明显退化（增加一跳的延迟 < 100ms）
- [ ] 双轨开关切换正常

---

## 7. DNS 与基础设施前置条件

| 条件                     | 状态      | 说明                                 |
| ------------------------ | --------- | ------------------------------------ |
| `api.zhiz.chat` DNS 解析 | ✅ 已完成 | A 记录指向 VPS 107.151.137.198       |
| SSL 证书                 | ✅ 已完成 | 宝塔面板 Let's Encrypt 自动续签      |
| Nginx 反向代理           | ✅ 已完成 | `api.zhiz.chat` → `127.0.0.1:3000`   |
| CORS 配置                | ✅ 已实现 | `backend/src/app.ts` CORS 中间件     |
| Cookie 跨子域            | ✅ 已配置 | `domain=.zhiz.chat`, `SameSite=Lax`  |
| PostgreSQL               | ✅ 已部署 | VPS PostgreSQL 16, DB: `easy_prompt` |
| Redis                    | ✅ 已部署 | VPS Redis 7, prefix: `ep:`           |
| PM2 进程管理             | ✅ 已配置 | `easy-prompt-backend` 进程           |

---

## 8. 实际实现状态（2026-04-08 Phase 9 执行）

| 功能模块             | 状态 | 改动文件                                                                  |
| -------------------- | ---- | ------------------------------------------------------------------------- |
| P9.01 DNS + SSL      | ✅   | 基础设施，无代码改动                                                      |
| P9.02 Nginx 反向代理 | ✅   | `backend/scripts/setup-nginx-bt.conf`                                     |
| P9.03 Web SPA 双轨   | ✅   | `web/app.js` — dualTrackEnhance + callBackendEnhance                      |
| P9.04 Browser 双轨   | ✅   | `browser/shared/api.js`, `browser/popup/popup.js`                         |
| P9.05 VS Code 双轨   | ✅   | `core/api.js`, `extension.js`, `package.json`                             |
| P9.06 IntelliJ 双轨  | ✅   | `intellij/.../ApiClient.kt`, `EasyPromptSettings.kt`                      |
| P9.07 requestId 透传 | ✅   | 各端 callBackendEnhance 已包含 X-Request-Id                               |
| P9.08 错误码映射     | ✅   | 各端 BACKEND_ERROR_MAP + mapBackendError                                  |
| P9.09 三模式开关     | ✅   | auto/backend-only/local-only 全 4 端                                      |
| P9.10 SSO（首期）    | ✅   | 手动 Token 输入（Browser Options + VS Code Settings + IntelliJ Settings） |
| P9.11 集成测试       | ✅   | `tests/test-backend-integration.js`                                       |
| P9.12 文档更新       | ✅   | 本文档 + `RELEASE_CHECKLIST.md`                                           |

---

_本文档描述迁移方案与实际实现状态。各端具体实现见 P2.10 - P2.14 + Phase 9 执行日志。_
