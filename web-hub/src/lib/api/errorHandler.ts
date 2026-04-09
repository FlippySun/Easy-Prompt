/**
 * errorHandler — 全局 API 错误处理与用户提示
 * 2026-04-09 新增 — P5.12 错误处理统一
 * 变更类型：新增
 * 设计思路：
 *   1. 解析 ApiError → 根据 status / code 映射为中文友好消息
 *   2. 使用 sonner toast 通知用户
 *   3. 401 → 已由 client.ts refresh 机制处理，此处仅提示"登录已过期"
 *   4. 429 → 含 retry_after 信息
 *   5. 网络错误 → "网络连接异常"
 *   6. 提供 handleApiError() 统一入口供 hook / 组件调用
 * 参数：error — unknown
 * 返回：用户友好错误消息 string
 * 影响范围：所有 API 调用错误处理
 * 潜在风险：无已知风险
 */

import { toast } from 'sonner';
import { ApiError } from './types';

// ── 错误码 → 中文消息映射 ────────────────────────────────

const ERROR_CODE_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: '邮箱或密码错误',
  EMAIL_EXISTS: '该邮箱已注册',
  USERNAME_EXISTS: '该用户名已被占用',
  INVALID_TOKEN: '登录凭证无效，请重新登录',
  TOKEN_EXPIRED: '登录已过期，请重新登录',
  USER_NOT_FOUND: '用户不存在',
  PROMPT_NOT_FOUND: 'Prompt 不存在或已删除',
  COLLECTION_NOT_FOUND: '合集不存在或已删除',
  FORBIDDEN: '没有权限执行此操作',
  RATE_LIMITED: '请求过于频繁，请稍后重试',
  VALIDATION_ERROR: '输入数据格式有误，请检查后重试',
  INTERNAL_ERROR: '服务器异常，请稍后重试',
};

// ── HTTP 状态码 → 默认消息 ───────────────────────────────

const STATUS_MESSAGES: Record<number, string> = {
  400: '请求参数错误',
  401: '登录已过期，请重新登录',
  403: '没有权限执行此操作',
  404: '请求的资源不存在',
  409: '操作冲突，请刷新后重试',
  422: '输入数据格式有误',
  429: '请求过于频繁，请稍后重试',
  500: '服务器异常，请稍后重试',
  502: '服务暂时不可用，请稍后重试',
  503: '服务维护中，请稍后重试',
};

// ── 核心函数 ─────────────────────────────────────────────

/**
 * 将任意错误转换为用户友好的中文消息
 * 2026-04-09 — 统一错误消息解析入口
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // 优先使用错误码映射
    if (error.code && ERROR_CODE_MESSAGES[error.code]) {
      return ERROR_CODE_MESSAGES[error.code];
    }
    // 429 特殊处理：附加 retry_after
    if (error.status === 429) {
      const retryAfter = (error.details as Record<string, unknown>)?.retry_after;
      if (retryAfter) {
        return `请求过于频繁，请 ${retryAfter} 秒后重试`;
      }
    }
    // 按 HTTP 状态码
    if (error.status && STATUS_MESSAGES[error.status]) {
      return STATUS_MESSAGES[error.status];
    }
    // 后端返回的 message
    if (error.message && error.message !== 'Unknown error') {
      return error.message;
    }
    return '操作失败，请稍后重试';
  }

  // 网络错误（fetch 失败等）
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return '网络连接异常，请检查网络后重试';
  }

  // AbortError（超时）
  if (error instanceof DOMException && error.name === 'AbortError') {
    return '请求超时，请检查网络后重试';
  }

  // 通用 Error
  if (error instanceof Error) {
    return error.message || '未知错误';
  }

  return '未知错误，请稍后重试';
}

/**
 * 统一 API 错误处理：解析错误 → toast 通知
 * 2026-04-09 — 供 hook / 组件在 catch 块中调用
 * @param error - 捕获到的错误
 * @param context - 可选的操作上下文描述（如"加载 Prompt 列表"）
 * @returns 用户友好错误消息
 */
export function handleApiError(error: unknown, context?: string): string {
  const message = getErrorMessage(error);
  const displayMessage = context ? `${context}失败：${message}` : message;

  // 401 不弹 toast（由 AuthProvider refresh 机制处理）
  if (error instanceof ApiError && error.status === 401) {
    return displayMessage;
  }

  toast.error(displayMessage, {
    duration: error instanceof ApiError && error.status === 429 ? 6000 : 4000,
  });

  return displayMessage;
}

/**
 * 判断错误是否为需要登录的 401 错误
 * 2026-04-09 — 供页面组件判断是否需要跳转登录
 */
export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/**
 * 判断错误是否为网络错误
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) return true;
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  return false;
}
