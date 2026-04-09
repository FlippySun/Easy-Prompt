/**
 * Admin Dashboard — 管理后台仪表盘
 * 2026-04-09 新增 — P6.05
 * 变更类型：新增
 * 设计思路：
 *   展示系统核心指标卡片（用户数、Prompt 数、AI 请求数、活跃 Provider）
 *   使用 adminApi.dashboardStats() 获取数据
 * 影响范围：/admin 路由
 * 潜在风险：无已知风险
 */

import { useEffect, useState } from 'react';
import { adminApi } from '../../../lib/api';
import type { DashboardStats } from '../../../lib/api';

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      </div>
    );
  }

  const cards = [
    { label: '总用户数', value: stats?.totalUsers ?? 0, icon: '👥', color: 'indigo' },
    { label: '总 Prompt 数', value: stats?.totalPrompts ?? 0, icon: '📝', color: 'emerald' },
    { label: 'AI 请求总量', value: stats?.totalAiRequests ?? 0, icon: '🤖', color: 'amber' },
    { label: '活跃 Provider', value: stats?.activeProviders ?? 0, icon: '🔌', color: 'cyan' },
    { label: '近 7 天新用户', value: stats?.recentUsers ?? 0, icon: '🆕', color: 'purple' },
    { label: '近 7 天 AI 请求', value: stats?.recentAiRequests ?? 0, icon: '⚡', color: 'rose' },
  ];

  const colorMap: Record<string, string> = {
    indigo: 'from-indigo-500/20 to-indigo-500/5 border-indigo-500/20',
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/20',
    cyan: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/20',
    purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/20',
    rose: 'from-rose-500/20 to-rose-500/5 border-rose-500/20',
  };

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-100">仪表盘</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className={`rounded-xl border bg-linear-to-br p-5 ${colorMap[card.color]}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">{card.label}</span>
              <span className="text-2xl">{card.icon}</span>
            </div>
            <div className="mt-2 text-3xl font-bold text-gray-100">{card.value.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
