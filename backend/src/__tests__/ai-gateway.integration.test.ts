/**
 * AI Gateway 集成测试 — enhance 请求流程 + provider 管理
 * 2026-04-07 新增 — 集成测试
 * 设计思路：测试 provider CRUD → 设置激活 provider → enhance 请求
 *   由于不会真正调用外部 AI API（没有真实 provider），
 *   本测试侧重于：provider 服务正确性、请求验证、错误处理
 * 影响范围：仅测试环境
 * 潜在风险：无已知风险
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { cleanupTestData, cleanupRedis, createTestApp, globalTeardown } from './helpers/setup';
import {
  createProvider,
  listProviders,
  getActiveProvider,
  deleteProvider,
} from '../services/provider.service';
import type { Express } from 'express';

let app: Express;
let adminToken: string;
let providerId: string;

beforeAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
  app = createTestApp();

  // 注册一个管理员用户用于 provider 管理测试
  const adminEmail = `admin-${Date.now()}@integration.test`;
  const registerRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email: adminEmail,
      username: `admin_${Date.now()}`,
      password: 'AdminPass123',
      displayName: 'Admin User',
    });

  adminToken = registerRes.body.data.tokens.accessToken;

  // 将该用户提升为 admin（直接操作 DB）
  const { prisma } = await import('../lib/prisma');
  await prisma.user.update({
    where: { email: adminEmail.toLowerCase() },
    data: { role: 'admin' },
  });

  // 重新登录获取带 admin role 的 token
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: adminEmail, password: 'AdminPass123' });
  adminToken = loginRes.body.data.tokens.accessToken;
}, 30_000);

afterAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
  await globalTeardown();
});

describe('provider service', () => {
  it('should create a provider with encrypted key', async () => {
    const provider = await createProvider({
      name: 'Test OpenAI',
      slug: 'test-openai',
      apiMode: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test-key-12345',
      defaultModel: 'gpt-4o',
      models: ['gpt-4o', 'gpt-4o-mini'],
      isActive: true,
      priority: 10,
    });

    expect(provider.id).toBeTruthy();
    expect(provider.slug).toBe('test-openai');
    expect(provider.apiKey).toBe('***encrypted***');
    expect(provider.isActive).toBe(true);
    providerId = provider.id;
  });

  it('should list providers with masked keys', async () => {
    const providers = await listProviders();
    expect(providers.length).toBeGreaterThanOrEqual(1);

    const testProvider = providers.find((p) => p.slug === 'test-openai');
    expect(testProvider).toBeTruthy();
    expect(testProvider!.apiKey).toBe('***encrypted***');
  });

  it('should get active provider with decrypted key', async () => {
    const active = await getActiveProvider();
    expect(active.slug).toBe('test-openai');
    expect(active.apiKey).toBe('sk-test-key-12345');
  });

  it('should delete a provider', async () => {
    // 创建一个额外的 provider 用于删除测试
    const extra = await createProvider({
      name: 'Delete Me',
      slug: 'delete-me',
      apiMode: 'claude',
      baseUrl: 'https://api.anthropic.com/v1',
      apiKey: 'sk-ant-test',
      defaultModel: 'claude-sonnet-4-20250514',
    });

    await deleteProvider(extra.id);

    const providers = await listProviders();
    expect(providers.find((p) => p.slug === 'delete-me')).toBeUndefined();
  });
});

describe('provider admin routes', () => {
  it('should list providers via API', async () => {
    const res = await request(app)
      .get('/api/v1/admin/providers')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should reject non-admin access', async () => {
    // 创建一个普通用户
    const userRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `user-${Date.now()}@test.com`,
        username: `normaluser_${Date.now()}`,
        password: 'TestPass123',
      });

    const userToken = userRes.body.data.tokens.accessToken;

    const res = await request(app)
      .get('/api/v1/admin/providers')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);

    expect(res.body.error.code).toBe('PERMISSION_ADMIN_REQUIRED');
  });

  it('should reject unauthenticated access', async () => {
    await request(app).get('/api/v1/admin/providers').expect(401);
  });
});

describe('POST /api/v1/ai/enhance', () => {
  it('should validate input (missing input field)', async () => {
    const res = await request(app).post('/api/v1/ai/enhance').send({}).expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('should validate input (too short)', async () => {
    const res = await request(app).post('/api/v1/ai/enhance').send({ input: '' }).expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('should attempt enhance with active provider (will fail on actual API call)', async () => {
    // 这个测试验证请求能通过验证并到达 gateway 服务
    // 由于 test provider 的 API key 是假的，实际 AI 调用会失败
    const res = await request(app)
      .post('/api/v1/ai/enhance')
      .send({ input: 'Write a professional email to my boss about project update' })
      .expect(502);

    // 应该返回 AI_PROVIDER_ERROR（因为假 API key，OpenAI 返回 401）
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AI_PROVIDER_ERROR');
  });
});

describe('GET /api/v1/meta', () => {
  it('should return categories (may be empty)', async () => {
    const res = await request(app).get('/api/v1/meta/categories').expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should return models (may be empty)', async () => {
    const res = await request(app).get('/api/v1/meta/models').expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
