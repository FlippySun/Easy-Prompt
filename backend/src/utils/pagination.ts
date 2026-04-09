/**
 * 分页/排序工具函数
 * 2026-04-08 新增 — P3.13
 * 设计思路：统一分页参数解析、排序字段白名单校验、分页响应构建
 *   所有 list 类 API 复用此模块，确保一致的分页行为
 * 参数：query 对象（来自 req.query）、允许的排序字段白名单
 * 返回：标准化的分页参数和 Prisma orderBy 对象
 * 影响范围：所有分页列表接口（Prompt/Collection/User 等）
 * 潜在风险：无已知风险
 */

import { PAGINATION } from '../config/constants';
import type { PaginatedResponse, PaginationMeta } from '../types/common';

// ── 分页参数解析 ──────────────────────────────────────

export interface ParsedPagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

/**
 * 解析分页查询参数
 * @param query - req.query 对象，期望含 page / pageSize
 * @returns 标准化的分页参数（含 Prisma 所需的 skip/take）
 *
 * 规则：
 * - page 默认 1，最小 1
 * - pageSize 默认 20，最小 1，最大 100
 */
export function parsePagination(query: Record<string, unknown>): ParsedPagination {
  const rawPage = Number(query.page) || PAGINATION.DEFAULT_PAGE;
  const rawPageSize = Number(query.pageSize ?? query.limit) || PAGINATION.DEFAULT_LIMIT;

  const page = Math.max(1, Math.floor(rawPage));
  const pageSize = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, Math.floor(rawPageSize)));
  const skip = (page - 1) * pageSize;

  return { page, pageSize, skip, take: pageSize };
}

// ── 排序参数解析 ──────────────────────────────────────

/**
 * 解析排序查询参数
 * @param query - req.query 对象，期望含 sort（格式：`field:dir,field2:dir2`）
 * @param allowedFields - 允许排序的字段白名单
 * @param defaultSort - 默认排序（无有效 sort 参数时使用）
 * @returns Prisma orderBy 数组
 *
 * 格式示例：sort=created_at:desc,like_count:asc
 * 安全：仅白名单字段可排序，非法字段静默忽略
 */
export function parseSort(
  query: Record<string, unknown>,
  allowedFields: string[],
  defaultSort: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' },
): Record<string, 'asc' | 'desc'>[] {
  const sortStr = typeof query.sort === 'string' ? query.sort.trim() : '';
  if (!sortStr) {
    return [defaultSort];
  }

  // 数据库列名 → Prisma 字段名映射（snake_case → camelCase）
  const fieldMap: Record<string, string> = {};
  for (const f of allowedFields) {
    fieldMap[f] = f;
    // 支持 snake_case 输入映射到 camelCase
    const snake = f.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
    if (snake !== f) {
      fieldMap[snake] = f;
    }
  }

  const result: Record<string, 'asc' | 'desc'>[] = [];

  for (const part of sortStr.split(',')) {
    const [rawField, rawDir] = part.trim().split(':');
    if (!rawField) continue;

    const prismaField = fieldMap[rawField.trim()];
    if (!prismaField) continue; // 非白名单字段静默跳过

    const dir = rawDir?.trim().toLowerCase() === 'asc' ? 'asc' : 'desc';
    result.push({ [prismaField]: dir });
  }

  return result.length > 0 ? result : [defaultSort];
}

// ── 分页响应构建 ──────────────────────────────────────

/**
 * 构建标准分页响应
 * @param data - 当前页数据数组
 * @param total - 总记录数
 * @param page - 当前页码
 * @param pageSize - 每页大小
 * @returns PaginatedResponse<T>，含 data 和 meta（page, limit, total, totalPages）
 */
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / pageSize);
  const meta: PaginationMeta = {
    total,
    page,
    limit: pageSize,
    totalPages,
  };

  return { data, meta };
}
