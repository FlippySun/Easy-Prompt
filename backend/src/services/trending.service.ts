/**
 * Trending 服务 — 热门 Prompt 排行、分类趋势、每日精选
 * 2026-04-08 新增 — P4.01 Trending Service
 * 变更类型：新增
 * 设计思路：
 *   1. trendingPrompts — 基于加权评分 + 时间衰减的热门排行
 *      score = like_count * 3 + copy_count * 2 + view_count * 1
 *      decay_factor = 1 / (1 + daysSinceCreation * 0.1)
 *   2. trendingCategories — 各分类交互量聚合统计
 *   3. dailyPicks — 每日精选（featured + 高分 Prompt）
 *   所有结果缓存到 Redis（day=5min, week=30min, month=1h）
 * 参数：period (day/week/month), limit
 * 返回：排行数据数组
 * 影响范围：trending 路由、cron featuredRefresh
 * 潜在风险：排名算法需调优，大数据量下聚合查询性能需关注
 */

import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { createChildLogger } from '../utils/logger';
import type { PromptSummary } from '../types/prompt';

const log = createChildLogger('trending-service');

// ── 类型定义 ──────────────────────────────────────────

export type TrendingPeriod = 'day' | 'week' | 'month';

export interface CategoryTrending {
  category: string;
  promptCount: number;
  totalLikes: number;
  totalViews: number;
  totalCopies: number;
  /** 相比上一周期的增长量（likes 维度） */
  growth: number;
}

// ── 缓存 TTL 配置（秒）──────────────────────────────────

const CACHE_TTL: Record<TrendingPeriod, number> = {
  day: 5 * 60, // 5 分钟
  week: 30 * 60, // 30 分钟
  month: 60 * 60, // 1 小时
};

// ── 周期 → 天数映射 ──────────────────────────────────────

const PERIOD_DAYS: Record<TrendingPeriod, number> = {
  day: 1,
  week: 7,
  month: 30,
};

// ── author select 子句（列表复用）────────────────────────

const authorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

// ── Redis 缓存辅助 ──────────────────────────────────────

/**
 * 尝试从 Redis 获取缓存，失败时静默降级
 * @param key Redis key
 * @returns 缓存值或 null
 */
async function getCache<T>(key: string): Promise<T | null> {
  try {
    if (redis.status !== 'ready') return null;
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    log.warn({ key }, 'Redis cache get failed, degrading');
    return null;
  }
}

/**
 * 写入 Redis 缓存，失败时静默降级
 * @param key Redis key
 * @param data 要缓存的数据
 * @param ttlSec TTL 秒数
 */
async function setCache(key: string, data: unknown, ttlSec: number): Promise<void> {
  try {
    if (redis.status !== 'ready') return;
    await redis.set(key, JSON.stringify(data), 'EX', ttlSec);
  } catch {
    log.warn({ key }, 'Redis cache set failed, degrading');
  }
}

// ── P4.01: trendingPrompts — 热门 Prompt 排行 ──────────

/**
 * 获取热门 Prompt 排行（加权评分 + 时间衰减）
 * @param period - 统计周期：day / week / month
 * @param limit - 返回数量（默认 20，最大 50）
 * @returns PromptSummary[] 排序后的热门列表
 *
 * 算法：
 *   rawScore = likesCount * 3 + copiesCount * 2 + viewsCount * 1
 *   daysSince = (now - createdAt) / 86400000
 *   decayFactor = 1 / (1 + daysSince * 0.1)
 *   finalScore = rawScore * decayFactor
 *
 * 仅统计 period 时间窗口内创建的 published Prompt
 */
export async function trendingPrompts(
  period: TrendingPeriod = 'week',
  limit = 20,
): Promise<PromptSummary[]> {
  const safeLimit = Math.min(50, Math.max(1, limit));
  const cacheKey = `trending:prompts:${period}:${safeLimit}`;

  // 尝试读缓存
  const cached = await getCache<PromptSummary[]>(cacheKey);
  if (cached) {
    log.debug({ period, limit: safeLimit, source: 'cache' }, 'Trending prompts cache hit');
    return cached;
  }

  const since = new Date();
  since.setDate(since.getDate() - PERIOD_DAYS[period]);

  // 查询 period 内的 published Prompt，取候选池（3 倍 limit 供排序裁剪）
  const candidateLimit = Math.min(500, safeLimit * 3);
  const rows = await prisma.prompt.findMany({
    where: {
      status: 'published',
      createdAt: { gte: since },
    },
    // 2026-04-09 修复 — 增加 content 字段，对齐 PromptSummary 接口
    select: {
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
    },
    orderBy: { likesCount: 'desc' },
    take: candidateLimit,
  });

  const now = Date.now();

  // 计算加权评分 + 时间衰减
  const scored = rows.map((r) => {
    const rawScore = r.likesCount * 3 + r.copiesCount * 2 + r.viewsCount * 1;
    const daysSince = (now - r.createdAt.getTime()) / 86_400_000;
    const decayFactor = 1 / (1 + daysSince * 0.1);
    return { row: r, score: rawScore * decayFactor };
  });

  // 按 finalScore 降序排列
  scored.sort((a, b) => b.score - a.score);

  const result: PromptSummary[] = scored.slice(0, safeLimit).map(({ row: r }) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    content: r.content,
    tags: r.tags,
    category: r.category,
    model: r.model,
    author: r.author ?? { id: '', username: 'anonymous', displayName: null, avatarUrl: null },
    likesCount: r.likesCount,
    viewsCount: r.viewsCount,
    copiesCount: r.copiesCount,
    createdAt: r.createdAt.toISOString(),
  }));

  // 写缓存
  await setCache(cacheKey, result, CACHE_TTL[period]);
  log.debug(
    { period, limit: safeLimit, count: result.length, source: 'db' },
    'Trending prompts computed',
  );

  return result;
}

// ── P4.01: trendingCategories — 分类趋势 ────────────────

/**
 * 获取分类趋势统计（各分类交互量聚合）
 * @param period - 统计周期
 * @param limit - 返回数量（默认 10，最大 30）
 * @returns CategoryTrending[] 按 totalLikes 降序
 */
export async function trendingCategories(
  period: TrendingPeriod = 'week',
  limit = 10,
): Promise<CategoryTrending[]> {
  const safeLimit = Math.min(30, Math.max(1, limit));
  const cacheKey = `trending:categories:${period}:${safeLimit}`;

  const cached = await getCache<CategoryTrending[]>(cacheKey);
  if (cached) {
    log.debug({ period, source: 'cache' }, 'Trending categories cache hit');
    return cached;
  }

  const since = new Date();
  since.setDate(since.getDate() - PERIOD_DAYS[period]);

  // 上一周期（用于计算 growth）
  const prevSince = new Date();
  prevSince.setDate(prevSince.getDate() - PERIOD_DAYS[period] * 2);

  // 当前周期聚合
  const currentAgg = await prisma.prompt.groupBy({
    by: ['category'],
    where: {
      status: 'published',
      createdAt: { gte: since },
    },
    _count: { id: true },
    _sum: {
      likesCount: true,
      viewsCount: true,
      copiesCount: true,
    },
    orderBy: { _sum: { likesCount: 'desc' } },
    take: safeLimit,
  });

  // 上一周期聚合（同样的分类，用于 growth 计算）
  const prevAgg = await prisma.prompt.groupBy({
    by: ['category'],
    where: {
      status: 'published',
      createdAt: { gte: prevSince, lt: since },
    },
    _sum: { likesCount: true },
  });

  const prevLikesMap = new Map<string, number>();
  for (const p of prevAgg) {
    prevLikesMap.set(p.category, p._sum.likesCount ?? 0);
  }

  const result: CategoryTrending[] = currentAgg.map((c) => {
    const totalLikes = c._sum.likesCount ?? 0;
    const prevLikes = prevLikesMap.get(c.category) ?? 0;
    return {
      category: c.category,
      promptCount: c._count.id,
      totalLikes,
      totalViews: c._sum.viewsCount ?? 0,
      totalCopies: c._sum.copiesCount ?? 0,
      growth: totalLikes - prevLikes,
    };
  });

  await setCache(cacheKey, result, CACHE_TTL[period]);
  log.debug({ period, count: result.length, source: 'db' }, 'Trending categories computed');

  return result;
}

// ── P4.01: dailyPicks — 每日精选 ─────────────────────────

/**
 * 获取每日精选 Prompt
 * @param date - 指定日期（默认今天），格式 YYYY-MM-DD
 * @returns PromptSummary[] 精选列表
 *
 * 策略：
 *   1. 优先返回 is_featured = true 的 Prompt（由 cron featuredRefresh 标记）
 *   2. 如不足，补充最近 7 天 likesCount 最高的 published Prompt
 *   3. 缓存 TTL = 5min（与 day 周期一致）
 *
 * 注意：当前 Prompt schema 无 is_featured 字段，
 *   降级为取最近 7 天 likesCount top 12
 *   Phase 4.03 实现 Featured 算法后可利用 is_featured 字段
 */
export async function dailyPicks(limit = 12): Promise<PromptSummary[]> {
  const safeLimit = Math.min(30, Math.max(1, limit));
  const cacheKey = `trending:daily:${safeLimit}`;

  const cached = await getCache<PromptSummary[]>(cacheKey);
  if (cached) {
    log.debug({ source: 'cache' }, 'Daily picks cache hit');
    return cached;
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const rows = await prisma.prompt.findMany({
    where: {
      status: 'published',
      createdAt: { gte: sevenDaysAgo },
    },
    // 2026-04-09 修复 — 增加 content 字段，对齐 PromptSummary 接口
    select: {
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
    },
    orderBy: { likesCount: 'desc' },
    take: safeLimit,
  });

  const result: PromptSummary[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    content: r.content,
    tags: r.tags,
    category: r.category,
    model: r.model,
    author: r.author ?? { id: '', username: 'anonymous', displayName: null, avatarUrl: null },
    likesCount: r.likesCount,
    viewsCount: r.viewsCount,
    copiesCount: r.copiesCount,
    createdAt: r.createdAt.toISOString(),
  }));

  await setCache(cacheKey, result, CACHE_TTL.day);
  log.debug({ count: result.length, source: 'db' }, 'Daily picks computed');

  return result;
}
