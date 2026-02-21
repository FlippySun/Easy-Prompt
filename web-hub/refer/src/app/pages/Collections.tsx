import { useState } from 'react';
import { Package, Bookmark, BookmarkCheck, ChevronRight, Users, Copy, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { COLLECTIONS, DIFFICULTY_CONFIG, type Collection } from '../data/collections';
import { MOCK_PROMPTS, type Prompt } from '../data/prompts';
import { useLayoutContext } from '../components/Layout';
import { PromptDetailDrawer } from '../components/PromptDetailDrawer';
import { CATEGORY_CONFIG } from '../components/PromptCard';
import { usePromptStore } from '../hooks/usePromptStore';

function formatCount(n: number) {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

// localStorage for saved collections
function useSavedCollections() {
  const [saved, setSaved] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('prompthub_collections');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });
  const toggle = (id: string) => {
    setSaved(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); toast.success('已移出收藏夹'); }
      else { next.add(id); toast.success('已收藏合集 ⭐'); }
      localStorage.setItem('prompthub_collections', JSON.stringify([...next]));
      return next;
    });
  };
  return { saved, toggle };
}

interface CollectionCardProps {
  collection: Collection;
  darkMode: boolean;
  onClick: (c: Collection) => void;
  isSaved: boolean;
  onToggleSave: (id: string) => void;
}

function CollectionCard({ collection, darkMode: dm, onClick, isSaved, onToggleSave }: CollectionCardProps) {
  const diffConfig = DIFFICULTY_CONFIG[collection.difficulty];
  const promptCount = collection.promptIds.length;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border transition-all duration-300 ${
        dm ? 'border-gray-800 bg-gray-900 hover:border-gray-700 hover:shadow-xl hover:shadow-black/20' : 'border-gray-200/80 bg-white hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/8'
      }`}
      onClick={() => onClick(collection)}
    >
      {/* Gradient Banner */}
      <div
        className="relative h-28 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${collection.gradientFrom}, ${collection.gradientTo})` }}
      >
        {/* Pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs>
              <pattern id={`dots-${collection.id}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="2" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#dots-${collection.id})`} />
          </svg>
        </div>

        {/* Icon */}
        <div className="absolute left-4 top-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">
          {collection.icon}
        </div>

        {/* Save button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSave(collection.id); }}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-xl bg-black/20 backdrop-blur-sm transition-all hover:bg-black/40"
        >
          {isSaved
            ? <BookmarkCheck size={15} className="text-yellow-300" />
            : <Bookmark size={15} className="text-white" />
          }
        </button>

        {/* Prompt count badge */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-black/25 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
          <Package size={10} />
          {promptCount} 个 Prompt
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Title + Difficulty */}
        <div className="flex items-start justify-between gap-2">
          <h3 className={`text-[15px] font-bold leading-snug ${dm ? 'text-gray-100' : 'text-gray-900'}`}>
            {collection.title}
          </h3>
          <span
            className="flex-shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: dm ? diffConfig.darkBg : diffConfig.bg, color: dm ? diffConfig.darkColor : diffConfig.color }}
          >
            {collection.difficulty}
          </span>
        </div>

        <p className={`text-xs leading-relaxed ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
          {collection.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {collection.tags.slice(0, 3).map(tag => (
            <span key={tag} className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${dm ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
              #{tag}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className={`mt-auto flex items-center justify-between border-t pt-3 ${dm ? 'border-gray-800' : 'border-gray-100'}`}>
          <div className="flex items-center gap-1.5">
            <Users size={11} className={dm ? 'text-gray-500' : 'text-gray-400'} />
            <span className={`text-[11px] font-medium ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
              {formatCount(collection.savedCount)} 人收藏
            </span>
          </div>
          <div className={`flex items-center gap-1 text-[11px] font-semibold transition-colors group-hover:text-indigo-500 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
            查看合集
            <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface CollectionDetailProps {
  collection: Collection;
  darkMode: boolean;
  onBack: () => void;
  isSaved: boolean;
  onToggleSave: (id: string) => void;
}

function CollectionDetail({ collection, darkMode: dm, onBack, isSaved, onToggleSave }: CollectionDetailProps) {
  const store = usePromptStore();
  const prompts = collection.promptIds.map(id => MOCK_PROMPTS.find(p => p.id === id)).filter(Boolean) as Prompt[];
  const diffConfig = DIFFICULTY_CONFIG[collection.difficulty];

  const handleCopyAll = async () => {
    const text = prompts.map(p => `## ${p.title}\n\n${p.content}`).join('\n\n---\n\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`已复制全部 ${prompts.length} 个 Prompt！`);
    } catch { toast.error('复制失败'); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="flex flex-col gap-6"
    >
      {/* Collection Hero */}
      <div className="relative overflow-hidden rounded-2xl" style={{ background: `linear-gradient(135deg, ${collection.gradientFrom}, ${collection.gradientTo})` }}>
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="hero-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="3" cy="3" r="2" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-dots)" />
          </svg>
        </div>
        <div className="relative flex flex-col gap-4 p-6">
          <button
            onClick={onBack}
            className="flex w-fit items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-all hover:bg-white/30"
          >
            ← 返回合集列表
          </button>
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl backdrop-blur-sm">
              {collection.icon}
            </div>
            <div>
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-lg px-2 py-0.5 text-[11px] font-semibold bg-black/20 backdrop-blur-sm"
                  style={{ color: diffConfig.darkColor }}
                >
                  {collection.difficulty}
                </span>
                <span className="text-[11px] text-white/70">{collection.estimatedTime}</span>
              </div>
              <h1 className="text-2xl font-bold text-white">{collection.title}</h1>
              <p className="mt-1 text-sm text-white/80">{collection.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-xl bg-black/20 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
              <Package size={12} /> {prompts.length} 个 Prompt
            </div>
            <div className="flex items-center gap-1.5 rounded-xl bg-black/20 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
              <Users size={12} /> {formatCount(collection.savedCount)} 人收藏
            </div>
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/30"
            >
              <Copy size={12} /> 一键复制全部
            </button>
            <button
              onClick={() => onToggleSave(collection.id)}
              className="flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/30"
            >
              {isSaved ? <><BookmarkCheck size={12} /> 已收藏</> : <><Bookmark size={12} /> 收藏合集</>}
            </button>
          </div>
        </div>
      </div>

      {/* Prompt List */}
      <div className="flex flex-col gap-3">
        {prompts.map((prompt, i) => {
          const catConfig = CATEGORY_CONFIG[prompt.category] || CATEGORY_CONFIG.coding;
          return (
            <motion.div
              key={prompt.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex flex-col gap-3 overflow-hidden rounded-2xl border p-4 ${dm ? 'border-gray-800 bg-gray-900' : 'border-gray-200/80 bg-white'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${dm ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span
                        className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ background: dm ? catConfig.darkBg : catConfig.bg, color: dm ? catConfig.darkColor : catConfig.color }}
                      >
                        {catConfig.label}
                      </span>
                    </div>
                    <h4 className={`text-sm font-semibold ${dm ? 'text-gray-100' : 'text-gray-900'}`}>{prompt.title}</h4>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => { store.toggleSave(prompt.id); toast.success(store.isSaved(prompt.id) ? '已移出收藏' : '已收藏'); }}
                    className={`rounded-lg p-1.5 transition-colors ${store.isSaved(prompt.id) ? dm ? 'text-yellow-400' : 'text-yellow-500' : dm ? 'text-gray-600 hover:text-yellow-400' : 'text-gray-300 hover:text-yellow-500'}`}
                  >
                    {store.isSaved(prompt.id) ? <BookmarkCheck size={14} className="fill-current" /> : <Bookmark size={14} />}
                  </button>
                  <PromptDetailDrawer prompt={prompt} darkMode={dm}>
                    <button className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-all hover:shadow-md">
                      查看详情
                    </button>
                  </PromptDetailDrawer>
                </div>
              </div>

              <p className={`text-xs leading-relaxed ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{prompt.description}</p>

              <div className={`flex items-center justify-between border-t pt-2.5 ${dm ? 'border-gray-800' : 'border-gray-100'}`}>
                <div className="flex flex-wrap gap-1">
                  {prompt.tags.slice(0, 3).map(tag => (
                    <span key={tag} className={`rounded-md px-1.5 py-0.5 text-[10px] ${dm ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>#{tag}</span>
                  ))}
                </div>
                <div className={`text-[11px] ${dm ? 'text-gray-600' : 'text-gray-400'}`}>
                  ❤️ {formatCount(prompt.likes)} · 📋 {formatCount(prompt.copies)}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

export function Collections() {
  const { darkMode } = useLayoutContext();
  const dm = darkMode;
  const { saved, toggle } = useSavedCollections();
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [search, setSearch] = useState('');

  const filtered = COLLECTIONS.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.tags.some(t => t.toLowerCase().includes(q));
  });

  return (
    <div className="flex flex-col gap-6 pb-8">
      <AnimatePresence mode="wait">
        {selectedCollection ? (
          <motion.div key="detail">
            <CollectionDetail
              collection={selectedCollection}
              darkMode={dm}
              onBack={() => setSelectedCollection(null)}
              isSaved={saved.has(selectedCollection.id)}
              onToggleSave={toggle}
            />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-6"
          >
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500">
                  <Package size={18} className="text-white" />
                </div>
                <div>
                  <h1 className={`text-xl font-bold ${dm ? 'text-gray-100' : 'text-gray-900'}`}>Prompt 合集</h1>
                  <p className={`text-sm ${dm ? 'text-gray-500' : 'text-gray-400'}`}>精心策划的主题 Prompt 工具包</p>
                </div>
              </div>

              {/* Search */}
              <div className="relative max-w-xs flex-1">
                <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${dm ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="搜索合集..."
                  className={`w-full rounded-xl border py-2 pl-9 pr-8 text-sm outline-none transition-all ${
                    dm ? 'border-gray-700 bg-gray-800 text-gray-100 placeholder:text-gray-500 focus:border-indigo-500' : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-indigo-400'
                  }`}
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className={`flex flex-wrap items-center gap-4 rounded-xl border px-4 py-3 ${dm ? 'border-gray-800 bg-gray-900' : 'border-gray-100 bg-white'}`}>
              {[
                { label: '精选合集', value: COLLECTIONS.length, emoji: '📦' },
                { label: '包含 Prompt', value: COLLECTIONS.reduce((s, c) => s + c.promptIds.length, 0), emoji: '✨' },
                { label: '累计收藏', value: COLLECTIONS.reduce((s, c) => s + c.savedCount, 0), emoji: '⭐' },
                { label: '我收藏的', value: saved.size, emoji: '🔖' },
              ].map(({ label, value, emoji }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-base">{emoji}</span>
                  <div>
                    <p className={`text-base font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>{typeof value === 'number' ? formatCount(value) : value}</p>
                    <p className={`text-[10px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Grid */}
            {filtered.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((collection, i) => (
                  <motion.div
                    key={collection.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <CollectionCard
                      collection={collection}
                      darkMode={dm}
                      onClick={setSelectedCollection}
                      isSaved={saved.has(collection.id)}
                      onToggleSave={toggle}
                    />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20">
                <span className="mb-3 text-4xl">🔍</span>
                <p className={`text-sm ${dm ? 'text-gray-400' : 'text-gray-500'}`}>没有找到「{search}」相关合集</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
