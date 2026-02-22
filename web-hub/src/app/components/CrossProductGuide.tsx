import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Wand2, X, ArrowRight } from 'lucide-react';
import { unlockAchievementAction } from '../hooks/usePromptStore';

const STORAGE_KEY = 'prompthub_guide_dismissed';

interface CrossProductGuideProps {
  darkMode: boolean;
}

// Staggered reveal variant for child items
const itemVariants = {
  hidden: { opacity: 0, x: -10, filter: 'blur(4px)' },
  visible: { opacity: 1, x: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, x: -6, filter: 'blur(3px)' },
};

export function CrossProductGuide({ darkMode }: CrossProductGuideProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const timer = setTimeout(() => setVisible(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
  };

  const handleClick = () => {
    unlockAchievementAction('eco_explorer');
    dismiss();
  };

  const dm = darkMode;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          exit={{ height: 0 }}
          transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
          className="relative z-40 overflow-hidden"
        >
          <div
            className={`border-b px-4 py-2.5 sm:px-6 ${
              dm
                ? 'border-violet-500/10 bg-linear-to-r from-violet-950/60 via-indigo-950/40 to-violet-950/60'
                : 'border-violet-100 bg-linear-to-r from-violet-50/80 via-indigo-50/60 to-violet-50/80'
            }`}
          >
            <div className="mx-auto flex max-w-350 items-center justify-between gap-3">
              {/* Content with staggered typewriter reveal */}
              <motion.div
                className="flex items-center gap-2.5 min-w-0"
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
                  exit: { transition: { staggerChildren: 0.05, staggerDirection: -1 } },
                }}
              >
                {/* Icon */}
                <motion.div
                  variants={itemVariants}
                  transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                    dm ? 'bg-violet-500/20' : 'bg-violet-100'
                  }`}
                >
                  <Wand2 size={12} className={dm ? 'text-violet-400' : 'text-violet-500'} />
                </motion.div>

                {/* Question text */}
                <motion.span
                  variants={itemVariants}
                  transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                  className={`hidden sm:inline text-xs sm:text-[13px] ${dm ? 'text-gray-300' : 'text-gray-600'}`}
                >
                  有自己的 Prompt 需求？
                </motion.span>

                {/* Link */}
                <motion.a
                  variants={itemVariants}
                  transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                  href="https://prompt.zhiz.chat?from=hub"
                  target="_blank"
                  rel="noopener"
                  onClick={handleClick}
                  className={`group inline-flex items-center gap-1 text-xs sm:text-[13px] font-semibold transition-colors ${
                    dm ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-700'
                  }`}
                >
                  试试 AI 智能 Prompt 增强工具
                  <ArrowRight size={12} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
                </motion.a>
              </motion.div>

              {/* Close button */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.5, duration: 0.3 }}
                onClick={dismiss}
                className={`shrink-0 rounded-md p-1 transition-colors ${
                  dm
                    ? 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
                    : 'text-gray-400 hover:bg-gray-200/70 hover:text-gray-600'
                }`}
                aria-label="关闭引导"
              >
                <X size={14} />
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
