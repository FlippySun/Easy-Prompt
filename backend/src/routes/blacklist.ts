/**
 * 黑名单管理路由（仅管理员）
 * 2026-04-07 新增 — P1.21
 * 设计思路：提供封禁规则的 CRUD API，仅 admin 可操作
 * 影响范围：/api/v1/admin/blacklist/*
 * 潜在风险：无已知风险
 */

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate';
import { requireAuth, requireAdmin } from '../middlewares/auth';
import { createOrUpdateRule, deactivateRule, listRules } from '../services/blacklist.service';
// 2026-04-08 修复 — P2.02 审计日志接入（验证报告 Gap #1）
import { logAudit } from '../utils/auditLogger';

const router = Router();

// 所有路由需要管理员权限
router.use(requireAuth, requireAdmin);

// ── Zod Schemas ──────────────────────────────────────

const createRuleSchema = z.object({
  type: z.enum(['user', 'ip', 'fingerprint', 'ip_range']),
  value: z.string().min(1).max(255),
  reason: z.string().min(1),
  severity: z.enum(['block', 'warn', 'throttle']).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  type: z.enum(['user', 'ip', 'fingerprint', 'ip_range']).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

// ── Routes ──────────────────────────────────────────

/**
 * GET /api/v1/admin/blacklist — 列出封禁规则
 */
router.get('/', validate({ query: listQuerySchema }), async (req, res, next) => {
  try {
    const result = await listRules(
      req.query as { page?: number; limit?: number; type?: string; isActive?: boolean },
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/blacklist — 创建/更新封禁规则
 */
router.post('/', validate({ body: createRuleSchema }), async (req, res, next) => {
  try {
    const rule = await createOrUpdateRule({
      ...req.body,
      blockedBy: req.user!.userId,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
    });
    // 2026-04-08 修复 — P2.02 审计日志：记录黑名单规则创建/更新
    logAudit({
      adminId: req.user!.userId,
      action: 'blacklist.create',
      targetType: 'blacklist_rule',
      targetId: rule.id,
      changes: { after: { type: req.body.type, value: req.body.value, reason: req.body.reason } },
      ip: req.ip,
    });
    res.status(201).json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/admin/blacklist/:id — 停用封禁规则
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const rule = await deactivateRule(req.params.id);
    // 2026-04-08 修复 — P2.02 审计日志：记录黑名单规则停用
    logAudit({
      adminId: req.user!.userId,
      action: 'blacklist.deactivate',
      targetType: 'blacklist_rule',
      targetId: req.params.id,
      changes: { before: { isActive: true }, after: { isActive: false } },
      ip: req.ip,
    });
    res.json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
});

export default router;
