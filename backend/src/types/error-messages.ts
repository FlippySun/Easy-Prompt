/**
 * 错误码 → 前端 i18n 映射表
 * 2026-04-08 新增 — P4.08 Error Handling 增强
 * 变更类型：新增
 * 设计思路：
 *   覆盖 errors.ts 中全部 41 个错误码的 zh-CN / en 翻译
 *   前端可直接导入此映射表，根据 API 返回的 code 字段查找用户可见消息
 *   翻译文本面向最终用户（非开发者），语气友好
 * 参数：ERROR_MESSAGES[locale][errorCode]
 * 返回：string — 用户可见的错误提示
 * 影响范围：前端错误展示（web-hub、浏览器扩展等）
 * 潜在风险：无已知风险
 */

import type { ErrorCode } from '../utils/errors';

// ── 支持的语言 ──────────────────────────────────────────

export type SupportedLocale = 'zh-CN' | 'en';

// ── 错误码 i18n 映射表 ──────────────────────────────────

export const ERROR_MESSAGES: Record<SupportedLocale, Record<ErrorCode, string>> = {
  'zh-CN': {
    // ── AUTH（认证与授权）——10 个 ──
    AUTH_TOKEN_EXPIRED: '登录已过期，请重新登录',
    AUTH_TOKEN_INVALID: '登录凭证无效，请重新登录',
    AUTH_REFRESH_EXPIRED: '登录已过期，请重新登录',
    AUTH_UNAUTHORIZED: '请先登录后再操作',
    AUTH_LOGIN_FAILED: '邮箱或密码错误',
    AUTH_EMAIL_EXISTS: '该邮箱已被注册',
    AUTH_USERNAME_EXISTS: '该用户名已被占用',
    AUTH_CODE_INVALID: '授权码无效，请重新登录',
    AUTH_CODE_EXPIRED: '授权码已过期，请重新登录',
    AUTH_PROVIDER_ERROR: '第三方登录服务暂时不可用，请稍后再试',

    // ── VALIDATION（输入校验）——5 个 ──
    VALIDATION_FAILED: '输入验证失败，请检查后重试',
    VALIDATION_INPUT_TOO_LONG: '输入内容超过长度限制',
    VALIDATION_INPUT_INVALID: '输入格式不正确',
    VALIDATION_MISSING_FIELD: '请填写必填项',
    VALIDATION_FORMAT_ERROR: '数据格式错误，请检查后重试',

    // ── RATE（限流）——4 个 ──
    RATE_LIMIT_EXCEEDED: '请求过于频繁，请稍后再试',
    RATE_AI_LIMIT_EXCEEDED: 'AI 增强使用过于频繁，请稍后再试',
    RATE_LOGIN_LIMIT_EXCEEDED: '登录尝试次数过多，请稍后再试',
    RATE_SEARCH_LIMIT_EXCEEDED: '搜索过于频繁，请稍后再试',

    // ── BLACKLIST（黑名单）——4 个 ──
    BLACKLIST_BLOCKED: '访问受限，您的账户已被限制',
    BLACKLIST_IP_BLOCKED: '访问受限，您的 IP 地址已被限制',
    BLACKLIST_USER_BLOCKED: '访问受限，您的账户已被封禁',
    BLACKLIST_FINGERPRINT_BLOCKED: '访问受限，您的设备已被限制',

    // ── AI（AI 网关）——6 个 ──
    AI_PROVIDER_ERROR: 'AI 服务暂时不可用，请稍后重试',
    AI_MODEL_UNAVAILABLE: '所选 AI 模型暂时不可用',
    AI_TIMEOUT: 'AI 请求超时，请稍后重试',
    AI_RATE_LIMITED: 'AI 服务繁忙，请稍后重试',
    AI_CONTENT_FILTERED: '内容被 AI 服务过滤，请修改后重试',
    AI_INVALID_RESPONSE: 'AI 服务返回异常，请稍后重试',

    // ── PROVIDER（Provider 管理）——4 个 ──
    PROVIDER_NOT_FOUND: '服务提供商不存在',
    PROVIDER_INACTIVE: '服务提供商已停用',
    PROVIDER_CONFIG_ERROR: '服务提供商配置有误',
    PROVIDER_LIMIT_REACHED: '服务提供商请求额度已用完',
    PROVIDER_KEY_DECRYPT_FAILED: '服务提供商密钥解密失败，请联系管理员',

    // ── RESOURCE（资源操作）——3 个 ──
    RESOURCE_NOT_FOUND: '请求的内容不存在',
    RESOURCE_ALREADY_EXISTS: '内容已存在',
    RESOURCE_CONFLICT: '操作冲突，请刷新后重试',

    // ── PERMISSION（权限）——3 个 ──
    PERMISSION_DENIED: '没有权限执行此操作',
    PERMISSION_ADMIN_REQUIRED: '需要管理员权限',
    PERMISSION_OWNER_REQUIRED: '仅内容作者可执行此操作',

    // ── SYSTEM（系统）——3 个 ──
    SYSTEM_INTERNAL_ERROR: '系统内部错误，请稍后重试',
    SYSTEM_MAINTENANCE: '系统维护中，请稍后访问',
    SYSTEM_DEPENDENCY_FAILED: '依赖服务不可用，请稍后重试',
  },

  en: {
    // ── AUTH（认证与授权）——10 个 ──
    AUTH_TOKEN_EXPIRED: 'Session expired, please login again',
    AUTH_TOKEN_INVALID: 'Invalid credentials, please login again',
    AUTH_REFRESH_EXPIRED: 'Session expired, please login again',
    AUTH_UNAUTHORIZED: 'Please login to continue',
    AUTH_LOGIN_FAILED: 'Incorrect email or password',
    AUTH_EMAIL_EXISTS: 'This email is already registered',
    AUTH_USERNAME_EXISTS: 'This username is already taken',
    AUTH_CODE_INVALID: 'Authorization code is invalid, please login again',
    AUTH_CODE_EXPIRED: 'Authorization code has expired, please login again',
    AUTH_PROVIDER_ERROR: 'Third-party login service is temporarily unavailable',

    // ── VALIDATION（输入校验）——5 个 ──
    VALIDATION_FAILED: 'Input validation failed, please check and try again',
    VALIDATION_INPUT_TOO_LONG: 'Input exceeds the maximum allowed length',
    VALIDATION_INPUT_INVALID: 'Input format is incorrect',
    VALIDATION_MISSING_FIELD: 'Please fill in all required fields',
    VALIDATION_FORMAT_ERROR: 'Data format error, please check and try again',

    // ── RATE（限流）——4 个 ──
    RATE_LIMIT_EXCEEDED: 'Too many requests, please try again later',
    RATE_AI_LIMIT_EXCEEDED: 'AI enhancement rate limit reached, please try again later',
    RATE_LOGIN_LIMIT_EXCEEDED: 'Too many login attempts, please try again later',
    RATE_SEARCH_LIMIT_EXCEEDED: 'Search rate limit reached, please try again later',

    // ── BLACKLIST（黑名单）——4 个 ──
    BLACKLIST_BLOCKED: 'Access denied: your account has been restricted',
    BLACKLIST_IP_BLOCKED: 'Access denied: your IP address has been blocked',
    BLACKLIST_USER_BLOCKED: 'Access denied: your account has been suspended',
    BLACKLIST_FINGERPRINT_BLOCKED: 'Access denied: your device has been restricted',

    // ── AI（AI 网关）——6 个 ──
    AI_PROVIDER_ERROR: 'AI service is temporarily unavailable, please try again later',
    AI_MODEL_UNAVAILABLE: 'The selected AI model is currently unavailable',
    AI_TIMEOUT: 'AI request timed out, please try again later',
    AI_RATE_LIMITED: 'AI service is busy, please try again later',
    AI_CONTENT_FILTERED: 'Content was filtered by AI, please modify and try again',
    AI_INVALID_RESPONSE: 'AI service returned an unexpected response, please try again',

    // ── PROVIDER（Provider 管理）——4 个 ──
    PROVIDER_NOT_FOUND: 'Service provider not found',
    PROVIDER_INACTIVE: 'Service provider is inactive',
    PROVIDER_CONFIG_ERROR: 'Service provider configuration error',
    PROVIDER_LIMIT_REACHED: 'Service provider request limit reached',
    PROVIDER_KEY_DECRYPT_FAILED: 'Provider API key decryption failed, please contact admin',

    // ── RESOURCE（资源操作）——3 个 ──
    RESOURCE_NOT_FOUND: 'The requested content was not found',
    RESOURCE_ALREADY_EXISTS: 'This content already exists',
    RESOURCE_CONFLICT: 'Operation conflict, please refresh and try again',

    // ── PERMISSION（权限）——3 个 ──
    PERMISSION_DENIED: 'You do not have permission to perform this action',
    PERMISSION_ADMIN_REQUIRED: 'Administrator privileges required',
    PERMISSION_OWNER_REQUIRED: 'Only the content owner can perform this action',

    // ── SYSTEM（系统）——3 个 ──
    SYSTEM_INTERNAL_ERROR: 'Internal server error, please try again later',
    SYSTEM_MAINTENANCE: 'System is under maintenance, please try again later',
    SYSTEM_DEPENDENCY_FAILED: 'A dependent service is unavailable, please try again later',
  },
};

// ── 辅助函数 ─────────────────────────────────────────────

/**
 * 根据错误码和语言获取用户可见的错误消息
 * @param code - ErrorCode
 * @param locale - 语言（默认 zh-CN）
 * @returns 用户可见的错误提示字符串
 */
export function getErrorMessage(code: ErrorCode, locale: SupportedLocale = 'zh-CN'): string {
  return ERROR_MESSAGES[locale]?.[code] ?? ERROR_MESSAGES.en[code] ?? code;
}

/**
 * 获取所有支持的错误码列表
 * @returns ErrorCode[]
 */
export function getAllErrorCodes(): ErrorCode[] {
  return Object.keys(ERROR_MESSAGES.en) as ErrorCode[];
}
