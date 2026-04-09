/**
 * Admin 路由入参校验 — Zod schemas
 * 2026-04-08 新增 — P4.05 Admin Validators
 * 变更类型：新增
 * 设计思路：集中定义 admin 路由的入参校验规则
 *   promptIdParams — :id 参数校验（UUID）
 *   rejectPromptBody — 拒绝原因校验（reason 必填，1-500 字符）
 *   bulkApproveBody — 批量审批校验（ids 数组，1-50 个 UUID）
 * 参数：各 schema 见定义
 * 影响范围：admin 路由
 * 潜在风险：无已知风险
 */

import { z } from 'zod';

/** :id 路由参数 — UUID 格式 */
export const adminPromptIdParams = z.object({
  id: z.string().uuid('Invalid prompt ID format'),
});

/** POST /admin/prompts/:id/reject — body */
export const rejectPromptBody = z.object({
  reason: z
    .string()
    .min(1, 'Reject reason is required')
    .max(500, 'Reject reason must be at most 500 characters'),
});

/** POST /admin/prompts/bulk-approve — body */
export const bulkApproveBody = z.object({
  ids: z
    .array(z.string().uuid('Each ID must be a valid UUID'))
    .min(1, 'At least one prompt ID is required')
    .max(50, 'Cannot bulk approve more than 50 prompts at once'),
});

/** GET /admin/prompts/pending — query（分页） */
export const pendingPromptsQuery = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

/** POST /admin/prompts/:id/feature — 标记精选（无 body） */
/** POST /admin/prompts/:id/unfeature — 取消精选（无 body） */
