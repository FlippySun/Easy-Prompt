import { useEffect, useRef, useState } from 'react';

interface CustomCursorProps {
  darkMode: boolean;
}

export function CustomCursor({ darkMode }: CustomCursorProps) {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: -200, y: -200 });
  const ringPosRef = useRef({ x: -200, y: -200 });
  const isHovRef = useRef(false);
  const isClickRef = useRef(false);
  const visibleRef = useRef(false); // ← ref, not state — no re-render on change
  const rafRef = useRef(0);
  const isAnimatingRef = useRef(false); // ← only run RAF when needed
  const darkRef = useRef(darkMode); // ← track darkMode in ref inside RAF
  const dotScaleRef = useRef(1); // ← lerp scale for smooth transitions
  const ringScaleRef = useRef(1); // ← lerp scale for smooth transitions

  const [visible, setVisible] = useState(false);

  // Keep darkRef in sync whenever darkMode prop changes
  useEffect(() => {
    darkRef.current = darkMode;
  }, [darkMode]);

  useEffect(() => {
    // Touch devices don't get a cursor
    if (window.matchMedia('(hover: none)').matches) return;

    const animate = () => {
      const dm = darkRef.current;
      const isHov = isHovRef.current;
      const isClick = isClickRef.current;

      // Lerp ring toward pointer
      const dx = posRef.current.x - ringPosRef.current.x;
      const dy = posRef.current.y - ringPosRef.current.y;
      ringPosRef.current.x += dx * 0.13;
      ringPosRef.current.y += dy * 0.13;

      const dot = dotRef.current;
      const ring = ringRef.current;

      if (dot) {
        const targetDotScale = isClick ? 0.6 : isHov ? 1.4 : 1;
        dotScaleRef.current += (targetDotScale - dotScaleRef.current) * 0.3;
        dot.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px) translate(-50%,-50%) scale(${dotScaleRef.current})`;
        dot.style.backgroundColor = isHov ? '#a78bfa' : '#6366f1';
      }

      if (ring) {
        const targetRingScale = isClick ? 0.7 : isHov ? 1.7 : 1;
        ringScaleRef.current += (targetRingScale - ringScaleRef.current) * 0.3;
        ring.style.transform = `translate(${ringPosRef.current.x}px, ${ringPosRef.current.y}px) translate(-50%,-50%) scale(${ringScaleRef.current})`;
        ring.style.opacity = isClick ? '0.4' : isHov ? '0.7' : '0.5';
        ring.style.borderColor = isHov ? (dm ? '#a78bfa' : '#7c3aed') : '#6366f1';
      }

      // Only continue looping while the ring is still catching up or scale is lerping
      const scaleDelta = Math.abs(dotScaleRef.current - (isClick ? 0.6 : isHov ? 1.4 : 1))
        + Math.abs(ringScaleRef.current - (isClick ? 0.7 : isHov ? 1.7 : 1));
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1 || scaleDelta > 0.005) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        isAnimatingRef.current = false;
      }
    };

    /** Start RAF loop if not already running */
    const ensureAnimating = () => {
      if (!isAnimatingRef.current) {
        isAnimatingRef.current = true;
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    const onMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };

      // Use ref to avoid triggering effect re-run from setState in deps
      if (!visibleRef.current) {
        visibleRef.current = true;
        setVisible(true);
      }

      const target = e.target as HTMLElement;
      isHovRef.current = !!target.closest('button, a, [role="button"], input, textarea, select, label');

      ensureAnimating();
    };

    const onDown = () => {
      isClickRef.current = true;
      ensureAnimating(); // one frame to update scale
    };
    const onUp = () => {
      isClickRef.current = false;
      ensureAnimating();
    };
    const onLeave = () => {
      visibleRef.current = false;
      setVisible(false);
    };
    const onEnter = () => {
      visibleRef.current = true;
      setVisible(true);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    document.documentElement.addEventListener('mouseleave', onLeave);
    document.documentElement.addEventListener('mouseenter', onEnter);

    document.documentElement.style.cursor = 'none';

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      document.documentElement.removeEventListener('mouseenter', onEnter);
      cancelAnimationFrame(rafRef.current);
      document.documentElement.style.cursor = '';
    };
  }, []); // ← empty deps: RAF loop and listeners set up exactly once

  if (!visible) return null;

  return (
    <>
      {/* Inner dot */}
      <div
        ref={dotRef}
        className="pointer-events-none fixed left-0 top-0 z-[9999] h-2.5 w-2.5 rounded-full bg-indigo-500"
        style={{
          willChange: 'transform',
          boxShadow: '0 0 8px 2px rgba(99,102,241,0.6)',
        }}
      />
      {/* Outer ring */}
      <div
        ref={ringRef}
        className="pointer-events-none fixed left-0 top-0 z-[9998] h-9 w-9 rounded-full border-2 border-indigo-500"
        style={{
          willChange: 'transform',
          boxShadow: '0 0 12px rgba(99,102,241,0.25)',
        }}
      />
    </>
  );
}
