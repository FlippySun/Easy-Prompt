/**
 * Galaxy Cosmos — 3D 场景容器
 * React Three Fiber Canvas + 后处理管线（Bloom / Vignette / ChromaticAberration）
 * 使用 GalaxyStars 单 draw-call 渲染所有 Prompt 星，替代旧的 PromptNode 逐个挂载
 */

import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { StarField } from './StarField';
import { AllNebulae } from './CategoryNebula';
import { GalaxyStars } from './GalaxyStars';
import { DustParticles } from './DustParticles';
import { ConstellationLines } from './ConstellationLines';
import { WarpEffect } from './WarpEffect';
import { CameraRig } from './CameraRig';
import { ShootingStars } from './ShootingStars';
import { ClickBurst } from './ClickBurst';
import { GalaxyCore } from './GalaxyCore';
import type { ClickBurstRef } from './ClickBurst';
import type { CategoryCluster, PromptStarData, WarpPhase, HoverInfo, CameraInfo } from './types';
import { COSMOS_CONFIG } from './types';

interface CosmosSceneProps {
  clusters: CategoryCluster[];
  allStars: PromptStarData[];
  warpPhase: WarpPhase;
  starsVisible: boolean;
  matchedIds: Set<string>;
  hasSearch: boolean;
  flyTarget: [number, number, number] | null;
  onFlyComplete: () => void;
  onStarClick: (star: PromptStarData) => void;
  onHover: (info: HoverInfo | null) => void;
  cameraEnabled: boolean;
  burstRef: React.Ref<ClickBurstRef>;
  cameraInfoRef: React.RefObject<CameraInfo | null>;
  onDoubleClick?: (star: PromptStarData) => void;
  onContextMenu?: (star: PromptStarData, x: number, y: number) => void;
}

export function CosmosScene({
  clusters,
  allStars,
  warpPhase,
  starsVisible,
  matchedIds,
  hasSearch,
  flyTarget,
  onFlyComplete,
  onStarClick,
  onHover,
  cameraEnabled,
  burstRef,
  cameraInfoRef,
  onDoubleClick,
  onContextMenu,
}: CosmosSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  return (
    <Canvas
      ref={canvasRef}
      gl={{
        antialias: false,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
      }}
      camera={{
        fov: 60,
        near: 0.1,
        far: 300,
        position: [0, COSMOS_CONFIG.INITIAL_DISTANCE * 0.6, COSMOS_CONFIG.INITIAL_DISTANCE * 0.8],
      }}
      style={{ background: '#030014' }}
      dpr={[1, 1.5]}
    >
      {/* 环境光 */}
      <ambientLight intensity={0.08} />

      {/* 相机控制器 */}
      <CameraRig
        flyTarget={flyTarget}
        onFlyComplete={onFlyComplete}
        enabled={cameraEnabled}
        initialDistance={COSMOS_CONFIG.INITIAL_DISTANCE}
        cameraInfoRef={cameraInfoRef}
      />

      {/* 跃迁特效 */}
      <WarpEffect phase={warpPhase} />

      {/* 背景星场 */}
      <StarField />

      {/* 尘埃粒子 */}
      <DustParticles visible={starsVisible} />

      {/* 银河中心光晕 */}
      <GalaxyCore visible={starsVisible} />

      {/* 分类星云 */}
      <AllNebulae clusters={clusters} visible={starsVisible} />

      {/* 星座连线 */}
      <ConstellationLines clusters={clusters} visible={starsVisible} />

      {/* 流星 */}
      <ShootingStars visible={starsVisible} />

      {/* 点击粒子爆裂 */}
      <ClickBurst ref={burstRef} />

      {/* Prompt 星（单 draw-call） */}
      <GalaxyStars
        stars={allStars}
        visible={starsVisible}
        matchedIds={matchedIds}
        hasSearch={hasSearch}
        onHover={onHover}
        onClick={onStarClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
      />

      {/* 后处理管线 */}
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={COSMOS_CONFIG.BLOOM_INTENSITY}
          luminanceThreshold={COSMOS_CONFIG.BLOOM_THRESHOLD}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.15} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  );
}
