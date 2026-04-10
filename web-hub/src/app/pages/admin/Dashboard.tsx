/**
 * Admin Dashboard — 管理后台仪表盘
 * 2026-04-09 新增 — P6.05
 * 2026-04-09 重构 — light-theme 设计，Lucide 图标替代 emoji，参考 sub2api 卡片风格
 * 变更类型：重构
 * 设计思路：
 *   顶部 KPI 卡片行（白色背景 + 彩色图标圆圈 + 数值 + 趋势标签）
 *   卡片网格 2x3 布局，每张卡片含 Lucide 图标、标签、数值
 *   配色参考 sub2api：白底卡片、柔和圆角、彩色图标背景
 * 参数：无（内部调用 adminApi.dashboardStats）
 * 返回：React 组件
 * 影响范围：/admin 路由
 * 潜在风险：无已知风险
 */

import { useEffect, useState } from 'react';
import { adminApi } from '../../../lib/api';
import type { DashboardStats } from '../../../lib/api';
import { Users, FileText, Cpu, Server, UserPlus, Zap, RefreshCw, AlertCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// 2026-04-09 重构 — 卡片配置：Lucide 图标 + 颜色方案
interface StatCard {
  label: string;
  key: keyof DashboardStats;
  icon: LucideIcon;
  /** 图标背景色 (Tailwind) */
  iconBg: string;
  /** 图标前景色 (Tailwind) */
  iconFg: string;
  /** 次要描述文字 */
  sub?: string;
}

const STAT_CARDS: StatCard[] = [
  { label: '总用户数', key: 'totalUsers', icon: Users, iconBg: 'bg-blue-50', iconFg: 'text-blue-500', sub: '注册用户' },
  {
    label: '总 Prompt 数',
    key: 'totalPrompts',
    icon: FileText,
    iconBg: 'bg-emerald-50',
    iconFg: 'text-emerald-500',
    sub: '已发布',
  },
  {
    label: 'AI 请求总量',
    key: 'totalAiRequests',
    icon: Cpu,
    iconBg: 'bg-amber-50',
    iconFg: 'text-amber-500',
    sub: '累计请求',
  },
  {
    label: '活跃 Provider',
    key: 'activeProviders',
    icon: Server,
    iconBg: 'bg-teal-50',
    iconFg: 'text-teal-500',
    sub: '当前可用',
  },
  {
    label: '近 7 天新用户',
    key: 'recentUsers',
    icon: UserPlus,
    iconBg: 'bg-violet-50',
    iconFg: 'text-violet-500',
    sub: '最近 7 天',
  },
  {
    label: '近 7 天 AI 请求',
    key: 'recentAiRequests',
    icon: Zap,
    iconBg: 'bg-rose-50',
    iconFg: 'text-rose-500',
    sub: '最近 7 天',
  },
];

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = () => {
    setLoading(true);
    setError(null);
    adminApi
      .dashboardStats()
      .then((data) => setStats(data))
      .catch((err) => setError(err.message || '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    adminApi
      .dashboardStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || '加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <AlertCircle className="h-6 w-6 text-red-500" />
        </div>
        <p className="mb-4 text-sm text-slate-600">{error}</p>
        <button
          onClick={fetchStats}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 + 刷新按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">管理控制台</h1>
          <p className="mt-0.5 text-xs text-slate-400">系统概览及核心指标监控</p>
        </div>
        <button
          onClick={fetchStats}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          刷新
        </button>
      </div>

      {/* KPI 卡片网格 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STAT_CARDS.map((card) => {
          const IconComp = card.icon;
          const value = stats?.[card.key] ?? 0;

          return (
            <div
              key={card.key}
              className="group rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400">{card.label}</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-800">{value.toLocaleString()}</p>
                  {card.sub && <p className="mt-1 text-[11px] text-slate-400">{card.sub}</p>}
                </div>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg} transition-transform group-hover:scale-105`}
                >
                  <IconComp className={`h-5 w-5 ${card.iconFg}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 占位 — 可扩展更多图表/列表区域 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/50">
          <p className="text-xs text-slate-400">更多数据面板 — 请查看「数据分析」页面</p>
        </div>
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/50">
          <p className="text-xs text-slate-400">系统状态 — 即将推出</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
