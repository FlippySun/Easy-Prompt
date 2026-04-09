/**
 * 限流中间件工厂
 * 2026-04-07 新增 — P1.24
 * 设计思路：按场景（global / ai / login / search）创建不同限流参数的中间件
 *   维度优先级：userId > fingerprint > IP
 * 影响范围：路由级别或全局挂载
 * 潜在风险：Redis 不可用时降级放行
 */

import type { Request, Response, NextFunction } from 'express';
import { checkRateLimit } from '../services/rateLimiter.service';
import { AppError } from '../utils/errors';

export interface RateLimitOptions {
  /** 窗口内最大请求数 */
  max: number;
  /** 窗口时长（秒） */
  windowSec: number;
  /** 限流维度标识前缀（如 'global', 'ai', 'login'），用于隔离不同场景 */
  scope: string;
}

/**
 * 创建限流中间件
 * @param options 限流参数
 * 2026-04-08 修复 — 测试环境跳过限流，避免集成测试因累积请求触发 429
 */
export function createRateLimiter(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // 测试环境跳过限流 — 限流为基础设施行为，集成测试应聚焦业务逻辑
    if (process.env.NODE_ENV === 'test') {
      next();
      return;
    }

    // 确定限流实体：优先 userId，其次 fingerprint，兜底 IP
    let entityType: string;
    let entityValue: string;

    if (req.user?.userId) {
      entityType = `${options.scope}:user`;
      entityValue = req.user.userId;
    } else if (req.fingerprint) {
      entityType = `${options.scope}:fp`;
      entityValue = req.fingerprint;
    } else {
      entityType = `${options.scope}:ip`;
      entityValue = req.ip || 'unknown';
    }

    const result = await checkRateLimit(entityType, entityValue, options.max, options.windowSec);

    // 设置标准限流响应头
    res.setHeader('X-RateLimit-Limit', options.max);
    res.setHeader('X-RateLimit-Remaining', result.remaining);

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter ?? options.windowSec);
      next(
        new AppError('RATE_LIMIT_EXCEEDED', undefined, {
          retryAfter: result.retryAfter,
        }),
      );
      return;
    }

    next();
  };
}
