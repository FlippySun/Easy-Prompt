import { useMemo, useState } from 'react';
import {
  User,
  Heart,
  Bookmark,
  Copy,
  Eye,
  Clock,
  Sparkles,
  TrendingUp,
  Edit3,
  Trophy,
  Lock,
  BarChart3,
  Target,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
// 2026-04-09 — P5 迁移：不再直接导入 MOCK_PROMPTS
import { useAllPrompts } from '../hooks/usePromptData';
import { useLayoutContext } from '../components/Layout';
import { usePromptStore } from '../hooks/usePromptStore';
import { useAuth } from '../hooks/useAuth';
import { useMyPrompts } from '../hooks/useProfile';
import { useOpenDrawer } from '../hooks/useDrawerContext';
import { PromptDetailDrawer } from '../components/PromptDetailDrawer';
import { CATEGORY_CONFIG, formatCount } from '../data/constants';
import { RARITY_CONFIG, type Achievement } from '../data/achievements';
import { useAchievements } from '../hooks/useAchievements';
import { motion, AnimatePresence } from 'motion/react';

// 从集中的 CATEGORY_CONFIG 派生图表配置
const CATEGORY_CHART_CONFIG: Record<string, { name: string; color: string }> = Object.fromEntries(
  Object.entries(CATEGORY_CONFIG).map(([k, v]) => [k, { name: v.label, color: v.color }]),
);

type ProfileTab = 'overview' | 'achievements' | 'analytics';

function AchievementCard({
  achievement,
  unlocked,
  darkMode: dm,
}: {
  achievement: Achievement;
  unlocked: boolean;
  darkMode: boolean;
}) {
  const rarityConfig = RARITY_CONFIG[achievement.rarity];

  return (
    <motion.div
      whileHover={unlocked ? { scale: 1.04 } : {}}
      className={`relative flex flex-col items-center gap-2 overflow-hidden rounded-xl border p-3.5 text-center transition-all ${
        unlocked
          ? dm
            ? 'border-gray-700 bg-gray-800/60'
            : 'border-gray-200 bg-white shadow-sm'
          : dm
            ? 'border-gray-800 bg-gray-900/40 opacity-50'
            : 'border-dashed border-gray-200 bg-gray-50/50 opacity-50'
      }`}
      style={unlocked ? { boxShadow: rarityConfig.glow || undefined } : {}}
    >
      {/* Rarity indicator */}
      {unlocked && (
        <div
          className="absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide"
          style={{ background: rarityConfig.bg, color: rarityConfig.color }}
        >
          {rarityConfig.label}
        </div>
      )}

      <span className={`text-2xl ${!unlocked ? 'grayscale' : ''}`}>{achievement.icon}</span>
      <div>
        <p
          className={`text-[11px] font-semibold leading-tight ${dm ? (unlocked ? 'text-gray-200' : 'text-gray-600') : unlocked ? 'text-gray-800' : 'text-gray-400'}`}
        >
          {achievement.title}
        </p>
        <p
          className={`mt-1 min-h-[24px] text-[9px] leading-tight line-clamp-2 ${dm ? 'text-gray-400' : 'text-gray-500'}`}
        >
          {achievement.description}
        </p>
      </div>
      {!unlocked && <Lock size={10} className={dm ? 'text-gray-600' : 'text-gray-300'} />}
    </motion.div>
  );
}

export function Profile() {
  const { darkMode } = useLayoutContext();
  const store = usePromptStore();
  const { user, isAuthenticated } = useAuth();
  const { prompts: myPrompts } = useMyPrompts();
  const openDrawer = useOpenDrawer();
  const dm = darkMode;

  // 2026-04-09 — P5 迁移：改用 Context 全局数据
  const allPrompts = useAllPrompts();

  // 2026-04-10 — P5 修复：改用 useAchievements() 获取成就列表（API 优先，mock 降级）
  const { achievements: allAchievements } = useAchievements();

  // P5.10: 优先使用 API 数据，降级到 Context 全局数据前 3 条
  const submittedPrompts = myPrompts.length > 0 ? myPrompts.slice(0, 3) : allPrompts.slice(0, 3);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [achievementFilter, setAchievementFilter] = useState<Achievement['category'] | 'all'>('all');

  const recentlyViewed = useMemo(
    () =>
      store.viewed
        .map((id) => allPrompts.find((p) => p.id === id))
        .filter(Boolean)
        .slice(0, 6),
    [store.viewed, allPrompts],
  );

  const totalCopied = useMemo(() => Object.values(store.copied).reduce((s, n) => s + n, 0), [store.copied]);

  const unlockedCount = store.achievements.size;
  const totalAchievements = allAchievements.length;

  // Category preference analytics
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    [...store.liked].forEach((id) => {
      const p = allPrompts.find((pr) => pr.id === id);
      if (p) stats[p.category] = (stats[p.category] || 0) + 2;
    });
    [...store.saved].forEach((id) => {
      const p = allPrompts.find((pr) => pr.id === id);
      if (p) stats[p.category] = (stats[p.category] || 0) + 3;
    });
    Object.entries(store.copied).forEach(([id, count]) => {
      const p = allPrompts.find((pr) => pr.id === id);
      if (p) stats[p.category] = (stats[p.category] || 0) + count;
    });
    return Object.entries(stats)
      .map(([cat, score]) => ({
        cat,
        score,
        name: CATEGORY_CHART_CONFIG[cat]?.name || cat,
        color: CATEGORY_CHART_CONFIG[cat]?.color || '#6366f1',
      }))
      .sort((a, b) => b.score - a.score);
  }, [store.liked, store.saved, store.copied, allPrompts]);

  // Most copied prompts
  const topCopied = useMemo(
    () =>
      Object.entries(store.copied)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => ({ prompt: allPrompts.find((p) => p.id === id), count }))
        .filter((x) => x.prompt),
    [store.copied, allPrompts],
  );

  // Next achievements to unlock
  const nextAchievements = useMemo(
    () => allAchievements.filter((a) => !store.achievements.has(a.id)).slice(0, 3),
    [store.achievements, allAchievements],
  );

  const filteredAchievements = useMemo(
    () =>
      achievementFilter === 'all' ? allAchievements : allAchievements.filter((a) => a.category === achievementFilter),
    [achievementFilter, allAchievements],
  );

  const cardBase = `rounded-2xl border p-5 ${dm ? 'border-gray-800 bg-gray-900' : 'border-gray-200/80 bg-white'}`;
  const tabs: { id: ProfileTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: '概览', icon: User },
    { id: 'achievements', label: `成就 (${unlockedCount}/${totalAchievements})`, icon: Trophy },
    { id: 'analytics', label: '数据分析', icon: BarChart3 },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Profile Hero */}
      <div className={`relative overflow-hidden rounded-2xl border ${dm ? 'border-gray-800' : 'border-gray-200/80'}`}>
        <div
          className="h-28 w-full"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)' }}
        >
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>
        <div className={`relative px-6 pb-5 ${dm ? 'bg-gray-900' : 'bg-white'}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div
                className="-mt-10 flex h-20 w-20 items-center justify-center rounded-2xl border-4 bg-linear-to-br from-violet-500 to-indigo-600 text-2xl font-bold text-white shadow-xl"
                style={{ borderColor: dm ? '#111827' : '#fff' }}
              >
                P
              </div>
              <div className="mb-1 flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <h1 className={`text-xl font-bold ${dm ? 'text-gray-100' : 'text-gray-900'}`}>
                    {isAuthenticated && user ? user.displayName || user.username : 'PromptHub 用户'}
                  </h1>
                  {unlockedCount >= 10 && <span className="text-base">👑</span>}
                </div>
                <p className={`text-sm ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                  @{isAuthenticated && user ? user.username : 'promptuser'}
                  {isAuthenticated && user?.createdAt
                    ? ` · 加入于 ${new Date(user.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}`
                    : ' · 加入于 2024年1月'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {/* Achievement progress mini */}
              <div
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs ${dm ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}
              >
                <Trophy size={12} className="text-yellow-400" />
                <span className={dm ? 'text-gray-300' : 'text-gray-700'}>
                  {unlockedCount}/{totalAchievements} 成就
                </span>
              </div>
              <button
                className={`flex items-center gap-1.5 rounded-xl border px-4 py-1.5 text-sm font-medium transition-colors ${dm ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                <Edit3 size={14} /> 编辑资料
              </button>
            </div>
          </div>
          <p className={`mt-3 text-sm ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
            热爱 AI 技术，专注于挖掘高质量 Prompt，让 AI 更好地服务于生产力提升。✨
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Heart, label: '点赞', value: store.liked.size, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
          { icon: Bookmark, label: '收藏', value: store.saved.size, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
          { icon: Copy, label: '总复制', value: totalCopied, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
          { icon: Eye, label: '浏览', value: store.viewed.length, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
        ].map(({ icon: Icon, label, value, color, bg }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={cardBase + ' flex flex-col gap-2'}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: bg }}>
              <Icon size={16} style={{ color }} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>{formatCount(value)}</p>
              <p className={`text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div
        className={`relative flex gap-1 rounded-xl border p-1 ${dm ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}
      >
        {/* Sliding indicator */}
        <motion.div
          className={`absolute rounded-lg ${dm ? 'bg-indigo-500/15' : 'bg-indigo-50 shadow-sm'}`}
          style={{
            top: 4,
            bottom: 4,
            width: `calc((100% - 8px - ${(tabs.length - 1) * 4}px) / ${tabs.length})`,
          }}
          animate={{
            left: `calc(4px + ${tabs.findIndex((t) => t.id === activeTab)} * (100% - 8px + 4px) / ${tabs.length})`,
          }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 30,
            mass: 0.8,
          }}
        />
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors"
            style={{
              color: activeTab === id ? (dm ? '#818cf8' : '#4f46e5') : dm ? '#9ca3af' : '#6b7280',
            }}
          >
            <Icon size={13} />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{id === 'overview' ? '概览' : id === 'achievements' ? '成就' : '分析'}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 gap-6 lg:grid-cols-3"
          >
            {/* Left */}
            <div className="flex flex-col gap-6">
              {/* Quick Achievement Preview */}
              <div className={cardBase}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy size={14} className="text-yellow-400" />
                    <h3 className={`text-sm font-semibold ${dm ? 'text-gray-200' : 'text-gray-800'}`}>成就进度</h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('achievements')}
                    className={`text-[11px] ${dm ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-500 hover:text-indigo-600'}`}
                  >
                    全部 →
                  </button>
                </div>
                {/* Progress bar */}
                <div className="mb-3">
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className={dm ? 'text-gray-400' : 'text-gray-500'}>已解锁</span>
                    <span className={`font-semibold ${dm ? 'text-gray-300' : 'text-gray-700'}`}>
                      {unlockedCount}/{totalAchievements}
                    </span>
                  </div>
                  <div className={`h-2 overflow-hidden rounded-full ${dm ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(unlockedCount / totalAchievements) * 100}%` }}
                      transition={{ duration: 1, delay: 0.3 }}
                      className="h-full rounded-full bg-linear-to-r from-violet-500 to-indigo-500"
                    />
                  </div>
                </div>
                {/* Latest unlocked */}
                <div className="grid grid-cols-4 gap-1.5">
                  {allAchievements.slice(0, 8).map((a) => (
                    <div
                      key={a.id}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl ${
                        store.achievements.has(a.id)
                          ? dm
                            ? 'bg-gray-800'
                            : 'bg-gray-50 shadow-sm'
                          : dm
                            ? 'bg-gray-900 opacity-30 grayscale'
                            : 'bg-gray-100 opacity-30 grayscale'
                      }`}
                      title={store.achievements.has(a.id) ? a.title : `🔒 ${a.title}`}
                    >
                      {a.icon}
                    </div>
                  ))}
                </div>
                {/* Next goal */}
                {nextAchievements[0] && (
                  <div
                    className={`mt-3 flex items-center gap-2 rounded-xl border p-2.5 ${dm ? 'border-gray-700 bg-gray-800/50' : 'border-gray-100 bg-gray-50'}`}
                  >
                    <Target size={12} className="text-indigo-400 shrink-0" />
                    <div className="min-w-0">
                      <p className={`text-[11px] font-medium ${dm ? 'text-gray-300' : 'text-gray-700'}`}>
                        下一成就：{nextAchievements[0].title}
                      </p>
                      <p className={`text-[10px] truncate ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                        {nextAchievements[0].description}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Submitted */}
              <div className={cardBase}>
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles size={14} className="text-indigo-400" />
                  <h3 className={`text-sm font-semibold ${dm ? 'text-gray-200' : 'text-gray-800'}`}>我提交的 Prompt</h3>
                </div>
                <div className="flex flex-col gap-1">
                  {submittedPrompts.map((prompt) => {
                    const catConfig = CATEGORY_CONFIG[prompt.category] || CATEGORY_CONFIG.coding;
                    return (
                      <button
                        key={prompt.id}
                        onClick={() => openDrawer(prompt)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${dm ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}
                      >
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                          style={{ background: `linear-gradient(135deg, ${catConfig.color}, ${catConfig.color}88)` }}
                        >
                          {prompt.author[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-xs font-medium ${dm ? 'text-gray-200' : 'text-gray-800'}`}>
                            {prompt.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[10px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                              ❤️ {prompt.likes}
                            </span>
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${dm ? 'bg-green-500/10 text-green-400' : 'bg-green-100 text-green-600'}`}
                            >
                              已发布
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right */}
            <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
              {/* Recently Viewed */}
              <div className={cardBase}>
                <div className="mb-3 flex items-center gap-2">
                  <Clock size={14} className="text-blue-400" />
                  <h3 className={`text-sm font-semibold ${dm ? 'text-gray-200' : 'text-gray-800'}`}>最近浏览</h3>
                </div>
                {recentlyViewed.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {recentlyViewed.map((prompt, i) => {
                      if (!prompt) return null;
                      const catConfig = CATEGORY_CONFIG[prompt.category] || CATEGORY_CONFIG.coding;
                      return (
                        <PromptDetailDrawer key={prompt.id} prompt={prompt} darkMode={dm}>
                          <motion.button
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all ${dm ? 'border-gray-800 hover:border-gray-700 hover:bg-gray-800/40' : 'border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30'}`}
                          >
                            <div
                              className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                              style={{ background: catConfig.color }}
                            />
                            <div className="min-w-0">
                              <p className={`truncate text-xs font-medium ${dm ? 'text-gray-200' : 'text-gray-800'}`}>
                                {prompt.title}
                              </p>
                              <p className={`mt-0.5 text-[10px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                                {catConfig.label}
                              </p>
                            </div>
                          </motion.button>
                        </PromptDetailDrawer>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <span className="mb-2 text-3xl">👀</span>
                    <p className={`text-sm ${dm ? 'text-gray-500' : 'text-gray-400'}`}>还没有浏览记录</p>
                  </div>
                )}
              </div>

              {/* Activity */}
              <div className={cardBase}>
                <div className="mb-3 flex items-center gap-2">
                  <TrendingUp size={14} className="text-green-400" />
                  <h3 className={`text-sm font-semibold ${dm ? 'text-gray-200' : 'text-gray-800'}`}>近期动态</h3>
                </div>
                <div className="flex flex-col gap-3">
                  {[
                    { icon: '❤️', text: `点赞了 ${store.liked.size} 个 Prompt`, time: '今天' },
                    { icon: '⭐', text: `收藏了 ${store.saved.size} 个 Prompt`, time: '今天' },
                    { icon: '📋', text: `共复制了 ${totalCopied} 次`, time: '本周' },
                    { icon: '👁', text: `浏览了 ${store.viewed.length} 个 Prompt`, time: '本月' },
                    { icon: '🏆', text: `解锁了 ${unlockedCount} 个成就`, time: '累计' },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 ${i < 4 ? `pb-3 border-b ${dm ? 'border-gray-800' : 'border-gray-100'}` : ''}`}
                    >
                      <span className="text-sm">{item.icon}</span>
                      <p className={`flex-1 text-xs ${dm ? 'text-gray-300' : 'text-gray-700'}`}>{item.text}</p>
                      <span className={`text-[10px] ${dm ? 'text-gray-600' : 'text-gray-400'}`}>{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'achievements' && (
          <motion.div
            key="achievements"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-5"
          >
            {/* Summary */}
            <div
              className={`flex flex-wrap items-center gap-4 rounded-2xl border p-4 ${dm ? 'border-gray-800 bg-gray-900' : 'border-gray-100 bg-white'}`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-yellow-400 to-orange-500 text-xl shadow-lg shadow-orange-500/25">
                  🏆
                </div>
                <div>
                  <p className={`text-xl font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>
                    {unlockedCount}/{totalAchievements}
                  </p>
                  <p className={`text-xs ${dm ? 'text-gray-400' : 'text-gray-500'}`}>已解锁成就</p>
                </div>
              </div>
              <div className="flex-1">
                <div className={`h-3 overflow-hidden rounded-full ${dm ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(unlockedCount / totalAchievements) * 100}%` }}
                    transition={{ duration: 1.2, delay: 0.2 }}
                    className="h-full rounded-full bg-linear-to-r from-yellow-400 to-orange-500"
                  />
                </div>
                <p className={`mt-1 text-[11px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                  {Math.round((unlockedCount / totalAchievements) * 100)}% 完成
                </p>
              </div>
              {/* Rarity breakdown */}
              <div className="flex items-center gap-3">
                {(['common', 'rare', 'epic', 'legendary'] as const).map((rarity) => {
                  const count = allAchievements.filter(
                    (a) => a.rarity === rarity && store.achievements.has(a.id),
                  ).length;
                  const total = allAchievements.filter((a) => a.rarity === rarity).length;
                  const config = RARITY_CONFIG[rarity];
                  return (
                    <div key={rarity} className="text-center">
                      <p className="text-sm font-bold" style={{ color: config.color }}>
                        {count}/{total}
                      </p>
                      <p className={`text-[10px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{config.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['all', '全部'],
                  ['explorer', '探索者'],
                  ['collector', '收藏家'],
                  ['creator', '创作者'],
                  ['social', '社交达人'],
                  ['power', '超级用户'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setAchievementFilter(id as Achievement['category'] | 'all')}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    achievementFilter === id
                      ? dm
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                        : 'border-indigo-300 bg-indigo-50 text-indigo-600'
                      : dm
                        ? 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Achievement Grid */}
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {filteredAchievements.map((achievement, i) => (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <AchievementCard
                    achievement={achievement}
                    unlocked={store.achievements.has(achievement.id)}
                    darkMode={dm}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-6"
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Category Preference Chart */}
              <div className={cardBase}>
                <div className="mb-4 flex items-center gap-2">
                  <BarChart3 size={15} className="text-indigo-400" />
                  <h3 className={`text-sm font-semibold ${dm ? 'text-gray-200' : 'text-gray-800'}`}>偏好分类分析</h3>
                  <span className={`text-[11px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>基于点赞+收藏+复制</span>
                </div>
                {categoryStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={categoryStats} layout="vertical" margin={{ left: 0, right: 16 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={60}
                        tick={{ fontSize: 11, fill: dm ? '#9ca3af' : '#6b7280' }}
                      />
                      <Tooltip
                        formatter={(value: number) => [value, '互动分']}
                        contentStyle={{
                          background: dm ? '#1f2937' : '#fff',
                          border: dm ? '1px solid #374151' : '1px solid #e5e7eb',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: dm ? '#e5e7eb' : '#111827' }}
                      />
                      <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                        {categoryStats.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <span className="mb-2 text-4xl">📊</span>
                    <p className={`text-sm ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                      暂无数据，开始与 Prompt 互动吧
                    </p>
                  </div>
                )}
              </div>

              {/* Most Copied */}
              <div className={cardBase}>
                <div className="mb-4 flex items-center gap-2">
                  <Copy size={14} className="text-green-400" />
                  <h3 className={`text-sm font-semibold ${dm ? 'text-gray-200' : 'text-gray-800'}`}>
                    最常复制的 Prompt
                  </h3>
                </div>
                {topCopied.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {topCopied.map(({ prompt, count }, i) => {
                      if (!prompt) return null;
                      const catConfig = CATEGORY_CONFIG[prompt.category] || CATEGORY_CONFIG.coding;
                      const maxCount = topCopied[0]?.count || 1;
                      return (
                        <PromptDetailDrawer key={prompt.id} prompt={prompt} darkMode={dm}>
                          <button
                            className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors ${dm ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}
                          >
                            <span
                              className={`w-5 text-center text-xs font-bold ${i === 0 ? 'text-yellow-400' : dm ? 'text-gray-500' : 'text-gray-400'}`}
                            >
                              {i + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className={`truncate text-xs font-medium ${dm ? 'text-gray-200' : 'text-gray-800'}`}>
                                {prompt.title}
                              </p>
                              <div className="mt-1 flex items-center gap-2">
                                <div
                                  className={`h-1.5 flex-1 overflow-hidden rounded-full ${dm ? 'bg-gray-800' : 'bg-gray-100'}`}
                                >
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${(count / maxCount) * 100}%`, background: catConfig.color }}
                                  />
                                </div>
                                <span
                                  className={`shrink-0 text-[10px] font-medium ${dm ? 'text-gray-400' : 'text-gray-500'}`}
                                >
                                  ×{count}
                                </span>
                              </div>
                            </div>
                          </button>
                        </PromptDetailDrawer>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <span className="mb-2 text-4xl">📋</span>
                    <p className={`text-sm ${dm ? 'text-gray-500' : 'text-gray-400'}`}>还没有复制过 Prompt</p>
                  </div>
                )}
              </div>

              {/* Usage Summary */}
              <div className={`col-span-1 lg:col-span-2 ${cardBase}`}>
                <div className="mb-4 flex items-center gap-2">
                  <Target size={14} className="text-violet-400" />
                  <h3 className={`text-sm font-semibold ${dm ? 'text-gray-200' : 'text-gray-800'}`}>使用概况</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    {
                      label: '探索覆盖率',
                      value: `${allPrompts.length > 0 ? Math.round((store.viewed.length / allPrompts.length) * 100) : 0}%`,
                      desc: `已查看 ${store.viewed.length}/${allPrompts.length} 个`,
                      color: '#6366f1',
                    },
                    {
                      label: '收藏率',
                      value: `${allPrompts.length > 0 ? Math.round((store.saved.size / allPrompts.length) * 100) : 0}%`,
                      desc: `收藏 ${store.saved.size} 个`,
                      color: '#f59e0b',
                    },
                    {
                      label: '点赞率',
                      value: `${allPrompts.length > 0 ? Math.round((store.liked.size / allPrompts.length) * 100) : 0}%`,
                      desc: `点赞 ${store.liked.size} 个`,
                      color: '#ef4444',
                    },
                    {
                      label: '成就完成度',
                      value: `${Math.round((unlockedCount / totalAchievements) * 100)}%`,
                      desc: `${unlockedCount}/${totalAchievements} 已解锁`,
                      color: '#10b981',
                    },
                  ].map(({ label, value, desc, color }) => (
                    <div
                      key={label}
                      className={`flex flex-col gap-2 rounded-xl border p-3.5 ${dm ? 'border-gray-800 bg-gray-800/40' : 'border-gray-100 bg-gray-50'}`}
                    >
                      <p className={`text-[11px] font-medium ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
                      <p className="text-2xl font-bold" style={{ color }}>
                        {value}
                      </p>
                      <p className={`text-[10px] ${dm ? 'text-gray-600' : 'text-gray-400'}`}>{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
