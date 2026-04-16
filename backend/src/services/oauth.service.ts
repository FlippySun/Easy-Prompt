/**
 * OAuth 服务 — GitHub / Google 第三方登录
 * 2026-04-09 新增 — P6.03
 * 变更类型：新增
 * 设计思路：
 *   1. getAuthUrl() — 构建 OAuth 授权跳转 URL
 *   2. handleCallback() — 用授权码换取 access_token，获取用户信息
 *   3. linkOrCreateUser() — 关联现有用户或自动创建新用户
 *   4. 独立表 OAuthAccount 存储关联，不污染 User 主表
 * 参数：各方法见签名
 * 影响范围：auth 路由的 /oauth/* 端点
 * 潜在风险：
 *   - 第三方 API 可用性不可控
 *   - accessToken 需加密存储（当前明文，后续迭代）
 */

import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { PASSWORD_POLICY } from '../config/constants';
import { AppError } from '../utils/errors';
import { createChildLogger } from '../utils/logger';
import { encryptOAuthToken } from '../utils/crypto';
import { hashPassword } from '../utils/password';
import { getAccessTokenExpiresInSec, signAccessToken, signRefreshToken } from '../utils/jwt';
import { sendZhizPasswordSetupCodeEmail } from './mail.service';
import type { Prisma } from '@prisma/client';
import type { AuthResult } from './auth.service';
import type { UserRole } from '../types/user';

const log = createChildLogger('oauth');
const ZHIZ_AUTH_PAGE_FALLBACK = 'https://3001.zhiz.chat/#/oauth/authorize';
type ZhizPasswordPolicyField = 'password' | 'newPassword';
type ZhizRequiredField = 'email' | 'code' | 'newPassword';

// ── 类型定义 ───────────────────────────────────────────

export type OAuthProvider = 'github' | 'google' | 'zhiz';

export interface GetAuthUrlOptions {
  oauthNonce?: string;
}

interface OAuthProfile {
  providerId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  rawProfile: Record<string, unknown>;
}

interface OAuthTokenResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    role: string;
  };
  isNewUser: boolean;
}

interface ZhizTokenResponse {
  access_token?: string;
  refresh_token?: string;
  openid?: string;
  nickname?: string;
  avatar_url?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
  [key: string]: unknown;
}

interface ZhizTokenSuccessResponse extends ZhizTokenResponse {
  access_token: string;
  openid: string;
}

export type ZhizContinuationStatus = 'ready' | 'needs_email';
export type ZhizContinuationStep =
  | 'collect_email'
  | 'verify_email'
  | 'verify_email_and_set_password';
export type ZhizVerificationMode = 'create_user' | 'bind_existing_user' | 'set_password_and_bind';

export interface ZhizContinuationTicketState {
  provider: 'zhiz';
  status: ZhizContinuationStatus;
  step?: ZhizContinuationStep;
  linkedUserId: string | null;
  providerId: string;
  displayName: string | null;
  avatarUrl: string | null;
  encryptedAccessToken: string;
  rawProfile: Record<string, unknown>;
  targetUserId?: string | null;
  targetEmail?: string | null;
  maskedEmail?: string | null;
  verificationMode?: ZhizVerificationMode | null;
  requiresNewPassword?: boolean;
  consumedAt?: string | null;
}

export type ZhizContinuationTicketSeed = ZhizContinuationTicketState;

export interface CreateZhizContinuationTicketSeedOptions {
  initiatingUserId?: string | null;
}

export interface ZhizContinuationFinishInput {
  email?: string;
  password?: string;
}

export type ZhizContinuationFinishResult =
  | {
      kind: 'completed';
      authResult: AuthResult;
    }
  | {
      kind: 'password_setup_required';
      targetUserId: string;
      targetEmail: string;
      maskedEmail: string;
      verificationMode: ZhizVerificationMode;
      requiresNewPassword: true;
    }
  | {
      kind: 'email_verification_required';
      step: 'verify_email' | 'verify_email_and_set_password';
      targetUserId: string | null;
      targetEmail: string;
      maskedEmail: string;
      verificationMode: ZhizVerificationMode;
      requiresNewPassword: boolean;
    };

export interface ZhizEmailVerificationChallengeState {
  targetUserId: string | null;
  targetEmail: string;
  maskedEmail: string;
  verificationMode: ZhizVerificationMode;
  requiresNewPassword: boolean;
  codeHash: string;
  expiresAt: string;
  resendAvailableAt: string;
  attemptCount: number;
}

export interface ZhizPasswordSetupCompleteInput {
  code: string;
  newPassword?: string;
}

export type ZhizPasswordSetupCompleteResult =
  | {
      kind: 'completed';
      authResult: AuthResult;
    }
  | {
      kind: 'invalid_code';
      challenge: ZhizEmailVerificationChallengeState | null;
      remainingAttempts: number;
      challengeExpiresInSec: number;
    };

/**
 * 2026-04-15 修复 — Zhiz 密码策略错误细节结构化
 * 变更类型：修复/安全/前后端契约
 * 功能描述：为 Zhiz finish / password-setup 的密码策略失败补充字段级 details，供 complete 页面展示明确规则提示，而不是退化为通用 `VALIDATION_FAILED`。
 * 设计思路：
 *   1. 继续沿用既有 `VALIDATION_FAILED` 错误码，避免破坏全局错误码映射与前端兜底逻辑。
 *   2. 通过 `field + ruleText + typed flags` 暴露最小必要约束，不回传用户原始输入。
 *   3. `password` 与 `newPassword` 共用同一策略构造，防止 Zhiz 首登与密码补设两条子流程文案漂移。
 * 参数与返回值：`getZhizPasswordPolicyValidationDetails(field)` 返回可序列化 details；`throwZhizPasswordPolicyValidationError(field)` 恒抛异常无返回值。
 * 影响范围：`finishZhizContinuation()`、`completeZhizPasswordSetupChallenge()`、Web-Hub Zhiz complete 页面字段级错误展示。
 * 潜在风险：若未来前端直接依赖 `ruleText` 文案做逻辑判断，策略文案调整时需同步更新。
 */
function getZhizPasswordRuleText(): string {
  return `至少 ${PASSWORD_POLICY.MIN_LENGTH} 位，包含大写字母、小写字母和数字`;
}

function getZhizPasswordPolicyValidationDetails(field: ZhizPasswordPolicyField) {
  return {
    field,
    reason: 'password_policy',
    ruleText: getZhizPasswordRuleText(),
    minLength: PASSWORD_POLICY.MIN_LENGTH,
    maxLength: PASSWORD_POLICY.MAX_LENGTH,
    requiresUppercase: true,
    requiresLowercase: true,
    requiresDigit: true,
  };
}

function throwZhizPasswordPolicyValidationError(field: ZhizPasswordPolicyField): never {
  throw new AppError(
    'VALIDATION_FAILED',
    'Password does not meet security requirements',
    getZhizPasswordPolicyValidationDetails(field),
  );
}

/**
 * 2026-04-15 新增 — Zhiz 首绑必填字段结构化错误
 * 变更类型：新增/安全/前后端契约
 * 功能描述：为 Zhiz 首绑验邮流程中的缺失字段补充结构化 `VALIDATION_FAILED.details.validationErrors`，供 complete 页面继续沿用字段级错误展示。
 * 设计思路：
 *   1. 沿用全局 `VALIDATION_FAILED`，避免为单个字段缺失额外引入新错误码。
 *   2. details 只返回字段路径与 message，不回传用户原始输入。
 *   3. 与密码策略细节保持同一消费面，减少 Web-Hub ZhizCompletePage 的错误分支复杂度。
 * 参数与返回值：`throwZhizRequiredFieldValidationError(field, message)` 恒抛异常，无返回值。
 * 影响范围：Zhiz finish、验证码完成态、前端字段错误提示。
 * 潜在风险：若前端未来移除对 `validationErrors[].issues[].path` 的解析，需要同步调整此 helper。
 */
function throwZhizRequiredFieldValidationError(field: ZhizRequiredField, message: string): never {
  throw new AppError('VALIDATION_FAILED', message, {
    validationErrors: [
      {
        target: 'body',
        issues: [
          {
            path: field,
            message,
            code: 'custom',
          },
        ],
      },
    ],
  });
}

function isZhizEmailVerificationStep(
  step: ZhizContinuationStep | undefined,
): step is 'verify_email' | 'verify_email_and_set_password' {
  return step === 'verify_email' || step === 'verify_email_and_set_password';
}

/**
 * 2026-04-15 新增 — Zhiz 首绑验邮 required 细节
 * 变更类型：新增/安全/前后端契约
 * 功能描述：统一生成 Zhiz verify 态所需的结构化 details，供 route 与前端恢复验证码页面状态。
 * 设计思路：
 *   1. 通过 `step + verificationMode + requiresNewPassword` 描述 verify 页面语义，而不是让前端猜测当前分支。
 *   2. 只暴露脱敏邮箱，不暴露 target user 的内部状态。
 *   3. helper 同时服务于 finish 重入保护与 route 首次切票，避免错误细节漂移。
 * 参数与返回值：`getZhizEmailVerificationRequiredDetails(ticketState)` 返回可序列化 details；`throwZhizEmailVerificationRequiredError(ticketState)` 恒抛异常。
 * 影响范围：Zhiz finish、status 恢复、Web-Hub verify 页面渲染。
 * 潜在风险：若未来 verificationMode 枚举扩展，需要同步更新前端分支文案。
 */
function getZhizEmailVerificationRequiredDetails(ticketState: {
  step?: ZhizContinuationStep;
  maskedEmail?: string | null;
  verificationMode?: ZhizVerificationMode | null;
  requiresNewPassword?: boolean;
}) {
  const requiresNewPassword =
    typeof ticketState.requiresNewPassword === 'boolean'
      ? ticketState.requiresNewPassword
      : ticketState.step === 'verify_email_and_set_password';

  return {
    step: ticketState.step,
    maskedEmail: ticketState.maskedEmail ?? null,
    verificationMode: ticketState.verificationMode ?? null,
    requiresNewPassword,
  };
}

function throwZhizEmailVerificationRequiredError(ticketState: ZhizContinuationTicketState): never {
  throw new AppError(
    'AUTH_ZHIZ_EMAIL_VERIFICATION_REQUIRED',
    'Email verification is required before this Zhiz account can be bound',
    getZhizEmailVerificationRequiredDetails(ticketState),
  );
}

/**
 * 2026-04-14 新增 — Zhiz OAuth Superpowers Execute T1
 * 变更类型：新增/重构
 * 功能描述：抽离 provider callback URL 与 Zhiz hash-route auth page 的专用 builder，
 *   为后续 T2/T3 的结构化 state、nonce 双保险与 continuation 回跳做骨架准备。
 * 设计思路：
 *   1. provider callback URL builder 与前端页面回跳 builder 分层，避免继续复用同一基准 URL。
 *   2. Zhiz 授权页是 hash-route SPA，采用字符串追加 query，避免 URL 对 hash 部分重写。
 *   3. 本批次只接通 start 链路，因此 Zhiz callback 仍显式标记为未启用，防止误以为主链已完成。
 * 参数与返回值：
 *   - getOAuthCallbackBase(): 返回 provider redirect_uri 所用的后端基准地址。
 *   - buildProviderCallbackUrl(provider, options): 返回某个 provider 的 callback URL。
 *   - appendQueryString(baseUrl, params): 返回追加查询参数后的 URL 字符串。
 *   - buildZhizAuthUrl(state, options): 返回 Zhiz 授权页地址。
 * 影响范围：OAuth start 路由、后续 Zhiz callback/token exchange。
 * 潜在风险：若 OAUTH_ZHIZ_AUTH_PAGE_URL 配置错误，Zhiz 仅会在起始跳转阶段失败，不影响旧 provider。
 */
function getOAuthCallbackBase(): string {
  return config.OAUTH_CALLBACK_BASE_URL || `http://localhost:${config.PORT}`;
}

function buildProviderCallbackUrl(
  provider: OAuthProvider,
  options: GetAuthUrlOptions = {},
): string {
  const callbackUrl = new URL(`/api/v1/auth/oauth/${provider}/callback`, getOAuthCallbackBase());
  if (provider === 'zhiz' && options.oauthNonce) {
    callbackUrl.searchParams.set('nonce', options.oauthNonce);
  }
  return callbackUrl.toString();
}

function appendQueryString(baseUrl: string, params: URLSearchParams): string {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}${params.toString()}`;
}

/**
 * 2026-04-14 修复 — Zhiz OAuth 授权页 hash-route 防御归一化
 * 变更类型：修复/加固
 * 功能描述：当 `.env` 中未给带 `#` 的 URL 加引号，导致 dotenv 将 hash-route 截断成根域名时，自动恢复 Zhiz 授权页默认 hash 路由。
 * 设计思路：
 *   1. 仅在配置值退化为 `https://3001.zhiz.chat/` 且缺少 hash 时触发，避免误改其他自定义授权页。
 *   2. 保持返回字符串 URL，继续复用 appendQueryString 对 hash-route SPA 的安全追加策略。
 * 参数与返回值：normalizeZhizAuthPageUrl(rawUrl) 接收原始配置值，返回可安全追加 query 的授权页 URL。
 * 影响范围：GET /api/v1/auth/oauth/zhiz 起始跳转、生产 `.env` 配置容错。
 * 潜在风险：若未来 Zhiz 授权页主机或路由结构变化，需要同步更新识别条件。
 */
function normalizeZhizAuthPageUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const isDefaultZhizOrigin = parsed.origin === 'https://3001.zhiz.chat';
    const isRootPath = parsed.pathname === '/' || parsed.pathname === '';
    const isMissingHashRoute = !parsed.hash || parsed.hash === '#' || parsed.hash === '#/';

    if (isDefaultZhizOrigin && isRootPath && isMissingHashRoute) {
      log.warn(
        {
          configuredAuthPageUrl: trimmed,
          normalizedAuthPageUrl: ZHIZ_AUTH_PAGE_FALLBACK,
        },
        'Zhiz auth page URL missing hash-route; normalized to default authorize page',
      );
      return ZHIZ_AUTH_PAGE_FALLBACK;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

function buildZhizAuthUrl(state: string, options: GetAuthUrlOptions = {}): string {
  if (!config.OAUTH_ZHIZ_CLIENT_ID) {
    throw new AppError('AUTH_PROVIDER_ERROR', 'Zhiz OAuth not configured');
  }

  const params = new URLSearchParams({
    client_id: config.OAUTH_ZHIZ_CLIENT_ID,
    redirect_uri: buildProviderCallbackUrl('zhiz', options),
    response_type: 'code',
    state,
  });

  return appendQueryString(normalizeZhizAuthPageUrl(config.OAUTH_ZHIZ_AUTH_PAGE_URL), params);
}

function getZhizApiBaseUrl(): string {
  return config.OAUTH_ZHIZ_BASE_URL.replace(/\/+$/, '');
}

/**
 * 2026-04-14 修复 — Zhiz token 请求协议与非 JSON 响应兜底
 * 变更类型：修复/兼容
 * 功能描述：根据 Zhiz 最新确认的 token 协议构造 form-data 请求，并把 HTML/纯文本等非 JSON 响应转换为明确的 AppError。
 * 设计思路：
 *   1. token 请求体改为 form-data，和 Zhiz 方 Postman 实测成功的契约保持一致。
 *   2. 先读取原始文本，再决定是否 JSON 解析，避免 `response.json()` 直接抛裸 SyntaxError。
 *   3. 仅记录有限长度的响应预览，兼顾故障定位与日志体积控制。
 * 参数与返回值：buildZhizTokenRequestBody(code) 返回 Zhiz token 接口所需 FormData；parseZhizTokenResponse(tokenRes, tokenUrl) 返回解析后的 token 响应对象。
 * 影响范围：Zhiz callback、continuation ticket 创建、生产故障排查链路。
 * 潜在风险：若 Zhiz 后续将 token 协议切换为 x-www-form-urlencoded，需要同步调整本 helper。
 */
function buildZhizTokenRequestBody(code: string): FormData {
  const formData = new FormData();
  formData.set('client_id', config.OAUTH_ZHIZ_CLIENT_ID);
  formData.set('client_secret', config.OAUTH_ZHIZ_CLIENT_SECRET);
  formData.set('code', code);
  formData.set('grant_type', 'authorization_code');
  return formData;
}

async function parseZhizTokenResponse(
  tokenRes: Response,
  tokenUrl: string,
): Promise<ZhizTokenResponse> {
  const contentType = tokenRes.headers.get('content-type') ?? '';
  const responseText = await tokenRes.text();

  if (!responseText.trim()) {
    return {} as ZhizTokenResponse;
  }

  try {
    return JSON.parse(responseText) as ZhizTokenResponse;
  } catch (err) {
    log.error(
      {
        err,
        tokenUrl,
        status: tokenRes.status,
        contentType,
        responsePreview: responseText.slice(0, 200),
      },
      'Zhiz token exchange returned a non-JSON response',
    );
    throw new AppError(
      'AUTH_PROVIDER_ERROR',
      `Zhiz auth failed: token endpoint returned ${contentType || 'non-JSON content'} (status ${tokenRes.status})`,
    );
  }
}

function sanitizeZhizTokenResult(tokenResult: ZhizTokenResponse): Record<string, unknown> {
  return {
    openid: tokenResult.openid ?? null,
    nickname: tokenResult.nickname ?? null,
    avatar_url: tokenResult.avatar_url ?? null,
  };
}

function mapZhizTokenResultToProfile(tokenResult: ZhizTokenResponse): OAuthProfile {
  return {
    providerId: tokenResult.openid || '',
    email: null,
    displayName: typeof tokenResult.nickname === 'string' ? tokenResult.nickname : null,
    avatarUrl: typeof tokenResult.avatar_url === 'string' ? tokenResult.avatar_url : null,
    rawProfile: sanitizeZhizTokenResult(tokenResult),
  };
}

async function exchangeZhizToken(code: string): Promise<ZhizTokenSuccessResponse> {
  if (!config.OAUTH_ZHIZ_CLIENT_ID || !config.OAUTH_ZHIZ_CLIENT_SECRET) {
    throw new AppError('AUTH_PROVIDER_ERROR', 'Zhiz OAuth not configured');
  }

  const tokenUrl = `${getZhizApiBaseUrl()}/oauth2/token`;
  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    body: buildZhizTokenRequestBody(code),
  });

  const tokenData = await parseZhizTokenResponse(tokenRes, tokenUrl);
  if (!tokenRes.ok || !tokenData.access_token || !tokenData.openid) {
    log.error(
      {
        tokenUrl,
        status: tokenRes.status,
        tokenData: {
          error: tokenData.error,
          error_description: tokenData.error_description,
          openid: tokenData.openid,
        },
      },
      'Zhiz token exchange failed',
    );
    throw new AppError(
      'AUTH_PROVIDER_ERROR',
      `Zhiz auth failed: ${tokenData.error_description || tokenData.error || 'no token'}`,
    );
  }

  return tokenData as ZhizTokenSuccessResponse;
}

function encryptZhizAccessToken(accessToken: string): string {
  try {
    return encryptOAuthToken(accessToken);
  } catch (err) {
    log.error({ err }, 'Zhiz OAuth token encryption failed');
    throw new AppError('AUTH_ZHIZ_TOKEN_ENCRYPT_FAILED', 'Failed to encrypt Zhiz OAuth token');
  }
}

/**
 * 2026-04-15 更新 — Zhiz 首绑必验邮与已登录直绑
 * 变更类型：修复/安全/重构
 * 功能描述：完成 Zhiz callback 的 token/profile 交换，并根据“已绑定 / 已登录主动绑定 / 首次未绑定”三种场景产出 continuation ticket 种子。
 * 设计思路：
 *   1. 若 providerId 已绑定本地账号，继续刷新 OAuthAccount 并返回 ready。
 *   2. 若 callback 来自已登录用户的显式绑定动作，则在 callback 阶段直接为当前用户补齐 Zhiz 绑定。
 *   3. 若首次未绑定且未登录，则只返回 needs_email/collect_email 种子，后续必须进入邮箱验证码阶段。
 * 参数与返回值：createZhizContinuationTicketSeed(code, options) 返回 ready / needs_email 所需的最小 Redis payload 种子。
 * 影响范围：Zhiz callback、后续 status/finish/password-setup 流程。
 * 潜在风险：若 start/callback 传入的已登录用户上下文失配，会显式返回冲突而不是误绑到其他账号。
 */
export async function createZhizContinuationTicketSeed(
  code: string,
  options: CreateZhizContinuationTicketSeedOptions = {},
): Promise<ZhizContinuationTicketSeed> {
  const tokenResult = await exchangeZhizToken(code);
  const profile = mapZhizTokenResultToProfile(tokenResult);
  const encryptedAccessToken = encryptZhizAccessToken(tokenResult.access_token);
  const initiatingUserId = options.initiatingUserId ?? null;

  const existing = await prisma.oAuthAccount.findUnique({
    where: { provider_providerId: { provider: 'zhiz', providerId: profile.providerId } },
    include: { user: true },
  });

  if (existing) {
    if (initiatingUserId && existing.userId !== initiatingUserId) {
      throw new AppError('RESOURCE_CONFLICT', 'Zhiz account is already linked to another user');
    }

    await prisma.oAuthAccount.update({
      where: { id: existing.id },
      data: {
        email: existing.user.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        accessToken: encryptedAccessToken,
        rawProfile: profile.rawProfile as Prisma.InputJsonValue,
      },
    });

    return {
      provider: 'zhiz',
      status: 'ready',
      linkedUserId: existing.userId,
      providerId: profile.providerId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      encryptedAccessToken,
      rawProfile: profile.rawProfile,
    };
  }

  if (initiatingUserId) {
    const currentUser = await prisma.user.findUnique({ where: { id: initiatingUserId } });
    if (!currentUser) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Authenticated user for Zhiz linking was not found');
    }

    const readyState: ZhizContinuationTicketState = {
      provider: 'zhiz',
      status: 'ready',
      linkedUserId: currentUser.id,
      providerId: profile.providerId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      encryptedAccessToken,
      rawProfile: profile.rawProfile,
      targetEmail: currentUser.email,
      maskedEmail: maskEmailAddress(currentUser.email),
    };

    await upsertZhizOAuthAccountForUser(prisma, currentUser.id, currentUser.email, readyState);
    return readyState;
  }

  return {
    provider: 'zhiz',
    status: 'needs_email',
    step: 'collect_email',
    linkedUserId: null,
    providerId: profile.providerId,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    encryptedAccessToken,
    rawProfile: profile.rawProfile,
  };
}

/**
 * 2026-04-15 更新 — Zhiz 首绑强制验邮状态机
 * 变更类型：修复/安全/重构
 * 功能描述：完成 Zhiz continuation finish 的后端核心业务，支持 ready 登录与 collect_email → 验证码阶段切换，
 *   让未登录首次绑定统一进入邮箱验证码流程，而不再在 finish 阶段直接创建或绑定账号。
 * 设计思路：
 *   1. ready 仍直接完成登录；未绑定场景统一由 service 判定 verify 模式，不在 route 层散落业务判断。
 *   2. 通过 `verificationMode + requiresNewPassword` 描述 verify 态，覆盖新用户创建、已有本地账号绑定、OAuth-only 补设密码三种场景。
 *   3. finish 阶段不再接收或缓存待验证密码，避免 Redis 中出现任何待确认口令材料。
 * 参数与返回值：finishZhizContinuation(ticketState, input) 返回 completed、password_setup_required 或 email_verification_required。
 * 影响范围：`POST /api/v1/auth/oauth/zhiz/finish` 与后续 password-setup 子流程。
 * 潜在风险：首次绑定从“立即完成”改为“必须验邮”后，旧前端若未更新会停留在 complete 页面并收到 verify-required 错误码。
 */
export async function finishZhizContinuation(
  ticketState: ZhizContinuationTicketState,
  input: ZhizContinuationFinishInput,
): Promise<ZhizContinuationFinishResult> {
  if (ticketState.status === 'ready') {
    if (!ticketState.linkedUserId) {
      throw new AppError(
        'AUTH_ZHIZ_TICKET_INVALID',
        'Zhiz continuation ticket missing linked user',
      );
    }
    return {
      kind: 'completed',
      authResult: await buildAuthResultForUser(ticketState.linkedUserId),
    };
  }

  if (isZhizEmailVerificationStep(ticketState.step)) {
    throwZhizEmailVerificationRequiredError(ticketState);
  }

  const normalizedEmail = normalizeEmailAddress(input.email);
  if (!normalizedEmail) {
    throwZhizRequiredFieldValidationError('email', 'Email is required to finish Zhiz login');
  }

  const existingZhizAccount = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerId: {
        provider: 'zhiz',
        providerId: ticketState.providerId,
      },
    },
  });
  if (existingZhizAccount) {
    throw new AppError('RESOURCE_CONFLICT', 'Zhiz account is already linked to another user');
  }

  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!existingUser) {
    return {
      kind: 'email_verification_required',
      step: 'verify_email_and_set_password',
      targetUserId: null,
      targetEmail: normalizedEmail,
      maskedEmail: maskEmailAddress(normalizedEmail),
      verificationMode: 'create_user',
      requiresNewPassword: true,
    };
  }

  if (!hasUsableLocalPassword(existingUser.passwordHash)) {
    return {
      kind: 'password_setup_required',
      targetUserId: existingUser.id,
      targetEmail: existingUser.email,
      maskedEmail: maskEmailAddress(existingUser.email),
      verificationMode: 'set_password_and_bind',
      requiresNewPassword: true,
    };
  }

  return {
    kind: 'email_verification_required',
    step: 'verify_email',
    targetUserId: existingUser.id,
    targetEmail: existingUser.email,
    maskedEmail: maskEmailAddress(existingUser.email),
    verificationMode: 'bind_existing_user',
    requiresNewPassword: false,
  };
}

/**
 * 2026-04-14 新增 — Zhiz OAuth Superpowers Execute T4（方案 B）
 * 变更类型：新增/安全
 * 功能描述：为 `verify_email_and_set_password` 子流程生成并发送 6 位邮箱验证码 challenge。
 * 设计思路：
 *   1. 仅在 continuation ticket 已切到 password-setup 步骤时允许发信，避免绕过已有 finish 判定。
 *   2. 验证码只保留 HMAC 哈希，不在 Redis 中落明文，降低 Redis 泄露后的低熵撞库风险。
 *   3. resend cooldown 在 service 层直接判定，route 层只负责 sibling Redis key 的持久化。
 * 参数与返回值：startZhizPasswordSetupChallenge(ticketState, existingChallenge) 返回新的 challenge state。
 * 影响范围：`POST /api/v1/auth/oauth/zhiz/password-setup/start`、status 恢复 challenge 元信息。
 * 潜在风险：SES API 发信失败时不会更新 Redis challenge，需要前端提示用户重试。
 */
export async function startZhizPasswordSetupChallenge(
  ticketState: ZhizContinuationTicketState,
  existingChallenge: ZhizEmailVerificationChallengeState | null,
): Promise<ZhizEmailVerificationChallengeState> {
  const context = getZhizEmailVerificationContext(ticketState);
  const nowMs = Date.now();

  if (existingChallenge) {
    ensureZhizChallengeMatchesTicket(existingChallenge, context);
    const resendAfterSec = getRemainingSeconds(existingChallenge.resendAvailableAt, nowMs);
    if (resendAfterSec > 0) {
      throw new AppError(
        'AUTH_ZHIZ_EMAIL_CODE_RATE_LIMITED',
        'Zhiz email verification requests are too frequent',
        {
          step: context.step,
          maskedEmail: context.maskedEmail,
          verificationMode: context.verificationMode,
          requiresNewPassword: context.requiresNewPassword,
          resendAfterSec,
          challengeExpiresInSec: getRemainingSeconds(existingChallenge.expiresAt, nowMs),
        },
      );
    }
  }

  const code = generateZhizEmailVerificationCode();
  const challenge: ZhizEmailVerificationChallengeState = {
    targetUserId: context.targetUserId,
    targetEmail: context.targetEmail,
    maskedEmail: context.maskedEmail,
    verificationMode: context.verificationMode,
    requiresNewPassword: context.requiresNewPassword,
    codeHash: hashZhizEmailVerificationCode(code),
    expiresAt: new Date(nowMs + config.AUTH_EMAIL_CODE_TTL_SEC * 1000).toISOString(),
    resendAvailableAt: new Date(
      nowMs + config.AUTH_EMAIL_CODE_RESEND_COOLDOWN_SEC * 1000,
    ).toISOString(),
    attemptCount: 0,
  };

  try {
    await sendZhizPasswordSetupCodeEmail({
      to: context.targetEmail,
      code,
      displayName: ticketState.displayName,
    });
  } catch (err) {
    if (err instanceof AppError && err.code === 'AUTH_ZHIZ_EMAIL_SEND_FAILED') {
      throw new AppError(err.code, err.message, {
        step: context.step,
        maskedEmail: context.maskedEmail,
        verificationMode: context.verificationMode,
        requiresNewPassword: context.requiresNewPassword,
      });
    }
    throw err;
  }

  return challenge;
}

/**
 * 2026-04-15 更新 — Zhiz 验邮箱完成态统一收口
 * 变更类型：修复/安全/重构
 * 功能描述：校验邮箱验证码，并根据 verificationMode 完成“新用户创建 / 已有本地账号绑定 / OAuth-only 账号补设密码后绑定”。
 * 设计思路：
 *   1. continue 沿用既有 `/password-setup/complete` 入口，但通过 `requiresNewPassword` 决定是否展示并校验新密码。
 *   2. 验证码错误时仅递增 attemptCount；超过最大尝试次数后要求重新发起验证码，保持所有 verify 模式一致。
 *   3. 新用户创建、密码更新与 Zhiz 绑定分别在事务中完成，保证“验邮成功后账号侧变更”原子落库。
 * 参数与返回值：completeZhizPasswordSetupChallenge(ticketState, challengeState, input) 返回 completed 或 invalid_code。
 * 影响范围：`POST /api/v1/auth/oauth/zhiz/password-setup/complete`。
 * 潜在风险：若 verify 期间邮箱已被别的流程抢先注册，新用户创建模式会显式返回 `AUTH_EMAIL_EXISTS`，用户需重新发起登录。
 */
export async function completeZhizPasswordSetupChallenge(
  ticketState: ZhizContinuationTicketState,
  challengeState: ZhizEmailVerificationChallengeState | null,
  input: ZhizPasswordSetupCompleteInput,
): Promise<ZhizPasswordSetupCompleteResult> {
  const context = getZhizEmailVerificationContext(ticketState);
  const nowMs = Date.now();

  if (!challengeState) {
    throw new AppError('AUTH_ZHIZ_EMAIL_CODE_EXPIRED', 'Zhiz email verification code has expired', {
      step: context.step,
      maskedEmail: context.maskedEmail,
      verificationMode: context.verificationMode,
      requiresNewPassword: context.requiresNewPassword,
    });
  }

  ensureZhizChallengeMatchesTicket(challengeState, context);

  const challengeExpiresInSec = getRemainingSeconds(challengeState.expiresAt, nowMs);
  if (challengeExpiresInSec <= 0) {
    throw new AppError('AUTH_ZHIZ_EMAIL_CODE_EXPIRED', 'Zhiz email verification code has expired', {
      step: context.step,
      maskedEmail: context.maskedEmail,
      verificationMode: context.verificationMode,
      requiresNewPassword: context.requiresNewPassword,
    });
  }

  const normalizedCode = input.code.trim();
  const newPassword = input.newPassword?.trim() ?? '';
  if (!/^\d{6}$/.test(normalizedCode)) {
    throwZhizRequiredFieldValidationError(
      'code',
      'Email verification code must be a 6-digit number',
    );
  }
  if (context.requiresNewPassword && !newPassword) {
    throwZhizRequiredFieldValidationError(
      'newPassword',
      'New password is required to complete Zhiz email verification',
    );
  }
  if (context.requiresNewPassword && !isPasswordPolicyValid(newPassword)) {
    throwZhizPasswordPolicyValidationError('newPassword');
  }

  const codeHash = hashZhizEmailVerificationCode(normalizedCode);
  if (codeHash !== challengeState.codeHash) {
    const nextAttemptCount = challengeState.attemptCount + 1;
    if (nextAttemptCount >= config.AUTH_EMAIL_CODE_MAX_ATTEMPTS) {
      return {
        kind: 'invalid_code',
        challenge: null,
        remainingAttempts: 0,
        challengeExpiresInSec: 0,
      };
    }

    return {
      kind: 'invalid_code',
      challenge: {
        ...challengeState,
        attemptCount: nextAttemptCount,
      },
      remainingAttempts: config.AUTH_EMAIL_CODE_MAX_ATTEMPTS - nextAttemptCount,
      challengeExpiresInSec,
    };
  }

  let completedUserId = context.targetUserId;

  if (context.verificationMode === 'create_user') {
    if (!context.requiresNewPassword) {
      throw new AppError(
        'AUTH_ZHIZ_TICKET_INVALID',
        'Zhiz new-user verification mode must require a local password',
      );
    }

    const passwordHash = await hashPassword(newPassword);
    const username = await generateUniqueUsername(ticketState.displayName || 'zhiz');

    try {
      const user = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email: context.targetEmail,
            username,
            displayName: ticketState.displayName,
            avatarUrl: ticketState.avatarUrl,
            passwordHash,
            role: 'user',
          },
        });

        await upsertZhizOAuthAccountForUser(tx, createdUser.id, context.targetEmail, ticketState);
        return createdUser;
      });

      completedUserId = user.id;
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        const racedUser = await prisma.user.findUnique({ where: { email: context.targetEmail } });
        if (racedUser) {
          throw new AppError('AUTH_EMAIL_EXISTS');
        }
      }
      throw err;
    }
  } else if (context.verificationMode === 'bind_existing_user') {
    if (!context.targetUserId) {
      throw new AppError(
        'AUTH_ZHIZ_TICKET_INVALID',
        'Zhiz existing-user verification mode is missing target user',
      );
    }

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: context.targetUserId as string } });
      if (!user) {
        throw new AppError('RESOURCE_NOT_FOUND', 'User not found');
      }

      await upsertZhizOAuthAccountForUser(
        tx,
        context.targetUserId as string,
        context.targetEmail,
        ticketState,
      );
    });
  } else {
    if (!context.targetUserId) {
      throw new AppError(
        'AUTH_ZHIZ_TICKET_INVALID',
        'Zhiz password-setup verification mode is missing target user',
      );
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: context.targetUserId as string } });
      if (!user) {
        throw new AppError('RESOURCE_NOT_FOUND', 'User not found');
      }

      await tx.user.update({
        where: { id: context.targetUserId as string },
        data: { passwordHash },
      });

      await upsertZhizOAuthAccountForUser(
        tx,
        context.targetUserId as string,
        context.targetEmail,
        ticketState,
      );
    });
  }

  if (!completedUserId) {
    throw new AppError(
      'AUTH_ZHIZ_TICKET_INVALID',
      'Zhiz verification did not resolve a target user',
    );
  }

  return {
    kind: 'completed',
    authResult: await buildAuthResultForUser(completedUserId),
  };
}

// ── 授权 URL 构建 ──────────────────────────────────────

/**
 * 构建 OAuth 授权跳转 URL
 * @param provider - github / google / zhiz
 * @param state - CSRF 防护随机字符串（调用方生成）
 * @param options - OAuth URL 组装可选参数（当前用于 Zhiz nonce 双保险）
 */
export function getAuthUrl(
  provider: OAuthProvider,
  state: string,
  options: GetAuthUrlOptions = {},
): string {
  switch (provider) {
    case 'github': {
      if (!config.OAUTH_GITHUB_CLIENT_ID) {
        throw new AppError('AUTH_PROVIDER_ERROR', 'GitHub OAuth not configured');
      }
      const params = new URLSearchParams({
        client_id: config.OAUTH_GITHUB_CLIENT_ID,
        redirect_uri: buildProviderCallbackUrl('github', options),
        scope: 'read:user user:email',
        state,
      });
      return `https://github.com/login/oauth/authorize?${params}`;
    }
    case 'google': {
      if (!config.OAUTH_GOOGLE_CLIENT_ID) {
        throw new AppError('AUTH_PROVIDER_ERROR', 'Google OAuth not configured');
      }
      const params = new URLSearchParams({
        client_id: config.OAUTH_GOOGLE_CLIENT_ID,
        redirect_uri: buildProviderCallbackUrl('google', options),
        response_type: 'code',
        scope: 'openid email profile',
        state,
        access_type: 'offline',
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    }
    case 'zhiz':
      return buildZhizAuthUrl(state, options);
    default:
      throw new AppError('AUTH_PROVIDER_ERROR', `Unsupported OAuth provider: ${provider}`);
  }
}

// ── 回调处理（授权码 → token → profile） ──────────────

/**
 * 处理 OAuth 回调：用授权码换 token，获取用户 profile
 * @param provider - github / google
 * @param code - 授权码
 * @returns OAuthProfile
 */
export async function handleCallback(provider: OAuthProvider, code: string): Promise<OAuthProfile> {
  switch (provider) {
    case 'github':
      return handleGitHubCallback(code);
    case 'google':
      return handleGoogleCallback(code);
    case 'zhiz':
      return mapZhizTokenResultToProfile(await exchangeZhizToken(code));
    default:
      throw new AppError('AUTH_PROVIDER_ERROR', `Unsupported provider: ${provider}`);
  }
}

// ── GitHub 回调 ────────────────────────────────────────

async function handleGitHubCallback(code: string): Promise<OAuthProfile> {
  // 1. 用 code 换 access_token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.OAUTH_GITHUB_CLIENT_ID,
      client_secret: config.OAUTH_GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenData.access_token) {
    log.error({ tokenData }, 'GitHub token exchange failed');
    throw new AppError(
      'AUTH_PROVIDER_ERROR',
      `GitHub auth failed: ${tokenData.error || 'no token'}`,
    );
  }

  // 2. 获取用户 profile
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userData = (await userRes.json()) as {
    id?: number;
    login?: string;
    name?: string;
    avatar_url?: string;
    email?: string;
  };

  // 3. 获取邮箱（可能 profile 中没有，需单独请求）
  let email = userData.email;
  if (!email) {
    const emailRes = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const emails = (await emailRes.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;
    const primary = emails.find((e) => e.primary && e.verified);
    email = primary?.email ?? emails[0]?.email ?? null;
  }

  return {
    providerId: String(userData.id),
    email: email ?? null,
    displayName: userData.name || userData.login || null,
    avatarUrl: userData.avatar_url || null,
    rawProfile: userData as Record<string, unknown>,
  };
}

// ── Google 回调 ────────────────────────────────────────

async function handleGoogleCallback(code: string): Promise<OAuthProfile> {
  // 1. 用 code 换 access_token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.OAUTH_GOOGLE_CLIENT_ID,
      client_secret: config.OAUTH_GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: buildProviderCallbackUrl('google'),
    }),
  });

  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenData.access_token) {
    log.error({ tokenData }, 'Google token exchange failed');
    throw new AppError(
      'AUTH_PROVIDER_ERROR',
      `Google auth failed: ${tokenData.error || 'no token'}`,
    );
  }

  // 2. 获取用户 profile
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userData = (await userRes.json()) as {
    id?: string;
    email?: string;
    name?: string;
    picture?: string;
    verified_email?: boolean;
  };

  return {
    providerId: userData.id || '',
    email: userData.email || null,
    displayName: userData.name || null,
    avatarUrl: userData.picture || null,
    rawProfile: userData as Record<string, unknown>,
  };
}

// ── 用户关联或创建 ─────────────────────────────────────

/**
 * 根据 OAuth profile 关联现有用户或创建新用户
 * 匹配策略：
 *   1. 先查 OAuthAccount（provider + providerId）→ 找到则直接登录
 *   2. 未找到 → 用 email 匹配 User 表 → 找到则关联
 *   3. 都没有 → 创建新用户 + 关联 OAuthAccount
 * @returns JWT tokens + 用户信息
 */
export async function linkOrCreateUser(
  provider: OAuthProvider,
  profile: OAuthProfile,
): Promise<OAuthTokenResult> {
  let isNewUser = false;

  // 1. 查找已有 OAuth 关联
  const existing = await prisma.oAuthAccount.findUnique({
    where: { provider_providerId: { provider, providerId: profile.providerId } },
    include: { user: true },
  });

  let user;

  if (existing) {
    // 已关联 → 更新 profile 信息
    user = existing.user;
    await prisma.oAuthAccount.update({
      where: { id: existing.id },
      data: {
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        rawProfile: profile.rawProfile as Prisma.InputJsonValue,
      },
    });
    log.info({ userId: user.id, provider }, 'OAuth login — existing account');
  } else if (profile.email) {
    // 2. 用 email 匹配已有用户
    const emailUser = await prisma.user.findUnique({ where: { email: profile.email } });

    if (emailUser) {
      user = emailUser;
      // 创建 OAuth 关联
      await prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider,
          providerId: profile.providerId,
          email: profile.email,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          rawProfile: profile.rawProfile as Prisma.InputJsonValue,
        },
      });
      log.info({ userId: user.id, provider }, 'OAuth login — linked to existing user by email');
    } else {
      // 3. 创建新用户
      const username = await generateUniqueUsername(profile.displayName || provider);
      user = await prisma.user.create({
        data: {
          email: profile.email,
          username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          // OAuth 用户使用随机密码（不可直接密码登录）
          passwordHash: `oauth:${provider}:${Date.now()}`,
          oauthAccounts: {
            create: {
              provider,
              providerId: profile.providerId,
              email: profile.email,
              displayName: profile.displayName,
              avatarUrl: profile.avatarUrl,
              rawProfile: profile.rawProfile as Prisma.InputJsonValue,
            },
          },
        },
      });
      isNewUser = true;
      log.info({ userId: user.id, provider, username }, 'OAuth login — new user created');
    }
  } else {
    throw new AppError('AUTH_PROVIDER_ERROR', 'OAuth provider did not return an email address');
  }

  // 签发 JWT — 复用 utils/jwt.ts 中的签发函数
  const tokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role as 'user' | 'admin' | 'super_admin',
  };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
    },
    isNewUser,
  };
}

// ── 工具函数 ───────────────────────────────────────────

/**
 * 生成唯一用户名（基于 displayName 或 provider 名 + 随机后缀）
 */
async function generateUniqueUsername(base: string): Promise<string> {
  // 清理为合法用户名字符
  const cleaned = base.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30) || 'user';
  let candidate = cleaned;
  let attempt = 0;

  while (attempt < 10) {
    const exists = await prisma.user.findUnique({ where: { username: candidate } });
    if (!exists) return candidate;
    // 添加随机后缀
    candidate = `${cleaned}_${Math.random().toString(36).slice(2, 8)}`;
    attempt++;
  }

  // 极端情况：全随机
  return `user_${Date.now().toString(36)}`;
}

/**
 * 2026-04-14 新增 — Zhiz OAuth Superpowers Execute T4
 * 变更类型：新增/工具
 * 功能描述：聚合 Zhiz continuation finish 所需的用户鉴权、账号绑定与输入判定工具函数。
 * 设计思路：把密码有效性、邮箱脱敏、JWT 结果构建与 OAuthAccount upsert 拆成小函数，降低 finish 主流程分支复杂度。
 * 参数与返回值：各函数见签名；统一服务于 Zhiz continuation `status/finish` 的后续扩展。
 * 影响范围：Zhiz continuation finish、新用户创建、已有账号绑定。
 * 潜在风险：无已知风险。
 */
function normalizeEmailAddress(email: string | undefined): string {
  return email?.toLowerCase().trim() ?? '';
}

function hasUsableLocalPassword(passwordHash: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(passwordHash);
}

function isPasswordPolicyValid(password: string): boolean {
  return (
    password.length >= PASSWORD_POLICY.MIN_LENGTH &&
    password.length <= PASSWORD_POLICY.MAX_LENGTH &&
    PASSWORD_POLICY.PATTERN.test(password)
  );
}

function maskEmailAddress(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) {
    return email;
  }

  if (localPart.length <= 2) {
    return `${localPart[0] || '*'}*@${domain}`;
  }

  return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
}

function getRemainingSeconds(timestamp: string, nowMs: number = Date.now()): number {
  const expiresAtMs = new Date(timestamp).getTime();
  if (Number.isNaN(expiresAtMs)) {
    return 0;
  }
  return Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000));
}

function generateZhizEmailVerificationCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function hashZhizEmailVerificationCode(code: string): string {
  return crypto
    .createHmac('sha256', config.JWT_SECRET)
    .update(`zhiz-email-code:${code}`)
    .digest('hex');
}

function getZhizEmailVerificationContext(ticketState: ZhizContinuationTicketState): {
  step: 'verify_email' | 'verify_email_and_set_password';
  targetUserId: string | null;
  targetEmail: string;
  maskedEmail: string;
  verificationMode: ZhizVerificationMode;
  requiresNewPassword: boolean;
} {
  if (
    ticketState.status !== 'needs_email' ||
    !isZhizEmailVerificationStep(ticketState.step) ||
    !ticketState.targetEmail ||
    !ticketState.verificationMode
  ) {
    throw new AppError(
      'AUTH_ZHIZ_TICKET_INVALID',
      'Zhiz continuation ticket is not waiting for email verification',
    );
  }

  if (ticketState.verificationMode !== 'create_user' && !ticketState.targetUserId) {
    throw new AppError(
      'AUTH_ZHIZ_TICKET_INVALID',
      'Zhiz continuation ticket is missing the target user for email verification',
    );
  }

  return {
    step: ticketState.step,
    targetUserId: ticketState.targetUserId ?? null,
    targetEmail: ticketState.targetEmail,
    maskedEmail: ticketState.maskedEmail ?? maskEmailAddress(ticketState.targetEmail),
    verificationMode: ticketState.verificationMode,
    requiresNewPassword:
      typeof ticketState.requiresNewPassword === 'boolean'
        ? ticketState.requiresNewPassword
        : ticketState.step === 'verify_email_and_set_password',
  };
}

function ensureZhizChallengeMatchesTicket(
  challengeState: ZhizEmailVerificationChallengeState,
  context: {
    targetUserId: string | null;
    targetEmail: string;
    verificationMode: ZhizVerificationMode;
    requiresNewPassword: boolean;
  },
): void {
  if (
    challengeState.targetUserId !== context.targetUserId ||
    normalizeEmailAddress(challengeState.targetEmail) !==
      normalizeEmailAddress(context.targetEmail) ||
    challengeState.verificationMode !== context.verificationMode ||
    challengeState.requiresNewPassword !== context.requiresNewPassword
  ) {
    throw new AppError(
      'AUTH_ZHIZ_TICKET_INVALID',
      'Zhiz email verification challenge does not match current continuation ticket',
    );
  }
}

async function buildAuthResultForUser(userId: string): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      role: true,
    },
  });

  if (!user) {
    throw new AppError('RESOURCE_NOT_FOUND', 'User not found');
  }

  const tokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
  };

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
    },
    tokens: {
      accessToken: signAccessToken(tokenPayload),
      refreshToken: signRefreshToken(tokenPayload),
      expiresIn: getAccessTokenExpiresInSec(),
    },
  };
}

type ZhizWriteClient = Prisma.TransactionClient | typeof prisma;

async function upsertZhizOAuthAccountForUser(
  db: ZhizWriteClient,
  userId: string,
  email: string,
  ticketState: ZhizContinuationTicketState,
): Promise<void> {
  const existing = await db.oAuthAccount.findUnique({
    where: {
      provider_providerId: {
        provider: 'zhiz',
        providerId: ticketState.providerId,
      },
    },
  });

  if (existing) {
    if (existing.userId !== userId) {
      throw new AppError('RESOURCE_CONFLICT', 'Zhiz account is already linked to another user');
    }

    await db.oAuthAccount.update({
      where: { id: existing.id },
      data: {
        email,
        displayName: ticketState.displayName,
        avatarUrl: ticketState.avatarUrl,
        accessToken: ticketState.encryptedAccessToken,
        rawProfile: ticketState.rawProfile as Prisma.InputJsonValue,
      },
    });
    return;
  }

  try {
    await db.oAuthAccount.create({
      data: {
        userId,
        provider: 'zhiz',
        providerId: ticketState.providerId,
        email,
        displayName: ticketState.displayName,
        avatarUrl: ticketState.avatarUrl,
        accessToken: ticketState.encryptedAccessToken,
        rawProfile: ticketState.rawProfile as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      throw new AppError('RESOURCE_CONFLICT', 'Zhiz account is already linked to another user');
    }
    throw err;
  }
}
