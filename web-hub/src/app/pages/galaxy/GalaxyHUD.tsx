/**
 * Galaxy Cosmos — Sci-Fi HUD 控制界面
 *
 * 重新设计：
 * - 左上角：极简退出按钮 + 标题
 * - 顶部中央：全屏搜索（Raycast/Spotlight 风格）
 * - 底部居中：水平分类筛选条
 * - 右下角：缩放控制
 * - 扫描线入场动画
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Search, X, ZoomIn, ZoomOut, RotateCcw, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { CATEGORY_CONFIG } from '../../data/constants';
import type { CategoryCluster, WarpPhase } from './types';

interface GalaxyHUDProps {
  clusters: CategoryCluster[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCategoryClick: (cluster: CategoryCluster) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onExit: () => void;
  warpPhase: WarpPhase;
  activeCategory: string | null;
  audioEnabled: boolean;
  onAudioToggle: () => void;
}

export function GalaxyHUD({
  clusters,
  searchQuery,
  onSearchChange,
  onCategoryClick,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onExit,
  warpPhase,
  activeCategory,
  audioEnabled,
  onAudioToggle,
}: GalaxyHUDProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const hudVisible = warpPhase === 'complete' || warpPhase === 'reveal';

  // ⌘K 打开搜索
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') {
        if (searchOpen) {
          setSearchOpen(false);
          onSearchChange('');
        } else {
          onExit();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchOpen, onExit, onSearchChange]);

  const handleSearchToggle = useCallback(() => {
    setSearchOpen((prev) => {
      if (!prev) setTimeout(() => searchInputRef.current?.focus(), 100);
      else onSearchChange('');
      return !prev;
    });
  }, [onSearchChange]);

  const categories = Object.keys(CATEGORY_CONFIG);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <AnimatePresence>
        {hudVisible && (
          <>
            {/* ─── 左上角：退出 + 标题 ─── */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="pointer-events-auto absolute left-5 top-5 flex items-center gap-3"
            >
              <button
                onClick={onExit}
                className="group flex h-9 w-9 items-center justify-center rounded-lg border border-white/8 bg-white/4 text-white/50 transition-all hover:border-white/20 hover:bg-white/8 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              </button>
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400/60" />
                <span className="text-xs font-medium tracking-widest text-white/30">PROMPT GALAXY</span>
              </div>
            </motion.div>

            {/* ─── 右上角：搜索按钮 ─── */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="pointer-events-auto absolute right-5 top-5"
            >
              <button
                onClick={handleSearchToggle}
                className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/4 px-3 py-2 text-white/50 transition-all hover:border-white/20 hover:bg-white/8 hover:text-white"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="text-xs text-white/30">⌘K</span>
              </button>
            </motion.div>

            {/* ─── 全屏搜索浮层 (Spotlight 风格) ─── */}
            <AnimatePresence>
              {searchOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="pointer-events-auto absolute inset-0 flex items-start justify-center pt-[18vh]"
                  onClick={() => {
                    setSearchOpen(false);
                    onSearchChange('');
                  }}
                >
                  {/* 背景遮罩 */}
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                  {/* 搜索框 */}
                  <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="relative z-10 w-[90vw] max-w-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="rounded-xl border border-white/10 bg-[#0c0c1d]/90 shadow-2xl shadow-indigo-500/5 backdrop-blur-xl">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <Search className="h-4 w-4 shrink-0 text-indigo-400/60" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={searchQuery}
                          onChange={(e) => onSearchChange(e.target.value)}
                          placeholder="搜索 Prompt..."
                          className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none"
                          autoFocus
                        />
                        {searchQuery && (
                          <button onClick={() => onSearchChange('')} className="text-white/30 hover:text-white/60">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/30">
                          ESC
                        </kbd>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── 底部分类筛选条 ─── */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
              className="pointer-events-auto absolute bottom-6 left-1/2 -translate-x-1/2"
            >
              <div className="flex items-center gap-1 rounded-xl border border-white/6 bg-black/40 px-2 py-1.5 backdrop-blur-xl">
                {categories.map((catId) => {
                  const config = CATEGORY_CONFIG[catId];
                  const cluster = clusters.find((c) => c.id === catId);
                  if (!cluster) return null;
                  const isActive = activeCategory === catId;
                  return (
                    <button
                      key={catId}
                      onClick={() => onCategoryClick(cluster)}
                      className="group flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all hover:bg-white/6"
                      style={
                        isActive
                          ? {
                              backgroundColor: `${config.color}15`,
                              boxShadow: `0 0 12px ${config.color}20`,
                            }
                          : undefined
                      }
                    >
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full transition-shadow"
                        style={{
                          backgroundColor: config.color,
                          boxShadow: isActive ? `0 0 8px ${config.color}` : 'none',
                        }}
                      />
                      <span
                        className="hidden whitespace-nowrap transition-colors sm:inline"
                        style={{ color: isActive ? config.color : 'rgba(255,255,255,0.45)' }}
                      >
                        {config.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* ─── 右下角缩放 + 音频控制 ─── */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="pointer-events-auto absolute bottom-6 right-5"
            >
              <div className="flex flex-col gap-1 rounded-lg border border-white/6 bg-black/40 p-1 backdrop-blur-xl">
                <button
                  onClick={onAudioToggle}
                  className="flex h-7 w-7 items-center justify-center rounded text-white/40 transition-colors hover:bg-white/8 hover:text-white/80"
                  title={audioEnabled ? '关闭环境音' : '开启环境音'}
                >
                  {audioEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                </button>
                <div className="mx-auto h-px w-4 bg-white/6" />
                <button
                  onClick={onZoomIn}
                  className="flex h-7 w-7 items-center justify-center rounded text-white/40 transition-colors hover:bg-white/8 hover:text-white/80"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <div className="mx-auto h-px w-4 bg-white/6" />
                <button
                  onClick={onZoomReset}
                  className="flex h-7 w-7 items-center justify-center rounded text-white/40 transition-colors hover:bg-white/8 hover:text-white/80"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
                <div className="mx-auto h-px w-4 bg-white/6" />
                <button
                  onClick={onZoomOut}
                  className="flex h-7 w-7 items-center justify-center rounded text-white/40 transition-colors hover:bg-white/8 hover:text-white/80"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>

            {/* ─── 底部交互提示 ─── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 1.5, duration: 1 }}
              className="absolute bottom-16 left-1/2 -translate-x-1/2"
            >
              <p className="whitespace-nowrap text-[10px] tracking-wider text-white/15">
                拖拽旋转 · 滚轮缩放 · 点击查看 · 双击飞跃 · 右键菜单 · Tab 切换分类 · ⌘K 搜索
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
