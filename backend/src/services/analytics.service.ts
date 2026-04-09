/**
 * Analytics 服务 — 请求分析与统计
 * 2026-04-08 新增 — P2.04
 * 变更类型：新增
 * 设计思路：封装 ai_request_logs / daily_stats 的聚合查询，
 *   供 admin analytics 路由调用。所有方法均需 admin 权限（在路由层校验）。
 *   大表查询走索引（createdAt, clientType, status, ipAddress, providerId）。
 * 参数：各方法接收 dateRange / filters / pagination
 * 影响范围：analytics 路由（P2.05）
 * 潜在风险：大时间跨度查询可能慢，后续可加 DB 物化视图或缓存
 */

import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { PAGINATION } from '../config/constants';

// ── 公共类型 ──────────────────────────────────────────

export interface DateRange {
  from: Date;
  to: Date;
}

export interface PaginationOpts {
  page?: number;
  limit?: number;
}

// ── P2.04.1 — getRequestList ──────────────────────────

export interface RequestListFilters {
  dateRange?: DateRange;
  clientType?: string;
  scene?: string;
  model?: string;
  provider?: string;
  status?: string;
  userId?: string;
  ipAddress?: string;
}

export async function getRequestList(
  filters: RequestListFilters,
  pagination: PaginationOpts,
) {
  const page = pagination.page ?? PAGINATION.DEFAULT_PAGE;
  const limit = Math.min(pagination.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const skip = (page - 1) * limit;

  const where = buildRequestWhere(filters);

  const [data, total] = await Promise.all([
    prisma.aiRequestLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        requestId: true,
        userId: true,
        clientType: true,
        ipAddress: true,
        enhanceMode: true,
        sceneIds: true,
        isComposite: true,
        providerSlug: true,
        modelUsed: true,
        durationMs: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        estimatedCost: true,
        status: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
    prisma.aiRequestLog.count({ where }),
  ]);

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

// ── P2.04.2 — getRequestDetail ────────────────────────

export async function getRequestDetail(id: string) {
  return prisma.aiRequestLog.findUnique({ where: { id } });
}

// ── P2.04.3 — getSummary ──────────────────────────────

export interface AnalyticsSummaryResult {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  avgLatencyMs: number;
  totalTokens: number;
  totalCost: number;
}

export async function getSummary(dateRange?: DateRange): Promise<AnalyticsSummaryResult> {
  const where = dateRange ? buildDateWhere(dateRange) : {};

  const agg = await prisma.aiRequestLog.aggregate({
    where,
    _count: { id: true },
    _avg: { durationMs: true },
    _sum: { totalTokens: true, estimatedCost: true },
  });

  const errorCount = await prisma.aiRequestLog.count({
    where: { ...where, status: { not: 'success' } },
  });

  const total = agg._count.id;
  const successCount = total - errorCount;

  return {
    totalRequests: total,
    successCount,
    errorCount,
    successRate: total > 0 ? Number(((successCount / total) * 100).toFixed(2)) : 0,
    avgLatencyMs: Math.round(agg._avg.durationMs ?? 0),
    totalTokens: agg._sum.totalTokens ?? 0,
    totalCost: Number(agg._sum.estimatedCost ?? 0),
  };
}

// ── P2.04.4 — getDailyStats ──────────────────────────

export async function getDailyStats(dateRange?: DateRange) {
  const where: Prisma.DailyStatWhereInput = {};
  if (dateRange) {
    where.date = { gte: dateRange.from, lte: dateRange.to };
  }

  return prisma.dailyStat.findMany({
    where,
    orderBy: { date: 'asc' },
  });
}

// ── P2.04.5 — getByClient ────────────────────────────

export async function getByClient(dateRange?: DateRange) {
  const where = dateRange ? buildDateWhere(dateRange) : {};

  const results = await prisma.aiRequestLog.groupBy({
    by: ['clientType'],
    where,
    _count: { id: true },
    _sum: { totalTokens: true, estimatedCost: true },
    _avg: { durationMs: true },
  });

  return results.map((r) => ({
    clientType: r.clientType,
    count: r._count.id,
    totalTokens: r._sum.totalTokens ?? 0,
    totalCost: Number(r._sum.estimatedCost ?? 0),
    avgLatencyMs: Math.round(r._avg.durationMs ?? 0),
  }));
}

// ── P2.04.6 — getByScene ─────────────────────────────

/**
 * 按场景分组统计
 * 注意：sceneIds 是 String[]，需要用 raw SQL 展开数组元素统计
 * 为避免 raw SQL 复杂度，首期使用应用层聚合
 */
export async function getByScene(dateRange?: DateRange, limit = 20) {
  const where = dateRange ? buildDateWhere(dateRange) : {};

  const logs = await prisma.aiRequestLog.findMany({
    where,
    select: { sceneIds: true },
  });

  // 应用层展开 sceneIds 数组并计数
  const sceneCount: Record<string, number> = {};
  for (const log of logs) {
    for (const scene of log.sceneIds) {
      sceneCount[scene] = (sceneCount[scene] ?? 0) + 1;
    }
  }

  return Object.entries(sceneCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([scene, count]) => ({ scene, count }));
}

// ── P2.04.7 — getByIp ────────────────────────────────

export async function getByIp(dateRange?: DateRange, limit = 20) {
  const where = dateRange ? buildDateWhere(dateRange) : {};

  const results = await prisma.aiRequestLog.groupBy({
    by: ['ipAddress'],
    where: { ...where, ipAddress: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: limit,
  });

  return results.map((r) => ({
    ipAddress: r.ipAddress,
    count: r._count.id,
  }));
}

// ── P2.04.8 — getByUser ──────────────────────────────

export async function getByUser(dateRange?: DateRange, limit = 20) {
  const where = dateRange ? buildDateWhere(dateRange) : {};

  const results = await prisma.aiRequestLog.groupBy({
    by: ['userId'],
    where: { ...where, userId: { not: null } },
    _count: { id: true },
    _sum: { totalTokens: true },
    orderBy: { _count: { id: 'desc' } },
    take: limit,
  });

  return results.map((r) => ({
    userId: r.userId,
    count: r._count.id,
    totalTokens: r._sum.totalTokens ?? 0,
  }));
}

// ── P2.04.9 — getCostReport ──────────────────────────

export async function getCostReport(dateRange?: DateRange) {
  const where = dateRange ? buildDateWhere(dateRange) : {};

  const results = await prisma.aiRequestLog.groupBy({
    by: ['providerSlug', 'modelUsed'],
    where,
    _count: { id: true },
    _sum: { totalTokens: true, estimatedCost: true, promptTokens: true, completionTokens: true },
    _avg: { durationMs: true },
  });

  return results.map((r) => ({
    provider: r.providerSlug,
    model: r.modelUsed,
    count: r._count.id,
    promptTokens: r._sum.promptTokens ?? 0,
    completionTokens: r._sum.completionTokens ?? 0,
    totalTokens: r._sum.totalTokens ?? 0,
    totalCost: Number(r._sum.estimatedCost ?? 0),
    avgLatencyMs: Math.round(r._avg.durationMs ?? 0),
  }));
}

// ── 内部工具 ──────────────────────────────────────────

function buildDateWhere(dateRange: DateRange): Prisma.AiRequestLogWhereInput {
  return {
    createdAt: { gte: dateRange.from, lte: dateRange.to },
  };
}

function buildRequestWhere(filters: RequestListFilters): Prisma.AiRequestLogWhereInput {
  const where: Prisma.AiRequestLogWhereInput = {};

  if (filters.dateRange) {
    where.createdAt = { gte: filters.dateRange.from, lte: filters.dateRange.to };
  }
  if (filters.clientType) where.clientType = filters.clientType;
  if (filters.scene) where.sceneIds = { has: filters.scene };
  if (filters.model) where.modelUsed = filters.model;
  if (filters.provider) where.providerSlug = filters.provider;
  if (filters.status) where.status = filters.status;
  if (filters.userId) where.userId = filters.userId;
  if (filters.ipAddress) where.ipAddress = filters.ipAddress;

  return where;
}
