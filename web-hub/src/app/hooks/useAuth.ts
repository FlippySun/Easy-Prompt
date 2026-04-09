/**
 * useAuth Hook — 从 AuthContext 获取认证状态与方法
 * 2026-04-09 新增 — P5.02 Auth Context + Hook
 * 变更类型：新增
 * 设计思路：
 *   1. 配合 AuthProvider 使用，提供 user / isAuthenticated / isLoading / login / logout
 *   2. 任意组件调用 useAuth() 即可获取认证状态
 *   3. 未在 AuthProvider 内调用时抛出明确错误
 * 参数：无
 * 返回：AuthContextValue
 * 影响范围：web-hub 全局认证状态消费
 * 潜在风险：无已知风险
 */

import { createContext, useContext } from 'react';
import type { AuthUser, LoginRequest, RegisterRequest } from '@/lib/api';

// ── Context 类型 ─────────────────────────────────────────

export interface AuthContextValue {
  /** 当前登录用户（未登录为 null） */
  user: AuthUser | null;
  /** 是否已登录 */
  isAuthenticated: boolean;
  /** 初始化加载中（首次 /auth/me 尚未返回） */
  isLoading: boolean;
  /** 登录 */
  login: (data: LoginRequest) => Promise<void>;
  /** 注册 */
  register: (data: RegisterRequest) => Promise<void>;
  /** 登出 */
  logout: () => void;
  /** 手动刷新用户信息 */
  refreshUser: () => Promise<void>;
}

// ── Context 实例 ─────────────────────────────────────────

export const AuthContext = createContext<AuthContextValue | null>(null);

// ── Hook ─────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() must be used within <AuthProvider>');
  }
  return ctx;
}
