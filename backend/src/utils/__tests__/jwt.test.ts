/**
 * JWT 工具 单元测试
 * 2026-04-07 新增 — P1.12 验证
 */

import { describe, it, expect } from 'vitest';
import { signAccessToken, signRefreshToken, verifyToken, verifyTokenSafe } from '../jwt';

const testPayload = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
  role: 'user' as const,
};

describe('JWT utils', () => {
  it('signAccessToken should produce a valid JWT', () => {
    const token = signAccessToken(testPayload);
    expect(token).toBeTruthy();
    expect(token.split('.')).toHaveLength(3); // header.payload.signature
  });

  it('verifyToken should decode the payload correctly', () => {
    const token = signAccessToken(testPayload);
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe(testPayload.userId);
    expect(decoded.email).toBe(testPayload.email);
    expect(decoded.role).toBe(testPayload.role);
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp).toBeDefined();
  });

  it('signRefreshToken should also produce a verifiable JWT', () => {
    const token = signRefreshToken(testPayload);
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe(testPayload.userId);
  });

  it('verifyToken should throw on invalid token', () => {
    expect(() => verifyToken('invalid.token.here')).toThrow();
  });

  it('verifyTokenSafe should return null on invalid token', () => {
    const result = verifyTokenSafe('invalid.token.here');
    expect(result).toBeNull();
  });

  it('verifyTokenSafe should return decoded on valid token', () => {
    const token = signAccessToken(testPayload);
    const result = verifyTokenSafe(token);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe(testPayload.userId);
  });
});
