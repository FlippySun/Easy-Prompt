/**
 * 增强日志 FTS 筛选单元测试
 * 2026-04-10 新增
 * 变更类型：新增
 * 设计思路：
 *   Mock Prisma client，验证 analytics.service.ts 中：
 *   1. fingerprint 筛选正确传入 Prisma where 条件
 *   2. keyword 搜索走 $queryRawUnsafe 路径，SQL 包含 tsvector + ILIKE
 *   3. keyword + 其他筛选组合正确拼接参数
 *   4. 无 keyword 时走 Prisma ORM 路径
 * 参数：无
 * 影响范围：analytics.service.ts getRequestList
 * 潜在风险：无已知风险
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma 模块
vi.mock('../lib/prisma', () => ({
  prisma: {
    aiRequestLog: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
  },
}));

import { prisma } from '../lib/prisma';
import { getRequestList } from '../services/analytics.service';

// 类型断言便于 mock 检查
const mockFindMany = prisma.aiRequestLog.findMany as ReturnType<typeof vi.fn>;
const mockCount = prisma.aiRequestLog.count as ReturnType<typeof vi.fn>;
const mockQueryRaw = prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  // 默认返回空结果
  mockFindMany.mockResolvedValue([]);
  mockCount.mockResolvedValue(0);
  mockQueryRaw.mockResolvedValue([]);
});

describe('getRequestList — fingerprint 筛选', () => {
  it('应将 fingerprint 传入 Prisma where 条件', async () => {
    await getRequestList({ fingerprint: 'abc123' }, { page: 1, limit: 10 });

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where).toMatchObject({ fingerprint: 'abc123' });
  });

  it('fingerprint 为空时不应出现在 where 中', async () => {
    await getRequestList({}, { page: 1, limit: 10 });

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where).not.toHaveProperty('fingerprint');
  });

  it('fingerprint 与其他筛选组合正确', async () => {
    await getRequestList(
      { fingerprint: 'fp-test', clientType: 'vscode', status: 'success' },
      { page: 1, limit: 10 },
    );

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where).toMatchObject({
      fingerprint: 'fp-test',
      clientType: 'vscode',
      status: 'success',
    });
  });
});

describe('getRequestList — keyword 搜索（tsvector 路径）', () => {
  it('keyword 非空时应走 $queryRawUnsafe 路径', async () => {
    // mock 返回 count 结果
    mockQueryRaw
      .mockResolvedValueOnce([]) // data query
      .mockResolvedValueOnce([{ total: 0 }]); // count query

    await getRequestList({ keyword: '测试' }, { page: 1, limit: 10 });

    // 不应调用 Prisma findMany（走 raw SQL）
    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockCount).not.toHaveBeenCalled();

    // 应调用 $queryRawUnsafe 两次（data + count）
    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
  });

  it('keyword SQL 应包含 tsvector 和 ILIKE 条件', async () => {
    mockQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

    await getRequestList({ keyword: '写代码' }, { page: 1, limit: 10 });

    const dataQuery = mockQueryRaw.mock.calls[0][0] as string;
    // 验证 SQL 包含 tsvector 搜索
    expect(dataQuery).toContain('search_vector @@ to_tsquery');
    expect(dataQuery).toContain("'simple'");
    // 验证 SQL 包含 ILIKE 兜底
    expect(dataQuery).toContain('ILIKE');
    // 验证 SQL 有 LIMIT 和 OFFSET
    expect(dataQuery).toContain('LIMIT');
    expect(dataQuery).toContain('OFFSET');
  });

  it('keyword 多词应用 & 连接为 tsquery', async () => {
    mockQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

    await getRequestList({ keyword: 'hello world' }, { page: 1, limit: 10 });

    // 检查 tsQuery 参数（第二个参数，因为 $1 是 tsquery）
    const params = mockQueryRaw.mock.calls[0];
    // 找到包含 & 的参数（tsquery 格式）
    const tsQueryParam = params.find((p: unknown) => typeof p === 'string' && p.includes('&'));
    expect(tsQueryParam).toBe('hello & world');

    // 找到 ILIKE 的 pattern 参数
    const likeParam = params.find((p: unknown) => typeof p === 'string' && p.startsWith('%'));
    expect(likeParam).toBe('%hello world%');
  });

  it('keyword + fingerprint 组合应在 SQL 中同时体现', async () => {
    mockQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

    await getRequestList({ keyword: 'test', fingerprint: 'fp-123' }, { page: 1, limit: 10 });

    const dataQuery = mockQueryRaw.mock.calls[0][0] as string;
    // SQL 应包含 fingerprint 条件
    expect(dataQuery).toContain('fingerprint');
    // SQL 应包含 tsvector 条件
    expect(dataQuery).toContain('search_vector');

    // 参数中应包含 fingerprint 值
    const params = mockQueryRaw.mock.calls[0].slice(1);
    expect(params).toContain('fp-123');
  });

  it('keyword + clientType + status 三重组合', async () => {
    mockQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

    await getRequestList(
      { keyword: 'prompt', clientType: 'browser', status: 'error' },
      { page: 1, limit: 10 },
    );

    const dataQuery = mockQueryRaw.mock.calls[0][0] as string;
    expect(dataQuery).toContain('client_type');
    expect(dataQuery).toContain('status');
    expect(dataQuery).toContain('search_vector');

    const params = mockQueryRaw.mock.calls[0].slice(1);
    expect(params).toContain('browser');
    expect(params).toContain('error');
  });
});

describe('getRequestList — 分页', () => {
  it('默认分页参数应正确应用', async () => {
    await getRequestList({}, {});

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.skip).toBe(0);
    expect(callArgs.take).toBe(20); // PAGINATION.DEFAULT_LIMIT
  });

  it('自定义 page/limit 应正确计算 skip', async () => {
    await getRequestList({}, { page: 3, limit: 50 });

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.skip).toBe(100); // (3-1) * 50
    expect(callArgs.take).toBe(50);
  });

  // MAX_LIMIT = 200（constants.ts 2026-04-09 修改）
  it('limit 不应超过 MAX_LIMIT(200)', async () => {
    await getRequestList({}, { page: 1, limit: 999 });

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.take).toBeLessThanOrEqual(200);
  });
});

describe('getRequestList — 无 keyword 走 Prisma 路径', () => {
  it('无 keyword 不应调用 $queryRawUnsafe', async () => {
    await getRequestList({ clientType: 'web' }, { page: 1, limit: 10 });

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockCount).toHaveBeenCalledTimes(1);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});
