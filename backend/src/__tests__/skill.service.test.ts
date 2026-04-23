/**
 * Skill 服务单元测试 — Zhiz skill proxy 服务层
 * 2026-04-16 新增
 * 变更类型：新增/测试
 * 功能描述：验证 skill.service.ts 中的 Zhiz token 解密、匿名退化、上游非 JSON/5xx/401 行为与保守响应标准化。
 * 设计思路：
 *   1. Mock Prisma OAuthAccount 查询与 decryptOAuthToken，确保测试只聚焦服务层决策。
 *   2. Mock 全局 fetch，覆盖 authenticated / anonymous 两条请求链路与单次匿名重试策略。
 *   3. 用最小响应样例锁定当前确认契约，避免 route 层接入前行为漂移。
 * 参数与返回值：本文件无外部参数；各测试断言 fetchZhizSkills() 的返回值或 AppError。
 * 影响范围：backend/src/services/skill.service.ts。
 * 潜在风险：若上游最终 payload 包装层级与当前测试样例不同，需要同步更新服务与测试。
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindFirst, mockDecryptOAuthToken } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockDecryptOAuthToken: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    oAuthAccount: {
      findFirst: mockFindFirst,
    },
  },
}));

vi.mock('../utils/crypto', () => ({
  decryptOAuthToken: mockDecryptOAuthToken,
}));

import { config } from '../config';
import { fetchZhizSkills } from '../services/skill.service';

const fetchMock = vi.fn();

function createMockHeaders(contentType: string): Headers {
  return {
    get: vi
      .fn()
      .mockImplementation((name: string) =>
        name.toLowerCase() === 'content-type' ? contentType : null,
      ),
  } as unknown as Headers;
}

function mockJsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: createMockHeaders('application/json'),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  } as unknown as Response;
}

function mockTextResponse(
  body: string,
  options: { status?: number; contentType?: string } = {},
): Response {
  const status = options.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: createMockHeaders(options.contentType ?? 'text/plain'),
    text: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  config.OAUTH_ZHIZ_BASE_URL = 'https://zhiz.com.cn/tpt-infinity';
  mockFindFirst.mockResolvedValue(null);
  mockDecryptOAuthToken.mockReset();
  fetchMock.mockReset();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('fetchZhizSkills', () => {
  it('should fetch authenticated skills when a stored Zhiz token exists', async () => {
    mockFindFirst.mockResolvedValue({ accessToken: 'encrypted-token' });
    mockDecryptOAuthToken.mockReturnValue('decrypted-token');
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse([
        {
          id: 11,
          name: '多维思考',
          instructions: '请从以下多个维度深入分析该问题：',
        },
      ]),
    );

    const result = await fetchZhizSkills({ userId: 'user-1' });

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        provider: 'zhiz',
      },
      select: {
        accessToken: true,
      },
    });
    expect(mockDecryptOAuthToken).toHaveBeenCalledWith('encrypted-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://zhiz.com.cn/tpt-infinity/oauth2/userSkill?access_token=decrypted-token',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toMatchObject({
      source: 'authenticated',
      usedToken: true,
      fallbackReason: null,
      skills: [
        {
          id: 11,
          name: '多维思考',
        },
      ],
    });
  });

  it('should fetch anonymous skills when no Zhiz token is available for the user', async () => {
    mockFindFirst.mockResolvedValue({ accessToken: null });
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        data: [
          {
            id: 1,
            name: '解释说明',
            instructions: '请用清晰易懂的语言解释以下内容：',
          },
        ],
      }),
    );

    const result = await fetchZhizSkills({ userId: 'user-2' });

    expect(mockDecryptOAuthToken).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://zhiz.com.cn/tpt-infinity/oauth2/userSkill',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toMatchObject({
      source: 'anonymous',
      usedToken: false,
      fallbackReason: 'missing_token',
      skills: [
        {
          id: 1,
          name: '解释说明',
        },
      ],
    });
  });

  it('should fetch anonymous skills directly when no userId is provided', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        skills: [
          {
            id: 3,
            name: '总结概括',
            instructions: '请清晰、简洁地总结以下内容的核心要点：',
          },
        ],
      }),
    );

    const result = await fetchZhizSkills();

    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://zhiz.com.cn/tpt-infinity/oauth2/userSkill',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toMatchObject({
      source: 'anonymous',
      usedToken: false,
      fallbackReason: null,
      skills: [
        {
          id: 3,
          name: '总结概括',
        },
      ],
    });
  });

  it('should throw a decrypt error when the stored Zhiz token cannot be decrypted', async () => {
    mockFindFirst.mockResolvedValue({ accessToken: 'corrupted-token' });
    mockDecryptOAuthToken.mockImplementation(() => {
      throw new Error('decrypt failed');
    });

    await expect(fetchZhizSkills({ userId: 'user-3' })).rejects.toMatchObject({
      code: 'AUTH_ZHIZ_TOKEN_DECRYPT_FAILED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should retry anonymously once when the authenticated upstream request returns 401', async () => {
    mockFindFirst.mockResolvedValue({ accessToken: 'encrypted-token' });
    mockDecryptOAuthToken.mockReturnValue('decrypted-token');
    fetchMock
      .mockResolvedValueOnce(mockJsonResponse({ message: 'token expired' }, 401))
      .mockResolvedValueOnce(
        mockJsonResponse({
          skills: [
            {
              id: 2,
              name: '分析解读',
              instructions: '请深入分析以下内容：',
            },
          ],
        }),
      );

    const result = await fetchZhizSkills({ userId: 'user-4' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://zhiz.com.cn/tpt-infinity/oauth2/userSkill?access_token=decrypted-token',
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://zhiz.com.cn/tpt-infinity/oauth2/userSkill');
    expect(result).toMatchObject({
      source: 'anonymous',
      usedToken: false,
      fallbackReason: 'upstream_auth_failed',
      skills: [
        {
          id: 2,
          name: '分析解读',
        },
      ],
    });
  });

  it('should throw an upstream error when the skill endpoint returns non-JSON content', async () => {
    fetchMock.mockResolvedValueOnce(
      mockTextResponse('<html>bad gateway</html>', {
        status: 502,
        contentType: 'text/html',
      }),
    );

    await expect(fetchZhizSkills()).rejects.toMatchObject({
      code: 'AUTH_PROVIDER_ERROR',
      message: 'Zhiz skill fetch failed: skill endpoint returned text/html (status 502)',
    });
  });

  it('should not fallback anonymously when the authenticated upstream request returns 5xx', async () => {
    mockFindFirst.mockResolvedValue({ accessToken: 'encrypted-token' });
    mockDecryptOAuthToken.mockReturnValue('decrypted-token');
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ message: 'server error' }, 500));

    await expect(fetchZhizSkills({ userId: 'user-5' })).rejects.toMatchObject({
      code: 'AUTH_PROVIDER_ERROR',
      message: 'Zhiz skill fetch failed: server error',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
