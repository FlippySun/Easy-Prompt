/**
 * Planet Scene — 微型星球展示模式
 * 灵感: Abeto Messenger (https://messenger.abeto.co/)
 *
 * 视觉范式：
 * - Prompts 散布在一个球形星球表面，像一个微缩世界
 * - 8 个分类 = 8 个地形区域（不同颜色扇区）
 * - 相机围绕星球轨道旋转，可拖拽查看不同角度
 * - 温暖柔和的色彩 + 手绘轮廓效果
 * - 星球表面有地形起伏和植被装饰
 */

import { useRef, useMemo, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { CategoryCluster, PromptStarData, HoverInfo } from './types';

// ─── 常量 ──────────────────────────────────────────────────

const PLANET_CONFIG = {
  /** 星球半径 */
  RADIUS: 12,
  /** Prompt 标记物浮空高度 */
  MARKER_HEIGHT: 0.8,
  /** 大气层厚度 */
  ATMOSPHERE_SCALE: 1.12,
  /** 地形噪声强度 */
  TERRAIN_NOISE: 0.4,
  /** 自动旋转速度 */
  AUTO_ROTATE_SPEED: 0.15,
  /** 云层粒子数 */
  CLOUD_COUNT: 200,
} as const;

/** 分类区域配色（温暖柔和的色调） */
const BIOME_COLORS: Record<string, { ground: string; accent: string }> = {
  coding: { ground: '#2d5a27', accent: '#6dd863' },
  writing: { ground: '#6b4c2a', accent: '#d4a574' },
  marketing: { ground: '#8b3a62', accent: '#e88cb8' },
  art: { ground: '#5c2d82', accent: '#b47ee5' },
  productivity: { ground: '#2a5470', accent: '#5eb8d4' },
  education: { ground: '#7a6b2a', accent: '#d4c75e' },
  business: { ground: '#3d4a6b', accent: '#8b9fd4' },
  life: { ground: '#2a7a5a', accent: '#5ed4a8' },
};

// ─── GLSL: Prompt 标记物着色器 ─────────────────────────────

const MARKER_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aHighlight;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uHoveredIndex;

  varying vec3 vColor;
  varying float vBrightness;
  varying float vIsHovered;

  void main() {
    vColor = color;

    float vertId = float(gl_VertexID);
    vIsHovered = abs(vertId - uHoveredIndex) < 0.5 ? 1.0 : 0.0;

    // 呼吸动画
    vec3 pos = position;
    float breathe = sin(uTime * 0.6 + aPhase * 6.28) * 0.08;
    pos = pos * (1.0 + breathe);

    float highlight = aHighlight;
    float brightMult = 1.0;
    if (highlight > 0.5) {
      brightMult = 3.0;
    } else if (highlight < -0.5) {
      brightMult = 0.1;
    } else {
      brightMult = 0.7 + 0.3 * sin(uTime * 0.5 + aPhase * 3.14);
    }

    if (vIsHovered > 0.5) {
      brightMult = 3.5;
    }

    vBrightness = brightMult;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    float sizeMult = vIsHovered > 0.5 ? 2.0 : 1.0;
    gl_PointSize = aSize * uPixelRatio * sizeMult * (180.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 2.0, 35.0);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const MARKER_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vBrightness;
  varying float vIsHovered;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    // 手绘风格：不完美的圆形
    float wobble = sin(atan(center.y, center.x) * 5.0) * 0.03;
    float edge = smoothstep(0.4 + wobble, 0.5 + wobble, dist);

    // 内部填充 + 边缘轮廓
    float fill = 1.0 - smoothstep(0.0, 0.35, dist);
    float outline = smoothstep(0.33, 0.38, dist) * (1.0 - smoothstep(0.42, 0.48, dist));

    float brightness = (fill * 0.6 + outline * 1.2) * vBrightness;

    // Hover 光晕
    if (vIsHovered > 0.5) {
      float ring = 1.0 - smoothstep(0.0, 0.5, dist);
      brightness += ring * 0.5;
    }

    vec3 finalColor = vColor * brightness;
    float alpha = (1.0 - edge) * brightness;

    gl_FragColor = vec4(finalColor, alpha * 0.95);
  }
`;

// ─── 星球表面 ──────────────────────────────────────────────

function PlanetSphere({ clusters }: { clusters: CategoryCluster[] }) {
  const meshRef = useRef<THREE.Mesh>(null);

  const material = useMemo(() => {
    // 按分类扇区着色
    const catColors = clusters.map((c) => {
      const biome = BIOME_COLORS[c.id] || { ground: '#3a5a3a', accent: '#7ad47a' };
      return new THREE.Color(biome.ground);
    });

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColors: { value: catColors },
        uCatCount: { value: catColors.length },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying vec2 vUv;
        uniform float uTime;

        // 简易噪声
        float hash(vec3 p) {
          p = fract(p * vec3(123.34, 456.21, 789.92));
          p += dot(p, p.yzx + 19.19);
          return fract((p.x + p.y) * p.z);
        }

        float noise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float n = mix(
            mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
            f.z
          );
          return n;
        }

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vUv = uv;

          // 地形起伏
          vec3 pos = position;
          float n = noise(pos * 2.0) * ${PLANET_CONFIG.TERRAIN_NOISE};
          pos += normal * n;

          vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying vec2 vUv;

        uniform float uTime;
        uniform vec3 uColors[8];
        uniform int uCatCount;

        void main() {
          // 根据球面经度划分区域
          float angle = atan(vWorldPos.z, vWorldPos.x);
          float normalizedAngle = (angle + 3.14159) / (2.0 * 3.14159);
          int sector = int(normalizedAngle * float(uCatCount));
          sector = min(sector, uCatCount - 1);

          vec3 baseColor = uColors[sector];

          // 简单光照
          vec3 lightDir = normalize(vec3(1.0, 1.5, 0.8));
          float diff = max(dot(vNormal, lightDir), 0.0);
          float ambient = 0.25;

          vec3 finalColor = baseColor * (ambient + diff * 0.75);

          // 手绘纹理感
          float grain = fract(sin(dot(vUv * 200.0, vec2(12.9898, 78.233))) * 43758.5453);
          finalColor += (grain - 0.5) * 0.04;

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });
  }, [clusters]);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime();
    // 星球本身缓慢自转
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.0005;
    }
  });

  return (
    <mesh ref={meshRef} material={material}>
      <sphereGeometry args={[PLANET_CONFIG.RADIUS, 64, 48]} />
    </mesh>
  );
}

// ─── 大气层光晕 ────────────────────────────────────────────

function Atmosphere() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: /* glsl */ `
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vViewDir = normalize(cameraPosition - worldPos.xyz);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
            rim = pow(rim, 3.0);
            vec3 atmosColor = vec3(0.4, 0.7, 1.0);
            gl_FragColor = vec4(atmosColor, rim * 0.5);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
      }),
    [],
  );

  return (
    <mesh material={material}>
      <sphereGeometry args={[PLANET_CONFIG.RADIUS * PLANET_CONFIG.ATMOSPHERE_SCALE, 32, 32]} />
    </mesh>
  );
}

// ─── 云层 ──────────────────────────────────────────────────

function Clouds() {
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, material } = useMemo(() => {
    const count = PLANET_CONFIG.CLOUD_COUNT;
    const positions = new Float32Array(count * 3);
    const cloudRadius = PLANET_CONFIG.RADIUS * 1.04;

    for (let i = 0; i < count; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      positions[i * 3] = cloudRadius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = cloudRadius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = cloudRadius * Math.cos(phi);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.8,
      transparent: true,
      opacity: 0.15,
      color: '#ffffff',
      depthWrite: false,
      blending: THREE.NormalBlending,
      sizeAttenuation: true,
    });

    return { geometry: geo, material: mat };
  }, []);

  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.0003;
    }
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

// ─── Prompt 地表标记物 ────────────────────────────────────

interface PlanetMarkersProps {
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

function PlanetMarkers({
  stars,
  positions,
  matchedIds,
  hasSearch,
  visible,
  onHover,
  onClick,
  onDoubleClick,
  onContextMenu,
}: PlanetMarkersProps) {
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
    const highlights = new Float32Array(count);
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      posArr[i * 3] = positions[i * 3];
      posArr[i * 3 + 1] = positions[i * 3 + 1];
      posArr[i * 3 + 2] = positions[i * 3 + 2];

      const biome = BIOME_COLORS[stars[i].category] || { accent: '#7ad47a' };
      color.set(biome.accent);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = stars[i].radius * 1.2;
      phases[i] = stars[i].twinkleOffset;
      highlights[i] = 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
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
        vertexShader: MARKER_VERTEX,
        fragmentShader: MARKER_FRAGMENT,
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
        raycasterRef.current.params.Points = { threshold: 0.5 };
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
      raycasterRef.current.params.Points = { threshold: 0.5 };
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
      raycasterRef.current.params.Points = { threshold: 0.5 };
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
      raycasterRef.current.params.Points = { threshold: 0.5 };
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

// ─── 星球布局计算 ──────────────────────────────────────────

/** 将 Prompts 按分类均匀分布到球面各扇区 */
export function computePlanetPositions(clusters: CategoryCluster[]): Float32Array {
  const allStars: PromptStarData[] = [];
  for (const c of clusters) {
    for (const s of c.stars) {
      allStars.push(s);
    }
  }

  const positions = new Float32Array(allStars.length * 3);
  const catIds = clusters.map((c) => c.id);
  const r = PLANET_CONFIG.RADIUS + PLANET_CONFIG.MARKER_HEIGHT;

  for (let i = 0; i < allStars.length; i++) {
    const star = allStars[i];
    const catIndex = catIds.indexOf(star.category);
    const catCount = catIds.length;

    // 扇区经度范围
    const sectorStart = (catIndex / catCount) * Math.PI * 2;
    const sectorEnd = ((catIndex + 1) / catCount) * Math.PI * 2;

    // 在扇区内随机分布
    const theta = sectorStart + Math.random() * (sectorEnd - sectorStart);
    const phi = Math.acos(2 * Math.random() - 1); // 均匀球面采样

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }

  return positions;
}

// ─── 背景星空（简单粒子） ─────────────────────────────────

function BackgroundStars() {
  const { geometry, material } = useMemo(() => {
    const count = 800;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 60 + Math.random() * 40;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.3,
      transparent: true,
      opacity: 0.6,
      color: '#ffffff',
      sizeAttenuation: true,
    });
    return { geometry: geo, material: mat };
  }, []);

  return <points geometry={geometry} material={material} />;
}

// ─── 主场景组件 ────────────────────────────────────────────

interface PlanetSceneProps {
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

export function PlanetScene({
  clusters,
  allStars,
  visible,
  matchedIds,
  hasSearch,
  onStarClick,
  onHover,
  onDoubleClick,
  onContextMenu,
}: PlanetSceneProps) {
  const positions = useMemo(() => computePlanetPositions(clusters), [clusters]);

  return (
    <Canvas
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
      camera={{
        fov: 50,
        near: 0.1,
        far: 200,
        position: [0, 8, 30],
      }}
      style={{ background: '#0a0a1a' }}
      dpr={[1, 1.5]}
    >
      {/* 光照 */}
      <ambientLight intensity={0.15} />
      <directionalLight position={[10, 15, 8]} intensity={1.0} color="#fff5e6" />
      <pointLight position={[-8, -5, 10]} intensity={0.3} color="#6b9fff" />

      {/* 轨道控制 */}
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.5}
        minDistance={16}
        maxDistance={55}
        autoRotate
        autoRotateSpeed={PLANET_CONFIG.AUTO_ROTATE_SPEED}
      />

      {/* 背景星空 */}
      <BackgroundStars />

      {/* 星球本体 */}
      <PlanetSphere clusters={clusters} />

      {/* 大气层 */}
      <Atmosphere />

      {/* 云层 */}
      <Clouds />

      {/* Prompt 标记物 */}
      <PlanetMarkers
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
        <Bloom intensity={1.2} luminanceThreshold={0.3} luminanceSmoothing={0.8} mipmapBlur />
        <Vignette eskil={false} offset={0.15} darkness={0.7} />
      </EffectComposer>
    </Canvas>
  );
}
