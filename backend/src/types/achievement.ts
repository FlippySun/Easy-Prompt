/**
 * Achievement 相关类型
 * 2026-04-07 新增 — P1.06
 */

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type AchievementCategory = 'explorer' | 'collector' | 'creator' | 'social' | 'power';

export interface Achievement {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  rarity: AchievementRarity;
  category: AchievementCategory;
  conditionType: string | null;
  conditionValue: number | null;
}

export interface UserAchievementStatus {
  achievement: Achievement;
  unlocked: boolean;
  unlockedAt: string | null;
}
