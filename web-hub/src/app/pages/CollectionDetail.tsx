import { useParams, Link } from 'react-router';
import { Package, Bookmark, BookmarkCheck, Users, Copy, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { COLLECTIONS, DIFFICULTY_CONFIG } from '../data/collections';
import { MOCK_PROMPTS, type Prompt } from '../data/prompts';
import { useLayoutContext } from '../components/Layout';
import { CATEGORY_CONFIG, formatCount } from '../data/constants';
import { usePromptStore } from '../hooks/usePromptStore';
import { useOpenDrawer } from '../hooks/useDrawerContext';

export default function CollectionDetailPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const { darkMode } = useLayoutContext();
  const dm = darkMode;
  const store = usePromptStore();
  const openDrawer = useOpenDrawer();

  const collection = COLLECTIONS.find((c) => c.id === collectionId);

  if (!collection) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <span className="mb-4 text-5xl">🔍</span>
        <h2 className={`mb-2 text-xl font-bold ${dm ? 'text-gray-100' : 'text-gray-900'}`}>合集未找到</h2>
        <p className={`mb-6 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
          该合集不存在或已被移除
        </p>
        <Link
          to="/collections"
          className="flex items-center gap-2 rounded-xl bg-linear-to-r from-violet-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
        >
          <ArrowLeft size={15} />
          返回合集列表
        </Link>
      </div>
    );
  }

  const prompts = collection.promptIds
    .map((id) => MOCK_PROMPTS.find((p) => p.id === id))
    .filter(Boolean) as Prompt[];
  const diffConfig = DIFFICULTY_CONFIG[collection.difficulty];
  const isSaved = store.isCollectionSaved(collection.id);

  const handleCopyAll = async () => {
    const text = prompts.map((p) => `## ${p.title}\n\n${p.content}`).join('\n\n---\n\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`已复制全部 ${prompts.length} 个 Prompt！`);
    } catch {
      toast.error('复制失败');
    }
  };

  const handleToggleSave = () => {
    const wasSaved = store.isCollectionSaved(collection.id);
    store.toggleCollectionSave(collection.id);
    toast.success(wasSaved ? '已移出收藏夹' : '已收藏合集 ⭐');
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Collection Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl"
        style={{ background: `linear-gradient(135deg, ${collection.gradientFrom}, ${collection.gradientTo})` }}
      >
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
          <Link
            to="/collections"
            className="flex w-fit items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-all hover:bg-white/30"
          >
            <ArrowLeft size={13} />
            返回合集列表
          </Link>
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl backdrop-blur-sm">
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
              onClick={handleToggleSave}
              className="flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/30"
            >
              {isSaved ? (
                <>
                  <BookmarkCheck size={12} /> 已收藏
                </>
              ) : (
                <>
                  <Bookmark size={12} /> 收藏合集
                </>
              )}
            </button>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {collection.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-lg bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-sm"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Prompt List */}
      <div className="flex flex-col gap-3">
        <h2 className={`flex items-center gap-2 text-sm font-semibold ${dm ? 'text-gray-300' : 'text-gray-700'}`}>
          <Package size={15} />
          包含 {prompts.length} 个 Prompt
        </h2>
        {prompts.map((prompt, i) => {
          const catConfig = CATEGORY_CONFIG[prompt.category] || CATEGORY_CONFIG.coding;
          const promptSaved = store.isSaved(prompt.id);
          return (
            <motion.div
              key={prompt.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex flex-col gap-3 overflow-hidden rounded-2xl border p-4 ${
                dm ? 'border-gray-800 bg-gray-900' : 'border-gray-200/80 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      dm ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span
                        className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{
                          background: dm ? catConfig.darkBg : catConfig.bg,
                          color: dm ? catConfig.darkColor : catConfig.color,
                        }}
                      >
                        {catConfig.label}
                      </span>
                    </div>
                    <h4 className={`text-sm font-semibold ${dm ? 'text-gray-100' : 'text-gray-900'}`}>
                      {prompt.title}
                    </h4>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => {
                      const wasSaved = store.isSaved(prompt.id);
                      store.toggleSave(prompt.id);
                      toast.success(wasSaved ? '已移出收藏' : '已收藏');
                    }}
                    className={`rounded-lg p-1.5 transition-colors ${
                      promptSaved
                        ? dm
                          ? 'text-yellow-400'
                          : 'text-yellow-500'
                        : dm
                          ? 'text-gray-600 hover:text-yellow-400'
                          : 'text-gray-300 hover:text-yellow-500'
                    }`}
                  >
                    {promptSaved ? (
                      <BookmarkCheck size={14} className="fill-current" />
                    ) : (
                      <Bookmark size={14} />
                    )}
                  </button>
                  <button
                    onClick={() => openDrawer(prompt)}
                    className="flex items-center gap-1.5 rounded-xl bg-linear-to-r from-violet-500 to-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-all hover:shadow-md"
                  >
                    查看详情
                  </button>
                </div>
              </div>

              <p className={`text-xs leading-relaxed ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                {prompt.description}
              </p>

              <div
                className={`flex items-center justify-between border-t pt-2.5 ${
                  dm ? 'border-gray-800' : 'border-gray-100'
                }`}
              >
                <div className="flex flex-wrap gap-1">
                  {prompt.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                        dm ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      #{tag}
                    </span>
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

      {/* Back to Collections */}
      <div className="flex justify-center pt-4">
        <Link
          to="/collections"
          className={`flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium transition-all ${
            dm
              ? 'border-gray-700 text-gray-300 hover:border-gray-600 hover:bg-gray-800'
              : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <ArrowLeft size={15} />
          返回全部合集
        </Link>
      </div>
    </div>
  );
}
