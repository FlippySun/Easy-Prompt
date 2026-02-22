/**
 * GalaxyCore — 银河中心发光漩涡
 * 位于星系中心的缓慢旋转发光体，增强视觉深度
 * 使用自定义 Shader 实现螺旋辐射效果
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);

    // 多层螺旋纹理（低对比度）
    float spiral1 = sin(angle * 3.0 + dist * 15.0 - uTime * 0.5) * 0.5 + 0.5;
    float spiral2 = sin(angle * 5.0 - dist * 10.0 + uTime * 0.3) * 0.5 + 0.5;
    float spiral = spiral1 * spiral2;

    // 径向衰减（更快衰减，更紧凑）
    float glow = exp(-dist * dist * 22.0);
    float ring = exp(-pow(dist - 0.12, 2.0) * 120.0) * 0.15;

    // 核心颜色：柔和蓝紫色（降低饱和度）
    vec3 coreColor = mix(
      vec3(0.25, 0.18, 0.55),
      vec3(0.35, 0.5, 0.8),
      spiral
    );

    float brightness = (glow + ring) * (0.3 + spiral * 0.2);

    // 外层柔光（更弱）
    float outerGlow = exp(-dist * 6.0) * 0.05;

    vec3 finalColor = coreColor * brightness + vec3(0.4, 0.25, 0.6) * outerGlow;
    float alpha = (brightness * 0.5 + outerGlow) * 0.4;

    // 边缘淡出（更激进的裁切）
    alpha *= smoothstep(0.38, 0.12, dist);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export function GalaxyCore({ visible }: { visible: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    material.uniforms.uTime.value = clock.getElapsedTime();

    // 缓慢旋转
    meshRef.current.rotation.z = clock.getElapsedTime() * 0.05;

    // 可见性渐变
    const targetOpacity = visible ? 1 : 0;
    const current = material.uniforms.uTime.value > 0 ? meshRef.current.scale.x : 0;
    const next = current + (targetOpacity - current) * 0.04;
    meshRef.current.scale.setScalar(next || 0.001);
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0.001}>
      <planeGeometry args={[5, 5]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
