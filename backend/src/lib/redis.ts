/**
 * Redis 客户端单例（ioredis）
 * 2026-04-07 新增 — P1.04 Redis 初始化
 * 设计思路：使用 ioredis 连接 Redis，开发环境输出连接日志，
 *   断线自动重连，lazyConnect 延迟到首次使用时连接
 * 影响范围：限流、黑名单缓存、Session 存储
 * 潜在风险：Redis 不可用时服务仍可启动（降级为无缓存模式需业务层处理）
 */

import Redis from 'ioredis';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('redis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 200, 5000);
    log.warn({ attempt: times, delayMs: delay }, 'Redis reconnecting...');
    return delay;
  },
});

redis.on('connect', () => {
  log.info('Redis connected');
});

redis.on('error', (err) => {
  log.error({ err }, 'Redis connection error');
});

redis.on('close', () => {
  log.warn('Redis connection closed');
});

/**
 * 安全连接 Redis（若已连接则跳过）
 * 用于启动时显式连接并检测可用性
 */
export async function connectRedis(): Promise<boolean> {
  try {
    if (redis.status === 'ready') return true;
    await redis.connect();
    await redis.ping();
    return true;
  } catch (err) {
    log.error({ err }, 'Failed to connect Redis');
    return false;
  }
}
