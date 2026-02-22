/**
 * ClickBurst — 点击粒子爆裂特效
 * 点击星星时从该位置喷射一簇粒子，球形扩散后消失
 * 通过 forwardRef + useImperativeHandle 暴露 burst() 方法
 */

import { useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface ClickBurstRef {
  burst: (position: [number, number, number], color: string) => void;
}

const PARTICLES_PER_BURST = 40;
const MAX_BURSTS = 3;
const TOTAL_PARTICLES = PARTICLES_PER_BURST * MAX_BURSTS;
const LIFETIME = 1.2;

interface BurstData {
  active: boolean;
  age: number;
  origin: THREE.Vector3;
  color: THREE.Color;
  velocities: THREE.Vector3[];
}

const VERTEX = /* glsl */ `
  attribute float aAlpha;
  attribute vec3 aColor;

  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(aAlpha * 4.0, 0.5) * (200.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 8.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float glow = exp(-d * d * 3.0);
    gl_FragColor = vec4(vColor, glow * vAlpha);
  }
`;

export const ClickBurst = forwardRef<ClickBurstRef>(function ClickBurst(_props, ref) {
  const pointsRef = useRef<THREE.Points>(null);

  const bursts = useRef<BurstData[]>(
    Array.from({ length: MAX_BURSTS }, () => ({
      active: false,
      age: 0,
      origin: new THREE.Vector3(),
      color: new THREE.Color(),
      velocities: Array.from({ length: PARTICLES_PER_BURST }, () => new THREE.Vector3()),
    })),
  );

  const { positions, alphas, colors } = useMemo(
    () => ({
      positions: new Float32Array(TOTAL_PARTICLES * 3),
      alphas: new Float32Array(TOTAL_PARTICLES),
      colors: new Float32Array(TOTAL_PARTICLES * 3),
    }),
    [],
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useImperativeHandle(ref, () => ({
    burst: (position, color) => {
      // Find an inactive burst slot, or recycle the oldest
      let target = bursts.current.find((b) => !b.active);
      if (!target) {
        target = bursts.current.reduce((a, b) => (a.age > b.age ? a : b));
      }

      target.active = true;
      target.age = 0;
      target.origin.set(...position);
      target.color.set(color);

      // Random spherical velocities
      for (let i = 0; i < PARTICLES_PER_BURST; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = 2 + Math.random() * 6;
        target.velocities[i].set(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.sin(phi) * Math.sin(theta) * speed,
          Math.cos(phi) * speed,
        );
      }
    },
  }));

  useFrame((_, delta) => {
    if (!pointsRef.current) return;

    for (let b = 0; b < MAX_BURSTS; b++) {
      const burst = bursts.current[b];
      const baseIdx = b * PARTICLES_PER_BURST;

      if (burst.active) {
        burst.age += delta;
        if (burst.age > LIFETIME) burst.active = false;
      }

      for (let i = 0; i < PARTICLES_PER_BURST; i++) {
        const idx = baseIdx + i;
        const v = idx * 3;

        if (burst.active) {
          const t = burst.age;
          const lifeFade = Math.max(0, 1 - t / LIFETIME);
          const decel = Math.max(0.2, 1 - t * 0.6);

          positions[v] = burst.origin.x + burst.velocities[i].x * t * decel;
          positions[v + 1] = burst.origin.y + burst.velocities[i].y * t * decel;
          positions[v + 2] = burst.origin.z + burst.velocities[i].z * t * decel;

          alphas[idx] = lifeFade * lifeFade;

          colors[v] = burst.color.r;
          colors[v + 1] = burst.color.g;
          colors[v + 2] = burst.color.b;
        } else {
          alphas[idx] = 0;
        }
      }
    }

    const geo = pointsRef.current.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} frustumCulled={false} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={TOTAL_PARTICLES} itemSize={3} />
        <bufferAttribute attach="attributes-aAlpha" array={alphas} count={TOTAL_PARTICLES} itemSize={1} />
        <bufferAttribute attach="attributes-aColor" array={colors} count={TOTAL_PARTICLES} itemSize={3} />
      </bufferGeometry>
    </points>
  );
});
