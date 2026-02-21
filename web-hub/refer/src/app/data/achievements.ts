export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category: 'explorer' | 'collector' | 'creator' | 'social' | 'power';
}

export const ACHIEVEMENTS: Achievement[] = [
  // Explorer
  { id: 'first_view', title: '初次探索', description: '欢迎来到 PromptHub！打开了第一个 Prompt 详情', icon: '🌱', color: '#10b981', rarity: 'common', category: 'explorer' },
  { id: 'explorer_10', title: '探索达人', description: '查看了 10 个不同 Prompt 详情', icon: '🗺️', color: '#06b6d4', rarity: 'common', category: 'explorer' },
  { id: 'explorer_20', title: '资深探索者', description: '查看了 20 个 Prompt 详情', icon: '🧭', color: '#0891b2', rarity: 'rare', category: 'explorer' },
  { id: 'all_categories', title: '全栈探索', description: '探索了全部 8 个分类', icon: '🌍', color: '#6366f1', rarity: 'epic', category: 'explorer' },
  { id: 'tag_explorer', title: '标签猎人', description: '通过标签发现了一个 Prompt', icon: '🏷️', color: '#7c3aed', rarity: 'common', category: 'explorer' },
  { id: 'random_explore', title: '随机冒险家', description: '使用随机探索功能发现 Prompt', icon: '🎲', color: '#8b5cf6', rarity: 'rare', category: 'explorer' },
  // Collector
  { id: 'first_save', title: '初次收藏', description: '第一次收藏了一个 Prompt', icon: '⭐', color: '#f59e0b', rarity: 'common', category: 'collector' },
  { id: 'save_5', title: '收藏控', description: '收藏了 5 个 Prompt', icon: '📚', color: '#d97706', rarity: 'common', category: 'collector' },
  { id: 'save_10', title: '收藏家', description: '收藏了 10 个 Prompt', icon: '🏛️', color: '#b45309', rarity: 'rare', category: 'collector' },
  { id: 'collection_visit', title: '合集达人', description: '浏览了 Prompt 合集页面', icon: '📦', color: '#059669', rarity: 'common', category: 'collector' },
  // Creator (copy = creating with AI)
  { id: 'first_copy', title: '复制新手', description: '第一次复制了一个 Prompt', icon: '📋', color: '#3b82f6', rarity: 'common', category: 'creator' },
  { id: 'copy_5', title: '复制能手', description: '累计复制 5 次', icon: '✂️', color: '#2563eb', rarity: 'common', category: 'creator' },
  { id: 'copy_10', title: '复制达人', description: '累计复制 10 次', icon: '⚡', color: '#1d4ed8', rarity: 'rare', category: 'creator' },
  { id: 'copy_25', title: '复制大师', description: '累计复制 25 次', icon: '🔥', color: '#dc2626', rarity: 'epic', category: 'creator' },
  { id: 'batch_export', title: '导出大师', description: '使用批量导出功能', icon: '📤', color: '#0891b2', rarity: 'rare', category: 'creator' },
  // Social
  { id: 'first_like', title: '初次点赞', description: '第一次点赞了一个 Prompt', icon: '❤️', color: '#ef4444', rarity: 'common', category: 'social' },
  { id: 'like_5', title: '点赞侠', description: '点赞了 5 个 Prompt', icon: '💕', color: '#ec4899', rarity: 'common', category: 'social' },
  { id: 'like_10', title: '点赞达人', description: '点赞了 10 个 Prompt', icon: '💖', color: '#db2777', rarity: 'rare', category: 'social' },
  // Power User
  { id: 'dark_mode', title: '暗黑骑士', description: '开启了暗黑模式', icon: '🌙', color: '#6d28d9', rarity: 'common', category: 'power' },
  { id: 'compare_used', title: '对比专家', description: '使用了 Prompt 对比功能', icon: '⚖️', color: '#7c3aed', rarity: 'rare', category: 'power' },
  { id: 'cmd_k', title: '命令行老手', description: '使用了命令面板（⌘K）', icon: '⌘', color: '#1d4ed8', rarity: 'rare', category: 'power' },
  { id: 'power_user', title: '超级用户', description: '解锁了 10 个以上成就', icon: '👑', color: '#f59e0b', rarity: 'legendary', category: 'power' },
];

export const RARITY_CONFIG: Record<Achievement['rarity'], { label: string; color: string; bg: string; darkBg: string; darkColor: string; glow: string }> = {
  common: { label: '普通', color: '#6b7280', bg: '#f3f4f6', darkBg: 'rgba(107,114,128,0.12)', darkColor: '#9ca3af', glow: '' },
  rare: { label: '稀有', color: '#3b82f6', bg: '#eff6ff', darkBg: 'rgba(59,130,246,0.15)', darkColor: '#60a5fa', glow: '0 0 12px rgba(59,130,246,0.3)' },
  epic: { label: '史诗', color: '#8b5cf6', bg: '#f5f3ff', darkBg: 'rgba(139,92,246,0.15)', darkColor: '#a78bfa', glow: '0 0 16px rgba(139,92,246,0.35)' },
  legendary: { label: '传说', color: '#f59e0b', bg: '#fffbeb', darkBg: 'rgba(245,158,11,0.15)', darkColor: '#fbbf24', glow: '0 0 20px rgba(245,158,11,0.4)' },
};

export const CATEGORY_LABELS: Record<Achievement['category'], string> = {
  explorer: '探索者',
  collector: '收藏家',
  creator: '创作者',
  social: '社交达人',
  power: '超级用户',
};
