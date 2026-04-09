/**
 * 密码哈希工具 单元测试
 * 2026-04-07 新增 — P1.13 验证
 */

import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '../password';

describe('password utils', () => {
  it('should hash a password and verify it', async () => {
    const password = 'MySecureP@ss1';
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2b$')).toBe(true); // bcrypt prefix

    const match = await comparePassword(password, hash);
    expect(match).toBe(true);
  });

  it('should reject wrong password', async () => {
    const hash = await hashPassword('correct-password');
    const match = await comparePassword('wrong-password', hash);
    expect(match).toBe(false);
  });

  it('should produce different hashes for same password (random salt)', async () => {
    const password = 'SamePassword1';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    expect(hash1).not.toBe(hash2);
    // 但两者都能验证
    expect(await comparePassword(password, hash1)).toBe(true);
    expect(await comparePassword(password, hash2)).toBe(true);
  });
});
