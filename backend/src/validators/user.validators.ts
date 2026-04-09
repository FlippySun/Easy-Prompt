/**
 * User 请求体/查询参数 Zod 校验 Schema
 * 2026-04-08 新增 — P3.11 User Validators
 * 设计思路：集中定义 User 相关端点的输入校验规则
 * 影响范围：user 路由的入参校验
 * 潜在风险：无已知风险
 */

import { z } from 'zod';

// ── 路径参数 :id ──────────────────────────────────────
export const userIdParams = z.object({
  id: z.string().uuid('Invalid user ID'),
});

// ── 更新资料 ──────────────────────────────────────────
export const updateProfileBody = z.object({
  displayName: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url('Invalid URL').max(500).optional(),
});

// ── 通用分页查询参数 ──────────────────────────────────
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});
