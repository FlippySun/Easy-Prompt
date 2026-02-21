import { useMemo, useState } from 'react';
import { Bookmark, Heart, Search, SlidersHorizontal, Trash2, LayoutGrid, List } from 'lucide-react';
import { MOCK_PROMPTS } from '../data/prompts';
import { useLayoutContext } from '../components/Layout';
import { usePromptStore } from '../hooks/usePromptStore';
import { PromptDetailDrawer } from '../components/PromptDetailDrawer';
import { CATEGORY_CONFIG } from '../components/PromptCard';
import Masonry, { ResponsiveMasonry } from 'react-responsive-masonry';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const TABS = [
  { id: 'saved', label: '⭐ 我的收藏', icon: Bookmark },
  { id: 'liked', label: '❤️ 我的点赞', icon: Heart },
];

export function Favorites() {
  const { darkMode } = useLayoutContext();
  const store = usePromptStore();
  const dm = darkMode;
  const [tab, setTab] = useState<'saved' | 'liked'>('saved');
  const [search, setSearch] = useState('');

  const ids = tab === 'saved' ? store.saved : store.liked;
  const prompts = useMemo(() => {
    return MOCK_PROMPTS.filter(p => ids.has(p.id)).filter(p => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q));
    });
  }, [ids, search]);

  const handleClearAll = () => {
    if (tab === 'saved') {
      [...store.saved].forEach(id => store.toggleSave(id));
      toast.success('已清空收藏夹');
    } else {
      [...store.liked].forEach(id => store.toggleLike(id));
      toast.success('已清空点赞记录');
    }
  };

  const cardBase = `rounded-2xl border overflow-hidden ${dm ? 'border-gray-800 bg-gray-900' : 'border-gray-200/80 bg-white'}`;
  const CATEGORY_LABELS: Record<string, string> = {
    coding: '编程开发', writing: '写作创作', marketing: '营销文案',
    art: '图像生成', productivity: '效率工具', education: '学习教育',
    business: '商业分析', life: '生活助手',
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500">
            <Bookmark size={18} className="text-white" />
          </div>
          <div>
            <h1 className={`text-xl font-bold ${dm ? 'text-gray-100' : 'text-gray-900'}`}>我的收藏</h1>
            <p className={`text-sm ${dm ? 'text-gray-500' : 'text-gray-400'}`}>管理你收藏和点赞的 Prompt</p>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className={`flex items-center gap-1 rounded-xl border p-1 self-start ${dm ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-gray-100'}`}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id as any)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === id
                ? dm ? 'bg-gray-800 text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm'
                : dm ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {label}
            <span className={`ml-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
              tab === id
                ? dm ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'
                : dm ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
            }`}>
              {tab === id ? prompts.length : (id === 'saved' ? store.saved.size : store.liked.size)}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {ids.size === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className={`mb-6 flex h-24 w-24 items-center justify-center rounded-full ${dm ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <span className="text-4xl">{tab === 'saved' ? '⭐' : '❤️'}</span>
            </div>
            <h3 className={`mb-2 text-lg font-semibold ${dm ? 'text-gray-300' : 'text-gray-700'}`}>
              {tab === 'saved' ? '还没有收藏' : '还没有点赞'}
            </h3>
            <p className={`mb-6 text-sm ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
              {tab === 'saved'
                ? '在 Prompt 卡片上点击书签图标来收藏，方便下次使用'
                : '在 Prompt 卡片上点击爱心图标来点赞你喜欢的内容'}
            </p>
            <a
              href="/"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md"
            >
              探索 Prompt 库
            </a>
          </motion.div>
        ) : (
          <motion.div
            key={tab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-4"
          >
            {/* Filter Row */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${dm ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="在收藏中搜索..."
                  className={`w-full rounded-xl border py-2 pl-9 pr-4 text-sm outline-none transition-all ${
                    dm
                      ? 'border-gray-700 bg-gray-800 text-gray-100 placeholder:text-gray-500 focus:border-indigo-500'
                      : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-indigo-400'
                  }`}
                />
              </div>
              <span className={`text-sm ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                {prompts.length} 个结果
              </span>
              {ids.size > 0 && (
                <button
                  onClick={handleClearAll}
                  className={`ml-auto flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                    dm ? 'border-gray-700 text-gray-400 hover:border-red-500/50 hover:text-red-400' : 'border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-500'
                  }`}
                >
                  <Trash2 size={12} />
                  清空{tab === 'saved' ? '收藏' : '点赞'}
                </button>
              )}
            </div>

            {/* Grid */}
            {prompts.length > 0 ? (
              <ResponsiveMasonry columnsCountBreakPoints={{ 0: 1, 640: 1, 768: 2, 1280: 3 }}>
                <Masonry gutter="16px">
                  {prompts.map((prompt, index) => {
                    const catConfig = CATEGORY_CONFIG[prompt.category] || CATEGORY_CONFIG.coding;
                    return (
                      <motion.div
                        key={prompt.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                        className={`overflow-hidden rounded-2xl border transition-all duration-200 ${
                          dm ? 'border-gray-800 bg-gray-900 hover:border-gray-700' : 'border-gray-200/80 bg-white hover:border-indigo-200 hover:shadow-lg'
                        }`}
                      >
                        <div
                          className="h-0.5 w-full"
                          style={{ background: `linear-gradient(90deg, ${catConfig.color}, ${catConfig.color}33)` }}
                        />
                        <div className="p-4 flex flex-col gap-3">
                          {/* Category */}
                          <span
                            className="inline-flex items-center self-start rounded-lg px-2 py-0.5 text-[11px] font-semibold"
                            style={{ background: dm ? catConfig.darkBg : catConfig.bg, color: dm ? catConfig.darkColor : catConfig.color }}
                          >
                            {catConfig.label}
                          </span>

                          {/* Title */}
                          <PromptDetailDrawer prompt={prompt} darkMode={dm}>
                            <button className={`text-left text-[15px] font-semibold leading-snug hover:text-indigo-500 transition-colors ${dm ? 'text-gray-100' : 'text-gray-900'}`}>
                              {prompt.title}
                            </button>
                          </PromptDetailDrawer>

                          {/* Description */}
                          <p className={`text-sm leading-relaxed line-clamp-2 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                            {prompt.description}
                          </p>

                          {/* Tags */}
                          <div className="flex flex-wrap gap-1">
                            {prompt.tags.slice(0, 3).map(tag => (
                              <span key={tag} className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${dm ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                                #{tag}
                              </span>
                            ))}
                          </div>

                          {/* Footer */}
                          <div className={`flex items-center justify-between border-t pt-3 ${dm ? 'border-gray-800' : 'border-gray-100'}`}>
                            <span className={`text-[11px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{prompt.author}</span>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => { store.toggleSave(prompt.id); toast.success(store.isSaved(prompt.id) ? '已移出收藏' : '已添加收藏'); }}
                                className={`rounded-lg p-1.5 transition-colors ${dm ? 'text-yellow-400 hover:bg-gray-800' : 'text-yellow-500 hover:bg-yellow-50'}`}
                              >
                                <Bookmark size={13} className="fill-current" />
                              </button>
                              <button
                                onClick={() => { store.toggleLike(prompt.id); }}
                                className={`rounded-lg p-1.5 transition-colors ${dm ? 'text-red-400 hover:bg-gray-800' : 'text-red-500 hover:bg-red-50'}`}
                              >
                                <Heart size={13} className={store.isLiked(prompt.id) ? 'fill-current' : ''} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </Masonry>
              </ResponsiveMasonry>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className={`text-sm ${dm ? 'text-gray-500' : 'text-gray-400'}`}>没有找到匹配「{search}」的内容</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
