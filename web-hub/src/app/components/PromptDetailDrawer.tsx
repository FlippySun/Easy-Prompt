import { Drawer } from 'vaul';
import { useState, useMemo, useRef, useCallback, useEffect, type ReactNode } from 'react';
import {
  X,
  Copy,
  Check,
  Heart,
  Bookmark,
  BookmarkCheck,
  Share2,
  Eye,
  Tag,
  Bot,
  Calendar,
  Play,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
// 2026-04-09 — P5 迁移：不再直接导入 MOCK_PROMPTS，改用 PromptDataContext
import { type Prompt } from '../data/prompts';
import { useRelatedPrompts } from '../hooks/usePromptData';
import { CATEGORY_CONFIG, MODEL_LABELS, formatCount } from '../data/constants';
import { usePromptStore } from '../hooks/usePromptStore';
import { useInteractions } from '../hooks/useInteractions';

/** Extract [variable] placeholders from prompt content */
function extractVariables(content: string): string[] {
  const matches = content.match(/\[([^\]]{1,40})\]/g) || [];
  return [...new Set(matches.map((m) => m.slice(1, -1)))];
}

/** Replace [variable] with user-supplied values */
function applyVariables(content: string, vars: Record<string, string>): string {
  return content.replace(/\[([^\]]{1,40})\]/g, (match, key) => {
    return vars[key] !== undefined && vars[key] !== '' ? vars[key] : match;
  });
}

interface PromptDetailDrawerProps {
  prompt: Prompt;
  darkMode: boolean;
  children?: ReactNode;
  // Controlled mode (for random explore etc.)
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export function PromptDetailDrawer({
  prompt,
  darkMode,
  children,
  externalOpen,
  onExternalOpenChange,
}: PromptDetailDrawerProps) {
  const isControlled = externalOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? externalOpen! : internalOpen;
  const setOpen = isControlled ? onExternalOpenChange! : setInternalOpen;
  const [tab, setTab] = useState<'content' | 'playground'>('content');
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closingTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const store = usePromptStore();
  // 2026-04-10 — P5 修复：改用 useInteractions() 进行交互操作（乐观更新 + API 同步）
  const interactions = useInteractions();
  const catConfig = CATEGORY_CONFIG[prompt.category] || CATEGORY_CONFIG.coding;
  const variables = useMemo(() => extractVariables(prompt.content), [prompt.content]);
  const hasVars = variables.length > 0;

  const preview = useMemo(() => applyVariables(prompt.content, varValues), [prompt.content, varValues]);

  // 2026-04-09 — P5 迁移：相关推荐改用 Context 数据
  const relatedPrompts = useRelatedPrompts(prompt.id, prompt.category, 3);

  const handleOpen = () => {
    setOpen(true);
    interactions.recordView(prompt.id);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      interactions.recordCopy(prompt.id);
      toast.success('已复制到剪贴板！', { description: '可直接粘贴到 AI 工具中使用' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败，请手动选择复制');
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href + '#' + prompt.id);
    toast.success('链接已复制！', { description: '分享给你的朋友吧 🎉' });
  };

  const dm = darkMode;
  const isLiked = store.isLiked(prompt.id);
  const isSaved = store.isSaved(prompt.id);

  // Intercept close to play exit animation before unmount
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (closingTimerRef.current) {
        clearTimeout(closingTimerRef.current);
        closingTimerRef.current = undefined;
      }
      if (newOpen) {
        setIsClosing(false);
        setOpen(true);
      } else {
        setIsClosing(true);
        closingTimerRef.current = setTimeout(() => {
          setOpen(false);
          closingTimerRef.current = undefined;
        }, 350);
      }
    },
    [setOpen],
  );

  // Reset closing state when drawer opens
  useEffect(() => {
    if (open) setIsClosing(false);
  }, [open]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (closingTimerRef.current) clearTimeout(closingTimerRef.current);
    };
  }, []);

  const inputCls = `w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all ${
    dm
      ? 'border-gray-700 bg-gray-800 text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30'
      : 'border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-400/20'
  }`;

  return (
    <Drawer.Root open={open || isClosing} onOpenChange={handleOpenChange} direction="right">
      {children && (
        <Drawer.Trigger asChild onClick={handleOpen}>
          {children}
        </Drawer.Trigger>
      )}
      <Drawer.Portal>
        <Drawer.Overlay
          className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm ${isClosing ? 'drawer-overlay-closing' : ''}`}
        />
        <Drawer.Content
          className={`fixed bottom-0 right-0 top-0 z-50 flex w-full flex-col outline-none sm:w-[520px] ${
            dm ? 'bg-gray-900' : 'bg-white'
          } shadow-2xl ${isClosing ? 'drawer-closing' : ''}`}
        >
          <Drawer.Title className="sr-only">{prompt.title}</Drawer.Title>
          <Drawer.Description className="sr-only">{prompt.description}</Drawer.Description>
          {/* Header */}
          <div
            className={`flex items-start justify-between gap-4 border-b p-5 ${dm ? 'border-gray-800' : 'border-gray-100'}`}
          >
            <div className="flex flex-col gap-2 min-w-0">
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
                {prompt.model && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-medium ${
                      dm ? 'border-gray-700 bg-gray-800 text-gray-400' : 'border-gray-200 bg-gray-50 text-gray-500'
                    }`}
                  >
                    <Bot size={9} />
                    {MODEL_LABELS[prompt.model] || prompt.model}
                  </span>
                )}
              </div>
              <h2 className={`text-lg font-bold leading-snug ${dm ? 'text-gray-100' : 'text-gray-900'}`}>
                {prompt.title}
              </h2>
              <p className={`text-sm leading-relaxed ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                {prompt.description}
              </p>
            </div>
            <button
              onClick={() => handleOpenChange(false)}
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors ${
                dm
                  ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              <X size={18} />
            </button>
          </div>

          {/* Stats Bar */}
          <div
            className={`flex items-center gap-4 border-b px-5 py-3 text-xs font-medium ${dm ? 'border-gray-800 text-gray-500' : 'border-gray-100 text-gray-400'}`}
          >
            <span className="flex items-center gap-1.5">
              <Eye size={12} /> {formatCount(prompt.views)} 次浏览
            </span>
            <span className="flex items-center gap-1.5">
              <Copy size={12} /> {formatCount(prompt.copies)} 次复制
            </span>
            <span className="flex items-center gap-1.5">
              <Heart size={12} /> {formatCount(prompt.likes + (isLiked ? 1 : 0))} 点赞
            </span>
            <span className="flex items-center gap-1.5 ml-auto">
              <Calendar size={12} /> {prompt.date}
            </span>
          </div>

          {/* Tab Bar */}
          <div className={`flex border-b ${dm ? 'border-gray-800' : 'border-gray-100'}`}>
            {[
              { id: 'content', label: 'Prompt 内容' },
              ...(hasVars ? [{ id: 'playground', label: '🎮 变量 Playground' }] : []),
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id as 'content' | 'playground')}
                className={`relative px-5 py-3 text-sm font-medium transition-colors ${
                  tab === id
                    ? dm
                      ? 'text-indigo-400'
                      : 'text-indigo-600'
                    : dm
                      ? 'text-gray-500 hover:text-gray-300'
                      : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                {label}
                {tab === id && (
                  <motion.div
                    layoutId="tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-indigo-500"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              {tab === 'content' && (
                <motion.div
                  key="content"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-5 p-5"
                >
                  {/* Prompt Content Block */}
                  <div
                    className={`relative overflow-hidden rounded-xl border ${dm ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-gray-50'}`}
                  >
                    <div
                      className={`flex items-center justify-between border-b px-4 py-2.5 ${dm ? 'border-gray-700' : 'border-gray-200'}`}
                    >
                      <span
                        className={`text-[11px] font-semibold uppercase tracking-widest ${dm ? 'text-gray-500' : 'text-gray-400'}`}
                      >
                        完整内容
                      </span>
                      <button
                        onClick={() => handleCopy(prompt.content)}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
                          copied
                            ? 'bg-green-500 text-white'
                            : dm
                              ? 'bg-gray-700 text-gray-300 hover:bg-indigo-600 hover:text-white'
                              : 'bg-white text-gray-600 shadow-sm hover:bg-indigo-600 hover:text-white'
                        }`}
                      >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        {copied ? '已复制！' : '复制 Prompt'}
                      </button>
                    </div>
                    <pre
                      className={`whitespace-pre-wrap wrap-break-word p-4 font-mono text-[12px] leading-relaxed ${dm ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      {prompt.content.split(/(\[[^\]]{1,40}\])/g).map((part, i) => {
                        if (/^\[[^\]]+\]$/.test(part)) {
                          return (
                            <mark
                              key={i}
                              className={`rounded px-0.5 font-semibold not-italic ${
                                dm ? 'bg-indigo-500/25 text-indigo-300' : 'bg-indigo-100 text-indigo-700'
                              }`}
                              style={{ background: undefined }}
                            >
                              {part}
                            </mark>
                          );
                        }
                        return <span key={i}>{part}</span>;
                      })}
                    </pre>
                    {hasVars && (
                      <div
                        className={`border-t px-4 py-2.5 ${dm ? 'border-gray-700 bg-gray-800/40' : 'border-gray-200 bg-indigo-50/50'}`}
                      >
                        <p className={`text-[11px] ${dm ? 'text-indigo-400' : 'text-indigo-600'}`}>
                          💡 此 Prompt 包含 {variables.length} 个变量，点击「变量 Playground」标签自定义
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="flex flex-col gap-2">
                    <span
                      className={`text-[11px] font-semibold uppercase tracking-widest ${dm ? 'text-gray-500' : 'text-gray-400'}`}
                    >
                      相关标签
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {prompt.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-medium ${
                            dm ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          <Tag size={10} />#{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Author */}
                  <div
                    className={`flex items-center gap-3 rounded-xl border p-3.5 ${dm ? 'border-gray-800 bg-gray-800/40' : 'border-gray-100 bg-gray-50'}`}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ background: `linear-gradient(135deg, ${catConfig.color}, ${catConfig.color}99)` }}
                    >
                      {prompt.author[0].toUpperCase()}
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${dm ? 'text-gray-200' : 'text-gray-800'}`}>
                        {prompt.author}
                      </p>
                      <p className={`text-[11px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Prompt 创作者</p>
                    </div>
                  </div>

                  {/* Related Prompts */}
                  {relatedPrompts.length > 0 && (
                    <div className="flex flex-col gap-2.5">
                      <span
                        className={`text-[11px] font-semibold uppercase tracking-widest ${dm ? 'text-gray-500' : 'text-gray-400'}`}
                      >
                        同类推荐
                      </span>
                      <div className="flex flex-col gap-2">
                        {relatedPrompts.map((related) => (
                          <div
                            key={related.id}
                            className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${
                              dm
                                ? 'border-gray-800 hover:border-gray-700 hover:bg-gray-800/40'
                                : 'border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className={`truncate text-sm font-medium ${dm ? 'text-gray-300' : 'text-gray-700'}`}>
                                {related.title}
                              </p>
                              <p className={`truncate text-[11px] mt-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                                {related.description}
                              </p>
                            </div>
                            <ChevronRight size={14} className={`shrink-0 ${dm ? 'text-gray-600' : 'text-gray-300'}`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {tab === 'playground' && hasVars && (
                <motion.div
                  key="playground"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-5 p-5"
                >
                  {/* Variable Inputs */}
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${dm ? 'text-gray-300' : 'text-gray-700'}`}>
                        填写变量值{' '}
                        <span className={`text-[11px] font-normal ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                          ({variables.length} 个)
                        </span>
                      </span>
                      <button
                        onClick={() => setVarValues({})}
                        className={`flex items-center gap-1 text-[11px] font-medium transition-colors ${dm ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-700'}`}
                      >
                        <RefreshCw size={11} /> 重置
                      </button>
                    </div>
                    <div className="flex flex-col gap-3">
                      {variables.map((variable) => (
                        <div key={variable}>
                          <label
                            className={`mb-1.5 block text-xs font-medium ${dm ? 'text-gray-400' : 'text-gray-600'}`}
                          >
                            [{variable}]
                          </label>
                          <input
                            type="text"
                            value={varValues[variable] || ''}
                            onChange={(e) => setVarValues((prev) => ({ ...prev, [variable]: e.target.value }))}
                            placeholder={`输入 ${variable} 的值...`}
                            className={inputCls}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Preview */}
                  <div
                    className={`flex flex-col gap-2 rounded-xl border ${dm ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-gray-50'}`}
                  >
                    <div
                      className={`flex items-center justify-between border-b px-4 py-2.5 ${dm ? 'border-gray-700' : 'border-gray-200'}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Play size={11} className="text-indigo-500" />
                        <span
                          className={`text-[11px] font-semibold uppercase tracking-widest ${dm ? 'text-gray-400' : 'text-gray-500'}`}
                        >
                          预览效果
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopy(preview)}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
                          copied
                            ? 'bg-green-500 text-white'
                            : dm
                              ? 'bg-gray-700 text-gray-300 hover:bg-indigo-600 hover:text-white'
                              : 'bg-white text-gray-600 shadow-sm hover:bg-indigo-600 hover:text-white'
                        }`}
                      >
                        {copied ? <Check size={11} /> : <Copy size={11} />}
                        复制填充后内容
                      </button>
                    </div>
                    <pre
                      className={`whitespace-pre-wrap wrap-break-word p-4 font-mono text-[12px] leading-relaxed ${dm ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      {preview.split(/(\[[^\]]{1,40}\])/g).map((part, i) => {
                        if (/^\[[^\]]+\]$/.test(part)) {
                          return (
                            <span
                              key={i}
                              className={`rounded px-0.5 ${dm ? 'bg-yellow-500/20 text-yellow-300' : 'bg-yellow-100 text-yellow-700'}`}
                            >
                              {part}
                            </span>
                          );
                        }
                        return <span key={i}>{part}</span>;
                      })}
                    </pre>
                  </div>

                  <p className={`text-[11px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                    💡 <span className={`${dm ? 'text-yellow-400' : 'text-yellow-600'}`}>黄色高亮</span>
                    表示尚未填写的变量，填完后复制即可使用
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Action Bar */}
          <div
            className={`border-t px-5 py-4 ${dm ? 'border-gray-800 bg-gray-900/80' : 'border-gray-100 bg-white/80'} backdrop-blur-sm`}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  interactions.toggleLike(prompt.id);
                  toast.success(isLiked ? '已取消点赞' : '已点赞 ❤️');
                }}
                className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all ${
                  isLiked
                    ? dm
                      ? 'border-red-500/30 bg-red-500/10 text-red-400'
                      : 'border-red-200 bg-red-50 text-red-500'
                    : dm
                      ? 'border-gray-700 bg-gray-800 text-gray-400 hover:border-red-500/30 hover:text-red-400'
                      : 'border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-500'
                }`}
              >
                <Heart size={15} className={isLiked ? 'fill-current' : ''} />
                {isLiked ? '已点赞' : '点赞'}
              </button>
              <button
                onClick={() => {
                  interactions.toggleSave(prompt.id);
                  toast.success(isSaved ? '已移出收藏' : '已收藏 ⭐');
                }}
                className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all ${
                  isSaved
                    ? dm
                      ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
                      : 'border-yellow-200 bg-yellow-50 text-yellow-600'
                    : dm
                      ? 'border-gray-700 bg-gray-800 text-gray-400 hover:border-yellow-500/30 hover:text-yellow-400'
                      : 'border-gray-200 text-gray-500 hover:border-yellow-200 hover:text-yellow-600'
                }`}
              >
                {isSaved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                {isSaved ? '已收藏' : '收藏'}
              </button>
              <button
                onClick={handleShare}
                className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all ${
                  dm
                    ? 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <Share2 size={15} />
                分享
              </button>
              <button
                onClick={() => handleCopy(tab === 'playground' ? preview : prompt.content)}
                className="ml-auto flex flex-1 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-violet-500 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:shadow-lg hover:shadow-indigo-500/30"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? '复制成功！' : tab === 'playground' ? '复制填充内容' : '一键复制'}
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
