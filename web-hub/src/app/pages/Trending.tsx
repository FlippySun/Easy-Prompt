import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import { TrendingUp, Flame, Eye, Copy, Heart, ArrowUp, Trophy, Zap } from 'lucide-react';
import { MOCK_PROMPTS } from '../data/prompts';
import { CATEGORY_CONFIG, formatCount } from '../data/constants';
import { useLayoutContext } from '../components/Layout';
import { PromptDetailDrawer } from '../components/PromptDetailDrawer';
import { motion } from 'motion/react';

// Derive color/label from centralized CATEGORY_CONFIG
const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_CONFIG).map(([k, v]) => [k, v.color]),
);
const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_CONFIG).map(([k, v]) => [k, v.label]),
);

// Seeded pseudo-random for stable daily trend data across renders
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateDailyData() {
  const days = [];
  const now = new Date();
  const baseSeed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    const seed = baseSeed + i;
    days.push({
      date: label,
      浏览量: Math.floor(seededRandom(seed * 3) * 8000 + 4000),
      复制次数: Math.floor(seededRandom(seed * 7) * 3000 + 1000),
      点赞数: Math.floor(seededRandom(seed * 13) * 1500 + 500),
    });
  }
  return days;
}

const dailyData = generateDailyData();

export function Trending() {
  const { darkMode } = useLayoutContext();
  const dm = darkMode;

  const topByLikes = useMemo(() => [...MOCK_PROMPTS].sort((a, b) => b.likes - a.likes).slice(0, 10), []);
  const topByCopies = useMemo(() => [...MOCK_PROMPTS].sort((a, b) => b.copies - a.copies).slice(0, 5), []);

  const categoryData = useMemo(() => {
    const counts = MOCK_PROMPTS.reduce(
      (acc, p) => {
        acc[p.category] = (acc[p.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    return Object.entries(counts).map(([id, value]) => ({
      name: CATEGORY_LABELS[id] || id,
      value,
      color: CATEGORY_COLORS[id] || '#6366f1',
    }));
  }, []);

  const barChartData = topByLikes.slice(0, 8).map((p) => ({
    name: p.title.length > 10 ? p.title.slice(0, 10) + '…' : p.title,
    fullName: p.title,
    点赞: p.likes,
    复制: p.copies,
    浏览: p.views,
    id: p.id,
  }));

  const totalStats = useMemo(
    () => ({
      views: MOCK_PROMPTS.reduce((s, p) => s + p.views, 0),
      copies: MOCK_PROMPTS.reduce((s, p) => s + p.copies, 0),
      likes: MOCK_PROMPTS.reduce((s, p) => s + p.likes, 0),
    }),
    [],
  );

  const axisColor = dm ? '#6b7280' : '#9ca3af';
  const tooltipBg = dm ? '#111827' : '#fff';
  const tooltipBorder = dm ? '#374151' : '#e5e7eb';
  const tooltipText = dm ? '#f3f4f6' : '#111827';

  const cardBase = `rounded-2xl border p-5 ${dm ? 'border-gray-800 bg-gray-900' : 'border-gray-200/80 bg-white'}`;

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-orange-400 to-rose-500">
            <TrendingUp size={18} className="text-white" />
          </div>
          <div>
            <h1 className={`text-xl font-bold ${dm ? 'text-gray-100' : 'text-gray-900'}`}>热门榜单</h1>
            <p className={`text-sm ${dm ? 'text-gray-500' : 'text-gray-400'}`}>实时数据统计与趋势分析</p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            icon: TrendingUp,
            label: '精选 Prompt',
            value: MOCK_PROMPTS.length,
            color: '#6366f1',
            suffix: '个',
          },
          {
            icon: Eye,
            label: '总浏览量',
            value: totalStats.views,
            color: '#3b82f6',
            suffix: '',
          },
          {
            icon: Copy,
            label: '总复制次数',
            value: totalStats.copies,
            color: '#10b981',
            suffix: '',
          },
          {
            icon: Heart,
            label: '总点赞数',
            value: totalStats.likes,
            color: '#ef4444',
            suffix: '',
          },
        ].map(({ icon: Icon, label, value, color, suffix }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={cardBase}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={`text-xs font-medium ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
                <p className={`mt-1 text-2xl font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>
                  {typeof value === 'number' ? formatCount(value) : value}
                  {suffix}
                </p>
              </div>
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: color + '15' }}
              >
                <Icon size={18} style={{ color }} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-green-500">
              <ArrowUp size={10} />
              <span>较上周 +{Math.floor(seededRandom(i * 17 + 7) * 20 + 5)}%</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Bar Chart - Top Prompts */}
        <div className={`col-span-2 ${cardBase}`}>
          <div className="mb-4 flex items-center gap-2">
            <Flame size={16} className="text-orange-400" />
            <h3 className={`text-sm font-semibold ${dm ? 'text-gray-200' : 'text-gray-800'}`}>
              热门 Prompt 排行（点赞数）
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={dm ? '#374151' : '#f3f4f6'} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: axisColor, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCount(v)}
              />
              <Tooltip
                contentStyle={{
                  background: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: 12,
                  color: tooltipText,
                  fontSize: 12,
                }}
                formatter={(value, name) => [formatCount(Number(value)), name]}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
              />
              <Bar dataKey="点赞" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="复制" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - Category Distribution */}
        <div className={cardBase}>
          <div className="mb-4 flex items-center gap-2">
            <Zap size={16} className="text-yellow-400" />
            <h3 className={`text-sm font-semibold ${dm ? 'text-gray-200' : 'text-gray-800'}`}>分类分布</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: 12,
                  color: tooltipText,
                  fontSize: 12,
                }}
                formatter={(value) => [`${value} 个`, '']}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {categoryData.map(({ name, color, value }) => (
              <div key={name} className="flex items-center gap-1">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                <span className={`text-[10px] ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                  {name}({value})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Area Chart - Daily Trends */}
      <div className={cardBase}>
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-indigo-400" />
          <h3 className={`text-sm font-semibold ${dm ? 'text-gray-200' : 'text-gray-800'}`}>近 14 天活动趋势</h3>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorCopies" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={dm ? '#374151' : '#f3f4f6'} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: axisColor, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatCount(v)}
            />
            <Tooltip
              contentStyle={{
                background: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: 12,
                color: tooltipText,
                fontSize: 12,
              }}
              formatter={(value, name) => [formatCount(Number(value)), name]}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: axisColor }} />
            <Area
              type="monotone"
              dataKey="浏览量"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#colorViews)"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="复制次数"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#colorCopies)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Two Column: Top Copies + Top Likes List */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Top by copies */}
        <div className={cardBase}>
          <div className="mb-4 flex items-center gap-2">
            <Copy size={15} className="text-green-400" />
            <h3 className={`text-sm font-semibold ${dm ? 'text-gray-200' : 'text-gray-800'}`}>复制最多</h3>
          </div>
          <div className="flex flex-col gap-2">
            {topByCopies.map((prompt, i) => (
              <PromptDetailDrawer key={prompt.id} prompt={prompt} darkMode={dm}>
                <button
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    dm ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      i === 0
                        ? 'bg-yellow-500 text-white'
                        : i === 1
                          ? 'bg-gray-400 text-white'
                          : i === 2
                            ? 'bg-amber-600 text-white'
                            : dm
                              ? 'bg-gray-800 text-gray-400'
                              : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${dm ? 'text-gray-200' : 'text-gray-800'}`}>
                      {prompt.title}
                    </p>
                    <p className={`text-[11px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                      {formatCount(prompt.copies)} 次复制
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-green-500 font-medium">
                    <Copy size={10} />
                    {formatCount(prompt.copies)}
                  </div>
                </button>
              </PromptDetailDrawer>
            ))}
          </div>
        </div>

        {/* Top by likes */}
        <div className={cardBase}>
          <div className="mb-4 flex items-center gap-2">
            <Trophy size={15} className="text-yellow-400" />
            <h3 className={`text-sm font-semibold ${dm ? 'text-gray-200' : 'text-gray-800'}`}>点赞最多</h3>
          </div>
          <div className="flex flex-col gap-2">
            {topByLikes.slice(0, 5).map((prompt, i) => (
              <PromptDetailDrawer key={prompt.id} prompt={prompt} darkMode={dm}>
                <button
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    dm ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      i === 0
                        ? 'bg-yellow-500 text-white'
                        : i === 1
                          ? 'bg-gray-400 text-white'
                          : i === 2
                            ? 'bg-amber-600 text-white'
                            : dm
                              ? 'bg-gray-800 text-gray-400'
                              : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${dm ? 'text-gray-200' : 'text-gray-800'}`}>
                      {prompt.title}
                    </p>
                    <p className={`text-[11px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                      {formatCount(prompt.likes)} 个点赞
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-red-400 font-medium">
                    <Heart size={10} className="fill-current" />
                    {formatCount(prompt.likes)}
                  </div>
                </button>
              </PromptDetailDrawer>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
