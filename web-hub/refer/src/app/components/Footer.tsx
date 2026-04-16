import { Github, Twitter, Heart } from 'lucide-react';
import logoWhite from '../../assets/icon/logo-white.svg';

interface FooterProps {
  darkMode: boolean;
}

/**
 * 2026-04-15 优化 — refer 页脚品牌 Logo 资源同步
 * 变更类型：优化
 * 功能描述：将 refer 页脚品牌角标从 Sparkles 图标替换为白色 SVG Logo。
 * 设计思路：保持参考实现与主 `web-hub/src` 页脚品牌入口一致，紫色渐变底继续搭配 `logo-white.svg` 保证视觉统一。
 * 参数与返回值：使用静态资源 `logoWhite`，不改变 `FooterProps` 入参与组件返回结构。
 * 影响范围：web-hub/refer 页脚品牌入口。
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
          <div className={`flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
            {['关于我们', '使用条款', '隐私政策', '联系我们', 'API 文档'].map((link) => (
              <a
                key={link}
                href="#"
                className={`transition-colors hover:${dm ? 'text-gray-300' : 'text-gray-700'}`}
              >
                {link}
              </a>
            ))}
          </div>

          {/* Social + Credits */}
          <div className="flex items-center gap-3">
            <a href="#" className={`transition-colors ${dm ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-700'}`}>
              <Github size={16} />
            </a>
            <a href="#" className={`transition-colors ${dm ? 'text-gray-500 hover:text-blue-400' : 'text-gray-400 hover:text-blue-500'}`}>
              <Twitter size={16} />
            </a>
          </div>
        </div>

        <div className={`mt-6 flex flex-col items-center gap-1 text-center text-[11px] ${dm ? 'text-gray-600' : 'text-gray-400'}`}>
          <p>
            Made with <Heart size={9} className="inline text-red-400" /> by the PromptHub Team · © {new Date().getFullYear()} PromptHub · All rights reserved
          </p>
        </div>
      </div>
    </footer>
  );
}
