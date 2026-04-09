/**
 * Scenes 路由 — 场景列表 API
 * 2026-04-08 新增 — P1.34
 * 设计思路：公开 API，客户端获取后端维护的场景列表
 *   替代前端硬编码的 SCENES 数据，支持按分类筛选
 * 影响范围：/api/v1/scenes/*
 * 潜在风险：无已知风险
 */

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate';
import {
  listScenes,
  getSceneById,
  searchScenes,
  listScenesByCategory,
} from '../services/scenes.service';

const router = Router();

// ── Zod Schemas ──────────────────────────────────────

const listQuerySchema = z.object({
  category: z.string().max(50).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

// 2026-04-08 新增 — P2.07 场景搜索 Zod 校验
const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

// 2026-04-09 新增 — P6.04 i18n 查询参数校验
const categoriesQuerySchema = z.object({
  locale: z.enum(['zh', 'en']).optional(),
});

// ── Routes ────────────────────────────────────────────────

/**
 * GET /api/v1/scenes/categories — 按分类分组返回场景
 * 2026-04-09 新增 — P6.04 场景数据统一服务
 * 设计思路：客户端一次获取全量场景并按分类渲染，减少多次请求
 * ?locale=en 返回英文场景名
 * 影响范围：无副作用，只读查询
 * 潜在风险：无已知风险
 */
router.get('/categories', validate({ query: categoriesQuerySchema }), async (req, res, next) => {
  try {
    const { locale } = req.query as { locale?: string };
    const grouped = await listScenesByCategory(locale);
    res.json({ success: true, data: grouped });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/scenes/search — 搜索场景（关键词模糊匹配 name/keywords/description）
 * 2026-04-08 新增 — P2.07 验证报告 Gap #3
 * ?q=coding&limit=10
 */
router.get('/search', validate({ query: searchQuerySchema }), async (req, res, next) => {
  try {
    const { q, limit } = req.query as unknown as { q: string; limit?: number };
    const scenes = await searchScenes(q, limit);
    res.json({ success: true, data: scenes });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/scenes — 获取所有活跃场景
 * 支持 ?category=coding 按分类筛选
 */
router.get('/', validate({ query: listQuerySchema }), async (req, res, next) => {
  try {
    const scenes = await listScenes(req.query as { category?: string; isActive?: boolean });
    res.json({ success: true, data: scenes });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/scenes/:id — 获取单个场景详情
 */
router.get('/:id', async (req, res, next) => {
  try {
    const scene = await getSceneById(req.params.id);
    res.json({ success: true, data: scene });
  } catch (err) {
    next(err);
  }
});

export default router;
