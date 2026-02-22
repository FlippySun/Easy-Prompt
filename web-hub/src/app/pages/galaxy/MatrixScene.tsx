/**
 * Matrix Scene — 信息矩阵展示模式
 * 灵感: Curated Media (https://www.curated.media/)
 *
 * 视觉范式：
 * - Prompts 作为毛玻璃发光卡片在 3D 空间中悬浮排列
 * - 8 个分类 = 8 个数据流通道，卡片沿通道排列
 * - 透明/半透明材质 + 微光边框 + 数据流粒子
 * - 色调: 深蓝紫 (#2D3055) + 紫色品牌色 + 冷白
 */

import { useRef, useMemo, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { CategoryCluster, PromptStarData, HoverInfo } from './types';

// ─── 常量 ──────────────────────────────────────────────────

const MATRIX_CONFIG = {
  /** 通道间距 */
  CHANNEL_SPACING: 6,
  /** 卡片深度间距 */
  CARD_DEPTH_SPACING: 3,
  /** 通道长度 */
  CHANNEL_LENGTH: 40,
  /** 数据流粒子数 */
  STREAM_PARTICLE_COUNT: 400,
  /** 卡片浮动幅度 */
  CARD_FLOAT: 0.08,
  /** Bloom 强度 */
  BLOOM_INTENSITY: 1.8,
} as const;

/** 色板 */
const PALETTE = {
  bg: '#1a1d3a',
  purple: '#7c3aed',
  purpleLight: '#a78bfa',
  blue: '#3b82f6',
  blueLight: '#60a5fa',
  cyan: '#06b6d4',
  white: '#e2e8f0',
  dim: '#334155',
} as const;

/** 分类通道颜色 */
const CHANNEL_COLORS: Record<string, string> = {
  coding: '#6366f1',
  writing: '#8b5cf6',
  marketing: '#ec4899',
  art: '#a855f7',
  productivity: '#3b82f6',
  education: '#14b8a6',
  business: '#6366f1',
  life: '#06b6d4',
};

// ─── GLSL: 卡片着色器 ─────────────────────────────────────

const CARD_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aHighlight;
  attribute float aChannel;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uHoveredIndex;

  varying vec3 vColor;
  varying float vBrightness;
  varying float vIsHovered;
  varying float vChannel;

  void main() {
    vColor = color;
    vChannel = aChannel;

    float vertId = float(gl_VertexID);
    vIsHovered = abs(vertId - uHoveredIndex) < 0.5 ? 1.0 : 0.0;

    // 悬浮微动
    vec3 pos = position;
    pos.y += sin(uTime * 0.4 + aPhase * 6.28) * ${MATRIX_CONFIG.CARD_FLOAT};
    pos.z += sin(uTime * 0.3 + aPhase * 4.0) * ${MATRIX_CONFIG.CARD_FLOAT} * 0.5;

    float highlight = aHighlight;
    float brightMult = 1.0;
    if (highlight > 0.5) {
      brightMult = 3.0;
    } else if (highlight < -0.5) {
      brightMult = 0.06;
    } else {
      brightMult = 0.6 + 0.4 * sin(uTime * 0.5 + aPhase * 3.0);
    }

    if (vIsHovered > 0.5) {
      brightMult = 4.0;
    }

    vBrightness = brightMult;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    float hoverScale = vIsHovered > 0.5 ? 2.2 : 1.0;
    gl_PointSize = aSize * uPixelRatio * hoverScale * (220.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 2.0, 50.0);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const CARD_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vBrightness;
  varying float vIsHovered;
  varying float vChannel;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    // 卡片形态：圆角矩形 + 玻璃质感
    vec2 absC = abs(center);
    float rect = max(absC.x, absC.y);
    float roundRect = max(rect - 0.05, 0.0);

    // 玻璃折射效果
    float glass = 1.0 - smoothstep(0.0, 0.4, roundRect);
    float edge = smoothstep(0.32, 0.36, roundRect) * (1.0 - smoothstep(0.38, 0.42, roundRect));
    float core = 1.0 - smoothstep(0.0, 0.15, roundRect);

    float brightness = glass * 0.3 + edge * 0.8 + core * 0.5;
    brightness *= vBrightness;

    // Hover 发光边框
    if (vIsHovered > 0.5) {
      float hoverEdge = smoothstep(0.28, 0.32, roundRect) * (1.0 - smoothstep(0.4, 0.45, roundRect));
      brightness += hoverEdge * 3.0;
    }

    // 内部纹理条纹（模拟数据）
    float dataLine = smoothstep(0.48, 0.5, fract(gl_PointCoord.y * 8.0));
    brightness += dataLine * 0.05 * glass;

    vec3 finalColor = vColor * brightness;

    // 玻璃表面微反射
    finalColor += vec3(0.1, 0.1, 0.2) * glass * 0.15;

    gl_FragColor = vec4(finalColor, brightness * 0.92);
  }
`;

// ─── 数据流粒子 ────────────────────────────────────────────

function DataStreams({ clusters, visible }: { clusters: CategoryCluster[]; visible: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const opacityRef = useRef(0);

  const { geometry, material, channelCount } = useMemo(() => {
    const count = MATRIX_CONFIG.STREAM_PARTICLE_COUNT;
    const catCount = clusters.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const channelIndices = new Float32Array(count);

    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const chIdx = Math.floor(Math.random() * catCount);
      const catId = clusters[chIdx]?.id || 'coding';
      const chColor = CHANNEL_COLORS[catId] || PALETTE.purple;

      const xOffset = (chIdx - catCount / 2) * MATRIX_CONFIG.CHANNEL_SPACING;
      positions[i * 3] = xOffset + (Math.random() - 0.5) * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * MATRIX_CONFIG.CHANNEL_LENGTH;

      color.set(chColor);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      speeds[i] = 0.5 + Math.random() * 1.5;
      channelIndices[i] = chIdx;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.12,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
      sizeAttenuation: true,
    });

    return { geometry: geo, material: mat, channelCount: catCount };
  }, [clusters]);

  useFrame(({ clock }) => {
    const target = visible ? 0.5 : 0;
    opacityRef.current += (target - opacityRef.current) * 0.05;
    material.opacity = opacityRef.current;

    // 粒子沿通道流动
    const posArr = geometry.attributes.position.array as Float32Array;
    const t = clock.getElapsedTime();
    const halfLen = MATRIX_CONFIG.CHANNEL_LENGTH / 2;

    for (let i = 0; i < MATRIX_CONFIG.STREAM_PARTICLE_COUNT; i++) {
      posArr[i * 3 + 2] -= 0.08; // 向前流动
      // 循环
      if (posArr[i * 3 + 2] < -halfLen) {
        posArr[i * 3 + 2] = halfLen;
        posArr[i * 3 + 1] = (Math.random() - 0.5) * 4;
      }
      // 横向微漂移
      posArr[i * 3] += Math.sin(t + i * 0.1) * 0.002;
    }
    geometry.attributes.position.needsUpdate = true;

    void channelCount;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

// ─── 通道导轨线 ────────────────────────────────────────────

function ChannelRails({ clusters, visible }: { clusters: CategoryCluster[]; visible: boolean }) {
  const meshRef = useRef<THREE.LineSegments>(null);
  const opacityRef = useRef(0);

  const { geometry, material } = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const catCount = clusters.length;
    const halfLen = MATRIX_CONFIG.CHANNEL_LENGTH / 2;

    for (let ci = 0; ci < catCount; ci++) {
      const xOffset = (ci - catCount / 2) * MATRIX_CONFIG.CHANNEL_SPACING;
      const catId = clusters[ci]?.id || 'coding';
      const chColor = new THREE.Color(CHANNEL_COLORS[catId] || PALETTE.purple);
      const dimColor = chColor.clone().multiplyScalar(0.3);

      // 主导轨（4 条平行线）
      const rails = [
        [-1.5, -1.5],
        [1.5, -1.5],
        [-1.5, 1.5],
        [1.5, 1.5],
      ];

      for (const [dx, dy] of rails) {
        positions.push(xOffset + dx, dy, -halfLen, xOffset + dx, dy, halfLen);
        colors.push(dimColor.r, dimColor.g, dimColor.b, chColor.r, chColor.g, chColor.b);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

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
    const target = visible ? 0.15 : 0;
    opacityRef.current += (target - opacityRef.current) * 0.05;
    material.opacity = opacityRef.current;
  });

  return <lineSegments ref={meshRef} geometry={geometry} material={material} />;
}

// ─── 卡片节点 ──────────────────────────────────────────────

interface MatrixCardsProps {
  stars: PromptStarData[];
  clusters: CategoryCluster[];
  matchedIds: Set<string>;
  hasSearch: boolean;
  visible: boolean;
  onHover: (info: HoverInfo | null) => void;
  onClick: (star: PromptStarData) => void;
  onDoubleClick?: (star: PromptStarData) => void;
  onContextMenu?: (star: PromptStarData, x: number, y: number) => void;
}

function MatrixCards({
  stars,
  clusters,
  matchedIds,
  hasSearch,
  visible,
  onHover,
  onClick,
  onDoubleClick,
  onContextMenu,
}: MatrixCardsProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const hoveredIndexRef = useRef(-1);
  const { gl, camera } = useThree();

  const { geometry, highlightAttr } = useMemo(() => {
    const count = stars.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const highlights = new Float32Array(count);
    const channels = new Float32Array(count);
    const color = new THREE.Color();

    const catIds = clusters.map((c) => c.id);

    // 按分类分组计数
    const catCountMap: Record<string, number> = {};
    for (const star of stars) {
      catCountMap[star.category] = (catCountMap[star.category] || 0) + 1;
    }
    const catLocalIdx: Record<string, number> = {};

    for (let i = 0; i < count; i++) {
      const star = stars[i];
      const catIndex = catIds.indexOf(star.category);
      const localIdx = catLocalIdx[star.category] || 0;
      catLocalIdx[star.category] = localIdx + 1;

      const xOffset = (catIndex - catIds.length / 2) * MATRIX_CONFIG.CHANNEL_SPACING;
      const zPos = (localIdx - (catCountMap[star.category] || 1) / 2) * MATRIX_CONFIG.CARD_DEPTH_SPACING;

      positions[i * 3] = xOffset + (Math.random() - 0.5) * 1.5;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 3;
      positions[i * 3 + 2] = zPos;

      const chColor = CHANNEL_COLORS[star.category] || PALETTE.purple;
      color.set(chColor);
      // 略微变白使玻璃感更突出
      color.r = color.r * 0.7 + 0.3;
      color.g = color.g * 0.7 + 0.3;
      color.b = color.b * 0.7 + 0.3;
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = star.radius * 1.5;
      phases[i] = star.twinkleOffset;
      highlights[i] = 0;
      channels[i] = catIndex;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aChannel', new THREE.BufferAttribute(channels, 1));
    const hlAttr = new THREE.BufferAttribute(highlights, 1);
    geo.setAttribute('aHighlight', hlAttr);
    return { geometry: geo, highlightAttr: hlAttr };
  }, [stars, clusters]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uHoveredIndex: { value: -1 },
        },
        vertexShader: CARD_VERTEX,
        fragmentShader: CARD_FRAGMENT,
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
        raycasterRef.current.params.Points = { threshold: 0.7 };
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
      raycasterRef.current.params.Points = { threshold: 0.7 };
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
      raycasterRef.current.params.Points = { threshold: 0.7 };
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
      raycasterRef.current.params.Points = { threshold: 0.7 };
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

// ─── 主场景组件 ────────────────────────────────────────────

interface MatrixSceneProps {
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

export function MatrixScene({
  clusters,
  allStars,
  visible,
  matchedIds,
  hasSearch,
  onStarClick,
  onHover,
  onDoubleClick,
  onContextMenu,
}: MatrixSceneProps) {
  return (
    <Canvas
      gl={{
        antialias: false,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
      }}
      camera={{
        fov: 55,
        near: 0.1,
        far: 200,
        position: [0, 8, 30],
      }}
      style={{ background: PALETTE.bg }}
      dpr={[1, 1.5]}
    >
      <ambientLight intensity={0.04} color="#2D3055" />
      <pointLight position={[0, 15, 10]} intensity={0.4} color={PALETTE.purpleLight} distance={50} />

      <OrbitControls
        enableDamping
        dampingFactor={0.1}
        rotateSpeed={0.4}
        minDistance={10}
        maxDistance={55}
        autoRotate
        autoRotateSpeed={0.12}
      />

      {/* 通道导轨 */}
      <ChannelRails clusters={clusters} visible={visible} />

      {/* 数据流粒子 */}
      <DataStreams clusters={clusters} visible={visible} />

      {/* 卡片节点（Prompt） */}
      <MatrixCards
        stars={allStars}
        clusters={clusters}
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
          intensity={MATRIX_CONFIG.BLOOM_INTENSITY}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.15} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  );
}
