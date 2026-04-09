/**
 * 认证中间件
 * 2026-04-07 新增 — P1.14 Auth 中间件
 * 设计思路：从 Authorization header 或 cookie 中提取 JWT，
 *   验证后将用户信息注入 req.user，支持 requireAuth（强制）和 optionalAuth（可选）
 * 影响范围：需要认证的路由
 * 潜在风险：无已知风险
 */

import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { AppError } from '../utils/errors';
import { createChildLogger } from '../utils/logger';
import { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';

const log = createChildLogger('auth');

/**
 * 从请求中提取 Bearer token
 * 优先级：Authorization header > cookie(access_token)
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  // 回退到 cookie（Web 端可能使用 httpOnly cookie）
  if (req.cookies?.access_token) {
    return req.cookies.access_token as string;
  }
  return null;
}

/**
 * 强制认证中间件 — 未登录则 401
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    throw new AppError('AUTH_UNAUTHORIZED', 'Authentication required');
  }

  try {
    const decoded = verifyToken(token);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      throw new AppError('AUTH_TOKEN_EXPIRED');
    }
    if (err instanceof JsonWebTokenError) {
      throw new AppError('AUTH_TOKEN_INVALID');
    }
    log.error({ err }, 'Unexpected auth error');
    throw new AppError('AUTH_TOKEN_INVALID');
  }
}

/**
 * 可选认证中间件 — 有 token 就解析，没有也放行
 * 用于公开接口中需要识别用户身份的场景（如已登录时显示"已点赞"状态）
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    const decoded = verifyToken(token);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
  } catch {
    // token 无效时静默忽略，视为未登录
  }

  next();
}

/**
 * 管理员权限中间件 — 必须在 requireAuth 之后使用
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new AppError('AUTH_UNAUTHORIZED');
  }
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw new AppError('PERMISSION_ADMIN_REQUIRED');
  }
  next();
}
