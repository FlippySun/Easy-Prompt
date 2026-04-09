/**
 * AuthProvider — 应用级认证状态管理
 * 2026-04-09 新增 — P5.02 Auth Context + Hook
 * 变更类型：新增
 * 设计思路：
 *   1. 包裹应用根节点，启动时调用 /auth/me 检查登录状态
 *   2. 管理 user / isAuthenticated / isLoading 状态
 *   3. 提供 login / register / logout / refreshUser 方法
 *   4. access_token 过期前自动静默刷新（定时器）
 *   5. refresh 失败 → 清除状态，不强制跳转（由页面自行判断）
 * 参数：children — React 子节点
 * 影响范围：web-hub 全局认证上下文
 * 潜在风险：refresh 竞态已由 client.ts _refreshPromise 锁保护
 */

import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { authApi, getAccessToken, getRefreshToken, clearTokens, ApiError } from '@/lib/api';
import type { AuthUser, LoginRequest, RegisterRequest } from '@/lib/api';
import { AuthContext } from '../hooks/useAuth';

/** access_token 过期前提前刷新的秒数 */
const REFRESH_AHEAD_SEC = 60;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 清除刷新定时器 ──
  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // ── 安排下一次自动刷新 ──
  const scheduleRefresh = useCallback(
    (expiresIn: number) => {
      clearRefreshTimer();
      const delayMs = Math.max((expiresIn - REFRESH_AHEAD_SEC) * 1000, 5000);
      refreshTimerRef.current = setTimeout(async () => {
        const rt = getRefreshToken();
        if (!rt) return;
        try {
          const tokens = await authApi.refresh(rt);
          scheduleRefresh(tokens.expiresIn);
        } catch {
          // refresh 失败 — 静默清除，用户下次操作时触发 401 流程
          clearTokens();
          setUser(null);
        }
      }, delayMs);
    },
    [clearRefreshTimer],
  );

  // ── 获取当前用户信息 ──
  const refreshUser = useCallback(async () => {
    try {
      const u = await authApi.me();
      setUser(u);
    } catch {
      setUser(null);
    }
  }, []);

  // ── 初始化：检查已有 token ──
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const token = getAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const u = await authApi.me();
        if (!cancelled) setUser(u);
      } catch (err) {
        // token 无效，尝试 refresh
        if (err instanceof ApiError && err.status === 401) {
          const rt = getRefreshToken();
          if (rt) {
            try {
              const tokens = await authApi.refresh(rt);
              const u = await authApi.me();
              if (!cancelled) {
                setUser(u);
                scheduleRefresh(tokens.expiresIn);
              }
            } catch {
              if (!cancelled) {
                clearTokens();
                setUser(null);
              }
            }
          } else if (!cancelled) {
            clearTokens();
            setUser(null);
          }
        } else if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [scheduleRefresh]);

  // ── 卸载时清除定时器 ──
  useEffect(() => clearRefreshTimer, [clearRefreshTimer]);

  // ── login ──
  const login = useCallback(
    async (data: LoginRequest) => {
      const result = await authApi.login(data);
      setUser(result.user);
      scheduleRefresh(result.expiresIn);
    },
    [scheduleRefresh],
  );

  // ── register ──
  const register = useCallback(
    async (data: RegisterRequest) => {
      const result = await authApi.register(data);
      setUser(result.user);
      scheduleRefresh(result.expiresIn);
    },
    [scheduleRefresh],
  );

  // ── logout ──
  const logout = useCallback(() => {
    clearRefreshTimer();
    authApi.logout();
    setUser(null);
  }, [clearRefreshTimer]);

  // ── Context value（useMemo 避免不必要渲染） ──
  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
