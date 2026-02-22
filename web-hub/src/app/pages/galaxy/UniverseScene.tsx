/**
 * Universe Scene — 数字宇宙展示模式
 * 灵感: Hut 8 (https://www.hut8.com/) — Awwwards SOTD
 *
 * 视觉范式：
 * - Prompts 作为发光节点组成数据基础设施网络
 * - 8 个分类 = 8 个核心枢纽，枢纽之间有光束数据流
 * - 极简暗色背景 + 哑光金属质感 + 细线连接
 * - 色调: 极暗 (#181818) + 橄榄/金 (#BCBFB0) + 冷白高光
 */

import { useRef, useMemo, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { CategoryCluster, PromptStarData, HoverInfo } from './types';

// ─── 常量 ──────────────────────────────────────────────────

const UNIVERSE_CONFIG = {
  /** 网络半径 */
  NETWORK_RADIUS: 25,
  /** 枢纽间距 */
  HUB_SPACING: 12,
  /** 数据流线数量 */
  FLOW_LINE_COUNT: 120,
  /** 节点浮动幅度 */
  NODE_FLOAT: 0.15,
  /** 背景网格大小 */
  GRID_SIZE: 80,
  /** Bloom 强度 */
  BLOOM_INTENSITY: 1.5,
} as const;

/** Hut8 风格双色系 */
const PALETTE = {
  dark: '#181818',
  olive: '#BCBFB0',
  accent: '#D4D7C8',
  warm: '#E8E3D4',
  highlight: '#F5F2E8',
  dim: '#4a4d44',
} as const;

// ─── GLSL: 节点着色器 ─────────────────────────────────────

const NODE_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aHighlight;
  attribute float aIsHub;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uHoveredIndex;

  varying vec3 vColor;
  varying float vBrightness;
  varying float vIsHovered;
  varying float vIsHub;

  void main() {
    vColor = color;
    vIsHub = aIsHub;

    float vertId = float(gl_VertexID);
    vIsHovered = abs(vertId - uHoveredIndex) < 0.5 ? 1.0 : 0.0;

    // 微幅浮动
    vec3 pos = position;
    pos.y += sin(uTime * 0.4 + aPhase * 6.28) * ${UNIVERSE_CONFIG.NODE_FLOAT};
    pos.x += cos(uTime * 0.3 + aPhase * 4.0) * ${UNIVERSE_CONFIG.NODE_FLOAT} * 0.5;

    float highlight = aHighlight;
    float brightMult = 1.0;
    if (highlight > 0.5) {
      brightMult = 3.5;
    } else if (highlight < -0.5) {
      brightMult = 0.05;
    } else {
      // 枢纽节点更亮
      float base = aIsHub > 0.5 ? 1.4 : 0.8;
      brightMult = base + 0.2 * sin(uTime * 0.6 + aPhase * 3.0);
    }

    if (vIsHovered > 0.5) {
      brightMult = 4.0;
    }

    vBrightness = brightMult;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    float hubScale = aIsHub > 0.5 ? 1.8 : 1.0;
    float hoverScale = vIsHovered > 0.5 ? 2.0 : 1.0;
    gl_PointSize = aSize * uPixelRatio * hubScale * hoverScale * (200.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 1.5, 45.0);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const NODE_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vBrightness;
  varying float vIsHovered;
  varying float vIsHub;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    // 极简几何形态：菱形/正方形混合
    float diamond = abs(center.x) + abs(center.y);
    float shape = mix(dist, diamond * 0.707, vIsHub * 0.4);

    float core = 1.0 - smoothstep(0.0, 0.15, shape);
    float glow = 1.0 - smoothstep(0.0, 0.5, shape);

    float brightness = core * 0.9 + glow * 0.2;
    brightness *= vBrightness;

    // Hover 环
    if (vIsHovered > 0.5) {
      float ring = smoothstep(0.2, 0.25, dist) * (1.0 - smoothstep(0.25, 0.3, dist));
      brightness += ring * 2.5;
    }

    vec3 finalColor = vColor * brightness;
    gl_FragColor = vec4(finalColor, brightness * 0.95);
  }
`;

// ─── 数据流光束 ────────────────────────────────────────────

function DataFlowLines({ clusters, visible }: { clusters: CategoryCluster[]; visible: boolean }) {
  const meshRef = useRef<THREE.LineSegments>(null);
  const opacityRef = useRef(0);

  const { geometry, material } = useMemo(() => {
    // 在枢纽之间创建连接线
    const positions: number[] = [];
    const colors: number[] = [];
    const hubPositions = clusters.map((_, i) => {
      const angle = (i / clusters.length) * Math.PI * 2;
      const r = UNIVERSE_CONFIG.HUB_SPACING;
      return new THREE.Vector3(
        Math.cos(angle) * r,
        (Math.random() - 0.5) * 4,
        Math.sin(angle) * r,
      );
    });

    const baseColor = new THREE.Color(PALETTE.olive);
    const dimColor = new THREE.Color(PALETTE.dim);

    // 枢纽间连接
    for (let i = 0; i < hubPositions.length; i++) {
      for (let j = i + 1; j < hubPositions.length; j++) {
        // 不是每对都连，跳过一些
        if (Math.random() > 0.6) continue;
        const a = hubPositions[i];
        const b = hubPositions[j];
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        colors.push(baseColor.r, baseColor.g, baseColor.b, dimColor.r, dimColor.g, dimColor.b);
      }
    }

    // 额外的随机装饰线
    for (let i = 0; i < UNIVERSE_CONFIG.FLOW_LINE_COUNT; i++) {
      const hubIdx = Math.floor(Math.random() * hubPositions.length);
      const hub = hubPositions[hubIdx];
      const endPoint = new THREE.Vector3(
        hub.x + (Math.random() - 0.5) * 15,
        hub.y + (Math.random() - 0.5) * 8,
        hub.z + (Math.random() - 0.5) * 15,
      );
      positions.push(hub.x, hub.y, hub.z, endPoint.x, endPoint.y, endPoint.z);
      const lineColor = Math.random() > 0.7 ? baseColor : dimColor;
      colors.push(lineColor.r, lineColor.g, lineColor.b, dimColor.r * 0.3, dimColor.g * 0.3, dimColor.b * 0.3);
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
    const target = visible ? 0.25 : 0;
    opacityRef.current += (target - opacityRef.current) * 0.05;
    material.opacity = opacityRef.current;
  });

  return <lineSegments ref={meshRef} geometry={geometry} material={material} />;
}

// ─── 背景网格 ──────────────────────────────────────────────

function BackgroundGrid() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vec2 grid = abs(fract(vUv * 30.0 - 0.5) - 0.5) / fwidth(vUv * 30.0);
            float line = min(grid.x, grid.y);
            float gridAlpha = 1.0 - min(line, 1.0);
            gridAlpha *= 0.03;

            // 脉冲波纹
            float pulse = sin(length(vUv - 0.5) * 20.0 - uTime * 0.5) * 0.5 + 0.5;
            gridAlpha += pulse * 0.005;

            vec3 gridColor = vec3(0.74, 0.75, 0.69); // PALETTE.olive
            gl_FragColor = vec4(gridColor, gridAlpha);
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

  const size = UNIVERSE_CONFIG.GRID_SIZE;
  return (
    <mesh position={[0, -8, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <planeGeometry args={[size, size, 1, 1]} />
    </mesh>
  );
}

// ─── 节点组件 ──────────────────────────────────────────────

interface DataNodesProps {
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

function DataNodes({
  stars,
  clusters,
  matchedIds,
  hasSearch,
  visible,
  onHover,
  onClick,
  onDoubleClick,
  onContextMenu,
}: DataNodesProps) {
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
    const isHub = new Float32Array(count);
    const color = new THREE.Color();

    const catIds = clusters.map((c) => c.id);

    for (let i = 0; i < count; i++) {
      const star = stars[i];
      const catIndex = catIds.indexOf(star.category);

      // 枢纽布局：分类按圆环排列，内部星体在枢纽周围散布
      const hubAngle = (catIndex / catIds.length) * Math.PI * 2;
      const hubR = UNIVERSE_CONFIG.HUB_SPACING;
      const hubX = Math.cos(hubAngle) * hubR;
      const hubZ = Math.sin(hubAngle) * hubR;

      // 找出该分类中这个星的局部索引
      const catStars = clusters[catIndex]?.stars || [];
      const localIdx = catStars.indexOf(star);
      const isHubNode = localIdx === 0; // 每个分类的第一颗是枢纽节点

      if (isHubNode) {
        positions[i * 3] = hubX;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 2;
        positions[i * 3 + 2] = hubZ;
      } else {
        // 围绕枢纽散布
        const spread = 5 + Math.random() * 3;
        const angle = Math.random() * Math.PI * 2;
        const vertSpread = (Math.random() - 0.5) * 6;
        positions[i * 3] = hubX + Math.cos(angle) * spread * Math.random();
        positions[i * 3 + 1] = vertSpread;
        positions[i * 3 + 2] = hubZ + Math.sin(angle) * spread * Math.random();
      }

      // Hut8 风格：橄榄/金/冷白色系
      const warmth = Math.random();
      if (isHubNode) {
        color.set(PALETTE.highlight);
      } else if (warmth > 0.7) {
        color.set(PALETTE.accent);
      } else if (warmth > 0.3) {
        color.set(PALETTE.olive);
      } else {
        color.set(PALETTE.dim);
      }
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = isHubNode ? star.radius * 2.0 : star.radius;
      phases[i] = star.twinkleOffset;
      highlights[i] = 0;
      isHub[i] = isHubNode ? 1 : 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aIsHub', new THREE.BufferAttribute(isHub, 1));
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
        vertexShader: NODE_VERTEX,
        fragmentShader: NODE_FRAGMENT,
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
        raycasterRef.current.params.Points = { threshold: 0.6 };
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
      raycasterRef.current.params.Points = { threshold: 0.6 };
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
      raycasterRef.current.params.Points = { threshold: 0.6 };
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
      raycasterRef.current.params.Points = { threshold: 0.6 };
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

interface UniverseSceneProps {
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

export function UniverseScene({
  clusters,
  allStars,
  visible,
  matchedIds,
  hasSearch,
  onStarClick,
  onHover,
  onDoubleClick,
  onContextMenu,
}: UniverseSceneProps) {
  return (
    <Canvas
      gl={{
        antialias: false,
        toneMapping: THREE.NoToneMapping,
      }}
      camera={{
        fov: 55,
        near: 0.1,
        far: 200,
        position: [0, 12, 35],
      }}
      style={{ background: PALETTE.dark }}
      dpr={[1, 1.5]}
    >
      <ambientLight intensity={0.05} />
      <pointLight position={[0, 20, 0]} intensity={0.3} color={PALETTE.olive} distance={60} />

      <OrbitControls
        enableDamping
        dampingFactor={0.1}
        rotateSpeed={0.4}
        minDistance={12}
        maxDistance={60}
        autoRotate
        autoRotateSpeed={0.08}
        maxPolarAngle={Math.PI * 0.75}
      />

      {/* 背景网格 */}
      <BackgroundGrid />

      {/* 数据流连接线 */}
      <DataFlowLines clusters={clusters} visible={visible} />

      {/* 数据节点（Prompt） */}
      <DataNodes
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
          intensity={UNIVERSE_CONFIG.BLOOM_INTENSITY}
          luminanceThreshold={0.25}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.2} darkness={0.8} />
      </EffectComposer>
    </Canvas>
  );
}
