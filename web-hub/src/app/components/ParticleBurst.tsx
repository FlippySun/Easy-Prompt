import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';

interface Burst {
  id: number;
  x: number;
  y: number;
}

// Singleton pub-sub for triggering bursts from anywhere
let _listeners: Array<(burst: Burst) => void> = [];

export function triggerLikeBurst(x: number, y: number) {
  const burst = { id: Date.now() + Math.random(), x, y };
  _listeners.forEach((fn) => fn(burst));
}

interface Particle {
  id: number;
  dx: number;
  dy: number;
  emoji: string;
  scale: number;
  rotate: number;
}

function BurstParticles({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  const EMOJIS = ['❤️', '💕', '✨', '💖', '🌟', '💗', '⭐', '💝'];
  const particles: Particle[] = Array.from({ length: 10 }, (_, i) => {
    const angle = (i / 10) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
    const dist = 45 + Math.random() * 50;
    return {
      id: i,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - 20, // slight upward bias
      emoji: EMOJIS[i % EMOJIS.length],
      scale: 0.7 + Math.random() * 0.6,
      rotate: (Math.random() - 0.5) * 60,
    };
  });

  useEffect(() => {
    const t = setTimeout(onDone, 900);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <>
      {particles.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x, y, scale: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: x + p.dx,
            y: y + p.dy,
            scale: p.scale,
            opacity: 0,
            rotate: p.rotate,
          }}
          transition={{ duration: 0.75, ease: [0.22, 0.61, 0.36, 1] }}
          className="pointer-events-none fixed left-0 top-0 select-none text-base"
          style={{ willChange: 'transform, opacity' }}
        >
          {p.emoji}
        </motion.span>
      ))}
    </>
  );
}

export function ParticleBurstRenderer() {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    const fn = (burst: Burst) => setBursts((prev) => [...prev, burst]);
    _listeners.push(fn);
    return () => {
      _listeners = _listeners.filter((l) => l !== fn);
    };
  }, []);

  const removeBurst = (id: number) => setBursts((prev) => prev.filter((b) => b.id !== id));

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[9990] overflow-hidden">
      <AnimatePresence>
        {bursts.map((burst) => (
          <BurstParticles key={burst.id} x={burst.x} y={burst.y} onDone={() => removeBurst(burst.id)} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
