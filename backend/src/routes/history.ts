/**
 * History 路由 — 跨设备增强历史同步 API
 * 2026-04-09 新增 — P6.01
 * 变更类型：新增
 * 设计思路：
 *   1. GET  / — 分页查询历史（支持 clientType/日期范围筛选）
 *   2. POST /sync — 批量上传历史（upsert 去重）
 *   3. GET  /export — 导出历史（JSON/CSV）
 *   所有端点需要登录（requireAuth）
 * 影响范围：/api/v1/history/*
 * 潜在风险：无已知风险
 */

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate';
import { requireAuth } from '../middlewares/auth';
import { getHistory, syncHistory, exportHistory } from '../services/history.service';
import { CLIENT_TYPES, HISTORY_SYNC_BATCH_MAX } from '../config/constants';

const router = Router();

// 所有历史路由需要认证
router.use(requireAuth);

// ── Zod Schemas ──────────────────────────────────────

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  clientType: z.enum(CLIENT_TYPES as unknown as [string, ...string[]]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const syncBodySchema = z.object({
  items: z
    .array(
      z.object({
        clientId: z.string().min(1).max(64),
        inputText: z.string().min(1),
        outputText: z.string().min(1),
        scene: z.string().max(50).optional(),
        model: z.string().max(100).optional(),
        clientType: z.enum(CLIENT_TYPES as unknown as [string, ...string[]]).optional(),
        enhanceMode: z.enum(['fast', 'deep']).optional(),
        language: z.string().max(10).optional(),
        createdAt: z.string().datetime().optional(),
      }),
    )
    .min(1)
    .max(HISTORY_SYNC_BATCH_MAX),
});

const exportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).optional(),
});

// ── Routes ──────────────────────────────────────────

/**
 * GET /api/v1/history — 分页查询增强历史
 * 2026-04-09 新增 — P6.01
 * ?page=1&limit=20&clientType=vscode&startDate=2026-01-01T00:00:00Z
 */
router.get('/', validate({ query: listQuerySchema }), async (req, res, next) => {
  try {
    const result = await getHistory(req.user!.userId, req.query as Record<string, string>);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/history/sync — 批量同步历史
 * 2026-04-09 新增 — P6.01
 * Body: { items: HistorySyncItem[] }
 */
router.post('/sync', validate({ body: syncBodySchema }), async (req, res, next) => {
  try {
    const result = await syncHistory(req.user!.userId, req.body.items);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/history/export — 导出历史
 * 2026-04-09 新增 — P6.01
 * ?format=json|csv
 */
router.get('/export', validate({ query: exportQuerySchema }), async (req, res, next) => {
  try {
    const format = (req.query.format as string) || 'json';
    const content = await exportHistory(req.user!.userId, format as 'json' | 'csv');

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="enhance-history.csv"');
    } else {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="enhance-history.json"');
    }

    res.send(content);
  } catch (err) {
    next(err);
  }
});

export default router;
