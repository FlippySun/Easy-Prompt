/**
 * Admin Layout — 管理后台布局壳
 * 2026-04-09 新增 — P6.05
 * 变更类型：新增
 * 设计思路：
 *   左侧固定侧边栏导航 + 右侧内容区
 *   通过 useAuth 检查 admin 角色，非 admin 重定向到首页
 * 影响范围：/admin/* 路由
 * 潜在风险：无已知风险
 */

import { NavLink, Outlet, Navigate } from 'react-router';
import { useAuth } from '../../hooks/useAuth';

const NAV_ITEMS = [
  { to: '/admin', label: '仪表盘', icon: '📊', end: true },
  { to: '/admin/providers', label: 'Provider 管理', icon: '🔌', end: false },
  { to: '/admin/blacklist', label: '黑名单管理', icon: '🚫', end: false },
  { to: '/admin/analytics', label: '数据分析', icon: '📈', end: false },
];

export function AdminLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* 侧边栏 */}
      <aside className="flex w-60 flex-col border-r border-gray-800 bg-gray-900">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 border-b border-gray-800 px-4">
          <span className="text-xl">⚡</span>
          <span className="font-semibold text-indigo-400">Easy Prompt</span>
          <span className="ml-auto rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
            Admin
          </span>
        </div>

        {/* 导航 */}
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-indigo-500/15 text-indigo-300 font-medium'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* 底部用户信息 */}
        <div className="border-t border-gray-800 p-3">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-medium text-indigo-300">
              {user.displayName?.[0] || user.username[0]}
            </div>
            <div className="flex-1 truncate">
              <div className="truncate text-xs font-medium text-gray-300">{user.displayName || user.username}</div>
              <div className="truncate text-[10px] text-gray-500">{user.email}</div>
            </div>
          </div>
          <NavLink
            to="/"
            className="mt-1 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
          >
            ← 返回前台
          </NavLink>
        </div>
      </aside>

      {/* 内容区 */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
