/**
 * Galaxy Cosmos — 分类星云
 * 每个分类沿其旋臂中心位置显示发光星云
 * 使用多层径向渐变纹理 + 呼吸动画
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CategoryCluster } from './types';
import { COSMOS_CONFIG } from './types';

/** 创建径向渐变圆形纹理（中心不透明 → 边缘全透明） */
function createNebulaTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.15, 'rgba(255,255,255,0.7)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.25)');
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.06)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/** 模块级缓存 */
let _nebulaTexture: THREE.CanvasTexture | null = null;
function getNebulaTexture(): THREE.CanvasTexture {
  if (!_nebulaTexture) _nebulaTexture = createNebulaTexture();
  return _nebulaTexture;
}

interface CategoryNebulaProps {
  cluster: CategoryCluster;
  visible: boolean;
}

/** 单个分类星云 */
function CategoryNebula({ cluster, visible }: CategoryNebulaProps) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const materialRef = useRef<THREE.SpriteMaterial>(null);

  const color = useMemo(() => new THREE.Color(cluster.darkColor), [cluster.darkColor]);
  const map = useMemo(() => getNebulaTexture(), []);

  useFrame(({ clock }) => {
    if (!spriteRef.current || !materialRef.current) return;
    const t = clock.getElapsedTime();
    const breathe = 0.9 + 0.1 * Math.sin(t * 0.25 + cluster.center[0] * 0.5);
    const size = COSMOS_CONFIG.NEBULA_SIZE * breathe;
    spriteRef.current.scale.set(size, size, 1);
    const targetOpacity = visible ? 0.1 : 0;
    materialRef.current.opacity += (targetOpacity - materialRef.current.opacity) * 0.04;
  });

  return (
    <sprite ref={spriteRef} position={cluster.center}>
      <spriteMaterial
        ref={materialRef}
        map={map}
        color={color}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </sprite>
  );
}

/** 所有分类星云 */
export function AllNebulae({ clusters, visible }: { clusters: CategoryCluster[]; visible: boolean }) {
  return (
    <>
      {clusters.map((cluster) => (
        <CategoryNebula key={cluster.id} cluster={cluster} visible={visible} />
      ))}
    </>
  );
}
