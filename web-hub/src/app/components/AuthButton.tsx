/**
 * AuthButton — Navbar 认证区域（未登录→登录按钮，已登录→UserMenu）
 * 2026-04-09 新增 — P5.03 Auth UI 组件
 * 变更类型：新增
 * 设计思路：
 *   1. 未登录 → 显示"登录"按钮，点击跳转 /auth/login
 *   2. 已登录 → 显示 UserMenu（头像 + 下拉菜单）
 *   3. 加载中 → 显示骨架占位，避免闪烁
 * 参数：darkMode — boolean
 * 影响范围：Navbar 右侧用户区域
 * 潜在风险：无已知风险
 */

import { Link } from 'react-router';
import { LogIn } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { UserMenu } from './UserMenu';

interface AuthButtonProps {
  darkMode: boolean;
}

export function AuthButton({ darkMode }: AuthButtonProps) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  // 加载中 → 骨架占位
  if (isLoading) {
    return (
      <div
        className={`h-9 w-9 animate-pulse rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}
        aria-hidden="true"
      />
    );
  }

  // 已登录 → UserMenu
  if (isAuthenticated && user) {
    return <UserMenu user={user} darkMode={darkMode} onLogout={logout} />;
  }

  // 未登录 → 登录按钮
  return (
    <Link
      to="/auth/login"
      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        darkMode
          ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <LogIn size={16} />
      <span className="hidden sm:inline">登录</span>
    </Link>
  );
}
