/**
 * JWT 工具函数
 * 2026-04-07 新增 — P1.12 JWT 工具
 * 设计思路：封装 jsonwebtoken 的 sign/verify，统一 payload 结构
 *   access token 短期有效（15m），refresh token 长期有效（7d）
 * 影响范围：auth 路由、auth 中间件
 * 潜在风险：无已知风险
 */

import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { UserRole } from '../types/user';

/**
 * 将 '15m', '7d', '1h' 等时间字符串转为秒数
 * 支持 s/m/h/d 后缀
 */
function parseDurationToSeconds(val: string): number {
  const match = val.match(/^(\d+)\s*([smhd])$/i);
  if (!match) return 900; // fallback 15 分钟
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return num * (multipliers[unit] ?? 60);
}

// ── Payload 类型 ──────────────────────────────────────
export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
}

// ── 签发 ──────────────────────────────────────────────

/**
 * 签发 Access Token（短期）
 * @param payload 用户信息
 * @returns JWT 字符串
 */
export function signAccessToken(payload: TokenPayload): string {
  const expiresIn = parseDurationToSeconds(config.JWT_ACCESS_EXPIRES);
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn });
}

/**
 * 签发 Refresh Token（长期）
 * @param payload 用户信息
 * @returns JWT 字符串
 */
export function signRefreshToken(payload: TokenPayload): string {
  const expiresIn = parseDurationToSeconds(config.JWT_REFRESH_EXPIRES);
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn });
}

/**
 * 获取 Access Token 的有效期（秒）
 * 2026-04-09 新增 — 供 auth.service 返回给前端用于调度自动刷新
 */
export function getAccessTokenExpiresInSec(): number {
  return parseDurationToSeconds(config.JWT_ACCESS_EXPIRES);
}

// ── 验证 ──────────────────────────────────────────────

/**
 * 验证 JWT 并返回 payload
 * @param token JWT 字符串
 * @returns 解码后的 payload
 * @throws jwt.JsonWebTokenError / jwt.TokenExpiredError
 */
export function verifyToken(token: string): DecodedToken {
  return jwt.verify(token, config.JWT_SECRET) as DecodedToken;
}

/**
 * 安全验证 — 不抛异常，返回 null 表示无效
 */
export function verifyTokenSafe(token: string): DecodedToken | null {
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}
