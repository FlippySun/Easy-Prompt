import { Sparkles, Github, Twitter, Heart } from 'lucide-react';

interface FooterProps {
  darkMode: boolean;
}

export function Footer({ darkMode }: FooterProps) {
  const dm = darkMode;

  return (
    <footer className={`mt-auto border-t py-8 ${dm ? 'border-gray-800 bg-gray-900' : 'border-gray-100 bg-white'}`}>
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-violet-500 to-indigo-600">
              <Sparkles size={14} className="text-white" />
            </div>
            <span className={`text-sm font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>
              Prompt<span className="text-indigo-500">Hub</span>
            </span>
          </div>

          {/* Links */}
          <div
            className={`flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}
          >
            {['关于我们', '使用条款', '隐私政策', '联系我们', 'API 文档'].map((link) => (
              <a
                key={link}
                href="#"
                className={dm ? 'transition-colors hover:text-gray-300' : 'transition-colors hover:text-gray-700'}
              >
                {link}
              </a>
            ))}
          </div>

          {/* Social + Credits */}
          <div className="flex items-center gap-3">
            <a
              href="#"
              className={`transition-colors ${dm ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-700'}`}
            >
              <Github size={16} />
            </a>
            <a
              href="#"
              className={`transition-colors ${dm ? 'text-gray-500 hover:text-blue-400' : 'text-gray-400 hover:text-blue-500'}`}
            >
              <Twitter size={16} />
            </a>
          </div>
        </div>

        <div
          className={`mt-6 flex flex-col items-center gap-1 text-center text-[11px] ${dm ? 'text-gray-600' : 'text-gray-400'}`}
        >
          <p>
            Made with <Heart size={9} className="inline text-red-400" /> by the PromptHub Team · ©{' '}
            {new Date().getFullYear()} PromptHub · All rights reserved
          </p>
        </div>
      </div>
    </footer>
  );
}
