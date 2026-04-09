/**
 * Achievement 集成测试 — 列表、用户解锁状态、条件检测
 * 2026-04-08 新增 — P3 集成测试
 * 设计思路：使用 supertest 验证 Achievement 端点完整链路
 *   先通过 Prisma 直接创建成就定义，再验证列表/检测/解锁
 * 影响范围：仅测试环境
 * 潜在风险：无已知风险
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { cleanupTestData, cleanupRedis, createTestApp, globalTeardown } from './helpers/setup';
import type { Express } from 'express';

let app: Express;
let accessToken: string;

const testUser = {
  email: `ach-test-${Date.now()}@integration.test`,
  username: `achuser_${Date.now()}`,
  password: 'TestPass123',
  displayName: 'Achievement Test User',
};

beforeAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
  app = createTestApp();

  // 注册用户
  const userRes = await request(app).post('/api/v1/auth/register').send(testUser);
  accessToken = userRes.body.data.tokens.accessToken;

  // 通过 Prisma 创建测试成就定义
  const { prisma } = await import('../lib/prisma');
  await prisma.achievement.createMany({
    data: [
      {
        id: 'test_first_prompt',
        title: 'First Prompt',
        description: 'Create your first prompt',
        icon: '✍️',
        color: '#10b981',
        rarity: 'common',
        category: 'creator',
        conditionType: 'prompts_created',
        conditionValue: 1,
      },
      {
        id: 'test_prolific_writer',
        title: 'Prolific Writer',
        description: 'Create 10 prompts',
        icon: '📝',
        color: '#6366f1',
        rarity: 'rare',
        category: 'creator',
        conditionType: 'prompts_created',
        conditionValue: 10,
      },
      {
        id: 'test_first_like',
        title: 'First Like',
        description: 'Like your first prompt',
        icon: '❤️',
        color: '#ef4444',
        rarity: 'common',
        category: 'social',
        conditionType: 'prompts_liked',
        conditionValue: 1,
      },
    ],
    skipDuplicates: true,
  });
});

afterAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
  await globalTeardown();
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/achievements — 成就列表
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/achievements', () => {
  it('should return all achievements (no auth)', async () => {
    const res = await request(app).get('/api/v1/achievements').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it('should include unlock status for logged-in user', async () => {
    const res = await request(app)
      .get('/api/v1/achievements')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    // 所有成就应有 unlocked 字段
    for (const ach of res.body.data) {
      expect(ach).toHaveProperty('unlocked');
      expect(ach).toHaveProperty('achievement');
      expect(ach.achievement).toHaveProperty('id');
      expect(ach.achievement).toHaveProperty('title');
    }
  });
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/achievements/me — 用户已解锁成就
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/achievements/me', () => {
  it('should return empty for new user', async () => {
    const res = await request(app)
      .get('/api/v1/achievements/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(0);
  });

  it('should reject without auth', async () => {
    await request(app).get('/api/v1/achievements/me').expect(401);
  });
});

// ═══════════════════════════════════════════════════════
// POST /api/v1/achievements/check — 条件检测与解锁
// ═══════════════════════════════════════════════════════

describe('POST /api/v1/achievements/check', () => {
  it('should return empty newlyUnlocked for user with no qualifying activity', async () => {
    const res = await request(app)
      .post('/api/v1/achievements/check')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.newlyUnlocked).toBeInstanceOf(Array);
  });

  it('should unlock achievement after qualifying activity', async () => {
    // 创建一个 prompt 使 prompts_created >= 1
    await request(app)
      .post('/api/v1/prompts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Achievement Trigger Prompt',
        content: 'This should trigger first_prompt achievement',
        category: 'general',
        status: 'published',
      })
      .expect(201);

    // 检测成就
    const res = await request(app)
      .post('/api/v1/achievements/check')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.newlyUnlocked).toBeInstanceOf(Array);
    // 应该解锁 test_first_prompt
    expect(res.body.data.newlyUnlocked).toContain('test_first_prompt');
    // 不应解锁 test_prolific_writer（需要 10 个）
    expect(res.body.data.newlyUnlocked).not.toContain('test_prolific_writer');
  });

  it('should be idempotent (second check should not re-unlock)', async () => {
    const res = await request(app)
      .post('/api/v1/achievements/check')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    // 已解锁的不应再出现在 newlyUnlocked
    expect(res.body.data.newlyUnlocked).not.toContain('test_first_prompt');
  });

  it('should show unlocked achievements in /me', async () => {
    const res = await request(app)
      .get('/api/v1/achievements/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    // /me 返回 UserAchievementStatus[]，含 nested achievement 对象
    const ids = res.body.data.map((a: { achievement: { id: string } }) => a.achievement.id);
    expect(ids).toContain('test_first_prompt');
  });

  it('should reject check without auth', async () => {
    await request(app).post('/api/v1/achievements/check').expect(401);
  });
});
