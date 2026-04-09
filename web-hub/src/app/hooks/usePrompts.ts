/**
 * usePrompts Hook — Prompt 数据获取（API 优先，mock 降级）
 * 2026-04-09 新增 — P5.04 usePrompts Hook 迁移
 * 变更类型：新增
 * 设计思路：
 *   1. 主数据源：promptApi.list() / promptApi.detail() / promptApi.search()
 *   2. 降级方案：API 不可用时 fallback 到 MOCK_PROMPTS
 *   3. 内存缓存 + stale-while-revalidate 策略（简易版，无 React Query 依赖）
 *   4. 返回 { prompts, loading, error, hasMore, loadMore, refresh }
 *   5. 前端 Prompt 接口兼容：将 API PromptItem 映射为现有 Prompt 类型
 * 参数：filters — category / model / search / tags
 * 返回：UsePromptsReturn
 * 影响范围：所有使用 MOCK_PROMPTS 的页面和组件
 * 潜在风险：API 与 mock 数据结构差异需通过 mapPrompt 桥接
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { promptApi, ApiError } from '@/lib/api';
import type { PromptItem, PromptDetail, PromptListParams, PaginationMeta } from '@/lib/api';
import { MOCK_PROMPTS, type Prompt } from '../data/prompts';

// ── API PromptItem → 前端 Prompt 映射 ───────────────────

/**
 * 将后端 PromptItem 映射为前端已有的 Prompt 接口
 * 2026-04-09 — 桥接层，待全量迁移后可移除
 * 设计思路：保持向后兼容，现有组件无需改动即可消费 API 数据
 */
export function mapPromptItem(item: PromptItem): Prompt {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    content: item.content,
    tags: item.tags,
    category: item.category,
    // 2026-04-09 修复 — 字段名对齐后端实际返回（likesCount/viewsCount/copiesCount）
    likes: item.likesCount ?? 0,
    views: item.viewsCount ?? 0,
    copies: item.copiesCount ?? 0,
    author: item.author?.displayName || item.author?.username || 'Anonymous',
    authorAvatar: item.author?.avatarUrl ?? undefined,
    date: item.createdAt.slice(0, 10),
    model: item.model ?? undefined,
  };
}

/**
 * 将后端 PromptDetail 映射为前端 Prompt（含交互状态）
 */
export function mapPromptDetail(detail: PromptDetail): Prompt & { isLiked?: boolean; isSaved?: boolean } {
  return {
    ...mapPromptItem(detail),
    isLiked: detail.isLiked,
    isSaved: detail.isSaved,
  };
}

// ── Hook：usePrompts（列表） ─────────────────────────────

export interface UsePromptsParams {
  category?: string;
  model?: string;
  search?: string;
  tags?: string[];
  pageSize?: number;
  /** 是否启用 API（设为 false 强制使用 mock） */
  enableApi?: boolean;
}

export interface UsePromptsReturn {
  prompts: Prompt[];
  loading: boolean;
  error: string | null;
  /** 是否正在使用 mock 数据降级 */
  isMockFallback: boolean;
  /** 分页元信息 */
  meta: PaginationMeta | null;
  /** 是否还有更多数据 */
  hasMore: boolean;
  /** 加载下一页 */
  loadMore: () => void;
  /** 重新加载当前数据 */
  refresh: () => void;
}

export function usePrompts(params: UsePromptsParams = {}): UsePromptsReturn {
  const { category, model, search, tags, pageSize = 20, enableApi = true } = params;

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockFallback, setIsMockFallback] = useState(false);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);

  // 防止竞态：每次参数变化时递增版本号
  const versionRef = useRef(0);

  // 参数序列化（用于 useEffect 依赖）
  const filterKey = JSON.stringify({ category, model, search, tags, pageSize, enableApi });

  // ── 获取数据 ──
  const fetchData = useCallback(
    async (targetPage: number, append: boolean) => {
      const version = ++versionRef.current;

      if (!append) setLoading(true);
      setError(null);

      // ── Mock 降级模式 ──
      if (!enableApi) {
        if (version !== versionRef.current) return;
        const filtered = filterMockPrompts({ category, model, search, tags });
        setPrompts(filtered);
        setIsMockFallback(true);
        setMeta(null);
        setLoading(false);
        return;
      }

      // ── API 调用 ──
      try {
        const apiParams: PromptListParams = {
          page: targetPage,
          pageSize,
          category: category && category !== 'all' ? category : undefined,
          model: model && model !== 'all' ? model : undefined,
          search: search || undefined,
          tags: tags?.length ? tags : undefined,
        };

        const res = await promptApi.list(apiParams);
        if (version !== versionRef.current) return;

        const mapped = res.data.map(mapPromptItem);

        setPrompts(append ? (prev) => [...prev, ...mapped] : mapped);
        setMeta(res.meta);
        setIsMockFallback(false);
        setLoading(false);
      } catch (err) {
        if (version !== versionRef.current) return;

        // API 失败 → mock 降级
        const filtered = filterMockPrompts({ category, model, search, tags });
        setPrompts(filtered);
        setIsMockFallback(true);
        setMeta(null);
        setError(err instanceof ApiError ? err.message : '加载失败，已切换到本地数据');
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterKey],
  );

  // ── 参数变化时重新加载 ──
  useEffect(() => {
    setPage(1);
    fetchData(1, false);
  }, [fetchData]);

  // ── loadMore ──
  const loadMore = useCallback(() => {
    if (!meta || page >= meta.totalPages) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchData(nextPage, true);
  }, [meta, page, fetchData]);

  // ── refresh ──
  const refresh = useCallback(() => {
    setPage(1);
    fetchData(1, false);
  }, [fetchData]);

  const hasMore = meta ? page < meta.totalPages : false;

  return { prompts, loading, error, isMockFallback, meta, hasMore, loadMore, refresh };
}

// ── Hook：usePromptDetail（单个详情） ────────────────────

export interface UsePromptDetailReturn {
  prompt: (Prompt & { isLiked?: boolean; isSaved?: boolean }) | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePromptDetail(id: string | undefined): UsePromptDetailReturn {
  const [prompt, setPrompt] = useState<(Prompt & { isLiked?: boolean; isSaved?: boolean }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) {
      setPrompt(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const detail = await promptApi.detail(id);
      setPrompt(mapPromptDetail(detail));
    } catch (err) {
      // mock 降级
      const mock = MOCK_PROMPTS.find((p) => p.id === id);
      setPrompt(mock ?? null);
      setError(err instanceof ApiError ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { prompt, loading, error, refresh: fetchDetail };
}

// ── Hook：useRandomPrompts ──────────────────────────────

export function useRandomPrompts(count: number = 6, category?: string) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const items = await promptApi.random(count, category);
      setPrompts(items.map(mapPromptItem));
    } catch {
      // mock 降级：随机抽取
      const shuffled = [...MOCK_PROMPTS].sort(() => Math.random() - 0.5);
      setPrompts(shuffled.slice(0, count));
    } finally {
      setLoading(false);
    }
  }, [count, category]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { prompts, loading, refresh: fetch };
}

// ── Hook：useFeaturedPrompts ────────────────────────────

export function useFeaturedPrompts(limit: number = 10) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const items = await promptApi.featured(limit);
      setPrompts(items.map(mapPromptItem));
    } catch {
      // mock 降级：取 likes 最高的
      const sorted = [...MOCK_PROMPTS].sort((a, b) => b.likes - a.likes);
      setPrompts(sorted.slice(0, limit));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { prompts, loading, refresh: fetch };
}

// ── Mock 数据过滤辅助 ───────────────────────────────────

function filterMockPrompts(filters: { category?: string; model?: string; search?: string; tags?: string[] }): Prompt[] {
  let result = [...MOCK_PROMPTS];

  if (filters.category && filters.category !== 'all') {
    result = result.filter((p) => p.category === filters.category);
  }
  if (filters.model && filters.model !== 'all') {
    result = result.filter((p) => p.model === filters.model);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }
  if (filters.tags?.length) {
    result = result.filter((p) => filters.tags!.some((t) => p.tags.includes(t)));
  }

  return result;
}
