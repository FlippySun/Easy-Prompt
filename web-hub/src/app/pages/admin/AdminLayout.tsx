/**
 * Admin Layout — 管理后台布局壳
 * 2026-04-09 新增 — P6.05
 * 2026-04-09 重构 — 全新 light-theme 设计，参考 sub2api 风格
 * 变更类型：重构
 * 设计思路：
 *   左侧固定侧边栏（白色背景 + Lucide 图标）+ 顶部 header + 右侧内容区
 *   配色参考 sub2api：白底侧边栏、teal 高亮、浅灰内容背景
 *   通过 useAuth 检查 admin 角色，非 admin 重定向到首页
 *   侧边栏可折叠，底部显示用户信息和返回前台入口
 * 影响范围：/admin/* 路由
 * 潜在风险：无已知风险
 */

import { useState } from 'react';
import { NavLink, Outlet, Navigate, useLocation } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard,
  FileCheck,
  Server,
  ShieldBan,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  LogOut,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// 2026-04-09 重构 — 导航配置，使用 Lucide 图标替代 emoji
interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/admin', label: '仪表盘', icon: LayoutDashboard, end: true },
  { to: '/admin/prompts', label: 'Prompt 审核', icon: FileCheck, end: false },
  { to: '/admin/providers', label: 'Provider 管理', icon: Server, end: false },
  { to: '/admin/blacklist', label: '黑名单管理', icon: ShieldBan, end: false },
  { to: '/admin/analytics', label: '数据分析', icon: BarChart3, end: false },
];

// 2026-04-09 — 路由标题映射，用于顶部 header 面包屑
const PAGE_TITLES: Record<string, string> = {
  '/admin': '仪表盘',
  '/admin/prompts': 'Prompt 审核',
  '/admin/providers': 'Provider 管理',
  '/admin/blacklist': '黑名单管理',
  '/admin/analytics': '数据分析',
};

export function AdminLayout() {
  const { user, isLoading, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // 当前页面标题
  const currentTitle = PAGE_TITLES[location.pathname] || '管理后台';

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800">
      {/* ── 侧边栏 ── */}
      <aside
        className={`flex flex-col border-r border-slate-200 bg-white transition-all duration-300 ${
          collapsed ? 'w-17' : 'w-60'
        }`}
      >
        {/* Logo 区域 */}
        <div className="flex h-14 items-center gap-2.5 border-b border-slate-100 px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-teal-400 to-teal-600 shadow-sm">
            <Zap className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-sm font-semibold text-slate-800">Easy Prompt</span>
              <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal-600">Admin</span>
            </div>
          )}
        </div>

        {/* 导航列表 */}
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all ${
                  isActive
                    ? 'bg-teal-50 text-teal-700 shadow-sm shadow-teal-100'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                } ${collapsed ? 'justify-center px-0' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-slate-600'}`}
                  />
                  {!collapsed && <span>{item.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* 折叠按钮 */}
        <div className="border-t border-slate-100 p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && <span>收起</span>}
          </button>
        </div>

        {/* 底部用户信息 */}
        <div className="border-t border-slate-100 p-2">
          <div className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 ${collapsed ? 'justify-center px-0' : ''}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-teal-400 to-teal-500 text-xs font-semibold text-white shadow-sm">
              {(user.displayName?.[0] || user.username[0]).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 overflow-hidden">
                <div className="truncate text-xs font-medium text-slate-700">{user.displayName || user.username}</div>
                <div className="truncate text-[10px] text-slate-400">{user.email}</div>
              </div>
            )}
          </div>

          {/* 返回前台 + 登出 */}
          <div className={`mt-1 flex gap-1 ${collapsed ? 'flex-col items-center' : ''}`}>
            <NavLink
              to="/"
              title="返回前台"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 ${
                collapsed ? 'justify-center px-0' : 'flex-1'
              }`}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {!collapsed && <span>返回前台</span>}
            </NavLink>
            <button
              onClick={logout}
              title="退出登录"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 ${
                collapsed ? 'justify-center px-0' : ''
              }`}
            >
              <LogOut className="h-3.5 w-3.5" />
              {!collapsed && <span>退出</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* ── 右侧主区域 ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 顶部 Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-slate-800">{currentTitle}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">{user.role === 'super_admin' ? 'Super Admin' : 'Admin'}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-teal-400 to-teal-500 text-xs font-semibold text-white">
              {(user.displayName?.[0] || user.username[0]).toUpperCase()}
            </div>
          </div>
        </header>

        {/* 内容区 */}
        <main className="flex-1 overflow-auto bg-slate-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
