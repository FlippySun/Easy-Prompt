/**
 * AuroraOrbs — ambient floating gradient blobs behind the entire layout.
 * Inspired by: Vercel.com, Linear.app, Pitch.com
 * Pure CSS keyframe animation, zero JS after mount.
 */
interface AuroraOrbsProps {
  darkMode: boolean;
}

export function AuroraOrbs({ darkMode }: AuroraOrbsProps) {
  const dm = darkMode;
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* Top-left — indigo */}
      <div
        className="aurora-orb-1 absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full"
        style={{
          background: dm
            ? 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      {/* Top-right — violet */}
      <div
        className="aurora-orb-2 absolute -right-40 top-0 h-[500px] w-[500px] rounded-full"
        style={{
          background: dm
            ? 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      {/* Bottom-center — rose */}
      <div
        className="aurora-orb-3 absolute -bottom-60 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full"
        style={{
          background: dm
            ? 'radial-gradient(circle, rgba(236,72,153,0.05) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(236,72,153,0.04) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
    </div>
  );
}
