/**
 * UserMenu — 已登录用户下拉菜单
 * 2026-04-09 新增 — P5.03 Auth UI 组件
 * 变更类型：新增
 * 设计思路：
 *   1. 点击头像/用户名进入个人主页，点击独立箭头展开下拉菜单
 *   2. 菜单项：个人主页、我的收藏、登出
 *   3. 点击外部自动关闭（useEffect + mousedown）
 *   4. darkMode 通过 CSS class dark: 适配
 * 参数：user — AuthUser, darkMode — boolean, onLogout — () => void
 * 影响范围：Navbar 右侧用户区域
 * 潜在风险：无已知风险
 */

/**
 * 2026-04-15
 * 变更类型：修复/交互
 * 功能描述：将 Web-Hub 顶部已登录用户名主入口改为直达 `/profile`，避免与其他客户端“点击用户名进入个人页”的行为不一致。
 * 设计思路：保留原有下拉菜单能力，但将菜单触发拆到独立的 Chevron 按钮；这样既满足直达个人页，又不丢失收藏/退出等次级操作。
 * 参数与返回值：`UserMenu` 仍接收 `user`、`darkMode`、`onLogout`；点击主入口路由到 `/profile`，点击 Chevron 切换本地下拉状态。
 * 影响范围：Web-Hub 顶部导航用户区、个人页入口一致性、显式退出入口保留。
 * 潜在风险：用户若习惯旧版“点击用户名展开菜单”，需要通过右侧箭头访问菜单；无已知功能性风险。
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
      {/* 2026-04-15 修复：主入口直达个人页，Chevron 独立承担菜单展开职责 */}
      <div className="flex items-center gap-1">
        <Link
          to="/profile"
          onClick={close}
          className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-medium transition-colors ${
            darkMode
              ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={displayName} className="h-7 w-7 rounded-full object-cover" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white">
              {initial}
            </div>
          )}
          <span className="hidden max-w-20 truncate sm:inline">{displayName}</span>
        </Link>
        <button
          type="button"
          aria-label="打开用户菜单"
          onClick={() => setOpen((prevOpen) => !prevOpen)}
          className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
            darkMode
              ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

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
