/**
 * CountUp — numbers count up when they scroll into view.
 * Inspired by: Stripe.com, Vercel.com, Resend.com
 * Uses IntersectionObserver + requestAnimationFrame, zero setState during animation.
 */
import { useEffect, useRef } from 'react';

interface CountUpProps {
  to: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  formatter?: (n: number) => string;
}

export function CountUp({ to, duration = 1800, suffix = '', prefix = '', className, formatter }: CountUpProps) {
  const elRef = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    started.current = false;

    const fmt = formatter ?? ((n: number) => n.toLocaleString('zh-CN'));

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;
        started.current = true;

        const t0 = performance.now();
        const step = (now: number) => {
          const elapsed = now - t0;
          const p = Math.min(elapsed / duration, 1);
          // Cubic ease-out
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = prefix + fmt(Math.round(eased * to)) + suffix;
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    // Set initial value so it's not blank before intersection
    el.textContent = prefix + fmt(0) + suffix;
    return () => observer.disconnect();
  }, [to, duration, suffix, prefix, formatter]);

  return <span ref={elRef} className={className} />;
}
