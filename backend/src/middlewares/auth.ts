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
 * 2026-04-16 新增 — 认证态注入与错误映射复用助手
 * 变更类型：新增/重构/安全
 * 功能描述：统一封装 JWT 解码后的 req.user 注入，以及 TokenExpired / JsonWebToken 异常到 AppError 的映射，供 requireAuth 与路由级严格 optional auth 复用。
 * 设计思路：
 *   1. 将重复的 req.user 赋值与异常分支从多个中间件中抽出，避免 skill proxy 修复时继续散落同类逻辑。
 *   2. 保持既有 AUTH_TOKEN_EXPIRED / AUTH_TOKEN_INVALID 语义不变，让共享 errorHandler 继续返回统一 401 错误体。
 * 参数与返回值：
 *   - assignAuthenticatedUser(req, decoded)：写入 req.user，无返回值。
 *   - throwAuthTokenError(err)：接收 verifyToken 抛出的异常并始终抛出 AppError，无返回值。
 * 影响范围：backend/src/middlewares/auth.ts、需要 Bearer 401 语义的公开路由。
 * 潜在风险：无已知风险。
 */
function assignAuthenticatedUser(req: Request, decoded: ReturnType<typeof verifyToken>): void {
  req.user = {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
  };
}

function throwAuthTokenError(err: unknown): never {
  if (err instanceof TokenExpiredError) {
    throw new AppError('AUTH_TOKEN_EXPIRED');
  }
  if (err instanceof JsonWebTokenError) {
    throw new AppError('AUTH_TOKEN_INVALID');
  }
  log.error({ err }, 'Unexpected auth error');
  throw new AppError('AUTH_TOKEN_INVALID');
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
    assignAuthenticatedUser(req, decoded);
    next();
  } catch (err) {
    throwAuthTokenError(err);
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
    assignAuthenticatedUser(req, decoded);
  } catch {
    // token 无效时静默忽略，视为未登录
  }

  next();
}

/**
 * 2026-04-16 新增 — 路由级严格可选认证
 * 变更类型：新增/修复/安全
 * 功能描述：在“缺失 token 允许匿名，但若显式携带坏 token 就必须返回 401”的公开路由上复用同一套 JWT 解析逻辑。
 * 设计思路：
 *   1. 仅为少数需要客户端先 refresh 再匿名退化的路由提供严格模式，避免全局改变 optionalAuth 语义引发 prompts/collections 等公开接口回归。
 *   2. 缺失 token 仍保持匿名放行；只有 invalid / expired Bearer token 才抛出 401，让客户端拿到明确鉴权失败信号。
 * 参数与返回值：optionalAuthRejectInvalidToken(req, res, next) 无返回值；无 token 时 next()，坏 token 时抛出 AppError 401。
 * 影响范围：如 `/api/v1/auth/oauth/zhiz/skills` 这类需要 Bearer -> 401 -> refresh 契约的公开接口。
 * 潜在风险：若误用于普通公开路由，会把既有“坏 token 静默匿名”的体验改成 401，需要按路由显式选择。
 */
export function optionalAuthRejectInvalidToken(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const token = extractToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    const decoded = verifyToken(token);
    assignAuthenticatedUser(req, decoded);
    next();
  } catch (err) {
    throwAuthTokenError(err);
  }
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
