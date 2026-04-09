/**
 * Prompt 请求体/查询参数 Zod 校验 Schema
 * 2026-04-08 新增 — P3.03 Prompt Validators
 * 设计思路：集中定义 Prompt 相关端点的输入校验规则
 *   路由层通过 validate() 中间件引用这些 schema
 * 参数：Zod schema 导出
 * 影响范围：prompt 路由的入参校验
 * 潜在风险：无已知风险
 */

import { z } from 'zod';

// ── 通用常量 ──────────────────────────────────────────
const PROMPT_STATUSES = ['draft', 'pending', 'published', 'rejected'] as const;

// ── 列表查询参数 ──────────────────────────────────────
export const listPromptsQuery = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  // 2026-04-09 修改 — max 从 100 提升到 200，匹配 web-hub 全量加载需求
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(20),
  sort: z.string().optional(),
  category: z.string().max(50).optional(),
  model: z.string().max(50).optional(),
  tags: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
    ),
  status: z.enum(PROMPT_STATUSES).optional(),
  authorId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
});

// ── 路径参数 :id ──────────────────────────────────────
export const promptIdParams = z.object({
  id: z.string().uuid('Invalid prompt ID'),
});

// ── 创建 Prompt ──────────────────────────────────────
export const createPromptBody = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  content: z.string().min(1, 'Content is required').max(50000),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  category: z.string().min(1, 'Category is required').max(50),
  model: z.string().max(50).optional(),
  status: z.enum(PROMPT_STATUSES).optional().default('draft'),
});

// ── 更新 Prompt ──────────────────────────────────────
export const updatePromptBody = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  content: z.string().min(1).max(50000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  category: z.string().min(1).max(50).optional(),
  model: z.string().max(50).optional(),
  status: z.enum(PROMPT_STATUSES).optional(),
});

// ── Random 查询参数 ──────────────────────────────────
export const randomPromptsQuery = z.object({
  count: z.coerce.number().int().min(1).max(20).optional().default(6),
  category: z.string().max(50).optional(),
});

// ── Featured 查询参数 ────────────────────────────────
export const featuredPromptsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
});

// ── Search 查询参数（P3.02 全文检索）────────────────────
export const searchPromptsQuery = z.object({
  keyword: z.string().min(1, 'Keyword is required').max(200),
  page: z.coerce.number().int().min(1).optional().default(1),
  // 2026-04-09 修改 — max 从 100 提升到 200，与 listPromptsQuery 保持一致
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(20),
  category: z.string().max(50).optional(),
  model: z.string().max(50).optional(),
  tags: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
    ),
});
