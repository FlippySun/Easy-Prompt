/**
 * User 路由 — 公开资料、我的 Prompt/收藏/点赞、资料更新
 * 2026-04-08 新增 — P3.11 User Routes
 * 设计思路：路由层仅做入参校验（Zod）+ 调用 service + 序列化响应
 *   /me/* 端点需要登录（requireAuth）
 *   /:id 公开资料为公开接口
 * 影响范围：/api/v1/users/* 端点
 * 潜在风险：无已知风险
 */

import { Router } from 'express';
import { validate } from '../middlewares/validate';
import { requireAuth } from '../middlewares/auth';
import {
  getUserPublicProfile,
  updateUserProfile,
  getMyPrompts,
  getMySavedPrompts,
  getMyLikedPrompts,
  getMySavedCollections,
  getEnhancedPublicProfile,
  getUserAchievements,
  getUserActivityHeatmap,
} from '../services/user.service';
import { userIdParams, updateProfileBody, paginationQuery } from '../validators/user.validators';

const router = Router();

// Express 5 types req.params values as string | string[]
// Zod 已校验为 UUID string，此处安全 cast
const paramId = (req: { params: Record<string, unknown> }) => req.params.id as string;

// ═══════════════════════════════════════════════════════
// /me 系列（需登录）— 静态路由在动态路由之前注册
// ═══════════════════════════════════════════════════════

/**
 * GET /api/v1/users/me/prompts — 我的 Prompt 列表
 */
router.get(
  '/me/prompts',
  requireAuth,
  validate({ query: paginationQuery }),
  async (req, res, next) => {
    try {
      const result = await getMyPrompts(req.user!.userId, req.query as Record<string, unknown>);
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/users/me/saved — 我的收藏 Prompt 列表
 */
router.get(
  '/me/saved',
  requireAuth,
  validate({ query: paginationQuery }),
  async (req, res, next) => {
    try {
      const result = await getMySavedPrompts(
        req.user!.userId,
        req.query as Record<string, unknown>,
      );
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/users/me/liked — 我的点赞 Prompt 列表
 */
router.get(
  '/me/liked',
  requireAuth,
  validate({ query: paginationQuery }),
  async (req, res, next) => {
    try {
      const result = await getMyLikedPrompts(
        req.user!.userId,
        req.query as Record<string, unknown>,
      );
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/users/me/collections — 我的收藏 Collection 列表
 */
router.get(
  '/me/collections',
  requireAuth,
  validate({ query: paginationQuery }),
  async (req, res, next) => {
    try {
      const result = await getMySavedCollections(
        req.user!.userId,
        req.query as Record<string, unknown>,
      );
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /api/v1/users/me/profile — 更新我的资料
 */
router.put(
  '/me/profile',
  requireAuth,
  validate({ body: updateProfileBody }),
  async (req, res, next) => {
    try {
      const data = await updateUserProfile(req.user!.userId, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// ═══════════════════════════════════════════════════════
// 公开端点
// ═══════════════════════════════════════════════════════

/**
 * GET /api/v1/users/:id — 用户公开资料
 */
router.get('/:id', validate({ params: userIdParams }), async (req, res, next) => {
  try {
    const data = await getUserPublicProfile(paramId(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// P4.07 增强端点 — 公开
// ═══════════════════════════════════════════════════════

/**
 * GET /api/v1/users/:id/enhanced — 增强版公开资料（含统计数据）
 * 2026-04-08 新增 — P4.07
 */
router.get('/:id/enhanced', validate({ params: userIdParams }), async (req, res, next) => {
  try {
    const data = await getEnhancedPublicProfile(paramId(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/users/:id/achievements — 用户已解锁成就列表
 * 2026-04-08 新增 — P4.07
 */
router.get('/:id/achievements', validate({ params: userIdParams }), async (req, res, next) => {
  try {
    const data = await getUserAchievements(paramId(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/users/:id/activity — 最近 30 天活跃度热力图
 * 2026-04-08 新增 — P4.07
 */
router.get('/:id/activity', validate({ params: userIdParams }), async (req, res, next) => {
  try {
    const data = await getUserActivityHeatmap(paramId(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
