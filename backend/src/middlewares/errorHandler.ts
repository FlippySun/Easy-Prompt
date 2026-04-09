/**
 * 全局错误处理中间件
 * 2026-04-07 新增 — P1.08
 * 2026-04-08 修改 — P4.08 接入 error-messages i18n 映射
 * 设计思路：捕获所有未处理异常，将 AppError 序列化为统一 JSON 格式
 *   非 AppError 异常统一返回 500，生产环境隐藏内部错误信息
 *   通过 Accept-Language 头检测客户端语言，返回本地化错误消息
 * 影响范围：Express 错误管道末端
 * 潜在风险：无已知风险
 */

import type { Request, Response, NextFunction } from 'express';
import { AppError, ERROR_CODES } from '../utils/errors';
import { createChildLogger } from '../utils/logger';
import { isProd } from '../config';
import type { ApiErrorResponse } from '../types/common';
// 2026-04-08 新增 — P4.08 接入 i18n 错误消息映射
import { getErrorMessage, type SupportedLocale } from '../types/error-messages';
import type { ErrorCode } from '../utils/errors';

const log = createChildLogger('error-handler');

/**
 * 从 Accept-Language 头提取客户端语言偏好
 * 2026-04-08 新增 — P4.08
 * 支持 zh-CN / en，默认 zh-CN
 */
function detectLocale(req: Request): SupportedLocale {
  const accept = req.headers['accept-language'] ?? '';
  // 简单匹配：含 en 且不含 zh → en；否则默认 zh-CN
  if (/\ben\b/i.test(accept) && !/zh/i.test(accept)) return 'en';
  return 'zh-CN';
}

/**
 * Express 4 params 错误中间件签名 (err, req, res, next)
 * Express 5 同样兼容
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  // ── 已知业务异常 ──
  if (err instanceof AppError) {
    // 2026-04-08 P4.08 — 使用 i18n 映射返回本地化错误消息
    const locale = detectLocale(req);
    const localizedMessage = getErrorMessage(err.code as ErrorCode, locale);

    const body: ApiErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: localizedMessage,
        details: err.details,
        httpStatus: err.statusCode,
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    };

    // 4xx 仅 warn，5xx 才 error
    if (err.statusCode >= 500) {
      log.error({ err, path: req.path, method: req.method }, 'Server error');
    } else {
      log.warn({ code: err.code, path: req.path, method: req.method }, err.message);
    }

    res.status(err.statusCode).json(body);
    return;
  }

  // ── 未知异常 ──
  log.error({ err, path: req.path, method: req.method, stack: err.stack }, 'Unhandled error');

  const fallback = ERROR_CODES.SYSTEM_INTERNAL_ERROR;
  const locale = detectLocale(req);
  const localizedFallback = getErrorMessage('SYSTEM_INTERNAL_ERROR', locale);

  const body: ApiErrorResponse = {
    success: false,
    error: {
      code: 'SYSTEM_INTERNAL_ERROR',
      message: isProd ? localizedFallback : err.message || localizedFallback,
      httpStatus: fallback.httpStatus,
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    },
  };

  res.status(fallback.httpStatus).json(body);
}
