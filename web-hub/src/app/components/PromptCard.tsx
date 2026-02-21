import { motion } from 'motion/react';
import {
  Copy,
  Heart,
  Eye,
  Check,
  ChevronDown,
  ChevronUp,
  Bot,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  ArrowLeftRight,
} from 'lucide-react';
import { useState, useRef, useCallback, memo } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import type { Prompt } from '../data/prompts';
import { CATEGORY_CONFIG, MODEL_CONFIG, formatCount } from '../data/constants';
import { useOpenDrawer } from '../hooks/useDrawerContext';
import { triggerLikeBurst } from './ParticleBurst';

interface PromptCardProps {
  prompt: Prompt;
  index: number;
  darkMode: boolean;
  isLiked: boolean;
  isSaved: boolean;
  isInCompare: boolean;
  compareIsFull: boolean;
  onToggleLike: (id: string) => void;
  onToggleSave: (id: string) => void;
  onRecordCopy: (id: string) => void;
  onToggleCompare: (id: string) => void;
  batchMode?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  showCompare?: boolean;
}

export const PromptCard = memo(function PromptCard({
  prompt,
  index,
  darkMode,
  isLiked,
  isSaved,
  isInCompare,
  compareIsFull,
  onToggleLike,
  onToggleSave,
  onRecordCopy,
  onToggleCompare,
  batchMode: _batchMode,
  selected,
  onSelect: _onSelect,
  showCompare,
}: PromptCardProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // isHovered only changes on enter/leave (2× per interaction) — OK as state
  const [_isHovered, setIsHovered] = useState(false);

  const openDrawer = useOpenDrawer();

  // Tilt & glow updated via direct DOM — zero React re-renders on mousemove
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const catConfig = CATEGORY_CONFIG[prompt.category] || CATEGORY_CONFIG.coding;
  const modelConfig = prompt.model ? MODEL_CONFIG[prompt.model] : null;
  const dm = darkMode;

  /* ── Mouse-tracking tilt (NO setState) ─────────────────────────────── */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const card = cardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;

      // Direct DOM — bypasses React reconciler entirely
      card.style.transform = `perspective(800px) rotateX(${ny * -10}deg) rotateY(${nx * 10}deg) scale(1.02) translateZ(0)`;
      card.style.transition = 'transform 0.12s ease';

      if (glowRef.current) {
        const gx = (nx + 0.5) * 100;
        const gy = (ny + 0.5) * 100;
        glowRef.current.style.background = `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,${dm ? '0.055' : '0.12'}) 0%, transparent 65%)`;
      }
    },
    [dm],
  );

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    const card = cardRef.current;
    if (card) {
      card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1) translateZ(0)';
      card.style.transition = 'transform 0.45s cubic-bezier(0.23,1,0.32,1)';
    }
  }, []);

  /* ── Actions ────────────────────────────────────────────────────────── */
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(prompt.content);
      setCopied(true);
      onRecordCopy(prompt.id);
      toast.success('已复制到剪贴板！');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLiked) triggerLikeBurst(e.clientX, e.clientY);
    onToggleLike(prompt.id);
    if (!isLiked) toast.success('已点赞 ❤️');
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSave(prompt.id);
    toast.success(isSaved ? '已移出收藏' : '已添加到收藏 ⭐');
  };

  const handleCompare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (compareIsFull) {
      toast.info('最多可对比 2 个 Prompt', {
        description: '请先移除一个再添加',
      });
      return;
    }
    onToggleCompare(prompt.id);
    toast.success(isInCompare ? '已从对比栏移除' : '已加入对比栏 ⚖️');
  };

  return (
    /* Entrance animation wrapper — never touched after mount */
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: Math.min(index * 0.04, 0.6),
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      {/* Tilt target — styled directly via DOM, no state */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          willChange: 'transform',
          transform: 'perspective(800px) translateZ(0)',
        }}
        className={cn(
          'card-glow-border group relative flex flex-col overflow-hidden rounded-2xl border transition-[border-color,box-shadow] duration-300',
          selected
            ? dm
              ? 'border-indigo-500 shadow-lg shadow-indigo-500/15'
              : 'border-indigo-400 shadow-lg shadow-indigo-500/15'
            : '',
          !selected &&
            (dm
              ? 'border-gray-800 bg-gray-900 hover:border-gray-700 hover:shadow-2xl hover:shadow-black/40'
              : 'border-gray-200/80 bg-white hover:border-indigo-200 hover:shadow-2xl hover:shadow-indigo-500/10'),
          dm ? 'bg-gray-900' : 'bg-white',
        )}
      >
        {/* Mouse-follow glow — updated via direct DOM ref */}
        <div
          ref={glowRef}
          className="pointer-events-none absolute inset-0 z-10 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />

        {/* Color accent bar */}
        <div
          className="h-0.5 w-full shrink-0"
          style={{
            background: `linear-gradient(90deg, ${catConfig.color}, ${catConfig.color}33)`,
          }}
        />

        <div className="flex flex-col gap-3 p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  background: dm ? catConfig.darkBg : catConfig.bg,
                  color: dm ? catConfig.darkColor : catConfig.color,
                }}
              >
                {catConfig.label}
              </span>
              {modelConfig && (
                <span
                  className="inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    borderColor: modelConfig.color + '40',
                    color: modelConfig.color,
                    background: modelConfig.color + '10',
                  }}
                >
                  <Bot size={9} />
                  {modelConfig.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {showCompare && (
                <button
                  onClick={handleCompare}
                  title={isInCompare ? '从对比栏移除' : compareIsFull ? '对比栏已满' : '加入对比'}
                  className={cn(
                    'rounded-lg p-1.5 transition-all',
                    isInCompare
                      ? dm
                        ? 'text-violet-400'
                        : 'text-violet-600'
                      : compareIsFull
                        ? dm
                          ? 'text-gray-700 cursor-not-allowed'
                          : 'text-gray-200 cursor-not-allowed'
                        : dm
                          ? 'text-gray-600 hover:text-violet-400'
                          : 'text-gray-300 hover:text-violet-600',
                  )}
                >
                  <ArrowLeftRight size={13} className={isInCompare ? 'fill-current opacity-80' : ''} />
                </button>
              )}
              <button
                onClick={handleSave}
                className={cn(
                  'rounded-lg p-1.5 transition-all',
                  isSaved
                    ? dm
                      ? 'text-yellow-400'
                      : 'text-yellow-500'
                    : dm
                      ? 'text-gray-600 hover:text-yellow-400'
                      : 'text-gray-300 hover:text-yellow-500',
                )}
                title={isSaved ? '取消收藏' : '添加到收藏'}
              >
                {isSaved ? <BookmarkCheck size={14} className="fill-current" /> : <Bookmark size={14} />}
              </button>
            </div>
          </div>

          {/* Title */}
          <button
            onClick={() => openDrawer(prompt)}
            className={`text-left text-[15px] font-semibold leading-snug transition-colors group-hover:text-indigo-500 ${dm ? 'text-gray-100' : 'text-gray-900'}`}
          >
            {prompt.title}
          </button>

          {/* Description */}
          <p className={`text-sm leading-relaxed ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{prompt.description}</p>

          {/* Prompt content preview */}
          <div
            className={`relative overflow-hidden rounded-xl border p-3.5 ${dm ? 'border-gray-700/50 bg-gray-800/60' : 'border-gray-100 bg-gray-50'}`}
          >
            <pre
              className={cn(
                'whitespace-pre-wrap wrap-break-word font-mono text-[11px] leading-relaxed transition-all',
                dm ? 'text-gray-300' : 'text-gray-600',
                expanded ? '' : 'line-clamp-4',
              )}
            >
              {prompt.content}
            </pre>
            {!expanded && (
              <div
                className={`absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t ${dm ? 'from-gray-800/90 to-transparent' : 'from-gray-50 to-transparent'}`}
              />
            )}
            <button
              onClick={handleCopy}
              className={cn(
                'absolute right-2 top-2 flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-all',
                copied
                  ? 'bg-green-500 text-white'
                  : dm
                    ? 'bg-gray-700 text-gray-300 hover:bg-indigo-600 hover:text-white'
                    : 'bg-white text-gray-500 shadow-sm hover:bg-indigo-600 hover:text-white',
              )}
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? '已复制' : '复制'}
            </button>
          </div>

          {/* Expand / Detail actions */}
          <div className="flex items-center justify-between -mt-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className={`flex items-center gap-1 text-[11px] font-medium transition-colors ${dm ? 'text-gray-500 hover:text-indigo-400' : 'text-gray-400 hover:text-indigo-600'}`}
            >
              {expanded ? (
                <>
                  <ChevronUp size={12} />
                  收起
                </>
              ) : (
                <>
                  <ChevronDown size={12} />
                  展开
                </>
              )}
            </button>
            <button
              onClick={() => openDrawer(prompt)}
              className={`flex items-center gap-1 text-[11px] font-medium transition-colors ${dm ? 'text-gray-500 hover:text-indigo-400' : 'text-gray-400 hover:text-indigo-600'}`}
            >
              查看详情 <ExternalLink size={10} />
            </button>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {prompt.tags.map((tag) => (
              <Link
                key={tag}
                to={`/tag/${encodeURIComponent(tag)}`}
                onClick={(e) => e.stopPropagation()}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  dm
                    ? 'bg-gray-800 text-gray-400 hover:bg-indigo-500/15 hover:text-indigo-400'
                    : 'bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600'
                }`}
              >
                #{tag}
              </Link>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className={`mt-auto flex items-center justify-between border-t px-5 py-3 ${dm ? 'border-gray-800 bg-gray-900/50' : 'border-gray-100 bg-gray-50/50'}`}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{
                background: `linear-gradient(135deg, ${catConfig.color}, ${catConfig.color}99)`,
              }}
            >
              {prompt.author[0].toUpperCase()}
            </div>
            <div className="flex items-center gap-3 text-[11px] font-medium">
              <span className={dm ? 'text-gray-500' : 'text-gray-400'}>{prompt.author}</span>
              <span className={`flex items-center gap-1 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                <Eye size={11} />
                {formatCount(prompt.views)}
              </span>
              <span className={`flex items-center gap-1 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                <Copy size={11} />
                {formatCount(prompt.copies)}
              </span>
            </div>
          </div>
          <button
            onClick={handleLike}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all',
              isLiked
                ? dm
                  ? 'bg-red-500/10 text-red-400'
                  : 'bg-red-50 text-red-500'
                : dm
                  ? 'text-gray-500 hover:bg-gray-800 hover:text-red-400'
                  : 'text-gray-400 hover:bg-red-50 hover:text-red-500',
            )}
          >
            <Heart size={13} className={cn('transition-all', isLiked ? 'fill-current scale-110' : '')} />
            <span>{formatCount(prompt.likes + (isLiked ? 1 : 0))}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
});
