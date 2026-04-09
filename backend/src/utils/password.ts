/**
 * 密码哈希工具（bcrypt）
 * 2026-04-07 新增 — P1.13 密码工具
 * 设计思路：封装 bcrypt 的 hash/compare，统一 salt rounds
 * 影响范围：注册、登录、修改密码
 * 潜在风险：无已知风险
 */

import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

/**
 * 对明文密码生成 bcrypt 哈希
 * @param password 明文密码
 * @returns 哈希字符串
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 验证明文密码与哈希是否匹配
 * @param password 明文密码
 * @param hash 存储的哈希
 * @returns 是否匹配
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
