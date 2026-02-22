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
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { useState, useRef, useCallback, memo, useMemo, useEffect } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { MOCK_PROMPTS, type Prompt } from '../data/prompts';
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
  const [isFlipped, setIsFlipped] = useState(false);
  // isHovered only changes on enter/leave (2× per interaction) — OK as state
  const [_isHovered, setIsHovered] = useState(false);

  const openDrawer = useOpenDrawer();

  // Tilt & glow updated via direct DOM — zero React re-renders on mousemove
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const catConfig = CATEGORY_CONFIG[prompt.category] || CATEGORY_CONFIG.coding;
  const modelConfig = prompt.model ? MODEL_CONFIG[prompt.model] : null;
  const dm = darkMode;

  const relatedPrompts = useMemo(
    () => MOCK_PROMPTS.filter((p) => p.id !== prompt.id && p.category === prompt.category).slice(0, 3),
    [prompt.id, prompt.category],
  );

  // Auto flip back if unsaved externally (e.g., from detail drawer)
  // Only react to isSaved changes — NOT isFlipped changes.
  // Otherwise setIsFlipped(true) in handleSave triggers this effect
  // before the parent re-renders with isSaved=true, causing an
  // immediate flip-back (isSaved still false + isFlipped true → reset).
  useEffect(() => {
    if (!isSaved && isFlipped) setIsFlipped(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaved]);

  // Auto flip back after 4 seconds on back face
  useEffect(() => {
    if (isFlipped) {
      flipTimerRef.current = setTimeout(() => {
        setIsFlipped(false);
      }, 4000);
    } else {
      // Clear timer when flipped back (manually or automatically)
      if (flipTimerRef.current) {
        clearTimeout(flipTimerRef.current);
        flipTimerRef.current = null;
      }
    }
    return () => {
      if (flipTimerRef.current) {
        clearTimeout(flipTimerRef.current);
        flipTimerRef.current = null;
      }
    };
  }, [isFlipped]);

  /* ── Mouse-tracking tilt (NO setState) ─────────────────────────────── */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isFlipped) return;
      const card = cardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;

      // Tilt on outer wrapper (outside preserve-3d chain) — stable 2D hit-testing on card
      const tilt = tiltRef.current;
      if (tilt) {
        tilt.style.transform = `perspective(800px) rotateX(${ny * -2.5}deg) rotateY(${nx * 2.5}deg) scale(1.02) translateZ(0)`;
        tilt.style.transition = 'transform 0.12s ease';
      }

      if (glowRef.current) {
        const gx = (nx + 0.5) * 100;
        const gy = (ny + 0.5) * 100;
        glowRef.current.style.background = `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,${dm ? '0.055' : '0.12'}) 0%, transparent 65%)`;
      }

      // Parallax inner elements — depth-based translation
      const parallaxEls = card.querySelectorAll<HTMLElement>('[data-parallax]');
      parallaxEls.forEach((el) => {
        const depth = parseFloat(el.dataset.parallax || '0');
        el.style.transform = `translate(${nx * depth}px, ${ny * depth}px)`;
        el.style.transition = 'transform 0.12s ease';
      });
    },
    [dm, isFlipped],
  );

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    // Reset tilt on outer wrapper
    const tilt = tiltRef.current;
    if (tilt) {
      tilt.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1) translateZ(0)';
      tilt.style.transition = 'transform 0.45s cubic-bezier(0.23,1,0.32,1)';
    }
    // Reset parallax inner elements
    const card = cardRef.current;
    if (card) {
      const parallaxEls = card.querySelectorAll<HTMLElement>('[data-parallax]');
      parallaxEls.forEach((el) => {
        el.style.transform = 'translate(0, 0)';
        el.style.transition = 'transform 0.45s cubic-bezier(0.23,1,0.32,1)';
      });
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
    if (!isSaved) {
      // Saving: collapse expanded preview, then 3D flip to back
      if (expanded) {
        setExpanded(false);
        setTimeout(() => {
          setIsFlipped(true);
          onToggleSave(prompt.id);
          toast.success('已添加到收藏 ⭐');
        }, 350);
      } else {
        setIsFlipped(true);
        onToggleSave(prompt.id);
        toast.success('已添加到收藏 ⭐');
      }
    } else {
      // Unsaving: if flipped, flip back first
      if (isFlipped) {
        setIsFlipped(false);
        setTimeout(() => {
          onToggleSave(prompt.id);
          toast.success('已移出收藏');
        }, 600);
      } else {
        onToggleSave(prompt.id);
        toast.success('已移出收藏');
      }
    }
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
      {/* Tilt wrapper — outside preserve-3d chain, receives tilt via DOM.
          Card has no 3D transform → stable hover hit-testing */}
      <div
        ref={tiltRef}
        style={{
          willChange: 'transform',
          transform: 'perspective(800px) translateZ(0)',
        }}
      >
        {/* 3D Flip Container — perspective only, no events */}
        <div style={{ perspective: '1200px' }}>
          <div
            style={{
              transformStyle: 'preserve-3d',
              transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              position: 'relative',
            }}
          >
            {/* ── FRONT FACE ── flat breaks preserve-3d chain → 2D hit-testing for card children */}
            <div
              style={{
                backfaceVisibility: 'hidden',
                transformStyle: 'flat' as const,
                pointerEvents: isFlipped ? 'none' : 'auto',
              }}
            >
              {/* Card — mouse events here, NO 3D transform (tilt is on outer wrapper) */}
              <div
                ref={cardRef}
                onMouseMove={handleMouseMove}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
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
                  {/* Header — parallax mid layer */}
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
                            'rounded-lg p-2 transition-all',
                            isInCompare
                              ? dm
                                ? 'text-violet-400'
                                : 'text-violet-600'
                              : compareIsFull
                                ? dm
                                  ? 'text-gray-700 cursor-not-allowed'
                                  : 'text-gray-200 cursor-not-allowed'
                                : dm
                                  ? 'text-gray-600 hover:text-violet-400 hover:bg-gray-800/60'
                                  : 'text-gray-300 hover:text-violet-600 hover:bg-gray-100',
                          )}
                        >
                          <ArrowLeftRight size={15} className={isInCompare ? 'fill-current opacity-80' : ''} />
                        </button>
                      )}
                      <button
                        onClick={handleSave}
                        className={cn(
                          'rounded-lg p-2 transition-all',
                          isSaved
                            ? dm
                              ? 'text-yellow-400'
                              : 'text-yellow-500'
                            : dm
                              ? 'text-gray-600 hover:text-yellow-400 hover:bg-gray-800/60'
                              : 'text-gray-300 hover:text-yellow-500 hover:bg-gray-100',
                        )}
                        title={isSaved ? '取消收藏' : '添加到收藏'}
                      >
                        {isSaved ? <BookmarkCheck size={15} className="fill-current" /> : <Bookmark size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Title — parallax mid layer */}
                  <button
                    onClick={() => openDrawer(prompt)}
                    className={`text-left text-[15px] font-semibold leading-snug transition-colors group-hover:text-indigo-500 ${dm ? 'text-gray-100' : 'text-gray-900'}`}
                  >
                    {prompt.title}
                  </button>

                  {/* Description — parallax shallow layer */}
                  <p className={`text-sm leading-relaxed ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                    {prompt.description}
                  </p>

                  {/* Prompt content preview — parallax front layer */}
                  <div
                    data-parallax="4"
                    className={`relative rounded-xl border p-3.5 ${dm ? 'border-gray-700/50 bg-gray-800/60' : 'border-gray-100 bg-gray-50'}`}
                  >
                    <motion.div
                      animate={{ height: expanded ? 'auto' : 76 }}
                      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <pre
                        className={cn(
                          'whitespace-pre-wrap wrap-break-word font-mono text-[11px] leading-relaxed',
                          dm ? 'text-gray-300' : 'text-gray-600',
                        )}
                      >
                        {prompt.content}
                      </pre>
                    </motion.div>
                    <motion.div
                      animate={{ opacity: expanded ? 0 : 1 }}
                      transition={{ duration: 0.25 }}
                      className={`pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-linear-to-t ${dm ? 'from-gray-800/90 to-transparent' : 'from-gray-50 to-transparent'}`}
                    />
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

                  {/* Expand / Detail actions — parallax mid-shallow */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setExpanded(!expanded)}
                      className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 -ml-2 text-xs font-medium transition-colors ${dm ? 'text-gray-500 hover:text-indigo-400 hover:bg-gray-800/60' : 'text-gray-400 hover:text-indigo-600 hover:bg-gray-100'}`}
                    >
                      {expanded ? (
                        <>
                          <ChevronUp size={14} />
                          收起
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} />
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

                  {/* Tags — parallax shallow layer */}
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

                {/* Footer — parallax foremost layer */}
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
            </div>

            {/* ── BACK FACE ── */}
            <div
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                position: 'absolute',
                inset: 0,
                pointerEvents: isFlipped ? 'auto' : 'none',
              }}
            >
              {/* Card container */}
              <div
                className={cn(
                  'flex h-full flex-col overflow-hidden rounded-2xl border',
                  dm ? 'border-gray-800 bg-gray-900' : 'border-gray-200/80 bg-white',
                )}
              >
                {/* Accent bar — delay 100ms */}
                <div
                  className="h-0.5 w-full shrink-0 rounded-t-2xl"
                  style={{
                    background: `linear-gradient(90deg, ${catConfig.color}, ${catConfig.color}33)`,
                    opacity: isFlipped ? 1 : 0,
                    transform: isFlipped ? 'translateY(0) scaleX(1)' : 'translateY(-4px) scaleX(0.3)',
                    transition: 'opacity 0.4s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1)',
                    transitionDelay: isFlipped ? '0.15s' : '0s',
                    transformOrigin: 'left center',
                  }}
                />

                {/* Content area */}
                <div className="flex flex-1 flex-col gap-4 p-5">
                  {/* Saved confirmation — delay 200ms */}
                  <div
                    className="flex items-center gap-2.5"
                    style={{
                      opacity: isFlipped ? 1 : 0,
                      transform: isFlipped ? 'translateY(0) scale(1)' : 'translateY(14px) scale(0.92)',
                      transition: 'opacity 0.4s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1)',
                      transitionDelay: isFlipped ? '0.25s' : '0s',
                    }}
                  >
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-xl',
                        dm ? 'bg-yellow-500/15' : 'bg-yellow-50',
                      )}
                    >
                      <BookmarkCheck size={16} className={dm ? 'text-yellow-400' : 'text-yellow-500'} />
                    </div>
                    <div>
                      <p className={cn('text-sm font-semibold', dm ? 'text-gray-100' : 'text-gray-900')}>已收藏</p>
                      <p className={cn('truncate text-[11px]', dm ? 'text-gray-500' : 'text-gray-400')}>
                        {prompt.title}
                      </p>
                    </div>
                  </div>

                  {/* Divider — delay 350ms */}
                  <div
                    className="flex items-center gap-3"
                    style={{
                      opacity: isFlipped ? 1 : 0,
                      transform: isFlipped ? 'translateY(0)' : 'translateY(8px)',
                      transition: 'opacity 0.35s ease, transform 0.4s ease-out',
                      transitionDelay: isFlipped ? '0.35s' : '0s',
                    }}
                  >
                    <div className={cn('h-px flex-1', dm ? 'bg-gray-800' : 'bg-gray-100')} />
                    <span
                      className={cn(
                        'text-[10px] font-medium uppercase tracking-wider',
                        dm ? 'text-gray-600' : 'text-gray-300',
                      )}
                    >
                      猜你喜欢
                    </span>
                    <div className={cn('h-px flex-1', dm ? 'bg-gray-800' : 'bg-gray-100')} />
                  </div>

                  {/* Related prompts — delays 450ms, 550ms, 650ms */}
                  <div className="flex flex-1 flex-col gap-2">
                    {relatedPrompts.map((related, idx) => (
                      <button
                        key={related.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Cancel auto-flip timer on interaction
                          if (flipTimerRef.current) {
                            clearTimeout(flipTimerRef.current);
                            flipTimerRef.current = null;
                          }
                          openDrawer(related);
                        }}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border p-2.5 text-left transition-colors',
                          dm
                            ? 'border-gray-800 hover:border-gray-700 hover:bg-gray-800/60'
                            : 'border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30',
                        )}
                        style={{
                          opacity: isFlipped ? 1 : 0,
                          transform: isFlipped ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.94)',
                          transition:
                            'opacity 0.4s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1), background-color 0.15s, border-color 0.15s',
                          transitionDelay: isFlipped ? `${0.45 + idx * 0.1}s` : '0s',
                        }}
                      >
                        <div
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[8px] font-bold text-white"
                          style={{
                            background: `linear-gradient(135deg, ${catConfig.color}, ${catConfig.color}99)`,
                          }}
                        >
                          {related.title[0]}
                        </div>
                        <p
                          className={cn('flex-1 truncate text-xs font-medium', dm ? 'text-gray-300' : 'text-gray-700')}
                        >
                          {related.title}
                        </p>
                        <ChevronRight size={12} className={cn('shrink-0', dm ? 'text-gray-600' : 'text-gray-300')} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer — delay 700ms */}
                <div
                  className={cn('border-t px-5 py-3', dm ? 'border-gray-800' : 'border-gray-100')}
                  style={{
                    opacity: isFlipped ? 1 : 0,
                    transform: isFlipped ? 'translateY(0)' : 'translateY(10px)',
                    transition: 'opacity 0.35s ease, transform 0.4s ease-out',
                    transitionDelay: isFlipped ? '0.7s' : '0s',
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFlipped(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition-all',
                      dm
                        ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
                    )}
                  >
                    <RotateCcw size={12} />
                    翻回正面
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});
