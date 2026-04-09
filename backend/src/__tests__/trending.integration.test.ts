/**
 * Trending 集成测试 — 热门 Prompt / 热门分类 / 每日精选
 * 2026-04-08 新增 — P4 Phase 4 集成测试
 * 变更类型：新增
 * 设计思路：
 *   验证 trending 端点完整链路：创建若干 published Prompt → 查询 trending 端点
 *   trending 算法依赖 likesCount / viewsCount / createdAt 等字段
 *   测试覆盖：参数校验、正常返回、空结果
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
  email: `trending-test-${Date.now()}@integration.test`,
  username: `trendtest_${Date.now()}`,
  password: 'TestPass123',
  displayName: 'Trending Test User',
};

beforeAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
  app = createTestApp();

  // 注册用户并创建若干 published Prompt（用于 trending 测试）
  const uRes = await request(app).post('/api/v1/auth/register').send(testUser);
  accessToken = uRes.body.data.tokens.accessToken;

  // 创建 5 个不同分类的 published Prompt
  const categories = ['coding', 'writing', 'marketing', 'design', 'general'];
  for (let i = 0; i < categories.length; i++) {
    await request(app)
      .post('/api/v1/prompts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: `Trending Test Prompt ${i}`,
        content: `Content for trending test prompt ${i}`,
        category: categories[i],
        status: 'published',
      });
  }
});

afterAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
  await globalTeardown();
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/trending/prompts — 热门 Prompt 列表
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/trending/prompts', () => {
  it('should return trending prompts (default day period)', async () => {
    const res = await request(app).get('/api/v1/trending/prompts').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it('should accept period=week and limit=3', async () => {
    const res = await request(app).get('/api/v1/trending/prompts?period=week&limit=3').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeLessThanOrEqual(3);
  });

  it('should accept period=month', async () => {
    const res = await request(app).get('/api/v1/trending/prompts?period=month').expect(200);
    expect(res.body.success).toBe(true);
  });

  it('should reject invalid period', async () => {
    const res = await request(app).get('/api/v1/trending/prompts?period=century').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('should reject limit > 50', async () => {
    const res = await request(app).get('/api/v1/trending/prompts?limit=100').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('should include Cache-Control header', async () => {
    const res = await request(app).get('/api/v1/trending/prompts').expect(200);
    expect(res.headers['cache-control']).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/trending/categories — 热门分类
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/trending/categories', () => {
  it('should return trending categories', async () => {
    const res = await request(app).get('/api/v1/trending/categories').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it('should accept limit parameter', async () => {
    const res = await request(app).get('/api/v1/trending/categories?limit=3').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════
// GET /api/v1/trending/daily — 每日精选
// ═══════════════════════════════════════════════════════

describe('GET /api/v1/trending/daily', () => {
  it('should return daily picks', async () => {
    const res = await request(app).get('/api/v1/trending/daily').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it('should accept limit=2', async () => {
    const res = await request(app).get('/api/v1/trending/daily?limit=2').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
  });
});
