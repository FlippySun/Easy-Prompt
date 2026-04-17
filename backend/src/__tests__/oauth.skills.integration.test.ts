/**
 * OAuth Skill Proxy 路由集成测试 — Zhiz skills
 * 2026-04-16 新增
 * 变更类型：新增/测试
 * 功能描述：验证 `/api/v1/auth/oauth/zhiz/skills` 的严格可选认证接入、路由响应裁剪与 AppError 透传行为。
 * 设计思路：
 *   1. 挂真实 oauthRouter + errorHandler，确保测试覆盖真实 HTTP 路由层与认证中间件，而不是只测 handler 函数。
 *   2. 仅 mock skill.service，避免将 Redis / Prisma / Zhiz 上游调用引入当前最小路由验证范围。
 *   3. 显式断言坏 Bearer token 会返回 401，而不是静默降为匿名，锁定客户端 refresh-before-anonymous 的契约。
 * 参数与返回值：本文件无外部参数；各测试断言 HTTP 状态、JSON 结构与 fetchZhizSkills 入参。
 * 影响范围：backend/src/routes/oauth.ts、backend/src/middlewares/auth.ts、backend/src/middlewares/errorHandler.ts。
 * 潜在风险：若 oauthRouter 挂载前置中间件契约改变（如未来强依赖 requestId/fingerprint），需同步调整测试 app 装配。
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchZhizSkillsMock } = vi.hoisted(() => ({
  fetchZhizSkillsMock: vi.fn(),
}));

vi.mock('../services/skill.service', () => ({
  fetchZhizSkills: fetchZhizSkillsMock,
}));

import oauthRouter from '../routes/oauth';
import { config } from '../config';
import { signAccessToken } from '../utils/jwt';
import { AppError } from '../utils/errors';
import { errorHandler } from '../middlewares/errorHandler';

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';

function createTestRouteApp() {
  const app = express();
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/auth/oauth', oauthRouter);
  app.use(errorHandler);
  return app;
}

let app: ReturnType<typeof createTestRouteApp>;

beforeAll(() => {
  config.JWT_SECRET = 'test-jwt-secret';
  app = createTestRouteApp();
});

beforeEach(() => {
  vi.clearAllMocks();
  fetchZhizSkillsMock.mockResolvedValue({
    skills: [
      {
        id: 11,
        name: '多维思考',
        instructions: '请从以下多个维度深入分析该问题：',
      },
    ],
    source: 'anonymous',
    usedToken: false,
    fallbackReason: null,
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('GET /api/v1/auth/oauth/zhiz/skills', () => {
  it('should call fetchZhizSkills anonymously when no token is provided', async () => {
    const res = await request(app).get('/api/v1/auth/oauth/zhiz/skills').expect(200);

    expect(fetchZhizSkillsMock).toHaveBeenCalledWith({ userId: null });
    expect(res.body).toMatchObject({
      success: true,
      data: {
        skills: [
          {
            id: 11,
            name: '多维思考',
          },
        ],
        source: 'anonymous',
        fallbackReason: null,
      },
    });
    expect(res.body.data).not.toHaveProperty('usedToken');
  });

  it('should pass the authenticated userId to fetchZhizSkills when a valid JWT is provided', async () => {
    const token = signAccessToken({
      userId: TEST_USER_ID,
      email: 'route-auth@integration.test',
      role: 'user',
    });
    fetchZhizSkillsMock.mockResolvedValueOnce({
      skills: [
        {
          id: 12,
          name: '分析解读',
          instructions: '请深入分析以下内容：',
        },
      ],
      source: 'authenticated',
      usedToken: true,
      fallbackReason: null,
    });

    const res = await request(app)
      .get('/api/v1/auth/oauth/zhiz/skills')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(fetchZhizSkillsMock).toHaveBeenCalledWith({ userId: TEST_USER_ID });
    expect(res.body).toMatchObject({
      success: true,
      data: {
        skills: [
          {
            id: 12,
            name: '分析解读',
          },
        ],
        source: 'authenticated',
        fallbackReason: null,
      },
    });
    expect(res.body.data).not.toHaveProperty('usedToken');
  });

  it('should reject an invalid JWT with 401 instead of silently falling back to anonymous fetch', async () => {
    const res = await request(app)
      .get('/api/v1/auth/oauth/zhiz/skills')
      .set('Authorization', 'Bearer invalid.jwt.token')
      .expect(401);

    expect(fetchZhizSkillsMock).not.toHaveBeenCalled();
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_TOKEN_INVALID');
    expect(res.body.error.httpStatus).toBe(401);
  });

  it('should reject an expired JWT with 401 so the client can refresh before anonymous fallback', async () => {
    const expiredToken = jwt.sign(
      {
        userId: TEST_USER_ID,
        email: 'route-auth@integration.test',
        role: 'user',
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      config.JWT_SECRET,
    );

    const res = await request(app)
      .get('/api/v1/auth/oauth/zhiz/skills')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);

    expect(fetchZhizSkillsMock).not.toHaveBeenCalled();
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_TOKEN_EXPIRED');
    expect(res.body.error.httpStatus).toBe(401);
  });

  it('should forward AppError responses through the shared error handler', async () => {
    fetchZhizSkillsMock.mockRejectedValueOnce(
      new AppError('AUTH_PROVIDER_ERROR', 'Zhiz skill fetch failed: upstream request failed'),
    );

    const res = await request(app).get('/api/v1/auth/oauth/zhiz/skills').expect(502);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_PROVIDER_ERROR');
    expect(res.body.error.httpStatus).toBe(502);
  });
});
