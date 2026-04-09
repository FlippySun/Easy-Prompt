/**
 * Collection 集成测试 — CRUD + Prompt 关联 + 收藏 toggle
 * 2026-04-08 新增 — P3 集成测试
 * 设计思路：使用 supertest 验证 Collection 端点完整链路
 *   CRUD 和 Prompt 关联为 admin only，收藏为登录用户
 * 影响范围：仅测试环境
 * 潜在风险：无已知风险
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { cleanupTestData, cleanupRedis, createTestApp, globalTeardown } from './helpers/setup';
import type { Express } from 'express';

let app: Express;
let userToken: string;
let adminToken: string;
let collectionId: string;
let promptId1: string;
let promptId2: string;

const normalUser = {
  email: `col-user-${Date.now()}@integration.test`,
  username: `coluser_${Date.now()}`,
  password: 'TestPass123',
  displayName: 'Collection Normal User',
};

const adminUser = {
  email: `col-admin-${Date.now()}@integration.test`,
  username: `coladmin_${Date.now()}`,
  password: 'AdminPass123',
  displayName: 'Collection Admin User',
};

beforeAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
  app = createTestApp();

  // 注册普通用户
  const uRes = await request(app).post('/api/v1/auth/register').send(normalUser);
  userToken = uRes.body.data.tokens.accessToken;

  // 注册管理员并提权
  const aRes = await request(app).post('/api/v1/auth/register').send(adminUser);
  const adminId = aRes.body.data.user.id;

  const { prisma } = await import('../lib/prisma');
  await prisma.user.update({ where: { id: adminId }, data: { role: 'admin' } });

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: adminUser.email, password: adminUser.password });
  adminToken = loginRes.body.data.tokens.accessToken;

  // 创建两个 prompt 用于关联测试
  const p1 = await request(app)
    .post('/api/v1/prompts')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Col Prompt 1', content: 'Content 1', category: 'general', status: 'published' });
  promptId1 = p1.body.data.id;

  const p2 = await request(app)
    .post('/api/v1/prompts')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Col Prompt 2', content: 'Content 2', category: 'general', status: 'published' });
  promptId2 = p2.body.data.id;
});

afterAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
  await globalTeardown();
});

// ═══════════════════════════════════════════════════════
// POST /api/v1/collections — 创建（admin only）
// ═══════════════════════════════════════════════════════

describe('POST /api/v1/collections', () => {
  it('should create a collection (admin)', async () => {
    const res = await request(app)
      .post('/api/v1/collections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Test Collection Alpha',
        description: 'A test collection',
        tags: ['test', 'alpha'],
        difficulty: 'beginner',
        estimatedTime: '10 min',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Test Collection Alpha');
    collectionId = res.body.data.id;
  });

  it('should reject creation by normal user', async () => {
    await request(app)
      .post('/api/v1/collections')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Unauthorized Collection', description: 'Nope', tags: [] })
      .expect(403);
  });

  it('should reject creation without auth', async () => {
    await request(app)
      .post('/api/v1/collections')
      .send({ title: 'No Auth', description: 'Nope', tags: [] })
      .expect(401);
  });
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/collections — 列表
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/collections', () => {
  it('should return paginated list', async () => {
    const res = await request(app).get('/api/v1/collections').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.meta).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/collections/:id — 详情
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/collections/:id', () => {
  it('should return collection detail', async () => {
    const res = await request(app)
      .get(`/api/v1/collections/${collectionId}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(collectionId);
    expect(res.body.data.title).toBe('Test Collection Alpha');
  });

  it('should return 404 for non-existent collection', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    await request(app).get(`/api/v1/collections/${fakeId}`).expect(404);
  });

  it('should reject invalid UUID', async () => {
    const res = await request(app).get('/api/v1/collections/bad-uuid').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

// ═══════════════════════════════════════════════════════
// PUT /api/v1/collections/:id — 更新（admin only）
// ═══════════════════════════════════════════════════════

describe('PUT /api/v1/collections/:id', () => {
  it('should update collection (admin)', async () => {
    const res = await request(app)
      .put(`/api/v1/collections/${collectionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Updated Collection Alpha', difficulty: 'intermediate' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Updated Collection Alpha');
  });

  it('should reject update by normal user', async () => {
    await request(app)
      .put(`/api/v1/collections/${collectionId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Hacked' })
      .expect(403);
  });
});

// ═══════════════════════════════════════════════════════
// POST /api/v1/collections/:id/prompts — 添加 Prompt
// ═══════════════════════════════════════════════════════

describe('POST /api/v1/collections/:id/prompts', () => {
  it('should add prompts to collection (admin)', async () => {
    const res = await request(app)
      .post(`/api/v1/collections/${collectionId}/prompts`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ promptIds: [promptId1, promptId2] })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('should show associated prompts in detail', async () => {
    const res = await request(app)
      .get(`/api/v1/collections/${collectionId}`)
      .expect(200);

    expect(res.body.data.prompts).toBeInstanceOf(Array);
    expect(res.body.data.prompts.length).toBe(2);
  });

  it('should reject by normal user', async () => {
    await request(app)
      .post(`/api/v1/collections/${collectionId}/prompts`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ promptIds: [promptId1] })
      .expect(403);
  });
});

// ═══════════════════════════════════════════════════════
// DELETE /api/v1/collections/:id/prompts — 移除 Prompt
// ═══════════════════════════════════════════════════════

describe('DELETE /api/v1/collections/:id/prompts', () => {
  it('should remove a prompt from collection (admin)', async () => {
    const res = await request(app)
      .delete(`/api/v1/collections/${collectionId}/prompts`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ promptIds: [promptId2] })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('should reflect removal in detail', async () => {
    const res = await request(app)
      .get(`/api/v1/collections/${collectionId}`)
      .expect(200);

    expect(res.body.data.prompts.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════
// POST /api/v1/collections/:id/save — Toggle 收藏
// ═══════════════════════════════════════════════════════

describe('POST /api/v1/collections/:id/save', () => {
  it('should save collection (first toggle → saved)', async () => {
    const res = await request(app)
      .post(`/api/v1/collections/${collectionId}/save`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.saved).toBe(true);
    expect(res.body.data.savedCount).toBe(1);
  });

  it('should unsave collection (second toggle → unsaved)', async () => {
    const res = await request(app)
      .post(`/api/v1/collections/${collectionId}/save`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.saved).toBe(false);
    expect(res.body.data.savedCount).toBe(0);
  });

  it('should reject save without auth', async () => {
    await request(app)
      .post(`/api/v1/collections/${collectionId}/save`)
      .expect(401);
  });
});

// ═══════════════════════════════════════════════════════
// DELETE /api/v1/collections/:id — 删除（admin only）
// ═══════════════════════════════════════════════════════

describe('DELETE /api/v1/collections/:id', () => {
  let deleteCollectionId: string;

  it('should create a collection to delete', async () => {
    const res = await request(app)
      .post('/api/v1/collections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'To Be Deleted', description: 'Will be deleted', tags: [] })
      .expect(201);
    deleteCollectionId = res.body.data.id;
  });

  it('should delete collection (admin)', async () => {
    const res = await request(app)
      .delete(`/api/v1/collections/${deleteCollectionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('should return 404 after deletion', async () => {
    await request(app).get(`/api/v1/collections/${deleteCollectionId}`).expect(404);
  });
});
