/**
 * 统一 API 客户端 — 基于 fetch 的类型安全 HTTP 封装
 * 2026-04-09 新增 — P5.01 API Client 封装
 * 变更类型：新增
 * 设计思路：
 *   1. base URL 通过 VITE_API_BASE 环境变量配置（生产 api.zhiz.chat / 开发 localhost:3000）
 *   2. 自动附加 credentials: 'include'（cookie 跨域）
 *   3. 每次请求附加 X-Request-Id（UUID v4）方便链路追踪
 *   4. 请求拦截：附加 access_token（localStorage 存储）
 *   5. 响应拦截：401 自动 refresh token 并重试原请求（仅一次）
 *   6. 请求超时 15s（AbortController）
 *   7. TypeScript 泛型：api.get<T>(), api.post<T>() 等
 * 参数：环境变量 VITE_API_BASE
 * 影响范围：web-hub 全局 API 调用
 * 潜在风险：refresh token 竞态——用 _refreshPromise 单例锁防止并发刷新
 */

import { ApiError } from './types';
import type { ApiErrorResponse } from './types';

// ── 常量 ─────────────────────────────────────────────────

/** API 基础路径（Vite 环境变量，无尾部斜杠） */
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '') ?? '';

/** 请求默认超时（毫秒） */
const REQUEST_TIMEOUT_MS = 15_000;

/** localStorage key — access / refresh token */
const TOKEN_KEY = 'ep-hub-access-token';
const REFRESH_KEY = 'ep-hub-refresh-token';

// ── Token 管理 ───────────────────────────────────────────

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// ── UUID v4 生成（无外部依赖） ────────────────────────────

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // 回退：简易 UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Refresh Token 单例锁 ─────────────────────────────────

/**
 * 2026-04-09 — 防止并发 401 同时触发多次 refresh
 * 第一个 401 发起 refresh，后续 401 等待同一个 Promise
 */
let _refreshPromise: Promise<boolean> | null = null;

/**
 * 尝试用 refreshToken 换取新的 token 对
 * @returns true=刷新成功, false=刷新失败（需跳登录）
 */
async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      return false;
    }

    const json = await res.json();
    if (json.success && json.data?.accessToken && json.data?.refreshToken) {
      setTokens(json.data.accessToken, json.data.refreshToken);
      return true;
    }

    clearTokens();
    return false;
  } catch {
    clearTokens();
    return false;
  }
}

// ── 核心请求函数 ─────────────────────────────────────────

interface RequestOptions {
  /** HTTP 方法 */
  method: string;
  /** 请求路径（相对于 API_BASE，如 /api/v1/prompts） */
  path: string;
  /** URL 查询参数 */
  params?: Record<string, unknown>;
  /** JSON body */
  body?: unknown;
  /** 跳过自动附加 Authorization 头 */
  skipAuth?: boolean;
  /** 标记为重试请求（内部使用，防止无限重试） */
  _isRetry?: boolean;
}

/**
 * 构建完整 URL（含查询参数）
 * 过滤掉 undefined/null 值，数组参数展平为 key=v1&key=v2
 */
function buildUrl(path: string, params?: Record<string, unknown>): string {
  const url = new URL(path, API_BASE || window.location.origin);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) {
          url.searchParams.append(key, String(v));
        }
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

/**
 * 核心 fetch 请求
 * 自动处理：auth header, timeout, 401 refresh + retry, error parsing
 */
async function request<T>(opts: RequestOptions): Promise<T> {
  const { method, path, params, body, skipAuth = false, _isRetry = false } = opts;

  // ── 构建 headers ──
  const headers: Record<string, string> = {
    'X-Request-Id': uuid(),
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // ── AbortController 超时 ──
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(buildUrl(path, params), {
      method,
      headers,
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    // ── 401 → 尝试 refresh + 重试 ──
    if (res.status === 401 && !_isRetry && !skipAuth) {
      if (!_refreshPromise) {
        _refreshPromise = tryRefreshToken().finally(() => {
          _refreshPromise = null;
        });
      }

      const refreshed = await _refreshPromise;
      if (refreshed) {
        return request<T>({ ...opts, _isRetry: true });
      }

      // refresh 失败，抛出 401 错误（上层 AuthProvider 会处理跳转）
      throw new ApiError('AUTH_TOKEN_EXPIRED', '登录已过期，请重新登录', 401);
    }

    // ── 204 No Content ──
    if (res.status === 204) {
      return null as T;
    }

    const json = await res.json();

    // ── 业务错误 ──
    if (!res.ok || json.success === false) {
      const err = json as ApiErrorResponse;
      throw new ApiError(
        err.error?.code ?? 'SYSTEM_INTERNAL_ERROR',
        err.error?.message ?? res.statusText,
        res.status,
        err.error?.details,
      );
    }

    // ── 成功：返回整个 json（调用方按需取 .data / .meta） ──
    return json as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    // fetch 被 abort → 超时
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('AI_TIMEOUT', '请求超时，请稍后重试', 408);
    }

    // 网络错误
    throw new ApiError('SYSTEM_DEPENDENCY_FAILED', error instanceof Error ? error.message : '网络请求失败', 0);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── 对外暴露的 HTTP 方法 ─────────────────────────────────

/**
 * 泛型 GET 请求
 * @param path - API 路径，如 '/api/v1/prompts'
 * @param params - URL 查询参数
 */
export function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  return request<T>({ method: 'GET', path, params });
}

/**
 * 泛型 POST 请求
 * @param path - API 路径
 * @param body - JSON body
 */
export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>({ method: 'POST', path, body });
}

/**
 * 泛型 PUT 请求
 */
export function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>({ method: 'PUT', path, body });
}

/**
 * 泛型 DELETE 请求
 */
export function del<T>(path: string, body?: unknown): Promise<T> {
  return request<T>({ method: 'DELETE', path, body });
}

/**
 * 无需 Auth 的 POST（登录/注册/refresh 专用）
 */
export function postPublic<T>(path: string, body?: unknown): Promise<T> {
  return request<T>({ method: 'POST', path, body, skipAuth: true });
}
