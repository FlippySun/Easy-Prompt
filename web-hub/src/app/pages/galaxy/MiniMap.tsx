/**
 * MiniMap — 迷你星图导航
 * 右下角半透明小地图，显示星团位置和相机视角指示器
 * 纯 DOM Canvas 2D 实现，不依赖 R3F
 */

import { useRef, useEffect } from 'react';
import type { CategoryCluster, CameraInfo } from './types';

interface MiniMapProps {
  clusters: CategoryCluster[];
  cameraRef: React.RefObject<CameraInfo | null>;
}

const SIZE = 110;
const HALF = SIZE / 2;
const SCALE = 1.6;

export function MiniMap({ clusters, cameraRef }: MiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio, 2);
    canvas.width = SIZE * DPR;
    canvas.height = SIZE * DPR;
    canvas.style.width = `${SIZE}px`;
    canvas.style.height = `${SIZE}px`;

    let lastDraw = 0;

    const draw = (now: number) => {
      rafRef.current = requestAnimationFrame(draw);

      // 限制到 ~15 fps 节省性能
      if (now - lastDraw < 66) return;
      lastDraw = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(DPR, DPR);

      // 背景圆
      ctx.beginPath();
      ctx.arc(HALF, HALF, HALF - 1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(3, 0, 20, 0.5)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 网格圆
      for (let r = 14; r < HALF; r += 14) {
        ctx.beginPath();
        ctx.arc(HALF, HALF, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // 十字线
      ctx.beginPath();
      ctx.moveTo(HALF, 4);
      ctx.lineTo(HALF, SIZE - 4);
      ctx.moveTo(4, HALF);
      ctx.lineTo(SIZE - 4, HALF);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // 星团标记点
      for (const cluster of clusters) {
        const x = HALF + cluster.center[0] * SCALE;
        const y = HALF + cluster.center[2] * SCALE;

        // 裁剪到圆内
        const distFromCenter = Math.hypot(x - HALF, y - HALF);
        if (distFromCenter > HALF - 4) continue;

        // 外发光
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 6);
        gradient.addColorStop(0, cluster.color + '55');
        gradient.addColorStop(1, cluster.color + '00');
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // 实心点
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = cluster.color;
        ctx.fill();
      }

      // 相机方位指示器
      const cam = cameraRef.current;
      if (cam) {
        // 投影相机位置到俯视 2D（使用球坐标 theta）
        const camDist = Math.min(cam.distance * 0.4, HALF - 8);
        const cx = HALF + Math.sin(cam.theta) * camDist;
        const cy = HALF + Math.cos(cam.theta) * camDist;

        // 视锥锥体
        const coneLen = 10;
        const coneHalfAngle = 0.45;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(
          cx - Math.sin(cam.theta + coneHalfAngle) * coneLen,
          cy - Math.cos(cam.theta + coneHalfAngle) * coneLen,
        );
        ctx.lineTo(
          cx - Math.sin(cam.theta - coneHalfAngle) * coneLen,
          cy - Math.cos(cam.theta - coneHalfAngle) * coneLen,
        );
        ctx.closePath();
        ctx.fillStyle = 'rgba(99, 102, 241, 0.12)';
        ctx.fill();

        // 相机位置点
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(129, 140, 248, 0.9)';
        ctx.fill();

        // 外圈
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(129, 140, 248, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      ctx.restore();
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [clusters, cameraRef]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none rounded-full opacity-40 transition-opacity duration-500 hover:opacity-70"
      style={{ imageRendering: 'auto' }}
    />
  );
}
