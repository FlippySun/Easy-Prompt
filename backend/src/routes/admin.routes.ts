/**
 * Admin 内容管理路由 — 待审核列表、审批、拒绝、批量审批、精选管理
 * 2026-04-08 新增 — P4.05 Admin Prompt Routes
 * 变更类型：新增
 * 设计思路：全部需 admin 权限（requireAuth + requireAdmin）
 *   路由前缀：/api/v1/admin/prompts（在 app.ts 中挂载）
 *   静态路由（pending, bulk-approve）在动态路由（:id）之前注册
 * 参数：各端点参数见 JSDoc
 * 影响范围：/api/v1/admin/prompts/* 端点
 * 潜在风险：无已知风险
 */

import { Router } from 'express';
import { validate } from '../middlewares/validate';
import { requireAuth, requireAdmin } from '../middlewares/auth';
import {
  getPendingPrompts,
  approvePrompt,
  rejectPrompt,
  bulkApprove,
} from '../services/admin.service';
import { manualFeature, unfeature } from '../services/featured.service';
import {
  adminPromptIdParams,
  rejectPromptBody,
  bulkApproveBody,
  pendingPromptsQuery,
} from '../validators/admin.validators';

const router = Router();

// 所有路由都需要 admin 权限
router.use(requireAuth, requireAdmin);

// Express 5 types req.params values as string | string[]
const paramId = (req: { params: Record<string, unknown> }) => req.params.id as string;

// ── GET /api/v1/admin/prompts/pending ────────────────────

/**
 * 获取待审核 Prompt 列表（分页）
 * Query: page=1&pageSize=20
 */
router.get(
  '/pending',
  validate({ query: pendingPromptsQuery }),
  async (req, res, next) => {
    try {
      const result = await getPendingPrompts(req.query as Record<string, unknown>);
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/v1/admin/prompts/bulk-approve ──────────────

/**
 * 批量审批通过
 * Body: { ids: ["uuid1", "uuid2", ...] }
 */
router.post(
  '/bulk-approve',
  validate({ body: bulkApproveBody }),
  async (req, res, next) => {
    try {
      const { ids } = req.body as { ids: string[] };
      const result = await bulkApprove(ids, req.user!.userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/v1/admin/prompts/:id/approve ───────────────

/**
 * 审批通过单个 Prompt
 */
router.post(
  '/:id/approve',
  validate({ params: adminPromptIdParams }),
  async (req, res, next) => {
    try {
      const data = await approvePrompt(paramId(req), req.user!.userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/v1/admin/prompts/:id/reject ────────────────

/**
 * 拒绝单个 Prompt
 * Body: { reason: "..." }
 */
router.post(
  '/:id/reject',
  validate({ params: adminPromptIdParams, body: rejectPromptBody }),
  async (req, res, next) => {
    try {
      const { reason } = req.body as { reason: string };
      const data = await rejectPrompt(paramId(req), req.user!.userId, reason);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/v1/admin/prompts/:id/feature ───────────────

/**
 * 手动标记 Prompt 为精选
 */
router.post(
  '/:id/feature',
  validate({ params: adminPromptIdParams }),
  async (req, res, next) => {
    try {
      const data = await manualFeature(paramId(req), req.user!.userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/v1/admin/prompts/:id/unfeature ────────────

/**
 * 取消 Prompt 精选标记
 */
router.post(
  '/:id/unfeature',
  validate({ params: adminPromptIdParams }),
  async (req, res, next) => {
    try {
      const data = await unfeature(paramId(req), req.user!.userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
