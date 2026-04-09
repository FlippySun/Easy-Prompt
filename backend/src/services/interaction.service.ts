/**
 * 用户交互服务 — Like/Save/Copy/View + Collection Save
 * 2026-04-08 新增 — P3.04 Interaction Service
 * 设计思路：所有用户交互操作（点赞/收藏/复制/浏览）集中管理
 *   Like/Save 为 toggle 语义（已操作→取消，未操作→执行）
 *   Copy 为累加语义（允许多次）
 *   View 有 24h 去重逻辑（同一用户对同一 Prompt）
 *   所有计数更新使用 Prisma 原子 increment/decrement 避免竞态
 * 参数：userId, promptId/collectionId
 * 返回：操作后的状态和计数
 * 影响范围：prompt 交互路由、用户统计
 * 潜在风险：高并发场景下 increment/decrement 需依赖 DB 原子性（Prisma 已保障）
 */

import { prisma } from '../lib/prisma';
import { AppError } from '../utils/errors';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('interaction-service');

// ── 24h 去重窗口（毫秒）──────────────────────────────
const VIEW_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

// ── 辅助：确认 Prompt 存在 ──────────────────────────────
async function ensurePromptExists(promptId: string): Promise<void> {
  const exists = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: { id: true },
  });
  if (!exists) {
    throw new AppError('RESOURCE_NOT_FOUND', 'Prompt not found');
  }
}

// ── Like（toggle）──────────────────────────────────────

export interface LikeResult {
  liked: boolean;
  likesCount: number;
}

/**
 * 切换点赞状态（已赞→取消，未赞→点赞）
 * @param userId - 当前用户 ID
 * @param promptId - 目标 Prompt ID
 * @returns { liked, likesCount } 操作后状态
 *
 * 原子操作：使用 Prisma $transaction 确保 user_likes 写入和 prompts.likes_count 更新一致
 */
export async function toggleLike(userId: string, promptId: string): Promise<LikeResult> {
  await ensurePromptExists(promptId);

  const existing = await prisma.userLike.findUnique({
    where: { userId_promptId: { userId, promptId } },
  });

  if (existing) {
    // 取消点赞
    await prisma.$transaction([
      prisma.userLike.delete({
        where: { userId_promptId: { userId, promptId } },
      }),
      prisma.prompt.update({
        where: { id: promptId },
        data: { likesCount: { decrement: 1 } },
      }),
    ]);

    const updated = await prisma.prompt.findUnique({
      where: { id: promptId },
      select: { likesCount: true },
    });

    log.debug({ userId, promptId, action: 'unlike' }, 'Like toggled');
    return { liked: false, likesCount: updated?.likesCount ?? 0 };
  } else {
    // 点赞
    await prisma.$transaction([
      prisma.userLike.create({
        data: { userId, promptId },
      }),
      prisma.prompt.update({
        where: { id: promptId },
        data: { likesCount: { increment: 1 } },
      }),
    ]);

    const updated = await prisma.prompt.findUnique({
      where: { id: promptId },
      select: { likesCount: true },
    });

    log.debug({ userId, promptId, action: 'like' }, 'Like toggled');
    return { liked: true, likesCount: updated?.likesCount ?? 0 };
  }
}

// ── Save（toggle）──────────────────────────────────────

export interface SaveResult {
  saved: boolean;
  savesCount: number;
}

/**
 * 切换收藏状态（已收藏→取消，未收藏→收藏）
 * @param userId - 当前用户 ID
 * @param promptId - 目标 Prompt ID
 * @returns { saved, savesCount } — savesCount 使用 UserSave 表 count 计算
 *
 * 注意：Prompt schema 无 saves_count 列，使用关联 count 查询
 */
export async function toggleSave(userId: string, promptId: string): Promise<SaveResult> {
  await ensurePromptExists(promptId);

  const existing = await prisma.userSave.findUnique({
    where: { userId_promptId: { userId, promptId } },
  });

  if (existing) {
    await prisma.userSave.delete({
      where: { userId_promptId: { userId, promptId } },
    });
    log.debug({ userId, promptId, action: 'unsave' }, 'Save toggled');
  } else {
    await prisma.userSave.create({
      data: { userId, promptId },
    });
    log.debug({ userId, promptId, action: 'save' }, 'Save toggled');
  }

  const savesCount = await prisma.userSave.count({ where: { promptId } });
  return { saved: !existing, savesCount };
}

// ── Copy（累加）──────────────────────────────────────

export interface CopyResult {
  copiesCount: number;
}

/**
 * 记录复制操作（允许多次，累加计数）
 * @param userId - 当前用户 ID
 * @param promptId - 目标 Prompt ID
 * @returns { copiesCount } 该 Prompt 的总复制次数
 *
 * 实现：upsert user_copies（count++）+ 原子 increment prompts.copies_count
 */
export async function recordCopy(userId: string, promptId: string): Promise<CopyResult> {
  await ensurePromptExists(promptId);

  await prisma.$transaction([
    prisma.userCopy.upsert({
      where: { userId_promptId: { userId, promptId } },
      create: { userId, promptId, count: 1 },
      update: { count: { increment: 1 }, lastCopiedAt: new Date() },
    }),
    prisma.prompt.update({
      where: { id: promptId },
      data: { copiesCount: { increment: 1 } },
    }),
  ]);

  const updated = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: { copiesCount: true },
  });

  log.debug({ userId, promptId }, 'Copy recorded');
  return { copiesCount: updated?.copiesCount ?? 0 };
}

// ── View（去重）──────────────────────────────────────

/**
 * 记录浏览操作（24h 去重：同一用户对同一 Prompt 24h 内只计一次 view_count）
 * @param promptId - 目标 Prompt ID
 * @param userId - 当前用户 ID（可选，匿名用户不记录 user_views 但仍更新 view_count）
 *
 * 去重逻辑：
 * - 有 userId：检查 user_views 表最近浏览时间，24h 内不重复计数
 * - 无 userId（匿名）：直接累加 view_count（无精确去重，接受误差）
 */
export async function recordView(promptId: string, userId?: string): Promise<void> {
  await ensurePromptExists(promptId);

  if (userId) {
    const existing = await prisma.userView.findUnique({
      where: { userId_promptId: { userId, promptId } },
    });

    const now = new Date();
    const shouldCount =
      !existing || now.getTime() - existing.lastViewedAt.getTime() > VIEW_DEDUP_WINDOW_MS;

    if (shouldCount) {
      await prisma.$transaction([
        prisma.userView.upsert({
          where: { userId_promptId: { userId, promptId } },
          create: { userId, promptId, count: 1 },
          update: { count: { increment: 1 }, lastViewedAt: now },
        }),
        prisma.prompt.update({
          where: { id: promptId },
          data: { viewsCount: { increment: 1 } },
        }),
      ]);
      log.debug({ userId, promptId, deduplicated: false }, 'View recorded');
    } else {
      // 24h 内重复浏览，更新 user_views 时间戳但不增加 view_count
      await prisma.userView.update({
        where: { userId_promptId: { userId, promptId } },
        data: { lastViewedAt: now },
      });
      log.debug({ userId, promptId, deduplicated: true }, 'View deduplicated');
    }
  } else {
    // 匿名用户：直接累加
    await prisma.prompt.update({
      where: { id: promptId },
      data: { viewsCount: { increment: 1 } },
    });
    log.debug({ promptId, anonymous: true }, 'Anonymous view recorded');
  }
}

// ── Collection Save（toggle）──────────────────────────

export interface CollectionSaveResult {
  saved: boolean;
  savedCount: number;
}

/**
 * 切换合集收藏状态
 * @param userId - 当前用户 ID
 * @param collectionId - 目标 Collection ID
 * @returns { saved, savedCount }
 */
export async function toggleCollectionSave(
  userId: string,
  collectionId: string,
): Promise<CollectionSaveResult> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { id: true },
  });
  if (!collection) {
    throw new AppError('RESOURCE_NOT_FOUND', 'Collection not found');
  }

  const existing = await prisma.userCollectionSave.findUnique({
    where: { userId_collectionId: { userId, collectionId } },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.userCollectionSave.delete({
        where: { userId_collectionId: { userId, collectionId } },
      }),
      prisma.collection.update({
        where: { id: collectionId },
        data: { savedCount: { decrement: 1 } },
      }),
    ]);
    log.debug({ userId, collectionId, action: 'unsave' }, 'Collection save toggled');
  } else {
    await prisma.$transaction([
      prisma.userCollectionSave.create({
        data: { userId, collectionId },
      }),
      prisma.collection.update({
        where: { id: collectionId },
        data: { savedCount: { increment: 1 } },
      }),
    ]);
    log.debug({ userId, collectionId, action: 'save' }, 'Collection save toggled');
  }

  const updated = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { savedCount: true },
  });

  return { saved: !existing, savedCount: updated?.savedCount ?? 0 };
}
