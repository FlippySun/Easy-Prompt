/**
 * OAuth 路由 — 第三方登录（GitHub / Google）
 * 2026-04-09 新增 — P6.03
 * 变更类型：新增
 * 设计思路：
 *   1. GET  /oauth/:provider — 重定向到第三方授权页面
 *   2. GET  /oauth/:provider/callback — 回调处理（授权码 → token → 登录/注册）
 *   state 参数用 Redis 存储防 CSRF
 * 影响范围：/api/v1/auth/oauth/*
 * 潜在风险：
 *   - 需确保 state 严格校验防 CSRF
 *   - 第三方 API 可用性不可控
 */

import { Router } from 'express';
import crypto from 'crypto';
import { getAuthUrl, handleCallback, linkOrCreateUser } from '../services/oauth.service';
import type { OAuthProvider } from '../services/oauth.service';
import { redis } from '../lib/redis';
import { AppError } from '../utils/errors';
import { createChildLogger } from '../utils/logger';
import { config } from '../config';

const log = createChildLogger('oauth');
const router = Router();

// OAuth state 过期时间（10 分钟）
const STATE_TTL_SEC = 600;

// 支持的 OAuth provider 白名单
const VALID_PROVIDERS = new Set<string>(['github', 'google']);

/**
 * GET /api/v1/auth/oauth/:provider — 发起 OAuth 授权
 * 2026-04-09 新增 — P6.03
 * 生成 state 防 CSRF，存 Redis，重定向到第三方
 */
router.get('/:provider', async (req, res, next) => {
  try {
    const { provider } = req.params;
    if (!VALID_PROVIDERS.has(provider)) {
      throw new AppError('VALIDATION_FAILED', `Unsupported OAuth provider: ${provider}`);
    }

    // 可选：从 query 中获取前端回调 URL（登录成功后跳转）
    const frontendRedirect = (req.query.redirect as string) || '';

    // 生成 CSRF state
    const state = crypto.randomBytes(32).toString('hex');
    // 存 Redis：state → frontendRedirect（回调时取出）
    await redis.setex(`oauth:state:${state}`, STATE_TTL_SEC, frontendRedirect);

    const authUrl = getAuthUrl(provider as OAuthProvider, state);
    res.redirect(authUrl);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/auth/oauth/:provider/callback — OAuth 回调
 * 2026-04-09 新增 — P6.03
 * 流程：验证 state → 用 code 换 profile → 登录/注册 → 返回 JWT
 */
router.get('/:provider/callback', async (req, res, _next) => {
  try {
    const { provider } = req.params;
    const { code, state, error: oauthError } = req.query as Record<string, string>;

    // OAuth 提供方返回错误
    if (oauthError) {
      log.warn({ provider, oauthError }, 'OAuth provider returned error');
      return res.redirect(buildErrorRedirect('OAuth authorization denied'));
    }

    if (!VALID_PROVIDERS.has(provider)) {
      throw new AppError('VALIDATION_FAILED', `Unsupported OAuth provider: ${provider}`);
    }

    if (!code || !state) {
      throw new AppError('VALIDATION_FAILED', 'Missing code or state parameter');
    }

    // 验证 state（防 CSRF）
    const stateKey = `oauth:state:${state}`;
    const frontendRedirect = await redis.get(stateKey);
    if (frontendRedirect === null) {
      throw new AppError('AUTH_TOKEN_INVALID', 'Invalid or expired OAuth state');
    }
    // 一次性使用，立即删除
    await redis.del(stateKey);

    // 用授权码换取用户 profile
    const profile = await handleCallback(provider as OAuthProvider, code);
    log.info({ provider, providerId: profile.providerId }, 'OAuth callback — profile obtained');

    // 关联或创建用户
    const result = await linkOrCreateUser(provider as OAuthProvider, profile);

    // 设置 refresh token cookie（与普通登录一致）
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      domain: config.COOKIE_DOMAIN,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
      path: '/',
    });

    // 重定向回前端（带 accessToken 参数）
    const redirectUrl = frontendRedirect || `${config.OAUTH_CALLBACK_BASE_URL || ''}/`;
    const separator = redirectUrl.includes('?') ? '&' : '?';
    const finalUrl = `${redirectUrl}${separator}access_token=${result.accessToken}&is_new=${result.isNewUser}`;

    res.redirect(finalUrl);
  } catch (err) {
    log.error({ err }, 'OAuth callback failed');
    // 重定向到前端错误页而非返回 JSON
    const message = err instanceof AppError ? err.message : 'OAuth login failed';
    res.redirect(buildErrorRedirect(message));
  }
});

/**
 * 构建错误重定向 URL
 * 2026-04-09 — P6.03：OAuth 错误重定向到前端登录页
 */
function buildErrorRedirect(message: string): string {
  const base = config.OAUTH_CALLBACK_BASE_URL || '';
  return `${base}/login?error=${encodeURIComponent(message)}`;
}

export default router;
