/**
 * useAchievements Hook — 成就数据获取（API 优先，mock 降级）
 * 2026-04-09 新增 — P5.06 useAchievements Hook 迁移
 * 变更类型：新增
 * 设计思路：
 *   1. 主数据源：achievementApi.list()（含用户解锁状态）
 *   2. 降级方案：API 不可用时 fallback 到 ACHIEVEMENTS mock 数据
 *   3. 未登录用户显示所有成就但不显示解锁状态
 * 参数：无
 * 返回：UseAchievementsReturn
 * 影响范围：Profile 页面成就展示区
 * 潜在风险：无已知风险
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { achievementApi, ApiError } from '@/lib/api';
import type { AchievementItem } from '@/lib/api';
import { ACHIEVEMENTS, type Achievement } from '../data/achievements';

// ── API AchievementItem → 前端 Achievement 映射 ─────────

/** 从 API 返回的成就，附加解锁时间 */
export type AchievementWithUnlock = Achievement & { unlockedAt?: string };

export function mapAchievementItem(item: AchievementItem): AchievementWithUnlock {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    icon: item.icon,
    color: item.color,
    rarity: item.rarity,
    category: item.category as Achievement['category'],
    unlockedAt: item.unlockedAt ?? undefined,
  };
}

// ── Hook ─────────────────────────────────────────────────

export interface UseAchievementsReturn {
  achievements: Achievement[];
  loading: boolean;
  error: string | null;
  isMockFallback: boolean;
  /** 手动触发成就条件检测 */
  checkAchievements: () => Promise<string[]>;
  refresh: () => void;
}

export function useAchievements(): UseAchievementsReturn {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockFallback, setIsMockFallback] = useState(false);

  const versionRef = useRef(0);

  const fetchData = useCallback(async () => {
    const version = ++versionRef.current;
    setLoading(true);
    setError(null);

    try {
      const items = await achievementApi.list();
      if (version !== versionRef.current) return;
      setAchievements(items.map(mapAchievementItem));
      setIsMockFallback(false);
    } catch (err) {
      if (version !== versionRef.current) return;
      setAchievements([...ACHIEVEMENTS]);
      setIsMockFallback(true);
      setError(err instanceof ApiError ? err.message : '加载失败，已切换到本地数据');
    } finally {
      if (version === versionRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const checkAchievements = useCallback(async (): Promise<string[]> => {
    try {
      const newlyUnlocked = await achievementApi.check();
      if (newlyUnlocked.length > 0) fetchData();
      return newlyUnlocked;
    } catch {
      return [];
    }
  }, [fetchData]);

  return { achievements, loading, error, isMockFallback, checkAchievements, refresh: fetchData };
}
