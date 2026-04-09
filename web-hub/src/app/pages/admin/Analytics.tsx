/**
 * Analytics Dashboard 页面
 * 2026-04-09 新增 — P6.08
 * 2026-04-10 修复 — P6.08 实现 4 个真实图表，消除占位 stub
 * 变更类型：修复
 * 设计思路：
 *   1) 汇总指标卡片 — 总请求数、成功率、平均延迟、总 Token、总成本
 *   2) 每日请求趋势 — AreaChart（成功/失败分区域）
 *   3) 客户端分布 — PieChart（各客户端类型请求占比）
 *   4) 成本报告 — BarChart（按 Provider+Model 的 Token 消耗与成本）
 *   所有数据来自后端 /api/v1/admin/analytics/* 端点（P2.04/P2.05 已实现）
 *   使用 recharts（已在 package.json 依赖中）
 * 影响范围：/admin/analytics 路由
 * 潜在风险：大时间跨度查询可能慢（后端已注释）
 */

import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { adminApi } from '../../../lib/api';
import type { AnalyticsSummary, DailyStatItem, ClientStatItem, CostReportItem } from '../../../lib/api';

// 2026-04-10 — 图表配色（暗色主题适配）
const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
const SUCCESS_COLOR = '#10b981';
const ERROR_COLOR = '#ef4444';

// 2026-04-10 — 日期范围快捷选项
const DATE_RANGE_PRESETS = [
  { label: '7 天', days: 7 },
  { label: '30 天', days: 30 },
  { label: '90 天', days: 90 },
] as const;

// ── 汇总指标卡片组件 ──────────────────────────────────────
// 设计思路：展示 5 个核心指标，一目了然
function SummaryCards({ summary }: { summary: AnalyticsSummary | null }) {
  const cards = summary
    ? [
        { label: '总请求数', value: summary.totalRequests.toLocaleString(), color: 'text-indigo-400' },
        {
          label: '成功率',
          value: `${summary.successRate}%`,
          color: summary.successRate >= 95 ? 'text-emerald-400' : 'text-amber-400',
        },
        {
          label: '平均延迟',
          value: `${summary.avgLatencyMs}ms`,
          color: summary.avgLatencyMs < 3000 ? 'text-emerald-400' : 'text-amber-400',
        },
        { label: '总 Token', value: summary.totalTokens.toLocaleString(), color: 'text-cyan-400' },
        { label: '总成本', value: `$${summary.totalCost.toFixed(4)}`, color: 'text-purple-400' },
      ]
    : Array(5).fill({ label: '—', value: '—', color: 'text-gray-500' });

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card, i) => (
        <div key={i} className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
          <p className="text-xs text-gray-500">{card.label}</p>
          <p className={`mt-1 text-xl font-bold ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── 每日趋势图组件 ────────────────────────────────────────
// 设计思路：AreaChart 双区域展示每日成功/失败请求量
// 2026-04-09 修复 — 对齐后端 DailyStat 字段：aiRequests/aiErrors 替代 successCount/errorCount
function DailyTrendChart({ data }: { data: DailyStatItem[] }) {
  // 格式化日期 + 派生 successCount（后端仅返回 aiRequests 和 aiErrors）
  const chartData = data.map((d) => ({
    ...d,
    dateLabel: new Date(d.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
    successCount: Math.max(0, d.aiRequests - d.aiErrors),
    errorCount: d.aiErrors,
  }));

  if (chartData.length === 0) {
    return <EmptyState message="暂无每日统计数据" />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <defs>
          <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={SUCCESS_COLOR} stopOpacity={0.3} />
            <stop offset="95%" stopColor={SUCCESS_COLOR} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorError" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={ERROR_COLOR} stopOpacity={0.3} />
            <stop offset="95%" stopColor={ERROR_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="dateLabel" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Area
          type="monotone"
          dataKey="successCount"
          name="成功"
          stroke={SUCCESS_COLOR}
          fillOpacity={1}
          fill="url(#colorSuccess)"
        />
        <Area
          type="monotone"
          dataKey="errorCount"
          name="失败"
          stroke={ERROR_COLOR}
          fillOpacity={1}
          fill="url(#colorError)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── 客户端分布饼图组件 ────────────────────────────────────
// 设计思路：PieChart 展示各客户端类型的请求占比
function ClientDistributionChart({ data }: { data: ClientStatItem[] }) {
  if (data.length === 0) {
    return <EmptyState message="暂无客户端分布数据" />;
  }

  const chartData = data.map((d) => ({
    name: d.clientType || 'unknown',
    value: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {chartData.map((_, idx) => (
            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── 成本报告柱状图组件 ────────────────────────────────────
// 设计思路：BarChart 展示各 Provider+Model 的请求量和 Token 消耗
function CostReportChart({ data }: { data: CostReportItem[] }) {
  if (data.length === 0) {
    return <EmptyState message="暂无成本报告数据" />;
  }

  // 合并 provider+model 作为标签
  const chartData = data
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((d) => ({
      label:
        `${d.provider}/${d.model}`.length > 24
          ? `${d.provider}/${d.model}`.slice(0, 22) + '…'
          : `${d.provider}/${d.model}`,
      count: d.count,
      totalTokens: d.totalTokens,
      totalCost: d.totalCost,
    }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
        <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Bar yAxisId="left" dataKey="count" name="请求数" fill="#6366f1" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="right" dataKey="totalTokens" name="Tokens" fill="#06b6d4" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 空状态占位组件 ────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-48 items-center justify-center text-gray-500">
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── 主页面组件 ──────────────────────────────────────────
export function Analytics() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [daily, setDaily] = useState<DailyStatItem[]>([]);
  const [byClient, setByClient] = useState<ClientStatItem[]>([]);
  const [costReport, setCostReport] = useState<CostReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState(30);

  // 2026-04-10 — 根据天数计算日期范围参数
  const buildDateParams = useCallback(() => {
    const to = new Date();
    const from = new Date(to.getTime() - rangeDays * 86400000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [rangeDays]);

  // 2026-04-10 — 并行加载所有分析数据
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = buildDateParams();
    try {
      const [summaryData, dailyData, clientData, costData] = await Promise.all([
        adminApi.analyticsSummary(params),
        adminApi.analyticsDaily(params),
        adminApi.analyticsByClient(params),
        adminApi.analyticsCost(params),
      ]);
      setSummary(summaryData);
      setDaily(dailyData);
      setByClient(clientData);
      setCostReport(costData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载分析数据失败');
    } finally {
      setLoading(false);
    }
  }, [buildDateParams]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div className="p-8">
      {/* 标题 + 日期范围切换 */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Analytics Dashboard</h1>
        <div className="flex gap-2">
          {DATE_RANGE_PRESETS.map((preset) => (
            <button
              key={preset.days}
              onClick={() => setRangeDays(preset.days)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                rangeDays === preset.days
                  ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
                  : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* 汇总指标卡片 */}
          <SummaryCards summary={summary} />

          {/* 图表 2×2 网格 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 每日请求趋势 */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-6">
              <h3 className="mb-4 text-sm font-medium text-gray-300">每日请求趋势</h3>
              <DailyTrendChart data={daily} />
            </div>

            {/* 客户端分布 */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-6">
              <h3 className="mb-4 text-sm font-medium text-gray-300">客户端分布</h3>
              <ClientDistributionChart data={byClient} />
            </div>

            {/* 成本报告 — 跨两列 */}
            <div className="col-span-1 rounded-xl border border-gray-800 bg-gray-900/40 p-6 lg:col-span-2">
              <h3 className="mb-4 text-sm font-medium text-gray-300">成本报告 — Provider / Model（Top 10）</h3>
              <CostReportChart data={costReport} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Analytics;
