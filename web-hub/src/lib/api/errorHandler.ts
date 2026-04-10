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

// 2026-04-10 修复 — 前后端错误码全量对齐审计
// 变更类型：修复
// 设计思路：错误码 key 必须与后端 ERROR_CODES（utils/errors.ts）完全一致，
//   旧版使用了自编 key（如 INVALID_CREDENTIALS），导致全局 handleApiError()
//   永远无法匹配后端返回的 code，退化为仅靠 HTTP 状态码的泛化提示
// 影响范围：所有使用 handleApiError() / getErrorMessage() 的组件
// 潜在风险：无已知风险
const ERROR_CODE_MESSAGES: Record<string, string> = {
  // ── AUTH ──
  AUTH_TOKEN_EXPIRED: '登录已过期，请重新登录',
  AUTH_TOKEN_INVALID: '登录凭证无效，请重新登录',
  AUTH_REFRESH_EXPIRED: '登录已过期，请重新登录',
  AUTH_UNAUTHORIZED: '请先登录',
  AUTH_LOGIN_FAILED: '邮箱或密码错误',
  AUTH_EMAIL_EXISTS: '该邮箱已被注册',
  AUTH_USERNAME_EXISTS: '该用户名已被占用',
  AUTH_CODE_INVALID: '授权码无效，请重新登录',
  AUTH_CODE_EXPIRED: '授权码已过期，请重新登录',
  AUTH_PROVIDER_ERROR: '第三方登录服务异常，请稍后重试',
  // ── VALIDATION ──
  VALIDATION_FAILED: '输入格式有误，请检查后重试',
  VALIDATION_INPUT_TOO_LONG: '输入内容超出长度限制',
  VALIDATION_INPUT_INVALID: '输入格式不正确',
  VALIDATION_MISSING_FIELD: '缺少必填字段',
  VALIDATION_FORMAT_ERROR: '数据格式错误',
  // ── RATE ──
  RATE_LIMIT_EXCEEDED: '请求过于频繁，请稍后重试',
  RATE_AI_LIMIT_EXCEEDED: 'AI 增强次数已达上限，请稍后重试',
  RATE_LOGIN_LIMIT_EXCEEDED: '登录尝试次数过多，请稍后再试',
  RATE_SEARCH_LIMIT_EXCEEDED: '搜索过于频繁，请稍后重试',
  // ── BLACKLIST ──
  BLACKLIST_BLOCKED: '访问已被限制',
  BLACKLIST_IP_BLOCKED: 'IP 地址已被限制',
  BLACKLIST_USER_BLOCKED: '账户已被限制',
  BLACKLIST_FINGERPRINT_BLOCKED: '设备已被限制',
  // ── AI ──
  AI_PROVIDER_ERROR: 'AI 服务异常，请稍后重试',
  AI_MODEL_UNAVAILABLE: '当前模型不可用，请切换模型重试',
  AI_TIMEOUT: 'AI 请求超时，请稍后重试',
  AI_RATE_LIMITED: 'AI 服务限流，请稍后重试',
  AI_CONTENT_FILTERED: '内容被 AI 安全策略过滤',
  AI_INVALID_RESPONSE: 'AI 返回异常，请重试',
  // ── PROVIDER ──
  PROVIDER_NOT_FOUND: 'AI 服务商未配置',
  PROVIDER_INACTIVE: 'AI 服务商已停用',
  PROVIDER_CONFIG_ERROR: 'AI 服务商配置错误',
  PROVIDER_LIMIT_REACHED: 'AI 服务商请求上限',
  PROVIDER_KEY_DECRYPT_FAILED: 'AI 密钥解密失败，请联系管理员',
  // ── RESOURCE ──
  RESOURCE_NOT_FOUND: '请求的资源不存在',
  RESOURCE_ALREADY_EXISTS: '资源已存在',
  RESOURCE_CONFLICT: '操作冲突，请刷新后重试',
  // ── PERMISSION ──
  PERMISSION_DENIED: '没有权限执行此操作',
  PERMISSION_ADMIN_REQUIRED: '需要管理员权限',
  PERMISSION_OWNER_REQUIRED: '仅资源所有者可执行此操作',
  // ── SYSTEM ──
  SYSTEM_INTERNAL_ERROR: '服务器异常，请稍后重试',
  SYSTEM_MAINTENANCE: '服务维护中，请稍后重试',
  SYSTEM_DEPENDENCY_FAILED: '依赖服务异常，请稍后重试',
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
