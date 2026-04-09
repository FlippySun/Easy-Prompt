/**
 * 成就服务 — 列表、用户解锁状态、条件检测与解锁
 * 2026-04-08 新增 — P3.06 Achievement Service
 * 设计思路：成就系统分为"定义层"（achievements 表）和"解锁层"（user_achievements 表）
 *   列表接口返回所有成就 + 当前用户的解锁状态
 *   条件检测采用可扩展的策略模式：根据 condition_type 匹配对应检测函数
 *   解锁操作为幂等（已解锁不重复写入）
 * 参数：userId
 * 返回：UserAchievementStatus[]、解锁结果
 * 影响范围：achievement 路由、交互后触发检测
 * 潜在风险：高并发场景下同一成就可能并发触发，依赖 unique 约束保证幂等
 */

import { prisma } from '../lib/prisma';
import { createChildLogger } from '../utils/logger';
import type { UserAchievementStatus, AchievementRarity, AchievementCategory } from '../types/achievement';

const log = createChildLogger('achievement-service');

// ── 获取所有成就 + 用户解锁状态 ────────────────────────

/**
 * 获取全部成就列表，附带当前用户的解锁状态
 * @param userId - 当前用户 ID（可选，匿名用户全部为 unlocked=false）
 * @returns UserAchievementStatus[] 按 rarity 排序（legendary > epic > rare > common）
 */
export async function listAchievements(userId?: string): Promise<UserAchievementStatus[]> {
  const achievements = await prisma.achievement.findMany({
    orderBy: [{ rarity: 'desc' }, { category: 'asc' }],
  });

  if (!userId) {
    return achievements.map((a) => ({
      achievement: {
        id: a.id,
        title: a.title,
        description: a.description,
        icon: a.icon,
        color: a.color,
        rarity: a.rarity as AchievementRarity,
        category: a.category as AchievementCategory,
        conditionType: a.conditionType,
        conditionValue: a.conditionValue,
      },
      unlocked: false,
      unlockedAt: null,
    }));
  }

  // 批量查询用户已解锁的成就
  const unlocked = await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementId: true, unlockedAt: true },
  });

  const unlockedMap = new Map(unlocked.map((u) => [u.achievementId, u.unlockedAt]));

  return achievements.map((a) => {
    const unlockedAt = unlockedMap.get(a.id);
    return {
      achievement: {
        id: a.id,
        title: a.title,
        description: a.description,
        icon: a.icon,
        color: a.color,
        rarity: a.rarity as AchievementRarity,
        category: a.category as AchievementCategory,
        conditionType: a.conditionType,
        conditionValue: a.conditionValue,
      },
      unlocked: !!unlockedAt,
      unlockedAt: unlockedAt ? unlockedAt.toISOString() : null,
    };
  });
}

// ── 获取用户已解锁的成就 ──────────────────────────────

/**
 * 获取指定用户已解锁的成就列表
 * @param userId - 目标用户 ID
 * @returns UserAchievementStatus[]（仅已解锁的）
 */
export async function getUserUnlockedAchievements(userId: string): Promise<UserAchievementStatus[]> {
  const rows = await prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
    orderBy: { unlockedAt: 'desc' },
  });

  return rows.map((r) => ({
    achievement: {
      id: r.achievement.id,
      title: r.achievement.title,
      description: r.achievement.description,
      icon: r.achievement.icon,
      color: r.achievement.color,
      rarity: r.achievement.rarity as AchievementRarity,
      category: r.achievement.category as AchievementCategory,
      conditionType: r.achievement.conditionType,
      conditionValue: r.achievement.conditionValue,
    },
    unlocked: true,
    unlockedAt: r.unlockedAt.toISOString(),
  }));
}

// ── 条件检测与解锁 ────────────────────────────────────

/**
 * 条件检测函数类型
 * @param userId - 用户 ID
 * @param conditionValue - 成就要求的阈值
 * @returns 是否满足条件
 */
type ConditionChecker = (userId: string, conditionValue: number) => Promise<boolean>;

/**
 * 条件检测策略注册表
 * 根据 achievement.condition_type 匹配对应的检测逻辑
 * 可扩展：新增成就类型只需在此处注册新的检测函数
 */
const conditionCheckers: Record<string, ConditionChecker> = {
  // 探索者：访问过 N 个分类
  categories_visited: async (userId, conditionValue) => {
    const count = await prisma.userVisitedCategory.count({ where: { userId } });
    return count >= conditionValue;
  },

  // 收藏家：收藏了 N 个 Prompt
  prompts_saved: async (userId, conditionValue) => {
    const count = await prisma.userSave.count({ where: { userId } });
    return count >= conditionValue;
  },

  // 创作者：发布了 N 个 Prompt
  prompts_created: async (userId, conditionValue) => {
    const count = await prisma.prompt.count({
      where: { authorId: userId, status: 'published' },
    });
    return count >= conditionValue;
  },

  // 社交达人：获得 N 个点赞
  likes_received: async (userId, conditionValue) => {
    const result = await prisma.prompt.aggregate({
      where: { authorId: userId },
      _sum: { likesCount: true },
    });
    return (result._sum.likesCount ?? 0) >= conditionValue;
  },

  // 超级用户：复制了 N 个 Prompt
  prompts_copied: async (userId, conditionValue) => {
    const result = await prisma.userCopy.aggregate({
      where: { userId },
      _sum: { count: true },
    });
    return (result._sum.count ?? 0) >= conditionValue;
  },

  // 点赞达人：点赞了 N 个 Prompt
  prompts_liked: async (userId, conditionValue) => {
    const count = await prisma.userLike.count({ where: { userId } });
    return count >= conditionValue;
  },
};

/**
 * 检测并解锁满足条件的成就
 * @param userId - 用户 ID
 * @returns 新解锁的成就 ID 列表
 *
 * 执行逻辑：
 * 1. 查询所有有条件的成就
 * 2. 排除用户已解锁的
 * 3. 逐一检测条件
 * 4. 满足条件的写入 user_achievements
 *
 * 性能：通常在用户操作后异步调用，不阻塞主请求
 */
export async function checkAndUnlockAchievements(userId: string): Promise<string[]> {
  // 查询所有有条件的成就
  const achievements = await prisma.achievement.findMany({
    where: {
      conditionType: { not: null },
      conditionValue: { not: null },
    },
  });

  if (achievements.length === 0) return [];

  // 查询用户已解锁的
  const unlocked = await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementId: true },
  });
  const unlockedIds = new Set(unlocked.map((u) => u.achievementId));

  // 过滤未解锁的
  const pending = achievements.filter((a) => !unlockedIds.has(a.id));
  if (pending.length === 0) return [];

  const newlyUnlocked: string[] = [];

  for (const achievement of pending) {
    const checker = conditionCheckers[achievement.conditionType!];
    if (!checker) {
      log.warn({ conditionType: achievement.conditionType }, 'Unknown condition type');
      continue;
    }

    try {
      const met = await checker(userId, achievement.conditionValue!);
      if (met) {
        // 幂等写入（unique 约束保护）
        await prisma.userAchievement.create({
          data: { userId, achievementId: achievement.id },
        }).catch((err: Error & { code?: string }) => {
          // P2002 = unique constraint violation，说明已解锁（并发场景）
          if ((err as { code?: string }).code === 'P2002') {
            log.debug({ userId, achievementId: achievement.id }, 'Achievement already unlocked (concurrent)');
          } else {
            throw err;
          }
        });
        newlyUnlocked.push(achievement.id);
        log.info({ userId, achievementId: achievement.id, title: achievement.title }, 'Achievement unlocked');
      }
    } catch (err) {
      log.error({ err, userId, achievementId: achievement.id }, 'Failed to check achievement condition');
    }
  }

  return newlyUnlocked;
}
