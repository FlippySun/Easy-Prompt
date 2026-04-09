/**
 * Prompt 服务 — CRUD + 列表/详情/随机/精选/Galaxy
 * 2026-04-08 新增 — P3.01 Prompt Service
 * 设计思路：业务逻辑与路由分离，所有 Prompt 数据操作集中在此
 *   列表接口支持多维筛选、排序、分页；详情含用户交互状态
 *   非 admin 用户只能看到 status=published 的 Prompt
 * 参数：各方法参数见 JSDoc
 * 返回：标准化的 PromptSummary/PromptDetail/PaginatedResponse
 * 影响范围：prompt 路由、用户交互、Collection 关联
 * 潜在风险：无已知风险
 */

import { prisma } from '../lib/prisma';
import { AppError } from '../utils/errors';
import { createChildLogger } from '../utils/logger';
import { parsePagination, parseSort, buildPaginatedResponse } from '../utils/pagination';
import type { PaginatedResponse } from '../types/common';
import type { PromptSummary, PromptDetail, PromptStatus } from '../types/prompt';

const log = createChildLogger('prompt-service');

// ── 允许排序的字段白名单 ──────────────────────────────
const SORTABLE_FIELDS = ['createdAt', 'likesCount', 'viewsCount', 'copiesCount'];

// ── author select 子句（列表/详情复用）──────────────────
const authorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

// ── 列表精简字段 select ────────────────────────────────
const summarySelect = {
  id: true,
  title: true,
  description: true,
  tags: true,
  category: true,
  model: true,
  likesCount: true,
  viewsCount: true,
  copiesCount: true,
  createdAt: true,
  author: { select: authorSelect },
} as const;

// ── 辅助：将 Prisma 行映射为 PromptSummary ──────────────
function toSummary(row: Record<string, unknown>): PromptSummary {
  const r = row as Record<string, unknown> & {
    author: {
      id: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
    } | null;
    createdAt: Date;
  };
  return {
    id: r.id as string,
    title: r.title as string,
    description: r.description as string | null,
    tags: r.tags as string[],
    category: r.category as string,
    model: r.model as string | null,
    author: r.author ?? { id: '', username: 'anonymous', displayName: null, avatarUrl: null },
    likesCount: r.likesCount as number,
    viewsCount: r.viewsCount as number,
    copiesCount: r.copiesCount as number,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  };
}

// ── 列表查询筛选接口 ──────────────────────────────────
export interface PromptListFilters {
  category?: string;
  model?: string;
  tags?: string[];
  status?: PromptStatus;
  authorId?: string;
  search?: string;
  isFeatured?: boolean;
}

// ── P3.01: list — 分页列表 ────────────────────────────

/**
 * 分页获取 Prompt 列表
 * @param filters - 筛选条件（category, model, tags, status, authorId, search）
 * @param query - req.query（含 page, pageSize, sort）
 * @param isAdmin - 是否管理员（admin 可查看所有 status）
 * @returns PaginatedResponse<PromptSummary>
 */
export async function listPrompts(
  filters: PromptListFilters,
  query: Record<string, unknown>,
  isAdmin = false,
): Promise<PaginatedResponse<PromptSummary>> {
  const { page, pageSize, skip, take } = parsePagination(query);
  const orderBy = parseSort(query, SORTABLE_FIELDS, { createdAt: 'desc' });

  // 构建 Prisma where 条件
  const where: Record<string, unknown> = {};

  // 非 admin 只返回 published
  if (!isAdmin) {
    where.status = 'published';
  } else if (filters.status) {
    where.status = filters.status;
  }

  if (filters.category) {
    where.category = filters.category;
  }
  if (filters.model) {
    where.model = filters.model;
  }
  if (filters.authorId) {
    where.authorId = filters.authorId;
  }
  if (filters.tags && filters.tags.length > 0) {
    // tags 数组交集查询：prompt.tags 包含所有筛选 tag
    where.tags = { hasEvery: filters.tags };
  }
  // search 由 P3.02 增强，此处先用简单 LIKE
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.prompt.findMany({
      where,
      select: summarySelect,
      orderBy,
      skip,
      take,
    }),
    prisma.prompt.count({ where }),
  ]);

  const data = rows.map((r) => toSummary(r as unknown as Record<string, unknown>));
  return buildPaginatedResponse(data, total, page, pageSize);
}

// ── P3.01: detail — 详情 ──────────────────────────────

/**
 * 获取 Prompt 详情（含用户交互状态）
 * @param id - Prompt UUID
 * @param userId - 当前登录用户 ID（可选，用于查询 isLiked/isSaved）
 * @returns PromptDetail
 * @throws RESOURCE_NOT_FOUND
 */
export async function getPromptDetail(id: string, userId?: string): Promise<PromptDetail> {
  const row = await prisma.prompt.findUnique({
    where: { id },
    include: {
      author: { select: authorSelect },
    },
  });

  if (!row) {
    throw new AppError('RESOURCE_NOT_FOUND', 'Prompt not found');
  }

  // 非 published 状态仅作者或 admin 可访问（由路由层校验 admin）
  // service 层返回完整数据，权限控制在路由层

  let isLiked = false;
  let isSaved = false;
  let myCopyCount = 0;

  if (userId) {
    const [like, save, copy] = await Promise.all([
      prisma.userLike.findUnique({ where: { userId_promptId: { userId, promptId: id } } }),
      prisma.userSave.findUnique({ where: { userId_promptId: { userId, promptId: id } } }),
      prisma.userCopy.findUnique({ where: { userId_promptId: { userId, promptId: id } } }),
    ]);
    isLiked = !!like;
    isSaved = !!save;
    myCopyCount = copy?.count ?? 0;
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    content: row.content,
    tags: row.tags,
    category: row.category,
    model: row.model,
    author: row.author ?? { id: '', username: 'anonymous', displayName: null, avatarUrl: null },
    status: row.status as PromptStatus,
    likesCount: row.likesCount,
    viewsCount: row.viewsCount,
    copiesCount: row.copiesCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    isLiked,
    isSaved,
    myCopyCount,
  };
}

// ── P3.01: create — 创建 ──────────────────────────────

export interface CreatePromptInput {
  title: string;
  description?: string;
  content: string;
  tags?: string[];
  category: string;
  model?: string;
  status?: PromptStatus;
}

/**
 * 创建新 Prompt
 * @param data - Prompt 数据
 * @param authorId - 创建者用户 ID
 * @returns 创建后的 Prompt 精简信息
 */
export async function createPrompt(data: CreatePromptInput, authorId: string) {
  const prompt = await prisma.prompt.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      content: data.content,
      tags: data.tags ?? [],
      category: data.category,
      model: data.model ?? null,
      authorId,
      status: data.status ?? 'draft',
    },
    select: { id: true, title: true, status: true, createdAt: true },
  });

  log.info({ promptId: prompt.id, authorId }, 'Prompt created');
  return prompt;
}

// ── P3.01: update — 更新 ──────────────────────────────

export interface UpdatePromptInput {
  title?: string;
  description?: string;
  content?: string;
  tags?: string[];
  category?: string;
  model?: string;
  status?: PromptStatus;
}

/**
 * 更新 Prompt（仅作者或 admin 可修改）
 * @param id - Prompt UUID
 * @param data - 更新字段
 * @param userId - 当前用户 ID
 * @param isAdmin - 是否管理员
 * @returns 更新后的 Prompt 精简信息
 * @throws RESOURCE_NOT_FOUND / PERMISSION_OWNER_REQUIRED
 */
export async function updatePrompt(
  id: string,
  data: UpdatePromptInput,
  userId: string,
  isAdmin = false,
) {
  const existing = await prisma.prompt.findUnique({ where: { id }, select: { authorId: true } });
  if (!existing) {
    throw new AppError('RESOURCE_NOT_FOUND', 'Prompt not found');
  }
  if (!isAdmin && existing.authorId !== userId) {
    throw new AppError(
      'PERMISSION_OWNER_REQUIRED',
      'Only the author or admin can update this prompt',
    );
  }

  // 构建更新数据（仅包含提供的字段）
  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.model !== undefined) updateData.model = data.model;
  if (data.status !== undefined) updateData.status = data.status;

  const prompt = await prisma.prompt.update({
    where: { id },
    data: updateData,
    select: { id: true, title: true, status: true, updatedAt: true },
  });

  log.info({ promptId: id, userId, isAdmin }, 'Prompt updated');
  return prompt;
}

// ── P3.01: delete — 删除 ──────────────────────────────

/**
 * 删除 Prompt（硬删除，仅作者或 admin）
 * @param id - Prompt UUID
 * @param userId - 当前用户 ID
 * @param isAdmin - 是否管理员
 * @throws RESOURCE_NOT_FOUND / PERMISSION_OWNER_REQUIRED
 */
export async function deletePrompt(id: string, userId: string, isAdmin = false) {
  const existing = await prisma.prompt.findUnique({ where: { id }, select: { authorId: true } });
  if (!existing) {
    throw new AppError('RESOURCE_NOT_FOUND', 'Prompt not found');
  }
  if (!isAdmin && existing.authorId !== userId) {
    throw new AppError(
      'PERMISSION_OWNER_REQUIRED',
      'Only the author or admin can delete this prompt',
    );
  }

  await prisma.prompt.delete({ where: { id } });
  log.info({ promptId: id, userId, isAdmin }, 'Prompt deleted');
}

// ── P3.01: random — 随机推荐 ──────────────────────────

/**
 * 随机获取 Prompt（用于推荐）
 * @param count - 数量（默认 6，最大 20）
 * @param category - 可选分类过滤
 * @returns PromptSummary[]
 *
 * 实现：使用 PostgreSQL random() + ORDER BY 实现随机
 * 注意：大表时性能可能不佳，后续可优化为 TABLESAMPLE 或缓存
 */
export async function getRandomPrompts(count = 6, category?: string): Promise<PromptSummary[]> {
  const safeCount = Math.min(20, Math.max(1, count));
  const where: Record<string, unknown> = { status: 'published' };
  if (category) where.category = category;

  // Prisma 不直接支持 random order，使用 $queryRawUnsafe
  // 但为安全和类型安全，改用 findMany + 应用层随机
  const totalCount = await prisma.prompt.count({ where });
  if (totalCount === 0) return [];

  // 随机偏移策略：取 safeCount * 3 个候选，应用层随机选取
  const candidateCount = Math.min(totalCount, safeCount * 3);
  const maxSkip = Math.max(0, totalCount - candidateCount);
  const randomSkip = Math.floor(Math.random() * (maxSkip + 1));

  const candidates = await prisma.prompt.findMany({
    where,
    select: summarySelect,
    skip: randomSkip,
    take: candidateCount,
  });

  // Fisher-Yates 洗牌后取前 N 个
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates
    .slice(0, safeCount)
    .map((r) => toSummary(r as unknown as Record<string, unknown>));
}

// ── P3.01: featured — 精选列表 ────────────────────────

/**
 * 获取精选 Prompt（按 likesCount 排序的 Top N）
 * @param limit - 数量（默认 12，最大 50）
 * @returns PromptSummary[]
 *
 * 设计说明：Prisma schema 中 Prompt 无 is_featured 字段，
 *   改用 likesCount 排序 + status=published 作为精选策略
 *   后续可通过 schema 迁移添加 is_featured 列
 */
export async function getFeaturedPrompts(limit = 12): Promise<PromptSummary[]> {
  const safeLimit = Math.min(50, Math.max(1, limit));

  const rows = await prisma.prompt.findMany({
    where: { status: 'published' },
    select: summarySelect,
    orderBy: { likesCount: 'desc' },
    take: safeLimit,
  });

  return rows.map((r) => toSummary(r as unknown as Record<string, unknown>));
}

// ── P3.01 + P4.06: galaxy — 3D 星空可视化数据（增强版）──

export interface GalaxyCoordinates {
  x: number;
  y: number;
  z: number;
}

export interface GalaxyPrompt {
  id: string;
  title: string;
  category: string;
  likesCount: number;
  createdAt: string;
  /** 2026-04-08 P4.06 新增 — 后端预计算 3D 坐标 */
  coordinates: GalaxyCoordinates;
}

export interface GalaxyResponse {
  data: GalaxyPrompt[];
  total: number;
  /** 是否分片返回（总量 >5000 时启用） */
  chunked: boolean;
  /** 分片序号（0-indexed），仅 chunked=true 时有效 */
  chunk?: number;
  /** 总分片数，仅 chunked=true 时有效 */
  totalChunks?: number;
}

/** Galaxy 缓存 TTL — 30 分钟 */
const GALAXY_CACHE_TTL = 30 * 60;
/** 分片阈值 */
const GALAXY_CHUNK_THRESHOLD = 5000;
/** 每片大小 */
const GALAXY_CHUNK_SIZE = 2500;

/**
 * 基于 category 分布 + 时间轴计算 3D 坐标
 * 2026-04-08 P4.06 新增
 *
 * 算法：
 *   - x: 基于 category hash → 扇区角度 → cos(θ) * radius
 *   - y: 基于 likesCount → 高度（热门 Prompt 更高）
 *   - z: 基于 category hash → 扇区角度 → sin(θ) * radius
 *   - radius: 基于创建时间（越新越靠近中心）
 *
 * @param category - Prompt 分类
 * @param likesCount - 点赞数
 * @param createdAt - 创建时间
 * @param minTime - 数据集最早时间（用于归一化）
 * @param maxTime - 数据集最晚时间（用于归一化）
 */
function computeCoordinates(
  category: string,
  likesCount: number,
  createdAt: Date,
  minTime: number,
  maxTime: number,
): GalaxyCoordinates {
  // category → 确定性 hash → 扇区角度
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = ((hash << 5) - hash + category.charCodeAt(i)) | 0;
  }
  const theta = (Math.abs(hash) % 360) * (Math.PI / 180);

  // 时间归一化 [0,1]（越新 → 越小 → 越靠近中心）
  const timeRange = maxTime - minTime || 1;
  const timeFactor = 1 - (createdAt.getTime() - minTime) / timeRange; // 0=最旧, 1=最新
  const radius = 20 + timeFactor * 80; // 20-100 范围

  // 高度基于 likesCount（对数缩放）
  const y = Math.log2(likesCount + 1) * 5; // 0-65 范围

  return {
    x: Math.round(Math.cos(theta) * radius * 100) / 100,
    y: Math.round(y * 100) / 100,
    z: Math.round(Math.sin(theta) * radius * 100) / 100,
  };
}

/**
 * 获取 Galaxy 3D 星空可视化数据（P4.06 增强版）
 * @param since - 增量更新时间戳（ISO 8601），仅返回此时间之后的数据
 * @param chunk - 分片序号（0-indexed），大数据量时使用
 * @returns GalaxyResponse
 *
 * 增强点（P4.06）：
 *   1. 后端预计算 coordinates（基于 category 分布 + 时间轴）
 *   2. Redis 缓存 30min
 *   3. 支持 since 增量更新参数
 *   4. 数据量 >5000 时分片返回
 */
export async function getGalaxyData(since?: string, chunk?: number): Promise<GalaxyResponse> {
  // 增量模式不使用缓存（数据量通常较小）
  if (!since) {
    const cacheKey = chunk !== undefined ? `galaxy:chunk:${chunk}` : 'galaxy:full';
    try {
      const { redis: redisClient } = await import('../lib/redis');
      if (redisClient.status === 'ready') {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          log.debug({ source: 'cache', chunk }, 'Galaxy data cache hit');
          return JSON.parse(cached) as GalaxyResponse;
        }
      }
    } catch {
      // Redis 不可用，降级到 DB 查询
    }
  }

  // 构建查询条件
  const where: Record<string, unknown> = { status: 'published' };
  if (since) {
    const sinceDate = new Date(since);
    if (!isNaN(sinceDate.getTime())) {
      where.createdAt = { gt: sinceDate };
    }
  }

  const rows = await prisma.prompt.findMany({
    where,
    select: {
      id: true,
      title: true,
      category: true,
      likesCount: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const total = rows.length;

  // 计算时间范围（用于坐标归一化）
  let minTime = Date.now();
  let maxTime = 0;
  for (const r of rows) {
    const t = r.createdAt.getTime();
    if (t < minTime) minTime = t;
    if (t > maxTime) maxTime = t;
  }

  // 是否需要分片
  const needsChunking = total > GALAXY_CHUNK_THRESHOLD && !since;
  const totalChunks = needsChunking ? Math.ceil(total / GALAXY_CHUNK_SIZE) : 1;
  const currentChunk = needsChunking ? Math.min(chunk ?? 0, totalChunks - 1) : 0;

  // 分片切割
  const startIdx = needsChunking ? currentChunk * GALAXY_CHUNK_SIZE : 0;
  const endIdx = needsChunking ? Math.min(startIdx + GALAXY_CHUNK_SIZE, total) : total;
  const slicedRows = rows.slice(startIdx, endIdx);

  // 计算坐标
  const data: GalaxyPrompt[] = slicedRows.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    likesCount: r.likesCount,
    createdAt: r.createdAt.toISOString(),
    coordinates: computeCoordinates(r.category, r.likesCount, r.createdAt, minTime, maxTime),
  }));

  const response: GalaxyResponse = {
    data,
    total,
    chunked: needsChunking,
    ...(needsChunking && { chunk: currentChunk, totalChunks }),
  };

  // 写缓存（仅非增量模式）
  if (!since) {
    const cacheKey = needsChunking ? `galaxy:chunk:${currentChunk}` : 'galaxy:full';
    try {
      const { redis: redisClient } = await import('../lib/redis');
      if (redisClient.status === 'ready') {
        await redisClient.set(cacheKey, JSON.stringify(response), 'EX', GALAXY_CACHE_TTL);
      }
    } catch {
      // 缓存写入失败静默降级
    }
  }

  log.debug(
    { total, chunk: currentChunk, chunked: needsChunking, since: !!since },
    'Galaxy data computed',
  );
  return response;
}
