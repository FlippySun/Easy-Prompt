/**
 * useMeta Hook — 分类 & 模型元数据获取（API 优先，静态降级）
 * 2026-04-09 新增 — P5.08 useMeta Hook (Categories + Models)
 * 变更类型：新增
 * 设计思路：
 *   1. 主数据源：metaApi.categories() / metaApi.models()
 *   2. 降级方案：API 不可用时 fallback 到 constants.ts 静态配置
 *   3. 元数据变动频率低，使用模块级缓存避免重复请求
 * 参数：无
 * 返回：{ categories, models, loading, error, refresh }
 * 影响范围：Home 分类筛选、Prompt 筛选、模型下拉
 * 潜在风险：无已知风险
 */

import { useState, useEffect, useCallback } from 'react';
import { metaApi, ApiError } from '@/lib/api';
import type { CategoryMeta, ModelMeta } from '@/lib/api';
import { CATEGORY_CONFIG, MODEL_CONFIG } from '../data/constants';

// ── 模块级缓存（避免多组件重复请求） ─────────────────────

let _cachedCategories: CategoryMeta[] | null = null;
let _cachedModels: ModelMeta[] | null = null;

// ── 静态数据 → API 类型适配 ──────────────────────────────

function fallbackCategories(): CategoryMeta[] {
  return Object.entries(CATEGORY_CONFIG).map(([key, c], i) => ({
    id: key,
    slug: key,
    label: c.label,
    labelEn: null,
    emoji: c.emoji ?? null,
    icon: null,
    color: c.color ?? null,
    bgColor: c.bg ?? null,
    darkBgColor: c.darkBg ?? null,
    darkColor: c.darkColor ?? null,
    sortOrder: i,
  }));
}

function fallbackModels(): ModelMeta[] {
  return Object.entries(MODEL_CONFIG).map(([key, m], i) => ({
    id: key,
    slug: key,
    label: m.label,
    color: m.color ?? null,
    sortOrder: i,
  }));
}

// ── Hook ─────────────────────────────────────────────────

export interface UseMetaReturn {
  categories: CategoryMeta[];
  models: ModelMeta[];
  loading: boolean;
  error: string | null;
  isMockFallback: boolean;
  refresh: () => void;
}

export function useMeta(): UseMetaReturn {
  const [categories, setCategories] = useState<CategoryMeta[]>(_cachedCategories ?? []);
  const [models, setModels] = useState<ModelMeta[]>(_cachedModels ?? []);
  const [loading, setLoading] = useState(!_cachedCategories);
  const [error, setError] = useState<string | null>(null);
  const [isMockFallback, setIsMockFallback] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [cats, mods] = await Promise.all([metaApi.categories(), metaApi.models()]);
      _cachedCategories = cats;
      _cachedModels = mods;
      setCategories(cats);
      setModels(mods);
      setIsMockFallback(false);
    } catch (err) {
      const fallCats = fallbackCategories();
      const fallMods = fallbackModels();
      setCategories(fallCats);
      setModels(fallMods);
      setIsMockFallback(true);
      setError(err instanceof ApiError ? err.message : '元数据加载失败，使用本地配置');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 如果已有缓存则跳过请求
    if (_cachedCategories && _cachedModels) {
      setCategories(_cachedCategories);
      setModels(_cachedModels);
      setLoading(false);
      return;
    }
    fetchData();
  }, [fetchData]);

  return { categories, models, loading, error, isMockFallback, refresh: fetchData };
}
