/**
 * Analytics 服务 — 请求分析与统计
 * 2026-04-08 新增 — P2.04
 * 2026-04-10 修改 — 增强日志：扩展 fingerprint/keyword 筛选 + tsvector 全文搜索
 * 变更类型：修改
 * 设计思路：封装 ai_request_logs / daily_stats 的聚合查询，
 *   供 admin analytics 路由调用。所有方法均需 admin 权限（在路由层校验）。
 *   大表查询走索引（createdAt, clientType, status, ipAddress, providerId, fingerprint）。
 *   keyword 搜索采用 tsvector + ILIKE 双路策略：
 *     - 优先 tsvector GIN 索引（`simple` 分词，对中文逐字切分）
 *     - ILIKE 作为兜底（走 pg_trgm GIN 索引加速）
 * 参数：各方法接收 dateRange / filters / pagination
 * 影响范围：analytics 路由（P2.05）、增强日志前端页面
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
  // 2026-04-10 新增 — 增强日志筛选扩展
  fingerprint?: string;
  /** 关键词搜索（搜索 original_input + ai_output，走 tsvector + ILIKE 双路） */
  keyword?: string;
}

/**
 * 获取请求列表（分页 + 筛选）
 * 2026-04-10 修改 — 增强日志：
 *   1. select 增加 fingerprint / userAgent / originalInput 供前端展示
 *   2. keyword 搜索走 tsvector raw SQL 路径（Prisma 不原生支持 tsvector）
 *   3. 非 keyword 场景保持原 Prisma 查询路径
 * 参数：filters — 9 维筛选条件；pagination — 分页参数
 * 返回：{ data, meta } 分页结果
 * 影响范围：GET /admin/analytics/requests
 * 潜在风险：keyword raw SQL 已严格参数化防注入
 */
export async function getRequestList(filters: RequestListFilters, pagination: PaginationOpts) {
  const page = pagination.page ?? PAGINATION.DEFAULT_PAGE;
  const limit = Math.min(pagination.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const skip = (page - 1) * limit;

  // keyword 搜索需走 raw SQL（tsvector + ILIKE 双路），其他筛选走 Prisma ORM
  if (filters.keyword) {
    return getRequestListWithKeyword(filters, page, limit, skip);
  }

  const where = buildRequestWhere(filters);

  const [data, total] = await Promise.all([
    prisma.aiRequestLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: REQUEST_LIST_SELECT,
    }),
    prisma.aiRequestLog.count({ where }),
  ]);

  return {
    data,
    meta: { total, page, pageSize: limit, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * 列表页 select 字段集（复用常量，避免重复定义）
 * 2026-04-10 新增 — 增加 fingerprint / userAgent / originalInput
 */
const REQUEST_LIST_SELECT = {
  id: true,
  requestId: true,
  userId: true,
  clientType: true,
  ipAddress: true,
  fingerprint: true,
  userAgent: true,
  originalInput: true,
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
} as const;

/**
 * keyword 搜索的 raw SQL 实现
 * 2026-04-10 新增 — tsvector 全文搜索 + ILIKE 兜底
 * 设计思路：
 *   1. 构建 WHERE 子句：先拼接非 keyword 的普通筛选条件
 *   2. keyword 条件：(search_vector @@ to_tsquery('simple', $kw)) OR (original_input ILIKE $pattern)
 *      tsvector 走 GIN 索引；ILIKE 走 pg_trgm GIN 索引
 *   3. 严格参数化查询，所有用户输入通过 $N 占位符传入
 * 参数：filters — 筛选条件；page/limit/skip — 分页
 * 返回：与 getRequestList 相同的 { data, meta } 结构
 * 潜在风险：无已知风险（参数化查询防注入）
 */
async function getRequestListWithKeyword(
  filters: RequestListFilters,
  page: number,
  limit: number,
  skip: number,
) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  // 普通筛选条件
  if (filters.dateRange) {
    conditions.push(`created_at >= $${paramIndex}`);
    params.push(filters.dateRange.from);
    paramIndex++;
    conditions.push(`created_at <= $${paramIndex}`);
    params.push(filters.dateRange.to);
    paramIndex++;
  }
  if (filters.clientType) {
    conditions.push(`client_type = $${paramIndex}`);
    params.push(filters.clientType);
    paramIndex++;
  }
  if (filters.scene) {
    conditions.push(`$${paramIndex} = ANY(scene_ids)`);
    params.push(filters.scene);
    paramIndex++;
  }
  if (filters.model) {
    conditions.push(`model_used = $${paramIndex}`);
    params.push(filters.model);
    paramIndex++;
  }
  if (filters.provider) {
    conditions.push(`provider_slug = $${paramIndex}`);
    params.push(filters.provider);
    paramIndex++;
  }
  if (filters.status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(filters.status);
    paramIndex++;
  }
  if (filters.userId) {
    conditions.push(`user_id = $${paramIndex}::uuid`);
    params.push(filters.userId);
    paramIndex++;
  }
  if (filters.ipAddress) {
    conditions.push(`ip_address = $${paramIndex}::inet`);
    params.push(filters.ipAddress);
    paramIndex++;
  }
  if (filters.fingerprint) {
    conditions.push(`fingerprint = $${paramIndex}`);
    params.push(filters.fingerprint);
    paramIndex++;
  }

  // keyword 搜索条件：tsvector 优先 + ILIKE 兜底
  // 将空格替换为 & 构建 tsquery（'simple' 分词器对中文逐字切分）
  const keyword = filters.keyword!.trim();
  const tsQuery = keyword.split(/\s+/).filter(Boolean).join(' & ');
  const likePattern = `%${keyword}%`;
  conditions.push(
    `(search_vector @@ to_tsquery('simple', $${paramIndex}) OR original_input ILIKE $${paramIndex + 1})`,
  );
  params.push(tsQuery, likePattern);
  paramIndex += 2;

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 查询数据
  const dataQuery = `
    SELECT id, request_id as "requestId", user_id as "userId", client_type as "clientType",
           ip_address as "ipAddress", fingerprint, user_agent as "userAgent",
           original_input as "originalInput", enhance_mode as "enhanceMode",
           scene_ids as "sceneIds", is_composite as "isComposite",
           provider_slug as "providerSlug", model_used as "modelUsed",
           duration_ms as "durationMs", prompt_tokens as "promptTokens",
           completion_tokens as "completionTokens", total_tokens as "totalTokens",
           estimated_cost as "estimatedCost", status, error_message as "errorMessage",
           created_at as "createdAt"
    FROM ai_request_logs
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  params.push(limit, skip);

  // 查询总数
  const countQuery = `SELECT COUNT(*)::int as total FROM ai_request_logs ${whereClause}`;
  const countParams = params.slice(0, paramIndex - 1); // 不含 LIMIT/OFFSET

  const [data, countResult] = await Promise.all([
    prisma.$queryRawUnsafe(dataQuery, ...params),
    prisma.$queryRawUnsafe(countQuery, ...countParams) as Promise<[{ total: number }]>,
  ]);

  const total = countResult[0]?.total ?? 0;

  return {
    data,
    meta: { total, page, pageSize: limit, totalPages: Math.ceil(total / limit) },
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

/**
 * 构建 Prisma WHERE 条件（非 keyword 路径使用）
 * 2026-04-10 修改 — 增加 fingerprint 条件
 */
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
  // 2026-04-10 新增 — fingerprint 精确匹配
  if (filters.fingerprint) where.fingerprint = filters.fingerprint;

  return where;
}
