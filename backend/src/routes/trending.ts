/**
 * Trending 路由 — 热门排行、分类趋势、每日精选
 * 2026-04-08 新增 — P4.02 Trending Routes
 * 变更类型：新增
 * 设计思路：全部公开端点，无需认证
 *   响应头设置 Cache-Control: public, max-age=300（5 分钟浏览器缓存）
 *   入参通过 Zod 校验 period / limit
 * 参数：period (day/week/month), limit
 * 影响范围：/api/v1/trending/* 端点
 * 潜在风险：无已知风险
 */

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate';
import {
  trendingPrompts,
  trendingCategories,
  dailyPicks,
} from '../services/trending.service';
import type { TrendingPeriod } from '../services/trending.service';

const router = Router();

// ── Zod 校验 schemas ─────────────────────────────────────

const trendingPromptsQuery = z.object({
  period: z.enum(['day', 'week', 'month']).optional().default('week'),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

const trendingCategoriesQuery = z.object({
  period: z.enum(['day', 'week', 'month']).optional().default('week'),
  limit: z.coerce.number().int().min(1).max(30).optional().default(10),
});

const dailyPicksQuery = z.object({
  limit: z.coerce.number().int().min(1).max(30).optional().default(12),
});

// ── Cache-Control 响应头辅助 ─────────────────────────────

function setCacheHeaders(res: import('express').Response, maxAge = 300): void {
  res.set('Cache-Control', `public, max-age=${maxAge}`);
}

// ── GET /api/v1/trending/prompts ─────────────────────────

/**
 * 热门 Prompt 排行
 * Query: period=week&limit=20
 */
router.get(
  '/prompts',
  validate({ query: trendingPromptsQuery }),
  async (req, res, next) => {
    try {
      const { period, limit } = req.query as unknown as { period: TrendingPeriod; limit: number };
      const data = await trendingPrompts(period, limit);
      setCacheHeaders(res);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/v1/trending/categories ──────────────────────

/**
 * 分类趋势统计
 * Query: period=month&limit=10
 */
router.get(
  '/categories',
  validate({ query: trendingCategoriesQuery }),
  async (req, res, next) => {
    try {
      const { period, limit } = req.query as unknown as { period: TrendingPeriod; limit: number };
      const data = await trendingCategories(period, limit);
      setCacheHeaders(res);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/v1/trending/daily ───────────────────────────

/**
 * 每日精选
 * Query: limit=12
 */
router.get(
  '/daily',
  validate({ query: dailyPicksQuery }),
  async (req, res, next) => {
    try {
      const { limit } = req.query as unknown as { limit: number };
      const data = await dailyPicks(limit);
      setCacheHeaders(res);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
