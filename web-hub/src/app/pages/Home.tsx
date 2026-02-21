import { useParams, Link } from 'react-router';
import { useMemo, useState, useCallback, useEffect, useRef, memo } from 'react';
import Masonry, { ResponsiveMasonry } from 'react-responsive-masonry';
import { MOCK_PROMPTS, CATEGORIES } from '../data/prompts';
import { PromptCard } from '../components/PromptCard';
import { useLayoutContext } from '../components/Layout';
import { CountUp } from '../components/CountUp';
import { TextShimmer } from '../components/TextShimmer';
import { MarqueeTags } from '../components/MarqueeTags';
import {
  Search,
  TrendingUp,
  Sparkles,
  ChevronDown,
  Bot,
  Flame,
  Clock,
  Copy,
  CheckSquare,
  Square,
  FileJson,
  FileText,
  X,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { usePromptStore } from '../hooks/usePromptStore';
import { useOpenDrawer } from '../hooks/useDrawerContext';
import { useTypewriter } from '../hooks/useTypewriter';
import { CATEGORY_CONFIG as CARD_CATEGORY_CONFIG, MODEL_LABELS as BASE_MODEL_LABELS } from '../data/constants';
import { downloadFile } from '../../lib/utils';

// 从集中 CATEGORY_CONFIG 派生，增加 'all' 入口
const CATEGORY_CONFIG: Record<string, { color: string; emoji: string }> = {
  all: { color: '#6366f1', emoji: '✨' },
  ...Object.fromEntries(Object.entries(CARD_CATEGORY_CONFIG).map(([k, v]) => [k, { color: v.color, emoji: v.emoji }])),
};

// 从集中 MODEL_LABELS 派生，增加 'all' 入口
const MODEL_LABELS: Record<string, string> = {
  all: '全部模型',
  ...BASE_MODEL_LABELS,
};

function getTodaysFeatured(): (typeof MOCK_PROMPTS)[0] {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return MOCK_PROMPTS[dayOfYear % MOCK_PROMPTS.length];
}

const TYPEWRITER_PHRASES = [
  '代码审查专家',
  '爆款小红书文案',
  'AI 绘画魔法词',
  '高效会议助手',
  '竞品分析大师',
  '职场成长顾问',
  '商业计划导师',
];

/** Number of cards to render initially and on each scroll-load */
const PAGE_SIZE = 12;

/**
 * Isolated typewriter component — prevents 45-85ms re-renders from cascading
 * into the entire Home tree. Only this tiny subtree re-renders on each character.
 */
const TypewriterDisplay = memo(function TypewriterDisplay() {
  const text = useTypewriter(TYPEWRITER_PHRASES);
  return (
    <span className="font-semibold bg-linear-to-r from-violet-500 to-indigo-500 bg-clip-text text-transparent min-w-[120px]">
      {text}
      <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-indigo-500 align-middle" />
    </span>
  );
});

export function Home() {
  const { categoryId } = useParams();
  const { darkMode, search } = useLayoutContext();
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'most_copied'>('popular');
  const [selectedModel, setSelectedModel] = useState('all');
  const [showModelFilter, setShowModelFilter] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const store = usePromptStore();
  const { recordCategory } = store;
  const openDrawer = useOpenDrawer();
  const todaysFeatured = useMemo(() => getTodaysFeatured(), []);
  const totalLikes = useMemo(() => MOCK_PROMPTS.reduce((s, p) => s + p.likes, 0), []);
  const totalCopies = useMemo(() => MOCK_PROMPTS.reduce((s, p) => s + p.copies, 0), []);

  // Incremental rendering — show PAGE_SIZE cards initially, load more on scroll
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [categoryId, search, sortBy, selectedModel]);

  useEffect(() => {
    if (categoryId && categoryId !== 'all') recordCategory(categoryId);
  }, [categoryId, recordCategory]);

  const currentCategory = useMemo(() => CATEGORIES.find((c) => c.id === (categoryId || 'all')), [categoryId]);

  const filteredPrompts = useMemo(() => {
    let prompts = [...MOCK_PROMPTS];
    if (categoryId && categoryId !== 'all') prompts = prompts.filter((p) => p.category === categoryId);
    if (selectedModel !== 'all') prompts = prompts.filter((p) => p.model === selectedModel);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      prompts = prompts.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (sortBy === 'popular') prompts.sort((a, b) => b.likes - a.likes);
    else if (sortBy === 'newest') prompts.sort((a, b) => b.date.localeCompare(a.date));
    else prompts.sort((a, b) => b.copies - a.copies);
    return prompts;
  }, [categoryId, search, sortBy, selectedModel]);

  // IntersectionObserver for progressive card loading
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((prev) => prev + PAGE_SIZE);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [filteredPrompts]); // reconnect when filtered list changes

  const visiblePrompts = useMemo(
    () => filteredPrompts.slice(0, visibleCount),
    [filteredPrompts, visibleCount],
  );
  const hasMore = visibleCount < filteredPrompts.length;

  const dm = darkMode;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);
  const selectAll = () => setSelectedIds(new Set(filteredPrompts.map((p) => p.id)));
  const clearSelect = () => setSelectedIds(new Set());
  const exitBatchMode = () => {
    setBatchMode(false);
    setSelectedIds(new Set());
  };
  const selectedPrompts = filteredPrompts.filter((p) => selectedIds.has(p.id));

  const handleExportMarkdown = () => {
    if (!selectedPrompts.length) {
      toast.error('请先选择要导出的 Prompt');
      return;
    }
    const content = selectedPrompts
      .map(
        (p) =>
          `# ${p.title}\n\n> ${p.description}\n\n**分类：** ${p.category} | **作者：** ${p.author} | **日期：** ${p.date}\n\n**标签：** ${p.tags.map((t) => `#${t}`).join(' ')}\n\n\`\`\`\n${p.content}\n\`\`\`\n`,
      )
      .join('\n---\n\n');
    downloadFile(
      `# PromptHub 导出\n\n> 导出时间：${new Date().toLocaleString('zh-CN')}\n\n---\n\n${content}`,
      'prompts.md',
      'text/markdown',
    );
    store.unlockAchievement('batch_export');
    toast.success(`成功导出 ${selectedPrompts.length} 个 Prompt 为 Markdown！`);
  };

  const handleExportJSON = () => {
    if (!selectedPrompts.length) {
      toast.error('请先选择要导出的 Prompt');
      return;
    }
    downloadFile(
      JSON.stringify(
        { exportedAt: new Date().toISOString(), count: selectedPrompts.length, prompts: selectedPrompts },
        null,
        2,
      ),
      'prompts.json',
      'application/json',
    );
    store.unlockAchievement('batch_export');
    toast.success(`成功导出 ${selectedPrompts.length} 个 Prompt 为 JSON！`);
  };

  const handleCopySelected = async () => {
    if (!selectedPrompts.length) {
      toast.error('请先选择要复制的 Prompt');
      return;
    }
    try {
      await navigator.clipboard.writeText(
        selectedPrompts.map((p) => `【${p.title}】\n${p.content}`).join('\n\n---\n\n'),
      );
      toast.success(`已复制 ${selectedPrompts.length} 个 Prompt！`);
    } catch {
      toast.error('复制失败');
    }
  };

  const catConfig = CARD_CATEGORY_CONFIG[todaysFeatured.category] || CARD_CATEGORY_CONFIG.coding;

  return (
    <div className="space-y-6">
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      {!categoryId && !search && (
        <motion.section
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl p-8 sm:p-10"
          style={{
            background: dm
              ? 'linear-gradient(135deg,#1e1b4b 0%,#312e81 40%,#4c1d95 100%)'
              : 'linear-gradient(135deg,#eef2ff 0%,#ede9fe 50%,#fce7f3 100%)',
          }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="aurora-orb-1 absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-25"
              style={{ background: 'radial-gradient(circle,#6366f1,transparent)', filter: 'blur(48px)' }}
            />
            <div
              className="aurora-orb-2 absolute -left-10 bottom-0 h-56 w-56 rounded-full opacity-20"
              style={{ background: 'radial-gradient(circle,#8b5cf6,transparent)', filter: 'blur(40px)' }}
            />
            <div
              className="aurora-orb-3 absolute right-1/3 bottom-0 h-48 w-48 rounded-full opacity-15"
              style={{ background: 'radial-gradient(circle,#ec4899,transparent)', filter: 'blur(40px)' }}
            />
            {/* Noise grain (Stripe aesthetic) */}
            <div
              className="absolute inset-0 opacity-[0.025]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`,
              }}
            />
          </div>

          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                    dm
                      ? 'border-indigo-400/30 bg-indigo-500/10 text-indigo-300'
                      : 'border-indigo-200 bg-white/60 text-indigo-600'
                  }`}
                >
                  <Zap size={11} className="text-yellow-400" />
                  AI Prompt 精选库
                </span>
              </div>

              <h1 className={`text-3xl font-bold leading-tight sm:text-4xl ${dm ? 'text-white' : 'text-gray-900'}`}>
                发现最好用的
                <TextShimmer className="ml-2 text-3xl font-bold sm:text-4xl">AI Prompt</TextShimmer>
              </h1>

              <p className={`max-w-xl text-base leading-relaxed ${dm ? 'text-indigo-200' : 'text-gray-600'}`}>
                精选 ChatGPT、Claude、Midjourney 等 AI 工具的高质量提示词，帮你用 AI 提升工作效率，释放创意潜能。
              </p>

              <div
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm w-fit ${dm ? 'border-indigo-500/20 bg-indigo-950/40' : 'border-indigo-200/80 bg-white/70'}`}
              >
                <span className={dm ? 'text-indigo-400' : 'text-indigo-500'}>🔍</span>
                <span className={dm ? 'text-gray-300' : 'text-gray-600'}>正在为你寻找：</span>
                <TypewriterDisplay />
              </div>
            </div>

            {/* CountUp stats */}
            <div className="flex flex-wrap items-center gap-6">
              {[
                { icon: Sparkles, label: '精选 Prompt', to: MOCK_PROMPTS.length, suffix: '+' },
                { icon: Flame, label: '总点赞数', to: Math.round(totalLikes / 1000), suffix: 'k+' },
                { icon: Copy, label: '总复制次数', to: Math.round(totalCopies / 1000), suffix: 'k+' },
              ].map(({ icon: Icon, label, to, suffix }) => (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${dm ? 'bg-white/10' : 'bg-white/70'}`}
                  >
                    <Icon size={14} className={dm ? 'text-indigo-300' : 'text-indigo-500'} />
                  </div>
                  <div>
                    <div className={`text-base font-bold tabular-nums ${dm ? 'text-white' : 'text-gray-900'}`}>
                      <CountUp to={to} suffix={suffix} duration={1600} />
                    </div>
                    <div className={`text-[11px] ${dm ? 'text-indigo-300' : 'text-gray-500'}`}>{label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>
      )}

      {/* ── Marquee tag ribbon ──────────────────────────────────────────── */}
      {!categoryId && !search && <MarqueeTags darkMode={dm} />}

      {/* ── Today's featured ────────────────────────────────────────────── */}
      {!categoryId && !search && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={`flex items-start gap-4 overflow-hidden rounded-2xl border p-4 sm:p-5 ${dm ? 'border-gray-800 bg-gray-900' : 'border-gray-200/80 bg-white'}`}
        >
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-lg"
            style={{ background: `linear-gradient(135deg,${catConfig.color},${catConfig.color}99)` }}
          >
            <Sparkles size={20} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${dm ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-amber-200 bg-amber-50 text-amber-600'}`}
              >
                ⭐ 今日精选
              </span>
              <span className={`text-[11px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })} 每日更新
              </span>
            </div>
            <p className={`text-sm font-semibold ${dm ? 'text-gray-200' : 'text-gray-800'}`}>{todaysFeatured.title}</p>
            <p className={`text-xs leading-relaxed line-clamp-2 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
              {todaysFeatured.description}
            </p>
          </div>
          <button
            onClick={() => openDrawer(todaysFeatured)}
            className="shrink-0 flex items-center gap-1.5 rounded-xl bg-linear-to-r from-violet-500 to-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm"
          >
            查看 <Sparkles size={11} />
          </button>
        </motion.div>
      )}

      {/* ── Category pills ──────────────────────────────────────────────── */}
      {!categoryId && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map((cat) => {
            const config = CATEGORY_CONFIG[cat.id] || CATEGORY_CONFIG.all;
            const isActive = !categoryId && cat.id === 'all';
            return (
              <Link
                key={cat.id}
                to={cat.id === 'all' ? '/' : `/category/${cat.id}`}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? dm
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                      : 'border-indigo-300 bg-indigo-50 text-indigo-600'
                    : dm
                      ? 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:text-indigo-600'
                }`}
              >
                <span>{config.emoji}</span>
                {cat.name}
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] ${dm ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}
                >
                  {cat.count}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {categoryId ? (
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">{CATEGORY_CONFIG[categoryId]?.emoji || '✨'}</span>
                <h2 className={`text-xl font-bold ${dm ? 'text-gray-100' : 'text-gray-900'}`}>
                  {currentCategory?.name || '全部 Prompt'}
                </h2>
              </div>
              <p className={`mt-0.5 text-sm ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                共 {filteredPrompts.length} 个 Prompt
              </p>
            </div>
          ) : search ? (
            <div>
              <h2 className={`text-lg font-semibold ${dm ? 'text-gray-100' : 'text-gray-900'}`}>
                搜索「{search}」的结果
              </h2>
              <p className={`text-sm ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                找到 {filteredPrompts.length} 个 Prompt
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-500" />
              <span className={`text-sm font-semibold ${dm ? 'text-gray-300' : 'text-gray-700'}`}>
                发现 {filteredPrompts.length} 个精选 Prompt
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setBatchMode(!batchMode);
              setSelectedIds(new Set());
            }}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
              batchMode
                ? dm
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                  : 'border-indigo-300 bg-indigo-50 text-indigo-600'
                : dm
                  ? 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            {batchMode ? <CheckSquare size={13} /> : <Square size={13} />}
            批量导出
          </button>

          <div className="relative">
            <button
              onClick={() => setShowModelFilter(!showModelFilter)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                selectedModel !== 'all'
                  ? dm
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                    : 'border-indigo-300 bg-indigo-50 text-indigo-600'
                  : dm
                    ? 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              <Bot size={13} />
              {MODEL_LABELS[selectedModel]}
              <ChevronDown size={12} />
            </button>
            {showModelFilter && (
              <div
                className={`absolute right-0 top-full z-20 mt-1 min-w-[120px] overflow-hidden rounded-xl border shadow-xl ${dm ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}
              >
                {Object.entries(MODEL_LABELS).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => {
                      setSelectedModel(id);
                      setShowModelFilter(false);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${
                      selectedModel === id
                        ? dm
                          ? 'bg-indigo-500/10 text-indigo-400'
                          : 'bg-indigo-50 text-indigo-600'
                        : dm
                          ? 'text-gray-300 hover:bg-gray-700'
                          : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div
            className={`flex items-center overflow-hidden rounded-xl border text-xs font-medium ${dm ? 'border-gray-700' : 'border-gray-200'}`}
          >
            {[
              { id: 'popular', icon: Flame, label: '最热' },
              { id: 'newest', icon: Clock, label: '最新' },
              { id: 'most_copied', icon: Copy, label: '最多复制' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setSortBy(id as 'popular' | 'newest' | 'most_copied')}
                className={`flex items-center gap-1 px-3 py-2 transition-colors border-r last:border-r-0 ${dm ? 'border-gray-700' : 'border-gray-200'} ${
                  sortBy === id
                    ? dm
                      ? 'bg-indigo-500/10 text-indigo-400'
                      : 'bg-indigo-50 text-indigo-600'
                    : dm
                      ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Icon size={12} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Batch toolbar ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {batchMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`overflow-hidden rounded-xl border ${dm ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-indigo-200 bg-indigo-50'}`}
          >
            <div className="flex flex-wrap items-center gap-3 p-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${dm ? 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  <CheckSquare size={12} /> 全选 ({filteredPrompts.length})
                </button>
                {selectedIds.size > 0 && (
                  <button
                    onClick={clearSelect}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${dm ? 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
                  >
                    <X size={12} /> 清除选择
                  </button>
                )}
              </div>
              <div className={`text-xs font-medium ${dm ? 'text-indigo-400' : 'text-indigo-600'}`}>
                已选 {selectedIds.size} 个 Prompt
              </div>
              {selectedIds.size > 0 && (
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={handleCopySelected}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${dm ? 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
                  >
                    <Copy size={12} /> 批量复制
                  </button>
                  <button
                    onClick={handleExportMarkdown}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${dm ? 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
                  >
                    <FileText size={12} /> 导出 Markdown
                  </button>
                  <button
                    onClick={handleExportJSON}
                    className="flex items-center gap-1.5 rounded-xl bg-linear-to-r from-violet-500 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <FileJson size={12} /> 导出 JSON
                  </button>
                </div>
              )}
              <button
                onClick={exitBatchMode}
                className={`ml-auto flex items-center gap-1 text-xs ${dm ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-700'}`}
              >
                <X size={12} /> 退出
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showModelFilter && <div className="fixed inset-0 z-10" onClick={() => setShowModelFilter(false)} />}

      {/* ── Masonry grid ────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {filteredPrompts.length > 0 ? (
          <motion.div
            key={`${categoryId}-${sortBy}-${selectedModel}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            <ResponsiveMasonry columnsCountBreakPoints={{ 0: 1, 640: 1, 768: 2, 1100: 2, 1280: 3 }}>
              <Masonry gutter="16px">
                {visiblePrompts.map((prompt, index) => (
                  <div key={prompt.id} className="relative">
                    {batchMode && (
                      <button
                        onClick={() => toggleSelect(prompt.id)}
                        className="absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-lg border-2 transition-all"
                        style={{
                          borderColor: selectedIds.has(prompt.id) ? '#6366f1' : dm ? '#374151' : '#d1d5db',
                          background: selectedIds.has(prompt.id) ? '#6366f1' : dm ? '#1f2937' : 'white',
                        }}
                      >
                        {selectedIds.has(prompt.id) && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path
                              d="M2 6L5 9L10 3"
                              stroke="white"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </button>
                    )}
                    <div onClick={batchMode ? () => toggleSelect(prompt.id) : undefined}>
                      <PromptCard
                        prompt={prompt}
                        index={index}
                        darkMode={darkMode}
                        isLiked={store.isLiked(prompt.id)}
                        isSaved={store.isSaved(prompt.id)}
                        isInCompare={store.isInCompare(prompt.id)}
                        compareIsFull={store.compare.length >= 2 && !store.isInCompare(prompt.id)}
                        onToggleLike={store.toggleLike}
                        onToggleSave={store.toggleSave}
                        onRecordCopy={store.recordCopy}
                        onToggleCompare={store.toggleCompare}
                        batchMode={batchMode}
                        selected={selectedIds.has(prompt.id)}
                        onSelect={toggleSelect}
                        showCompare
                      />
                    </div>
                  </div>
                ))}
              </Masonry>
            </ResponsiveMasonry>
            {/* Scroll sentinel for progressive loading */}
            {hasMore && <div ref={sentinelRef} className="h-4" aria-hidden />}
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div
              className={`mb-4 flex h-20 w-20 items-center justify-center rounded-full ${dm ? 'bg-gray-800' : 'bg-gray-100'}`}
            >
              <Search size={28} className={dm ? 'text-gray-600' : 'text-gray-400'} />
            </div>
            <h3 className={`mb-2 text-lg font-semibold ${dm ? 'text-gray-300' : 'text-gray-700'}`}>
              没有找到相关 Prompt
            </h3>
            <p className={`text-sm ${dm ? 'text-gray-500' : 'text-gray-400'}`}>试试更换搜索关键词或筛选条件</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
