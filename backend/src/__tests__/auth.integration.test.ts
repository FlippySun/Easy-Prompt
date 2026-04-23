/**
 * Auth 集成测试 — 注册/登录/刷新/me 完整流程
 * 2026-04-07 新增 — 集成测试
 * 设计思路：使用 supertest 对真实 Express app 发起 HTTP 请求，
 *   验证完整的请求链路（中间件 → 路由 → 服务 → DB）
 * 影响范围：仅测试环境
 * 潜在风险：无已知风险
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { cleanupTestData, cleanupRedis, createTestApp, globalTeardown } from './helpers/setup';
import type { Express } from 'express';

let app: Express;

// 测试用户数据
const testUser = {
  email: `test-${Date.now()}@integration.test`,
  username: `testuser_${Date.now()}`,
  password: 'TestPass123',
  displayName: 'Integration Test User',
};

let accessToken: string;
let refreshToken: string;

beforeAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
  app = createTestApp();
});

afterAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
  await globalTeardown();
});

describe('POST /api/v1/auth/register', () => {
  it('should register a new user and return tokens', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(testUser).expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());
    expect(res.body.data.user.username).toBe(testUser.username);
    expect(res.body.data.user.displayName).toBe(testUser.displayName);
    expect(res.body.data.user.role).toBe('user');
    expect(res.body.data.tokens.accessToken).toBeTruthy();
    expect(res.body.data.tokens.refreshToken).toBeTruthy();
    expect(
      ([] as string[]).concat(res.headers['set-cookie'] ?? []).some((cookie) =>
        cookie.includes('refresh_token='),
      ),
    ).toBe(true);

    accessToken = res.body.data.tokens.accessToken;
    refreshToken = res.body.data.tokens.refreshToken;
  });

  it('should reject duplicate email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...testUser, username: 'different_user' })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_EMAIL_EXISTS');
  });

  it('should reject duplicate username', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...testUser, email: 'other@test.com' })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_USERNAME_EXISTS');
  });

  it('should reject weak password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'weak@test.com', username: 'weakuser', password: '123' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('should reject invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', username: 'validuser', password: 'TestPass123' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('POST /api/v1/auth/login', () => {
  it('should login with correct credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());
    expect(res.body.data.tokens.accessToken).toBeTruthy();
    expect(res.body.data.tokens.refreshToken).toBeTruthy();

    // 更新 token 用于后续测试
    accessToken = res.body.data.tokens.accessToken;
    refreshToken = res.body.data.tokens.refreshToken;
  });

  it('should reject wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: 'WrongPass123' })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_LOGIN_FAILED');
  });

  it('should reject non-existent email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.com', password: 'TestPass123' })
      .expect(401);

    expect(res.body.error.code).toBe('AUTH_LOGIN_FAILED');
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('should refresh tokens with valid refresh token', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken }).expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();

    accessToken = res.body.data.accessToken;
  });

  it('should refresh tokens with shared refresh_token cookie when body token is omitted', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    const refreshCookie = ([] as string[])
      .concat(loginRes.headers['set-cookie'] ?? [])
      .find((cookie) => cookie.startsWith('refresh_token='));

    expect(refreshCookie).toBeTruthy();

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie!)
      .send({})
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
  });

  it('should reject invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'invalid.token.here' })
      .expect(401);

    expect(res.body.error.code).toBe('AUTH_REFRESH_EXPIRED');
  });
});

/**
 * 2026-04-15 修复 — SSO redirect 白名单多端回归测试
 * 变更类型：修复/测试
 * 功能描述：验证 zhiz.chat 全子域名、浏览器扩展、VS Code、IntelliJ 的代表性回调 URI 都能通过白名单，同时未登记域名仍会带 redirectUri 细节被拒绝。
 * 设计思路：
 *   1. 复用前面注册/登录流程拿到的 accessToken，直连真实 `/api/v1/auth/sso/authorize` 路由。
 *   2. 允许样本按客户端类型分组挑选代表 URI，避免测试只绑定某个单独子域名或单一端。
 *   3. 同时覆盖 allow 和 reject 两个方向，避免只放宽白名单却意外放行任意外部地址。
 * 参数与返回值：无；断言接口分别返回 HTTP 200 / 400 与对应 payload。
 * 影响范围：`generateSsoCode()` redirect_uri 白名单校验、多端 SSO 登录成功后的授权码回跳。
 * 潜在风险：无已知风险。
 */
describe('POST /api/v1/auth/sso/authorize', () => {
  it('should generate an SSO code for representative allowed redirect URIs across all supported clients', async () => {
    const allowedRedirectUris = [
      'https://zhiz.chat/',
      'https://5174.zhiz.chat/',
      'https://prompt.zhiz.chat/callback',
      'https://alpha.beta.zhiz.chat/sso/complete',
      'chrome-extension://abcdefghijklmnopabcdefghijklmnop/auth-callback/index.html',
      'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/callback',
      'https://01234567-89ab-cdef-0123-456789abcdef.extensions.allizom.org/callback',
      'safari-web-extension://com.flippysun.easy-prompt/auth-callback/index.html',
      'moz-extension://12345678-1234-1234-1234-123456789abc/auth-callback/index.html',
      'vscode://flippysun.easy-prompt-ai/auth-callback',
      'http://localhost:45678/callback',
      'http://127.0.0.1:45678/callback',
    ];

    for (const redirectUri of allowedRedirectUris) {
      const res = await request(app)
        .post('/api/v1/auth/sso/authorize')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ redirectUri })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    }
  });

  it('should reject an unregistered SSO redirect URI and echo redirectUri details for diagnostics', async () => {
    const res = await request(app)
      .post('/api/v1/auth/sso/authorize')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ redirectUri: 'https://evil.example.com/' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details).toMatchObject({
      redirectUri: 'https://evil.example.com/',
    });
  });
});

/**
 * 2026-04-15 修复 — SSO token exchange CORS 回归测试
 * 变更类型：修复/测试
 * 功能描述：验证 `/api/v1/auth/sso/token` 的预检请求会为本地 Web origin 与浏览器扩展 origin 返回允许头，防止 redirect allowlist 已放行但浏览器换 token 仍被 CORS 拦截。
 * 设计思路：
 *   1. 直接对真实 Express app 发送 `OPTIONS` 预检，覆盖浏览器最先失败的链路。
 *   2. 选用 `http://localhost:5174` 与 `chrome-extension://...` 代表本地 Web / Browser 两类客户端，避免只修单一来源。
 * 参数与返回值：无；断言预检返回 204 与 `access-control-allow-origin/credentials` 头。
 * 影响范围：全局 CORS、`/api/v1/auth/*` 跨域访问、Web 与 Browser SSO 登录成功态落地。
 * 潜在风险：若未来某类客户端改为不同 origin 方案，需要同步更新样本值。
 */
describe('OPTIONS /api/v1/auth/sso/token', () => {
  it('should allow trusted SSO client origins during token exchange preflight', async () => {
    const allowedOrigins = [
      'http://localhost:5174',
      'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
    ];

    for (const origin of allowedOrigins) {
      const res = await request(app)
        .options('/api/v1/auth/sso/token')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);

      expect(res.headers['access-control-allow-origin']).toBe(origin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    }
  });
});

describe('GET /api/v1/auth/me', () => {
  it('should return current user profile with valid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(testUser.email.toLowerCase());
    expect(res.body.data.username).toBe(testUser.username);
    expect(res.body.data.role).toBe('user');
    expect(res.body.data.createdAt).toBeTruthy();
  });

  it('should reject request without token', async () => {
    const res = await request(app).get('/api/v1/auth/me').expect(401);

    expect(res.body.error.code).toBe('AUTH_UNAUTHORIZED');
  });

  it('should reject request with invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid.jwt.token')
      .expect(401);

    expect(res.body.error.code).toBe('AUTH_TOKEN_INVALID');
  });
});
