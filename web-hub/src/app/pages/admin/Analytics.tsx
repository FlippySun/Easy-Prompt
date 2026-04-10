/**
 * Analytics Dashboard 页面
 * 2026-04-09 新增 — P6.08
 * 2026-04-09 重构 — light-theme 设计，参考 sub2api 卡片式图表风格
 * 变更类型：重构
 * 设计思路：
 *   1) 汇总指标卡片行 — 白底卡片 + Lucide 图标 + 彩色标识
 *   2) 每日请求趋势 — AreaChart（白底卡片容器，柔和配色）
 *   3) 客户端分布 — PieChart（白底卡片容器）
 *   4) 成本报告 — BarChart（白底卡片容器，跨两列）
 *   所有数据来自后端 /api/v1/admin/analytics/* 端点
 *   使用 recharts（已在 package.json 依赖中）
 *   图表 Tooltip/网格线适配 light-theme
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
import { Activity, CheckCircle, Clock, Coins, Hash, AlertCircle, BarChart3 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// 2026-04-09 重构 — 图表配色（light-theme 适配，柔和但可区分）
const CHART_COLORS = ['#14b8a6', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
const SUCCESS_COLOR = '#14b8a6';
const ERROR_COLOR = '#ef4444';

const DATE_RANGE_PRESETS = [
  { label: '7 天', days: 7 },
  { label: '30 天', days: 30 },
  { label: '90 天', days: 90 },
] as const;

// 2026-04-09 重构 — light-theme Tooltip 样式
const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)',
    fontSize: '12px',
  },
  labelStyle: { color: '#334155', fontWeight: 600 },
  itemStyle: { color: '#64748b' },
};

// ── 汇总指标卡片配置 ──────────────────────────────────────
interface SummaryCardConfig {
  label: string;
  getValue: (s: AnalyticsSummary) => string;
  getColor: (s: AnalyticsSummary) => string;
  icon: LucideIcon;
  iconBg: string;
  iconFg: string;
}

const SUMMARY_CARDS: SummaryCardConfig[] = [
  {
    label: '总请求数',
    getValue: (s) => s.totalRequests.toLocaleString(),
    getColor: () => 'text-slate-800',
    icon: Activity,
    iconBg: 'bg-blue-50',
    iconFg: 'text-blue-500',
  },
  {
    label: '成功率',
    getValue: (s) => `${s.successRate}%`,
    getColor: (s) => (s.successRate >= 95 ? 'text-emerald-600' : 'text-amber-600'),
    icon: CheckCircle,
    iconBg: 'bg-emerald-50',
    iconFg: 'text-emerald-500',
  },
  {
    label: '平均延迟',
    getValue: (s) => `${s.avgLatencyMs}ms`,
    getColor: (s) => (s.avgLatencyMs < 3000 ? 'text-slate-800' : 'text-amber-600'),
    icon: Clock,
    iconBg: 'bg-amber-50',
    iconFg: 'text-amber-500',
  },
  {
    label: '总 Token',
    getValue: (s) => s.totalTokens.toLocaleString(),
    getColor: () => 'text-slate-800',
    icon: Hash,
    iconBg: 'bg-teal-50',
    iconFg: 'text-teal-500',
  },
  {
    label: '总成本',
    getValue: (s) => `$${s.totalCost.toFixed(4)}`,
    getColor: () => 'text-slate-800',
    icon: Coins,
    iconBg: 'bg-violet-50',
    iconFg: 'text-violet-500',
  },
];

// ── 汇总指标卡片组件 ──────────────────────────────────────
function SummaryCards({ summary }: { summary: AnalyticsSummary | null }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {SUMMARY_CARDS.map((card, i) => {
        const IconComp = card.icon;
        const value = summary ? card.getValue(summary) : '--';
        const colorCls = summary ? card.getColor(summary) : 'text-slate-400';

        return (
          <div key={i} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-400">{card.label}</p>
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${card.iconBg}`}>
                <IconComp className={`h-3.5 w-3.5 ${card.iconFg}`} />
              </div>
            </div>
            <p className={`mt-2 text-xl font-bold tracking-tight ${colorCls}`}>{value}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── 每日趋势图组件 ────────────────────────────────────────
function DailyTrendChart({ data }: { data: DailyStatItem[] }) {
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
            <stop offset="5%" stopColor={SUCCESS_COLOR} stopOpacity={0.15} />
            <stop offset="95%" stopColor={SUCCESS_COLOR} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorError" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={ERROR_COLOR} stopOpacity={0.15} />
            <stop offset="95%" stopColor={ERROR_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="dateLabel" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Area
          type="monotone"
          dataKey="successCount"
          name="成功"
          stroke={SUCCESS_COLOR}
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorSuccess)"
        />
        <Area
          type="monotone"
          dataKey="errorCount"
          name="失败"
          stroke={ERROR_COLOR}
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorError)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── 客户端分布饼图组件 ────────────────────────────────────
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
        <Tooltip {...TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ color: '#64748b', fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── 成本报告柱状图组件 ────────────────────────────────────
function CostReportChart({ data }: { data: CostReportItem[] }) {
  if (data.length === 0) {
    return <EmptyState message="暂无成本报告数据" />;
  }

  const chartData = data
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((d) => ({
      label:
        `${d.provider}/${d.model}`.length > 24
          ? `${d.provider}/${d.model}`.slice(0, 22) + '...'
          : `${d.provider}/${d.model}`,
      count: d.count,
      totalTokens: d.totalTokens,
      totalCost: d.totalCost,
    }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="label"
          tick={{ fill: '#94a3b8', fontSize: 10 }}
          angle={-15}
          textAnchor="end"
          height={60}
          axisLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={{ stroke: '#e2e8f0' }}
        />
        <Tooltip {...TOOLTIP_STYLE} />
        <Bar yAxisId="left" dataKey="count" name="请求数" fill="#6366f1" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="right" dataKey="totalTokens" name="Tokens" fill="#14b8a6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 空状态占位组件 ────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center">
      <BarChart3 className="mb-2 h-6 w-6 text-slate-300" />
      <p className="text-sm text-slate-400">{message}</p>
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

  const buildDateParams = useCallback(() => {
    const to = new Date();
    const from = new Date(to.getTime() - rangeDays * 86400000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [rangeDays]);

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
    <div className="space-y-6">
      {/* 标题 + 日期范围切换 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">数据分析</h1>
          <p className="mt-0.5 text-xs text-slate-400">AI 请求指标、趋势与成本监控</p>
        </div>
        <div className="flex gap-1.5">
          {DATE_RANGE_PRESETS.map((preset) => (
            <button
              key={preset.days}
              onClick={() => setRangeDays(preset.days)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                rangeDays === preset.days
                  ? 'border-teal-300 bg-teal-50 text-teal-600'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* 汇总指标卡片 */}
          <SummaryCards summary={summary} />

          {/* 图表 2x2 网格 */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* 每日请求趋势 */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-medium text-slate-700">每日请求趋势</h3>
              <DailyTrendChart data={daily} />
            </div>

            {/* 客户端分布 */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-medium text-slate-700">客户端分布</h3>
              <ClientDistributionChart data={byClient} />
            </div>

            {/* 成本报告 — 跨两列 */}
            <div className="col-span-1 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-2">
              <h3 className="mb-4 text-sm font-medium text-slate-700">成本报告 -- Provider / Model (Top 10)</h3>
              <CostReportChart data={costReport} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Analytics;
