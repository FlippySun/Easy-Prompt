import { useState, useCallback } from 'react';
import { Shuffle, ArrowLeftRight, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MOCK_PROMPTS, type Prompt } from '../data/prompts';
import { PromptDetailDrawer } from './PromptDetailDrawer';
import { CompareModal } from './CompareModal';
import { usePromptStore } from '../hooks/usePromptStore';
import { MagneticButton } from './MagneticButton';
import { toast } from 'sonner';

interface FloatingActionsProps {
  darkMode: boolean;
}

export function FloatingActions({ darkMode }: FloatingActionsProps) {
  const dm = darkMode;
  const store = usePromptStore();
  const [expanded, setExpanded] = useState(false);
  const [randomPrompt, setRandomPrompt] = useState<Prompt | null>(null);
  const [randomOpen, setRandomOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const handleRandom = useCallback(() => {
    const random = MOCK_PROMPTS[Math.floor(Math.random() * MOCK_PROMPTS.length)];
    setRandomPrompt(random);
    setRandomOpen(true);
    setExpanded(false);
  }, []);

  const handleCompare = () => {
    if (store.compare.length < 2) {
      toast.info(`还需要选择 ${2 - store.compare.length} 个 Prompt`, {
        description: '在卡片上点击「对比」按钮添加到对比栏'
      });
      return;
    }
    store.unlockAchievement('compare_used');
    setCompareOpen(true);
    setExpanded(false);
  };

  const hasCompareItems = store.compare.length > 0;

  return (
    <>
      {/* Floating Button Group */}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-2">
        <AnimatePresence>
          {expanded && (
            <>
              {/* Random Explore */}
              <motion.button
                key="random"
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                transition={{ delay: 0.05 }}
                onClick={handleRandom}
                className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium shadow-lg transition-all hover:scale-105 ${
                  dm
                    ? 'border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Shuffle size={15} className="text-indigo-500" />
                随机探索
              </motion.button>

              {/* Compare */}
              <motion.button
                key="compare"
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                transition={{ delay: 0 }}
                onClick={handleCompare}
                className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium shadow-lg transition-all hover:scale-105 ${
                  store.compare.length === 2
                    ? dm ? 'border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20' : 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100'
                    : dm ? 'border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ArrowLeftRight size={15} className={store.compare.length === 2 ? 'text-violet-500' : 'text-gray-400'} />
                对比 Prompt
                {store.compare.length > 0 && (
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                    store.compare.length === 2 ? 'bg-violet-500 text-white' : dm ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {store.compare.length}
                  </span>
                )}
              </motion.button>
            </>
          )}
        </AnimatePresence>

        {/* Main FAB — wrapped with magnetic attraction (Awwwards style) */}
        <MagneticButton strength={28}>
          <motion.button
            onClick={() => setExpanded(!expanded)}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.93 }}
            className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-xl shadow-indigo-500/30 transition-all"
          >
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              {expanded ? <X size={22} className="text-white" /> : <Sparkles size={22} className="text-white" />}
            </motion.div>

            {/* Compare badge on FAB */}
            {!expanded && hasCompareItems && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-violet-400 text-[10px] font-black text-white ring-2 ring-white dark:ring-gray-950"
              >
                {store.compare.length}
              </motion.span>
            )}
          </motion.button>
        </MagneticButton>
      </div>

      {/* Compare Bar (when items in compare list) */}
      <AnimatePresence>
        {hasCompareItems && !expanded && (
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={`fixed bottom-24 right-6 z-30 flex flex-col gap-2 rounded-2xl border p-3 shadow-xl ${
              dm ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'
            }`}
          >
            <p className={`px-1 text-[10px] font-semibold uppercase tracking-widest ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
              对比栏 {store.compare.length}/2
            </p>
            {store.compare.map((id, i) => {
              const p = MOCK_PROMPTS.find(p => p.id === id);
              if (!p) return null;
              return (
                <div key={id} className={`flex items-center gap-2 rounded-xl border p-2 ${dm ? 'border-gray-800 bg-gray-800/60' : 'border-gray-100 bg-gray-50'}`}>
                  <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md text-[9px] font-black text-white ${i === 0 ? 'bg-indigo-500' : 'bg-pink-500'}`}>
                    {i === 0 ? 'A' : 'B'}
                  </span>
                  <span className={`flex-1 truncate text-[11px] font-medium ${dm ? 'text-gray-300' : 'text-gray-700'}`} style={{ maxWidth: 140 }}>
                    {p.title}
                  </span>
                  <button
                    onClick={() => store.toggleCompare(id)}
                    className={`flex-shrink-0 transition-colors ${dm ? 'text-gray-600 hover:text-gray-400' : 'text-gray-300 hover:text-gray-600'}`}
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
            {store.compare.length === 2 && (
              <button
                onClick={handleCompare}
                className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 py-2 text-xs font-semibold text-white"
              >
                <ArrowLeftRight size={12} />
                开始对比
              </button>
            )}
            {store.compare.length < 2 && (
              <p className={`text-center text-[10px] ${dm ? 'text-gray-600' : 'text-gray-400'}`}>
                再选 {2 - store.compare.length} 个完成对比
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Random Prompt Drawer (controlled mode) */}
      {randomPrompt && (
        <PromptDetailDrawer
          prompt={randomPrompt}
          darkMode={dm}
          externalOpen={randomOpen}
          onExternalOpenChange={(o) => {
            setRandomOpen(o);
            if (!o) setRandomPrompt(null);
          }}
        />
      )}

      {/* Compare Modal */}
      {compareOpen && (
        <CompareModal
          compareIds={store.compare}
          darkMode={dm}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </>
  );
}