/**
 * useCollections Hook — Collection 数据获取（API 优先，mock 降级）
 * 2026-04-09 新增 — P5.05 useCollections Hook 迁移
 * 变更类型：新增
 * 设计思路：
 *   1. 主数据源：collectionApi.list() / collectionApi.detail()
 *   2. 降级方案：API 不可用时 fallback 到 COLLECTIONS mock 数据
 *   3. 将 API CollectionItem 映射为前端 Collection 类型
 * 参数：filters — tags / difficulty / search
 * 返回：UseCollectionsReturn
 * 影响范围：Collections 页面、CollectionDetail 页面
 * 潜在风险：API 与 mock 数据结构差异需通过 mapCollection 桥接
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { collectionApi, ApiError } from '@/lib/api';
import type { CollectionItem, CollectionDetail as ApiCollectionDetail, PaginationMeta } from '@/lib/api';
import { COLLECTIONS, type Collection } from '../data/collections';
import { type Prompt } from '../data/prompts';
import { mapPromptItem } from './usePrompts';

// ── API CollectionItem → 前端 Collection 映射 ───────────

export function mapCollectionItem(item: CollectionItem): Collection {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    icon: item.icon ?? '📦',
    gradientFrom: item.gradientFrom ?? '#6366f1',
    gradientTo: item.gradientTo ?? '#8b5cf6',
    promptIds: [],
    tags: item.tags,
    savedCount: item.savedCount,
    difficulty: (item.difficulty as Collection['difficulty']) ?? '入门',
    estimatedTime: item.estimatedTime ?? '',
  };
}

export interface CollectionDetailMapped extends Collection {
  prompts: Prompt[];
  isSaved?: boolean;
}

export function mapCollectionDetail(detail: ApiCollectionDetail): CollectionDetailMapped {
  return {
    ...mapCollectionItem(detail),
    promptIds: detail.prompts.map((p) => p.id),
    prompts: detail.prompts.map(mapPromptItem),
    isSaved: detail.isSaved,
  };
}

// ── Hook：useCollections（列表） ──────────────────────────

export interface UseCollectionsParams {
  tags?: string[];
  difficulty?: string;
  search?: string;
  pageSize?: number;
  enableApi?: boolean;
}

export interface UseCollectionsReturn {
  collections: Collection[];
  loading: boolean;
  error: string | null;
  isMockFallback: boolean;
  meta: PaginationMeta | null;
  refresh: () => void;
}

export function useCollections(params: UseCollectionsParams = {}): UseCollectionsReturn {
  const { tags, difficulty, search, pageSize = 20, enableApi = true } = params;

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockFallback, setIsMockFallback] = useState(false);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);

  const versionRef = useRef(0);
  const filterKey = JSON.stringify({ tags, difficulty, search, pageSize, enableApi });

  const fetchData = useCallback(async () => {
    const version = ++versionRef.current;
    setLoading(true);
    setError(null);

    if (!enableApi) {
      if (version !== versionRef.current) return;
      setCollections(filterMockCollections({ tags, difficulty, search }));
      setIsMockFallback(true);
      setMeta(null);
      setLoading(false);
      return;
    }

    try {
      const res = await collectionApi.list({ tags, difficulty, search, pageSize });
      if (version !== versionRef.current) return;
      setCollections(res.data.map(mapCollectionItem));
      setMeta(res.meta);
      setIsMockFallback(false);
    } catch (err) {
      if (version !== versionRef.current) return;
      setCollections(filterMockCollections({ tags, difficulty, search }));
      setIsMockFallback(true);
      setError(err instanceof ApiError ? err.message : '加载失败，已切换到本地数据');
    } finally {
      if (version === versionRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { collections, loading, error, isMockFallback, meta, refresh: fetchData };
}

// ── Hook：useCollectionDetail ────────────────────────────

export interface UseCollectionDetailReturn {
  collection: CollectionDetailMapped | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useCollectionDetail(id: string | undefined): UseCollectionDetailReturn {
  const [collection, setCollection] = useState<CollectionDetailMapped | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) {
      setCollection(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const detail = await collectionApi.detail(id);
      setCollection(mapCollectionDetail(detail));
    } catch (err) {
      const mock = COLLECTIONS.find((c) => c.id === id);
      setCollection(mock ? { ...mock, prompts: [], isSaved: false } : null);
      setError(err instanceof ApiError ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { collection, loading, error, refresh: fetchDetail };
}

// ── Mock 数据过滤 ────────────────────────────────────────

function filterMockCollections(filters: { tags?: string[]; difficulty?: string; search?: string }): Collection[] {
  let result = [...COLLECTIONS];
  if (filters.difficulty) {
    result = result.filter((c) => c.difficulty === filters.difficulty);
  }
  if (filters.tags?.length) {
    result = result.filter((c) => filters.tags!.some((t) => c.tags.includes(t)));
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }
  return result;
}
