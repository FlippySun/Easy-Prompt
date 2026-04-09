/**
 * 黑名单 DB→Redis 缓存全量同步任务
 * 2026-04-08 新增 — P2.08 Gap C 补齐
 * 变更类型：新增
 * 设计思路：每 10 分钟执行一次，将 DB 中所有活跃黑名单规则同步到 Redis 缓存。
 *   blacklist.service.ts 在查询时使用 Redis 缓存（bl:* key）加速，
 *   但单条规则创建/删除时只更新对应 key，可能因 Redis 重启/网络闪断
 *   导致缓存与 DB 不一致。此任务做全量对账同步，保证最终一致性。
 *   同步策略：
 *   1. 从 DB 读取所有 isActive=true 的规则
 *   2. 按 type+value 构造 Redis key（bl:{type}:{value}）
 *   3. 使用 pipeline 批量 SET（带 TTL，expiresAt 有值则用剩余秒数，否则 24h）
 *   4. 清理 Redis 中多余的 bl:* key（DB 中已不存在/已停用的）
 * 参数：无
 * 影响范围：Redis bl:* 键、blacklist_rules 表（只读）
 * 潜在风险：Redis 不可用时静默跳过
 */

import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('cron:blCacheSync');

/** 无过期时间的规则默认缓存 TTL（秒）*/
const DEFAULT_CACHE_TTL = 86400; // 24h

export const blacklistCacheSyncJob = {
  name: 'blacklist-cache-sync',
  /** 每 10 分钟执行 */
  schedule: '*/10 * * * *',
  handler: syncBlacklistCache,
};

async function syncBlacklistCache(): Promise<void> {
  try {
    // 1. 读取所有活跃规则
    const activeRules = await prisma.blacklistRule.findMany({
      where: { isActive: true },
      select: { id: true, type: true, value: true, expiresAt: true },
    });

    // 2. 构建期望的 Redis key 集合
    const expectedKeys = new Set<string>();
    const pipeline = redis.pipeline();
    const now = Date.now();

    for (const rule of activeRules) {
      const key = `bl:${rule.type}:${rule.value}`;
      expectedKeys.add(key);

      // 计算 TTL
      let ttl = DEFAULT_CACHE_TTL;
      if (rule.expiresAt) {
        const remaining = Math.floor((rule.expiresAt.getTime() - now) / 1000);
        if (remaining <= 0) continue; // 已过期，跳过
        ttl = remaining;
      }

      pipeline.set(key, rule.id, 'EX', ttl);
    }

    await pipeline.exec();

    // 3. 清理 Redis 中多余的 bl:* key
    const existingKeys = await redis.keys('bl:*');
    const staleKeys = existingKeys.filter((k) => !expectedKeys.has(k));

    if (staleKeys.length > 0) {
      await redis.del(...staleKeys);
      log.info({ count: staleKeys.length }, 'Removed stale blacklist cache keys');
    }

    log.info(
      { synced: activeRules.length, staleRemoved: staleKeys.length },
      'Blacklist cache sync completed',
    );
  } catch (err) {
    log.warn({ err }, 'Blacklist cache sync failed (non-fatal)');
  }
}
