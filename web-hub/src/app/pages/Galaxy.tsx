/**
 * Galaxy Cosmos — 銀河探索模式
 * 全屏 3D 沉浸式 Prompt 星图浏览
 *
 * 架构：
 * - CosmosScene (R3F Canvas + 后处理)
 * - GalaxyHUD (固定 DOM Sci-Fi 风格 HUD)
 * - 悬浮 Tooltip（DOM 层，跟随鼠标）
 * - PromptDetailDrawer (复用已有抽屉组件)
 *
 * 入场动画序列：
 * warp → decelerate → reveal → complete
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import type { Prompt } from '../data/prompts';
import { CATEGORY_CONFIG } from '../data/constants';
import { PromptDetailDrawer } from '../components/PromptDetailDrawer';
import { CosmosScene } from './galaxy/CosmosScene';
import { OceanScene } from './galaxy/OceanScene';
import { PlanetScene } from './galaxy/PlanetScene';
import { UniverseScene } from './galaxy/UniverseScene';
import { MatrixScene } from './galaxy/MatrixScene';
import { GalaxyHUD } from './galaxy/GalaxyHUD';
import { MiniMap } from './galaxy/MiniMap';
import { ContextMenu } from './galaxy/ContextMenu';
import { ModeSelector } from './galaxy/ModeSelector';
import { useSpaceAudio } from './galaxy/useSpaceAudio';
import { buildGalaxyLayout, getAllStars } from './galaxy/layout';
import type { ClickBurstRef } from './galaxy/ClickBurst';
import type {
  CategoryCluster,
  PromptStarData,
  WarpPhase,
  HoverInfo,
  CameraInfo,
  DisplayMode,
} from './galaxy/types';

// ─── Galaxy 主组件 ─────────────────────────────────────────

export function Galaxy() {
  const navigate = useNavigate();

  // 数据
  const clusters = useMemo(() => buildGalaxyLayout(), []);
  const allStars = useMemo(() => getAllStars(clusters), [clusters]);

  // 入场动画状态
  const [warpPhase, setWarpPhase] = useState<WarpPhase>('idle');
  const [starsVisible, setStarsVisible] = useState(false);
  const warpTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // 搜索
  const [searchQuery, setSearchQuery] = useState('');
  const matchedIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase();
    const matched = new Set<string>();
    for (const star of allStars) {
      const p = star.prompt;
      if (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      ) {
        matched.add(p.id);
      }
    }
    return matched;
  }, [searchQuery, allStars]);

  // 飞跃
  const [flyTarget, setFlyTarget] = useState<[number, number, number] | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // 抽屉
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 悬浮 Tooltip
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  // 右键菜单
  const [contextMenu, setContextMenu] = useState<{ star: PromptStarData; x: number; y: number } | null>(null);

  // 音频
  const audio = useSpaceAudio();
  const [audioEnabled, setAudioEnabled] = useState(false);

  // 拖拽速度线
  const [isDragging, setIsDragging] = useState(false);

  // 展示模式
  const [displayMode, setDisplayMode] = useState<DisplayMode>('galaxy');

  // 模式切换回调
  const handleModeChange = useCallback((mode: DisplayMode) => {
    setDisplayMode(mode);
  }, []);

  const focusedCatIndexRef = useRef(-1);

  // Refs
  const cameraInfoRef = useRef<CameraInfo | null>(null);
  const burstRef = useRef<ClickBurstRef>(null);
  const lastHoveredIdRef = useRef<string | null>(null);

  // ─── 入场动画序列 ─────────────────────────
  useEffect(() => {
    setWarpPhase('warp');

    warpTimerRef.current = setTimeout(() => {
      setWarpPhase('decelerate');

      warpTimerRef.current = setTimeout(() => {
        setWarpPhase('reveal');
        setStarsVisible(true);

        warpTimerRef.current = setTimeout(() => {
          setWarpPhase('complete');
        }, 1200);
      }, 1000);
    }, 1500);

    return () => {
      if (warpTimerRef.current) clearTimeout(warpTimerRef.current);
    };
  }, []);

  // ─── 回调 ────────────────────────────────

  const handleExit = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleStarClick = useCallback(
    (star: PromptStarData) => {
      setSelectedPrompt(star.prompt);
      setDrawerOpen(true);
      setHoverInfo(null);
      // 点击粒子爆裂
      burstRef.current?.burst(star.position, star.color);
      audio.playClick();
    },
    [audio],
  );

  const handleHover = useCallback(
    (info: HoverInfo | null) => {
      setHoverInfo(info);
      // 去重播放 hover 音效（仅进入新星时播放）
      const newId = info?.star.prompt.id ?? null;
      if (newId && newId !== lastHoveredIdRef.current) {
        audio.playHover();
      }
      lastHoveredIdRef.current = newId;
    },
    [audio],
  );

  // 双击飞跃到星星
  const handleStarDoubleClick = useCallback((star: PromptStarData) => {
    setFlyTarget(star.position);
  }, []);

  // 右键菜单
  const handleStarContextMenu = useCallback((star: PromptStarData, x: number, y: number) => {
    setContextMenu({ star, x, y });
  }, []);

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleCopyPrompt = useCallback((star: PromptStarData) => {
    navigator.clipboard.writeText(star.prompt.content).catch(() => {});
  }, []);

  const handleFavoritePrompt = useCallback((_star: PromptStarData) => {
    // 收藏功能占位（可接入 usePromptStore）
  }, []);

  const handleSharePrompt = useCallback((star: PromptStarData) => {
    const url = `${window.location.origin}/prompt/${star.prompt.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
  }, []);

  // 音频切换
  const handleAudioToggle = useCallback(() => {
    const nowPlaying = audio.toggleAmbient();
    setAudioEnabled(nowPlaying);
  }, [audio]);

  const handleCategoryClick = useCallback((cluster: CategoryCluster) => {
    setFlyTarget(cluster.center);
    setActiveCategory(cluster.id);
  }, []);

  const handleFlyComplete = useCallback(() => {
    setFlyTarget(null);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // 缩放操作（通过自定义事件传递给 CameraRig）
  const handleZoomIn = useCallback(() => {
    window.dispatchEvent(new CustomEvent('galaxy-zoom', { detail: -5 }));
  }, []);

  const handleZoomOut = useCallback(() => {
    window.dispatchEvent(new CustomEvent('galaxy-zoom', { detail: 5 }));
  }, []);

  const handleZoomReset = useCallback(() => {
    window.dispatchEvent(new CustomEvent('galaxy-zoom-reset'));
  }, []);

  // ─── 渲染计算 ─────────────────────────────
  const cameraEnabled = warpPhase === 'complete' || warpPhase === 'reveal';
  const hasSearch = searchQuery.trim().length > 0;

  // Tab 键循环切换分类
  useEffect(() => {
    if (!cameraEnabled) return;
    const categories = Object.keys(CATEGORY_CONFIG);
    const onKeyDown = (e: KeyboardEvent) => {
      // 不拦截搜索框内的 Tab
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        const nextIndex = e.shiftKey
          ? (focusedCatIndexRef.current - 1 + categories.length) % categories.length
          : (focusedCatIndexRef.current + 1) % categories.length;
        focusedCatIndexRef.current = nextIndex;
        const cluster = clusters.find((c) => c.id === categories[nextIndex]);
        if (cluster) {
          setFlyTarget(cluster.center);
          setActiveCategory(cluster.id);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cameraEnabled, clusters]);

  // 拖拽速度线监听
  useEffect(() => {
    const handler = (e: Event) => setIsDragging((e as CustomEvent<boolean>).detail);
    window.addEventListener('galaxy-drag', handler);
    return () => window.removeEventListener('galaxy-drag', handler);
  }, []);

  // ─── 渲染 ─────────────────────────────────

  // Tooltip 分类配色
  const tooltipCategory = hoverInfo?.star.category ?? '';
  const tooltipCatConfig = CATEGORY_CONFIG[tooltipCategory];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#030014]">
      {/* 渐入遮罩 */}
      <AnimatePresence>
        {warpPhase === 'idle' && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-50 bg-black"
          />
        )}
      </AnimatePresence>

      {/* 3D 场景 — 根据 displayMode 切换 */}
      <div className="absolute inset-0">
        {displayMode === 'galaxy' && (
          <CosmosScene
            clusters={clusters}
            allStars={allStars}
            warpPhase={warpPhase}
            starsVisible={starsVisible}
            matchedIds={matchedIds}
            hasSearch={hasSearch}
            flyTarget={flyTarget}
            onFlyComplete={handleFlyComplete}
            onStarClick={handleStarClick}
            onHover={handleHover}
            cameraEnabled={cameraEnabled}
            burstRef={burstRef}
            cameraInfoRef={cameraInfoRef}
            onDoubleClick={handleStarDoubleClick}
            onContextMenu={handleStarContextMenu}
          />
        )}
        {displayMode === 'ocean' && (
          <OceanScene
            clusters={clusters}
            allStars={allStars}
            visible={starsVisible}
            matchedIds={matchedIds}
            hasSearch={hasSearch}
            onStarClick={handleStarClick}
            onHover={handleHover}
            onDoubleClick={handleStarDoubleClick}
            onContextMenu={handleStarContextMenu}
          />
        )}
        {displayMode === 'planet' && (
          <PlanetScene
            clusters={clusters}
            allStars={allStars}
            visible={starsVisible}
            matchedIds={matchedIds}
            hasSearch={hasSearch}
            onStarClick={handleStarClick}
            onHover={handleHover}
            onDoubleClick={handleStarDoubleClick}
            onContextMenu={handleStarContextMenu}
          />
        )}
        {displayMode === 'universe' && (
          <UniverseScene
            clusters={clusters}
            allStars={allStars}
            visible={starsVisible}
            matchedIds={matchedIds}
            hasSearch={hasSearch}
            onStarClick={handleStarClick}
            onHover={handleHover}
            onDoubleClick={handleStarDoubleClick}
            onContextMenu={handleStarContextMenu}
          />
        )}
        {displayMode === 'matrix' && (
          <MatrixScene
            clusters={clusters}
            allStars={allStars}
            visible={starsVisible}
            matchedIds={matchedIds}
            hasSearch={hasSearch}
            onStarClick={handleStarClick}
            onHover={handleHover}
            onDoubleClick={handleStarDoubleClick}
            onContextMenu={handleStarContextMenu}
          />
        )}
      </div>

      {/* 拖拽速度线叠加（仅银河模式） */}
      {displayMode === 'galaxy' && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{ opacity: isDragging ? 0.12 : 0 }}
        >
          <div
            className="h-full w-full"
            style={{
              background: `repeating-conic-gradient(from 0deg at 50% 50%, transparent 0deg 5deg, rgba(129, 140, 248, 0.06) 5deg 5.4deg)`,
              maskImage: 'radial-gradient(circle at center, transparent 20%, black 50%, transparent 85%)',
              WebkitMaskImage: 'radial-gradient(circle at center, transparent 20%, black 50%, transparent 85%)',
            }}
          />
        </div>
      )}

      {/* HUD 叠加层 */}
      <GalaxyHUD
        clusters={clusters}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onCategoryClick={handleCategoryClick}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onExit={handleExit}
        warpPhase={warpPhase}
        activeCategory={activeCategory}
        audioEnabled={audioEnabled}
        onAudioToggle={handleAudioToggle}
      />

      {/* 迷你星图（仅银河模式） */}
      {cameraEnabled && displayMode === 'galaxy' && (
        <div className="absolute bottom-20 left-5 z-10">
          <MiniMap clusters={clusters} cameraRef={cameraInfoRef} />
        </div>
      )}

      {/* 展示模式切换器 */}
      <ModeSelector
        displayMode={displayMode}
        onModeChange={handleModeChange}
        visible={cameraEnabled}
      />

      {/* 右键上下文菜单 */}
      <ContextMenu
        star={contextMenu?.star ?? null}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        visible={contextMenu !== null}
        onClose={handleContextMenuClose}
        onCopy={handleCopyPrompt}
        onFavorite={handleFavoritePrompt}
        onShare={handleSharePrompt}
      />

      {/* 悬浮 Tooltip（DOM 层跟随鼠标） */}
      <AnimatePresence>
        {hoverInfo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 4 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none fixed z-60"
            style={{
              left: hoverInfo.screenX + 14,
              top: hoverInfo.screenY - 10,
            }}
          >
            <div className="rounded-lg border border-white/10 bg-[#0c0c1d]/90 px-3 py-2 shadow-xl backdrop-blur-xl">
              {/* 分类标签 */}
              {tooltipCatConfig && (
                <div className="mb-1 flex items-center gap-1.5">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: tooltipCatConfig.color }}
                  />
                  <span className="text-[10px] tracking-wide" style={{ color: tooltipCatConfig.color }}>
                    {tooltipCatConfig.label}
                  </span>
                </div>
              )}
              {/* 标题 */}
              <p className="max-w-48 text-xs font-medium text-white/90">{hoverInfo.star.prompt.title}</p>
              {/* 描述 */}
              <p className="mt-0.5 line-clamp-2 max-w-48 text-[10px] text-white/40">
                {hoverInfo.star.prompt.description}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prompt 详情抽屉 */}
      {selectedPrompt && (
        <PromptDetailDrawer
          prompt={selectedPrompt}
          darkMode={true}
          externalOpen={drawerOpen}
          onExternalOpenChange={(o: boolean) => {
            setDrawerOpen(o);
            if (!o) setSelectedPrompt(null);
          }}
        />
      )}
    </div>
  );
}
