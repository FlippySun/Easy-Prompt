/**
 * Galaxy Cosmos — 背景星场
 * 3000+ 微粒营造深空氛围
 * 全 GPU 驱动 — shader 内完成闪烁动画（无 CPU 矩阵更新）
 */

import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COSMOS_CONFIG } from './types';

// ─── GLSL ──────────────────────────────────────────────────

const BG_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aTwinkleSpeed;
  attribute float aTwinkleOffset;
  attribute float aBaseAlpha;

  uniform float uTime;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = color;

    // GPU 驱动闪烁
    float twinkle = 0.5 + 0.5 * sin(uTime * aTwinkleSpeed + aTwinkleOffset);
    vAlpha = aBaseAlpha * (0.5 + 0.5 * twinkle);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (150.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 4.0);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const BG_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    float glow = 1.0 - smoothstep(0.0, 0.5, dist);
    float core = 1.0 - smoothstep(0.0, 0.08, dist);
    float brightness = core * 0.6 + glow * 0.3;

    vec3 finalColor = vColor * brightness;
    gl_FragColor = vec4(finalColor, brightness * vAlpha);
  }
`;

// ─── 组件 ──────────────────────────────────────────────────

export function StarField() {
  const count = COSMOS_CONFIG.BG_STAR_COUNT;
  const range = COSMOS_CONFIG.BG_STAR_RANGE;

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const twinkleSpeeds = new Float32Array(count);
    const twinkleOffsets = new Float32Array(count);
    const baseAlphas = new Float32Array(count);

    // 色彩调色板（微妙的色温变化）
    const palette = [
      [1, 0.95, 0.85], // 温暖白
      [0.8, 0.85, 1.0], // 冷蓝
      [1, 0.88, 0.7], // 温暖黄
      [0.88, 0.78, 1.0], // 淡紫
      [0.7, 0.9, 1.0], // 天蓝
    ];

    for (let i = 0; i < count; i++) {
      // 球形分布
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = range * (0.3 + Math.random() * 0.7);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c[0];
      colors[i * 3 + 1] = c[1];
      colors[i * 3 + 2] = c[2];

      sizes[i] = 1 + Math.random() * 3;
      twinkleSpeeds[i] = 0.5 + Math.random() * 2;
      twinkleOffsets[i] = Math.random() * Math.PI * 2;
      baseAlphas[i] = 0.3 + Math.random() * 0.7;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(twinkleSpeeds, 1));
    geo.setAttribute('aTwinkleOffset', new THREE.BufferAttribute(twinkleOffsets, 1));
    geo.setAttribute('aBaseAlpha', new THREE.BufferAttribute(baseAlphas, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: BG_VERTEX,
      fragmentShader: BG_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });

    return { geometry: geo, material: mat };
  }, [count, range]);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime();
  });

  return <points geometry={geometry} material={material} />;
}
