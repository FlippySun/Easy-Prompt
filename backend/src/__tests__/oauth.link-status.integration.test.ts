/**
 * OAuth Zhiz link-status 路由集成测试
 * 2026-04-22 新增
 * 变更类型：新增/测试
 * 功能描述：验证 `/api/v1/auth/oauth/zhiz/link-status` 的认证要求，以及 route 对 zhiz-link.service 的入参/出参透传。
 * 设计思路：
 *   1. 挂真实 oauthRouter + errorHandler，覆盖 auth middleware 与共享错误处理。
 *   2. 仅 mock zhiz-link.service，避免把 Prisma / Redis / Zhiz 上游依赖引入当前最小路由验证范围。
 *   3. 显式断言无 token 会 401，锁定当前接口仅对已登录用户暴露的语义。
 * 参数与返回值：本文件无外部参数；各测试断言 HTTP 状态、JSON 结构与 getZhizLinkStatus 入参。
 * 影响范围：backend/src/routes/oauth.ts、backend/src/services/zhiz-link.service.ts、backend/src/middlewares/auth.ts。
 * 潜在风险：若 oauthRouter 前置依赖新增强制中间件（如 request context），需同步调整测试 app 装配。
 */

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { getZhizLinkStatusMock } = vi.hoisted(() => ({
  getZhizLinkStatusMock: vi.fn(),
}));

vi.mock('../services/zhiz-link.service', () => ({
  getZhizLinkStatus: getZhizLinkStatusMock,
}));

import oauthRouter from '../routes/oauth';
import { config } from '../config';
import { signAccessToken } from '../utils/jwt';
import { AppError } from '../utils/errors';
import { errorHandler } from '../middlewares/errorHandler';

const TEST_USER_ID = '22222222-2222-2222-2222-222222222222';

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

/**
 * 2026-04-22 新增 — 受保护路由测试 JWT 构造
 * 变更类型：新增/测试辅助
 * 功能描述：为 link-status 路由生成最小可用 Bearer token，避免每个用例重复手写签名载荷。
 * 设计思路：仅保留 auth middleware 所需的 userId/email/role 三个字段，不引入 refresh/cookie 逻辑。
 * 参数与返回值：`createAuthHeader()` 返回 Authorization header 字符串。
 * 影响范围：本测试文件的受保护路由请求。
 * 潜在风险：若 access token 载荷契约变化，需要同步更新 helper。
 */
function createAuthHeader(): string {
  return `Bearer ${signAccessToken({
    userId: TEST_USER_ID,
    email: 'link-status@integration.test',
    role: 'user',
  })}`;
}

let app: ReturnType<typeof createTestRouteApp>;

beforeAll(() => {
  config.JWT_SECRET = 'test-jwt-secret';
  app = createTestRouteApp();
});

beforeEach(() => {
  vi.clearAllMocks();
  getZhizLinkStatusMock.mockResolvedValue({
    provider: 'zhiz',
    linked: false,
    profile: {
      displayName: null,
      avatarUrl: null,
    },
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('GET /api/v1/auth/oauth/zhiz/link-status', () => {
  it('should require authentication before returning the current user link status', async () => {
    const res = await request(app).get('/api/v1/auth/oauth/zhiz/link-status').expect(401);

    expect(getZhizLinkStatusMock).not.toHaveBeenCalled();
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_UNAUTHORIZED');
  });

  it('should pass the authenticated userId to getZhizLinkStatus', async () => {
    const res = await request(app)
      .get('/api/v1/auth/oauth/zhiz/link-status')
      .set('Authorization', createAuthHeader())
      .expect(200);

    expect(getZhizLinkStatusMock).toHaveBeenCalledWith(TEST_USER_ID);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        provider: 'zhiz',
        linked: false,
        profile: {
          displayName: null,
          avatarUrl: null,
        },
      },
    });
  });

  it('should return the linked profile snapshot from zhiz-link.service without exposing extra route fields', async () => {
    getZhizLinkStatusMock.mockResolvedValueOnce({
      provider: 'zhiz',
      linked: true,
      profile: {
        displayName: 'Zhiz Linked Profile',
        avatarUrl: 'https://avatar.example/zhiz-linked-profile.png',
      },
    });

    const res = await request(app)
      .get('/api/v1/auth/oauth/zhiz/link-status')
      .set('Authorization', createAuthHeader())
      .expect(200);

    expect(getZhizLinkStatusMock).toHaveBeenCalledWith(TEST_USER_ID);
    expect(res.body.data).toMatchObject({
      provider: 'zhiz',
      linked: true,
      profile: {
        displayName: 'Zhiz Linked Profile',
        avatarUrl: 'https://avatar.example/zhiz-linked-profile.png',
      },
    });
  });

  it('should forward AppError responses through the shared error handler', async () => {
    getZhizLinkStatusMock.mockRejectedValueOnce(
      new AppError('AUTH_PROVIDER_ERROR', 'Zhiz link status fetch failed'),
    );

    const res = await request(app)
      .get('/api/v1/auth/oauth/zhiz/link-status')
      .set('Authorization', createAuthHeader())
      .expect(502);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_PROVIDER_ERROR');
    expect(res.body.error.httpStatus).toBe(502);
  });
});
