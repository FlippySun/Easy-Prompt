/**
 * Galaxy Cosmos — 电影级跃迁特效
 * 入场时的超光速星线拉伸 → 色散加剧 → 减速绽放
 *
 * 技术：自定义 ShaderMaterial + 径向拉伸线
 * Phase 1 (warp): 星线从中心高速向外拉伸
 * Phase 2 (decelerate): 减速收缩 + 透明度渐弱
 * Phase 3 (reveal): 快速消散
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WarpPhase } from './types';

// ─── GLSL ──────────────────────────────────────────────────

const WARP_VERTEX = /* glsl */ `
  attribute float aSpeed;
  attribute float aOffset;

  uniform float uTime;
  uniform float uIntensity;
  uniform float uStretch;

  varying float vAlpha;
  varying float vStreak;

  void main() {
    vec3 pos = position;

    // 从远处飞向相机（沿 Z 轴）
    float z = pos.z - uTime * aSpeed * uIntensity * 60.0;
    // 循环：飞过相机后重置到远处
    z = mod(z + 150.0, 200.0) - 50.0;
    pos.z = z;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // 拉伸线效果：越快越长
    float stretch = uStretch * aSpeed;
    gl_PointSize = (2.0 + stretch * 30.0) * (100.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 1.0, 80.0);

    // 距离相机越近越亮
    float zFade = smoothstep(-50.0, 20.0, pos.z);
    vAlpha = zFade * uIntensity;
    vStreak = stretch;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const WARP_FRAGMENT = /* glsl */ `
  varying float vAlpha;
  varying float vStreak;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);

    // 椭圆形拉伸（模拟运动模糊）
    float dist = length(vec2(center.x / max(0.3 + vStreak, 0.3), center.y));
    if (dist > 0.5) discard;

    float glow = 1.0 - smoothstep(0.0, 0.5, dist);
    float core = 1.0 - smoothstep(0.0, 0.1, dist);

    float brightness = core * 0.8 + glow * 0.5;
    brightness *= vAlpha;

    // 蓝白渐变色
    vec3 color = mix(vec3(0.6, 0.7, 1.0), vec3(1.0, 1.0, 1.0), core);

    gl_FragColor = vec4(color * brightness, brightness);
  }
`;

// ─── 组件 ──────────────────────────────────────────────────

const PARTICLE_COUNT = 500;

interface WarpEffectProps {
  phase: WarpPhase;
}

export function WarpEffect({ phase }: WarpEffectProps) {
  const intensityRef = useRef(0);
  const stretchRef = useRef(0);

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const speeds = new Float32Array(PARTICLE_COUNT);
    const offsets = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // 圆柱形分布
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.5 + Math.random() * 18;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = Math.random() * 200 - 100;

      speeds[i] = 0.5 + Math.random() * 2;
      offsets[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uStretch: { value: 0 },
      },
      vertexShader: WARP_VERTEX,
      fragmentShader: WARP_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { geometry: geo, material: mat };
  }, []);

  useFrame(({ clock }, delta) => {
    material.uniforms.uTime.value = clock.getElapsedTime();

    let targetIntensity = 0;
    let targetStretch = 0;

    if (phase === 'warp') {
      targetIntensity = 1;
      targetStretch = 1;
    } else if (phase === 'decelerate') {
      targetIntensity = 0.4;
      targetStretch = 0.2;
    } else if (phase === 'reveal' || phase === 'complete') {
      targetIntensity = 0;
      targetStretch = 0;
    }

    const lerpSpeed = phase === 'reveal' ? 3 : 2;
    intensityRef.current += (targetIntensity - intensityRef.current) * delta * lerpSpeed;
    stretchRef.current += (targetStretch - stretchRef.current) * delta * lerpSpeed;

    material.uniforms.uIntensity.value = intensityRef.current;
    material.uniforms.uStretch.value = stretchRef.current;
  });

  if (phase === 'idle' || (phase === 'complete' && intensityRef.current < 0.01)) return null;

  return <points geometry={geometry} material={material} />;
}
