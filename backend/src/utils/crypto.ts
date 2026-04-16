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
 * 2026-04-14 新增 — Zhiz OAuth Superpowers Execute T5
 * 变更类型：新增/安全
 * 功能描述：为第三方 OAuth token 提供独立于 Provider API Key 的加密 key 解析能力。
 * 设计思路：
 *   1. Provider API Key 与 OAuth token 分离使用不同 key，避免职责混用。
 *   2. 保持底层 AES-256-CBC 实现共享，只拆分 key 来源与导出 API。
 * 参数与返回值：getOAuthTokenKey() 返回 OAUTH_TOKEN_ENCRYPTION_KEY 解码后的 32 字节 Buffer。
 * 影响范围：Zhiz OAuth callback、continuation ticket、后续 OAuthAccount.accessToken 持久化。
 * 潜在风险：若 OAUTH_TOKEN_ENCRYPTION_KEY 未配置，相关 Zhiz callback 链路将按显式错误失败。
 */
function getOAuthTokenKey(): Buffer {
  return getKeyFromHex(config.OAUTH_TOKEN_ENCRYPTION_KEY, 'OAUTH_TOKEN_ENCRYPTION_KEY');
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
  return encryptWithKey(plaintext, getOAuthTokenKey());
}

/**
 * 解密 OAuth access token
 * @param ciphertext 格式：iv:encrypted（hex 编码）
 * @returns OAuth access token 明文
 */
export function decryptOAuthToken(ciphertext: string): string {
  return decryptWithKey(ciphertext, getOAuthTokenKey());
}
