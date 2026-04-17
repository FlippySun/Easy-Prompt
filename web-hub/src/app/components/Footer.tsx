import { Github, Twitter, Heart, Wand2 } from 'lucide-react';
import logoWhite from '@/assets/icon/logo-white.svg';
import { PROMPT_WEB_FROM_HUB_URL } from '@/lib/env';

interface FooterProps {
  darkMode: boolean;
}

/**
 * 2026-04-15 优化 — PromptHub 页脚品牌 Logo 资源替换
 * 变更类型：优化
 * 功能描述：将页脚品牌角标从临时 Sparkles 图标切换为白色 SVG Logo。
 * 设计思路：页脚品牌角标同样位于紫色渐变底中，复用 `logo-white.svg` 以统一品牌识别并保证深色对比度。
 * 参数与返回值：使用静态资源 `logoWhite`，不改变 `FooterProps` 入参与组件返回结构。
 * 影响范围：web-hub 页脚品牌入口。
 * 潜在风险：无已知风险。
 */

export function Footer({ darkMode }: FooterProps) {
  const dm = darkMode;

  return (
    <footer className={`mt-auto border-t py-8 ${dm ? 'border-gray-800 bg-gray-900' : 'border-gray-100 bg-white'}`}>
      <div className="mx-auto max-w-350 px-6">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-violet-500 to-indigo-600">
              <img src={logoWhite} alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
            </div>
            <span className={`text-sm font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>
              Prompt<span className="text-indigo-500">Hub</span>
            </span>
          </div>

          {/* Links */}
          <div
            className={`flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}
          >
            {['关于我们', '使用条款', '隐私政策', '联系我们'].map((link) => (
              <a
                key={link}
                href="#"
                className={dm ? 'transition-colors hover:text-gray-300' : 'transition-colors hover:text-gray-700'}
              >
                {link}
              </a>
            ))}
            <span className={`${dm ? 'text-gray-700' : 'text-gray-200'}`}>|</span>
            <a
              href={PROMPT_WEB_FROM_HUB_URL}
              target="_blank"
              rel="noopener"
              className={`inline-flex items-center gap-1 font-medium transition-colors ${dm ? 'text-violet-400/70 hover:text-violet-400' : 'text-violet-500/70 hover:text-violet-600'}`}
            >
              <Wand2 size={11} />
              Prompt 增强工具
            </a>
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
