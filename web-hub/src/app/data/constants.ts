/**
 * 集中管理的常量和工具函数
 * 消除 PromptCard / PromptDetailDrawer / CompareModal / Trending 等文件中的重复定义
 */

// ─── 分类颜色配置 ────────────────────────────────────────
export interface CategoryStyle {
  label: string;
  color: string;
  bg: string;
  darkBg: string;
  darkColor: string;
  emoji: string;
}

export const CATEGORY_CONFIG: Record<string, CategoryStyle> = {
  coding: {
    label: '编程开发',
    color: '#3b82f6',
    bg: '#eff6ff',
    darkBg: 'rgba(59,130,246,0.1)',
    darkColor: '#60a5fa',
    emoji: '💻',
  },
  writing: {
    label: '写作创作',
    color: '#8b5cf6',
    bg: '#f5f3ff',
    darkBg: 'rgba(139,92,246,0.1)',
    darkColor: '#a78bfa',
    emoji: '✍️',
  },
  marketing: {
    label: '营销文案',
    color: '#f59e0b',
    bg: '#fffbeb',
    darkBg: 'rgba(245,158,11,0.1)',
    darkColor: '#fbbf24',
    emoji: '📢',
  },
  art: {
    label: '图像生成',
    color: '#ec4899',
    bg: '#fdf2f8',
    darkBg: 'rgba(236,72,153,0.1)',
    darkColor: '#f472b6',
    emoji: '🎨',
  },
  productivity: {
    label: '效率工具',
    color: '#10b981',
    bg: '#ecfdf5',
    darkBg: 'rgba(16,185,129,0.1)',
    darkColor: '#34d399',
    emoji: '⚡',
  },
  education: {
    label: '学习教育',
    color: '#f97316',
    bg: '#fff7ed',
    darkBg: 'rgba(249,115,22,0.1)',
    darkColor: '#fb923c',
    emoji: '🎓',
  },
  business: {
    label: '商业分析',
    color: '#06b6d4',
    bg: '#ecfeff',
    darkBg: 'rgba(6,182,212,0.1)',
    darkColor: '#22d3ee',
    emoji: '📊',
  },
  life: {
    label: '生活助手',
    color: '#ef4444',
    bg: '#fef2f2',
    darkBg: 'rgba(239,68,68,0.1)',
    darkColor: '#f87171',
    emoji: '❤️',
  },
};

// ─── 模型配置 ────────────────────────────────────────────
export interface ModelStyle {
  label: string;
  color: string;
}

export const MODEL_CONFIG: Record<string, ModelStyle> = {
  gpt4: { label: 'GPT-4', color: '#10a37f' },
  gpt35: { label: 'GPT-3.5', color: '#10a37f' },
  claude: { label: 'Claude', color: '#d97706' },
  midjourney: { label: 'Midjourney', color: '#7c3aed' },
  dalle: { label: 'DALL-E', color: '#2563eb' },
  gemini: { label: 'Gemini', color: '#4285f4' },
};

/** MODEL_CONFIG 的简化 label 映射，兼容旧调用方式 */
export const MODEL_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(MODEL_CONFIG).map(([k, v]) => [k, v.label]),
);

// ─── 工具函数 ────────────────────────────────────────────

/** 格式化数字：>=10000 → Xw，>=1000 → Xk */
export function formatCount(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}
