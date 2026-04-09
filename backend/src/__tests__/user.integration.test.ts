/**
 * User 集成测试 — 公开资料、资料更新、我的列表（Prompt/收藏/点赞/Collection）
 * 2026-04-08 新增 — P3 集成测试
 * 设计思路：使用 supertest 验证 User 端点完整链路
 *   先创建交互数据（like/save），再验证 /me/* 列表正确性
 * 影响范围：仅测试环境
 * 潜在风险：无已知风险
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { cleanupTestData, cleanupRedis, createTestApp, globalTeardown } from './helpers/setup';
import type { Express } from 'express';

let app: Express;
let accessToken: string;
let userId: string;
let promptId: string;
let collectionId: string;

const testUser = {
  email: `user-test-${Date.now()}@integration.test`,
  username: `usertest_${Date.now()}`,
  password: 'TestPass123',
  displayName: 'User Test Person',
};

const adminUser = {
  email: `user-admin-${Date.now()}@integration.test`,
  username: `useradmin_${Date.now()}`,
  password: 'AdminPass123',
  displayName: 'User Admin Person',
};

beforeAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
  app = createTestApp();

  // 注册普通用户
  const uRes = await request(app).post('/api/v1/auth/register').send(testUser);
  accessToken = uRes.body.data.tokens.accessToken;
  userId = uRes.body.data.user.id;

  // 注册管理员并提权（用于创建 collection）
  const aRes = await request(app).post('/api/v1/auth/register').send(adminUser);
  const adminId = aRes.body.data.user.id;
  const { prisma } = await import('../lib/prisma');
  await prisma.user.update({ where: { id: adminId }, data: { role: 'admin' } });
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: adminUser.email, password: adminUser.password });
  const adminToken = loginRes.body.data.tokens.accessToken;

  // 创建一个 published prompt（以普通用户身份）
  const pRes = await request(app)
    .post('/api/v1/prompts')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      title: 'User Test Prompt',
      content: 'Content for user test',
      category: 'general',
      status: 'published',
    });
  promptId = pRes.body.data.id;

  // Like + Save 该 prompt（建立交互数据）
  await request(app)
    .post(`/api/v1/prompts/${promptId}/like`)
    .set('Authorization', `Bearer ${accessToken}`);
  await request(app)
    .post(`/api/v1/prompts/${promptId}/save`)
    .set('Authorization', `Bearer ${accessToken}`);

  // 创建 collection 并收藏
  const cRes = await request(app)
    .post('/api/v1/collections')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'User Test Collection', description: 'For user tests', tags: ['test'] });
  collectionId = cRes.body.data.id;

  await request(app)
    .post(`/api/v1/collections/${collectionId}/save`)
    .set('Authorization', `Bearer ${accessToken}`);
});

afterAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
  await globalTeardown();
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/users/:id — 公开资料
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/users/:id', () => {
  it('should return public profile', async () => {
    const res = await request(app).get(`/api/v1/users/${userId}`).expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(userId);
    expect(res.body.data.username).toBe(testUser.username);
    expect(res.body.data.displayName).toBe(testUser.displayName);
    // 公开资料不含 email
    expect(res.body.data).not.toHaveProperty('email');
    expect(res.body.data).toHaveProperty('promptCount');
    expect(res.body.data).toHaveProperty('joinedAt');
  });

  it('should return 404 for non-existent user', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    await request(app).get(`/api/v1/users/${fakeId}`).expect(404);
  });

  it('should reject invalid UUID', async () => {
    const res = await request(app).get('/api/v1/users/bad-uuid').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

// ═══════════════════════════════════════════════════════
// PUT /api/v1/users/me/profile — 更新资料
// ═══════════════════════════════════════════════════════

describe('PUT /api/v1/users/me/profile', () => {
  it('should update display name and bio', async () => {
    const res = await request(app)
      .put('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ displayName: 'Updated Name', bio: 'Updated bio text' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.displayName).toBe('Updated Name');
    expect(res.body.data.bio).toBe('Updated bio text');
  });

  it('should reject invalid avatar URL', async () => {
    const res = await request(app)
      .put('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ avatarUrl: 'not-a-url' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('should accept valid avatar URL', async () => {
    const res = await request(app)
      .put('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ avatarUrl: 'https://example.com/avatar.png' })
      .expect(200);

    expect(res.body.data.avatarUrl).toBe('https://example.com/avatar.png');
  });

  it('should reject without auth', async () => {
    await request(app)
      .put('/api/v1/users/me/profile')
      .send({ displayName: 'Hacked' })
      .expect(401);
  });
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/users/me/prompts — 我的 Prompt
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/users/me/prompts', () => {
  it('should return my prompts with pagination', async () => {
    const res = await request(app)
      .get('/api/v1/users/me/prompts')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
  });

  it('should reject without auth', async () => {
    await request(app).get('/api/v1/users/me/prompts').expect(401);
  });
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/users/me/saved — 我的收藏 Prompt
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/users/me/saved', () => {
  it('should return saved prompts', async () => {
    const res = await request(app)
      .get('/api/v1/users/me/saved')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should reject without auth', async () => {
    await request(app).get('/api/v1/users/me/saved').expect(401);
  });
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/users/me/liked — 我的点赞 Prompt
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/users/me/liked', () => {
  it('should return liked prompts', async () => {
    const res = await request(app)
      .get('/api/v1/users/me/liked')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should reject without auth', async () => {
    await request(app).get('/api/v1/users/me/liked').expect(401);
  });
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/users/me/collections — 我的收藏 Collection
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/users/me/collections', () => {
  it('should return saved collections', async () => {
    const res = await request(app)
      .get('/api/v1/users/me/collections')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should reject without auth', async () => {
    await request(app).get('/api/v1/users/me/collections').expect(401);
  });
});
