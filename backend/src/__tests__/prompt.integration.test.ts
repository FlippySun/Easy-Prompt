/**
 * Prompt 集成测试 — CRUD + 列表/详情/随机/精选/Galaxy + 搜索
 * 2026-04-08 新增 — P3 集成测试
 * 设计思路：使用 supertest 对真实 Express app 发起 HTTP 请求，
 *   验证 Prompt CRUD 完整链路 + 分页/过滤/排序 + 搜索回退
 *   依赖 factories.ts 创建测试数据
 * 影响范围：仅测试环境
 * 潜在风险：无已知风险
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { cleanupTestData, cleanupRedis, createTestApp, globalTeardown } from './helpers/setup';
import type { Express } from 'express';

let app: Express;
let accessToken: string;
let adminToken: string;
let promptId: string;

// 测试用户数据
const testUser = {
  email: `prompt-test-${Date.now()}@integration.test`,
  username: `promptuser_${Date.now()}`,
  password: 'TestPass123',
  displayName: 'Prompt Test User',
};

const adminUser = {
  email: `prompt-admin-${Date.now()}@integration.test`,
  username: `promptadmin_${Date.now()}`,
  password: 'AdminPass123',
  displayName: 'Prompt Admin User',
};

beforeAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
  app = createTestApp();

  // 注册普通用户
  const userRes = await request(app).post('/api/v1/auth/register').send(testUser);
  accessToken = userRes.body.data.tokens.accessToken;

  // 注册管理员（通过 DB 直接提权）
  const adminRes = await request(app).post('/api/v1/auth/register').send(adminUser);
  adminToken = adminRes.body.data.tokens.accessToken;

  // 提权为 admin — 直接通过 Prisma 更新
  const { prisma } = await import('../lib/prisma');
  await prisma.user.update({
    where: { id: adminRes.body.data.user.id },
    data: { role: 'admin' },
  });

  // 重新登录获取含 admin 角色的 token
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: adminUser.email, password: adminUser.password });
  adminToken = loginRes.body.data.tokens.accessToken;
});

afterAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
  await globalTeardown();
});

// ═══════════════════════════════════════════════════════
// POST /api/v1/prompts — 创建
// ═══════════════════════════════════════════════════════

describe('POST /api/v1/prompts', () => {
  it('should create a prompt with valid data', async () => {
    const res = await request(app)
      .post('/api/v1/prompts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Test Prompt Alpha',
        content: 'Write a professional email about project updates.',
        category: 'writing',
        tags: ['email', 'professional'],
        description: 'A writing prompt for emails',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Test Prompt Alpha');
    // createPrompt select: { id, title, status, createdAt }
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.id).toBeTruthy();
    promptId = res.body.data.id;
  });

  it('should reject creation without auth', async () => {
    const res = await request(app)
      .post('/api/v1/prompts')
      .send({ title: 'No Auth', content: 'Content', category: 'general' })
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  it('should reject creation with missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/prompts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ description: 'No title or content' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('should create a second published prompt for list tests', async () => {
    const res = await request(app)
      .post('/api/v1/prompts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Test Prompt Beta',
        content: 'Generate a marketing copy for a SaaS product.',
        category: 'marketing',
        tags: ['saas', 'copywriting'],
        status: 'published',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
  });

  // 创建多个 published prompt 用于分页测试
  it('should create multiple prompts for pagination', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/v1/prompts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: `Pagination Prompt ${i}`,
          content: `Content for pagination test ${i}`,
          category: 'general',
          status: 'published',
        })
        .expect(201);
    }
  });
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/prompts — 列表
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/prompts', () => {
  it('should return paginated list', async () => {
    const res = await request(app).get('/api/v1/prompts?pageSize=2').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(2);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    expect(res.body.meta.totalPages).toBeGreaterThanOrEqual(1);
  });

  it('should filter by category', async () => {
    const res = await request(app).get('/api/v1/prompts?category=marketing').expect(200);

    expect(res.body.success).toBe(true);
    for (const p of res.body.data) {
      expect(p.category).toBe('marketing');
    }
  });

  it('should support sort parameter', async () => {
    const res = await request(app).get('/api/v1/prompts?sort=createdAt:desc').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('should allow admin to query by status', async () => {
    const res = await request(app)
      .get('/api/v1/prompts')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    // admin 可以看到所有状态的 prompt（包括 draft）
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/prompts/:id — 详情
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/prompts/:id', () => {
  it('should return prompt detail', async () => {
    const res = await request(app)
      .get(`/api/v1/prompts/${promptId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(promptId);
    expect(res.body.data.title).toBe('Test Prompt Alpha');
    expect(res.body.data.content).toBeTruthy();
    // 登录用户可看到交互状态
    expect(res.body.data).toHaveProperty('isLiked');
    expect(res.body.data).toHaveProperty('isSaved');
  });

  it('should return 404 for non-existent prompt', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).get(`/api/v1/prompts/${fakeId}`).expect(404);

    expect(res.body.success).toBe(false);
  });

  it('should reject invalid UUID', async () => {
    const res = await request(app).get('/api/v1/prompts/not-a-uuid').expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

// ═══════════════════════════════════════════════════════
// PUT /api/v1/prompts/:id — 更新
// ═══════════════════════════════════════════════════════

describe('PUT /api/v1/prompts/:id', () => {
  it('should update own prompt', async () => {
    const res = await request(app)
      .put(`/api/v1/prompts/${promptId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Updated Prompt Alpha', status: 'published' })
      .expect(200);

    expect(res.body.success).toBe(true);
    // updatePrompt select: { id, title, status, updatedAt }
    expect(res.body.data.title).toBe('Updated Prompt Alpha');
    expect(res.body.data.status).toBe('published');
  });

  it('should reject update without auth', async () => {
    await request(app).put(`/api/v1/prompts/${promptId}`).send({ title: 'Hacked' }).expect(401);
  });
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/prompts/random — 随机推荐
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/prompts/random', () => {
  it('should return random prompts', async () => {
    const res = await request(app).get('/api/v1/prompts/random?count=3').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeLessThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/prompts/featured — 精选
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/prompts/featured', () => {
  it('should return featured prompts', async () => {
    const res = await request(app).get('/api/v1/prompts/featured?limit=5').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
  });
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/prompts/galaxy — Galaxy 数据
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/prompts/galaxy', () => {
  it('should return galaxy data', async () => {
    const res = await request(app).get('/api/v1/prompts/galaxy').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/prompts/search — 搜索
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/prompts/search', () => {
  it('should search prompts by keyword', async () => {
    const res = await request(app).get('/api/v1/prompts/search?keyword=email').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.meta).toBeDefined();
  });

  it('should return empty for non-matching keyword', async () => {
    const res = await request(app)
      .get('/api/v1/prompts/search?keyword=zzzznonexistent9999')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it('should reject search without keyword', async () => {
    const res = await request(app).get('/api/v1/prompts/search').expect(400);

    expect(res.body.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════
// DELETE /api/v1/prompts/:id — 删除
// ═══════════════════════════════════════════════════════

describe('DELETE /api/v1/prompts/:id', () => {
  let deletePromptId: string;

  it('should create a prompt to delete', async () => {
    const res = await request(app)
      .post('/api/v1/prompts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'To Be Deleted',
        content: 'This prompt will be deleted.',
        category: 'general',
      })
      .expect(201);
    deletePromptId = res.body.data.id;
  });

  it('should delete own prompt', async () => {
    const res = await request(app)
      .delete(`/api/v1/prompts/${deletePromptId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('should return 404 after deletion', async () => {
    await request(app).get(`/api/v1/prompts/${deletePromptId}`).expect(404);
  });
});
