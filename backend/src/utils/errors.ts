/**
 * 统一错误码注册表 + AppError 类
 * 2026-04-07 新增 — P1.07 错误码注册表
 * 设计思路：所有业务错误通过 AppError 抛出，errorHandler 中间件统一捕获序列化
 *   code 为机器可读标识，message 为开发调试信息（英文），前端根据 code 查 i18n 映射
 * 影响范围：全局错误处理、所有路由/服务
 * 潜在风险：无已知风险
 */

// ── 错误码 → HTTP 状态码 + 默认消息 映射 ──────────────
export interface ErrorDef {
  httpStatus: number;
  defaultMessage: string;
}

export const ERROR_CODES = {
  // ── AUTH（认证与授权）──
  AUTH_TOKEN_EXPIRED: { httpStatus: 401, defaultMessage: 'Access token has expired' },
  AUTH_TOKEN_INVALID: { httpStatus: 401, defaultMessage: 'Access token is invalid' },
  AUTH_REFRESH_EXPIRED: { httpStatus: 401, defaultMessage: 'Refresh token has expired' },
  AUTH_UNAUTHORIZED: { httpStatus: 401, defaultMessage: 'Authentication required' },
  AUTH_LOGIN_FAILED: { httpStatus: 401, defaultMessage: 'Invalid email or password' },
  AUTH_EMAIL_EXISTS: { httpStatus: 409, defaultMessage: 'Email already registered' },
  AUTH_USERNAME_EXISTS: { httpStatus: 409, defaultMessage: 'Username already taken' },
  AUTH_CODE_INVALID: { httpStatus: 401, defaultMessage: 'Authorization code is invalid' },
  AUTH_CODE_EXPIRED: { httpStatus: 401, defaultMessage: 'Authorization code has expired' },
  AUTH_PROVIDER_ERROR: { httpStatus: 502, defaultMessage: 'OAuth provider error' },

  // ── VALIDATION（输入校验）──
  VALIDATION_FAILED: { httpStatus: 400, defaultMessage: 'Input validation failed' },
  VALIDATION_INPUT_TOO_LONG: { httpStatus: 400, defaultMessage: 'Input exceeds maximum length' },
  VALIDATION_INPUT_INVALID: { httpStatus: 400, defaultMessage: 'Input format is invalid' },
  VALIDATION_MISSING_FIELD: { httpStatus: 400, defaultMessage: 'Required field is missing' },
  VALIDATION_FORMAT_ERROR: { httpStatus: 400, defaultMessage: 'Data format error' },

  // ── RATE（限流）──
  RATE_LIMIT_EXCEEDED: { httpStatus: 429, defaultMessage: 'Too many requests' },
  RATE_AI_LIMIT_EXCEEDED: { httpStatus: 429, defaultMessage: 'AI enhancement rate limit exceeded' },
  RATE_LOGIN_LIMIT_EXCEEDED: { httpStatus: 429, defaultMessage: 'Too many login attempts' },
  RATE_SEARCH_LIMIT_EXCEEDED: { httpStatus: 429, defaultMessage: 'Search rate limit exceeded' },

  // ── BLACKLIST（黑名单）──
  BLACKLIST_BLOCKED: { httpStatus: 403, defaultMessage: 'Access denied: you have been blocked' },
  BLACKLIST_IP_BLOCKED: { httpStatus: 403, defaultMessage: 'IP address is blocked' },
  BLACKLIST_USER_BLOCKED: { httpStatus: 403, defaultMessage: 'User account is blocked' },
  BLACKLIST_FINGERPRINT_BLOCKED: { httpStatus: 403, defaultMessage: 'Device is blocked' },

  // ── AI（AI 网关）──
  AI_PROVIDER_ERROR: { httpStatus: 502, defaultMessage: 'AI provider returned an error' },
  AI_MODEL_UNAVAILABLE: { httpStatus: 503, defaultMessage: 'Requested model is unavailable' },
  AI_TIMEOUT: { httpStatus: 504, defaultMessage: 'AI request timed out' },
  AI_RATE_LIMITED: { httpStatus: 429, defaultMessage: 'AI provider rate limited' },
  AI_CONTENT_FILTERED: { httpStatus: 400, defaultMessage: 'Content was filtered by AI provider' },
  AI_INVALID_RESPONSE: { httpStatus: 502, defaultMessage: 'AI provider returned invalid response' },

  // ── PROVIDER（Provider 管理）──
  PROVIDER_NOT_FOUND: { httpStatus: 404, defaultMessage: 'Provider not found' },
  PROVIDER_INACTIVE: { httpStatus: 400, defaultMessage: 'Provider is inactive' },
  PROVIDER_CONFIG_ERROR: { httpStatus: 400, defaultMessage: 'Provider configuration error' },
  PROVIDER_LIMIT_REACHED: { httpStatus: 429, defaultMessage: 'Provider request limit reached' },
  // 2026-04-09 新增 — Provider API Key 解密失败（PROVIDER_ENCRYPTION_KEY 不匹配）
  PROVIDER_KEY_DECRYPT_FAILED: {
    httpStatus: 500,
    defaultMessage: 'Provider API key decryption failed',
  },

  // ── RESOURCE（资源操作）──
  RESOURCE_NOT_FOUND: { httpStatus: 404, defaultMessage: 'Resource not found' },
  RESOURCE_ALREADY_EXISTS: { httpStatus: 409, defaultMessage: 'Resource already exists' },
  RESOURCE_CONFLICT: { httpStatus: 409, defaultMessage: 'Resource conflict' },

  // ── PERMISSION（权限）──
  PERMISSION_DENIED: { httpStatus: 403, defaultMessage: 'Permission denied' },
  PERMISSION_ADMIN_REQUIRED: { httpStatus: 403, defaultMessage: 'Admin privileges required' },
  PERMISSION_OWNER_REQUIRED: { httpStatus: 403, defaultMessage: 'Owner privileges required' },

  // ── SYSTEM（系统）──
  SYSTEM_INTERNAL_ERROR: { httpStatus: 500, defaultMessage: 'Internal server error' },
  SYSTEM_MAINTENANCE: { httpStatus: 503, defaultMessage: 'Service under maintenance' },
  SYSTEM_DEPENDENCY_FAILED: { httpStatus: 503, defaultMessage: 'Dependency service failed' },
} as const satisfies Record<string, ErrorDef>;

export type ErrorCode = keyof typeof ERROR_CODES;

// ── AppError 类 ──────────────────────────────────────
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message?: string, details?: Record<string, unknown>) {
    const def = ERROR_CODES[code];
    super(message ?? def.defaultMessage);
    this.code = code;
    this.statusCode = def.httpStatus;
    this.details = details;
    this.name = 'AppError';

    // 保持原型链（TypeScript extends Error 的已知问题）
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * 从错误码快速构建 AppError
   * @param code  错误码
   * @param overrides  可覆盖 message / details
   */
  static fromCode(
    code: ErrorCode,
    overrides?: { message?: string; details?: Record<string, unknown> },
  ): AppError {
    return new AppError(code, overrides?.message, overrides?.details);
  }
}
