/**
 * useTrending Hook — 趋势数据获取
 * 2026-04-09 新增 — P5.07 useTrending Hook
 * 变更类型：新增
 * 设计思路：
 *   1. 主数据源：trendingApi.prompts() / trendingApi.categories() / trendingApi.daily()
 *   2. 降级方案：API 不可用时 fallback 到 MOCK_PROMPTS 的 likes 排序
 *   3. 提供三个独立 hook，页面可按需组合
 * 参数：period / limit
 * 返回：各 hook 返回 { data, loading, error, refresh }
 * 影响范围：Trending 页面
 * 潜在风险：无已知风险
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { trendingApi, ApiError } from '@/lib/api';
import type { TrendingPeriod, CategoryTrending } from '@/lib/api';
import { MOCK_PROMPTS, type Prompt } from '../data/prompts';
import { mapPromptItem } from './usePrompts';

// ── useTrendingPrompts ──────────────────────────────────

export interface UseTrendingPromptsReturn {
  prompts: Prompt[];
  loading: boolean;
  error: string | null;
  isMockFallback: boolean;
  refresh: () => void;
}

export function useTrendingPrompts(period: TrendingPeriod = 'week', limit: number = 20): UseTrendingPromptsReturn {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockFallback, setIsMockFallback] = useState(false);
  const versionRef = useRef(0);

  const fetchData = useCallback(async () => {
    const version = ++versionRef.current;
    setLoading(true);
    setError(null);

    try {
      const items = await trendingApi.prompts({ period, limit });
      if (version !== versionRef.current) return;
      setPrompts(items.map(mapPromptItem));
      setIsMockFallback(false);
    } catch (err) {
      if (version !== versionRef.current) return;
      // mock 降级：按 likes 排序
      const sorted = [...MOCK_PROMPTS].sort((a, b) => b.likes - a.likes).slice(0, limit);
      setPrompts(sorted);
      setIsMockFallback(true);
      setError(err instanceof ApiError ? err.message : '加载失败，已切换到本地数据');
    } finally {
      if (version === versionRef.current) setLoading(false);
    }
  }, [period, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { prompts, loading, error, isMockFallback, refresh: fetchData };
}

// ── useTrendingCategories ───────────────────────────────

export interface UseTrendingCategoriesReturn {
  categories: CategoryTrending[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTrendingCategories(
  period: TrendingPeriod = 'month',
  limit: number = 10,
): UseTrendingCategoriesReturn {
  const [categories, setCategories] = useState<CategoryTrending[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const versionRef = useRef(0);

  const fetchData = useCallback(async () => {
    const version = ++versionRef.current;
    setLoading(true);
    setError(null);

    try {
      const items = await trendingApi.categories(period, limit);
      if (version !== versionRef.current) return;
      setCategories(items);
    } catch (err) {
      if (version !== versionRef.current) return;
      setCategories([]);
      setError(err instanceof ApiError ? err.message : '加载失败');
    } finally {
      if (version === versionRef.current) setLoading(false);
    }
  }, [period, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { categories, loading, error, refresh: fetchData };
}

// ── useDailyPicks ───────────────────────────────────────

export interface UseDailyPicksReturn {
  prompts: Prompt[];
  loading: boolean;
  error: string | null;
  isMockFallback: boolean;
  refresh: () => void;
}

export function useDailyPicks(limit: number = 12): UseDailyPicksReturn {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockFallback, setIsMockFallback] = useState(false);
  const versionRef = useRef(0);

  const fetchData = useCallback(async () => {
    const version = ++versionRef.current;
    setLoading(true);
    setError(null);

    try {
      const items = await trendingApi.daily(limit);
      if (version !== versionRef.current) return;
      setPrompts(items.map(mapPromptItem));
      setIsMockFallback(false);
    } catch (err) {
      if (version !== versionRef.current) return;
      // mock 降级：随机选取
      const shuffled = [...MOCK_PROMPTS].sort(() => Math.random() - 0.5).slice(0, limit);
      setPrompts(shuffled);
      setIsMockFallback(true);
      setError(err instanceof ApiError ? err.message : '加载失败，已切换到本地数据');
    } finally {
      if (version === versionRef.current) setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { prompts, loading, error, isMockFallback, refresh: fetchData };
}
