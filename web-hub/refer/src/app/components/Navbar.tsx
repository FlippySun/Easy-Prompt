import { Search, Plus, Sun, Moon, Sparkles, X, User, Command } from 'lucide-react';
import { Link } from 'react-router';
import { CreatePromptDrawer } from './CreatePromptDrawer';
import { useState } from 'react';

interface NavbarProps {
  darkMode: boolean;
  onToggleDark: () => void;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onOpenCmdPalette?: () => void;
}

export function Navbar({ darkMode, onToggleDark, searchValue, onSearchChange, onOpenCmdPalette }: NavbarProps) {
  const [localSearch, setLocalSearch] = useState('');

  const handleSearch = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value);
    } else {
      setLocalSearch(value);
    }
  };

  const currentSearch = onSearchChange ? searchValue : localSearch;

  return (
    <nav className={`sticky top-0 z-50 w-full border-b ${darkMode ? 'border-gray-800 bg-gray-900/95' : 'border-gray-200/80 bg-white/95'} backdrop-blur-xl shadow-sm`}>
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-indigo-500/30">
            <Sparkles size={16} className="text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className={`text-[15px] font-bold tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Prompt<span className="text-indigo-500">Hub</span>
            </span>
            <span className="text-[9px] font-medium text-gray-400 tracking-widest uppercase">AI Prompt Library</span>
          </div>
        </Link>

        {/* Search Bar */}
        <div className="relative hidden flex-1 max-w-xl md:block">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索 Prompt，如「代码审查」「写作助手」..."
            value={currentSearch}
            onChange={(e) => handleSearch(e.target.value)}
            className={`w-full rounded-xl border py-2.5 pl-10 pr-24 text-sm transition-all outline-none ${
              darkMode
                ? 'border-gray-700 bg-gray-800 text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                : 'border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 focus:bg-white'
            }`}
          />
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            {currentSearch ? (
              <button onClick={() => handleSearch('')} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            ) : (
              <button
                onClick={onOpenCmdPalette}
                title="打开命令面板 (⌘K)"
                className={`flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-mono transition-colors ${darkMode ? 'border-gray-600 bg-gray-700 text-gray-400 hover:border-indigo-500 hover:text-indigo-400' : 'border-gray-200 bg-gray-100 text-gray-400 hover:border-indigo-300 hover:text-indigo-500'}`}
              >
                <Command size={9} />K
              </button>
            )}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleDark}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
              darkMode
                ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={darkMode ? '切换亮色模式' : '切换暗色模式'}
          >
            {darkMode ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Profile Button */}
          <Link
            to="/profile"
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
              darkMode
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
            }`}
            title="个人主页"
          >
            <User size={17} />
          </Link>

          {/* Submit Button */}
          <CreatePromptDrawer darkMode={darkMode}>
            <button className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-indigo-500/25 transition-all hover:shadow-lg hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]">
              <Plus size={16} />
              <span className="hidden sm:inline">提交 Prompt</span>
            </button>
          </CreatePromptDrawer>
        </div>
      </div>

      {/* Mobile Search */}
      <div className="border-t border-gray-100 px-4 py-2.5 md:hidden dark:border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索 Prompt..."
            value={currentSearch}
            onChange={(e) => handleSearch(e.target.value)}
            className={`w-full rounded-xl border py-2 pl-9 pr-4 text-sm outline-none ${
              darkMode
                ? 'border-gray-700 bg-gray-800 text-gray-100 placeholder:text-gray-500'
                : 'border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400'
            }`}
          />
        </div>
      </div>
    </nav>
  );
}