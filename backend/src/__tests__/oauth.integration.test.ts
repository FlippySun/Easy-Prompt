/**
 * OAuth 集成测试 — Zhiz start/callback/continuation 最小闭环
 * 2026-04-14 新增 — Zhiz OAuth Superpowers Execute T2/T3/T5
 * 变更类型：新增/测试
 * 功能描述：验证 Zhiz OAuth start 的 state=nonce 约束、callback 的 ready/needs_email 分支，以及 T4 完整的 status/finish/password-setup 行为。
 * 设计思路：使用 supertest 驱动真实 Express app，请求链路保持真实；仅对外部 Zhiz token 接口使用 fetch mock，避免引入额外测试桩层。
 * 参数与返回值：本文件无外部参数；各测试断言 HTTP 跳转、Redis ticket payload 与 OAuthAccount 持久化结果。
 * 影响范围：仅测试环境；覆盖 /api/v1/auth/oauth/zhiz start/callback。
 * 潜在风险：依赖测试数据库与 Redis，可通过 helpers/setup.ts 的清理逻辑控制污染。
 */

const { sendZhizPasswordSetupCodeEmailMock } = vi.hoisted(() => ({
  sendZhizPasswordSetupCodeEmailMock: vi.fn(),
}));

vi.mock('../services/mail.service', () => ({
  sendZhizPasswordSetupCodeEmail: sendZhizPasswordSetupCodeEmailMock,
}));

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { comparePassword, hashPassword } from '../utils/password';
import { AppError } from '../utils/errors';
import { cleanupRedis, cleanupTestData, createTestApp, globalTeardown } from './helpers/setup';

let app: Express;
const fetchMock = vi.fn();

function createMockHeaders(contentType: string): Headers {
  return {
    get: vi
      .fn()
      .mockImplementation((name: string) =>
        name.toLowerCase() === 'content-type' ? contentType : null,
      ),
  } as unknown as Headers;
}

function mockJsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: createMockHeaders('application/json'),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
    json: vi.fn().mockResolvedValue(data),
  } as unknown as Response;
}

function mockTextResponse(
  body: string,
  options: { status?: number; contentType?: string } = {},
): Response {
  const status = options.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: createMockHeaders(options.contentType ?? 'text/plain'),
    text: vi.fn().mockResolvedValue(body),
    json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token < in JSON at position 0')),
  } as unknown as Response;
}

function getZhizAuthorizeParams(location: string): URLSearchParams {
  const hash = new URL(location).hash;
  const hashQuery = hash.split('?')[1] ?? '';
  return new URLSearchParams(hashQuery);
}

async function seedZhizState(nonce: string, overrides: Partial<Record<string, string>> = {}) {
  await redis.setex(
    `oauth:state:${nonce}`,
    600,
    JSON.stringify({
      provider: 'zhiz',
      oauthNonce: nonce,
      clientRedirectUri: overrides.clientRedirectUri ?? 'vscode://easy-prompt/callback',
      clientState: overrides.clientState ?? 'outer-sso-state',
      webReturnTo: overrides.webReturnTo ?? '/dashboard',
      frontendRedirect: overrides.frontendRedirect ?? '',
    }),
  );
}

async function createZhizContinuationTicket(params: {
  nonce: string;
  code: string;
  tokenResponse: Record<string, unknown>;
  stateOverrides?: Partial<Record<string, string>>;
}): Promise<string> {
  await seedZhizState(params.nonce, params.stateOverrides);
  fetchMock.mockResolvedValueOnce(mockJsonResponse(params.tokenResponse));

  const res = await request(app)
    .get('/api/v1/auth/oauth/zhiz/callback')
    .query({ code: params.code, state: params.nonce, nonce: params.nonce })
    .expect(302);

  const ticket = new URL(res.headers.location as string).searchParams.get('ticket');
  expect(ticket).toBeTruthy();
  return ticket as string;
}

async function createPasswordSetupRequiredFixture(): Promise<{
  ticket: string;
  userId: string;
  email: string;
  maskedEmail: string;
  providerId: string;
}> {
  const unique = Date.now();
  const email = `oauth-only-${unique}@integration.test`;
  const providerId = `zhiz-openid-password-setup-${unique}`;
  const user = await prisma.user.create({
    data: {
      email,
      username: `oauth_only_${unique}`,
      passwordHash: 'oauth:google:legacy-account',
      displayName: 'OAuth Only User',
    },
  });

  const ticket = await createZhizContinuationTicket({
    nonce: `nonce-password-setup-${unique}`,
    code: `password-setup-${unique}`,
    tokenResponse: {
      access_token: `zhiz-password-setup-token-${unique}`,
      openid: providerId,
      nickname: 'OAuth Only User',
      avatar_url: 'https://avatar.example/oauth-only.png',
    },
  });

  const finishRes = await request(app)
    .post('/api/v1/auth/oauth/zhiz/finish')
    .send({ ticket, email: user.email, password: 'IgnoredPass123' })
    .expect(409);

  expect(finishRes.body.error.code).toBe('AUTH_ZHIZ_PASSWORD_SETUP_REQUIRED');

  return {
    ticket,
    userId: user.id,
    email: user.email,
    maskedEmail: finishRes.body.error.details.maskedEmail as string,
    providerId,
  };
}

beforeAll(async () => {
  config.OAUTH_ZHIZ_CLIENT_ID = 'test-zhiz-client-id';
  config.OAUTH_ZHIZ_CLIENT_SECRET = 'test-zhiz-client-secret';
  config.OAUTH_GOOGLE_CLIENT_ID = 'test-google-client-id';
  config.OAUTH_GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
  config.OAUTH_ZHIZ_BASE_URL = 'https://8060.zhiz.chat';
  config.OAUTH_ZHIZ_AUTH_PAGE_URL = 'https://3001.zhiz.chat/#/oauth/authorize';
  config.OAUTH_CALLBACK_BASE_URL = 'https://api.zhiz.chat';
  config.AUTH_WEB_BASE_URL = 'https://3000.zhiz.chat';
  if (!config.OAUTH_TOKEN_ENCRYPTION_KEY) {
    config.OAUTH_TOKEN_ENCRYPTION_KEY = config.PROVIDER_ENCRYPTION_KEY;
  }
  vi.stubGlobal('fetch', fetchMock);
  app = createTestApp();
});

beforeEach(async () => {
  fetchMock.mockReset();
  sendZhizPasswordSetupCodeEmailMock.mockReset();
  await cleanupTestData();
  await cleanupRedis();
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await cleanupTestData();
  await cleanupRedis();
  await globalTeardown();
});

describe('GET /api/v1/auth/oauth/zhiz', () => {
  it('should use the same nonce value for OAuth state and callback redirect_uri nonce', async () => {
    const res = await request(app)
      .get('/api/v1/auth/oauth/zhiz')
      .query({
        clientRedirectUri: 'vscode://easy-prompt/callback',
        clientState: 'outer-client-state',
        webReturnTo: '/pricing',
      })
      .expect(302);

    const params = getZhizAuthorizeParams(res.headers.location);
    const state = params.get('state');
    expect(state).toBeTruthy();

    const redirectUri = new URL(params.get('redirect_uri') || 'https://api.zhiz.chat');
    expect(redirectUri.searchParams.get('nonce')).toBe(state);

    const stored = await redis.get(`oauth:state:${state}`);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored || '{}')).toMatchObject({
      provider: 'zhiz',
      oauthNonce: state,
      clientRedirectUri: 'vscode://easy-prompt/callback',
      clientState: 'outer-client-state',
      webReturnTo: '/pricing',
    });
  });

  /**
   * 2026-04-14 修复 — Zhiz hash-route 截断回归测试
   * 变更类型：新增/测试
   * 功能描述：模拟 `.env` 中未给 `#` 路由加引号而被截成根域名的配置值，确认 start 跳转会自动恢复到 `#/oauth/authorize`。
   * 设计思路：直接覆写运行时 config 值为 `https://3001.zhiz.chat/`，避免测试绕过 normalize 分支。
   * 参数与返回值：本测试无外部参数；断言 302 Location 的 hash 与 query 均落在授权页 hash-route 中。
   * 影响范围：`GET /api/v1/auth/oauth/zhiz` 的生产配置容错。
   * 潜在风险：若 Zhiz 授权页未来不再使用 hash-route，需要同步调整断言。
   */
  it('should normalize a truncated Zhiz auth page root URL back to the authorize hash-route', async () => {
    const previousAuthPageUrl = config.OAUTH_ZHIZ_AUTH_PAGE_URL;
    config.OAUTH_ZHIZ_AUTH_PAGE_URL = 'https://3001.zhiz.chat/';

    try {
      const res = await request(app)
        .get('/api/v1/auth/oauth/zhiz')
        .query({ clientRedirectUri: 'vscode://easy-prompt/callback' })
        .expect(302);

      const location = new URL(res.headers.location as string);
      expect(location.origin).toBe('https://3001.zhiz.chat');
      expect(location.hash.startsWith('#/oauth/authorize?')).toBe(true);

      const params = getZhizAuthorizeParams(res.headers.location);
      expect(params.get('client_id')).toBe('test-zhiz-client-id');
      expect(params.get('redirect_uri')).toContain('/api/v1/auth/oauth/zhiz/callback');
      expect(params.get('state')).toBeTruthy();
    } finally {
      config.OAUTH_ZHIZ_AUTH_PAGE_URL = previousAuthPageUrl;
    }
  });

  /**
   * 2026-04-17 修复 — 环境区分任务 2 fail-closed start 回归测试
   * 变更类型：新增/测试
   * 功能描述：确认 backend 在缺少 `OAUTH_CALLBACK_BASE_URL` 时不会再静默 fallback 到 localhost，而是返回明确的配置错误。
   * 设计思路：直接打真实 start 路由，断言统一 error handler 输出的 `SYSTEM_INTERNAL_ERROR + details.missingEnv`。
   * 参数与返回值：无；断言 HTTP 500 与错误 details。
   * 影响范围：OAuth start/provider redirect_uri 构造、本地/生产环境分层。
   * 潜在风险：若后续错误码策略调整，需要同步更新断言字段。
   */
  it('should fail closed when OAUTH_CALLBACK_BASE_URL is missing during OAuth start', async () => {
    const previousCallbackBaseUrl = config.OAUTH_CALLBACK_BASE_URL;
    config.OAUTH_CALLBACK_BASE_URL = '';

    try {
      const res = await request(app)
        .get('/api/v1/auth/oauth/zhiz')
        .query({ clientRedirectUri: 'vscode://easy-prompt/callback' })
        .expect(500);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SYSTEM_INTERNAL_ERROR');
      expect(res.body.error.details).toMatchObject({
        missingEnv: 'OAUTH_CALLBACK_BASE_URL',
        usage: 'OAuth provider callback URLs',
      });
    } finally {
      config.OAUTH_CALLBACK_BASE_URL = previousCallbackBaseUrl;
    }
  });

  /**
   * 2026-04-17 修复 — 环境区分任务 2 fail-closed callback 错误页回归测试
   * 变更类型：新增/测试
   * 功能描述：确认 callback 失败时若缺少 `AUTH_WEB_BASE_URL`，backend 不再静默退回相对登录页，而是返回明确配置错误。
   * 设计思路：走 provider error 分支，避免依赖 Redis state / 第三方 token 请求即可触发错误页回跳逻辑。
   * 参数与返回值：无；断言 HTTP 500 与错误 details。
   * 影响范围：OAuth callback 错误页回跳、前端登录页基准地址分层。
   * 潜在风险：若后续 callback 错误处理改为统一 JSON，此断言需要同步调整。
   */
  it('should fail closed when AUTH_WEB_BASE_URL is missing for callback error redirects', async () => {
    const previousAuthWebBaseUrl = config.AUTH_WEB_BASE_URL;
    config.AUTH_WEB_BASE_URL = '';

    try {
      const res = await request(app)
        .get('/api/v1/auth/oauth/zhiz/callback')
        .query({ error: 'access_denied', state: 'missing-auth-web-base' })
        .expect(500);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SYSTEM_INTERNAL_ERROR');
      expect(res.body.error.details).toMatchObject({
        missingEnv: 'AUTH_WEB_BASE_URL',
        usage: 'OAuth error redirects',
      });
    } finally {
      config.AUTH_WEB_BASE_URL = previousAuthWebBaseUrl;
    }
  });
});

/**
 * 2026-04-17 修复 — 环境区分任务 2 OAuth cookie domain 回归测试
 * 变更类型：新增/测试
 * 功能描述：验证 `COOKIE_DOMAIN=''` 时 OAuth callback 写出的 refresh cookie 不再携带 `Domain=`，避免本地联调复用生产 `.zhiz.chat` cookie 域。
 * 设计思路：复用文件内已有 fetch mock，走最小 Google callback 成功链路，直接检查 `set-cookie` 头。
 * 参数与返回值：无；断言 302 Location 与 `set-cookie` 中不存在 Domain 属性。
 * 影响范围：OAuth callback refresh cookie、本地 host-only cookie 行为。
 * 潜在风险：若后续 cookie 名称或重定向协议调整，需要同步更新断言。
 */
describe('GET /api/v1/auth/oauth/google/callback', () => {
  it('should omit the cookie domain when COOKIE_DOMAIN is blank', async () => {
    const state = `google-cookie-domain-${Date.now()}`;
    const previousCookieDomain = config.COOKIE_DOMAIN;

    await redis.setex(
      `oauth:state:${state}`,
      600,
      JSON.stringify({
        provider: 'google',
        oauthNonce: '',
        clientRedirectUri: '',
        clientState: '',
        webReturnTo: '',
        frontendRedirect: 'https://3000.zhiz.chat/post-auth',
        initiatingUserId: '',
      }),
    );

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ access_token: 'google-cookie-access-token' }),
    );
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 'google-cookie-user-id',
        email: 'google-cookie-user@integration.test',
        name: 'Google Cookie User',
        picture: 'https://avatar.example/google-cookie.png',
        verified_email: true,
      }),
    );

    config.COOKIE_DOMAIN = '';

    try {
      const res = await request(app)
        .get('/api/v1/auth/oauth/google/callback')
        .query({ code: 'google-cookie-code', state })
        .expect(302);

      const rawSetCookie = res.headers['set-cookie'];
      const setCookie = Array.isArray(rawSetCookie)
        ? rawSetCookie
        : typeof rawSetCookie === 'string'
          ? [rawSetCookie]
          : [];
      expect(setCookie.length).toBeGreaterThan(0);
      expect(setCookie.some((cookie) => cookie.includes('refresh_token='))).toBe(true);
      expect(setCookie.some((cookie) => /domain=/i.test(cookie))).toBe(false);
      expect(res.headers.location).toContain('https://3000.zhiz.chat/post-auth');
    } finally {
      config.COOKIE_DOMAIN = previousCookieDomain;
    }
  });
});

describe('GET /api/v1/auth/oauth/zhiz/status', () => {
  it('should return the ready continuation state without consuming the ticket', async () => {
    const user = await prisma.user.create({
      data: {
        email: `status-ready-${Date.now()}@integration.test`,
        username: `status_ready_${Date.now()}`,
        passwordHash: 'oauth:zhiz:placeholder',
        displayName: 'Status Ready User',
      },
    });
    await prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: 'zhiz',
        providerId: 'zhiz-openid-status-ready',
        displayName: 'Old Ready User',
        rawProfile: { openid: 'zhiz-openid-status-ready' },
      },
    });

    const ticket = await createZhizContinuationTicket({
      nonce: 'nonce-status-ready',
      code: 'status-ready-code',
      tokenResponse: {
        access_token: 'zhiz-status-ready-token',
        openid: 'zhiz-openid-status-ready',
        nickname: 'Status Ready User',
        avatar_url: 'https://avatar.example/status-ready.png',
      },
    });

    const res = await request(app)
      .get('/api/v1/auth/oauth/zhiz/status')
      .query({ ticket })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      status: 'ready',
      profile: {
        displayName: 'Status Ready User',
        avatarUrl: 'https://avatar.example/status-ready.png',
      },
      clientRedirectUri: 'vscode://easy-prompt/callback',
      clientState: 'outer-sso-state',
      webReturnTo: '/dashboard',
    });

    const stored = await redis.get(`oauth:zhiz:ticket:${ticket}`);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored || '{}').consumedAt ?? null).toBeNull();
  });
});

describe('POST /api/v1/auth/oauth/zhiz/finish', () => {
  it('should finish a ready continuation ticket and mark it as consumed', async () => {
    const user = await prisma.user.create({
      data: {
        email: `finish-ready-${Date.now()}@integration.test`,
        username: `finish_ready_${Date.now()}`,
        passwordHash: 'oauth:zhiz:placeholder',
        displayName: 'Finish Ready User',
      },
    });
    await prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: 'zhiz',
        providerId: 'zhiz-openid-finish-ready',
        displayName: 'Old Finish User',
        rawProfile: { openid: 'zhiz-openid-finish-ready' },
      },
    });

    const ticket = await createZhizContinuationTicket({
      nonce: 'nonce-finish-ready',
      code: 'finish-ready-code',
      tokenResponse: {
        access_token: 'zhiz-finish-ready-token',
        openid: 'zhiz-openid-finish-ready',
        nickname: 'Finish Ready User',
        avatar_url: 'https://avatar.example/finish-ready.png',
      },
    });

    const res = await request(app)
      .post('/api/v1/auth/oauth/zhiz/finish')
      .send({ ticket })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(user.email);
    expect(res.body.data.tokens.accessToken).toBeTruthy();
    expect(res.body.data.tokens.refreshToken).toBeTruthy();

    const stored = await redis.get(`oauth:zhiz:ticket:${ticket}`);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored || '{}').consumedAt).toBeTruthy();

    const consumedRes = await request(app)
      .post('/api/v1/auth/oauth/zhiz/finish')
      .send({ ticket })
      .expect(409);
    expect(consumedRes.body.error.code).toBe('AUTH_ZHIZ_TICKET_CONSUMED');
  });

  it('should create a new local user and bind Zhiz account for a first-time email completion', async () => {
    const ticket = await createZhizContinuationTicket({
      nonce: 'nonce-finish-new-user',
      code: 'finish-new-user-code',
      tokenResponse: {
        access_token: 'zhiz-finish-new-user-token',
        openid: 'zhiz-openid-finish-new-user',
        nickname: 'Finish New User',
        avatar_url: 'https://avatar.example/finish-new-user.png',
      },
      stateOverrides: {
        clientRedirectUri: 'vscode://easy-prompt/new-user',
        clientState: 'outer-new-user-state',
        webReturnTo: '/new-user',
      },
    });

    const email = `zhiz-new-${Date.now()}@integration.test`;
    const finishRes = await request(app)
      .post('/api/v1/auth/oauth/zhiz/finish')
      .send({ ticket, email })
      .expect(409);

    expect(finishRes.body.error.code).toBe('AUTH_ZHIZ_EMAIL_VERIFICATION_REQUIRED');
    expect(finishRes.body.error.details).toMatchObject({
      step: 'verify_email_and_set_password',
      verificationMode: 'create_user',
      requiresNewPassword: true,
    });

    const storedAfterFinish = await redis.get(`oauth:zhiz:ticket:${ticket}`);
    expect(storedAfterFinish).toBeTruthy();
    expect(JSON.parse(storedAfterFinish || '{}')).toMatchObject({
      step: 'verify_email_and_set_password',
      targetEmail: email,
      verificationMode: 'create_user',
      requiresNewPassword: true,
    });

    sendZhizPasswordSetupCodeEmailMock.mockResolvedValueOnce(undefined);
    const startRes = await request(app)
      .post('/api/v1/auth/oauth/zhiz/password-setup/start')
      .send({ ticket })
      .expect(200);

    expect(startRes.body.data).toMatchObject({
      verificationMode: 'create_user',
      requiresNewPassword: true,
    });

    const sentMailInput = sendZhizPasswordSetupCodeEmailMock.mock.calls[0]?.[0] as { code: string };
    const res = await request(app)
      .post('/api/v1/auth/oauth/zhiz/password-setup/complete')
      .send({ ticket, code: sentMailInput.code, newPassword: 'TestPass123' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.displayName).toBe('Finish New User');

    const createdUser = await prisma.user.findUnique({ where: { email } });
    expect(createdUser).toBeTruthy();
    expect(createdUser?.avatarUrl).toBe('https://avatar.example/finish-new-user.png');

    const linkedAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerId: { provider: 'zhiz', providerId: 'zhiz-openid-finish-new-user' },
      },
    });
    expect(linkedAccount?.userId).toBe(createdUser?.id);
    expect(linkedAccount?.accessToken).toBeTruthy();
    expect(linkedAccount?.accessToken).not.toBe('zhiz-finish-new-user-token');
  });

  /**
   * 2026-04-15 修复 — Zhiz finish 弱密码错误细节回归测试
   * 变更类型：修复/测试
   * 功能描述：验证首次 Zhiz 补邮箱创建本地账号时，若密码不满足策略，后端会返回字段级 `details`，供 complete 页展示明确规则提示。
   * 设计思路：直连 `/api/v1/auth/oauth/zhiz/finish` 的新用户分支，断言 `field/reason/ruleText` 三个最关键契约，避免前端只能拿到泛化 `VALIDATION_FAILED`。
   * 参数与返回值：无；断言接口返回 400 与结构化错误 details。
   * 影响范围：Zhiz complete 首次补邮箱/密码页面的字段级提示。
   * 潜在风险：若未来密码策略文案调整，本断言需同步更新 `ruleText` 片段。
   */
  it('should return structured password policy details when first-bind verification completes with a weak new password', async () => {
    const ticket = await createZhizContinuationTicket({
      nonce: 'nonce-finish-weak-password',
      code: 'finish-weak-password-code',
      tokenResponse: {
        access_token: 'zhiz-finish-weak-password-token',
        openid: 'zhiz-openid-finish-weak-password',
        nickname: 'Weak Password User',
        avatar_url: 'https://avatar.example/finish-weak-password.png',
      },
    });

    const email = `weak-password-${Date.now()}@integration.test`;
    const finishRes = await request(app)
      .post('/api/v1/auth/oauth/zhiz/finish')
      .send({ ticket, email })
      .expect(409);

    expect(finishRes.body.error.code).toBe('AUTH_ZHIZ_EMAIL_VERIFICATION_REQUIRED');
    expect(finishRes.body.error.details).toMatchObject({
      step: 'verify_email_and_set_password',
      verificationMode: 'create_user',
      requiresNewPassword: true,
    });

    sendZhizPasswordSetupCodeEmailMock.mockResolvedValueOnce(undefined);
    await request(app)
      .post('/api/v1/auth/oauth/zhiz/password-setup/start')
      .send({ ticket })
      .expect(200);

    const sentMailInput = sendZhizPasswordSetupCodeEmailMock.mock.calls[0]?.[0] as { code: string };
    const res = await request(app)
      .post('/api/v1/auth/oauth/zhiz/password-setup/complete')
      .send({ ticket, code: sentMailInput.code, newPassword: 'weakpass' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details).toMatchObject({
      field: 'newPassword',
      reason: 'password_policy',
    });
    expect(res.body.error.details.ruleText).toContain('至少 8 位');
  });

  it('should require email verification before binding Zhiz to an existing local-password user', async () => {
    const user = await prisma.user.create({
      data: {
        email: `bind-existing-${Date.now()}@integration.test`,
        username: `bind_existing_${Date.now()}`,
        passwordHash: await hashPassword('BindPass123'),
        displayName: 'Existing Local User',
      },
    });

    const ticket = await createZhizContinuationTicket({
      nonce: 'nonce-bind-existing',
      code: 'bind-existing-code',
      tokenResponse: {
        access_token: 'zhiz-bind-existing-token',
        openid: 'zhiz-openid-bind-existing',
        nickname: 'Bind Existing User',
        avatar_url: 'https://avatar.example/bind-existing.png',
      },
    });

    const finishRes = await request(app)
      .post('/api/v1/auth/oauth/zhiz/finish')
      .send({ ticket, email: user.email })
      .expect(409);

    expect(finishRes.body.error.code).toBe('AUTH_ZHIZ_EMAIL_VERIFICATION_REQUIRED');
    expect(finishRes.body.error.details).toMatchObject({
      step: 'verify_email',
      verificationMode: 'bind_existing_user',
      requiresNewPassword: false,
    });

    const storedAfterFinish = await redis.get(`oauth:zhiz:ticket:${ticket}`);
    expect(storedAfterFinish).toBeTruthy();
    expect(JSON.parse(storedAfterFinish || '{}')).toMatchObject({
      step: 'verify_email',
      targetUserId: user.id,
      targetEmail: user.email,
      verificationMode: 'bind_existing_user',
      requiresNewPassword: false,
    });

    sendZhizPasswordSetupCodeEmailMock.mockResolvedValueOnce(undefined);
    const startRes = await request(app)
      .post('/api/v1/auth/oauth/zhiz/password-setup/start')
      .send({ ticket })
      .expect(200);

    expect(startRes.body.data).toMatchObject({
      verificationMode: 'bind_existing_user',
      requiresNewPassword: false,
    });

    const sentMailInput = sendZhizPasswordSetupCodeEmailMock.mock.calls[0]?.[0] as { code: string };
    const res = await request(app)
      .post('/api/v1/auth/oauth/zhiz/password-setup/complete')
      .send({ ticket, code: sentMailInput.code })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user.id).toBe(user.id);

    const linkedAccount = await prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider: 'zhiz', providerId: 'zhiz-openid-bind-existing' } },
    });
    expect(linkedAccount?.userId).toBe(user.id);
    expect(linkedAccount?.email).toBe(user.email);
  });

  it('should not allow an existing local password to bypass first-bind email verification', async () => {
    const user = await prisma.user.create({
      data: {
        email: `bind-fail-${Date.now()}@integration.test`,
        username: `bind_fail_${Date.now()}`,
        passwordHash: await hashPassword('CorrectPass123'),
        displayName: 'Bind Fail User',
      },
    });

    const ticket = await createZhizContinuationTicket({
      nonce: 'nonce-bind-fail',
      code: 'bind-fail-code',
      tokenResponse: {
        access_token: 'zhiz-bind-fail-token',
        openid: 'zhiz-openid-bind-fail',
        nickname: 'Bind Fail User',
        avatar_url: 'https://avatar.example/bind-fail.png',
      },
    });

    const res = await request(app)
      .post('/api/v1/auth/oauth/zhiz/finish')
      .send({ ticket, email: user.email, password: 'WrongPass123' })
      .expect(409);

    expect(res.body.error.code).toBe('AUTH_ZHIZ_EMAIL_VERIFICATION_REQUIRED');
    expect(res.body.error.details).toMatchObject({
      step: 'verify_email',
      verificationMode: 'bind_existing_user',
      requiresNewPassword: false,
    });

    const storedAfterFinish = await redis.get(`oauth:zhiz:ticket:${ticket}`);
    expect(storedAfterFinish).toBeTruthy();
    expect(JSON.parse(storedAfterFinish || '{}')).toMatchObject({
      step: 'verify_email',
      targetUserId: user.id,
      targetEmail: user.email,
      verificationMode: 'bind_existing_user',
      requiresNewPassword: false,
    });

    const linkedAccount = await prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider: 'zhiz', providerId: 'zhiz-openid-bind-fail' } },
    });
    expect(linkedAccount).toBeNull();
  });

  it('should switch the ticket into verify_email_and_set_password when hitting an OAuth-only local account', async () => {
    const user = await prisma.user.create({
      data: {
        email: `oauth-only-${Date.now()}@integration.test`,
        username: `oauth_only_${Date.now()}`,
        passwordHash: 'oauth:google:legacy-account',
        displayName: 'OAuth Only User',
      },
    });

    const ticket = await createZhizContinuationTicket({
      nonce: 'nonce-password-setup-required',
      code: 'password-setup-required-code',
      tokenResponse: {
        access_token: 'zhiz-password-setup-required-token',
        openid: 'zhiz-openid-password-setup-required',
        nickname: 'OAuth Only User',
        avatar_url: 'https://avatar.example/oauth-only.png',
      },
    });

    const finishRes = await request(app)
      .post('/api/v1/auth/oauth/zhiz/finish')
      .send({ ticket, email: user.email, password: 'IgnoredPass123' })
      .expect(409);

    expect(finishRes.body.error.code).toBe('AUTH_ZHIZ_PASSWORD_SETUP_REQUIRED');
    expect(finishRes.body.error.details).toMatchObject({
      step: 'verify_email_and_set_password',
    });

    const statusRes = await request(app)
      .get('/api/v1/auth/oauth/zhiz/status')
      .query({ ticket })
      .expect(200);

    expect(statusRes.body.data).toMatchObject({
      status: 'needs_email',
      step: 'verify_email_and_set_password',
      maskedEmail: finishRes.body.error.details.maskedEmail,
    });

    const stored = await redis.get(`oauth:zhiz:ticket:${ticket}`);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored || '{}')).toMatchObject({
      step: 'verify_email_and_set_password',
      targetUserId: user.id,
      targetEmail: user.email,
    });
  });
});

describe('Zhiz password setup mail flow', () => {
  it('should send a verification code and expose resend / expiry metadata', async () => {
    const fixture = await createPasswordSetupRequiredFixture();
    sendZhizPasswordSetupCodeEmailMock.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/v1/auth/oauth/zhiz/password-setup/start')
      .send({ ticket: fixture.ticket })
      .expect(200);

    expect(sendZhizPasswordSetupCodeEmailMock).toHaveBeenCalledTimes(1);
    expect(sendZhizPasswordSetupCodeEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: fixture.email,
        displayName: 'OAuth Only User',
        code: expect.stringMatching(/^\d{6}$/),
      }),
    );
    expect(res.body.data).toMatchObject({
      maskedEmail: fixture.maskedEmail,
    });
    expect(res.body.data.resendAfterSec).toBeGreaterThan(0);
    expect(res.body.data.challengeExpiresInSec).toBeGreaterThan(0);

    const rawChallenge = await redis.get(`oauth:zhiz:email-verify:${fixture.ticket}`);
    expect(rawChallenge).toBeTruthy();
    expect(JSON.parse(rawChallenge || '{}')).toMatchObject({
      targetUserId: fixture.userId,
      targetEmail: fixture.email,
      maskedEmail: fixture.maskedEmail,
      attemptCount: 0,
    });

    const statusRes = await request(app)
      .get('/api/v1/auth/oauth/zhiz/status')
      .query({ ticket: fixture.ticket })
      .expect(200);
    expect(statusRes.body.data.status).toBe('needs_email');
    expect(statusRes.body.data.step).toBe('verify_email_and_set_password');
    expect(statusRes.body.data.maskedEmail).toBe(fixture.maskedEmail);
    expect(statusRes.body.data.resendAfterSec).toBeGreaterThan(0);
    expect(statusRes.body.data.challengeExpiresInSec).toBeGreaterThan(0);
  });

  it('should rate limit resend attempts during cooldown window', async () => {
    const fixture = await createPasswordSetupRequiredFixture();
    sendZhizPasswordSetupCodeEmailMock.mockResolvedValueOnce(undefined);

    await request(app)
      .post('/api/v1/auth/oauth/zhiz/password-setup/start')
      .send({ ticket: fixture.ticket })
      .expect(200);

    const secondRes = await request(app)
      .post('/api/v1/auth/oauth/zhiz/password-setup/start')
      .send({ ticket: fixture.ticket })
      .expect(429);

    expect(sendZhizPasswordSetupCodeEmailMock).toHaveBeenCalledTimes(1);
    expect(secondRes.body.error.code).toBe('AUTH_ZHIZ_EMAIL_CODE_RATE_LIMITED');
    expect(secondRes.body.error.details.resendAfterSec).toBeGreaterThan(0);
  });

  it('should keep challenge state and decrement remaining attempts when code is invalid', async () => {
    const fixture = await createPasswordSetupRequiredFixture();
    sendZhizPasswordSetupCodeEmailMock.mockResolvedValueOnce(undefined);

    await request(app)
      .post('/api/v1/auth/oauth/zhiz/password-setup/start')
      .send({ ticket: fixture.ticket })
      .expect(200);

    const invalidRes = await request(app)
      .post('/api/v1/auth/oauth/zhiz/password-setup/complete')
      .send({ ticket: fixture.ticket, code: '000000', newPassword: 'ResetPass123' })
      .expect(400);

    expect(invalidRes.body.error.code).toBe('AUTH_ZHIZ_EMAIL_CODE_INVALID');
    expect(invalidRes.body.error.details.remainingAttempts).toBe(
      config.AUTH_EMAIL_CODE_MAX_ATTEMPTS - 1,
    );

    const rawChallenge = await redis.get(`oauth:zhiz:email-verify:${fixture.ticket}`);
    expect(rawChallenge).toBeTruthy();
    expect(JSON.parse(rawChallenge || '{}').attemptCount).toBe(1);
  });

  /**
   * 2026-04-15 修复 — Zhiz password-setup 弱密码错误细节回归测试
   * 变更类型：修复/测试
   * 功能描述：验证历史 OAuth-only 账号补设本地密码时，若新密码不满足策略，后端会返回 `newPassword` 字段级 details，供 complete 页面在输入框下方显示明确规则。
   * 设计思路：先发送一次真实验证码以建立 challenge，再故意提交弱密码，断言错误细节来自 service 层而非退化为通用文案。
   * 参数与返回值：无；断言接口返回 400 与结构化密码策略 details。
   * 影响范围：Zhiz `verify_email_and_set_password` 子流程的新密码提示。
   * 潜在风险：若未来密码策略文案调整，本断言需同步更新 `ruleText` 片段。
   */
  it('should reject weak new passwords before binding the Zhiz account', async () => {
    const fixture = await createPasswordSetupRequiredFixture();
    sendZhizPasswordSetupCodeEmailMock.mockResolvedValueOnce(undefined);

    await request(app)
      .post('/api/v1/auth/oauth/zhiz/password-setup/start')
      .send({ ticket: fixture.ticket })
      .expect(200);

    const sentMailInput = sendZhizPasswordSetupCodeEmailMock.mock.calls[0]?.[0] as { code: string };
    const res = await request(app)
      .post('/api/v1/auth/oauth/zhiz/password-setup/complete')
      .send({
        ticket: fixture.ticket,
        code: sentMailInput.code,
        newPassword: 'weakpass',
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details).toMatchObject({
      field: 'newPassword',
      reason: 'password_policy',
    });
    expect(res.body.error.details.ruleText).toContain('至少 8 位');
  });

  it('should reject password setup completion when the email verification code has expired', async () => {
    const fixture = await createPasswordSetupRequiredFixture();
    sendZhizPasswordSetupCodeEmailMock.mockResolvedValueOnce(undefined);

    await request(app)
      .post('/api/v1/auth/oauth/zhiz/password-setup/start')
      .send({ ticket: fixture.ticket })
      .expect(200);

    const rawChallenge = await redis.get(`oauth:zhiz:email-verify:${fixture.ticket}`);
    expect(rawChallenge).toBeTruthy();

    const expiredChallenge = {
      ...(JSON.parse(rawChallenge || '{}') as Record<string, unknown>),
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
      resendAvailableAt: new Date(Date.now() - 2_000).toISOString(),
    };

    await redis.setex(
      `oauth:zhiz:email-verify:${fixture.ticket}`,
      config.AUTH_EMAIL_CODE_TTL_SEC,
      JSON.stringify(expiredChallenge),
    );

    const expiredRes = await request(app)
      .post('/api/v1/auth/oauth/zhiz/password-setup/complete')
      .send({ ticket: fixture.ticket, code: '123456', newPassword: 'ResetPass123' })
      .expect(400);

    expect(expiredRes.body.error.code).toBe('AUTH_ZHIZ_EMAIL_CODE_EXPIRED');
    expect(expiredRes.body.error.details).toMatchObject({
      step: 'verify_email_and_set_password',
      maskedEmail: fixture.maskedEmail,
    });

    const statusRes = await request(app)
      .get('/api/v1/auth/oauth/zhiz/status')
      .query({ ticket: fixture.ticket })
      .expect(200);

    expect(statusRes.body.data).toMatchObject({
      status: 'needs_email',
      step: 'verify_email_and_set_password',
      maskedEmail: fixture.maskedEmail,
      challengeExpiresInSec: 0,
    });
  });

  it('should complete password setup, bind Zhiz, consume ticket, and clear challenge', async () => {
    const fixture = await createPasswordSetupRequiredFixture();
    sendZhizPasswordSetupCodeEmailMock.mockResolvedValueOnce(undefined);

    await request(app)
      .post('/api/v1/auth/oauth/zhiz/password-setup/start')
      .send({ ticket: fixture.ticket })
      .expect(200);

    const sentMailInput = sendZhizPasswordSetupCodeEmailMock.mock.calls[0]?.[0] as { code: string };
    const completeRes = await request(app)
      .post('/api/v1/auth/oauth/zhiz/password-setup/complete')
      .send({ ticket: fixture.ticket, code: sentMailInput.code, newPassword: 'ResetPass123' })
      .expect(200);

    expect(completeRes.body.success).toBe(true);
    expect(completeRes.body.data.user.id).toBe(fixture.userId);
    expect(completeRes.body.data.tokens.accessToken).toBeTruthy();

    const updatedUser = await prisma.user.findUnique({ where: { id: fixture.userId } });
    expect(updatedUser).toBeTruthy();
    expect(await comparePassword('ResetPass123', updatedUser?.passwordHash || '')).toBe(true);

    const linkedAccount = await prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider: 'zhiz', providerId: fixture.providerId } },
    });
    expect(linkedAccount?.userId).toBe(fixture.userId);
    expect(linkedAccount?.email).toBe(fixture.email);

    const consumedTicket = await redis.get(`oauth:zhiz:ticket:${fixture.ticket}`);
    expect(JSON.parse(consumedTicket || '{}').consumedAt).toBeTruthy();
    expect(await redis.get(`oauth:zhiz:email-verify:${fixture.ticket}`)).toBeNull();
  });

  it('should not persist challenge state when sending the verification email fails', async () => {
    const fixture = await createPasswordSetupRequiredFixture();
    sendZhizPasswordSetupCodeEmailMock.mockRejectedValueOnce(
      new AppError('AUTH_ZHIZ_EMAIL_SEND_FAILED', 'Tencent Cloud SES unavailable'),
    );

    const res = await request(app)
      .post('/api/v1/auth/oauth/zhiz/password-setup/start')
      .send({ ticket: fixture.ticket })
      .expect(502);

    expect(res.body.error.code).toBe('AUTH_ZHIZ_EMAIL_SEND_FAILED');
    expect(await redis.get(`oauth:zhiz:email-verify:${fixture.ticket}`)).toBeNull();
  });
});

describe('GET /api/v1/auth/oauth/zhiz/callback', () => {
  it('should create a ready continuation ticket for an already linked Zhiz account', async () => {
    const user = await prisma.user.create({
      data: {
        email: `ready-${Date.now()}@integration.test`,
        username: `ready_user_${Date.now()}`,
        passwordHash: 'hashed-password',
        displayName: 'Ready User',
      },
    });
    await prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: 'zhiz',
        providerId: 'zhiz-openid-ready',
        displayName: 'Old Zhiz User',
        rawProfile: { openid: 'zhiz-openid-ready' },
      },
    });
    await seedZhizState('nonce-ready');
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        access_token: 'zhiz-access-token-ready',
        openid: 'zhiz-openid-ready',
        nickname: 'Ready Zhiz User',
        avatar_url: 'https://avatar.example/ready.png',
      }),
    );

    const res = await request(app)
      .get('/api/v1/auth/oauth/zhiz/callback')
      .query({ code: 'ready-code', state: 'nonce-ready', nonce: 'nonce-ready' })
      .expect(302);

    const location = res.headers.location as string;
    expect(location.startsWith('https://3000.zhiz.chat/auth/zhiz/complete?ticket=')).toBe(true);
    const ticket = new URL(location).searchParams.get('ticket');
    expect(ticket).toBeTruthy();

    const stored = await redis.get(`oauth:zhiz:ticket:${ticket}`);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored || '{}')).toMatchObject({
      provider: 'zhiz',
      status: 'ready',
      linkedUserId: user.id,
      providerId: 'zhiz-openid-ready',
      displayName: 'Ready Zhiz User',
      avatarUrl: 'https://avatar.example/ready.png',
      clientRedirectUri: 'vscode://easy-prompt/callback',
      clientState: 'outer-sso-state',
      webReturnTo: '/dashboard',
    });

    const linkedAccount = await prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider: 'zhiz', providerId: 'zhiz-openid-ready' } },
    });
    expect(linkedAccount?.accessToken).toBeTruthy();
    expect(linkedAccount?.accessToken).not.toBe('zhiz-access-token-ready');
  });

  it('should create a needs_email continuation ticket for a first-time Zhiz login', async () => {
    await seedZhizState('nonce-needs-email', {
      clientRedirectUri: 'vscode://easy-prompt/callback-2',
      clientState: 'outer-state-2',
      webReturnTo: '/collections',
    });
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        access_token: 'zhiz-access-token-needs-email',
        openid: 'zhiz-openid-needs-email',
        nickname: 'First Zhiz User',
        avatar_url: 'https://avatar.example/first.png',
      }),
    );

    const res = await request(app)
      .get('/api/v1/auth/oauth/zhiz/callback')
      .query({ code: 'needs-email-code', state: 'nonce-needs-email', nonce: 'nonce-needs-email' })
      .expect(302);

    const ticket = new URL(res.headers.location as string).searchParams.get('ticket');
    expect(ticket).toBeTruthy();

    const stored = await redis.get(`oauth:zhiz:ticket:${ticket}`);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored || '{}')).toMatchObject({
      provider: 'zhiz',
      status: 'needs_email',
      step: 'collect_email',
      linkedUserId: null,
      providerId: 'zhiz-openid-needs-email',
      displayName: 'First Zhiz User',
      avatarUrl: 'https://avatar.example/first.png',
      clientRedirectUri: 'vscode://easy-prompt/callback-2',
      clientState: 'outer-state-2',
      webReturnTo: '/collections',
    });

    const createdAccount = await prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider: 'zhiz', providerId: 'zhiz-openid-needs-email' } },
    });
    expect(createdAccount).toBeNull();
  });

  it('should redirect back to auth login when Zhiz token exchange fails', async () => {
    await seedZhizState('nonce-token-failed');
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse(
        {
          error: 'invalid_grant',
          error_description: 'bad code',
        },
        400,
      ),
    );

    const res = await request(app)
      .get('/api/v1/auth/oauth/zhiz/callback')
      .query({ code: 'bad-code', state: 'nonce-token-failed', nonce: 'nonce-token-failed' })
      .expect(302);

    expect(decodeURIComponent(res.headers.location as string)).toContain(
      'https://3000.zhiz.chat/auth/login?error=Zhiz auth failed: bad code',
    );
  });

  /**
   * 2026-04-14 修复 — Zhiz token endpoint 返回 HTML 时提供明确错误信息
   * 变更类型：新增/测试
   * 功能描述：验证当 Zhiz token 接口返回 HTML/非 JSON 响应时，callback 会重定向为可诊断的 provider 错误，而不是裸 SyntaxError 或通用 OAuth login failed。
   * 设计思路：模拟 404 `text/html` 响应，断言最终错误文案保留 content-type 与 status 线索，便于快速判断是 host/path/网关问题。
   * 参数与返回值：本测试无外部参数；断言 302 跳转错误信息。
   * 影响范围：Zhiz callback 的 token exchange 可观测性与线上排障效率。
   * 潜在风险：若未来统一调整 OAuth 错误文案，本断言需要同步更新。
   */
  it('should redirect with a clear provider error when the Zhiz token endpoint returns HTML', async () => {
    await seedZhizState('nonce-html-response');
    fetchMock.mockResolvedValueOnce(
      mockTextResponse('<html><h1>404 Not Found</h1></html>', {
        status: 404,
        contentType: 'text/html',
      }),
    );

    const res = await request(app)
      .get('/api/v1/auth/oauth/zhiz/callback')
      .query({
        code: 'html-response-code',
        state: 'nonce-html-response',
        nonce: 'nonce-html-response',
      })
      .expect(302);

    expect(decodeURIComponent(res.headers.location as string)).toContain(
      'https://3000.zhiz.chat/auth/login?error=Zhiz auth failed: token endpoint returned text/html (status 404)',
    );
  });

  /**
   * 2026-04-14 修复 — Zhiz callback 失败后保留 state 以支持同 nonce 重试
   * 变更类型：新增/测试
   * 功能描述：验证首次 token exchange 失败时不会提前消费 Redis state，从而允许用户在 TTL 内用同一 nonce 再次完成回调。
   * 设计思路：先模拟失败 callback，再用同一 nonce 发起成功 callback，断言第一次失败后 state 仍存在、第二次成功后 state 被消费。
   * 参数与返回值：本测试无外部参数；断言 302 跳转、Redis state 生命周期与 continuation ticket 创建行为。
   * 影响范围：`GET /api/v1/auth/oauth/zhiz/callback` 的失败重试能力。
   * 潜在风险：若未来将 OAuth state 改为严格单次且不可重试，需要同步调整该回归测试。
   */
  it('should preserve Zhiz state after a failed callback so the same nonce can retry successfully', async () => {
    const nonce = 'nonce-retry-after-failure';
    await seedZhizState(nonce);

    fetchMock
      .mockResolvedValueOnce(
        mockJsonResponse(
          {
            error: 'invalid_grant',
            error_description: 'bad code',
          },
          400,
        ),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          access_token: 'zhiz-access-token-retry',
          openid: 'zhiz-openid-retry',
          nickname: 'Retry Success User',
          avatar_url: 'https://avatar.example/retry.png',
        }),
      );

    const failedRes = await request(app)
      .get('/api/v1/auth/oauth/zhiz/callback')
      .query({ code: 'bad-first-code', state: nonce, nonce })
      .expect(302);

    expect(decodeURIComponent(failedRes.headers.location as string)).toContain(
      'https://3000.zhiz.chat/auth/login?error=Zhiz auth failed: bad code',
    );
    expect(await redis.get(`oauth:state:${nonce}`)).toBeTruthy();

    const retryRes = await request(app)
      .get('/api/v1/auth/oauth/zhiz/callback')
      .query({ code: 'good-second-code', nonce })
      .expect(302);

    expect(
      (retryRes.headers.location as string).startsWith(
        'https://3000.zhiz.chat/auth/zhiz/complete?ticket=',
      ),
    ).toBe(true);
    expect(await redis.get(`oauth:state:${nonce}`)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  /**
   * 2026-04-14 修复 — Zhiz 成功 callback 重放命中已有 completion redirect
   * 变更类型：新增/测试
   * 功能描述：验证同一 nonce 首次成功后，后续重复 callback 不再报 Invalid or expired OAuth state，而是直接复用第一次生成的 complete 页跳转。
   * 设计思路：先完成一次成功 callback，再使用相同 nonce 和新 code 重放 callback，断言返回同一个 redirect 且不再重复调用 Zhiz token API。
   * 参数与返回值：本测试无外部参数；断言 redirect 幂等复用与 fetch 调用次数。
   * 影响范围：Zhiz provider/browser 重复回调的幂等体验。
   * 潜在风险：若未来 complete redirect 需要按 code 级别区分，此测试需要同步调整。
   */
  it('should reuse the cached Zhiz completion redirect for repeated successful callbacks with the same nonce', async () => {
    const nonce = 'nonce-success-replay';
    await seedZhizState(nonce);
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        access_token: 'zhiz-access-token-replay',
        openid: 'zhiz-openid-replay',
        nickname: 'Replay Safe User',
        avatar_url: 'https://avatar.example/replay.png',
      }),
    );

    const firstRes = await request(app)
      .get('/api/v1/auth/oauth/zhiz/callback')
      .query({ code: 'first-success-code', nonce })
      .expect(302);

    const firstLocation = firstRes.headers.location as string;
    expect(firstLocation.startsWith('https://3000.zhiz.chat/auth/zhiz/complete?ticket=')).toBe(
      true,
    );
    expect(await redis.get(`oauth:state:${nonce}`)).toBeNull();

    const secondRes = await request(app)
      .get('/api/v1/auth/oauth/zhiz/callback')
      .query({ code: 'second-success-code', nonce })
      .expect(302);

    expect(secondRes.headers.location).toBe(firstLocation);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should reject an invalid or expired Zhiz state before calling the token API', async () => {
    const res = await request(app)
      .get('/api/v1/auth/oauth/zhiz/callback')
      .query({ code: 'missing-state-code', state: 'missing-state', nonce: 'missing-state' })
      .expect(302);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(decodeURIComponent(res.headers.location as string)).toContain(
      'https://3000.zhiz.chat/auth/login?error=Invalid or expired OAuth state',
    );
  });

  it('should allow nonce fallback when Zhiz callback misses the OAuth state parameter', async () => {
    await seedZhizState('nonce-only-fallback');
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        access_token: 'zhiz-access-token-fallback',
        openid: 'zhiz-openid-fallback',
        nickname: 'Nonce Fallback User',
        avatar_url: 'https://avatar.example/fallback.png',
      }),
    );

    const res = await request(app)
      .get('/api/v1/auth/oauth/zhiz/callback')
      .query({ code: 'nonce-only-code', nonce: 'nonce-only-fallback' })
      .expect(302);

    expect(
      (res.headers.location as string).startsWith(
        'https://3000.zhiz.chat/auth/zhiz/complete?ticket=',
      ),
    ).toBe(true);
  });
});
