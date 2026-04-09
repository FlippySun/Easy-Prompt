/**
 * AppError + 错误码注册表 单元测试
 * 2026-04-07 新增 — P1.07 验证
 */

import { describe, it, expect } from 'vitest';
import { AppError, ERROR_CODES } from '../errors';

describe('AppError', () => {
  it('should create with default message from error code', () => {
    const err = new AppError('AUTH_TOKEN_EXPIRED');
    expect(err.code).toBe('AUTH_TOKEN_EXPIRED');
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Access token has expired');
    expect(err.name).toBe('AppError');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('should allow custom message override', () => {
    const err = new AppError('VALIDATION_FAILED', 'Custom message');
    expect(err.message).toBe('Custom message');
    expect(err.statusCode).toBe(400);
  });

  it('should carry details object', () => {
    const details = { field: 'email', reason: 'invalid' };
    const err = new AppError('VALIDATION_FAILED', undefined, details);
    expect(err.details).toEqual(details);
  });

  it('fromCode() factory should work', () => {
    const err = AppError.fromCode('RATE_LIMIT_EXCEEDED', {
      message: 'Slow down',
      details: { retryAfter: 60 },
    });
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(err.statusCode).toBe(429);
    expect(err.message).toBe('Slow down');
    expect(err.details).toEqual({ retryAfter: 60 });
  });
});

describe('ERROR_CODES', () => {
  it('should have httpStatus and defaultMessage for every code', () => {
    for (const [code, def] of Object.entries(ERROR_CODES)) {
      expect(def.httpStatus, `${code} missing httpStatus`).toBeGreaterThanOrEqual(400);
      expect(def.defaultMessage, `${code} missing defaultMessage`).toBeTruthy();
    }
  });

  it('should contain expected categories', () => {
    const codes = Object.keys(ERROR_CODES);
    expect(codes.some((c) => c.startsWith('AUTH_'))).toBe(true);
    expect(codes.some((c) => c.startsWith('VALIDATION_'))).toBe(true);
    expect(codes.some((c) => c.startsWith('RATE_'))).toBe(true);
    expect(codes.some((c) => c.startsWith('BLACKLIST_'))).toBe(true);
    expect(codes.some((c) => c.startsWith('AI_'))).toBe(true);
    expect(codes.some((c) => c.startsWith('SYSTEM_'))).toBe(true);
  });
});
