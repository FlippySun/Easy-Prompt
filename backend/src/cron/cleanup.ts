/**
 * 限流衰减 + 黑名单过期清理任务
 * 2026-04-08 新增 — P2.08
 * 变更类型：新增
 * 设计思路：每小时执行一次，清理两类过期数据：
 *   1. 过期的黑名单规则（expiresAt < now）→ 设 isActive=false
 *   2. 过期的限流违规记录 Redis key（rl:* 前缀）→ Redis TTL 自动过期，此处仅清理 DB 中
 *      超过 30 天的 RateViolation 记录
 * 参数：无
 * 影响范围：blacklist_rules 表、rate_violations 表
 * 潜在风险：无已知风险（仅清理过期数据）
 */

import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('cron:cleanup');

/** 限流违规记录保留天数 */
const VIOLATION_RETENTION_DAYS = 30;

export const cleanupJob = {
  name: 'cleanup-expired',
  /** 每小时整点执行 */
  schedule: '0 * * * *',
  handler: cleanupExpired,
};

async function cleanupExpired(): Promise<void> {
  const now = new Date();

  // ── 1. 停用过期黑名单规则 ──
  const expiredBlacklist = await prisma.blacklistRule.updateMany({
    where: {
      isActive: true,
      expiresAt: { not: null, lt: now },
    },
    data: { isActive: false },
  });

  if (expiredBlacklist.count > 0) {
    log.info({ count: expiredBlacklist.count }, 'Deactivated expired blacklist rules');

    // 清理对应的 Redis 缓存 key（bl:* 前缀）
    try {
      const keys = await redis.keys('bl:*');
      if (keys.length > 0) {
        await redis.del(...keys);
        log.info({ keys: keys.length }, 'Cleared blacklist Redis cache');
      }
    } catch (err) {
      log.warn({ err }, 'Failed to clear blacklist Redis cache (non-fatal)');
    }
  }

  // ── 2. 删除超过保留期的限流违规记录 ──
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - VIOLATION_RETENTION_DAYS);

  const deletedViolations = await prisma.rateViolation.deleteMany({
    where: {
      createdAt: { lt: cutoff },
    },
  });

  if (deletedViolations.count > 0) {
    log.info(
      { count: deletedViolations.count, retentionDays: VIOLATION_RETENTION_DAYS },
      'Deleted old rate violation records',
    );
  }

  log.info(
    {
      expiredBlacklist: expiredBlacklist.count,
      deletedViolations: deletedViolations.count,
    },
    'Cleanup completed',
  );
}
