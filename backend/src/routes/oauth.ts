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
import { z } from 'zod';
import {
  completeZhizPasswordSetupChallenge,
  createZhizContinuationTicketSeed,
  finishZhizContinuation,
  getAuthUrl,
  handleCallback,
  linkOrCreateUser,
  startZhizPasswordSetupChallenge,
} from '../services/oauth.service';
import type {
  OAuthProvider,
  ZhizEmailVerificationChallengeState,
  ZhizContinuationFinishInput,
  ZhizPasswordSetupCompleteInput,
  ZhizContinuationTicketState,
} from '../services/oauth.service';
import { redis } from '../lib/redis';
import { optionalAuth } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { AppError } from '../utils/errors';
import { createChildLogger } from '../utils/logger';
import { config } from '../config';

const log = createChildLogger('oauth');
const router = Router();

// OAuth state 过期时间（10 分钟）
const STATE_TTL_SEC = 600;
const OAUTH_CALLBACK_LOCK_TTL_SEC = 60;
const CONTINUATION_TICKET_TTL_SEC = 600;

// 支持的 OAuth provider 白名单
const VALID_PROVIDERS = new Set<string>(['github', 'google', 'zhiz']);

interface OAuthStateContext {
  provider: OAuthProvider;
  oauthNonce: string;
  clientRedirectUri: string;
  clientState: string;
  webReturnTo: string;
  frontendRedirect: string;
  initiatingUserId: string;
}

interface ZhizContinuationTicketPayload extends ZhizContinuationTicketState {
  clientRedirectUri: string;
  clientState: string;
  webReturnTo: string;
}

const zhizTicketPattern = /^[a-f0-9]{64}$/i;
const zhizStatusQuerySchema = z.object({
  ticket: z.string().regex(zhizTicketPattern, 'Invalid Zhiz continuation ticket'),
});
const zhizFinishBodySchema = z.object({
  ticket: z.string().regex(zhizTicketPattern, 'Invalid Zhiz continuation ticket'),
  email: z.string().email('Invalid email format').optional(),
  password: z.string().min(1, 'Password is required').optional(),
});
const zhizPasswordSetupStartBodySchema = z.object({
  ticket: z.string().regex(zhizTicketPattern, 'Invalid Zhiz continuation ticket'),
});
const zhizPasswordSetupCompleteBodySchema = z.object({
  ticket: z.string().regex(zhizTicketPattern, 'Invalid Zhiz continuation ticket'),
  code: z.string().regex(/^\d{6}$/, 'Invalid email verification code'),
  newPassword: z.string().min(1, 'New password is required').optional(),
});
const zhizTicketPayloadSchema = z.object({
  provider: z.literal('zhiz'),
  status: z.enum(['ready', 'needs_email']),
  step: z.enum(['collect_email', 'verify_email', 'verify_email_and_set_password']).optional(),
  linkedUserId: z.string().uuid().nullable(),
  providerId: z.string().min(1),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  encryptedAccessToken: z.string().min(1),
  rawProfile: z.record(z.string(), z.unknown()),
  targetUserId: z.string().uuid().nullable().optional(),
  targetEmail: z.string().email().nullable().optional(),
  maskedEmail: z.string().nullable().optional(),
  verificationMode: z
    .enum(['create_user', 'bind_existing_user', 'set_password_and_bind'])
    .nullable()
    .optional(),
  requiresNewPassword: z.boolean().optional(),
  consumedAt: z.string().nullable().optional(),
  clientRedirectUri: z.string(),
  clientState: z.string(),
  webReturnTo: z.string(),
});
const zhizEmailVerificationChallengeSchema = z.object({
  targetUserId: z.string().uuid().nullable(),
  targetEmail: z.string().email(),
  maskedEmail: z.string(),
  verificationMode: z.enum(['create_user', 'bind_existing_user', 'set_password_and_bind']),
  requiresNewPassword: z.boolean(),
  codeHash: z.string().min(1),
  expiresAt: z.string(),
  resendAvailableAt: z.string(),
  attemptCount: z.number().int().nonnegative(),
});

/**
 * 2026-04-14 新增 — Zhiz OAuth Superpowers Execute T2
 * 变更类型：新增/重构
 * 功能描述：把 OAuth start 阶段 Redis state 从单字符串升级为结构化上下文，
 *   同时为 Zhiz 引入 oauthNonce 双保险并保留旧 provider 的回调兼容读取能力。
 * 设计思路：
 *   1. 外层 SSO 的 clientRedirectUri/clientState 与内层 OAuth 的 state/oauthNonce 明确拆分。
 *   2. Redis 允许读旧字符串与新 JSON，避免一次切换打断既有 GitHub/Google 流程。
 *   3. AUTH_WEB_BASE_URL 仅用于前端页面回跳，和 provider callback URL 基准解耦。
 * 参数与返回值：
 *   - getQueryValue(value): 解析 query 中的单字符串值。
 *   - buildOAuthStateContext(provider, query, oauthNonce): 生成结构化 state 上下文。
 *   - parseOAuthStateContext(provider, rawStateValue): 兼容解析旧/新 state 存储格式。
 *   - buildFrontendUrl(pathname): 返回前端登录页/首页等页面回跳地址。
 * 影响范围：/api/v1/auth/oauth/:provider start/callback 路由。
 * 潜在风险：若 AUTH_WEB_BASE_URL 缺失，将回退为相对路径，不影响本地与测试环境可运行性。
 */
function getQueryValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return '';
}

function buildOAuthStateContext(
  provider: OAuthProvider,
  query: Record<string, unknown>,
  oauthNonce: string,
  initiatingUserId: string,
): OAuthStateContext {
  return {
    provider,
    oauthNonce,
    clientRedirectUri: getQueryValue(query.clientRedirectUri) || getQueryValue(query.redirect_uri),
    clientState: getQueryValue(query.clientState) || getQueryValue(query.state),
    webReturnTo: getQueryValue(query.webReturnTo),
    frontendRedirect: getQueryValue(query.redirect),
    initiatingUserId,
  };
}

function parseOAuthStateContext(provider: OAuthProvider, rawStateValue: string): OAuthStateContext {
  try {
    const parsed = JSON.parse(rawStateValue) as Partial<OAuthStateContext>;
    const parsedProvider =
      parsed.provider === 'github' || parsed.provider === 'google' || parsed.provider === 'zhiz'
        ? parsed.provider
        : provider;
    return {
      provider: parsedProvider,
      oauthNonce: typeof parsed.oauthNonce === 'string' ? parsed.oauthNonce : '',
      clientRedirectUri:
        typeof parsed.clientRedirectUri === 'string' ? parsed.clientRedirectUri : '',
      clientState: typeof parsed.clientState === 'string' ? parsed.clientState : '',
      webReturnTo: typeof parsed.webReturnTo === 'string' ? parsed.webReturnTo : '',
      frontendRedirect: typeof parsed.frontendRedirect === 'string' ? parsed.frontendRedirect : '',
      initiatingUserId: typeof parsed.initiatingUserId === 'string' ? parsed.initiatingUserId : '',
    };
  } catch {
    return {
      provider,
      oauthNonce: '',
      clientRedirectUri: '',
      clientState: '',
      webReturnTo: '',
      frontendRedirect: rawStateValue,
      initiatingUserId: '',
    };
  }
}

function buildFrontendBaseUrl(): string {
  return config.AUTH_WEB_BASE_URL || config.OAUTH_CALLBACK_BASE_URL || '';
}

function buildFrontendUrl(pathname: string): string {
  const base = buildFrontendBaseUrl().replace(/\/+$/, '');
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

function buildZhizCompleteRedirect(ticket: string): string {
  return `${buildFrontendUrl('/auth/zhiz/complete')}?ticket=${encodeURIComponent(ticket)}`;
}

/**
 * 2026-04-14 新增 — Zhiz OAuth Superpowers Execute T4
 * 变更类型：新增/路由工具
 * 功能描述：为 Zhiz continuation `status/finish` 提供 ticket 读取、持久化与对外响应整形。
 * 设计思路：
 *   1. ticket 缺失/格式错误/已过期/已消费在 route 层统一判定，service 层只处理账号业务。
 *   2. 已消费 ticket 保留原 Redis key 并写入 consumedAt，保证重复调用返回明确错误码。
 *   3. status 响应只暴露前端必要字段，不泄露 providerId、encryptedAccessToken、rawProfile。
 * 参数与返回值：各函数见签名；统一服务于 Zhiz continuation API。
 * 影响范围：`GET /api/v1/auth/oauth/zhiz/status`、`POST /api/v1/auth/oauth/zhiz/finish`。
 * 潜在风险：无已知风险。
 */
function buildZhizTicketKey(ticket: string): string {
  return `oauth:zhiz:ticket:${ticket}`;
}

function buildZhizEmailVerifyKey(ticket: string): string {
  return `oauth:zhiz:email-verify:${ticket}`;
}

function getRemainingSeconds(timestamp: string): number {
  const expiresAtMs = new Date(timestamp).getTime();
  if (Number.isNaN(expiresAtMs)) {
    return 0;
  }
  return Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000));
}

function parseZhizTicketPayload(rawTicketValue: string): ZhizContinuationTicketPayload {
  const parsed = JSON.parse(rawTicketValue) as unknown;
  const result = zhizTicketPayloadSchema.safeParse(parsed);
  if (!result.success) {
    throw new AppError('AUTH_ZHIZ_TICKET_INVALID', 'Zhiz continuation ticket payload is invalid');
  }
  return result.data;
}

function parseZhizEmailVerificationChallengePayload(
  rawChallengeValue: string,
): ZhizEmailVerificationChallengeState {
  const parsed = JSON.parse(rawChallengeValue) as unknown;
  const result = zhizEmailVerificationChallengeSchema.safeParse(parsed);
  if (!result.success) {
    throw new AppError(
      'AUTH_ZHIZ_TICKET_INVALID',
      'Zhiz email verification challenge payload is invalid',
    );
  }
  return result.data;
}

async function loadZhizContinuationTicket(ticket: string): Promise<{
  key: string;
  ttlSec: number;
  payload: ZhizContinuationTicketPayload;
}> {
  const key = buildZhizTicketKey(ticket);
  const [rawTicketValue, ttlSec] = await Promise.all([redis.get(key), redis.ttl(key)]);
  if (rawTicketValue === null) {
    throw new AppError('AUTH_ZHIZ_TICKET_EXPIRED', 'Zhiz continuation ticket has expired');
  }

  let payload: ZhizContinuationTicketPayload;
  try {
    payload = parseZhizTicketPayload(rawTicketValue);
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError('AUTH_ZHIZ_TICKET_INVALID', 'Zhiz continuation ticket payload is invalid');
  }

  if (payload.consumedAt) {
    throw new AppError(
      'AUTH_ZHIZ_TICKET_CONSUMED',
      'Zhiz continuation ticket has already been consumed',
    );
  }

  return {
    key,
    ttlSec: ttlSec > 0 ? ttlSec : CONTINUATION_TICKET_TTL_SEC,
    payload,
  };
}

async function loadZhizEmailVerificationChallenge(ticket: string): Promise<{
  key: string;
  ttlSec: number;
  payload: ZhizEmailVerificationChallengeState;
} | null> {
  const key = buildZhizEmailVerifyKey(ticket);
  const [rawChallengeValue, ttlSec] = await Promise.all([redis.get(key), redis.ttl(key)]);
  if (rawChallengeValue === null) {
    return null;
  }

  let payload: ZhizEmailVerificationChallengeState;
  try {
    payload = parseZhizEmailVerificationChallengePayload(rawChallengeValue);
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError(
      'AUTH_ZHIZ_TICKET_INVALID',
      'Zhiz email verification challenge payload is invalid',
    );
  }

  return {
    key,
    ttlSec: ttlSec > 0 ? ttlSec : getRemainingSeconds(payload.expiresAt),
    payload,
  };
}

async function persistZhizContinuationTicket(
  key: string,
  payload: ZhizContinuationTicketPayload,
  ttlSec: number,
): Promise<void> {
  await redis.setex(
    key,
    ttlSec > 0 ? ttlSec : CONTINUATION_TICKET_TTL_SEC,
    JSON.stringify(payload),
  );
}

async function persistZhizEmailVerificationChallenge(
  key: string,
  payload: ZhizEmailVerificationChallengeState,
  ttlSec: number,
): Promise<void> {
  await redis.setex(key, Math.max(1, ttlSec), JSON.stringify(payload));
}

async function deleteZhizEmailVerificationChallenge(ticket: string): Promise<void> {
  await redis.del(buildZhizEmailVerifyKey(ticket));
}

function buildZhizChallengeTtlSec(
  ticketTtlSec: number,
  challenge: ZhizEmailVerificationChallengeState,
): number {
  const challengeTtlSec = getRemainingSeconds(challenge.expiresAt);
  return Math.max(
    1,
    Math.min(ticketTtlSec > 0 ? ticketTtlSec : CONTINUATION_TICKET_TTL_SEC, challengeTtlSec),
  );
}

function buildZhizStatusResponse(
  payload: ZhizContinuationTicketPayload,
  challenge: ZhizEmailVerificationChallengeState | null,
) {
  return {
    status: payload.status,
    step: payload.step,
    profile: {
      displayName: payload.displayName,
      avatarUrl: payload.avatarUrl,
    },
    clientRedirectUri: payload.clientRedirectUri,
    clientState: payload.clientState,
    webReturnTo: payload.webReturnTo,
    ...(payload.maskedEmail ? { maskedEmail: payload.maskedEmail } : {}),
    ...(payload.verificationMode ? { verificationMode: payload.verificationMode } : {}),
    ...(typeof payload.requiresNewPassword === 'boolean'
      ? { requiresNewPassword: payload.requiresNewPassword }
      : {}),
    ...(challenge
      ? {
          resendAfterSec: getRemainingSeconds(challenge.resendAvailableAt),
          challengeExpiresInSec: getRemainingSeconds(challenge.expiresAt),
        }
      : {}),
  };
}

function buildZhizPasswordSetupChallengeResponse(
  payload: ZhizContinuationTicketPayload,
  challenge: ZhizEmailVerificationChallengeState,
) {
  return {
    maskedEmail: payload.maskedEmail ?? challenge.maskedEmail,
    verificationMode: payload.verificationMode ?? challenge.verificationMode,
    requiresNewPassword:
      typeof payload.requiresNewPassword === 'boolean'
        ? payload.requiresNewPassword
        : challenge.requiresNewPassword,
    resendAfterSec: getRemainingSeconds(challenge.resendAvailableAt),
    challengeExpiresInSec: getRemainingSeconds(challenge.expiresAt),
  };
}

/**
 * 2026-04-14 修复 — OAuth callback state 消费时机与 Zhiz 重放防御
 * 变更类型：修复/加固
 * 功能描述：为 OAuth callback 增加 state key/lock/replay 辅助函数，确保 state 仅在成功完成后消费，并让 Zhiz 的重复成功回调复用既有完成页跳转。
 * 设计思路：
 *   1. 将 state、lock、replay 的 Redis key 生成逻辑集中，避免 callback 主流程散落硬编码字符串。
 *   2. 失败时只释放短期处理锁，不删除 state，让用户在 TTL 内重新授权或重试 callback。
 *   3. Zhiz 成功后缓存 complete redirect，使 provider 或浏览器的重复 callback 直接命中已有 ticket，避免误报 Invalid or expired OAuth state。
 * 参数与返回值：各函数接收 stateLookupValue，返回对应 Redis key 字符串。
 * 影响范围：`GET /api/v1/auth/oauth/:provider/callback`、Zhiz 重复回调、OAuth state Redis 生命周期。
 * 潜在风险：处理锁 TTL 仅用于防并发，若未来下游回调耗时显著增长，需要同步调整锁时长。
 */
function buildOAuthStateKey(stateLookupValue: string): string {
  return `oauth:state:${stateLookupValue}`;
}

function buildOAuthStateLockKey(stateLookupValue: string): string {
  return `oauth:state:lock:${stateLookupValue}`;
}

function buildZhizReplayRedirectKey(stateLookupValue: string): string {
  return `oauth:zhiz:replay:${stateLookupValue}`;
}

/**
 * GET /api/v1/auth/oauth/:provider — 重定向到第三方授权页
 * 2026-04-14 修复 — 恢复结构化 OAuth start 路由
 * 变更类型：修复/加固
 * 功能描述：恢复 Zhiz/GitHub/Google 共用的 OAuth start 路由，统一生成 state、Zhiz nonce 双保险与结构化 Redis 上下文。
 * 设计思路：
 *   1. 继续让 Zhiz 复用 `state === oauthNonce`，确保 callback 缺失 state 时仍可用 nonce 兜底。
 *   2. Redis 中持久化结构化上下文，为 callback 成功页与外层 SSO 回跳保留足够状态。
 *   3. state key 统一走 buildOAuthStateKey，避免 start/callback 两侧键名漂移。
 * 参数与返回值：无显式入参；根据 `:provider` 与 query 生成 302 重定向到第三方授权页。
 * 影响范围：`GET /api/v1/auth/oauth/:provider`、Zhiz OAuth 起始跳转、Redis state 生命周期。
 * 潜在风险：若 provider query 契约调整，需要同步更新 buildOAuthStateContext 的字段映射。
 */
router.get('/:provider', optionalAuth, async (req, res, next) => {
  try {
    const provider = String(req.params.provider);
    const oauthProvider = provider as OAuthProvider;
    if (!VALID_PROVIDERS.has(provider)) {
      throw new AppError('VALIDATION_FAILED', `Unsupported OAuth provider: ${provider}`);
    }

    const state = crypto.randomBytes(32).toString('hex');
    const oauthNonce = oauthProvider === 'zhiz' ? state : '';
    const stateContext = buildOAuthStateContext(
      oauthProvider,
      req.query as Record<string, unknown>,
      oauthNonce,
      req.user?.userId ?? '',
    );

    await redis.setex(buildOAuthStateKey(state), STATE_TTL_SEC, JSON.stringify(stateContext));

    const authUrl = getAuthUrl(oauthProvider, state, { oauthNonce });
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
    const provider = String(req.params.provider);
    const { code, state, nonce, error: oauthError } = req.query as Record<string, string>;
    const oauthProvider = provider as OAuthProvider;
    const stateLookupValue = oauthProvider === 'zhiz' ? state || nonce : state;

    // OAuth 提供方返回错误
    if (oauthError) {
      log.warn({ provider, oauthError }, 'OAuth provider returned error');
      return res.redirect(buildErrorRedirect('OAuth authorization denied'));
    }

    if (!VALID_PROVIDERS.has(provider)) {
      throw new AppError('VALIDATION_FAILED', `Unsupported OAuth provider: ${provider}`);
    }

    if (!code || !stateLookupValue) {
      throw new AppError('VALIDATION_FAILED', 'Missing code or state parameter');
    }

    // 验证 state（防 CSRF）
    const stateKey = buildOAuthStateKey(stateLookupValue);
    const stateLockKey = buildOAuthStateLockKey(stateLookupValue);
    const zhizReplayRedirectKey =
      oauthProvider === 'zhiz' ? buildZhizReplayRedirectKey(stateLookupValue) : '';

    if (oauthProvider === 'zhiz') {
      const replayRedirect = await redis.get(zhizReplayRedirectKey);
      if (replayRedirect) {
        log.warn(
          { provider, stateLookupValue },
          'Zhiz OAuth callback replay detected; redirecting to cached completion URL',
        );
        return res.redirect(replayRedirect);
      }
    }

    const storedStateValue = await redis.get(stateKey);
    if (storedStateValue === null) {
      throw new AppError('AUTH_TOKEN_INVALID', 'Invalid or expired OAuth state');
    }

    const lockResult = await redis.set(
      stateLockKey,
      JSON.stringify({ provider: oauthProvider, lockedAt: new Date().toISOString() }),
      'EX',
      OAUTH_CALLBACK_LOCK_TTL_SEC,
      'NX',
    );
    if (lockResult !== 'OK') {
      if (oauthProvider === 'zhiz') {
        const replayRedirect = await redis.get(zhizReplayRedirectKey);
        if (replayRedirect) {
          log.warn(
            { provider, stateLookupValue },
            'Zhiz OAuth callback replay resolved from cached completion URL after lock contention',
          );
          return res.redirect(replayRedirect);
        }
      }
      throw new AppError('AUTH_TOKEN_INVALID', 'OAuth callback is already being processed');
    }

    try {
      const stateContext = parseOAuthStateContext(oauthProvider, storedStateValue);
      if (stateContext.provider !== oauthProvider) {
        throw new AppError('AUTH_TOKEN_INVALID', 'OAuth state provider mismatch');
      }

      if (oauthProvider === 'zhiz') {
        if (state) {
          if (state !== stateContext.oauthNonce) {
            throw new AppError('AUTH_TOKEN_INVALID', 'OAuth state mismatch');
          }
        } else if (nonce !== stateContext.oauthNonce) {
          throw new AppError('AUTH_TOKEN_INVALID', 'OAuth nonce mismatch');
        }

        const ticketSeed = await createZhizContinuationTicketSeed(code, {
          initiatingUserId: stateContext.initiatingUserId || null,
        });
        const ticket = crypto.randomBytes(32).toString('hex');
        const ticketPayload: ZhizContinuationTicketPayload = {
          ...ticketSeed,
          clientRedirectUri: stateContext.clientRedirectUri,
          clientState: stateContext.clientState,
          webReturnTo: stateContext.webReturnTo,
        };
        const redirectUrl = buildZhizCompleteRedirect(ticket);

        await redis
          .multi()
          .setex(
            buildZhizTicketKey(ticket),
            CONTINUATION_TICKET_TTL_SEC,
            JSON.stringify(ticketPayload),
          )
          .setex(zhizReplayRedirectKey, CONTINUATION_TICKET_TTL_SEC, redirectUrl)
          .del(stateKey)
          .del(stateLockKey)
          .exec();

        log.info(
          { provider, ticketStatus: ticketPayload.status, providerId: ticketPayload.providerId },
          'Zhiz OAuth callback — continuation ticket created',
        );
        return res.redirect(redirectUrl);
      }

      // 用授权码换取用户 profile
      const profile = await handleCallback(oauthProvider, code);
      log.info({ provider, providerId: profile.providerId }, 'OAuth callback — profile obtained');

      // 关联或创建用户
      const result = await linkOrCreateUser(oauthProvider, profile);

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
      const redirectUrl = stateContext.frontendRedirect || buildFrontendUrl('/');
      const separator = redirectUrl.includes('?') ? '&' : '?';
      const finalUrl = `${redirectUrl}${separator}access_token=${result.accessToken}&is_new=${result.isNewUser}`;

      await redis.multi().del(stateKey).del(stateLockKey).exec();
      return res.redirect(finalUrl);
    } catch (err) {
      await redis.del(stateLockKey);
      throw err;
    }
  } catch (err) {
    log.error({ err }, 'OAuth callback failed');
    // 重定向到前端错误页而非返回 JSON
    const message = err instanceof AppError ? err.message : 'OAuth login failed';
    res.redirect(buildErrorRedirect(message));
  }
});

/**
 * GET /api/v1/auth/oauth/zhiz/status — 查询 Zhiz continuation ticket 状态
 * 2026-04-14 新增 — Zhiz OAuth Superpowers Execute T4
 * 不消费 ticket，仅返回 complete 页面恢复所需的最小状态快照。
 */
router.get('/zhiz/status', validate({ query: zhizStatusQuerySchema }), async (req, res, next) => {
  try {
    const { ticket } = req.query as { ticket: string };
    const [{ payload }, challengeEntry] = await Promise.all([
      loadZhizContinuationTicket(ticket),
      loadZhizEmailVerificationChallenge(ticket),
    ]);
    res.json({
      success: true,
      data: buildZhizStatusResponse(payload, challengeEntry?.payload ?? null),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/oauth/zhiz/finish — 完成 Zhiz continuation 登录/绑定
 * 2026-04-14 新增 — Zhiz OAuth Superpowers Execute T4
 * ready 直接登录；needs_email 支持新邮箱创建与已有本地密码账号绑定。
 */
router.post('/zhiz/finish', validate({ body: zhizFinishBodySchema }), async (req, res, next) => {
  try {
    const { ticket, email, password } = req.body as {
      ticket: string;
      email?: string;
      password?: string;
    };
    const { key, ttlSec, payload } = await loadZhizContinuationTicket(ticket);
    const finishInput: ZhizContinuationFinishInput = { email, password };
    const result = await finishZhizContinuation(payload, finishInput);

    if (result.kind === 'password_setup_required') {
      const updatedPayload: ZhizContinuationTicketPayload = {
        ...payload,
        step: 'verify_email_and_set_password',
        targetUserId: result.targetUserId,
        targetEmail: result.targetEmail,
        maskedEmail: result.maskedEmail,
        verificationMode: result.verificationMode,
        requiresNewPassword: result.requiresNewPassword,
      };
      await Promise.all([
        persistZhizContinuationTicket(key, updatedPayload, ttlSec),
        deleteZhizEmailVerificationChallenge(ticket),
      ]);
      throw new AppError(
        'AUTH_ZHIZ_PASSWORD_SETUP_REQUIRED',
        'Zhiz account requires password setup before it can be bound',
        {
          step: 'verify_email_and_set_password',
          maskedEmail: result.maskedEmail,
          verificationMode: result.verificationMode,
          requiresNewPassword: result.requiresNewPassword,
        },
      );
    }

    if (result.kind === 'email_verification_required') {
      const updatedPayload: ZhizContinuationTicketPayload = {
        ...payload,
        step: result.step,
        targetUserId: result.targetUserId,
        targetEmail: result.targetEmail,
        maskedEmail: result.maskedEmail,
        verificationMode: result.verificationMode,
        requiresNewPassword: result.requiresNewPassword,
      };
      await Promise.all([
        persistZhizContinuationTicket(key, updatedPayload, ttlSec),
        deleteZhizEmailVerificationChallenge(ticket),
      ]);
      throw new AppError(
        'AUTH_ZHIZ_EMAIL_VERIFICATION_REQUIRED',
        'Email verification is required before this Zhiz account can be bound',
        {
          step: result.step,
          maskedEmail: result.maskedEmail,
          verificationMode: result.verificationMode,
          requiresNewPassword: result.requiresNewPassword,
        },
      );
    }

    const consumedPayload: ZhizContinuationTicketPayload = {
      ...payload,
      consumedAt: new Date().toISOString(),
    };
    await Promise.all([
      persistZhizContinuationTicket(key, consumedPayload, ttlSec),
      deleteZhizEmailVerificationChallenge(ticket),
    ]);
    res.json({ success: true, data: result.authResult });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/oauth/zhiz/password-setup/start — 发送邮箱验证码 challenge
 * 2026-04-14 新增 — Zhiz OAuth Superpowers Execute T4（方案 B）
 * 仅在 step=verify_email_and_set_password 时允许调用，不消费 continuation ticket。
 */
router.post(
  '/zhiz/password-setup/start',
  validate({ body: zhizPasswordSetupStartBodySchema }),
  async (req, res, next) => {
    try {
      const { ticket } = req.body as { ticket: string };
      const [{ ttlSec, payload }, challengeEntry] = await Promise.all([
        loadZhizContinuationTicket(ticket),
        loadZhizEmailVerificationChallenge(ticket),
      ]);

      const challenge = await startZhizPasswordSetupChallenge(
        payload,
        challengeEntry?.payload ?? null,
      );
      await persistZhizEmailVerificationChallenge(
        challengeEntry?.key ?? buildZhizEmailVerifyKey(ticket),
        challenge,
        buildZhizChallengeTtlSec(ttlSec, challenge),
      );
      res.json({
        success: true,
        data: buildZhizPasswordSetupChallengeResponse(payload, challenge),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/auth/oauth/zhiz/password-setup/complete — 校验验证码并完成本地密码设置与 Zhiz 绑定
 * 2026-04-14 新增 — Zhiz OAuth Superpowers Execute T4（方案 B）
 * 成功后消费 continuation ticket，并清理 sibling challenge key。
 */
router.post(
  '/zhiz/password-setup/complete',
  validate({ body: zhizPasswordSetupCompleteBodySchema }),
  async (req, res, next) => {
    try {
      const { ticket, code, newPassword } = req.body as {
        ticket: string;
        code: string;
        newPassword?: string;
      };
      const [{ key, ttlSec, payload }, challengeEntry] = await Promise.all([
        loadZhizContinuationTicket(ticket),
        loadZhizEmailVerificationChallenge(ticket),
      ]);
      const completeInput: ZhizPasswordSetupCompleteInput = { code, newPassword };
      const result = await completeZhizPasswordSetupChallenge(
        payload,
        challengeEntry?.payload ?? null,
        completeInput,
      );

      if (result.kind === 'invalid_code') {
        if (result.challenge) {
          await persistZhizEmailVerificationChallenge(
            challengeEntry?.key ?? buildZhizEmailVerifyKey(ticket),
            result.challenge,
            buildZhizChallengeTtlSec(ttlSec, result.challenge),
          );
        } else {
          await deleteZhizEmailVerificationChallenge(ticket);
        }

        throw new AppError(
          'AUTH_ZHIZ_EMAIL_CODE_INVALID',
          'Zhiz email verification code is invalid',
          {
            step: payload.step,
            maskedEmail: payload.maskedEmail ?? payload.targetEmail ?? null,
            verificationMode: payload.verificationMode ?? null,
            requiresNewPassword: payload.requiresNewPassword ?? null,
            remainingAttempts: result.remainingAttempts,
            challengeExpiresInSec: result.challengeExpiresInSec,
            ...(result.challenge
              ? { resendAfterSec: getRemainingSeconds(result.challenge.resendAvailableAt) }
              : {}),
          },
        );
      }

      const consumedPayload: ZhizContinuationTicketPayload = {
        ...payload,
        consumedAt: new Date().toISOString(),
      };
      await Promise.all([
        persistZhizContinuationTicket(key, consumedPayload, ttlSec),
        deleteZhizEmailVerificationChallenge(ticket),
      ]);
      res.json({ success: true, data: result.authResult });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * 构建错误重定向 URL
 * 2026-04-09 — P6.03：OAuth 错误重定向到前端登录页
 */
function buildErrorRedirect(message: string): string {
  return `${buildFrontendUrl('/auth/login')}?error=${encodeURIComponent(message)}`;
}

export default router;
