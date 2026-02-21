/**
 * MagneticButton — wraps any element with a magnetic cursor-attraction effect.
 * Inspired by: Awwwards.com top sites, Framer.com, Resend.com
 * Direct DOM manipulation → no React re-renders during mouse movement.
 */
import { useRef, useCallback, type ReactNode } from 'react';

interface MagneticButtonProps {
  children: ReactNode;
  strength?: number;  // how strongly it attracts (px, default 25)
  className?: string;
}

export function MagneticButton({ children, strength = 25, className }: MagneticButtonProps) {
  const wrapRef    = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rafRef     = useRef(0);
  const targetRef  = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const animate = useCallback(() => {
    currentRef.current.x = lerp(currentRef.current.x, targetRef.current.x, 0.14);
    currentRef.current.y = lerp(currentRef.current.y, targetRef.current.y, 0.14);

    if (contentRef.current) {
      contentRef.current.style.transform =
        `translate(${currentRef.current.x}px, ${currentRef.current.y}px)`;
    }

    const dist = Math.abs(currentRef.current.x) + Math.abs(currentRef.current.y);
    if (dist > 0.05) {
      rafRef.current = requestAnimationFrame(animate);
    }
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const cx = rect.left + rect.width  / 2;
    const cy = rect.top  + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    // Attenuate: strongest at centre, falls off toward edges
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = Math.max(rect.width, rect.height) * 0.8;
    const factor = Math.max(0, 1 - dist / maxDist);

    targetRef.current = {
      x: dx * factor * (strength / 50),
      y: dy * factor * (strength / 50),
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
  }, [strength, animate]);

  const onMouseLeave = useCallback(() => {
    targetRef.current = { x: 0, y: 0 };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
  }, [animate]);

  return (
    <div
      ref={wrapRef}
      className={className}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <div ref={contentRef} style={{ willChange: 'transform' }}>
        {children}
      </div>
    </div>
  );
}
