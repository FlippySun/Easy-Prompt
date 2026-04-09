/**
 * 元数据路由 — 分类 + 模型配置
 * 2026-04-07 新增 — P1.33
 * 2026-04-08 新增 — 管理员 CRUD 端点（POST/PUT categories & models）
 * 设计思路：公开 GET API 供前端获取分类/模型配置；
 *   管理员 POST/PUT API 用于后台管理分类和模型元数据
 * 影响范围：/api/v1/meta/*
 * 潜在风险：无已知风险
 */

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate';
import { requireAuth, requireAdmin } from '../middlewares/auth';
import { prisma } from '../lib/prisma';

const router = Router();

// ── 公开 GET 端点 ──────────────────────────────────────

/**
 * GET /api/v1/meta/categories — 获取所有活跃分类
 */
router.get('/categories', async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/meta/models — 获取所有活跃模型配置
 */
router.get('/models', async (_req, res, next) => {
  try {
    const models = await prisma.modelConfig.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ success: true, data: models });
  } catch (err) {
    next(err);
  }
});

// ── 管理员 CRUD 端点 ──────────────────────────────────

// ── Zod Schemas ──────────────────────────────────────

const upsertCategorySchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  label: z.string().min(1).max(100),
  labelEn: z.string().max(100).nullable().optional(),
  emoji: z.string().max(10).nullable().optional(),
  icon: z.string().max(30).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  bgColor: z.string().max(20).nullable().optional(),
  darkBgColor: z.string().max(30).nullable().optional(),
  darkColor: z.string().max(20).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

const upsertModelSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  label: z.string().min(1).max(100),
  color: z.string().max(20).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

/**
 * POST /api/v1/meta/categories — 创建或更新分类（upsert by slug）
 * 2026-04-08 新增 — 管理员 CRUD
 */
router.post(
  '/categories',
  requireAuth,
  requireAdmin,
  validate({ body: upsertCategorySchema }),
  async (req, res, next) => {
    try {
      const { slug, ...data } = req.body;
      const category = await prisma.category.upsert({
        where: { slug },
        update: data,
        create: { slug, ...data },
      });
      res.status(201).json({ success: true, data: category });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /api/v1/meta/categories/:slug — 更新分类
 * 2026-04-08 新增 — 管理员 CRUD
 */
router.put(
  '/categories/:slug',
  requireAuth,
  requireAdmin,
  validate({ body: upsertCategorySchema.partial().omit({ slug: true }) }),
  async (req, res, next) => {
    try {
      const category = await prisma.category.update({
        where: { slug: req.params.slug as string },
        data: req.body,
      });
      res.json({ success: true, data: category });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/meta/models — 创建或更新模型配置（upsert by slug）
 * 2026-04-08 新增 — 管理员 CRUD
 */
router.post(
  '/models',
  requireAuth,
  requireAdmin,
  validate({ body: upsertModelSchema }),
  async (req, res, next) => {
    try {
      const { slug, ...data } = req.body;
      const model = await prisma.modelConfig.upsert({
        where: { slug },
        update: data,
        create: { slug, ...data },
      });
      res.status(201).json({ success: true, data: model });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /api/v1/meta/models/:slug — 更新模型配置
 * 2026-04-08 新增 — 管理员 CRUD
 */
router.put(
  '/models/:slug',
  requireAuth,
  requireAdmin,
  validate({ body: upsertModelSchema.partial().omit({ slug: true }) }),
  async (req, res, next) => {
    try {
      const model = await prisma.modelConfig.update({
        where: { slug: req.params.slug as string },
        data: req.body,
      });
      res.json({ success: true, data: model });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
