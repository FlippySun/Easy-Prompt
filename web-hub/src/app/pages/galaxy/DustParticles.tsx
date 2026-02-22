/**
 * Galaxy Cosmos — 旋臂星尘粒子
 * 数千微小粒子沿螺旋旋臂漂浮，营造深空辉光感
 * 全 GPU 驱动 — shader 内完成所有动画
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COSMOS_CONFIG } from './types';

// ─── GLSL ──────────────────────────────────────────────────

const DUST_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aOffset;

  uniform float uTime;
  uniform float uOpacity;

  varying float vAlpha;

  void main() {
    // 缓慢旋转整个星尘场
    float angle = uTime * 0.02 + aOffset * 0.1;
    float cosA = cos(angle);
    float sinA = sin(angle);
    vec3 pos = position;
    float rx = pos.x * cosA - pos.z * sinA;
    float rz = pos.x * sinA + pos.z * cosA;
    pos.x = rx;
    pos.z = rz;

    // 微小浮动
    pos.y += sin(uTime * 0.3 + aOffset) * 0.08;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // 闪烁
    float twinkle = 0.4 + 0.6 * sin(uTime * 0.8 + aOffset * 3.0);
    vAlpha = twinkle * uOpacity;

    gl_PointSize = aSize * (150.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 4.0);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const DUST_FRAGMENT = /* glsl */ `
  varying float vAlpha;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    float glow = 1.0 - smoothstep(0.0, 0.5, dist);
    float alpha = glow * vAlpha;

    // 微暖色调
    vec3 dustColor = vec3(0.75, 0.7, 0.85);
    gl_FragColor = vec4(dustColor * alpha, alpha);
  }
`;

// ─── 组件 ──────────────────────────────────────────────────

interface DustParticlesProps {
  visible: boolean;
}

export function DustParticles({ visible }: DustParticlesProps) {
  const opacityRef = useRef(0);

  // 沿螺旋旋臂散布尘埃粒子
  const { geometry, material } = useMemo(() => {
    const count = COSMOS_CONFIG.DUST_COUNT;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const offsets = new Float32Array(count);

    const armCount = 8;
    const armAngleStep = (Math.PI * 2) / armCount;

    for (let i = 0; i < count; i++) {
      const arm = i % armCount;
      const t = Math.random();

      // 螺旋路径
      const armCore = COSMOS_CONFIG.ARM_CORE_RADIUS;
      const armEdge = COSMOS_CONFIG.GALAXY_RADIUS;
      const r = armCore + (armEdge - armCore) * t;
      const theta = armAngleStep * arm + t * COSMOS_CONFIG.ARM_WINDS * Math.PI * 2;

      // 更宽的散布（填充旋臂间隙）
      const scatter = COSMOS_CONFIG.ARM_SCATTER * (0.8 + t * 1.2);
      const sx = (Math.random() - 0.5) * scatter;
      const sz = (Math.random() - 0.5) * scatter;
      const sy = (Math.random() - 0.5) * COSMOS_CONFIG.ARM_Y_SCATTER * 0.8;

      positions[i * 3] = Math.cos(theta) * r + sx;
      positions[i * 3 + 1] = sy;
      positions[i * 3 + 2] = Math.sin(theta) * r + sz;

      sizes[i] = 1.5 + Math.random() * 3;
      offsets[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
      },
      vertexShader: DUST_VERTEX,
      fragmentShader: DUST_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { geometry: geo, material: mat };
  }, []);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime();

    // 渐入
    const target = visible ? 0.6 : 0;
    opacityRef.current += (target - opacityRef.current) * 0.04;
    material.uniforms.uOpacity.value = opacityRef.current;
  });

  return <points geometry={geometry} material={material} />;
}
