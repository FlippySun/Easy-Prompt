/**
 * Deep Ocean Scene — 深海世界展示模式
 * 灵感: OceanX 2025 (https://2025.oceanx.org/)
 *
 * 视觉范式：
 * - Prompts 作为发光水母/生物体漂浮在深海暗色空间中
 * - 8 个分类 = 不同深度区域，从浅海到深渊
 * - God rays (从水面向下的光线)、浮游微粒、水波纹
 * - 色调: 深海蓝 (#0A1628) + 生物荧光青 (#90E0EF) + 暖橙 (#FF7438)
 */

import { useRef, useMemo, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { CategoryCluster, PromptStarData, HoverInfo } from './types';

// ─── 深海常量 ──────────────────────────────────────────────

const OCEAN_CONFIG = {
  /** 深海总深度范围 */
  DEPTH_RANGE: 60,
  /** 水平扩展范围 */
  HORIZONTAL_RANGE: 40,
  /** 分类深度步进 */
  DEPTH_STEP: 7,
  /** God ray 数量 */
  GOD_RAY_COUNT: 8,
  /** 浮游粒子数量 */
  PLANKTON_COUNT: 600,
  /** 水母浮动速度 */
  FLOAT_SPEED: 0.3,
  /** Bloom 强度 */
  BLOOM_INTENSITY: 2.2,
} as const;

/** 深度区域颜色渐变（从浅到深） */
const DEPTH_COLORS = [
  '#4FC3F7', // 阳光层 (0-200m)
  '#29B6F6', // 中光层
  '#039BE5', // 弱光层
  '#0277BD', // 半深海
  '#01579B', // 深海区
  '#0D47A1', // 深渊区
  '#1A237E', // 超深渊
  '#0A1628', // 海沟
] as const;

// ─── GLSL: 水母着色器 ─────────────────────────────────────

const JELLYFISH_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aDepth;
  attribute float aHighlight;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uHoveredIndex;

  varying vec3 vColor;
  varying float vBrightness;
  varying float vIsHovered;
  varying float vDepthFade;
  varying float vPulse;

  void main() {
    vColor = color;

    float vertId = float(gl_VertexID);
    vIsHovered = abs(vertId - uHoveredIndex) < 0.5 ? 1.0 : 0.0;

    // 深度雾化因子
    vDepthFade = 1.0 - aDepth * 0.4;

    // 生物发光脉动
    float pulse = 0.6 + 0.4 * sin(uTime * 0.8 + aPhase * 6.28);
    vPulse = pulse;

    // 柔和浮动
    vec3 pos = position;
    pos.y += sin(uTime * 0.3 + aPhase * 3.14) * 0.4;
    pos.x += sin(uTime * 0.2 + aPhase * 2.0) * 0.25;
    pos.z += cos(uTime * 0.15 + aPhase * 1.5) * 0.2;

    // 搜索高亮
    float highlight = aHighlight;
    float brightMult = 1.0;
    if (highlight > 0.5) {
      brightMult = 3.0;
    } else if (highlight < -0.5) {
      brightMult = 0.08;
    } else {
      brightMult = pulse * 1.5;
    }

    if (vIsHovered > 0.5) {
      brightMult = 4.0;
    }

    vBrightness = brightMult * vDepthFade;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    float sizeMult = vIsHovered > 0.5 ? 2.2 : 1.0;
    float pulseMult = 0.85 + pulse * 0.3;
    gl_PointSize = aSize * uPixelRatio * sizeMult * pulseMult * (250.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 2.0, 50.0);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const JELLYFISH_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vBrightness;
  varying float vIsHovered;
  varying float vDepthFade;
  varying float vPulse;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    // 水母形态：中心亮 + 柔和辐射 + 触手状边缘
    float bell = 1.0 - smoothstep(0.0, 0.2, dist); // 伞盖核心
    float glow = 1.0 - smoothstep(0.0, 0.5, dist); // 辐射光晕
    float tentacle = smoothstep(0.3, 0.5, dist) * (1.0 - smoothstep(0.45, 0.5, dist));

    // 触手波纹
    float angle = atan(center.y, center.x);
    float wave = 0.5 + 0.5 * sin(angle * 6.0 + vPulse * 6.28);
    tentacle *= wave * 0.4;

    float brightness = bell * 0.8 + glow * 0.3 + tentacle;
    brightness *= vBrightness;

    // Hover 脉冲环
    if (vIsHovered > 0.5) {
      float ring = smoothstep(0.25, 0.3, dist) * (1.0 - smoothstep(0.3, 0.35, dist));
      brightness += ring * 2.0;
    }

    vec3 finalColor = vColor * brightness;

    // 深海中略带青色光晕
    finalColor += vec3(0.05, 0.15, 0.25) * glow * vDepthFade * 0.3;

    gl_FragColor = vec4(finalColor, brightness * 0.9);
  }
`;

// ─── GLSL: God Rays 着色器 ────────────────────────────────

const GODRAY_VERTEX = /* glsl */ `
  attribute float aIntensity;
  attribute float aPhase;

  uniform float uTime;

  varying float vIntensity;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    // 光柱缓慢摆动
    float sway = sin(uTime * 0.3 + aPhase) * 0.15;
    vec3 pos = position;
    pos.x += sway * pos.y * 0.02;

    vIntensity = aIntensity * (0.6 + 0.4 * sin(uTime * 0.5 + aPhase * 2.0));

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const GODRAY_FRAGMENT = /* glsl */ `
  varying float vIntensity;
  varying vec2 vUv;

  void main() {
    // 自上而下衰减
    float fade = 1.0 - vUv.y;
    fade = pow(fade, 2.0);

    // 水平宽度渐变
    float xFade = 1.0 - abs(vUv.x - 0.5) * 2.0;
    xFade = pow(xFade, 3.0);

    float alpha = fade * xFade * vIntensity * 0.08;
    vec3 rayColor = mix(vec3(0.2, 0.6, 0.9), vec3(0.4, 0.85, 1.0), vUv.y);

    gl_FragColor = vec4(rayColor, alpha);
  }
`;

// ─── 水母体组件 ────────────────────────────────────────────

interface JellyfishSwarmProps {
  stars: PromptStarData[];
  positions: Float32Array;
  matchedIds: Set<string>;
  hasSearch: boolean;
  visible: boolean;
  onHover: (info: HoverInfo | null) => void;
  onClick: (star: PromptStarData) => void;
  onDoubleClick?: (star: PromptStarData) => void;
  onContextMenu?: (star: PromptStarData, x: number, y: number) => void;
}

function JellyfishSwarm({
  stars,
  positions,
  matchedIds,
  hasSearch,
  visible,
  onHover,
  onClick,
  onDoubleClick,
  onContextMenu,
}: JellyfishSwarmProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const hoveredIndexRef = useRef(-1);
  const { gl, camera } = useThree();

  const { geometry, highlightAttr } = useMemo(() => {
    const count = stars.length;
    const posArr = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const depths = new Float32Array(count);
    const highlights = new Float32Array(count);
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      posArr[i * 3] = positions[i * 3];
      posArr[i * 3 + 1] = positions[i * 3 + 1];
      posArr[i * 3 + 2] = positions[i * 3 + 2];

      color.set(stars[i].color);
      // 向青/蓝偏移使颜色更海洋化
      color.r = color.r * 0.5 + 0.1;
      color.g = color.g * 0.7 + 0.2;
      color.b = Math.min(1.0, color.b * 0.8 + 0.4);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = stars[i].radius * 1.4; // 水母比星星大
      phases[i] = stars[i].twinkleOffset;
      // 深度归一化 (0=表面, 1=深渊)
      const yPos = positions[i * 3 + 1];
      depths[i] = Math.max(0, Math.min(1, (-yPos) / OCEAN_CONFIG.DEPTH_RANGE));
      highlights[i] = 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aDepth', new THREE.BufferAttribute(depths, 1));
    const hlAttr = new THREE.BufferAttribute(highlights, 1);
    geo.setAttribute('aHighlight', hlAttr);
    return { geometry: geo, highlightAttr: hlAttr };
  }, [stars, positions]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uHoveredIndex: { value: -1 },
        },
        vertexShader: JELLYFISH_VERTEX,
        fragmentShader: JELLYFISH_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
      }),
    [],
  );

  useEffect(() => {
    materialRef.current = material;
  }, [material]);

  // 搜索高亮
  useEffect(() => {
    const arr = highlightAttr.array as Float32Array;
    for (let i = 0; i < stars.length; i++) {
      if (hasSearch) {
        arr[i] = matchedIds.has(stars[i].prompt.id) ? 1 : -1;
      } else {
        arr[i] = 0;
      }
    }
    highlightAttr.needsUpdate = true;
  }, [stars, matchedIds, hasSearch, highlightAttr]);

  const scaleRef = useRef(0);

  useFrame(({ clock }) => {
    const mat = materialRef.current;
    const pts = pointsRef.current;
    if (!mat || !pts) return;

    mat.uniforms.uTime.value = clock.getElapsedTime();
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio();
    mat.uniforms.uHoveredIndex.value = hoveredIndexRef.current;

    const targetScale = visible ? 1 : 0;
    scaleRef.current += (targetScale - scaleRef.current) * 0.06;
    pts.scale.setScalar(scaleRef.current);
  });

  // Raycasting
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const rafIdRef = useRef(0);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      const clientX = e.clientX;
      const clientY = e.clientY;
      rafIdRef.current = requestAnimationFrame(() => {
        const rect = gl.domElement.getBoundingClientRect();
        mouseRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        raycasterRef.current.params.Points = { threshold: 0.8 };
        const pts = pointsRef.current;
        if (!pts || !visible) return;
        const hits = raycasterRef.current.intersectObject(pts);
        if (hits.length > 0 && hits[0].index !== undefined) {
          const star = stars[hits[0].index];
          if (star) {
            hoveredIndexRef.current = hits[0].index;
            gl.domElement.style.cursor = 'pointer';
            onHover({ star, screenX: clientX, screenY: clientY });
            return;
          }
        }
        hoveredIndexRef.current = -1;
        gl.domElement.style.cursor = 'auto';
        onHover(null);
      });
    },
    [stars, camera, gl, onHover, visible],
  );

  const handlePointerLeave = useCallback(() => {
    hoveredIndexRef.current = -1;
    onHover(null);
  }, [onHover]);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      raycasterRef.current.params.Points = { threshold: 0.8 };
      const pts = pointsRef.current;
      if (!pts || !visible) return;
      const hits = raycasterRef.current.intersectObject(pts);
      if (hits.length > 0 && hits[0].index !== undefined) {
        const star = stars[hits[0].index];
        if (star) onClick(star);
      }
    },
    [stars, camera, gl, onClick, visible],
  );

  const handleDoubleClick = useCallback(
    (e: MouseEvent) => {
      if (!onDoubleClick) return;
      const rect = gl.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      raycasterRef.current.params.Points = { threshold: 0.8 };
      const pts = pointsRef.current;
      if (!pts || !visible) return;
      const hits = raycasterRef.current.intersectObject(pts);
      if (hits.length > 0 && hits[0].index !== undefined) {
        const star = stars[hits[0].index];
        if (star) onDoubleClick(star);
      }
    },
    [stars, camera, gl, onDoubleClick, visible],
  );

  const handleContextMenuEvent = useCallback(
    (e: MouseEvent) => {
      if (!onContextMenu) return;
      const rect = gl.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      raycasterRef.current.params.Points = { threshold: 0.8 };
      const pts = pointsRef.current;
      if (!pts || !visible) return;
      const hits = raycasterRef.current.intersectObject(pts);
      if (hits.length > 0 && hits[0].index !== undefined) {
        const star = stars[hits[0].index];
        if (star) {
          e.preventDefault();
          onContextMenu(star, e.clientX, e.clientY);
        }
      }
    },
    [stars, camera, gl, onContextMenu, visible],
  );

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerleave', handlePointerLeave);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('dblclick', handleDoubleClick);
    canvas.addEventListener('contextmenu', handleContextMenuEvent);
    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('dblclick', handleDoubleClick);
      canvas.removeEventListener('contextmenu', handleContextMenuEvent);
      canvas.style.cursor = 'auto';
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [gl, handlePointerMove, handlePointerLeave, handleClick, handleDoubleClick, handleContextMenuEvent]);

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

// ─── God Rays（从水面向下的光柱） ─────────────────────────

function GodRays() {
  const groupRef = useRef<THREE.Group>(null);

  const { geometry, material } = useMemo(() => {
    const rayCount = OCEAN_CONFIG.GOD_RAY_COUNT;
    const positions: number[] = [];
    const uvs: number[] = [];
    const intensities: number[] = [];
    const phases: number[] = [];

    for (let i = 0; i < rayCount; i++) {
      const x = (Math.random() - 0.5) * OCEAN_CONFIG.HORIZONTAL_RANGE * 1.5;
      const z = (Math.random() - 0.5) * OCEAN_CONFIG.HORIZONTAL_RANGE * 1.5;
      const width = 1.5 + Math.random() * 2.5;
      const height = OCEAN_CONFIG.DEPTH_RANGE * (0.5 + Math.random() * 0.5);
      const intensity = 0.3 + Math.random() * 0.7;
      const phase = Math.random() * Math.PI * 2;

      // 每条光柱用一个矩形（2 triangles）
      const y0 = 5; // 顶部（接近水面）
      const y1 = y0 - height;
      const hw = width / 2;

      // Triangle 1
      positions.push(x - hw, y0, z, x + hw, y0, z, x + hw, y1, z);
      uvs.push(0, 0, 1, 0, 1, 1);
      // Triangle 2
      positions.push(x - hw, y0, z, x + hw, y1, z, x - hw, y1, z);
      uvs.push(0, 0, 1, 1, 0, 1);

      for (let j = 0; j < 6; j++) {
        intensities.push(intensity);
        phases.push(phase);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('aIntensity', new THREE.Float32BufferAttribute(intensities, 1));
    geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: GODRAY_VERTEX,
      fragmentShader: GODRAY_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    return { geometry: geo, material: mat };
  }, []);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} material={material} />
    </group>
  );
}

// ─── 浮游微粒 ─────────────────────────────────────────────

function Plankton({ visible }: { visible: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const opacityRef = useRef(0);

  const { geometry, material } = useMemo(() => {
    const count = OCEAN_CONFIG.PLANKTON_COUNT;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * OCEAN_CONFIG.HORIZONTAL_RANGE * 2;
      positions[i * 3 + 1] = -Math.random() * OCEAN_CONFIG.DEPTH_RANGE;
      positions[i * 3 + 2] = (Math.random() - 0.5) * OCEAN_CONFIG.HORIZONTAL_RANGE * 2;

      // 随机偏绿或偏蓝
      const hue = 0.5 + Math.random() * 0.15;
      const color = new THREE.Color();
      color.setHSL(hue, 0.6, 0.6);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = 0.5 + Math.random() * 1.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 0.15,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
      sizeAttenuation: true,
    });

    return { geometry: geo, material: mat };
  }, []);

  useFrame(({ clock }) => {
    const pts = pointsRef.current;
    if (!pts) return;

    const target = visible ? 0.4 : 0;
    opacityRef.current += (target - opacityRef.current) * 0.05;
    material.opacity = opacityRef.current;

    // 缓慢上升飘动
    const posArr = geometry.attributes.position.array as Float32Array;
    const t = clock.getElapsedTime();
    for (let i = 0; i < OCEAN_CONFIG.PLANKTON_COUNT; i++) {
      posArr[i * 3 + 1] += Math.sin(t * 0.2 + i) * 0.003;
      posArr[i * 3] += Math.sin(t * 0.1 + i * 0.5) * 0.002;
      // 循环回到底部
      if (posArr[i * 3 + 1] > 5) {
        posArr[i * 3 + 1] = -OCEAN_CONFIG.DEPTH_RANGE;
      }
    }
    geometry.attributes.position.needsUpdate = true;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

// ─── 水面波纹（顶部装饰面） ──────────────────────────────

function WaterSurface() {
  const meshRef = useRef<THREE.Mesh>(null);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 pos = position;
            pos.y += sin(pos.x * 0.3 + uTime * 0.5) * 0.3
                   + sin(pos.z * 0.2 + uTime * 0.3) * 0.2;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            float wave = sin(vUv.x * 20.0 + uTime) * sin(vUv.y * 20.0 + uTime * 0.7);
            float alpha = 0.03 + wave * 0.015;
            vec3 surfColor = vec3(0.3, 0.7, 0.9);
            gl_FragColor = vec4(surfColor, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh ref={meshRef} position={[0, 5, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <planeGeometry args={[120, 120, 32, 32]} />
    </mesh>
  );
}

// ─── 深海相机控制 ──────────────────────────────────────────

function OceanCamera() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, -10, 35);
    camera.lookAt(0, -20, 0);
  }, [camera]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // 缓慢俯仰漂移
    camera.position.x = Math.sin(t * 0.05) * 3;
    camera.position.z = 35 + Math.sin(t * 0.03) * 2;
    camera.lookAt(0, -20, 0);
  });

  return null;
}

// ─── 深海布局计算 ──────────────────────────────────────────

/** 将 Prompts 按分类分布到不同深度区域 */
export function computeOceanPositions(
  clusters: CategoryCluster[],
): Float32Array {
  const allStars: PromptStarData[] = [];
  for (const c of clusters) {
    for (const s of c.stars) {
      allStars.push(s);
    }
  }

  const positions = new Float32Array(allStars.length * 3);
  const catIds = clusters.map((c) => c.id);

  for (let i = 0; i < allStars.length; i++) {
    const star = allStars[i];
    const catIndex = catIds.indexOf(star.category);
    const depth = -(catIndex * OCEAN_CONFIG.DEPTH_STEP + Math.random() * OCEAN_CONFIG.DEPTH_STEP * 0.8);

    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * OCEAN_CONFIG.HORIZONTAL_RANGE * 0.5;

    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = depth;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
  }

  return positions;
}

// ─── 深度区域标签 ──────────────────────────────────────────

function DepthMarkers({ clusters }: { clusters: CategoryCluster[] }) {
  const groupRef = useRef<THREE.Group>(null);

  const markers = useMemo(() => {
    return clusters.map((cluster, i) => ({
      position: [-OCEAN_CONFIG.HORIZONTAL_RANGE * 0.5 - 3, -(i * OCEAN_CONFIG.DEPTH_STEP + OCEAN_CONFIG.DEPTH_STEP * 0.5), 0] as [
        number,
        number,
        number,
      ],
      color: DEPTH_COLORS[i] || DEPTH_COLORS[DEPTH_COLORS.length - 1],
      label: cluster.label,
    }));
  }, [clusters]);

  return (
    <group ref={groupRef}>
      {markers.map((m, i) => (
        <mesh key={i} position={m.position}>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshBasicMaterial color={m.color} transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// ─── 主场景组件 ────────────────────────────────────────────

interface OceanSceneProps {
  clusters: CategoryCluster[];
  allStars: PromptStarData[];
  visible: boolean;
  matchedIds: Set<string>;
  hasSearch: boolean;
  onStarClick: (star: PromptStarData) => void;
  onHover: (info: HoverInfo | null) => void;
  onDoubleClick?: (star: PromptStarData) => void;
  onContextMenu?: (star: PromptStarData, x: number, y: number) => void;
}

export function OceanScene({
  clusters,
  allStars,
  visible,
  matchedIds,
  hasSearch,
  onStarClick,
  onHover,
  onDoubleClick,
  onContextMenu,
}: OceanSceneProps) {
  const positions = useMemo(() => computeOceanPositions(clusters), [clusters]);

  return (
    <Canvas
      gl={{
        antialias: false,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
      }}
      camera={{
        fov: 60,
        near: 0.1,
        far: 200,
        position: [0, -10, 35],
      }}
      style={{ background: '#040918' }}
      dpr={[1, 1.5]}
    >
      <ambientLight intensity={0.03} color="#1a3a5c" />
      <pointLight position={[0, 10, 0]} intensity={0.5} color="#4FC3F7" distance={80} />

      <OceanCamera />

      {/* 水面波纹 */}
      <WaterSurface />

      {/* God Rays */}
      <GodRays />

      {/* 浮游微粒 */}
      <Plankton visible={visible} />

      {/* 深度区域标记 */}
      <DepthMarkers clusters={clusters} />

      {/* 水母体（Prompt 数据点） */}
      <JellyfishSwarm
        stars={allStars}
        positions={positions}
        matchedIds={matchedIds}
        hasSearch={hasSearch}
        visible={visible}
        onHover={onHover}
        onClick={onStarClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
      />

      {/* 后处理 */}
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={OCEAN_CONFIG.BLOOM_INTENSITY}
          luminanceThreshold={0.15}
          luminanceSmoothing={0.95}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.1} darkness={0.9} />
      </EffectComposer>
    </Canvas>
  );
}
