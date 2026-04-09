/**
 * Collection 路由 — CRUD + Prompt 关联管理 + 收藏
 * 2026-04-08 新增 — P3.09 Collection Routes
 * 设计思路：路由层仅做入参校验（Zod）+ 调用 service + 序列化响应
 *   CRUD 和 Prompt 关联管理为 admin only
 *   收藏操作为登录用户
 *   列表和详情为公开接口（optionalAuth）
 * 影响范围：/api/v1/collections/* 端点
 * 潜在风险：无已知风险
 */

import { Router } from 'express';
import { validate } from '../middlewares/validate';
import { requireAuth, optionalAuth, requireAdmin } from '../middlewares/auth';
import {
  listCollections,
  getCollectionDetail,
  createCollection,
  updateCollection,
  deleteCollection,
  addPromptsToCollection,
  removePromptsFromCollection,
} from '../services/collection.service';
import { toggleCollectionSave } from '../services/interaction.service';
import {
  listCollectionsQuery,
  collectionIdParams,
  createCollectionBody,
  updateCollectionBody,
  collectionPromptsBody,
} from '../validators/collection.validators';

const router = Router();

// Express 5 types req.params values as string | string[]
// Zod 已校验为 UUID string，此处安全 cast
const paramId = (req: { params: Record<string, unknown> }) => req.params.id as string;

// ═══════════════════════════════════════════════════════
// 公开端点
// ═══════════════════════════════════════════════════════

/**
 * GET /api/v1/collections — 分页列表
 */
router.get(
  '/',
  validate({ query: listCollectionsQuery }),
  async (req, res, next) => {
    try {
      const query = req.query as Record<string, unknown>;
      const filters = {
        tags: query.tags as string[] | undefined,
        difficulty: query.difficulty as string | undefined,
        search: query.search as string | undefined,
      };
      const result = await listCollections(filters, query);
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/collections/:id — 详情（含关联 Prompt 和收藏状态）
 */
router.get(
  '/:id',
  optionalAuth,
  validate({ params: collectionIdParams }),
  async (req, res, next) => {
    try {
      const data = await getCollectionDetail(paramId(req), req.user?.userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// ═══════════════════════════════════════════════════════
// 用户交互端点
// ═══════════════════════════════════════════════════════

/**
 * POST /api/v1/collections/:id/save — 切换收藏（需登录）
 */
router.post(
  '/:id/save',
  requireAuth,
  validate({ params: collectionIdParams }),
  async (req, res, next) => {
    try {
      const data = await toggleCollectionSave(req.user!.userId, paramId(req));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// ═══════════════════════════════════════════════════════
// Admin 管理端点
// ═══════════════════════════════════════════════════════

/**
 * POST /api/v1/collections — 创建 Collection（admin only）
 */
router.post(
  '/',
  requireAuth,
  requireAdmin,
  validate({ body: createCollectionBody }),
  async (req, res, next) => {
    try {
      const data = await createCollection(req.body, req.user!.userId);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /api/v1/collections/:id — 更新 Collection（admin only）
 */
router.put(
  '/:id',
  requireAuth,
  requireAdmin,
  validate({ params: collectionIdParams, body: updateCollectionBody }),
  async (req, res, next) => {
    try {
      const data = await updateCollection(paramId(req), req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/v1/collections/:id — 删除 Collection（admin only）
 */
router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  validate({ params: collectionIdParams }),
  async (req, res, next) => {
    try {
      await deleteCollection(paramId(req));
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/collections/:id/prompts — 添加 Prompt 到 Collection（admin only）
 */
router.post(
  '/:id/prompts',
  requireAuth,
  requireAdmin,
  validate({ params: collectionIdParams, body: collectionPromptsBody }),
  async (req, res, next) => {
    try {
      const data = await addPromptsToCollection(paramId(req), req.body.promptIds);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/v1/collections/:id/prompts — 从 Collection 移除 Prompt（admin only）
 */
router.delete(
  '/:id/prompts',
  requireAuth,
  requireAdmin,
  validate({ params: collectionIdParams, body: collectionPromptsBody }),
  async (req, res, next) => {
    try {
      const data = await removePromptsFromCollection(paramId(req), req.body.promptIds);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
