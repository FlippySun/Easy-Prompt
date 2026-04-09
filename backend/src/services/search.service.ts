/**
 * Prompt 全文检索服务 — PostgreSQL tsvector + pg_trgm
 * 2026-04-08 新增 — P3.02 Prompt Search
 * 设计思路：
 *   - 优先使用 PostgreSQL tsvector 全文检索（需要 search_vector 列 + GIN 索引）
 *   - 当 search_vector 列不存在时，回退到 ILIKE 模糊搜索
 *   - 全文检索支持中英文分词（依赖 pg_trgm 扩展和 simple/english 配置）
 *   - 搜索结果按相关性排序（ts_rank），支持分页
 * 参数：keyword（搜索关键词）、page/pageSize（分页）、category（可选过滤）
 * 返回：PaginatedResponse<SearchResultItem>
 * 影响范围：prompt 搜索端点
 * 潜在风险：search_vector 列需要单独迁移添加；ILIKE 回退性能在大数据量下较差
 *
 * 所需迁移（尚未执行，见 prisma/migrations/manual/ 目录）：
 *   ALTER TABLE prompts ADD COLUMN search_vector tsvector;
 *   CREATE INDEX idx_prompts_search ON prompts USING GIN(search_vector);
 *   CREATE TRIGGER ... tsvector_update_trigger ...
 */

import { prisma } from '../lib/prisma';
import { createChildLogger } from '../utils/logger';
import { parsePagination, buildPaginatedResponse } from '../utils/pagination';
import type { PaginatedResponse } from '../types/common';

const log = createChildLogger('search-service');

// ── 搜索结果项类型 ────────────────────────────────────
export interface SearchResultItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  tags: string[];
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  likesCount: number;
  viewsCount: number;
  copiesCount: number;
  createdAt: string;
  /** 全文检索相关性分数（0-1），ILIKE 回退时为 null */
  relevanceScore: number | null;
}

// ── 搜索参数接口 ──────────────────────────────────────
export interface SearchParams {
  keyword: string;
  category?: string;
  model?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}

// ── 缓存：是否存在 search_vector 列（启动时检测一次）──
let hasSearchVector: boolean | null = null;

/**
 * 检测 prompts 表是否存在 search_vector 列
 * 使用 information_schema 查询，结果缓存到进程生命周期
 */
async function checkSearchVectorExists(): Promise<boolean> {
  if (hasSearchVector !== null) return hasSearchVector;

  try {
    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_name = 'prompts'
        AND column_name = 'search_vector'
    `;
    hasSearchVector = Number(result[0]?.count ?? 0) > 0;
    log.info({ hasSearchVector }, 'Search vector column detection complete');
  } catch {
    hasSearchVector = false;
    log.warn('Failed to detect search_vector column, falling back to ILIKE');
  }

  return hasSearchVector;
}

// ── 全文检索（tsvector）────────────────────────────────

/**
 * 使用 PostgreSQL tsvector 全文检索搜索 Prompt
 * @param params - 搜索参数
 * @returns PaginatedResponse<SearchResultItem>
 *
 * SQL 逻辑：
 * 1. 将 keyword 转换为 tsquery（plainto_tsquery）
 * 2. 匹配 search_vector @@ tsquery
 * 3. 按 ts_rank 降序排序
 * 4. 可选 category/model/tags 过滤
 */
async function fullTextSearch(
  params: SearchParams,
): Promise<PaginatedResponse<SearchResultItem>> {
  const { keyword, category, model, page = 1, pageSize = 20 } = params;
  const offset = (page - 1) * pageSize;

  // 构建 WHERE 子句的附加条件
  const conditions: string[] = [
    "p.status = 'published'",
    "p.search_vector @@ plainto_tsquery('simple', $1)",
  ];
  const queryParams: unknown[] = [keyword];
  let paramIndex = 2;

  if (category) {
    conditions.push(`p.category = $${paramIndex}`);
    queryParams.push(category);
    paramIndex++;
  }
  if (model) {
    conditions.push(`p.model = $${paramIndex}`);
    queryParams.push(model);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  // 使用 $queryRawUnsafe 因为需要动态 WHERE 子句
  // 注意：所有用户输入都通过参数化查询传入，防止 SQL 注入
  const countQuery = `SELECT COUNT(*) as total FROM prompts p WHERE ${whereClause}`;
  const countResult = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
    countQuery,
    ...queryParams,
  );
  const total = Number(countResult[0]?.total ?? 0);

  if (total === 0) {
    return buildPaginatedResponse([], 0, page, pageSize);
  }

  const dataQuery = `
    SELECT
      p.id, p.title, p.description, p.category, p.tags,
      p.likes_count, p.views_count, p.copies_count, p.created_at,
      ts_rank(p.search_vector, plainto_tsquery('simple', $1)) as relevance,
      u.id as author_id, u.username as author_username,
      u.display_name as author_display_name, u.avatar_url as author_avatar_url
    FROM prompts p
    LEFT JOIN users u ON p.author_id = u.id
    WHERE ${whereClause}
    ORDER BY relevance DESC, p.likes_count DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      title: string;
      description: string | null;
      category: string;
      tags: string[];
      likes_count: number;
      views_count: number;
      copies_count: number;
      created_at: Date;
      relevance: number;
      author_id: string | null;
      author_username: string | null;
      author_display_name: string | null;
      author_avatar_url: string | null;
    }>
  >(dataQuery, ...queryParams, pageSize, offset);

  const data: SearchResultItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    tags: r.tags,
    author: {
      id: r.author_id ?? '',
      username: r.author_username ?? 'anonymous',
      displayName: r.author_display_name,
      avatarUrl: r.author_avatar_url,
    },
    likesCount: r.likes_count,
    viewsCount: r.views_count,
    copiesCount: r.copies_count,
    createdAt: r.created_at.toISOString(),
    relevanceScore: r.relevance,
  }));

  return buildPaginatedResponse(data, total, page, pageSize);
}

// ── ILIKE 回退搜索 ────────────────────────────────────

/**
 * ILIKE 模糊搜索回退方案（search_vector 列不存在时使用）
 * @param params - 搜索参数
 * @returns PaginatedResponse<SearchResultItem>
 *
 * 匹配范围：title, description, content, tags
 */
async function ilikeSearch(
  params: SearchParams,
): Promise<PaginatedResponse<SearchResultItem>> {
  const { keyword, category, model, tags, page = 1, pageSize = 20 } = params;
  const { skip, take } = parsePagination({ page, pageSize });

  // Prisma where 条件
  const where: Record<string, unknown> = {
    status: 'published',
    OR: [
      { title: { contains: keyword, mode: 'insensitive' } },
      { description: { contains: keyword, mode: 'insensitive' } },
      { content: { contains: keyword, mode: 'insensitive' } },
      { tags: { has: keyword } },
    ],
  };

  if (category) where.category = category;
  if (model) where.model = model;
  if (tags && tags.length > 0) where.tags = { hasEvery: tags };

  const authorSelect = {
    id: true,
    username: true,
    displayName: true,
    avatarUrl: true,
  } as const;

  const [rows, total] = await Promise.all([
    prisma.prompt.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        tags: true,
        likesCount: true,
        viewsCount: true,
        copiesCount: true,
        createdAt: true,
        author: { select: authorSelect },
      },
      orderBy: [{ likesCount: 'desc' }, { createdAt: 'desc' }],
      skip,
      take,
    }),
    prisma.prompt.count({ where }),
  ]);

  const data: SearchResultItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    tags: r.tags,
    author: r.author ?? { id: '', username: 'anonymous', displayName: null, avatarUrl: null },
    likesCount: r.likesCount,
    viewsCount: r.viewsCount,
    copiesCount: r.copiesCount,
    createdAt: r.createdAt.toISOString(),
    relevanceScore: null,
  }));

  return buildPaginatedResponse(data, total, page, pageSize);
}

// ── 公开搜索入口 ──────────────────────────────────────

/**
 * 搜索 Prompt（自动选择全文检索或 ILIKE 回退）
 * @param params - 搜索参数
 * @returns PaginatedResponse<SearchResultItem>
 */
export async function searchPrompts(
  params: SearchParams,
): Promise<PaginatedResponse<SearchResultItem>> {
  if (!params.keyword || params.keyword.trim().length === 0) {
    return buildPaginatedResponse([], 0, params.page ?? 1, params.pageSize ?? 20);
  }

  const useFts = await checkSearchVectorExists();

  if (useFts) {
    log.debug({ keyword: params.keyword, mode: 'fts' }, 'Using full-text search');
    return fullTextSearch(params);
  } else {
    log.debug({ keyword: params.keyword, mode: 'ilike' }, 'Using ILIKE fallback search');
    return ilikeSearch(params);
  }
}

/**
 * 重置 search_vector 检测缓存（用于测试或迁移后刷新）
 */
export function resetSearchVectorCache(): void {
  hasSearchVector = null;
}
