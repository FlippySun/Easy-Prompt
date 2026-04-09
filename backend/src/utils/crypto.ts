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
function getKey(): Buffer {
  return Buffer.from(config.PROVIDER_ENCRYPTION_KEY, 'hex');
}

/**
 * 加密明文字符串
 * @param plaintext 明文（如 API Key）
 * @returns 格式：iv:encrypted（hex 编码）
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * 解密密文字符串
 * @param ciphertext 格式：iv:encrypted（hex 编码）
 * @returns 明文
 * @throws 解密失败时抛 Error
 */
export function decrypt(ciphertext: string): string {
  const [ivHex, encrypted] = ciphertext.split(':');
  if (!ivHex || !encrypted) {
    throw new Error('Invalid ciphertext format: expected "iv:encrypted"');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
