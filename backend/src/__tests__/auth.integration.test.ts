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

  it('should reject invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'invalid.token.here' })
      .expect(401);

    expect(res.body.error.code).toBe('AUTH_REFRESH_EXPIRED');
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
