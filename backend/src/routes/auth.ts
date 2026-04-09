/**
 * Auth 路由 — 注册、登录、刷新、SSO、用户信息
 * 2026-04-07 新增 — P1.15/P1.16/P1.17
 * 设计思路：路由层仅做入参校验（Zod）+ 调用 service + 序列化响应
 * 影响范围：/api/v1/auth/* 端点
 * 潜在风险：无已知风险
 */

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate';
import { requireAuth } from '../middlewares/auth';
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
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const ssoAuthorizeSchema = z.object({
  redirectUri: z.string().url('Invalid redirect URI'),
});

const ssoTokenSchema = z.object({
  code: z.string().uuid('Invalid authorization code'),
  redirectUri: z.string().url('Invalid redirect URI'),
});

// ── Routes ──────────────────────────────────────────

/**
 * POST /api/v1/auth/register — 注册
 */
router.post('/register', validate({ body: registerSchema }), async (req, res, next) => {
  try {
    const result = await registerUser(req.body);
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
    const tokens = await refreshTokens(req.body.refreshToken);
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
