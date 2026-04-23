import { useMemo } from 'react';
import { NavLink } from 'react-router';
import {
  LayoutGrid,
  TrendingUp,
  Bookmark,
  User,
  Package,
  Code2,
  PenTool,
  Megaphone,
  Image,
  Zap,
  GraduationCap,
  BarChart2,
  Heart,
  Flame,
  Telescope,
  Wand2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { CATEGORY_CONFIG } from '../data/constants';
// 2026-04-09 — P5 迁移：不再直接导入 CATEGORY_COUNTS，改用 Context 动态计算
import { useAllPrompts } from '../hooks/usePromptData';

interface SidebarProps {
  darkMode: boolean;
}

// 分类 → 图标组件映射（Sidebar 专用，因 Lucide 组件引用无法存入纯数据层）
const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  all: LayoutGrid,
  coding: Code2,
  writing: PenTool,
  marketing: Megaphone,
  art: Image,
  productivity: Zap,
  education: GraduationCap,
  business: BarChart2,
  life: Heart,
};

const hotTags = ['ChatGPT', '小红书', 'Python', 'Midjourney', 'SEO', '写作', '代码审查', '职场'];

const navLinkClass =
  (dm: boolean) =>
  ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all',
      isActive
        ? dm
          ? 'bg-indigo-500/10 text-indigo-400'
          : 'bg-indigo-50 text-indigo-600'
        : dm
          ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
    );

export function Sidebar({ darkMode: dm }: SidebarProps) {
  // 2026-04-09 — P5 迁移：动态计算分类计数（替代静态 CATEGORY_COUNTS）
  const allPrompts = useAllPrompts();
  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of allPrompts) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return [
      { id: 'all', name: '全部 Prompt', color: '#6366f1', count: allPrompts.length },
      ...Object.entries(CATEGORY_CONFIG).map(([id, cfg]) => ({
        id,
        name: cfg.label,
        color: cfg.color,
        count: counts[id] || 0,
      })),
    ];
  }, [allPrompts]);

  return (
    <aside
      className={cn(
        'custom-scrollbar hidden w-60 shrink-0 flex-col overflow-y-auto overscroll-contain border-r lg:flex',
        dm ? 'border-gray-800 bg-gray-900' : 'border-gray-100 bg-white',
      )}
    >
      <div className="flex flex-col gap-6 p-4">
        {/* ── Category Explore ──────────────────────────────────────────────── */}
        <div>
          <p
            className={`mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest ${dm ? 'text-gray-500' : 'text-gray-400'}`}
          >
            分类探索
          </p>
          <nav className="space-y-0.5">
            {categories.map((cat) => {
              const Icon = CATEGORY_ICON_MAP[cat.id] || LayoutGrid;
              const isAll = cat.id === 'all';
              const to = isAll ? '/' : `/category/${cat.id}`;

              return (
                <NavLink key={cat.id} to={to} end={isAll}>
                  {({ isActive }) => (
                    <span
                      className={cn(
                        'group flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-all',
                        isActive
                          ? dm
                            ? 'bg-indigo-500/10 text-indigo-400'
                            : 'bg-indigo-50 text-indigo-600'
                          : dm
                            ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors"
                          style={{
                            backgroundColor: isActive ? cat.color + '20' : dm ? '#374151' : '#f3f4f6',
                            color: isActive ? cat.color : dm ? '#9ca3af' : '#6b7280',
                          }}
                        >
                          <Icon size={13} />
                        </span>
                        <span className="font-medium">{cat.name}</span>
                      </span>
                      <span
                        className={cn(
                          'rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                          isActive
                            ? dm
                              ? 'bg-indigo-500/20 text-indigo-400'
                              : 'bg-indigo-100 text-indigo-600'
                            : dm
                              ? 'bg-gray-700 text-gray-400'
                              : 'bg-gray-100 text-gray-500',
                        )}
                      >
                        {cat.count}
                      </span>
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className={`h-px ${dm ? 'bg-gray-800' : 'bg-gray-100'}`} />

        {/* ── Personal Space ────────────────────────────────────────────────── */}
        <div>
          <p
            className={`mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest ${dm ? 'text-gray-500' : 'text-gray-400'}`}
          >
            我的空间
          </p>
          <nav className="space-y-0.5">
            <NavLink to="/collections" className={navLinkClass(dm)}>
              <Package size={15} /> Prompt 合集
            </NavLink>
            <NavLink to="/favorites" className={navLinkClass(dm)}>
              <Bookmark size={15} /> 我的收藏
            </NavLink>
            <NavLink to="/trending" className={navLinkClass(dm)}>
              <TrendingUp size={15} /> 热门榜单
            </NavLink>
            <NavLink to="/profile" className={navLinkClass(dm)}>
              <User size={15} /> 个人主页
            </NavLink>
          </nav>
        </div>

        <div className={`h-px ${dm ? 'bg-gray-800' : 'bg-gray-100'}`} />

        {/* ── Hot Tags ──────────────────────────────────────────────────────── */}
        <div>
          <div className="mb-2 flex items-center gap-1.5 px-2">
            <Flame size={11} className="text-orange-400" />
            <p
              className={`text-[10px] font-semibold uppercase tracking-widest ${dm ? 'text-gray-500' : 'text-gray-400'}`}
            >
              热门标签
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 px-2">
            {hotTags.map((tag) => (
              <NavLink
                key={tag}
                to={`/tag/${encodeURIComponent(tag)}`}
                className={({ isActive }) =>
                  cn(
                    'cursor-pointer rounded-lg px-2 py-1 text-[11px] font-medium transition-colors',
                    isActive
                      ? dm
                        ? 'bg-indigo-500/15 text-indigo-400'
                        : 'bg-indigo-50 text-indigo-600'
                      : dm
                        ? 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600',
                  )
                }
              >
                #{tag}
              </NavLink>
            ))}
          </div>
        </div>

        <div className={`h-px ${dm ? 'bg-gray-800' : 'bg-gray-100'}`} />

        {/* ── Galaxy Mode ───────────────────────────────────────────────────── */}
        <div className="space-y-2 px-2">
          <NavLink
            to="/galaxy"
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all',
                isActive
                  ? 'border border-indigo-500/20 bg-linear-to-r from-indigo-500/20 to-violet-500/20 text-indigo-400'
                  : dm
                    ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
              )
            }
          >
            <Telescope size={15} className="shrink-0" />
            <span className="whitespace-nowrap">🌌 银河探索模式</span>
            <span className="ml-auto rounded-full bg-linear-to-r from-violet-500 to-indigo-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
              NEW
            </span>
          </NavLink>

          {/**
           * 2026-04-23
           * 变更类型：add
           * What：在银河探索模式分组下追加 GPT-image2 新入口，并用醒目的渐变样式对齐 Figma 设计稿的侧边栏状态。
           * Why：用户要求将图片生成专页挂到左侧底部的银河探索模式区域，避免新功能埋在原有分类导航中难以发现。
           * Params & return：新增 `NavLink` 指向 `/gpt-image2`；不改变 `SidebarProps` 入参或组件返回类型。
           * Impact scope：PromptHub 左侧导航、GPT-image2 专页主入口。
           * Risk：无已知风险；若后续银河探索模式继续扩展，建议把该区域抽成统一配置数组。
           */}
          <NavLink
            to="/gpt-image2"
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all',
                isActive
                  ? 'border border-violet-300 bg-linear-to-r from-violet-500/15 to-pink-500/10 text-violet-700 shadow-sm'
                  : dm
                    ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    : 'text-violet-600 hover:bg-violet-50/80 hover:text-violet-700',
              )
            }
          >
            <Wand2 size={15} className="shrink-0" />
            <span className="truncate">GPT-image2</span>
            <span className="ml-auto rounded-full bg-linear-to-r from-violet-500 to-pink-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
              NEW
            </span>
          </NavLink>
        </div>
      </div>
    </aside>
  );
}
