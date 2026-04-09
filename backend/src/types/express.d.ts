/**
 * Express Request 类型扩展
 * 2026-04-07 新增 — P1.06 / P1.08 / P1.11
 * 设计思路：通过 declaration merging 扩展 Express.Request，
 *   避免各处 as Record<string, unknown> 类型断言
 * 影响范围：全局 Express 类型
 * 潜在风险：无已知风险
 */

import type { RequestUser } from './common';

declare global {
  namespace Express {
    interface Request {
      /** 请求唯一标识，由 requestLogger 中间件注入 */
      requestId?: string;
      /** 认证后的用户信息，由 auth 中间件注入 */
      user?: RequestUser;
      /** 客户端指纹，由 fingerprint 中间件注入 */
      fingerprint?: string;
    }
  }
}
