/**
 * 渐进式限流服务（Redis 滑动窗口 + DB 违规记录）
 * 2026-04-07 新增 — P1.23
 * 设计思路：
 *   1. Redis ZSET 实现滑动窗口计数
 *   2. 超阈值 → 记录 violation → 查历史次数 → 按 BAN_LADDER 决定封禁时长
 *   3. 封禁规则写入 blacklist_rules 表，联动黑名单中间件
 * 影响范围：限流中间件、blacklist 服务
 * 潜在风险：Redis 不可用时限流失效（降级放行）
 */

import { redis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { createChildLogger } from '../utils/logger';
import { createOrUpdateRule } from './blacklist.service';
import { BAN_LADDER, MAX_BAN_LEVEL } from '../config/constants';

const log = createChildLogger('rate-limiter');

// Redis key 前缀
const RL_PREFIX = 'rl:';

/**
 * 滑动窗口限流检查
 * @param entityType ip / fingerprint / user
 * @param entityValue 具体值
 * @param maxRequests 窗口内最大请求数
 * @param windowSec 窗口时长（秒）
 * @returns { allowed, remaining, retryAfter? }
 */
export async function checkRateLimit(
  entityType: string,
  entityValue: string,
  maxRequests: number,
  windowSec: number,
): Promise<{ allowed: boolean; remaining: number; retryAfter?: number }> {
  if (!entityValue) return { allowed: true, remaining: maxRequests };

  const key = `${RL_PREFIX}${entityType}:${entityValue}`;
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const windowStart = now - windowMs;

  try {
    // Redis pipeline: 清理过期 + 添加当前 + 计数 + 设置 TTL
    const pipe = redis.pipeline();
    pipe.zremrangebyscore(key, 0, windowStart); // 清理窗口外的记录
    pipe.zadd(key, now, `${now}:${Math.random()}`); // 添加当前请求
    pipe.zcard(key); // 计数
    pipe.expire(key, windowSec + 1); // TTL 比窗口稍长

    const results = await pipe.exec();
    if (!results) return { allowed: true, remaining: maxRequests };

    const count = (results[2]?.[1] as number) || 0;
    const remaining = Math.max(0, maxRequests - count);

    if (count > maxRequests) {
      // 触发违规 — 异步处理，不阻塞请求
      handleViolation(entityType, entityValue, count, maxRequests).catch((err) =>
        log.error({ err }, 'Failed to handle rate violation'),
      );

      return {
        allowed: false,
        remaining: 0,
        retryAfter: windowSec,
      };
    }

    return { allowed: true, remaining };
  } catch (err) {
    log.warn({ err, entityType, entityValue }, 'Rate limit check failed, allowing request');
    return { allowed: true, remaining: maxRequests };
  }
}

/**
 * 处理违规：记录 + 升级封禁阶梯
 */
async function handleViolation(
  entityType: string,
  entityValue: string,
  hits: number,
  threshold: number,
): Promise<void> {
  // 查找或创建违规记录
  const existing = await prisma.rateViolation.findUnique({
    where: { entityType_entityValue: { entityType, entityValue } },
  });

  let newLevel: number;
  let violationCount: number;

  if (existing) {
    violationCount = existing.violationCount + 1;
    newLevel = Math.min(existing.currentLevel + 1, MAX_BAN_LEVEL);

    await prisma.rateViolation.update({
      where: { id: existing.id },
      data: {
        violationCount,
        currentLevel: newLevel,
        lastWindowHits: hits,
        lastThreshold: threshold,
        lastViolationAt: new Date(),
      },
    });
  } else {
    violationCount = 1;
    newLevel = 1;

    await prisma.rateViolation.create({
      data: {
        entityType,
        entityValue,
        violationCount,
        currentLevel: newLevel,
        lastWindowHits: hits,
        lastThreshold: threshold,
      },
    });
  }

  // 按阶梯决定封禁时长（duration 单位为秒，-1 表示永久）
  const ladder = BAN_LADDER[newLevel] ?? BAN_LADDER[MAX_BAN_LEVEL];
  const isPermanent = ladder.duration === -1;
  const expiresAt = isPermanent ? null : new Date(Date.now() + ladder.duration * 1000);

  // 映射 entityType → blacklist type
  const blacklistType =
    entityType === 'user' ? 'user' : entityType === 'fingerprint' ? 'fingerprint' : 'ip';

  await createOrUpdateRule({
    type: blacklistType,
    value: entityValue,
    reason: `Auto-ban: rate limit violation #${violationCount} (level ${newLevel}), ${hits} requests in window (threshold: ${threshold})`,
    source: 'auto',
    violationLevel: newLevel,
    expiresAt,
  });

  log.warn(
    {
      entityType,
      entityValue,
      violationCount,
      level: newLevel,
      ban: ladder.label,
    },
    'Rate violation processed, ban applied',
  );
}
