/**
 * Galaxy Cosmos — 智能相机系统
 *
 * 特性：
 * - 空闲自动缓慢旋转（屏保感）
 * - 鼠标拖拽轨道旋转（惯性衰减）
 * - 滚轮平滑缩放（速度与距离成正比）
 * - 分类飞跃动画（ease-in-out 缓动）
 * - 触屏支持（单指拖拽 + 双指缩放）
 * - HUD 缩放按钮桥接（CustomEvent）
 */

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { COSMOS_CONFIG } from './types';
import type { CameraInfo } from './types';

interface CameraRigProps {
  flyTarget: [number, number, number] | null;
  onFlyComplete: () => void;
  enabled: boolean;
  initialDistance?: number;
  cameraInfoRef?: React.RefObject<CameraInfo | null>;
}

export function CameraRig({ flyTarget, onFlyComplete, enabled, initialDistance, cameraInfoRef }: CameraRigProps) {
  const { camera, gl } = useThree();

  // 轨道状态
  const targetRef = useRef(new THREE.Vector3(0, 0, 0));
  const distanceRef = useRef(initialDistance ?? COSMOS_CONFIG.INITIAL_DISTANCE);
  const phiRef = useRef(Math.PI / 3.5); // 俯仰（稍微更高俯视，看到银河形状）
  const thetaRef = useRef(0); // 方位

  // 交互状态
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const velocityRef = useRef({ dTheta: 0, dPhi: 0 });
  const touchDistRef = useRef(0);

  // 飞跃状态
  const flyProgressRef = useRef(0);
  const flyFromRef = useRef(new THREE.Vector3());
  const flyFromDistRef = useRef(0);
  const flyFromPhiRef = useRef(0);
  const flyFromThetaRef = useRef(0);
  const isFlyingRef = useRef(false);

  // 自动旋转
  const autoRotateActiveRef = useRef(true);
  const lastInteractionRef = useRef(0);

  // 飞跃目标更新
  useEffect(() => {
    if (flyTarget) {
      flyFromRef.current.copy(targetRef.current);
      flyFromDistRef.current = distanceRef.current;
      flyFromPhiRef.current = phiRef.current;
      flyFromThetaRef.current = thetaRef.current;
      flyProgressRef.current = 0;
      isFlyingRef.current = true;
      autoRotateActiveRef.current = false;
    }
  }, [flyTarget]);

  // 鼠标/触屏事件
  useEffect(() => {
    if (!enabled) return;
    const canvas = gl.domElement;

    const markInteraction = () => {
      lastInteractionRef.current = performance.now();
      autoRotateActiveRef.current = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (isFlyingRef.current) return;
      isDraggingRef.current = true;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      velocityRef.current = { dTheta: 0, dPhi: 0 };
      markInteraction();
      window.dispatchEvent(new CustomEvent('galaxy-drag', { detail: true }));
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current || isFlyingRef.current) return;
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };

      const sensitivity = 0.003;
      const dTheta = -dx * sensitivity;
      const dPhi = -dy * sensitivity;
      thetaRef.current += dTheta;
      phiRef.current = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, phiRef.current + dPhi));

      velocityRef.current = { dTheta, dPhi };
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
      window.dispatchEvent(new CustomEvent('galaxy-drag', { detail: false }));
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isFlyingRef.current) return;
      markInteraction();
      const zoomSpeed = 0.001 * distanceRef.current;
      distanceRef.current = Math.max(
        COSMOS_CONFIG.MIN_DISTANCE,
        Math.min(COSMOS_CONFIG.MAX_DISTANCE, distanceRef.current + e.deltaY * zoomSpeed),
      );
    };

    // 触屏
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchDistRef.current = Math.hypot(dx, dy);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const newDist = Math.hypot(dx, dy);
        const delta = touchDistRef.current - newDist;
        distanceRef.current = Math.max(
          COSMOS_CONFIG.MIN_DISTANCE,
          Math.min(COSMOS_CONFIG.MAX_DISTANCE, distanceRef.current + delta * 0.05),
        );
        touchDistRef.current = newDist;
        markInteraction();
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
    };
  }, [enabled, gl]);

  // 键盘控制
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isFlyingRef.current) return;
      lastInteractionRef.current = performance.now();
      autoRotateActiveRef.current = false;

      const panSpeed = 0.04;
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
          thetaRef.current += panSpeed;
          break;
        case 'ArrowRight':
        case 'd':
          thetaRef.current -= panSpeed;
          break;
        case 'ArrowUp':
        case 'w':
          phiRef.current = Math.max(0.15, phiRef.current - panSpeed);
          break;
        case 'ArrowDown':
        case 's':
          phiRef.current = Math.min(Math.PI / 2 - 0.05, phiRef.current + panSpeed);
          break;
        case '=':
        case '+':
          distanceRef.current = Math.max(COSMOS_CONFIG.MIN_DISTANCE, distanceRef.current - 2);
          break;
        case '-':
          distanceRef.current = Math.min(COSMOS_CONFIG.MAX_DISTANCE, distanceRef.current + 2);
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);

  // HUD 缩放按钮桥接
  useEffect(() => {
    const onZoom = (e: Event) => {
      if (isFlyingRef.current) return;
      const delta = (e as CustomEvent<number>).detail;
      distanceRef.current = Math.max(
        COSMOS_CONFIG.MIN_DISTANCE,
        Math.min(COSMOS_CONFIG.MAX_DISTANCE, distanceRef.current + delta),
      );
    };
    const onZoomReset = () => {
      if (isFlyingRef.current) return;
      distanceRef.current = initialDistance ?? COSMOS_CONFIG.INITIAL_DISTANCE;
      targetRef.current.set(0, 0, 0);
      phiRef.current = Math.PI / 3.5;
      thetaRef.current = 0;
      autoRotateActiveRef.current = true;
    };

    window.addEventListener('galaxy-zoom', onZoom);
    window.addEventListener('galaxy-zoom-reset', onZoomReset);
    return () => {
      window.removeEventListener('galaxy-zoom', onZoom);
      window.removeEventListener('galaxy-zoom-reset', onZoomReset);
    };
  }, [initialDistance]);

  // 每帧更新
  useFrame((_state, delta) => {
    // 飞跃动画
    if (isFlyingRef.current && flyTarget) {
      flyProgressRef.current += delta * 1.2;
      const t = Math.min(flyProgressRef.current, 1);
      // ease-in-out cubic
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      const dest = new THREE.Vector3(...flyTarget);
      targetRef.current.lerpVectors(flyFromRef.current, dest, eased);
      distanceRef.current = flyFromDistRef.current + (14 - flyFromDistRef.current) * eased;

      if (t >= 1) {
        isFlyingRef.current = false;
        onFlyComplete();
      }
    }

    // 惯性衰减
    if (!isDraggingRef.current && !isFlyingRef.current) {
      velocityRef.current.dTheta *= 0.93;
      velocityRef.current.dPhi *= 0.93;
      thetaRef.current += velocityRef.current.dTheta;
      const newPhi = phiRef.current + velocityRef.current.dPhi;
      phiRef.current = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, newPhi));
    }

    // 自动旋转（空闲 5 秒后启动）
    if (!isFlyingRef.current && !isDraggingRef.current) {
      const idleTime = performance.now() - lastInteractionRef.current;
      if (idleTime > 5000) {
        autoRotateActiveRef.current = true;
      }
      if (autoRotateActiveRef.current) {
        thetaRef.current += COSMOS_CONFIG.AUTO_ROTATE_SPEED * delta;
      }
    }

    // 球面坐标 → 笛卡尔
    const target = targetRef.current;
    const dist = distanceRef.current;
    const phi = phiRef.current;
    const theta = thetaRef.current;

    camera.position.set(
      target.x + dist * Math.sin(phi) * Math.cos(theta),
      target.y + dist * Math.cos(phi),
      target.z + dist * Math.sin(phi) * Math.sin(theta),
    );
    camera.lookAt(target);

    // 写入相机信息供 MiniMap 使用
    if (cameraInfoRef && 'current' in cameraInfoRef) {
      (cameraInfoRef as React.MutableRefObject<CameraInfo | null>).current = {
        theta,
        phi,
        distance: dist,
        target: { x: target.x, y: target.y, z: target.z },
      };
    }
  });

  return null;
}
