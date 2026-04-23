/**
 * Provider 加密/解密工具 单元测试
 * 2026-04-07 新增 — P1.25 验证
 */

import { beforeAll, describe, it, expect } from 'vitest';
import { config } from '../../config';
import { decrypt, decryptOAuthToken, encrypt, encryptOAuthToken } from '../crypto';

beforeAll(() => {
  if (!config.OAUTH_TOKEN_ENCRYPTION_KEY) {
    config.OAUTH_TOKEN_ENCRYPTION_KEY = config.PROVIDER_ENCRYPTION_KEY;
  }
});

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

  it('should round-trip an OAuth token with the dedicated OAuth key', () => {
    const plaintext = 'zhiz-access-token-1234567890';
    const ciphertext = encryptOAuthToken(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext).toContain(':');
    expect(decryptOAuthToken(ciphertext)).toBe(plaintext);
  });

  /**
   * 2026-04-22 修复 — OAuth token key 回退兼容用例
   * 变更类型：fix/test
   * What：覆盖“缺失 dedicated key 时回退 Provider key”与“后续补 dedicated key 后仍可解密旧数据”两条回归链路。
   * Why：本轮线上报错正是因为老环境缺少 `OAUTH_TOKEN_ENCRYPTION_KEY`；测试需要把当前止血逻辑固化下来，防止未来再次回归。
   * Params & return：通过修改 `config.OAUTH_TOKEN_ENCRYPTION_KEY` 模拟不同部署状态；断言 `encryptOAuthToken()/decryptOAuthToken()` 仍能 round-trip。
   * Impact scope：backend/src/utils/crypto.ts、Zhiz OAuth callback、skill.service 中的 OAuth token 解密。
   * Risk：No known risks.
   */
  it('should fall back to PROVIDER_ENCRYPTION_KEY when OAUTH_TOKEN_ENCRYPTION_KEY is missing', () => {
    const originalOAuthKey = config.OAUTH_TOKEN_ENCRYPTION_KEY;
    config.OAUTH_TOKEN_ENCRYPTION_KEY = '';

    try {
      const plaintext = 'zhiz-oauth-token-fallback';
      const ciphertext = encryptOAuthToken(plaintext);
      expect(decryptOAuthToken(ciphertext)).toBe(plaintext);
    } finally {
      config.OAUTH_TOKEN_ENCRYPTION_KEY = originalOAuthKey;
    }
  });

  it('should keep decrypting legacy provider-key OAuth tokens after dedicated key is added', () => {
    const originalOAuthKey = config.OAUTH_TOKEN_ENCRYPTION_KEY;
    config.OAUTH_TOKEN_ENCRYPTION_KEY = '';
    const plaintext = 'zhiz-oauth-token-legacy-provider-key';
    const legacyCiphertext = encryptOAuthToken(plaintext);
    config.OAUTH_TOKEN_ENCRYPTION_KEY =
      '1111111111111111111111111111111111111111111111111111111111111111';

    try {
      expect(decryptOAuthToken(legacyCiphertext)).toBe(plaintext);
    } finally {
      config.OAUTH_TOKEN_ENCRYPTION_KEY = originalOAuthKey;
    }
  });
});
