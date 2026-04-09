/**
 * 黑名单拦截中间件
 * 2026-04-07 新增 — P1.20
 * 设计思路：请求链最前端检查 IP / userId / fingerprint 三维度，
 *   任一命中则 403 拦截。全局挂载，所有请求均经过
 * 影响范围：全局中间件链（app.ts 中最早挂载）
 * 潜在风险：Redis 不可用时降级 DB 查询，延迟上升但不会误放
 */

import type { Request, Response, NextFunction } from 'express';
import { checkMultiDimension } from '../services/blacklist.service';
import { AppError } from '../utils/errors';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('blacklist-mw');

/**
 * 从请求中提取客户端真实 IP
 * 支持 X-Forwarded-For / X-Real-IP / req.ip
 */
function getClientIp(req: Request): string | undefined {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') {
    return xff.split(',')[0].trim();
  }
  const xri = req.headers['x-real-ip'];
  if (typeof xri === 'string') {
    return xri.trim();
  }
  return req.ip || undefined;
}

/**
 * 黑名单拦截中间件
 */
export async function blacklistGuard(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const ip = getClientIp(req);
    const userId = req.user?.userId;
    const fingerprint = req.fingerprint;

    const result = await checkMultiDimension(ip, userId, fingerprint);

    if (result.blocked) {
      log.warn(
        { ip, userId, fingerprint, retryAfter: result.retryAfter },
        'Request blocked by blacklist',
      );
      throw new AppError('BLACKLIST_BLOCKED', undefined, {
        retryAfter: result.retryAfter,
      });
    }

    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    // 黑名单检查失败不应阻断请求 — 降级放行
    log.error({ err }, 'Blacklist check failed, allowing request');
    next();
  }
}
