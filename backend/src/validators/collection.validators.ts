/**
 * Collection 请求体/查询参数 Zod 校验 Schema
 * 2026-04-08 新增 — P3.09 Collection Validators
 * 设计思路：集中定义 Collection 相关端点的输入校验规则
 * 影响范围：collection 路由的入参校验
 * 潜在风险：无已知风险
 */

import { z } from 'zod';

// ── 列表查询参数 ──────────────────────────────────────
export const listCollectionsQuery = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: z.string().optional(),
  tags: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((t) => t.trim()).filter(Boolean) : undefined)),
  difficulty: z.string().max(50).optional(),
  search: z.string().max(200).optional(),
});

// ── 路径参数 :id ──────────────────────────────────────
export const collectionIdParams = z.object({
  id: z.string().uuid('Invalid collection ID'),
});

// ── 创建 Collection ──────────────────────────────────
export const createCollectionBody = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  icon: z.string().max(50).optional(),
  gradientFrom: z.string().max(20).optional(),
  gradientTo: z.string().max(20).optional(),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  difficulty: z.string().max(50).optional(),
  estimatedTime: z.string().max(50).optional(),
  promptIds: z.array(z.string().uuid()).max(100).optional(),
});

// ── 更新 Collection ──────────────────────────────────
export const updateCollectionBody = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  icon: z.string().max(50).optional(),
  gradientFrom: z.string().max(20).optional(),
  gradientTo: z.string().max(20).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  difficulty: z.string().max(50).optional(),
  estimatedTime: z.string().max(50).optional(),
});

// ── Prompt 关联管理 ──────────────────────────────────
export const collectionPromptsBody = z.object({
  promptIds: z.array(z.string().uuid()).min(1, 'At least one prompt ID required').max(100),
});
