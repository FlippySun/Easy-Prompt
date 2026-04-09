/**
 * User Enhanced 集成测试 — 增强 Profile / 成就 / 活跃度热力图
 * 2026-04-08 新增 — P4.07 集成测试
 * 变更类型：新增
 * 设计思路：
 *   验证 P4.07 新增的三个公开端点完整链路
 *   创建交互数据后验证统计数据正确性
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

const testUser = {
  email: `enhanced-test-${Date.now()}@integration.test`,
  username: `enhtest_${Date.now()}`,
  password: 'TestPass123',
  displayName: 'Enhanced Test User',
};

beforeAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
  app = createTestApp();

  // 注册用户
  const uRes = await request(app).post('/api/v1/auth/register').send(testUser);
  accessToken = uRes.body.data.tokens.accessToken;
  userId = uRes.body.data.user.id;

  // 创建一个 published prompt 并交互（建立统计数据）
  const pRes = await request(app)
    .post('/api/v1/prompts')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      title: 'Enhanced Test Prompt',
      content: 'Content for enhanced test',
      category: 'coding',
      status: 'published',
    });
  promptId = pRes.body.data.id;

  // Like + Save（产生活动数据）
  await request(app)
    .post(`/api/v1/prompts/${promptId}/like`)
    .set('Authorization', `Bearer ${accessToken}`);
  await request(app)
    .post(`/api/v1/prompts/${promptId}/save`)
    .set('Authorization', `Bearer ${accessToken}`);
});

afterAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
  await globalTeardown();
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/users/:id/enhanced — 增强版公开资料
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/users/:id/enhanced', () => {
  it('should return enhanced profile with stats', async () => {
    const res = await request(app).get(`/api/v1/users/${userId}/enhanced`).expect(200);

    expect(res.body.success).toBe(true);
    const data = res.body.data;

    // 基础字段
    expect(data.id).toBe(userId);
    expect(data.username).toBe(testUser.username);
    expect(data.displayName).toBe(testUser.displayName);
    expect(data).toHaveProperty('joinedAt');

    // P4.07 增强字段
    expect(data).toHaveProperty('promptCount');
    expect(data.promptCount).toBeGreaterThanOrEqual(1);
    expect(data).toHaveProperty('collectionCount');
    expect(typeof data.collectionCount).toBe('number');
    expect(data).toHaveProperty('achievementCount');
    expect(typeof data.achievementCount).toBe('number');
    expect(data).toHaveProperty('totalLikes');
    expect(typeof data.totalLikes).toBe('number');
    expect(data).toHaveProperty('totalViews');
    expect(typeof data.totalViews).toBe('number');
    expect(data).toHaveProperty('totalCopies');
    expect(typeof data.totalCopies).toBe('number');

    // 不含敏感字段
    expect(data).not.toHaveProperty('email');
    expect(data).not.toHaveProperty('passwordHash');
  });

  it('should return 404 for non-existent user', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    await request(app).get(`/api/v1/users/${fakeId}/enhanced`).expect(404);
  });

  it('should reject invalid UUID', async () => {
    const res = await request(app).get('/api/v1/users/not-a-uuid/enhanced').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/users/:id/achievements — 成就列表
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/users/:id/achievements', () => {
  it('should return achievements array (may be empty)', async () => {
    const res = await request(app).get(`/api/v1/users/${userId}/achievements`).expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);

    // 验证元素结构（如有数据）
    if (res.body.data.length > 0) {
      const item = res.body.data[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('description');
      expect(item).toHaveProperty('icon');
      expect(item).toHaveProperty('color');
      expect(item).toHaveProperty('rarity');
      expect(item).toHaveProperty('unlockedAt');
    }
  });

  it('should reject invalid UUID', async () => {
    const res = await request(app).get('/api/v1/users/bad-uuid/achievements').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/users/:id/activity — 活跃度热力图
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/users/:id/activity', () => {
  it('should return 30+ days of activity data', async () => {
    const res = await request(app).get(`/api/v1/users/${userId}/activity`).expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    // 30 天 + 今天 = 至少 31 天
    expect(res.body.data.length).toBeGreaterThanOrEqual(30);

    // 验证元素结构
    const item = res.body.data[0];
    expect(item).toHaveProperty('date');
    expect(item).toHaveProperty('count');
    expect(typeof item.count).toBe('number');
    // date 格式 YYYY-MM-DD
    expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should have activity for today (we created prompt + interactions)', async () => {
    const res = await request(app).get(`/api/v1/users/${userId}/activity`).expect(200);

    const today = new Date().toISOString().slice(0, 10);
    const todayEntry = res.body.data.find((d: { date: string }) => d.date === today);

    // 今天至少有 1 次活动（创建 Prompt）
    // like 和 save 也应计入
    expect(todayEntry).toBeDefined();
    expect(todayEntry.count).toBeGreaterThanOrEqual(1);
  });

  it('should reject invalid UUID', async () => {
    const res = await request(app).get('/api/v1/users/not-uuid/activity').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});
