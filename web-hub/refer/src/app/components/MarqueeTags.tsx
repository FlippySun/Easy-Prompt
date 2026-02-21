/**
 * MarqueeTags — infinite horizontal scrolling tag ribbon.
 * Inspired by: Linear.app, Framer.com, Pitch.com, Luma.ai
 * Pure CSS animation — no JS timers.
 */

const TAGS = [
  'ChatGPT', 'Claude', 'Midjourney', '小红书', 'Python', 'SEO',
  'DALL·E', 'Gemini', '写作', '代码审查', '职场', '营销',
  '图像生成', '学习', 'Stable Diffusion', '商业分析', '效率工具', '生活助手',
  'GPT-4', 'Prompt工程', '创意写作', '数据分析', '内容策略', 'AI绘画',
];

interface MarqueeTagsProps {
  darkMode: boolean;
}

export function MarqueeTags({ darkMode }: MarqueeTagsProps) {
  const dm = darkMode;
  const doubled = [...TAGS, ...TAGS]; // seamless loop

  const tagCls = dm
    ? 'border-gray-700/60 bg-gray-800/60 text-gray-400 hover:border-indigo-500/40 hover:text-indigo-400'
    : 'border-gray-200/80 bg-white/80 text-gray-500 hover:border-indigo-300 hover:text-indigo-600';

  return (
    <div className="relative overflow-hidden py-1" aria-hidden>
      {/* Left fade */}
      <div
        className="pointer-events-none absolute left-0 top-0 z-10 h-full w-16"
        style={{
          background: dm
            ? 'linear-gradient(to right, #030712, transparent)'
            : 'linear-gradient(to right, #f5f6fa, transparent)',
        }}
      />
      {/* Right fade */}
      <div
        className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16"
        style={{
          background: dm
            ? 'linear-gradient(to left, #030712, transparent)'
            : 'linear-gradient(to left, #f5f6fa, transparent)',
        }}
      />

      {/* Scrolling track */}
      <div className="marquee-track flex gap-2">
        {doubled.map((tag, i) => (
          <span
            key={i}
            className={`inline-flex flex-shrink-0 cursor-pointer items-center gap-1 rounded-xl border px-3 py-1.5 text-[11px] font-medium backdrop-blur-sm transition-colors ${tagCls}`}
          >
            <span className="opacity-50">#</span>{tag}
          </span>
        ))}
      </div>
    </div>
  );
}
