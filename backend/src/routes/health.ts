/**
 * Health check 路由
 * 2026-04-07 新增 — P1.35
 * 2026-04-08 修复 — /ready 接入真实 Prisma + Redis 探针，替代原 not_configured 占位
 * 设计思路：Kubernetes-style 双端点
 *   - / (liveness)  → 进程存活即返回 200
 *   - /ready (readiness) → 检查 DB + Redis 可用性
 * 影响范围：运维监控探针
 * 潜在风险：探测超时可能导致 readiness 短暂失败
 */

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('health');
const router = Router();

/**
 * GET /health — Liveness 探针
 * 进程存活即 200
 */
router.get('/', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /health/ready — Readiness 探针
 * 2026-04-08 修复 — 接入真实 DB + Redis 检查
 * 检查 PostgreSQL（SELECT 1）和 Redis（PING）可用性
 * 任一失败返回 503，但不阻止其他检查
 */
router.get('/ready', async (_req, res) => {
  const checks: Record<string, 'connected' | 'disconnected' | 'error'> = {
    database: 'disconnected',
    redis: 'disconnected',
  };

  // DB 探针：Prisma $queryRawUnsafe('SELECT 1')
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    checks.database = 'connected';
  } catch (err) {
    checks.database = 'error';
    log.warn({ err }, 'Health: database check failed');
  }

  // Redis 探针：PING → PONG
  try {
    const pong = await redis.ping();
    checks.redis = pong === 'PONG' ? 'connected' : 'error';
  } catch (err) {
    checks.redis = 'error';
    log.warn({ err }, 'Health: redis check failed');
  }

  const allHealthy = checks.database === 'connected' && checks.redis === 'connected';
  const statusCode = allHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: allHealthy ? 'ok' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});

export default router;
