/**
 * Provider 加密/解密工具 单元测试
 * 2026-04-07 新增 — P1.25 验证
 */

import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../crypto';

describe('encrypt / decrypt', () => {
  it('should round-trip a plaintext string', () => {
    const plaintext = 'sk-test-api-key-12345';
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext).toContain(':'); // iv:encrypted 格式
    const decrypted = decrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for same plaintext (random IV)', () => {
    const plaintext = 'same-key';
    const c1 = encrypt(plaintext);
    const c2 = encrypt(plaintext);
    expect(c1).not.toBe(c2);
    // 但两者都能解密回原文
    expect(decrypt(c1)).toBe(plaintext);
    expect(decrypt(c2)).toBe(plaintext);
  });

  it('should handle empty string', () => {
    const ciphertext = encrypt('');
    expect(decrypt(ciphertext)).toBe('');
  });

  it('should handle unicode characters', () => {
    const plaintext = '密钥-テスト-🔑';
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('should throw on invalid ciphertext format', () => {
    expect(() => decrypt('invalid')).toThrow('Invalid ciphertext format');
  });
});
