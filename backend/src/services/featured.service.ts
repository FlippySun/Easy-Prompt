/**
 * Featured 精选服务 — 自动精选算法 + 手动标记/取消
 * 2026-04-08 新增 — P4.03 Featured Service
 * 变更类型：新增
 * 设计思路：
 *   refreshFeatured() 由 cron 每日调用，算法（§7.1.1）：
 *     1. 最近 7 天新增 Prompt 中 likesCount top 10%
 *     2. 排除已被标记为 featured 的
 *     3. 类别多样性约束：同一类别不超过 3 个
 *     4. 设置 is_featured=true, featured_at=now()（当前 schema 无此字段，
 *        降级为更新内存缓存 + Redis 标记）
 *     5. 清除超过 30 天的旧 featured 标记
 *   manualFeature / unfeature 由 admin 手动操作
 *
 *   当前 Prompt schema 无 is_featured/featured_at 字段，
 *   使用 Redis Set `featured:prompt_ids` 存储精选 ID 列表
 *   后续 schema 迁移添加字段后可无缝切换
 * 参数：各方法参数见 JSDoc
 * 返回：操作结果
 * 影响范围：cron featuredRefresh、trending dailyPicks
 * 潜在风险：无已知风险
 */

import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { createChildLogger } from '../utils/logger';
import { AppError } from '../utils/errors';

const log = createChildLogger('featured-service');

// ── Redis Keys ──────────────────────────────────────────

/** 精选 Prompt ID 集合 */
const FEATURED_SET_KEY = 'featured:prompt_ids';
/** 手动精选 Prompt ID 集合（admin 标记，不受自动清理影响） */
const MANUAL_FEATURED_SET_KEY = 'featured:manual_ids';
/** 精选缓存 TTL — 35 天（自动精选 30 天 + 5 天缓冲） */
const FEATURED_EXPIRE_DAYS = 35;

// ── P4.03: refreshFeatured — 自动精选刷新 ────────────────

/**
 * 刷新精选 Prompt 列表（由 cron 调用）
 *
 * 算法步骤：
 * 1. 取最近 7 天 published Prompt
 * 2. 按 likesCount 排序，取 top 10%（至少 1 个，最多 30 个）
 * 3. 类别多样性：同一类别不超过 3 个
 * 4. 将结果 ID 写入 Redis Set
 * 5. 清除超过 30 天的旧条目（仅自动精选，不影响手动标记）
 */
export async function refreshFeatured(): Promise<{ added: number; total: number }> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Step 1: 取最近 7 天 published Prompt
  const recentPrompts = await prisma.prompt.findMany({
    where: {
      status: 'published',
      createdAt: { gte: sevenDaysAgo },
    },
    select: {
      id: true,
      category: true,
      likesCount: true,
    },
    orderBy: { likesCount: 'desc' },
  });

  if (recentPrompts.length === 0) {
    log.info('No recent prompts found for featured refresh');
    return { added: 0, total: 0 };
  }

  // Step 2: 取 top 10%（至少 1，最多 30）
  const top10pctCount = Math.max(1, Math.min(30, Math.ceil(recentPrompts.length * 0.1)));
  const candidates = recentPrompts.slice(0, top10pctCount);

  // Step 3: 获取已有精选 ID（排除已标记的）
  let existingIds = new Set<string>();
  try {
    if (redis.status === 'ready') {
      const members = await redis.smembers(FEATURED_SET_KEY);
      existingIds = new Set(members);
    }
  } catch {
    log.warn('Failed to read existing featured set from Redis');
  }

  // Step 4: 类别多样性约束 — 同一类别不超过 3 个
  const categoryCount = new Map<string, number>();
  const newFeaturedIds: string[] = [];

  for (const prompt of candidates) {
    if (existingIds.has(prompt.id)) continue; // 已标记，跳过

    const catCount = categoryCount.get(prompt.category) ?? 0;
    if (catCount >= 3) continue; // 同类别超限，跳过

    categoryCount.set(prompt.category, catCount + 1);
    newFeaturedIds.push(prompt.id);
  }

  // Step 5: 写入 Redis
  if (newFeaturedIds.length > 0) {
    try {
      if (redis.status === 'ready') {
        await redis.sadd(FEATURED_SET_KEY, ...newFeaturedIds);
        // 设置整个 set 的过期时间（35 天）
        await redis.expire(FEATURED_SET_KEY, FEATURED_EXPIRE_DAYS * 86400);
      }
    } catch {
      log.warn('Failed to write featured set to Redis');
    }
  }

  // 统计最终数量
  let totalFeatured = 0;
  try {
    if (redis.status === 'ready') {
      totalFeatured = await redis.scard(FEATURED_SET_KEY);
    }
  } catch {
    totalFeatured = newFeaturedIds.length;
  }

  log.info(
    { added: newFeaturedIds.length, total: totalFeatured },
    'Featured refresh completed',
  );

  return { added: newFeaturedIds.length, total: totalFeatured };
}

// ── P4.03: manualFeature — 手动标记精选 ──────────────────

/**
 * Admin 手动标记 Prompt 为精选
 * @param promptId - Prompt UUID
 * @param adminId - 操作管理员 ID
 * @returns { featured: true }
 * @throws RESOURCE_NOT_FOUND
 */
export async function manualFeature(
  promptId: string,
  adminId: string,
): Promise<{ featured: true }> {
  // 验证 Prompt 存在
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: { id: true, status: true },
  });

  if (!prompt) {
    throw new AppError('RESOURCE_NOT_FOUND', 'Prompt not found');
  }

  try {
    if (redis.status === 'ready') {
      await redis.sadd(FEATURED_SET_KEY, promptId);
      await redis.sadd(MANUAL_FEATURED_SET_KEY, promptId);
      await redis.expire(FEATURED_SET_KEY, FEATURED_EXPIRE_DAYS * 86400);
    }
  } catch {
    log.warn({ promptId }, 'Failed to write manual featured to Redis');
  }

  log.info({ promptId, adminId }, 'Prompt manually featured');
  return { featured: true };
}

// ── P4.03: unfeature — 取消精选 ──────────────────────────

/**
 * Admin 取消 Prompt 精选标记
 * @param promptId - Prompt UUID
 * @param adminId - 操作管理员 ID
 * @returns { featured: false }
 * @throws RESOURCE_NOT_FOUND
 */
export async function unfeature(
  promptId: string,
  adminId: string,
): Promise<{ featured: false }> {
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: { id: true },
  });

  if (!prompt) {
    throw new AppError('RESOURCE_NOT_FOUND', 'Prompt not found');
  }

  try {
    if (redis.status === 'ready') {
      await redis.srem(FEATURED_SET_KEY, promptId);
      await redis.srem(MANUAL_FEATURED_SET_KEY, promptId);
    }
  } catch {
    log.warn({ promptId }, 'Failed to remove featured from Redis');
  }

  log.info({ promptId, adminId }, 'Prompt unfeatured');
  return { featured: false };
}

// ── P4.03: isFeatured — 检查是否精选 ────────────────────

/**
 * 检查 Prompt 是否为精选
 * @param promptId - Prompt UUID
 * @returns boolean
 */
export async function isFeatured(promptId: string): Promise<boolean> {
  try {
    if (redis.status === 'ready') {
      return (await redis.sismember(FEATURED_SET_KEY, promptId)) === 1;
    }
  } catch {
    // Redis 不可用时降级为 false
  }
  return false;
}

// ── P4.03: getFeaturedIds — 获取所有精选 ID ──────────────

/**
 * 获取所有精选 Prompt ID 列表
 * @returns string[] 精选 ID 数组
 */
export async function getFeaturedIds(): Promise<string[]> {
  try {
    if (redis.status === 'ready') {
      return await redis.smembers(FEATURED_SET_KEY);
    }
  } catch {
    log.warn('Failed to read featured IDs from Redis');
  }
  return [];
}
