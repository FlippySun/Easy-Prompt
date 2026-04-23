/**
 * Auth 路由 — 注册、登录、刷新、SSO、用户信息
 * 2026-04-07 新增 — P1.15/P1.16/P1.17
 * 设计思路：路由层仅做入参校验（Zod）+ 调用 service + 序列化响应
 * 影响范围：/api/v1/auth/* 端点
 * 潜在风险：无已知风险
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate';
import { requireAuth } from '../middlewares/auth';
import { config, getCookieDomain } from '../config';
import {
  registerUser,
  loginUser,
  refreshTokens,
  getUserProfile,
  generateSsoCode,
  exchangeSsoCode,
} from '../services/auth.service';
import { PASSWORD_POLICY } from '../config/constants';

const router = Router();

// ── Zod Schemas ──────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  username: z
    .string()
    .min(3, 'Username must be 3-50 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, _ and -'),
  password: z
    .string()
    .min(PASSWORD_POLICY.MIN_LENGTH, `Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters`)
    .max(PASSWORD_POLICY.MAX_LENGTH)
    .regex(PASSWORD_POLICY.PATTERN, 'Password must contain uppercase, lowercase and digit'),
  displayName: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required').optional(),
});

const ssoAuthorizeSchema = z.object({
  redirectUri: z.string().url('Invalid redirect URI'),
});

const ssoTokenSchema = z.object({
  code: z.string().uuid('Invalid authorization code'),
  redirectUri: z.string().url('Invalid redirect URI'),
});

/**
 * 2026-04-22 修复 — SSO 共享会话 refresh cookie 写入助手
 * 变更类型：fix
 * What：把 login/register/refresh 返回的 refresh token 同步写入受控 cookie，作为 Web/Web-Hub/Browser 之间的共享会话桥。
 * Why：仅依赖各端本地存储会导致跨 origin 或扩展环境无法自动复用登录态；补一层共享 refresh cookie 后，其他端可在需要时静默 bootstrap 新 token。
 * Params & return：`setSharedRefreshTokenCookie(res, refreshToken)` 接收 Express Response 与新的 refreshToken，无返回值。
 * Impact scope：`POST /api/v1/auth/login`、`/register`、`/refresh` 以及依赖共享 SSO 会话的前端静默恢复链路。
 * Risk：若部署环境未配置跨子域 cookie domain，cookie 会退化为 host-only；这是比错误扩域更安全的行为。
 */
function setSharedRefreshTokenCookie(
  res: Response,
  refreshToken: string,
): void {
  const cookieDomain = getCookieDomain();
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    ...(cookieDomain ? { domain: cookieDomain } : {}),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

/**
 * 2026-04-22 修复 — refresh token 来源统一解析
 * 变更类型：fix
 * What：允许 `/api/v1/auth/refresh` 优先读取 body.refreshToken，缺失时回退到共享 `refresh_token` cookie。
 * Why：Web-Hub 登录页与其他端的“已登录自动复用”需要一个跨端共享的会话真相来源；cookie fallback 可以避免只剩本地存储时的跨端断裂。
 * Params & return：`resolveRefreshToken(req)` 返回 string；当 body 与 cookie 都不存在时返回空字符串，由既有 service/error handler 继续给出 401。
 * Impact scope：`POST /api/v1/auth/refresh` 与所有基于 refresh 的静默登录恢复流程。
 * Risk：No known risks.
 */
function resolveRefreshToken(req: Request): string {
  if (typeof req.body?.refreshToken === 'string' && req.body.refreshToken.trim()) {
    return req.body.refreshToken.trim();
  }
  if (typeof req.cookies?.refresh_token === 'string' && req.cookies.refresh_token.trim()) {
    return req.cookies.refresh_token.trim();
  }
  return '';
}

// ── Routes ──────────────────────────────────────────

/**
 * POST /api/v1/auth/register — 注册
 */
router.post('/register', validate({ body: registerSchema }), async (req, res, next) => {
  try {
    const result = await registerUser(req.body);
    setSharedRefreshTokenCookie(res, result.tokens.refreshToken);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/login — 登录
 */
router.post('/login', validate({ body: loginSchema }), async (req, res, next) => {
  try {
    const result = await loginUser(req.body);
    setSharedRefreshTokenCookie(res, result.tokens.refreshToken);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/refresh — 刷新 Token
 */
router.post('/refresh', validate({ body: refreshSchema }), async (req, res, next) => {
  try {
    const tokens = await refreshTokens(resolveRefreshToken(req));
    setSharedRefreshTokenCookie(res, tokens.refreshToken);
    res.json({ success: true, data: tokens });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/auth/me — 获取当前用户信息
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const profile = await getUserProfile(req.user!.userId);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/sso/authorize — 生成 SSO 授权码（需登录）
 */
router.post(
  '/sso/authorize',
  requireAuth,
  validate({ body: ssoAuthorizeSchema }),
  async (req, res, next) => {
    try {
      const code = await generateSsoCode(req.user!.userId, req.body.redirectUri);
      res.json({ success: true, data: { code } });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/auth/sso/token — 用授权码换 Token
 */
router.post('/sso/token', validate({ body: ssoTokenSchema }), async (req, res, next) => {
  try {
    const result = await exchangeSsoCode(req.body.code, req.body.redirectUri);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
