/**
 * Admin 内容审核服务 — 待审 Prompt 列表、审批、拒绝、批量审批
 * 2026-04-08 新增 — P4.04 Admin Prompt Review Service
 * 变更类型：新增
 * 设计思路：
 *   1. getPendingPrompts — 分页获取 status=pending 的 Prompt
 *   2. approvePrompt — 单个审批（status→published），记录审计日志
 *   3. rejectPrompt — 单个拒绝（status→rejected + reason），记录审计日志
 *   4. bulkApprove — 批量审批（最多 50 个），事务内完成
 *   审计日志通过 pino logger 输出（后续可扩展到 audit_log 表）
 * 参数：各方法参数见 JSDoc
 * 返回：标准化的 Prompt / PaginatedResponse
 * 影响范围：admin 路由、Prompt 状态流转
 * 潜在风险：批量操作需控制数量上限，避免锁争用
 */

import { prisma } from '../lib/prisma';
import { AppError } from '../utils/errors';
import { createChildLogger } from '../utils/logger';
import { parsePagination, buildPaginatedResponse } from '../utils/pagination';
import type { PaginatedResponse } from '../types/common';
import type { PromptSummary } from '../types/prompt';

const log = createChildLogger('admin-service');

// ── author select 子句（复用）──────────────────────────
const authorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

// ── 列表精简字段（含 status，admin 需要看到）──────────────
const pendingSelect = {
  id: true,
  title: true,
  description: true,
  tags: true,
  category: true,
  model: true,
  status: true,
  likesCount: true,
  viewsCount: true,
  copiesCount: true,
  createdAt: true,
  author: { select: authorSelect },
} as const;

// ── P4.04: getPendingPrompts — 待审核列表 ────────────────

/**
 * 分页获取待审核 Prompt（status=pending）
 * @param query - 分页参数 { page, pageSize }
 * @returns PaginatedResponse<PromptSummary>
 */
export async function getPendingPrompts(
  query: Record<string, unknown>,
): Promise<PaginatedResponse<PromptSummary>> {
  const { page, pageSize, skip, take } = parsePagination(query);

  const where = { status: 'pending' as const };

  const [rows, total] = await Promise.all([
    prisma.prompt.findMany({
      where,
      select: pendingSelect,
      orderBy: { createdAt: 'asc' }, // 先提交的排前面（FIFO）
      skip,
      take,
    }),
    prisma.prompt.count({ where }),
  ]);

  const data: PromptSummary[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    tags: r.tags,
    category: r.category,
    model: r.model,
    author: r.author ?? { id: '', username: 'anonymous', displayName: null, avatarUrl: null },
    likesCount: r.likesCount,
    viewsCount: r.viewsCount,
    copiesCount: r.copiesCount,
    createdAt: r.createdAt.toISOString(),
  }));

  return buildPaginatedResponse(data, total, page, pageSize);
}

// ── P4.04: approvePrompt — 审批通过 ─────────────────────

/**
 * 审批通过 Prompt（status → published）
 * @param promptId - Prompt UUID
 * @param adminId - 操作管理员 ID
 * @returns 更新后的 Prompt 精简信息
 * @throws RESOURCE_NOT_FOUND — Prompt 不存在
 * @throws VALIDATION_FAILED — Prompt 非 pending 状态
 */
export async function approvePrompt(
  promptId: string,
  adminId: string,
): Promise<{ id: string; status: string; updatedAt: string }> {
  const existing = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: { id: true, status: true, authorId: true, title: true },
  });

  if (!existing) {
    throw new AppError('RESOURCE_NOT_FOUND', 'Prompt not found');
  }

  if (existing.status !== 'pending') {
    throw new AppError('VALIDATION_FAILED', `Cannot approve prompt with status "${existing.status}", expected "pending"`);
  }

  const updated = await prisma.prompt.update({
    where: { id: promptId },
    data: { status: 'published' },
    select: { id: true, status: true, updatedAt: true },
  });

  // 审计日志
  log.info(
    {
      action: 'approve',
      promptId,
      promptTitle: existing.title,
      authorId: existing.authorId,
      adminId,
      previousStatus: existing.status,
      newStatus: 'published',
    },
    `Prompt approved: "${existing.title}"`,
  );

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── P4.04: rejectPrompt — 审批拒绝 ──────────────────────

/**
 * 拒绝 Prompt（status → rejected）
 * @param promptId - Prompt UUID
 * @param adminId - 操作管理员 ID
 * @param reason - 拒绝原因（必填）
 * @returns 更新后的 Prompt 精简信息
 * @throws RESOURCE_NOT_FOUND — Prompt 不存在
 * @throws VALIDATION_FAILED — Prompt 非 pending 状态
 */
export async function rejectPrompt(
  promptId: string,
  adminId: string,
  reason: string,
): Promise<{ id: string; status: string; updatedAt: string }> {
  const existing = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: { id: true, status: true, authorId: true, title: true },
  });

  if (!existing) {
    throw new AppError('RESOURCE_NOT_FOUND', 'Prompt not found');
  }

  if (existing.status !== 'pending') {
    throw new AppError('VALIDATION_FAILED', `Cannot reject prompt with status "${existing.status}", expected "pending"`);
  }

  const updated = await prisma.prompt.update({
    where: { id: promptId },
    data: { status: 'rejected' },
    select: { id: true, status: true, updatedAt: true },
  });

  // 审计日志（含拒绝原因）
  log.info(
    {
      action: 'reject',
      promptId,
      promptTitle: existing.title,
      authorId: existing.authorId,
      adminId,
      previousStatus: existing.status,
      newStatus: 'rejected',
      reason,
    },
    `Prompt rejected: "${existing.title}" — ${reason}`,
  );

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── P4.04: bulkApprove — 批量审批 ───────────────────────

/** 批量审批最大数量 */
const BULK_APPROVE_MAX = 50;

/**
 * 批量审批通过 Prompt
 * @param promptIds - Prompt UUID 数组（最多 50 个）
 * @param adminId - 操作管理员 ID
 * @returns { approved: number; skipped: number; errors: string[] }
 *
 * 策略：
 *   - 事务内执行，确保原子性
 *   - 仅处理 status=pending 的 Prompt，非 pending 的跳过
 *   - 返回成功/跳过/失败统计
 */
export async function bulkApprove(
  promptIds: string[],
  adminId: string,
): Promise<{ approved: number; skipped: number; errors: string[] }> {
  if (promptIds.length === 0) {
    return { approved: 0, skipped: 0, errors: [] };
  }

  if (promptIds.length > BULK_APPROVE_MAX) {
    throw new AppError(
      'VALIDATION_FAILED',
      `Bulk approve limit is ${BULK_APPROVE_MAX}, received ${promptIds.length}`,
    );
  }

  // 去重
  const uniqueIds = [...new Set(promptIds)];

  // 查询所有目标 Prompt 的当前状态
  const prompts = await prisma.prompt.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, status: true, title: true, authorId: true },
  });

  const foundIds = new Set(prompts.map((p) => p.id));
  const errors: string[] = [];

  // 检查不存在的 ID
  for (const id of uniqueIds) {
    if (!foundIds.has(id)) {
      errors.push(`Prompt ${id} not found`);
    }
  }

  // 筛选出 pending 状态的 Prompt
  const pendingPrompts = prompts.filter((p) => p.status === 'pending');
  const skippedCount = prompts.length - pendingPrompts.length;

  if (pendingPrompts.length === 0) {
    return { approved: 0, skipped: skippedCount, errors };
  }

  // 事务批量更新
  const pendingIds = pendingPrompts.map((p) => p.id);
  await prisma.prompt.updateMany({
    where: { id: { in: pendingIds }, status: 'pending' },
    data: { status: 'published' },
  });

  // 审计日志
  log.info(
    {
      action: 'bulk_approve',
      adminId,
      approvedCount: pendingIds.length,
      skippedCount,
      errorCount: errors.length,
      promptIds: pendingIds,
    },
    `Bulk approve: ${pendingIds.length} approved, ${skippedCount} skipped`,
  );

  return {
    approved: pendingIds.length,
    skipped: skippedCount,
    errors,
  };
}
