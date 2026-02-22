/**
 * Galaxy Cosmos — 统一星体渲染器
 * 使用单一 <points> + 自定义 ShaderMaterial 渲染所有 Prompt 星
 * 替代旧版 PromptNode（每星一个 mesh → N 个 draw call）
 * 现在所有星体在 1 个 draw call 中完成渲染
 */

import { useRef, useMemo, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { PromptStarData, HoverInfo } from './types';

// ─── GLSL 着色器 ──────────────────────────────────────────

const STAR_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aTwinkle;
  attribute float aFloat;
  attribute float aHighlight;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uHoveredIndex;
  uniform vec3 uMouseWorld;
  uniform float uMouseActive;

  varying vec3 vColor;
  varying float vBrightness;
  varying float vIsHovered;
  varying float vProximity;

  void main() {
    vColor = color;

    // 悬停检测（通过索引比较）
    float vertId = float(gl_VertexID);
    vIsHovered = abs(vertId - uHoveredIndex) < 0.5 ? 1.0 : 0.0;

    // 浮动动画
    vec3 pos = position;
    pos.y += sin(uTime * 0.5 + aFloat) * 0.12;

    // ─── 鼠标引力场 ───
    float distToMouse = distance(pos, uMouseWorld);
    float gravityRadius = 8.0;
    float gravityStrength = 0.4;
    float gravFactor = smoothstep(gravityRadius, 0.0, distToMouse) * uMouseActive;
    vec3 toMouse = normalize(uMouseWorld - pos + vec3(0.001));
    pos += toMouse * gravFactor * gravityStrength;

    // ─── 鼠标近距光晕 ───
    float proxRadius = 12.0;
    float proximity = smoothstep(proxRadius, 0.0, distToMouse) * uMouseActive;
    vProximity = proximity;
    float sizeBoost = 1.0 + proximity * 0.5;

    // 闪烁
    float twinkle = 0.5 + 0.5 * sin(uTime * 1.0 + aTwinkle);

    // 搜索高亮/暗淡
    float highlight = aHighlight;
    float brightMult = 1.0;
    if (highlight > 0.5) {
      brightMult = 2.8; // 搜索匹配：高亮
    } else if (highlight < -0.5) {
      brightMult = 0.12; // 搜索不匹配：暗淡
    } else {
      brightMult = twinkle * 1.2; // 正常闪烁
    }

    // Hover 加强
    if (vIsHovered > 0.5) {
      brightMult = 3.0;
    }

    vBrightness = brightMult;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // 大小衰减 + hover 放大 + 近距放大
    float sizeMult = vIsHovered > 0.5 ? 2.0 : 1.0;
    float highlightSizeMult = highlight > 0.5 ? 1.4 : 1.0;
    gl_PointSize = aSize * uPixelRatio * sizeMult * highlightSizeMult * sizeBoost * (200.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 1.5, 40.0);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vBrightness;
  varying float vIsHovered;
  varying float vProximity;

  void main() {
    // 圆形渐变辉光
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    // 柔和光晕衰减
    float glow = 1.0 - smoothstep(0.0, 0.5, dist);
    float core = 1.0 - smoothstep(0.0, 0.12, dist);

    // 合并核心（明亮） + 光晕（柔和）
    float brightness = core * 0.7 + glow * 0.4;
    brightness *= vBrightness;

    // 近距增亮
    float proxBright = 1.0 + vProximity * 0.6;
    brightness *= proxBright;

    // Hover 时增加核心亮度
    if (vIsHovered > 0.5) {
      float pulse = 0.8 + 0.2 * sin(gl_PointCoord.x * 20.0);
      brightness *= pulse;
    }

    vec3 finalColor = vColor * brightness;
    gl_FragColor = vec4(finalColor, brightness * 0.95);
  }
`;

// ─── 组件 ──────────────────────────────────────────────────

interface GalaxyStarsProps {
  stars: PromptStarData[];
  matchedIds: Set<string>;
  hasSearch: boolean;
  visible: boolean;
  onHover: (info: HoverInfo | null) => void;
  onClick: (star: PromptStarData) => void;
  onDoubleClick?: (star: PromptStarData) => void;
  onContextMenu?: (star: PromptStarData, x: number, y: number) => void;
}

export function GalaxyStars({
  stars,
  matchedIds,
  hasSearch,
  visible,
  onHover,
  onClick,
  onDoubleClick,
  onContextMenu,
}: GalaxyStarsProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const hoveredIndexRef = useRef(-1);
  const { gl, camera } = useThree();

  // 构建几何体属性
  const { geometry, highlightAttr } = useMemo(() => {
    const count = stars.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const twinkles = new Float32Array(count);
    const floats = new Float32Array(count);
    const highlights = new Float32Array(count);

    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const star = stars[i];
      positions[i * 3] = star.position[0];
      positions[i * 3 + 1] = star.position[1];
      positions[i * 3 + 2] = star.position[2];

      color.set(star.color);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = star.radius;
      twinkles[i] = star.twinkleOffset;
      floats[i] = star.floatOffset;
      highlights[i] = 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkles, 1));
    geo.setAttribute('aFloat', new THREE.BufferAttribute(floats, 1));
    const hlAttr = new THREE.BufferAttribute(highlights, 1);
    geo.setAttribute('aHighlight', hlAttr);

    return { geometry: geo, highlightAttr: hlAttr };
  }, [stars]);

  // 创建 ShaderMaterial
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uHoveredIndex: { value: -1 },
          uMouseWorld: { value: new THREE.Vector3(0, -100, 0) },
          uMouseActive: { value: 0 },
        },
        vertexShader: STAR_VERTEX,
        fragmentShader: STAR_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
      }),
    [],
  );

  // 更新材质引用
  useEffect(() => {
    materialRef.current = material;
  }, [material]);

  // 更新搜索高亮属性
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

  // 入场动画控制（通过 scale）
  const scaleRef = useRef(0);

  // 每帧更新
  useFrame(({ clock }) => {
    const mat = materialRef.current;
    const pts = pointsRef.current;
    if (!mat || !pts) return;

    mat.uniforms.uTime.value = clock.getElapsedTime();
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio();
    mat.uniforms.uHoveredIndex.value = hoveredIndexRef.current;

    // 入场缩放
    const targetScale = visible ? 1 : 0;
    scaleRef.current += (targetScale - scaleRef.current) * 0.06;
    pts.scale.setScalar(scaleRef.current);
  });

  // Raycasting — 鼠标悬停检测（节流 ~16ms）
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const rafIdRef = useRef(0);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      // 取消之前的 RAF，保证每帧最多处理一次
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

      const clientX = e.clientX;
      const clientY = e.clientY;

      rafIdRef.current = requestAnimationFrame(() => {
        const rect = gl.domElement.getBoundingClientRect();
        mouseRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        raycasterRef.current.params.Points = { threshold: 0.6 };

        // 投射鼠标射线到 y=0 平面，用于引力场和近距光晕
        const mat = materialRef.current;
        if (mat) {
          const ray = raycasterRef.current.ray;
          if (Math.abs(ray.direction.y) > 0.001) {
            const t = -ray.origin.y / ray.direction.y;
            if (t > 0) {
              const mouseWorld = mat.uniforms.uMouseWorld.value as THREE.Vector3;
              mouseWorld.copy(ray.origin).addScaledVector(ray.direction, t);
              mat.uniforms.uMouseActive.value = 1.0;
            }
          }
        }

        const pts = pointsRef.current;
        if (!pts || !visible) return;

        const intersections = raycasterRef.current.intersectObject(pts);
        if (intersections.length > 0 && intersections[0].index !== undefined) {
          const idx = intersections[0].index;
          const star = stars[idx];
          if (star) {
            hoveredIndexRef.current = idx;
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
    if (materialRef.current) {
      materialRef.current.uniforms.uMouseActive.value = 0.0;
    }
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

      const intersections = raycasterRef.current.intersectObject(pts);
      if (intersections.length > 0 && intersections[0].index !== undefined) {
        const star = stars[intersections[0].index];
        if (star) onClick(star);
      }
    },
    [stars, camera, gl, onClick, visible],
  );

  // 双击飞跃到星星
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

      const intersections = raycasterRef.current.intersectObject(pts);
      if (intersections.length > 0 && intersections[0].index !== undefined) {
        const star = stars[intersections[0].index];
        if (star) onDoubleClick(star);
      }
    },
    [stars, camera, gl, onDoubleClick, visible],
  );

  // 右键上下文菜单
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

      const intersections = raycasterRef.current.intersectObject(pts);
      if (intersections.length > 0 && intersections[0].index !== undefined) {
        const star = stars[intersections[0].index];
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
