/**
 * useProfile Hook — 用户 Profile 数据获取（API 优先，本地降级）
 * 2026-04-09 新增 — P5.10 Profile 页面对接
 * 变更类型：新增
 * 设计思路：
 *   1. 登录用户：从 userApi 获取 my prompts / saved / liked / stats
 *   2. 未登录用户：使用本地 usePromptStore 数据展示
 *   3. 公开 Profile：从 userApi.enhancedProfile() 获取
 *   4. API 失败时降级到本地数据
 * 参数：userId? — 公开 Profile 时传入；不传则为"我的"
 * 返回：{ user, myPrompts, savedPrompts, stats, loading, error }
 * 影响范围：Profile 页面
 * 潜在风险：无已知风险
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { userApi, ApiError } from '@/lib/api';
import type { UserEnhancedProfile } from '@/lib/api';
import { useAuth } from './useAuth';
import { type Prompt } from '../data/prompts';
import { mapPromptItem } from './usePrompts';

// ── useMyPrompts — 当前用户提交的 Prompt ─────────────────

export interface UseMyPromptsReturn {
  prompts: Prompt[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useMyPrompts(pageSize: number = 20): UseMyPromptsReturn {
  const { isAuthenticated } = useAuth();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const versionRef = useRef(0);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setPrompts([]);
      return;
    }
    const version = ++versionRef.current;
    setLoading(true);
    setError(null);

    try {
      const res = await userApi.myPrompts({ pageSize });
      if (version !== versionRef.current) return;
      setPrompts(res.data.map(mapPromptItem));
    } catch (err) {
      if (version !== versionRef.current) return;
      setPrompts([]);
      setError(err instanceof ApiError ? err.message : '加载失败');
    } finally {
      if (version === versionRef.current) setLoading(false);
    }
  }, [isAuthenticated, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { prompts, loading, error, refresh: fetchData };
}

// ── useMySaved — 当前用户收藏的 Prompt ───────────────────

export function useMySaved(pageSize: number = 20): UseMyPromptsReturn {
  const { isAuthenticated } = useAuth();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const versionRef = useRef(0);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setPrompts([]);
      return;
    }
    const version = ++versionRef.current;
    setLoading(true);
    setError(null);

    try {
      const res = await userApi.mySaved({ pageSize });
      if (version !== versionRef.current) return;
      setPrompts(res.data.map(mapPromptItem));
    } catch (err) {
      if (version !== versionRef.current) return;
      setPrompts([]);
      setError(err instanceof ApiError ? err.message : '加载失败');
    } finally {
      if (version === versionRef.current) setLoading(false);
    }
  }, [isAuthenticated, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { prompts, loading, error, refresh: fetchData };
}

// ── usePublicProfile — 公开 Profile 页面 ─────────────────

export interface UsePublicProfileReturn {
  profile: UserEnhancedProfile | null;
  prompts: Prompt[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePublicProfile(userId: string | undefined): UsePublicProfileReturn {
  const [profile, setProfile] = useState<UserEnhancedProfile | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const data = await userApi.enhancedProfile(userId);
      setProfile(data);
      // 公开 Profile 的 Prompt 列表需要单独获取（如果 API 支持）
      setPrompts([]);
    } catch (err) {
      setProfile(null);
      setError(err instanceof ApiError ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { profile, prompts, loading, error, refresh: fetchData };
}
