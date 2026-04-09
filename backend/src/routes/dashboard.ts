/**
 * Admin Dashboard 统计路由
 * 2026-04-09 新增 — P6.05
 * 变更类型：新增
 * 设计思路：
 *   聚合核心指标（用户数、Prompt 数、AI 请求数、活跃 Provider 数）
 *   近 7 天增量数据用于趋势展示
 *   需要 admin 权限
 * 影响范围：/api/v1/admin/dashboard/*
 * 潜在风险：大表 count 可能慢，后续可加 Redis 缓存
 */

import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middlewares/auth';
import { prisma } from '../lib/prisma';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('dashboard');
const router = Router();

// 所有路由需要管理员权限
router.use(requireAuth, requireAdmin);

/**
 * GET /api/v1/admin/dashboard/stats — 仪表盘核心指标
 * 2026-04-09 — P6.05
 * 返回：totalUsers, totalPrompts, totalAiRequests, activeProviders, recentUsers, recentAiRequests
 */
router.get('/stats', async (_req, res, next) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // 并行查询 6 个指标
    const [
      totalUsers,
      totalPrompts,
      totalAiRequests,
      activeProviders,
      recentUsers,
      recentAiRequests,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.prompt.count(),
      prisma.aiRequestLog.count(),
      prisma.aiProvider.count({ where: { isActive: true } }),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.aiRequestLog.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    ]);

    log.info('Dashboard stats fetched');

    res.json({
      success: true,
      data: {
        totalUsers,
        totalPrompts,
        totalAiRequests,
        activeProviders,
        recentUsers,
        recentAiRequests,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
