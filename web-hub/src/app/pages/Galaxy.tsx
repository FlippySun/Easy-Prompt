import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { X, ZoomIn, ZoomOut, RefreshCw, Telescope, MousePointer2 } from 'lucide-react';
import { MOCK_PROMPTS, type Prompt } from '../data/prompts';
import { PromptDetailDrawer } from '../components/PromptDetailDrawer';
import { CATEGORY_CONFIG } from '../data/constants';

// ─── Data ────────────────────────────────────────────────────────────────────

// 从集中 CATEGORY_CONFIG 派生
const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_CONFIG).map(([k, v]) => [k, v.color]),
);

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_CONFIG).map(([k, v]) => [k, `${v.emoji} ${v.label}`]),
);

// Virtual world: 4000 × 3000 units
const CLUSTER_POS: Record<string, { x: number; y: number }> = {
  coding: { x: 2900, y: 550 },
  writing: { x: 650, y: 480 },
  marketing: { x: 2600, y: 1600 },
  art: { x: 3100, y: 2200 },
  productivity: { x: 1550, y: 1250 },
  education: { x: 520, y: 2050 },
  business: { x: 2050, y: 750 },
  life: { x: 680, y: 2600 },
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface PromptStar {
  x: number;
  y: number;
  radius: number;
  color: string;
  prompt: Prompt;
  twinkleOffset: number;
  twinkleSpeed: number;
  pulseOffset: number;
}

interface BgStar {
  x: number;
  y: number;
  r: number;
  opacity: number;
  twinkle: number;
}

interface ShootingStar {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Galaxy Component ─────────────────────────────────────────────────────────

export function Galaxy() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<PromptStar[]>([]);
  const bgStarsRef = useRef<BgStar[]>([]);
  const shootingRef = useRef<ShootingStar[]>([]);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(0.22);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastPanRef = useRef({ x: 0, y: 0 });
  const hoveredRef = useRef<Prompt | null>(null);
  const rafRef = useRef(0);
  const hasDraggedRef = useRef(false);

  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Prompt stars
    starsRef.current = MOCK_PROMPTS.map((p) => {
      const c = CLUSTER_POS[p.category] ?? { x: 2000, y: 1500 };
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 220;
      return {
        x: c.x + Math.cos(angle) * dist,
        y: c.y + Math.sin(angle) * dist,
        radius: 7 + (p.likes / 280) * 11,
        color: CATEGORY_COLORS[p.category] ?? '#6366f1',
        prompt: p,
        twinkleOffset: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.6 + Math.random() * 1.2,
        pulseOffset: Math.random() * Math.PI * 2,
      };
    });

    // Background stars
    bgStarsRef.current = Array.from({ length: 400 }, () => ({
      x: Math.random() * 4000,
      y: Math.random() * 3000,
      r: 0.4 + Math.random() * 1.8,
      opacity: 0.2 + Math.random() * 0.8,
      twinkle: Math.random() * Math.PI * 2,
    }));

    // Shooting stars pool
    shootingRef.current = Array.from({ length: 4 }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
    }));

    setReady(true);
  }, []);

  // ── Canvas resize ───────────────────────────────────────────────────────────
  useEffect(() => {
    const resize = () => {
      if (!canvasRef.current) return;
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
      // Center on world
      panRef.current = {
        x: window.innerWidth / 2 - 2000 * zoomRef.current,
        y: window.innerHeight / 2 - 1500 * zoomRef.current,
      };
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ── Render loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = (ts: number) => {
      const t = ts / 1000;
      const { x: px, y: py } = panRef.current;
      const z = zoomRef.current;
      const W = canvas.width;
      const H = canvas.height;

      // ── Background ─────────────────────────────────────────────────────────
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H));
      bg.addColorStop(0, '#080820');
      bg.addColorStop(1, '#020210');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── World-space drawing ────────────────────────────────────────────────
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(z, z);

      // Nebula clouds (per category)
      Object.entries(CLUSTER_POS).forEach(([cat, pos]) => {
        const col = CATEGORY_COLORS[cat] ?? '#6366f1';
        for (let i = 0; i < 3; i++) {
          const pulseFactor = 1 + 0.05 * Math.sin(t * 0.4 + i * 2.1);
          const grad = ctx.createRadialGradient(
            pos.x + i * 30,
            pos.y + i * 20,
            0,
            pos.x + i * 30,
            pos.y + i * 20,
            280 * pulseFactor,
          );
          grad.addColorStop(0, col + '28');
          grad.addColorStop(0.5, col + '10');
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(pos.x + i * 30, pos.y + i * 20, 280 * pulseFactor, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Background stars (with twinkle)
      bgStarsRef.current.forEach((s) => {
        const tw = 0.5 + 0.5 * Math.sin(t + s.twinkle);
        ctx.globalAlpha = s.opacity * (0.4 + 0.6 * tw);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Constellation lines (same-category neighbors)
      const catGroups: Record<string, PromptStar[]> = {};
      starsRef.current.forEach((s) => {
        const cat = s.prompt.category;
        if (!catGroups[cat]) catGroups[cat] = [];
        catGroups[cat].push(s);
      });

      Object.values(catGroups).forEach((group) => {
        for (let i = 0; i < group.length - 1; i++) {
          const a = group[i],
            b = group[i + 1];
          const dx = b.x - a.x,
            dy = b.y - a.y;
          if (Math.sqrt(dx * dx + dy * dy) < 280) {
            ctx.globalAlpha = 0.1;
            ctx.strokeStyle = a.color;
            ctx.lineWidth = 0.6;
            ctx.setLineDash([5, 10]);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
          }
        }
      });

      // Prompt stars
      starsRef.current.forEach((star) => {
        const tw = 0.88 + 0.12 * Math.sin(t * star.twinkleSpeed + star.twinkleOffset);
        const pulse = 1 + 0.08 * Math.sin(t * 0.9 + star.pulseOffset);
        const isHov = hoveredRef.current?.id === star.prompt.id;
        const r = star.radius * pulse * (isHov ? 1.5 : 1);

        // Outer aura
        const aura = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, r * (isHov ? 5 : 4));
        aura.addColorStop(0, star.color + 'aa');
        aura.addColorStop(0.4, star.color + '44');
        aura.addColorStop(1, 'transparent');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(star.x, star.y, r * (isHov ? 5 : 4), 0, Math.PI * 2);
        ctx.fill();

        // Core gradient
        const core = ctx.createRadialGradient(star.x - r * 0.3, star.y - r * 0.3, 0, star.x, star.y, r);
        core.addColorStop(0, '#ffffff');
        core.addColorStop(0.25, star.color + 'ff');
        core.addColorStop(1, star.color + '99');
        ctx.globalAlpha = tw;
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(star.x, star.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Cross glint
        const gAlpha = isHov ? 0.65 : 0.3;
        const gLen = r * (isHov ? 3 : 2);
        ctx.globalAlpha = gAlpha * tw;
        const glintGrad = ctx.createLinearGradient(star.x - gLen, star.y, star.x + gLen, star.y);
        glintGrad.addColorStop(0, 'transparent');
        glintGrad.addColorStop(0.5, '#ffffff');
        glintGrad.addColorStop(1, 'transparent');
        ctx.strokeStyle = glintGrad;
        ctx.lineWidth = isHov ? 1.5 : 0.8;
        ctx.beginPath();
        ctx.moveTo(star.x - gLen, star.y);
        ctx.lineTo(star.x + gLen, star.y);
        ctx.stroke();
        const glintGradV = ctx.createLinearGradient(star.x, star.y - gLen, star.x, star.y + gLen);
        glintGradV.addColorStop(0, 'transparent');
        glintGradV.addColorStop(0.5, '#ffffff');
        glintGradV.addColorStop(1, 'transparent');
        ctx.strokeStyle = glintGradV;
        ctx.beginPath();
        ctx.moveTo(star.x, star.y - gLen);
        ctx.lineTo(star.x, star.y + gLen);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Hover tooltip
        if (isHov) {
          const label = star.prompt.title;
          const fs = 13;
          ctx.font = `500 ${fs}px -apple-system, system-ui, sans-serif`;
          const tw2 = ctx.measureText(label).width;
          const pad = 10;
          const bw = tw2 + pad * 2;
          const bh = 30;
          const bx = star.x - bw / 2;
          const by = star.y - r * 5 - bh - 6;

          ctx.fillStyle = 'rgba(5, 5, 20, 0.92)';
          roundRect(ctx, bx, by, bw, bh, 8);
          ctx.fill();
          ctx.strokeStyle = star.color + '90';
          ctx.lineWidth = 1;
          roundRect(ctx, bx, by, bw, bh, 8);
          ctx.stroke();

          ctx.fillStyle = '#f0f0ff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, star.x, by + bh / 2);

          // Arrow
          ctx.fillStyle = 'rgba(5, 5, 20, 0.92)';
          ctx.beginPath();
          ctx.moveTo(star.x - 5, by + bh);
          ctx.lineTo(star.x + 5, by + bh);
          ctx.lineTo(star.x, by + bh + 5);
          ctx.closePath();
          ctx.fill();

          // Like count badge
          const badge = `❤️ ${star.prompt.likes}`;
          ctx.font = `11px -apple-system, system-ui, sans-serif`;
          ctx.fillStyle = '#a0a0c0';
          ctx.textAlign = 'center';
          ctx.fillText(badge, star.x, by + bh + 18);
        }
      });

      // Category cluster labels
      Object.entries(CLUSTER_POS).forEach(([cat, pos]) => {
        const label = CATEGORY_LABELS[cat] ?? cat;
        const col = CATEGORY_COLORS[cat] ?? '#6366f1';
        ctx.globalAlpha = 0.55 + 0.15 * Math.sin(t * 0.5);
        ctx.font = `bold 15px -apple-system, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = col;
        ctx.fillText(label, pos.x, pos.y - 250);
        ctx.globalAlpha = 1;
      });

      ctx.restore();

      // ── Shooting stars (screen space) ─────────────────────────────────────
      shootingRef.current.forEach((ss) => {
        if (ss.active) {
          const progress = ss.life / ss.maxLife;
          const tailLen = 100 * progress;
          const sGrad = ctx.createLinearGradient(ss.x, ss.y, ss.x - ss.vx * tailLen, ss.y - ss.vy * tailLen);
          sGrad.addColorStop(0, `rgba(255,255,255,${progress * 0.9})`);
          sGrad.addColorStop(1, 'transparent');
          ctx.strokeStyle = sGrad;
          ctx.lineWidth = 1.5 * progress;
          ctx.beginPath();
          ctx.moveTo(ss.x, ss.y);
          ctx.lineTo(ss.x - ss.vx * tailLen, ss.y - ss.vy * tailLen);
          ctx.stroke();

          ss.x += ss.vx;
          ss.y += ss.vy;
          ss.life -= 0.016;
          if (ss.life <= 0) ss.active = false;
        } else if (Math.random() < 0.0015) {
          ss.x = Math.random() * W;
          ss.y = Math.random() * H * 0.5;
          const angle = Math.PI / 5 + (Math.random() - 0.5) * 0.5;
          const speed = 6 + Math.random() * 8;
          ss.vx = Math.cos(angle) * speed;
          ss.vy = Math.sin(angle) * speed;
          ss.maxLife = 0.4 + Math.random() * 0.5;
          ss.life = ss.maxLife;
          ss.active = true;
        }
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    // Pause RAF when tab is hidden to save resources
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
      } else {
        rafRef.current = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ready]);

  // ── Mouse handlers ──────────────────────────────────────────────────────────
  const screenToWorld = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - panRef.current.x) / zoomRef.current,
      y: (sy - panRef.current.y) / zoomRef.current,
    }),
    [],
  );

  const findHoveredStar = useCallback((worldX: number, worldY: number): PromptStar | null => {
    let best: PromptStar | null = null;
    let bestDist = 32 / zoomRef.current;
    starsRef.current.forEach((s) => {
      const dx = s.x - worldX,
        dy = s.y - worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < Math.max(s.radius * 2.5, bestDist)) {
        bestDist = dist;
        best = s;
      }
    });
    return best;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isDraggingRef.current) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDraggedRef.current = true;
        panRef.current = { x: lastPanRef.current.x + dx, y: lastPanRef.current.y + dy };
        hoveredRef.current = null;
        if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
        return;
      }
      const w = screenToWorld(e.clientX, e.clientY);
      const hit = findHoveredStar(w.x, w.y);
      hoveredRef.current = hit ? hit.prompt : null;
      if (canvasRef.current) canvasRef.current.style.cursor = hit ? 'pointer' : 'grab';
    },
    [screenToWorld, findHoveredStar],
  );

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    lastPanRef.current = { ...panRef.current };
  }, []);

  const handleMouseUp = useCallback((_e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    if (!hasDraggedRef.current && hoveredRef.current) {
      setSelectedPrompt(hoveredRef.current);
      setDrawerOpen(true);
    }
    if (canvasRef.current) canvasRef.current.style.cursor = hoveredRef.current ? 'pointer' : 'grab';
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.11;
    const mx = e.clientX,
      my = e.clientY;
    const wx = (mx - panRef.current.x) / zoomRef.current;
    const wy = (my - panRef.current.y) / zoomRef.current;
    zoomRef.current = Math.min(Math.max(zoomRef.current * factor, 0.12), 3);
    panRef.current = { x: mx - wx * zoomRef.current, y: my - wy * zoomRef.current };
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.addEventListener('wheel', handleWheel, { passive: false });
    return () => c.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Global mouseup to stop drag if cursor leaves canvas
  useEffect(() => {
    const fn = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener('mouseup', fn);
    return () => window.removeEventListener('mouseup', fn);
  }, []);

  // Escape to exit
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/');
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [navigate]);

  // Auto-dismiss hint
  useEffect(() => {
    const t = setTimeout(() => setHintDismissed(true), 6000);
    return () => clearTimeout(t);
  }, []);

  const resetView = () => {
    zoomRef.current = 0.22;
    if (canvasRef.current) {
      panRef.current = {
        x: canvasRef.current.width / 2 - 2000 * 0.22,
        y: canvasRef.current.height / 2 - 1500 * 0.22,
      };
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#020210]">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        className="absolute inset-0"
        style={{ cursor: 'grab' }}
        role="img"
        aria-label="Prompt 银河星图 — 拖拽移动、滚轮缩放、点击星球查看 Prompt"
      />

      {/* ── HUD ─────────────────────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-5 md:p-7">
        {/* Top Bar */}
        <div className="flex items-start justify-between">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-950/80 backdrop-blur-sm">
                <Telescope size={18} className="text-indigo-400" />
              </div>
              <div>
                <h1 className="bg-linear-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-xl font-bold text-transparent">
                  Prompt 银河
                </h1>
                <p className="text-[11px] text-indigo-400/60">{MOCK_PROMPTS.length} 个 Prompt 星球等你探索</p>
              </div>
            </div>
          </motion.div>

          <button
            onClick={() => navigate('/')}
            className="pointer-events-auto flex items-center gap-2 rounded-xl border border-gray-700/60 bg-gray-950/70 px-4 py-2 text-sm text-gray-300 backdrop-blur-md transition-all hover:border-gray-500 hover:bg-gray-900/80 hover:text-white"
          >
            <X size={14} /> 退出星图
          </button>
        </div>

        {/* Bottom */}
        <div className="flex items-end justify-between gap-4">
          {/* Category Legend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap gap-2"
          >
            {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
              <div
                key={cat}
                className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-gray-950/60 px-2.5 py-1 backdrop-blur-sm"
              >
                <div className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                <span className="text-[10px] text-gray-400">
                  {(CATEGORY_LABELS[cat] ?? cat).split(' ').slice(1).join(' ')}
                </span>
              </div>
            ))}
          </motion.div>

          {/* Zoom Controls */}
          <div className="pointer-events-auto flex flex-col gap-1.5">
            <button
              onClick={() => {
                zoomRef.current = Math.min(zoomRef.current * 1.25, 3);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-700/60 bg-gray-950/70 text-gray-400 backdrop-blur-md transition-all hover:border-indigo-500/50 hover:text-indigo-400"
              aria-label="放大"
            >
              <ZoomIn size={15} />
            </button>
            <button
              onClick={() => {
                zoomRef.current = Math.max(zoomRef.current * 0.8, 0.12);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-700/60 bg-gray-950/70 text-gray-400 backdrop-blur-md transition-all hover:border-indigo-500/50 hover:text-indigo-400"
              aria-label="缩小"
            >
              <ZoomOut size={15} />
            </button>
            <button
              onClick={resetView}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-700/60 bg-gray-950/70 text-gray-400 backdrop-blur-md transition-all hover:border-indigo-500/50 hover:text-indigo-400"
              aria-label="重置视图"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Interaction hint */}
      <AnimatePresence>
        {!hintDismissed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ delay: 0.8 }}
            className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2"
          >
            <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-gray-950/70 px-5 py-2.5 backdrop-blur-md">
              <MousePointer2 size={13} className="text-indigo-400" />
              <span className="text-[12px] text-gray-400">
                拖拽移动 · 滚轮缩放 · 点击星球查看 Prompt ·{' '}
                <kbd className="rounded border border-gray-700 bg-gray-800 px-1 font-mono text-[10px]">Esc</kbd> 返回
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prompt Drawer */}
      {selectedPrompt && (
        <PromptDetailDrawer
          prompt={selectedPrompt}
          darkMode={true}
          externalOpen={drawerOpen}
          onExternalOpenChange={(o: boolean) => {
            setDrawerOpen(o);
            if (!o) setSelectedPrompt(null);
          }}
        />
      )}
    </div>
  );
}
