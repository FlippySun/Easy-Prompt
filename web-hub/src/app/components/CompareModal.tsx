import { useState } from 'react';
import { X, Copy, Check, Heart, ArrowLeftRight, Tag, Bot, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
// 2026-04-09 — P5 迁移：不再直接导入 MOCK_PROMPTS，改用 PromptDataContext
import { type Prompt } from '../data/prompts';
import { useAllPrompts } from '../hooks/usePromptData';
import { CATEGORY_CONFIG, MODEL_LABELS, formatCount } from '../data/constants';
import { usePromptStore } from '../hooks/usePromptStore';

interface PromptColumnProps {
  prompt: Prompt;
  darkMode: boolean;
  label: 'A' | 'B';
}

function PromptColumn({ prompt, darkMode: dm, label }: PromptColumnProps) {
  const [copied, setCopied] = useState(false);
  const store = usePromptStore();
  const catConfig = CATEGORY_CONFIG[prompt.category] || CATEGORY_CONFIG.coding;
  const isLiked = store.isLiked(prompt.id);
  const labelColor = label === 'A' ? '#6366f1' : '#ec4899';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      setCopied(true);
      store.recordCopy(prompt.id);
      toast.success('已复制！');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 min-w-0">
      {/* Column Header */}
      <div
        className={`flex flex-col gap-3 rounded-2xl border p-4 ${dm ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}
      >
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black text-white"
            style={{ background: labelColor }}
          >
            {label}
          </span>
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
              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${dm ? 'border-gray-700 bg-gray-800 text-gray-400' : 'border-gray-200 bg-gray-50 text-gray-500'}`}
            >
              <Bot size={9} />
              {MODEL_LABELS[prompt.model] || prompt.model}
            </span>
          )}
        </div>
        <h3 className={`text-sm font-bold leading-snug ${dm ? 'text-gray-100' : 'text-gray-900'}`}>{prompt.title}</h3>
        <p className={`text-xs leading-relaxed ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{prompt.description}</p>

        {/* Stats */}
        <div
          className={`flex items-center gap-3 text-[11px] font-medium border-t pt-3 ${dm ? 'border-gray-800 text-gray-500' : 'border-gray-100 text-gray-400'}`}
        >
          <span className="flex items-center gap-1">
            <Heart size={10} /> {formatCount(prompt.likes + (isLiked ? 1 : 0))}
          </span>
          <span className="flex items-center gap-1">
            <Copy size={10} /> {formatCount(prompt.copies)}
          </span>
          <span className="flex items-center gap-1">
            <Eye size={10} /> {formatCount(prompt.views)}
          </span>
          <span className="ml-auto">{prompt.author}</span>
        </div>
      </div>

      {/* Prompt Content */}
      <div
        className={`relative flex flex-col overflow-hidden rounded-xl border ${dm ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-gray-50'}`}
      >
        <div
          className={`flex items-center justify-between border-b px-3 py-2 ${dm ? 'border-gray-700' : 'border-gray-200'}`}
        >
          <span
            className={`text-[10px] font-semibold uppercase tracking-widest ${dm ? 'text-gray-500' : 'text-gray-400'}`}
          >
            完整内容
          </span>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition-all ${
              copied
                ? 'bg-green-500 text-white'
                : dm
                  ? 'bg-gray-700 text-gray-300 hover:bg-indigo-600 hover:text-white'
                  : 'bg-white text-gray-600 shadow-sm hover:bg-indigo-600 hover:text-white'
            }`}
          >
            {copied ? <Check size={10} /> : <Copy size={10} />}
            {copied ? '已复制' : '复制'}
          </button>
        </div>
        <pre
          className={`max-h-64 overflow-y-auto whitespace-pre-wrap wrap-break-word p-3 font-mono text-[11px] leading-relaxed ${dm ? 'text-gray-300' : 'text-gray-700'}`}
        >
          {prompt.content}
        </pre>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {prompt.tags.map((tag) => (
          <span
            key={tag}
            className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium ${dm ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}
          >
            <Tag size={9} />#{tag}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            store.toggleLike(prompt.id);
            toast.success(isLiked ? '已取消点赞' : '已点赞 ❤️');
          }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition-all ${
            isLiked
              ? dm
                ? 'border-red-500/30 bg-red-500/10 text-red-400'
                : 'border-red-200 bg-red-50 text-red-500'
              : dm
                ? 'border-gray-700 bg-gray-800 text-gray-400 hover:text-red-400'
                : 'border-gray-200 text-gray-500 hover:text-red-500'
          }`}
        >
          <Heart size={12} className={isLiked ? 'fill-current' : ''} />
          {isLiked ? '已点赞' : '点赞'}
        </button>
        <button
          onClick={handleCopy}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-white transition-all"
          style={{ background: `linear-gradient(135deg, ${labelColor}, ${labelColor}cc)` }}
        >
          <Copy size={12} />
          一键复制
        </button>
      </div>
    </div>
  );
}

interface CompareModalProps {
  compareIds: string[];
  darkMode: boolean;
  onClose: () => void;
}

export function CompareModal({ compareIds, darkMode, onClose }: CompareModalProps) {
  const dm = darkMode;
  // 2026-04-09 — P5 迁移：按 ID 查找改用 Context 全局数据
  const allPrompts = useAllPrompts();
  const prompts = compareIds.map((id) => allPrompts.find((p) => p.id === id)).filter(Boolean) as Prompt[];

  if (prompts.length < 2) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-60 flex items-start justify-center overflow-y-auto p-4 sm:p-6"
        style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`w-full max-w-4xl rounded-2xl border shadow-2xl ${dm ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-gray-50'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div
            className={`flex items-center justify-between border-b px-6 py-4 ${dm ? 'border-gray-800' : 'border-gray-200'}`}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-indigo-600">
                <ArrowLeftRight size={15} className="text-white" />
              </div>
              <div>
                <h2 className={`text-base font-bold ${dm ? 'text-gray-100' : 'text-gray-900'}`}>Prompt 对比</h2>
                <p className={`text-[11px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                  并排查看两个 Prompt 的内容与差异
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="关闭"
              className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${dm ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}`}
            >
              <X size={18} />
            </button>
          </div>

          {/* Comparison Content */}
          <div className="flex flex-col gap-6 p-6 sm:flex-row">
            <PromptColumn prompt={prompts[0]} darkMode={dm} label="A" />

            {/* Divider */}
            <div className="relative flex items-center justify-center">
              <div className={`hidden h-full w-px sm:block ${dm ? 'bg-gray-800' : 'bg-gray-200'}`} />
              <div className={`sm:hidden h-px w-full ${dm ? 'bg-gray-800' : 'bg-gray-200'}`} />
              <div
                className={`absolute flex h-8 w-8 items-center justify-center rounded-full border ${dm ? 'border-gray-700 bg-gray-900 text-gray-400' : 'border-gray-200 bg-white text-gray-500'}`}
              >
                <ArrowLeftRight size={13} />
              </div>
            </div>

            <PromptColumn prompt={prompts[1]} darkMode={dm} label="B" />
          </div>

          {/* Footer */}
          <div
            className={`flex items-center justify-between border-t px-6 py-4 ${dm ? 'border-gray-800' : 'border-gray-100'}`}
          >
            <p className={`text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
              💡 点击卡片标题可进入详情，使用 Playground 功能自定义变量
            </p>
            <button
              onClick={onClose}
              className={`rounded-xl border px-4 py-2 text-xs font-medium transition-colors ${dm ? 'border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-gray-200' : 'border-gray-200 text-gray-500 hover:bg-gray-100'}`}
            >
              关闭对比
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
