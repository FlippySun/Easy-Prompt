import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  TrendingUp,
  Bookmark,
  User,
  Package,
  LayoutGrid,
  Code2,
  PenTool,
  Megaphone,
  Image,
  Zap,
  GraduationCap,
  BarChart2,
  Heart,
  Shuffle,
  Moon,
  Sun,
  ArrowLeftRight,
  ArrowRight,
  Hash,
  X,
  Sparkles,
  Command,
  Wand2,
} from 'lucide-react';
// 2026-04-09 — P5 迁移：不再直接导入 MOCK_PROMPTS/CATEGORY_COUNTS
import { type Prompt } from '../data/prompts';
import { useAllPrompts } from '../hooks/usePromptData';
import { usePromptStore } from '../hooks/usePromptStore';

// --- Types ---
type ItemType =
  | { kind: 'prompt'; prompt: Prompt }
  | { kind: 'page'; title: string; icon: React.ElementType; path: string; desc: string; shortcut?: string }
  | {
      kind: 'action';
      title: string;
      icon: React.ElementType;
      desc: string;
      shortcut?: string;
      color?: string;
      onSelect: () => void;
    }
  | {
      kind: 'category';
      title: string;
      icon: React.ElementType;
      path: string;
      color: string;
      emoji: string;
      count: number;
    }
  | { kind: 'tag'; name: string };

interface Group {
  id: string;
  title: string;
  items: ItemType[];
}

// --- Highlight matching text ---
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="rounded-sm bg-amber-300/70 px-0.5 text-amber-900 dark:bg-amber-500/30 dark:text-amber-200"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

// --- Command palette category list (with icons for palette display, counts derived from data) ---
const CMD_CATEGORIES = [
  { id: 'writing', name: '写作创作', icon: PenTool, color: '#8b5cf6', emoji: '✍️' },
  { id: 'coding', name: '编程开发', icon: Code2, color: '#3b82f6', emoji: '💻' },
  { id: 'marketing', name: '营销文案', icon: Megaphone, color: '#f59e0b', emoji: '📢' },
  { id: 'art', name: '图像生成', icon: Image, color: '#ec4899', emoji: '🎨' },
  { id: 'productivity', name: '效率工具', icon: Zap, color: '#10b981', emoji: '⚡' },
  { id: 'education', name: '学习教育', icon: GraduationCap, color: '#f97316', emoji: '🎓' },
  { id: 'business', name: '商业分析', icon: BarChart2, color: '#06b6d4', emoji: '📊' },
  { id: 'life', name: '生活助手', icon: Heart, color: '#ef4444', emoji: '❤️' },
];

const PAGES = [
  { title: '全部 Prompt', icon: LayoutGrid, path: '/', desc: '浏览所有精选 Prompt' },
  { title: '热门榜单', icon: TrendingUp, path: '/trending', desc: '查看最热门的 Prompt 趋势' },
  { title: 'Prompt 合集', icon: Package, path: '/collections', desc: '浏览精心策划的主题合集' },
  { title: '我的收藏', icon: Bookmark, path: '/favorites', desc: '查看你收藏的所有 Prompt' },
  { title: '个人主页', icon: User, path: '/profile', desc: '查看你的个人资料和成就' },
  /**
   * 2026-04-23
   * 变更类型：add
   * What：命令面板新增 GPT-image2 页面快捷入口。
   * Why：新专页不仅要能从侧边栏进入，也要能被全局搜索与 ⌘K 面板快速定位。
   * Params & return：新增静态页面配置 `{ title, icon, path, desc }`；不改变命令面板其它分组结构。
   * Impact scope：PromptHub 命令面板页面索引与快捷导航。
   * Risk：无已知风险。
   */
  { title: 'GPT-image2', icon: Wand2, path: '/gpt-image2', desc: '打开在线图像生成工作台' },
];

// --- Main Component ---
interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  darkMode: boolean;
  onToggleDark: () => void;
  onOpenPrompt: (prompt: Prompt) => void;
  onRandomExplore: () => void;
}

export function CommandPalette({
  open,
  onClose,
  darkMode,
  onToggleDark,
  onOpenPrompt,
  onRandomExplore,
}: CommandPaletteProps) {
  const dm = darkMode;
  const navigate = useNavigate();
  const store = usePromptStore();
  const { unlockAchievement } = store;
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // 2026-04-09 — P5 迁移：改用 Context 全局数据
  const allPrompts = useAllPrompts();

  // 动态计算分类计数（替代静态 CATEGORY_COUNTS）
  const cmdCategoriesWithCount = useMemo(
    () => CMD_CATEGORIES.map((c) => ({ ...c, count: allPrompts.filter((p) => p.category === c.id).length })),
    [allPrompts],
  );

  // Build groups based on query
  const groups = useMemo<Group[]>(() => {
    const q = query.toLowerCase().trim();

    if (!q) {
      // Default groups when empty
      const recent = store.viewed
        .slice(0, 4)
        .map((id) => allPrompts.find((p) => p.id === id))
        .filter(Boolean) as Prompt[];

      const result: Group[] = [];

      if (recent.length > 0) {
        result.push({
          id: 'recent',
          title: '最近浏览',
          items: recent.map((p) => ({ kind: 'prompt', prompt: p })),
        });
      }

      result.push({
        id: 'actions',
        title: '快速操作',
        items: [
          {
            kind: 'action',
            title: '随机探索 Prompt',
            icon: Shuffle,
            desc: '随机打开一个 Prompt',
            shortcut: 'R',
            color: '#8b5cf6',
            onSelect: () => {
              onRandomExplore();
              unlockAchievement('random_explore');
              onClose();
            },
          },
          {
            kind: 'action',
            title: dm ? '切换亮色模式' : '切换暗色模式',
            icon: dm ? Sun : Moon,
            desc: dm ? '切换到亮色主题' : '切换到暗黑主题',
            shortcut: 'D',
            color: '#6d28d9',
            onSelect: () => {
              onToggleDark();
              unlockAchievement('dark_mode');
              onClose();
            },
          },
          {
            kind: 'action',
            title: '对比 Prompt',
            icon: ArrowLeftRight,
            desc: `对比栏：${store.compare.length}/2 个已选`,
            color: '#7c3aed',
            onSelect: () => {
              navigate('/');
              onClose();
            },
          },
        ] as ItemType[],
      });

      result.push({
        id: 'pages',
        title: '页面导航',
        items: PAGES.map((p) => ({ kind: 'page', ...p }) as ItemType),
      });

      result.push({
        id: 'categories',
        title: '分类探索',
        items: cmdCategoriesWithCount.map(
          (c) =>
            ({
              kind: 'category',
              title: c.name,
              icon: c.icon,
              path: `/category/${c.id}`,
              color: c.color,
              emoji: c.emoji,
              count: c.count,
            }) as ItemType,
        ),
      });

      return result;
    }

    // Search mode
    const matchedPrompts = allPrompts
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)) ||
          p.category.toLowerCase().includes(q),
      )
      .slice(0, 6);

    const matchedPages = PAGES.filter((p) => p.title.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));

    const matchedCategories = cmdCategoriesWithCount.filter(
      (c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    );

    // Unique matching tags
    const allTags = [...new Set(allPrompts.flatMap((p) => p.tags))];
    const matchedTags = allTags.filter((t) => t.toLowerCase().includes(q)).slice(0, 5);

    const result: Group[] = [];
    if (matchedPrompts.length > 0) {
      result.push({
        id: 'prompts',
        title: 'Prompt 搜索结果',
        items: matchedPrompts.map((p) => ({ kind: 'prompt', prompt: p })),
      });
    }
    if (matchedPages.length > 0) {
      result.push({ id: 'pages', title: '页面', items: matchedPages.map((p) => ({ kind: 'page', ...p }) as ItemType) });
    }
    if (matchedCategories.length > 0) {
      result.push({
        id: 'categories',
        title: '分类',
        items: matchedCategories.map(
          (c) =>
            ({
              kind: 'category',
              title: c.name,
              icon: c.icon,
              path: `/category/${c.id}`,
              color: c.color,
              emoji: c.emoji,
              count: c.count,
            }) as ItemType,
        ),
      });
    }
    if (matchedTags.length > 0) {
      result.push({ id: 'tags', title: '标签', items: matchedTags.map((t) => ({ kind: 'tag', name: t }) as ItemType) });
    }

    return result;
  }, [
    query,
    dm,
    store.viewed,
    store.compare.length,
    navigate,
    onClose,
    onRandomExplore,
    onToggleDark,
    unlockAchievement,
    allPrompts,
    cmdCategoriesWithCount,
  ]);

  // Flatten for keyboard nav
  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Execute item action
  const execute = useCallback(
    (item: ItemType) => {
      switch (item.kind) {
        case 'prompt':
          unlockAchievement('first_view');
          onOpenPrompt(item.prompt);
          onClose();
          break;
        case 'page':
          navigate(item.path);
          onClose();
          break;
        case 'category':
          navigate(item.path);
          onClose();
          break;
        case 'tag':
          navigate(`/tag/${encodeURIComponent(item.name)}`);
          unlockAchievement('tag_explorer');
          onClose();
          break;
        case 'action':
          item.onSelect();
          break;
      }
    },
    [navigate, unlockAchievement, onOpenPrompt, onClose],
  );

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (flatItems[activeIndex]) execute(flatItems[activeIndex]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, activeIndex, flatItems, execute, onClose]);

  // Scroll active item into view
  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Reset on open/query change
  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Track flat index across groups
  let globalIdx = 0;

  const CATEGORY_BG: Record<string, string> = {
    coding: 'rgba(59,130,246,0.1)',
    writing: 'rgba(139,92,246,0.1)',
    marketing: 'rgba(245,158,11,0.1)',
    art: 'rgba(236,72,153,0.1)',
    productivity: 'rgba(16,185,129,0.1)',
    education: 'rgba(249,115,22,0.1)',
    business: 'rgba(6,182,212,0.1)',
    life: 'rgba(239,68,68,0.1)',
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
          style={{ backdropFilter: 'blur(6px)', backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 380 }}
            className={`flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${
              dm ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'
            }`}
            style={{ maxHeight: '72vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input */}
            <div
              className={`flex items-center gap-3 border-b px-4 py-3.5 ${dm ? 'border-gray-800' : 'border-gray-100'}`}
            >
              <Search size={16} className={dm ? 'text-gray-400' : 'text-gray-400'} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索 Prompt、页面、命令..."
                className={`flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 ${dm ? 'text-gray-100' : 'text-gray-900'}`}
              />
              <div className="flex items-center gap-2">
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className={`rounded-md p-0.5 transition-colors ${dm ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-700'}`}
                  >
                    <X size={13} />
                  </button>
                )}
                <kbd
                  className={`rounded-md border px-1.5 py-0.5 text-[10px] font-mono ${dm ? 'border-gray-700 bg-gray-800 text-gray-400' : 'border-gray-200 bg-gray-100 text-gray-500'}`}
                >
                  Esc
                </kbd>
              </div>
            </div>

            {/* Results */}
            <div ref={listRef} className="flex flex-col overflow-y-auto pb-2">
              {groups.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <span className="mb-2 text-3xl">🔍</span>
                  <p className={`text-sm ${dm ? 'text-gray-400' : 'text-gray-500'}`}>没有找到「{query}」的相关结果</p>
                </div>
              )}

              {groups.map((group) => (
                <div key={group.id}>
                  {/* Group Header */}
                  <div
                    className={`sticky top-0 flex items-center gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest ${
                      dm ? 'bg-gray-950 text-gray-500' : 'bg-white text-gray-400'
                    }`}
                  >
                    {group.title}
                  </div>

                  {/* Group Items */}
                  {group.items.map((item) => {
                    const idx = globalIdx++;
                    const isActive = idx === activeIndex;

                    if (item.kind === 'prompt') {
                      const catBg = CATEGORY_BG[item.prompt.category] || 'rgba(99,102,241,0.1)';
                      return (
                        <button
                          key={`prompt-${item.prompt.id}`}
                          ref={(el) => {
                            itemRefs.current[idx] = el;
                          }}
                          onClick={() => execute(item)}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            isActive
                              ? dm
                                ? 'bg-indigo-500/10'
                                : 'bg-indigo-50'
                              : dm
                                ? 'hover:bg-gray-800/60'
                                : 'hover:bg-gray-50'
                          }`}
                        >
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                            style={{ background: catBg }}
                          >
                            <Sparkles size={13} style={{ color: '#6366f1' }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-sm font-medium ${dm ? 'text-gray-200' : 'text-gray-800'}`}>
                              <Highlight text={item.prompt.title} query={query} />
                            </p>
                            <p className={`truncate text-[11px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                              <Highlight text={item.prompt.description} query={query} />
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span className={`text-[10px] ${dm ? 'text-gray-600' : 'text-gray-400'}`}>
                              ❤️ {item.prompt.likes}
                            </span>
                            {isActive && <ArrowRight size={12} className="text-indigo-400" />}
                          </div>
                        </button>
                      );
                    }

                    if (item.kind === 'page') {
                      const Icon = item.icon;
                      return (
                        <button
                          key={`page-${item.path}`}
                          ref={(el) => {
                            itemRefs.current[idx] = el;
                          }}
                          onClick={() => execute(item)}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 transition-colors ${
                            isActive
                              ? dm
                                ? 'bg-indigo-500/10'
                                : 'bg-indigo-50'
                              : dm
                                ? 'hover:bg-gray-800/60'
                                : 'hover:bg-gray-50'
                          }`}
                        >
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${dm ? 'bg-gray-800' : 'bg-gray-100'}`}
                          >
                            <Icon size={13} className={dm ? 'text-gray-400' : 'text-gray-500'} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium ${dm ? 'text-gray-200' : 'text-gray-800'}`}>
                              <Highlight text={item.title} query={query} />
                            </p>
                            <p className={`text-[11px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{item.desc}</p>
                          </div>
                          {isActive && <ArrowRight size={12} className="text-indigo-400 shrink-0" />}
                        </button>
                      );
                    }

                    if (item.kind === 'action') {
                      const Icon = item.icon;
                      return (
                        <button
                          key={`action-${item.title}`}
                          ref={(el) => {
                            itemRefs.current[idx] = el;
                          }}
                          onClick={() => execute(item)}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 transition-colors ${
                            isActive
                              ? dm
                                ? 'bg-indigo-500/10'
                                : 'bg-indigo-50'
                              : dm
                                ? 'hover:bg-gray-800/60'
                                : 'hover:bg-gray-50'
                          }`}
                        >
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                            style={{ background: (item.color || '#6366f1') + '18' }}
                          >
                            <Icon size={13} style={{ color: item.color || '#6366f1' }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium ${dm ? 'text-gray-200' : 'text-gray-800'}`}>
                              {item.title}
                            </p>
                            <p className={`text-[11px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{item.desc}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {item.shortcut && (
                              <kbd
                                className={`rounded border px-1.5 py-0.5 text-[10px] font-mono ${dm ? 'border-gray-700 bg-gray-800 text-gray-400' : 'border-gray-200 bg-gray-100 text-gray-500'}`}
                              >
                                {item.shortcut}
                              </kbd>
                            )}
                            {isActive && <ArrowRight size={12} className="text-indigo-400" />}
                          </div>
                        </button>
                      );
                    }

                    if (item.kind === 'category') {
                      const Icon = item.icon;
                      return (
                        <button
                          key={`cat-${item.path}`}
                          ref={(el) => {
                            itemRefs.current[idx] = el;
                          }}
                          onClick={() => execute(item)}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 transition-colors ${
                            isActive
                              ? dm
                                ? 'bg-indigo-500/10'
                                : 'bg-indigo-50'
                              : dm
                                ? 'hover:bg-gray-800/60'
                                : 'hover:bg-gray-50'
                          }`}
                        >
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                            style={{ background: item.color + '18' }}
                          >
                            <Icon size={13} style={{ color: item.color }} />
                          </div>
                          <p className={`flex-1 text-sm font-medium ${dm ? 'text-gray-200' : 'text-gray-800'}`}>
                            {item.emoji} <Highlight text={item.title} query={query} />
                          </p>
                          <span className={`shrink-0 text-[11px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                            {item.count} 个
                          </span>
                          {isActive && <ArrowRight size={12} className="text-indigo-400" />}
                        </button>
                      );
                    }

                    if (item.kind === 'tag') {
                      return (
                        <button
                          key={`tag-${item.name}`}
                          ref={(el) => {
                            itemRefs.current[idx] = el;
                          }}
                          onClick={() => execute(item)}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 transition-colors ${
                            isActive
                              ? dm
                                ? 'bg-indigo-500/10'
                                : 'bg-indigo-50'
                              : dm
                                ? 'hover:bg-gray-800/60'
                                : 'hover:bg-gray-50'
                          }`}
                        >
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${dm ? 'bg-gray-800' : 'bg-gray-100'}`}
                          >
                            <Hash size={13} className={dm ? 'text-gray-400' : 'text-gray-500'} />
                          </div>
                          <p className={`flex-1 text-sm font-medium ${dm ? 'text-gray-200' : 'text-gray-800'}`}>
                            #<Highlight text={item.name} query={query} />
                          </p>
                          <span className={`shrink-0 text-[11px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                            查看标签
                          </span>
                          {isActive && <ArrowRight size={12} className="text-indigo-400" />}
                        </button>
                      );
                    }

                    return null;
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div
              className={`flex items-center justify-between border-t px-4 py-2.5 ${dm ? 'border-gray-800' : 'border-gray-100'}`}
            >
              <div className={`flex items-center gap-3 text-[10px] ${dm ? 'text-gray-600' : 'text-gray-400'}`}>
                <span className="flex items-center gap-1">
                  <kbd
                    className={`rounded border px-1 py-0.5 font-mono ${dm ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-100'}`}
                  >
                    ↑↓
                  </kbd>{' '}
                  导航
                </span>
                <span className="flex items-center gap-1">
                  <kbd
                    className={`rounded border px-1 py-0.5 font-mono ${dm ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-100'}`}
                  >
                    ↵
                  </kbd>{' '}
                  确认
                </span>
                <span className="flex items-center gap-1">
                  <kbd
                    className={`rounded border px-1 py-0.5 font-mono ${dm ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-100'}`}
                  >
                    Esc
                  </kbd>{' '}
                  关闭
                </span>
              </div>
              <div className={`flex items-center gap-1 text-[10px] ${dm ? 'text-gray-600' : 'text-gray-400'}`}>
                <Command size={10} />
                <span>PromptHub</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
