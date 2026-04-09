/**
 * Collection 服务 — CRUD + 列表/详情/Prompt 关联管理
 * 2026-04-08 新增 — P3.08 Collection Service
 * 设计思路：合集（Collection）是 Prompt 的分组容器
 *   通过 collection_prompts 中间表实现 M:N 关联
 *   列表支持分页/排序/标签筛选
 *   详情含关联 Prompt 列表和用户收藏状态
 * 参数：各方法参数见 JSDoc
 * 返回：标准化的 Collection/CollectionDetail/PaginatedResponse
 * 影响范围：collection 路由、用户收藏
 * 潜在风险：无已知风险
 */

import { prisma } from '../lib/prisma';
import { AppError } from '../utils/errors';
import { createChildLogger } from '../utils/logger';
import { parsePagination, parseSort, buildPaginatedResponse } from '../utils/pagination';
import type { PaginatedResponse } from '../types/common';
import type { PromptSummary } from '../types/prompt';

const log = createChildLogger('collection-service');

// 2026-04-09 修复 — author + prompt 精简字段 select，供 CollectionDetail 返回完整 PromptSummary
const authorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

const promptSummarySelect = {
  id: true,
  title: true,
  description: true,
  content: true,
  tags: true,
  category: true,
  model: true,
  likesCount: true,
  viewsCount: true,
  copiesCount: true,
  createdAt: true,
  author: { select: authorSelect },
} as const;

// ── 允许排序的字段白名单 ──────────────────────────────
const SORTABLE_FIELDS = ['createdAt', 'savedCount'];

// ── 列表项类型 ────────────────────────────────────────
export interface CollectionListItem {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  gradientFrom: string | null;
  gradientTo: string | null;
  tags: string[];
  difficulty: string | null;
  estimatedTime: string | null;
  savedCount: number;
  promptCount: number;
  createdAt: string;
}

// ── 详情类型 ──────────────────────────────────────────
export interface CollectionDetailResult {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  gradientFrom: string | null;
  gradientTo: string | null;
  tags: string[];
  difficulty: string | null;
  estimatedTime: string | null;
  savedCount: number;
  createdAt: string;
  // 2026-04-09 修复 — 返回完整 PromptSummary，前端需要完整卡片数据
  prompts: PromptSummary[];
  promptCount: number;
  isSaved: boolean;
}

// ── 筛选接口 ──────────────────────────────────────────
export interface CollectionListFilters {
  tags?: string[];
  difficulty?: string;
  search?: string;
}

// ── P3.08: list — 分页列表 ────────────────────────────

/**
 * 分页获取 Collection 列表
 * @param filters - 筛选条件（tags, difficulty, search）
 * @param query - req.query（含 page, pageSize, sort）
 * @returns PaginatedResponse<CollectionListItem>
 */
export async function listCollections(
  filters: CollectionListFilters,
  query: Record<string, unknown>,
): Promise<PaginatedResponse<CollectionListItem>> {
  const { page, pageSize, skip, take } = parsePagination(query);
  const orderBy = parseSort(query, SORTABLE_FIELDS, { createdAt: 'desc' });

  const where: Record<string, unknown> = {};

  if (filters.tags && filters.tags.length > 0) {
    where.tags = { hasEvery: filters.tags };
  }
  if (filters.difficulty) {
    where.difficulty = filters.difficulty;
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.collection.findMany({
      where,
      include: {
        _count: { select: { prompts: true } },
      },
      orderBy,
      skip,
      take,
    }),
    prisma.collection.count({ where }),
  ]);

  const data: CollectionListItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    icon: r.icon,
    gradientFrom: r.gradientFrom,
    gradientTo: r.gradientTo,
    tags: r.tags,
    difficulty: r.difficulty,
    estimatedTime: r.estimatedTime,
    savedCount: r.savedCount,
    promptCount: r._count.prompts,
    createdAt: r.createdAt.toISOString(),
  }));

  return buildPaginatedResponse(data, total, page, pageSize);
}

// ── P3.08: detail — 详情 ──────────────────────────────

/**
 * 获取 Collection 详情（含关联 Prompt 和用户收藏状态）
 * @param id - Collection UUID
 * @param userId - 当前登录用户 ID（可选）
 * @returns CollectionDetailResult
 * @throws RESOURCE_NOT_FOUND
 */
export async function getCollectionDetail(
  id: string,
  userId?: string,
): Promise<CollectionDetailResult> {
  const row = await prisma.collection.findUnique({
    where: { id },
    include: {
      // 2026-04-09 修复 — 选择完整 PromptSummary 字段，前端需要完整卡片数据
      prompts: {
        include: {
          prompt: {
            select: promptSummarySelect,
          },
        },
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!row) {
    throw new AppError('RESOURCE_NOT_FOUND', 'Collection not found');
  }

  let isSaved = false;
  if (userId) {
    const save = await prisma.userCollectionSave.findUnique({
      where: { userId_collectionId: { userId, collectionId: id } },
    });
    isSaved = !!save;
  }

  // 2026-04-09 修复 — 映射为完整 PromptSummary，前端 mapPromptItem 依赖全部字段
  const rowAny = row as any;
  const mappedPrompts: PromptSummary[] = (rowAny.prompts ?? []).map((cp: any) => {
    const p = cp.prompt;
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      content: p.content,
      tags: p.tags,
      category: p.category,
      model: p.model,
      author: p.author ?? { id: '', username: 'anonymous', displayName: null, avatarUrl: null },
      likesCount: p.likesCount,
      viewsCount: p.viewsCount,
      copiesCount: p.copiesCount,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
    };
  });

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    icon: row.icon,
    gradientFrom: row.gradientFrom,
    gradientTo: row.gradientTo,
    tags: row.tags,
    difficulty: row.difficulty,
    estimatedTime: row.estimatedTime,
    savedCount: row.savedCount,
    createdAt: row.createdAt.toISOString(),
    prompts: mappedPrompts,
    promptCount: mappedPrompts.length,
    isSaved,
  };
}

// ── P3.08: create — 创建 ──────────────────────────────

export interface CreateCollectionInput {
  title: string;
  description?: string;
  icon?: string;
  gradientFrom?: string;
  gradientTo?: string;
  tags?: string[];
  difficulty?: string;
  estimatedTime?: string;
  promptIds?: string[];
}

/**
 * 创建新 Collection（admin only）
 * @param data - Collection 数据
 * @param createdBy - 创建者用户 ID
 * @returns 创建后的精简信息
 */
export async function createCollection(data: CreateCollectionInput, createdBy: string) {
  const collection = await prisma.collection.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      icon: data.icon ?? null,
      gradientFrom: data.gradientFrom ?? null,
      gradientTo: data.gradientTo ?? null,
      tags: data.tags ?? [],
      difficulty: data.difficulty ?? null,
      estimatedTime: data.estimatedTime ?? null,
      createdBy,
    },
    select: { id: true, title: true, createdAt: true },
  });

  // 关联 Prompt（如果提供了 promptIds）
  if (data.promptIds && data.promptIds.length > 0) {
    await prisma.collectionPrompt.createMany({
      data: data.promptIds.map((promptId, index) => ({
        collectionId: collection.id,
        promptId,
        position: index,
      })),
      skipDuplicates: true,
    });
  }

  log.info({ collectionId: collection.id, createdBy }, 'Collection created');
  return collection;
}

// ── P3.08: update — 更新 ──────────────────────────────

export interface UpdateCollectionInput {
  title?: string;
  description?: string;
  icon?: string;
  gradientFrom?: string;
  gradientTo?: string;
  tags?: string[];
  difficulty?: string;
  estimatedTime?: string;
}

/**
 * 更新 Collection 元数据（admin only）
 * @param id - Collection UUID
 * @param data - 更新字段
 * @returns 更新后的精简信息
 * @throws RESOURCE_NOT_FOUND
 */
export async function updateCollection(id: string, data: UpdateCollectionInput) {
  const existing = await prisma.collection.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new AppError('RESOURCE_NOT_FOUND', 'Collection not found');
  }

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.icon !== undefined) updateData.icon = data.icon;
  if (data.gradientFrom !== undefined) updateData.gradientFrom = data.gradientFrom;
  if (data.gradientTo !== undefined) updateData.gradientTo = data.gradientTo;
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
  if (data.estimatedTime !== undefined) updateData.estimatedTime = data.estimatedTime;

  const collection = await prisma.collection.update({
    where: { id },
    data: updateData,
    select: { id: true, title: true, createdAt: true },
  });

  log.info({ collectionId: id }, 'Collection updated');
  return collection;
}

// ── P3.08: delete — 删除 ──────────────────────────────

/**
 * 删除 Collection（硬删除，admin only）
 * @param id - Collection UUID
 * @throws RESOURCE_NOT_FOUND
 */
export async function deleteCollection(id: string) {
  const existing = await prisma.collection.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new AppError('RESOURCE_NOT_FOUND', 'Collection not found');
  }

  await prisma.collection.delete({ where: { id } });
  log.info({ collectionId: id }, 'Collection deleted');
}

// ── P3.08: addPrompts / removePrompts — Prompt 关联管理 ─

/**
 * 向 Collection 添加 Prompt
 * @param collectionId - Collection UUID
 * @param promptIds - 要添加的 Prompt UUID 列表
 * @returns 添加后的 Prompt 数量
 */
export async function addPromptsToCollection(collectionId: string, promptIds: string[]) {
  const existing = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError('RESOURCE_NOT_FOUND', 'Collection not found');
  }

  // 获取当前最大 position
  const maxPos = await prisma.collectionPrompt.aggregate({
    where: { collectionId },
    _max: { position: true },
  });
  const startOrder = (maxPos._max?.position ?? -1) + 1;

  await prisma.collectionPrompt.createMany({
    data: promptIds.map((promptId, index) => ({
      collectionId,
      promptId,
      position: startOrder + index,
    })),
    skipDuplicates: true,
  });

  const count = await prisma.collectionPrompt.count({ where: { collectionId } });
  log.info({ collectionId, addedCount: promptIds.length }, 'Prompts added to collection');
  return { promptCount: count };
}

/**
 * 从 Collection 移除 Prompt
 * @param collectionId - Collection UUID
 * @param promptIds - 要移除的 Prompt UUID 列表
 * @returns 移除后的 Prompt 数量
 */
export async function removePromptsFromCollection(collectionId: string, promptIds: string[]) {
  const existing = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError('RESOURCE_NOT_FOUND', 'Collection not found');
  }

  await prisma.collectionPrompt.deleteMany({
    where: {
      collectionId,
      promptId: { in: promptIds },
    },
  });

  const count = await prisma.collectionPrompt.count({ where: { collectionId } });
  log.info({ collectionId, removedCount: promptIds.length }, 'Prompts removed from collection');
  return { promptCount: count };
}
