/**
 * Analytics 管理路由（仅管理员）
 * 2026-04-08 新增 — P2.05
 * 变更类型：新增
 * 设计思路：提供 9 个分析端点，全部需要 admin 权限。
 *   所有查询参数通过 Zod 校验并 coerce 类型。
 *   日期范围通过 from/to query 参数传入（ISO 8601 字符串）。
 * 参数：各端点参见下方 schema
 * 影响范围：/api/v1/admin/analytics/*
 * 潜在风险：大时间跨度查询可能慢（已在 service 层注释）
 */

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate';
import { requireAuth, requireAdmin } from '../middlewares/auth';
import {
  getRequestList,
  getRequestDetail,
  getSummary,
  getDailyStats,
  getByClient,
  getByScene,
  getByIp,
  getByUser,
  getCostReport,
} from '../services/analytics.service';
import type { DateRange } from '../services/analytics.service';

const router = Router();

// 所有路由需要管理员权限
router.use(requireAuth, requireAdmin);

// ── 公共 Query Schema 片段 ────────────────────────────

const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

/** 从已验证 query 提取 DateRange（若有） */
function extractDateRange(query: { from?: string; to?: string }): DateRange | undefined {
  if (!query.from && !query.to) return undefined;
  return {
    from: query.from ? new Date(query.from) : new Date(0),
    to: query.to ? new Date(query.to) : new Date(),
  };
}

// ── Zod Schemas ──────────────────────────────────────

const requestListQuerySchema = dateRangeSchema.extend({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  clientType: z.string().optional(),
  scene: z.string().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  status: z.string().optional(),
  userId: z.string().optional(),
  ipAddress: z.string().optional(),
});

const topLimitQuerySchema = dateRangeSchema.extend({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// ── Routes ──────────────────────────────────────────

/**
 * GET /api/v1/admin/analytics/requests — 请求列表（分页）
 */
router.get('/requests', validate({ query: requestListQuerySchema }), async (req, res, next) => {
  try {
    const q = req.query as z.infer<typeof requestListQuerySchema>;
    const result = await getRequestList(
      {
        dateRange: extractDateRange(q),
        clientType: q.clientType,
        scene: q.scene,
        model: q.model,
        provider: q.provider,
        status: q.status,
        userId: q.userId,
        ipAddress: q.ipAddress,
      },
      { page: q.page, limit: q.limit },
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/analytics/requests/:id — 单条请求详情
 */
router.get('/requests/:id', async (req, res, next) => {
  try {
    const detail = await getRequestDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Request log not found' } });
      return;
    }
    res.json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/analytics/summary — 汇总指标
 */
router.get('/summary', validate({ query: dateRangeSchema }), async (req, res, next) => {
  try {
    const q = req.query as z.infer<typeof dateRangeSchema>;
    const summary = await getSummary(extractDateRange(q));
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/analytics/daily — 每日统计
 */
router.get('/daily', validate({ query: dateRangeSchema }), async (req, res, next) => {
  try {
    const q = req.query as z.infer<typeof dateRangeSchema>;
    const data = await getDailyStats(extractDateRange(q));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/analytics/by-client — 按客户端类型分组
 */
router.get('/by-client', validate({ query: dateRangeSchema }), async (req, res, next) => {
  try {
    const q = req.query as z.infer<typeof dateRangeSchema>;
    const data = await getByClient(extractDateRange(q));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/analytics/by-scene — 按场景分组（Top N）
 */
router.get('/by-scene', validate({ query: topLimitQuerySchema }), async (req, res, next) => {
  try {
    const q = req.query as z.infer<typeof topLimitQuerySchema>;
    const data = await getByScene(extractDateRange(q), q.limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/analytics/by-ip — 按 IP 分组（Top N）
 */
router.get('/by-ip', validate({ query: topLimitQuerySchema }), async (req, res, next) => {
  try {
    const q = req.query as z.infer<typeof topLimitQuerySchema>;
    const data = await getByIp(extractDateRange(q), q.limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/analytics/by-user — 按用户分组（Top N）
 */
router.get('/by-user', validate({ query: topLimitQuerySchema }), async (req, res, next) => {
  try {
    const q = req.query as z.infer<typeof topLimitQuerySchema>;
    const data = await getByUser(extractDateRange(q), q.limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/analytics/cost — 成本报告（按 provider + model）
 */
router.get('/cost', validate({ query: dateRangeSchema }), async (req, res, next) => {
  try {
    const q = req.query as z.infer<typeof dateRangeSchema>;
    const data = await getCostReport(extractDateRange(q));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
