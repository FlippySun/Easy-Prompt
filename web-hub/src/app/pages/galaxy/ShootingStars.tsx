/**
 * ShootingStars — 流星划过特效
 * 随机间隔产生明亮流星，带发光拖尾
 * 使用 Points + 自定义 Shader，性能开销极低（60 个顶点）
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const MAX_METEORS = 3;
const TRAIL_POINTS = 20;
const TOTAL_POINTS = MAX_METEORS * TRAIL_POINTS;

interface Meteor {
  active: boolean;
  age: number;
  lifetime: number;
  head: THREE.Vector3;
  velocity: THREE.Vector3;
  trail: THREE.Vector3[];
}

const VERTEX = /* glsl */ `
  attribute float aAlpha;
  attribute float aPointSize;

  varying float vAlpha;

  void main() {
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aPointSize * (300.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 8.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT = /* glsl */ `
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float glow = exp(-d * d * 4.0);
    gl_FragColor = vec4(1.0, 0.92, 0.75, glow * vAlpha);
  }
`;

export function ShootingStars({ visible }: { visible: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const timerRef = useRef(0);
  const nextSpawnRef = useRef(2 + Math.random() * 3);

  const meteors = useRef<Meteor[]>(
    Array.from({ length: MAX_METEORS }, () => ({
      active: false,
      age: 0,
      lifetime: 0.6 + Math.random() * 0.6,
      head: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      trail: Array.from({ length: TRAIL_POINTS }, () => new THREE.Vector3()),
    })),
  );

  const { positions, alphas, pointSizes } = useMemo(
    () => ({
      positions: new Float32Array(TOTAL_POINTS * 3),
      alphas: new Float32Array(TOTAL_POINTS),
      pointSizes: new Float32Array(TOTAL_POINTS),
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

  useFrame((_, delta) => {
    if (!visible || !pointsRef.current) return;

    // Spawn timer
    timerRef.current += delta;
    if (timerRef.current > nextSpawnRef.current) {
      const m = meteors.current.find((m) => !m.active);
      if (m) {
        m.active = true;
        m.age = 0;
        m.lifetime = 0.5 + Math.random() * 0.6;
        const range = 60;
        m.head.set((Math.random() - 0.5) * range, 20 + Math.random() * 30, (Math.random() - 0.5) * range);
        const speed = 50 + Math.random() * 40;
        m.velocity.set(
          (Math.random() - 0.5) * speed * 0.6,
          -speed * (0.4 + Math.random() * 0.3),
          (Math.random() - 0.5) * speed * 0.6,
        );
        for (const p of m.trail) p.copy(m.head);
      }
      timerRef.current = 0;
      nextSpawnRef.current = 3 + Math.random() * 5;
    }

    // Update meteors
    for (let i = 0; i < MAX_METEORS; i++) {
      const m = meteors.current[i];
      const baseIdx = i * TRAIL_POINTS;

      if (m.active) {
        m.age += delta;
        if (m.age > m.lifetime) m.active = false;
        // Shift trail
        for (let t = TRAIL_POINTS - 1; t > 0; t--) {
          m.trail[t].copy(m.trail[t - 1]);
        }
        m.head.addScaledVector(m.velocity, delta);
        m.trail[0].copy(m.head);
      }

      for (let t = 0; t < TRAIL_POINTS; t++) {
        const idx = baseIdx + t;
        const v = idx * 3;

        if (m.active) {
          const trailFade = 1 - t / TRAIL_POINTS;
          const lifeFade = 1 - m.age / m.lifetime;
          positions[v] = m.trail[t].x;
          positions[v + 1] = m.trail[t].y;
          positions[v + 2] = m.trail[t].z;
          alphas[idx] = trailFade * lifeFade;
          pointSizes[idx] = t === 0 ? 3.0 : 2.0 * trailFade;
        } else {
          alphas[idx] = 0;
        }
      }
    }

    const geo = pointsRef.current.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    geo.attributes.aPointSize.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} frustumCulled={false} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={TOTAL_POINTS} itemSize={3} />
        <bufferAttribute attach="attributes-aAlpha" array={alphas} count={TOTAL_POINTS} itemSize={1} />
        <bufferAttribute attach="attributes-aPointSize" array={pointSizes} count={TOTAL_POINTS} itemSize={1} />
      </bufferGeometry>
    </points>
  );
}
