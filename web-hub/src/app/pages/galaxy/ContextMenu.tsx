/**
 * ContextMenu — 右键上下文菜单
 * Sci-Fi 风格浮动菜单，提供星星快捷操作
 */

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Heart, Share2 } from 'lucide-react';
import type { PromptStarData } from './types';

interface ContextMenuProps {
  star: PromptStarData | null;
  x: number;
  y: number;
  visible: boolean;
  onClose: () => void;
  onCopy: (star: PromptStarData) => void;
  onFavorite: (star: PromptStarData) => void;
  onShare: (star: PromptStarData) => void;
}

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  action: () => void;
}

export function ContextMenu({ star, x, y, visible, onClose, onCopy, onFavorite, onShare }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部和 ESC 关闭
  useEffect(() => {
    if (!visible) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    // 延迟绑定避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('keydown', handleKeyDown);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, onClose]);

  if (!star) return null;

  const items: MenuItem[] = [
    {
      icon: <Copy className="h-3.5 w-3.5" />,
      label: '复制 Prompt',
      action: () => {
        onCopy(star);
        onClose();
      },
    },
    {
      icon: <Heart className="h-3.5 w-3.5" />,
      label: '收藏',
      action: () => {
        onFavorite(star);
        onClose();
      },
    },
    {
      icon: <Share2 className="h-3.5 w-3.5" />,
      label: '分享链接',
      action: () => {
        onShare(star);
        onClose();
      },
    },
  ];

  // 确保菜单不超出视口
  const menuStyle: React.CSSProperties = {
    left: Math.min(x, window.innerWidth - 180),
    top: Math.min(y, window.innerHeight - 140),
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.85, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: -4 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          className="fixed z-[60]"
          style={menuStyle}
        >
          {/* 星星名称 */}
          <div className="mb-1 rounded-t-lg border border-white/8 bg-[#0c0c1d]/95 px-3 py-1.5 backdrop-blur-xl">
            <p className="truncate text-xs font-medium text-white/60">{star.prompt.title}</p>
          </div>

          {/* 菜单项 */}
          <div className="min-w-[156px] rounded-b-lg border border-t-0 border-white/8 bg-[#0c0c1d]/95 py-0.5 shadow-2xl shadow-indigo-500/10 backdrop-blur-xl">
            {items.map((item, i) => (
              <button
                key={i}
                onClick={item.action}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-white/70 transition-colors hover:bg-white/8 hover:text-white"
              >
                <span className="text-white/40">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
