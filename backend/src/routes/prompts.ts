/**
 * Prompt 路由 — CRUD + 交互（Like/Save/Copy/View）
 * 2026-04-08 新增 — P3.03 Prompt Routes + P3.05 交互端点
 * 设计思路：路由层仅做入参校验（Zod）+ 调用 service + 序列化响应
 *   CRUD 端点在前，交互端点在后，共用 /api/v1/prompts 路径前缀
 *   静态路由（random/featured/galaxy）在动态路由（:id）之前注册，避免匹配冲突
 * 影响范围：/api/v1/prompts/* 端点
 * 潜在风险：无已知风险
 */

import { Router } from 'express';
import { validate } from '../middlewares/validate';
import { requireAuth, optionalAuth } from '../middlewares/auth';
import {
  listPrompts,
  getPromptDetail,
  createPrompt,
  updatePrompt,
  deletePrompt,
  getRandomPrompts,
  getFeaturedPrompts,
  getGalaxyData,
} from '../services/prompt.service';
import { toggleLike, toggleSave, recordCopy, recordView } from '../services/interaction.service';
import { searchPrompts } from '../services/search.service';
import {
  listPromptsQuery,
  promptIdParams,
  createPromptBody,
  updatePromptBody,
  randomPromptsQuery,
  featuredPromptsQuery,
  searchPromptsQuery,
} from '../validators/prompt.validators';

const router = Router();

// Express 5 types req.params values as string | string[]
// Zod 已校验为 UUID string，此处安全 cast
const paramId = (req: { params: Record<string, unknown> }) => req.params.id as string;

// ═══════════════════════════════════════════════════════
// CRUD 端点（P3.03）
// ═══════════════════════════════════════════════════════

/**
 * GET /api/v1/prompts — 分页列表
 * 支持 optionalAuth（登录用户可看到更多状态）
 */
router.get('/', optionalAuth, validate({ query: listPromptsQuery }), async (req, res, next) => {
  try {
    const query = req.query as Record<string, unknown>;
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    const filters = {
      category: query.category as string | undefined,
      model: query.model as string | undefined,
      tags: query.tags as string[] | undefined,
      status: isAdmin
        ? (query.status as string | undefined as import('../types/prompt').PromptStatus | undefined)
        : undefined,
      authorId: query.authorId as string | undefined,
      search: query.search as string | undefined,
    };
    const result = await listPrompts(filters, query, isAdmin);
    res.json({ success: true, data: result.data, meta: result.meta });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/prompts/search — 全文检索（P3.02）
 * 自动选择 tsvector 全文检索或 ILIKE 回退
 */
router.get('/search', validate({ query: searchPromptsQuery }), async (req, res, next) => {
  try {
    const q = req.query as Record<string, unknown>;
    const result = await searchPrompts({
      keyword: q.keyword as string,
      category: q.category as string | undefined,
      model: q.model as string | undefined,
      tags: q.tags as string[] | undefined,
      page: q.page as number | undefined,
      pageSize: q.pageSize as number | undefined,
    });
    res.json({ success: true, data: result.data, meta: result.meta });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/prompts/random — 随机推荐
 */
router.get('/random', validate({ query: randomPromptsQuery }), async (req, res, next) => {
  try {
    const { count, category } = req.query as { count?: number; category?: string };
    const data = await getRandomPrompts(count, category);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/prompts/featured — 精选列表
 */
router.get('/featured', validate({ query: featuredPromptsQuery }), async (req, res, next) => {
  try {
    const { limit } = req.query as { limit?: number };
    const data = await getFeaturedPrompts(limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/prompts/galaxy — 3D 星空可视化数据（P4.06 增强）
 * Query: since=ISO8601&chunk=0
 */
router.get('/galaxy', async (req, res, next) => {
  try {
    const since = typeof req.query.since === 'string' ? req.query.since : undefined;
    const chunk = typeof req.query.chunk === 'string' ? parseInt(req.query.chunk, 10) : undefined;
    const result = await getGalaxyData(since, isNaN(chunk as number) ? undefined : chunk);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/prompts/:id — 详情（含用户交互状态）
 */
router.get('/:id', optionalAuth, validate({ params: promptIdParams }), async (req, res, next) => {
  try {
    const data = await getPromptDetail(paramId(req), req.user?.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/prompts — 创建 Prompt（需登录）
 */
router.post('/', requireAuth, validate({ body: createPromptBody }), async (req, res, next) => {
  try {
    const data = await createPrompt(req.body, req.user!.userId);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/prompts/:id — 更新 Prompt（需登录，仅作者或 admin）
 */
router.put(
  '/:id',
  requireAuth,
  validate({ params: promptIdParams, body: updatePromptBody }),
  async (req, res, next) => {
    try {
      const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin';
      const data = await updatePrompt(paramId(req), req.body, req.user!.userId, isAdmin);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/v1/prompts/:id — 删除 Prompt（需登录，仅作者或 admin）
 */
router.delete('/:id', requireAuth, validate({ params: promptIdParams }), async (req, res, next) => {
  try {
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin';
    await deletePrompt(paramId(req), req.user!.userId, isAdmin);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// 交互端点（P3.05）
// ═══════════════════════════════════════════════════════

/**
 * POST /api/v1/prompts/:id/like — 切换点赞（需登录）
 */
router.post(
  '/:id/like',
  requireAuth,
  validate({ params: promptIdParams }),
  async (req, res, next) => {
    try {
      const data = await toggleLike(req.user!.userId, paramId(req));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/prompts/:id/save — 切换收藏（需登录）
 */
router.post(
  '/:id/save',
  requireAuth,
  validate({ params: promptIdParams }),
  async (req, res, next) => {
    try {
      const data = await toggleSave(req.user!.userId, paramId(req));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/prompts/:id/copy — 记录复制（需登录）
 */
router.post(
  '/:id/copy',
  requireAuth,
  validate({ params: promptIdParams }),
  async (req, res, next) => {
    try {
      const data = await recordCopy(req.user!.userId, paramId(req));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/prompts/:id/view — 记录浏览（optionalAuth + fingerprint）
 */
router.post(
  '/:id/view',
  optionalAuth,
  validate({ params: promptIdParams }),
  async (req, res, next) => {
    try {
      await recordView(paramId(req), req.user?.userId);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
