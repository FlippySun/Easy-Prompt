/**
 * UserMenu — 已登录用户下拉菜单
 * 2026-04-09 新增 — P5.03 Auth UI 组件
 * 变更类型：新增
 * 设计思路：
 *   1. 点击头像/用户名展开下拉菜单
 *   2. 菜单项：个人主页、我的收藏、我的 Prompt、设置（预留）、登出
 *   3. 点击外部自动关闭（useEffect + mousedown）
 *   4. darkMode 通过 CSS class dark: 适配
 * 参数：user — AuthUser, darkMode — boolean, onLogout — () => void
 * 影响范围：Navbar 右侧用户区域
 * 潜在风险：无已知风险
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { User, Heart, LogOut, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { AuthUser } from '@/lib/api';

interface UserMenuProps {
  user: AuthUser;
  darkMode: boolean;
  onLogout: () => void;
}

export function UserMenu({ user, darkMode, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const displayName = user.displayName || user.username;
  const initial = displayName.charAt(0).toUpperCase();

  const menuItems = [
    { to: '/profile', icon: User, label: '个人主页' },
    { to: '/favorites', icon: Heart, label: '我的收藏' },
  ] as const;

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-medium transition-colors ${
          darkMode
            ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        {user.avatar ? (
          <img src={user.avatar} alt={displayName} className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white">
            {initial}
          </div>
        )}
        <span className="hidden max-w-[80px] truncate sm:inline">{displayName}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute right-0 top-full z-50 mt-1.5 w-48 rounded-xl border p-1 shadow-lg ${
              darkMode ? 'border-gray-700 bg-gray-800 shadow-black/30' : 'border-gray-200 bg-white shadow-gray-200/50'
            }`}
          >
            {/* User info header */}
            <div className={`mb-1 border-b px-3 py-2 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <p className={`text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {displayName}
              </p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>

            {/* Menu items */}
            {menuItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={close}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  darkMode
                    ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon size={15} />
                {item.label}
              </Link>
            ))}

            {/* Divider + Logout */}
            <div className={`my-1 border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'}`} />
            <button
              onClick={() => {
                close();
                onLogout();
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                darkMode ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'
              }`}
            >
              <LogOut size={15} />
              退出登录
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
