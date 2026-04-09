/**
 * 限流计数器衰减任务
 * 2026-04-08 新增 — P2.08 Gap C 补齐
 * 变更类型：新增
 * 设计思路：每 5 分钟执行一次，衰减 Redis 中的滑动窗口限流计数器。
 *   rateLimiter.service.ts 使用 Redis ZSET 存储请求时间戳，
 *   此任务清理所有 rl:* key 中超出窗口期的过期成员，
 *   降低 Redis 内存占用并保持计数准确性。
 *   注意：与 cleanup.ts 的区别——cleanup 清理 DB 中 >30 天的历史记录，
 *   本任务清理 Redis 中实时滑动窗口的过期时间戳。
 * 参数：无
 * 影响范围：Redis rl:* 键
 * 潜在风险：Redis 不可用时静默跳过（不影响主服务）
 */

import { redis } from '../lib/redis';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('cron:rateDecay');

/** 滑动窗口最大跨度（秒）— 与 config/constants.ts 中最大窗口保持一致 */
const MAX_WINDOW_SEC = 300;

export const rateDecayJob = {
  name: 'rate-decay',
  /** 每 5 分钟执行 */
  schedule: '*/5 * * * *',
  handler: decayRateLimitCounters,
};

async function decayRateLimitCounters(): Promise<void> {
  try {
    // 扫描所有 rl:* 限流键
    const keys = await redis.keys('rl:*');
    if (keys.length === 0) {
      log.debug('No rate limit keys found, skipping');
      return;
    }

    const cutoff = Date.now() - MAX_WINDOW_SEC * 1000;
    let totalRemoved = 0;

    for (const key of keys) {
      // 移除 ZSET 中 score < cutoff 的过期时间戳
      const removed = await redis.zremrangebyscore(key, '-inf', cutoff);
      totalRemoved += removed;
    }

    if (totalRemoved > 0) {
      log.info(
        { keys: keys.length, removed: totalRemoved },
        'Rate limit counters decayed',
      );
    }
  } catch (err) {
    // Redis 不可用时不应阻塞
    log.warn({ err }, 'Rate decay failed (non-fatal, Redis may be unavailable)');
  }
}
