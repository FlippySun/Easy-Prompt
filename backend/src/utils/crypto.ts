/**
 * Provider API Key 加密/解密工具（AES-256-CBC）
 * 2026-04-07 新增 — P1.25 Provider 加密工具
 * 设计思路：与前端 deploy/inject-provider.js 使用相同算法 AES-256-CBC，
 *   加密后格式为 iv:encrypted（hex 编码），存入数据库
 * 影响范围：provider 创建/更新/读取时的 API Key 加解密
 * 潜在风险：PROVIDER_ENCRYPTION_KEY 泄露会导致所有 provider key 暴露
 */

import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * 获取加密 key（从 hex 字符串转为 Buffer）
 */
function getKeyFromHex(hex: string, keyName: string): Buffer {
  if (!hex) {
    throw new Error(`${keyName} is not configured`);
  }
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error(`${keyName} must decode to 32 bytes`);
  }
  return key;
}

function getProviderKey(): Buffer {
  return getKeyFromHex(config.PROVIDER_ENCRYPTION_KEY, 'PROVIDER_ENCRYPTION_KEY');
}

/**
 * 2026-04-22 修复 — Zhiz OAuth token key 兼容回退链
 * 变更类型：fix/security
 * 功能描述：为 OAuth token 提供“优先 dedicated key、缺失或历史兼容时回退 Provider key”的解析顺序。
 * 设计思路：
 *   1. 新环境仍优先使用 `OAUTH_TOKEN_ENCRYPTION_KEY`，保持 OAuth token 与 Provider API Key 分钥隔离。
 *   2. 若 dedicated key 缺失，则安全回退到 `PROVIDER_ENCRYPTION_KEY`，避免已注册用户在“首次绑定 Zhiz”时因老环境未补新变量而直接失败。
 *   3. 解密时若 dedicated key 存在但历史数据仍使用 Provider key 加密，则继续尝试兼容回退，避免后续补环境变量后旧数据失效。
 * 参数与返回值：`getOAuthTokenKeys()` 返回按优先级排序的 32 字节 Buffer 数组，数组首项总是当前应使用的加密 key。
 * 影响范围：Zhiz OAuth callback、continuation ticket、`OAuthAccount.accessToken` 持久化与后续 skill 拉取。
 * 潜在风险：若 Provider key 未来轮换且没有同步迁移历史 OAuth token，兼容回退数据仍会失效；这是密钥轮换本身需要单独处理的风险。
 */
function getOAuthTokenKeys(): Buffer[] {
  const providerKey = getProviderKey();
  if (!config.OAUTH_TOKEN_ENCRYPTION_KEY) {
    return [providerKey];
  }

  const oauthKey = getKeyFromHex(
    config.OAUTH_TOKEN_ENCRYPTION_KEY,
    'OAUTH_TOKEN_ENCRYPTION_KEY',
  );

  if (oauthKey.equals(providerKey)) {
    return [oauthKey];
  }

  return [oauthKey, providerKey];
}

function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decryptWithKey(ciphertext: string, key: Buffer): string {
  const [ivHex, encrypted] = ciphertext.split(':');
  if (!ivHex || !encrypted) {
    throw new Error('Invalid ciphertext format: expected "iv:encrypted"');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * 加密明文字符串
 * @param plaintext 明文（如 API Key）
 * @returns 格式：iv:encrypted（hex 编码）
 */
export function encrypt(plaintext: string): string {
  return encryptWithKey(plaintext, getProviderKey());
}

/**
 * 解密密文字符串
 * @param ciphertext 格式：iv:encrypted（hex 编码）
 * @returns 明文
 * @throws 解密失败时抛 Error
 */
export function decrypt(ciphertext: string): string {
  return decryptWithKey(ciphertext, getProviderKey());
}

/**
 * 加密 OAuth access token
 * @param plaintext 第三方 OAuth access token 明文
 * @returns 格式：iv:encrypted（hex 编码）
 */
export function encryptOAuthToken(plaintext: string): string {
  return encryptWithKey(plaintext, getOAuthTokenKeys()[0]);
}

/**
 * 解密 OAuth access token
 * @param ciphertext 格式：iv:encrypted（hex 编码）
 * @returns OAuth access token 明文
 */
export function decryptOAuthToken(ciphertext: string): string {
  const attemptedErrors: Error[] = [];

  for (const key of getOAuthTokenKeys()) {
    try {
      return decryptWithKey(ciphertext, key);
    } catch (error) {
      attemptedErrors.push(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  throw attemptedErrors[0] ?? new Error('Failed to decrypt OAuth token');
}
