/**
 * Galaxy Cosmos — 星座连线
 * 使用单一 LineSegments + BufferGeometry 渲染所有连线
 * 替代旧版 N 个独立 <Line> 组件 → 1 个 draw call
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CategoryCluster } from './types';

interface ConstellationLinesProps {
  clusters: CategoryCluster[];
  visible: boolean;
}

export function ConstellationLines({ clusters, visible }: ConstellationLinesProps) {
  const meshRef = useRef<THREE.LineSegments>(null);
  const opacityRef = useRef(0);

  const { geometry, material } = useMemo(() => {
    // 预计算所有边
    const edges: { a: [number, number, number]; b: [number, number, number]; color: string }[] = [];

    for (const cluster of clusters) {
      if (cluster.stars.length < 2) continue;
      const stars = cluster.stars;
      const maxConns = Math.min(Math.floor(stars.length * 1.2), 30);
      const edgeSet = new Set<string>();
      let edgeCount = 0;

      for (let i = 0; i < stars.length && edgeCount < maxConns; i++) {
        const dists: { j: number; d: number }[] = [];
        for (let j = 0; j < stars.length; j++) {
          if (i === j) continue;
          const dx = stars[i].position[0] - stars[j].position[0];
          const dy = stars[i].position[1] - stars[j].position[1];
          const dz = stars[i].position[2] - stars[j].position[2];
          dists.push({ j, d: dx * dx + dy * dy + dz * dz });
        }
        dists.sort((a, b) => a.d - b.d);

        for (let k = 0; k < Math.min(2, dists.length); k++) {
          const j = dists[k].j;
          const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
          if (edgeSet.has(key) || dists[k].d > 36) continue;
          edgeSet.add(key);
          edgeCount++;
          edges.push({
            a: stars[i].position,
            b: stars[j].position,
            color: cluster.darkColor,
          });
        }
      }
    }

    // 构建 BufferGeometry（每条边 = 2 个顶点）
    const vertexCount = edges.length * 2;
    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const color = new THREE.Color();

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const vi = i * 6; // 2 vertices × 3 components
      positions[vi] = edge.a[0];
      positions[vi + 1] = edge.a[1];
      positions[vi + 2] = edge.a[2];
      positions[vi + 3] = edge.b[0];
      positions[vi + 4] = edge.b[1];
      positions[vi + 5] = edge.b[2];

      color.set(edge.color);
      colors[vi] = color.r;
      colors[vi + 1] = color.g;
      colors[vi + 2] = color.b;
      colors[vi + 3] = color.r;
      colors[vi + 4] = color.g;
      colors[vi + 5] = color.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    return { geometry: geo, material: mat };
  }, [clusters]);

  useFrame(() => {
    if (!material) return;
    const target = visible ? 0.12 : 0;
    opacityRef.current += (target - opacityRef.current) * 0.05;
    material.opacity = opacityRef.current;
  });

  if (!visible && opacityRef.current < 0.001) return null;

  return <lineSegments ref={meshRef} geometry={geometry} material={material} />;
}
