/**
 * Admin Prompt Review 集成测试 — 待审核列表 / 审批 / 拒绝 / 批量审批
 * 2026-04-08 新增 — P4 Phase 4 集成测试
 * 变更类型：新增
 * 设计思路：
 *   验证 admin prompt review 端点完整链路
 *   需要 admin 权限（requireAdmin middleware）
 *   测试覆盖：权限校验、CRUD 操作、状态转换、批量操作
 * 影响范围：仅测试环境
 * 潜在风险：无已知风险
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { cleanupTestData, cleanupRedis, createTestApp, globalTeardown } from './helpers/setup';
import type { Express } from 'express';

let app: Express;
let adminToken: string;
let userToken: string;
let pendingPromptId: string;
let pendingPromptId2: string;
let pendingPromptId3: string;

const adminUser = {
  email: `admin-prompt-${Date.now()}@integration.test`,
  username: `adminprompt_${Date.now()}`,
  password: 'AdminPass123',
  displayName: 'Admin Prompt Tester',
};

const normalUser = {
  email: `normal-prompt-${Date.now()}@integration.test`,
  username: `normalprompt_${Date.now()}`,
  password: 'UserPass123',
  displayName: 'Normal User',
};

beforeAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
  app = createTestApp();

  // 注册管理员
  const aRes = await request(app).post('/api/v1/auth/register').send(adminUser);
  const adminId = aRes.body.data.user.id;
  const { prisma } = await import('../lib/prisma');
  await prisma.user.update({ where: { id: adminId }, data: { role: 'admin' } });

  const aLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: adminUser.email, password: adminUser.password });
  adminToken = aLogin.body.data.tokens.accessToken;

  // 注册普通用户
  const uRes = await request(app).post('/api/v1/auth/register').send(normalUser);
  userToken = uRes.body.data.tokens.accessToken;

  // 普通用户创建 3 个 pending Prompt
  const p1 = await request(app)
    .post('/api/v1/prompts')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ title: 'Pending Prompt 1', content: 'Content 1', category: 'coding', status: 'pending' });
  pendingPromptId = p1.body.data.id;

  const p2 = await request(app)
    .post('/api/v1/prompts')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ title: 'Pending Prompt 2', content: 'Content 2', category: 'writing', status: 'pending' });
  pendingPromptId2 = p2.body.data.id;

  const p3 = await request(app)
    .post('/api/v1/prompts')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ title: 'Pending Prompt 3', content: 'Content 3', category: 'design', status: 'pending' });
  pendingPromptId3 = p3.body.data.id;
});

afterAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
  await globalTeardown();
});

// ═══════════════════════════════════════════════════════
// 权限校验
// ═══════════════════════════════════════════════════════

describe('Admin prompt routes — permission checks', () => {
  it('should reject unauthenticated access', async () => {
    await request(app).get('/api/v1/admin/prompts/pending').expect(401);
  });

  it('should reject non-admin access', async () => {
    await request(app)
      .get('/api/v1/admin/prompts/pending')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/admin/prompts/pending — 待审核列表
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/admin/prompts/pending', () => {
  it('should return pending prompts with pagination', async () => {
    const res = await request(app)
      .get('/api/v1/admin/prompts/pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.total).toBeGreaterThanOrEqual(3);
  });

  it('should support pagination parameters', async () => {
    const res = await request(app)
      .get('/api/v1/admin/prompts/pending?page=1&pageSize=2')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════
// POST /api/v1/admin/prompts/:id/approve — 单个审批
// ═══════════════════════════════════════════════════════

describe('POST /api/v1/admin/prompts/:id/approve', () => {
  it('should approve a pending prompt', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/prompts/${pendingPromptId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('published');
  });

  it('should reject approving an already-approved prompt', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/prompts/${pendingPromptId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('should reject approving non-existent prompt', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    await request(app)
      .post(`/api/v1/admin/prompts/${fakeId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});

// ═══════════════════════════════════════════════════════
// POST /api/v1/admin/prompts/:id/reject — 拒绝
// ═══════════════════════════════════════════════════════

describe('POST /api/v1/admin/prompts/:id/reject', () => {
  it('should reject a pending prompt with reason', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/prompts/${pendingPromptId2}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Low quality content' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('rejected');
  });

  it('should require reason for rejection', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/prompts/${pendingPromptId3}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

// ═══════════════════════════════════════════════════════
// POST /api/v1/admin/prompts/bulk-approve — 批量审批
// ═══════════════════════════════════════════════════════

describe('POST /api/v1/admin/prompts/bulk-approve', () => {
  it('should bulk approve remaining pending prompts', async () => {
    const res = await request(app)
      .post('/api/v1/admin/prompts/bulk-approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ids: [pendingPromptId3] })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.approved).toBeGreaterThanOrEqual(1);
  });

  it('should reject empty ids array', async () => {
    const res = await request(app)
      .post('/api/v1/admin/prompts/bulk-approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ids: [] })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('should reject non-admin bulk approve', async () => {
    await request(app)
      .post('/api/v1/admin/prompts/bulk-approve')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ids: [pendingPromptId3] })
      .expect(403);
  });
});
