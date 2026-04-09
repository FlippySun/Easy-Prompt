/**
 * User 服务 — 公开资料、我的收藏/点赞/Prompt、资料更新
 * 2026-04-08 新增 — P3.10 User Service
 * 设计思路：用户维度的数据聚合服务
 *   公开资料（他人可见）仅包含非敏感字段
 *   "我的"系列接口返回当前登录用户的交互数据（分页）
 *   资料更新仅允许修改 displayName/bio/avatarUrl
 * 参数：userId, query（分页）
 * 返回：UserPublicProfile / PaginatedResponse
 * 影响范围：user 路由
 * 潜在风险：无已知风险
 */

import { prisma } from '../lib/prisma';
import { AppError } from '../utils/errors';
import { createChildLogger } from '../utils/logger';
import { parsePagination, buildPaginatedResponse } from '../utils/pagination';
import type { PaginatedResponse } from '../types/common';
import type { UserPublicProfile } from '../types/user';
import type { PromptSummary } from '../types/prompt';

const log = createChildLogger('user-service');

// ── author select 子句（复用）──────────────────────────
const authorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

// ── P3.10: 公开资料 ──────────────────────────────────

/**
 * 获取用户公开资料（他人可见）
 * @param userId - 目标用户 ID
 * @returns UserPublicProfile
 * @throws RESOURCE_NOT_FOUND
 */
export async function getUserPublicProfile(userId: string): Promise<UserPublicProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      createdAt: true,
      _count: {
        select: {
          prompts: { where: { status: 'published' } },
        },
      },
    },
  });

  if (!user) {
    throw new AppError('RESOURCE_NOT_FOUND', 'User not found');
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    promptCount: user._count.prompts,
    joinedAt: user.createdAt.toISOString(),
  };
}

// ── P3.10: 更新资料 ──────────────────────────────────

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}

/**
 * 更新当前用户资料（仅允许 displayName/bio/avatarUrl）
 * @param userId - 当前用户 ID
 * @param data - 更新字段
 * @returns 更新后的精简信息
 */
export async function updateUserProfile(userId: string, data: UpdateProfileInput) {
  const updateData: Record<string, unknown> = {};
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.bio !== undefined) updateData.bio = data.bio;
  if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
    },
  });

  log.info({ userId }, 'User profile updated');
  return user;
}

// ── P3.10: 我的 Prompt（分页）──────────────────────────

/**
 * 获取当前用户创建的 Prompt 列表（含所有状态）
 * @param userId - 当前用户 ID
 * @param query - 分页参数
 * @returns PaginatedResponse<PromptSummary>
 */
export async function getMyPrompts(
  userId: string,
  query: Record<string, unknown>,
): Promise<PaginatedResponse<PromptSummary>> {
  const { page, pageSize, skip, take } = parsePagination(query);

  const where = { authorId: userId };

  const [rows, total] = await Promise.all([
    prisma.prompt.findMany({
      where,
      select: {
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
        status: true,
        author: { select: authorSelect },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.prompt.count({ where }),
  ]);

  const data: PromptSummary[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    tags: r.tags,
    category: r.category,
    model: r.model,
    author: r.author ?? { id: '', username: 'anonymous', displayName: null, avatarUrl: null },
    likesCount: r.likesCount,
    viewsCount: r.viewsCount,
    copiesCount: r.copiesCount,
    createdAt: r.createdAt.toISOString(),
  }));

  return buildPaginatedResponse(data, total, page, pageSize);
}

// ── P3.10: 我的收藏 Prompt（分页）──────────────────────

/**
 * 获取当前用户收藏的 Prompt 列表
 * @param userId - 当前用户 ID
 * @param query - 分页参数
 * @returns PaginatedResponse<PromptSummary>
 */
export async function getMySavedPrompts(
  userId: string,
  query: Record<string, unknown>,
): Promise<PaginatedResponse<PromptSummary>> {
  const { page, pageSize, skip, take } = parsePagination(query);

  const [rows, total] = await Promise.all([
    prisma.userSave.findMany({
      where: { userId },
      include: {
        prompt: {
          select: {
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.userSave.count({ where: { userId } }),
  ]);

  const data: PromptSummary[] = rows.map((r) => ({
    id: r.prompt.id,
    title: r.prompt.title,
    description: r.prompt.description,
    tags: r.prompt.tags,
    category: r.prompt.category,
    model: r.prompt.model,
    author: r.prompt.author ?? {
      id: '',
      username: 'anonymous',
      displayName: null,
      avatarUrl: null,
    },
    likesCount: r.prompt.likesCount,
    viewsCount: r.prompt.viewsCount,
    copiesCount: r.prompt.copiesCount,
    createdAt: r.prompt.createdAt.toISOString(),
  }));

  return buildPaginatedResponse(data, total, page, pageSize);
}

// ── P3.10: 我的点赞 Prompt（分页）──────────────────────

/**
 * 获取当前用户点赞的 Prompt 列表
 * @param userId - 当前用户 ID
 * @param query - 分页参数
 * @returns PaginatedResponse<PromptSummary>
 */
export async function getMyLikedPrompts(
  userId: string,
  query: Record<string, unknown>,
): Promise<PaginatedResponse<PromptSummary>> {
  const { page, pageSize, skip, take } = parsePagination(query);

  const [rows, total] = await Promise.all([
    prisma.userLike.findMany({
      where: { userId },
      include: {
        prompt: {
          select: {
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.userLike.count({ where: { userId } }),
  ]);

  const data: PromptSummary[] = rows.map((r) => ({
    id: r.prompt.id,
    title: r.prompt.title,
    description: r.prompt.description,
    tags: r.prompt.tags,
    category: r.prompt.category,
    model: r.prompt.model,
    author: r.prompt.author ?? {
      id: '',
      username: 'anonymous',
      displayName: null,
      avatarUrl: null,
    },
    likesCount: r.prompt.likesCount,
    viewsCount: r.prompt.viewsCount,
    copiesCount: r.prompt.copiesCount,
    createdAt: r.prompt.createdAt.toISOString(),
  }));

  return buildPaginatedResponse(data, total, page, pageSize);
}

// ── P3.10: 我的收藏 Collection（分页）──────────────────

export interface SavedCollectionItem {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  tags: string[];
  savedCount: number;
  savedAt: string;
}

/**
 * 获取当前用户收藏的 Collection 列表
 * @param userId - 当前用户 ID
 * @param query - 分页参数
 * @returns PaginatedResponse<SavedCollectionItem>
 */
export async function getMySavedCollections(
  userId: string,
  query: Record<string, unknown>,
): Promise<PaginatedResponse<SavedCollectionItem>> {
  const { page, pageSize, skip, take } = parsePagination(query);

  const [rows, total] = await Promise.all([
    prisma.userCollectionSave.findMany({
      where: { userId },
      include: {
        collection: {
          select: {
            id: true,
            title: true,
            description: true,
            icon: true,
            tags: true,
            savedCount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.userCollectionSave.count({ where: { userId } }),
  ]);

  const data: SavedCollectionItem[] = rows.map((r) => ({
    id: r.collection.id,
    title: r.collection.title,
    description: r.collection.description,
    icon: r.collection.icon,
    tags: r.collection.tags,
    savedCount: r.collection.savedCount,
    savedAt: r.createdAt.toISOString(),
  }));

  return buildPaginatedResponse(data, total, page, pageSize);
}

// ═══════════════════════════════════════════════════════
// P4.07 — 用户 Profile 增强
// ═══════════════════════════════════════════════════════

// ── P4.07: 增强版公开 Profile ────────────────────────────

export interface EnhancedPublicProfile extends UserPublicProfile {
  /** 用户创建的 Collection 数量 */
  collectionCount: number;
  /** 用户获得的成就数量 */
  achievementCount: number;
  /** 用户所有 published Prompt 的累计点赞/浏览/复制 */
  totalLikes: number;
  totalViews: number;
  totalCopies: number;
}

/**
 * 获取增强版用户公开资料
 * 2026-04-08 P4.07 新增
 * @param userId - 目标用户 ID
 * @returns EnhancedPublicProfile
 * @throws RESOURCE_NOT_FOUND
 *
 * 设计说明：
 *   在基础 profile 上追加统计数据和成就信息
 *   所有数据仅展示用户主动公开的内容（published Prompt）
 */
export async function getEnhancedPublicProfile(userId: string): Promise<EnhancedPublicProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      createdAt: true,
      _count: {
        select: {
          prompts: { where: { status: 'published' } },
          achievements: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError('RESOURCE_NOT_FOUND', 'User not found');
  }

  // Collection 没有 User 反向关系，用 createdBy 单独查询
  const [stats, collectionCount] = await Promise.all([
    prisma.prompt.aggregate({
      where: { authorId: userId, status: 'published' },
      _sum: {
        likesCount: true,
        viewsCount: true,
        copiesCount: true,
      },
    }),
    prisma.collection.count({ where: { createdBy: userId } }),
  ]);

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    promptCount: user._count.prompts,
    joinedAt: user.createdAt.toISOString(),
    collectionCount,
    achievementCount: user._count.achievements,
    totalLikes: stats._sum.likesCount ?? 0,
    totalViews: stats._sum.viewsCount ?? 0,
    totalCopies: stats._sum.copiesCount ?? 0,
  };
}

// ── P4.07: 用户成就展示 ──────────────────────────────────

export interface UserAchievementItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  rarity: string;
  unlockedAt: string;
}

/**
 * 获取用户已解锁的成就列表
 * 2026-04-08 P4.07 新增
 * @param userId - 目标用户 ID
 * @returns UserAchievementItem[]
 */
export async function getUserAchievements(userId: string): Promise<UserAchievementItem[]> {
  const rows = await prisma.userAchievement.findMany({
    where: { userId },
    include: {
      achievement: {
        select: {
          id: true,
          title: true,
          description: true,
          icon: true,
          color: true,
          rarity: true,
        },
      },
    },
    orderBy: { unlockedAt: 'desc' },
  });

  return rows.map((r) => ({
    id: r.achievement.id,
    title: r.achievement.title,
    description: r.achievement.description ?? '',
    icon: r.achievement.icon ?? '',
    color: r.achievement.color ?? '',
    rarity: r.achievement.rarity ?? 'common',
    unlockedAt: r.unlockedAt.toISOString(),
  }));
}

// ── P4.07: 活跃度热力图（最近 30 天）────────────────────

export interface ActivityDay {
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 当天活动次数（创建 Prompt + 点赞 + 复制 + 收藏） */
  count: number;
}

/**
 * 获取用户最近 30 天的活动热力图数据
 * 2026-04-08 P4.07 新增
 * @param userId - 目标用户 ID
 * @returns ActivityDay[] 30 天数据（含 0 值天）
 *
 * 数据来源：
 *   - Prompt createdAt（创建 Prompt）
 *   - UserLike createdAt（点赞）
 *   - UserCopy createdAt（复制）
 *   - UserSave createdAt（收藏）
 *
 * 隐私保护：仅统计活动次数，不暴露具体内容
 */
export async function getUserActivityHeatmap(userId: string): Promise<ActivityDay[]> {
  // 2026-04-08 修复 — 统一使用 UTC 方法，避免本地时区偏移导致日期字符串不一致
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
  thirtyDaysAgo.setUTCHours(0, 0, 0, 0);

  // 并行查询四种活动的时间戳
  const [prompts, likes, copies, saves] = await Promise.all([
    prisma.prompt.findMany({
      where: { authorId: userId, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.userLike.findMany({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.userCopy.findMany({
      where: { userId, lastCopiedAt: { gte: thirtyDaysAgo } },
      select: { lastCopiedAt: true },
    }),
    prisma.userSave.findMany({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
  ]);

  // 合并所有活动到日期计数 Map
  const countMap = new Map<string, number>();

  const addToMap = (items: { createdAt: Date }[]) => {
    for (const item of items) {
      const dateStr = item.createdAt.toISOString().slice(0, 10);
      countMap.set(dateStr, (countMap.get(dateStr) ?? 0) + 1);
    }
  };

  addToMap(prompts);
  addToMap(likes);
  // UserCopy uses lastCopiedAt instead of createdAt
  for (const item of copies) {
    const dateStr = item.lastCopiedAt.toISOString().slice(0, 10);
    countMap.set(dateStr, (countMap.get(dateStr) ?? 0) + 1);
  }
  addToMap(saves);

  // 生成完整 30 天数据（含 0 值天）
  const result: ActivityDay[] = [];
  const current = new Date(thirtyDaysAgo);
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);

  while (current <= today) {
    const dateStr = current.toISOString().slice(0, 10);
    result.push({
      date: dateStr,
      count: countMap.get(dateStr) ?? 0,
    });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
}
