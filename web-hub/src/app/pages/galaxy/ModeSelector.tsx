/**
 * Galaxy Cosmos — 展示模式切换器（重设计）
 * 底部中央浮动玻璃态水平按钮组，5 种模式切换
 */

import { useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Waves, Globe2, Network, LayoutGrid } from 'lucide-react';
import type { DisplayMode } from './types';

interface ModeSelectorProps {
  displayMode: DisplayMode;
  onModeChange: (mode: DisplayMode) => void;
  visible: boolean;
}

/** 模式配置 */
const MODE_CONFIG: { id: DisplayMode; icon: typeof Sparkles; label: string; color: string; desc: string }[] = [
  { id: 'galaxy', icon: Sparkles, label: '银河', color: '#818cf8', desc: '螺旋星系' },
  { id: 'ocean', icon: Waves, label: '深海', color: '#22d3ee', desc: '生物发光' },
  { id: 'planet', icon: Globe2, label: '星球', color: '#4ade80', desc: '微型世界' },
  { id: 'universe', icon: Network, label: '宇宙', color: '#BCBFB0', desc: '数据网络' },
  { id: 'matrix', icon: LayoutGrid, label: '矩阵', color: '#a78bfa', desc: '信息流' },
];

export function ModeSelector({ displayMode, onModeChange, visible }: ModeSelectorProps) {
  const handleModeClick = useCallback(
    (mode: DisplayMode) => {
      onModeChange(mode);
    },
    [onModeChange],
  );

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2"
        >
          <div className="flex items-center gap-1 rounded-2xl border border-white/[0.06] bg-black/40 p-1.5 shadow-2xl backdrop-blur-2xl">
            {MODE_CONFIG.map((config) => {
              const Icon = config.icon;
              const isActive = displayMode === config.id;

              return (
                <motion.button
                  key={config.id}
                  onClick={() => handleModeClick(config.id)}
                  className="relative flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors duration-200"
                  style={{
                    color: isActive ? config.color : 'rgba(255,255,255,0.4)',
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {/* 激活态背景 */}
                  {isActive && (
                    <motion.div
                      layoutId="mode-active-bg"
                      className="absolute inset-0 rounded-xl"
                      style={{
                        background: `${config.color}15`,
                        border: `1px solid ${config.color}30`,
                      }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}

                  <Icon size={14} className="relative z-10 shrink-0" />
                  <span className="relative z-10 hidden sm:inline">{config.label}</span>

                  {/* 底部指示点 */}
                  {isActive && (
                    <motion.div
                      layoutId="mode-dot"
                      className="absolute -bottom-0.5 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full"
                      style={{ background: config.color }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
