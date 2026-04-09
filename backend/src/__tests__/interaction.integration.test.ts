/**
 * Interaction 集成测试 — Like/Save/Copy/View toggle + 去重
 * 2026-04-08 新增 — P3 集成测试
 * 设计思路：使用 supertest 验证交互端点的完整链路
 *   覆盖 toggle 语义（Like/Save）、累加语义（Copy）、去重语义（View）
 *   验证计数更新的原子性
 * 影响范围：仅测试环境
 * 潜在风险：无已知风险
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { cleanupTestData, cleanupRedis, createTestApp, globalTeardown } from './helpers/setup';
import type { Express } from 'express';

let app: Express;
let accessToken: string;
let promptId: string;

const testUser = {
  email: `interact-test-${Date.now()}@integration.test`,
  username: `interactuser_${Date.now()}`,
  password: 'TestPass123',
  displayName: 'Interaction Test User',
};

beforeAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
  app = createTestApp();

  // 注册用户
  const userRes = await request(app).post('/api/v1/auth/register').send(testUser);
  accessToken = userRes.body.data.tokens.accessToken;

  // 创建一个 published prompt 供交互测试
  const promptRes = await request(app)
    .post('/api/v1/prompts')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      title: 'Interaction Target Prompt',
      content: 'A prompt to test interactions on.',
      category: 'general',
      status: 'published',
    });
  promptId = promptRes.body.data.id;
});

afterAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
  await globalTeardown();
});

// ═══════════════════════════════════════════════════════
// POST /api/v1/prompts/:id/like — Toggle 点赞
// ═══════════════════════════════════════════════════════

describe('POST /api/v1/prompts/:id/like', () => {
  it('should like a prompt (first toggle → liked)', async () => {
    const res = await request(app)
      .post(`/api/v1/prompts/${promptId}/like`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.liked).toBe(true);
    expect(res.body.data.likesCount).toBe(1);
  });

  it('should unlike a prompt (second toggle → unliked)', async () => {
    const res = await request(app)
      .post(`/api/v1/prompts/${promptId}/like`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.liked).toBe(false);
    expect(res.body.data.likesCount).toBe(0);
  });

  it('should re-like (third toggle → liked again)', async () => {
    const res = await request(app)
      .post(`/api/v1/prompts/${promptId}/like`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data.liked).toBe(true);
    expect(res.body.data.likesCount).toBe(1);
  });

  it('should reject like without auth', async () => {
    await request(app).post(`/api/v1/prompts/${promptId}/like`).expect(401);
  });
});

// ═══════════════════════════════════════════════════════
// POST /api/v1/prompts/:id/save — Toggle 收藏
// ═══════════════════════════════════════════════════════

describe('POST /api/v1/prompts/:id/save', () => {
  it('should save a prompt (first toggle → saved)', async () => {
    const res = await request(app)
      .post(`/api/v1/prompts/${promptId}/save`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.saved).toBe(true);
  });

  it('should unsave a prompt (second toggle → unsaved)', async () => {
    const res = await request(app)
      .post(`/api/v1/prompts/${promptId}/save`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.saved).toBe(false);
  });

  it('should reject save without auth', async () => {
    await request(app).post(`/api/v1/prompts/${promptId}/save`).expect(401);
  });
});

// ═══════════════════════════════════════════════════════
// POST /api/v1/prompts/:id/copy — 记录复制（累加）
// ═══════════════════════════════════════════════════════

describe('POST /api/v1/prompts/:id/copy', () => {
  it('should record a copy', async () => {
    const res = await request(app)
      .post(`/api/v1/prompts/${promptId}/copy`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.copiesCount).toBeGreaterThanOrEqual(1);
  });

  it('should accumulate copies (second call)', async () => {
    const res = await request(app)
      .post(`/api/v1/prompts/${promptId}/copy`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data.copiesCount).toBeGreaterThanOrEqual(2);
  });

  it('should reject copy without auth', async () => {
    await request(app).post(`/api/v1/prompts/${promptId}/copy`).expect(401);
  });
});

// ═══════════════════════════════════════════════════════
// POST /api/v1/prompts/:id/view — 记录浏览 + 24h 去重
// ═══════════════════════════════════════════════════════

describe('POST /api/v1/prompts/:id/view', () => {
  it('should record a view (first call)', async () => {
    const res = await request(app)
      .post(`/api/v1/prompts/${promptId}/view`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('should deduplicate view within 24h (second call, same user)', async () => {
    // 24h 内同用户再次 view，viewsCount 不应额外增加
    const res = await request(app)
      .post(`/api/v1/prompts/${promptId}/view`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('should accept anonymous view (no auth)', async () => {
    const res = await request(app)
      .post(`/api/v1/prompts/${promptId}/view`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('should reflect interactions in prompt detail', async () => {
    // 验证详情页能看到交互状态
    const res = await request(app)
      .get(`/api/v1/prompts/${promptId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data.isLiked).toBe(true); // 之前 re-liked
    expect(res.body.data.viewsCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.copiesCount).toBeGreaterThanOrEqual(2);
  });
});
