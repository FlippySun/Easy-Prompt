import { useParams, Link } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import Masonry, { ResponsiveMasonry } from 'react-responsive-masonry';
import { Hash, ArrowLeft, Flame, Clock, Copy, TrendingUp, Tag } from 'lucide-react';
import { motion } from 'motion/react';
import { MOCK_PROMPTS } from '../data/prompts';
import { PromptCard } from '../components/PromptCard';
import { useLayoutContext } from '../components/Layout';
import { usePromptStore } from '../hooks/usePromptStore';

// All tags with usage count
function buildTagStats() {
  const stats: Record<string, { count: number; promptIds: string[] }> = {};
  MOCK_PROMPTS.forEach((p) => {
    p.tags.forEach((tag) => {
      if (!stats[tag]) stats[tag] = { count: 0, promptIds: [] };
      stats[tag].count++;
      stats[tag].promptIds.push(p.id);
    });
  });
  return stats;
}

const TAG_STATS = buildTagStats();
const ALL_TAGS = Object.entries(TAG_STATS)
  .sort((a, b) => b[1].count - a[1].count)
  .map(([name, { count }]) => ({ name, count }));

export function TagFilter() {
  const { tagName } = useParams<{ tagName: string }>();
  const { darkMode } = useLayoutContext();
  const store = usePromptStore();
  const { unlockAchievement } = store;
  const dm = darkMode;
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'most_copied'>('popular');

  const decodedTag = tagName ? decodeURIComponent(tagName) : '';

  // Unlock tag explorer achievement
  useEffect(() => {
    if (decodedTag) unlockAchievement('tag_explorer');
  }, [decodedTag, unlockAchievement]);

  const filteredPrompts = useMemo(() => {
    const prompts = MOCK_PROMPTS.filter((p) => p.tags.some((t) => t === decodedTag));
    if (sortBy === 'popular') prompts.sort((a, b) => b.likes - a.likes);
    else if (sortBy === 'newest') prompts.sort((a, b) => b.date.localeCompare(a.date));
    else if (sortBy === 'most_copied') prompts.sort((a, b) => b.copies - a.copies);
    return prompts;
  }, [decodedTag, sortBy]);

  // Related tags: tags that appear in the same prompts
  const relatedTags = useMemo(() => {
    const related: Record<string, number> = {};
    filteredPrompts.forEach((p) => {
      p.tags
        .filter((t) => t !== decodedTag)
        .forEach((t) => {
          related[t] = (related[t] || 0) + 1;
        });
    });
    return Object.entries(related)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [filteredPrompts, decodedTag]);

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Back + Header */}
      <div className="flex flex-col gap-4">
        <Link
          to="/"
          className={`flex w-fit items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${dm ? 'border-gray-800 text-gray-400 hover:bg-gray-800 hover:text-gray-200' : 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
        >
          <ArrowLeft size={13} /> 返回首页
        </Link>

        <div
          className={`flex flex-col gap-4 overflow-hidden rounded-2xl border p-6 ${dm ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-indigo-600">
              <Hash size={22} className="text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${dm ? 'text-gray-100' : 'text-gray-900'}`}>#{decodedTag}</h1>
              <p className={`text-sm ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                找到 {filteredPrompts.length} 个相关 Prompt
              </p>
            </div>
          </div>

          {/* Related tags */}
          {relatedTags.length > 0 && (
            <div>
              <p className={`mb-2 text-[11px] font-medium ${dm ? 'text-gray-500' : 'text-gray-400'}`}>相关标签</p>
              <div className="flex flex-wrap gap-1.5">
                {relatedTags.map(([tag, count]) => (
                  <Link
                    key={tag}
                    to={`/tag/${encodeURIComponent(tag)}`}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${dm ? 'border-gray-700 bg-gray-800 text-gray-300 hover:border-indigo-500 hover:text-indigo-400' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600'}`}
                  >
                    <Hash size={9} />
                    {tag}
                    <span
                      className={`ml-0.5 rounded-md px-1 text-[9px] ${dm ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400'}`}
                    >
                      {count}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sort Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-indigo-500" />
          <span className={`text-sm font-semibold ${dm ? 'text-gray-300' : 'text-gray-700'}`}>
            #{decodedTag} 相关 Prompt
          </span>
        </div>
        <div className="flex items-center overflow-hidden rounded-xl border text-xs font-medium">
          {[
            { id: 'popular', icon: Flame, label: '最热' },
            { id: 'newest', icon: Clock, label: '最新' },
            { id: 'most_copied', icon: Copy, label: '最多复制' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setSortBy(id as 'popular' | 'newest' | 'most_copied')}
              className={`flex items-center gap-1 px-3 py-2 transition-colors ${
                sortBy === id
                  ? dm
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'bg-indigo-50 text-indigo-600'
                  : dm
                    ? 'border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              } border-r last:border-r-0 ${dm ? 'border-gray-700' : 'border-gray-200'}`}
            >
              <Icon size={12} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filteredPrompts.length > 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <ResponsiveMasonry columnsCountBreakPoints={{ 0: 1, 640: 1, 768: 2, 1100: 2, 1280: 3 }}>
            <Masonry gutter="16px">
              {filteredPrompts.map((prompt, index) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  index={index}
                  darkMode={dm}
                  isLiked={store.isLiked(prompt.id)}
                  isSaved={store.isSaved(prompt.id)}
                  isInCompare={store.isInCompare(prompt.id)}
                  compareIsFull={store.compare.length >= 2 && !store.isInCompare(prompt.id)}
                  onToggleLike={store.toggleLike}
                  onToggleSave={store.toggleSave}
                  onRecordCopy={store.recordCopy}
                  onToggleCompare={store.toggleCompare}
                  showCompare
                />
              ))}
            </Masonry>
          </ResponsiveMasonry>
        </motion.div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24">
          <span className="mb-3 text-4xl">🏷️</span>
          <p className={`text-sm ${dm ? 'text-gray-400' : 'text-gray-500'}`}>暂无标签为「{decodedTag}」的 Prompt</p>
        </div>
      )}

      {/* Tag Cloud Section */}
      <div className={`rounded-2xl border p-5 ${dm ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}>
        <div className="mb-4 flex items-center gap-2">
          <Tag size={14} className="text-violet-400" />
          <h3 className={`text-sm font-semibold ${dm ? 'text-gray-200' : 'text-gray-800'}`}>全部热门标签</h3>
          <span className={`text-[11px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>({ALL_TAGS.length} 个)</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_TAGS.map(({ name, count }) => {
            const isActive = name === decodedTag;
            const sizeCls = count >= 4 ? 'text-sm' : count >= 3 ? 'text-[12px]' : 'text-[11px]';
            return (
              <Link
                key={name}
                to={`/tag/${encodeURIComponent(name)}`}
                className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 font-medium transition-all ${sizeCls} ${
                  isActive
                    ? 'border-indigo-400 bg-indigo-500 text-white'
                    : dm
                      ? 'border-gray-700 bg-gray-800 text-gray-300 hover:border-indigo-500 hover:text-indigo-400'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600'
                }`}
              >
                #{name}
                {count > 1 && (
                  <span
                    className={`rounded px-1 text-[9px] ${isActive ? 'bg-indigo-600 text-indigo-100' : dm ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400'}`}
                  >
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
