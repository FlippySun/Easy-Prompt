/**
 * ScrollProgress — thin iridescent bar pinned to the very top.
 * Inspired by: Linear.app, GitHub, Vercel.com
 * Uses direct DOM write in a passive scroll listener → zero React re-renders.
 */
import { useEffect, useRef } from 'react';

export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tick = () => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const pct = scrollHeight - clientHeight > 0 ? scrollTop / (scrollHeight - clientHeight) : 0;
      if (barRef.current) barRef.current.style.transform = `scaleX(${pct})`;
    };

    window.addEventListener('scroll', tick, { passive: true });
    return () => window.removeEventListener('scroll', tick);
  }, []);

  return (
    <div className="fixed left-0 top-0 z-[9997] h-[2px] w-full" aria-hidden>
      <div
        ref={barRef}
        className="h-full w-full origin-left"
        style={{
          background: 'linear-gradient(90deg,#6366f1 0%,#8b5cf6 40%,#ec4899 70%,#f59e0b 100%)',
          transform: 'scaleX(0)',
          willChange: 'transform',
        }}
      />
    </div>
  );
}
