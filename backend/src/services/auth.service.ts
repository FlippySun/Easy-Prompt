/**
 * 认证服务 — 注册、登录、刷新、SSO
 * 2026-04-07 新增 — P1.15/P1.16/P1.17
 * 设计思路：业务逻辑与路由分离，路由层仅做参数校验和响应序列化
 *   SSO 采用授权码模式：客户端获取 code → 用 code 换 token
 * 影响范围：auth 路由、所有需要认证的接口
 * 潜在风险：无已知风险
 */

import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { hashPassword, comparePassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyToken } from '../utils/jwt';
import { AppError } from '../utils/errors';
import { createChildLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { SSO } from '../config/constants';
import type { TokenPayload } from '../utils/jwt';
import type { UserRole } from '../types/user';

const log = createChildLogger('auth-service');

// ── 注册 ──────────────────────────────────────────────

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  displayName?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    role: string;
  };
  tokens: AuthTokens;
}

/**
 * 注册新用户
 * @throws AUTH_EMAIL_EXISTS / AUTH_USERNAME_EXISTS
 */
export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  // 检查邮箱重复
  const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingEmail) {
    throw new AppError('AUTH_EMAIL_EXISTS');
  }

  // 检查用户名重复
  const existingUsername = await prisma.user.findUnique({ where: { username: input.username } });
  if (existingUsername) {
    throw new AppError('AUTH_USERNAME_EXISTS');
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase().trim(),
      username: input.username.trim(),
      displayName: input.displayName?.trim() || null,
      passwordHash,
      role: 'user',
    },
  });

  log.info({ userId: user.id, email: user.email }, 'User registered');

  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
  };

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
    },
    tokens: {
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
    },
  };
}

// ── 登录 ──────────────────────────────────────────────

export interface LoginInput {
  email: string;
  password: string;
}

/**
 * 邮箱密码登录
 * @throws AUTH_LOGIN_FAILED
 */
export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
  });

  if (!user) {
    throw new AppError('AUTH_LOGIN_FAILED');
  }

  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError('AUTH_LOGIN_FAILED');
  }

  log.info({ userId: user.id }, 'User logged in');

  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
  };

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
    },
    tokens: {
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
    },
  };
}

// ── 刷新 Token ──────────────────────────────────────────

/**
 * 用 refresh token 换新的 access token
 * @throws AUTH_REFRESH_EXPIRED / AUTH_TOKEN_INVALID
 */
export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  let decoded;
  try {
    decoded = verifyToken(refreshToken);
  } catch {
    throw new AppError('AUTH_REFRESH_EXPIRED');
  }

  // 确认用户仍然存在
  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user) {
    throw new AppError('AUTH_TOKEN_INVALID');
  }

  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
  };

  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

// ── 获取当前用户信息 ──────────────────────────────────

/**
 * 根据 userId 获取用户公开资料
 * @throws RESOURCE_NOT_FOUND
 */
export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError('RESOURCE_NOT_FOUND', 'User not found');
  }

  return user;
}

// ── SSO 授权码模式 ──────────────────────────────────────

/**
 * 生成 SSO 授权码（已登录用户为客户端签发一次性 code）
 * 存入 Redis，5 分钟过期
 * @param userId 当前登录用户
 * @param redirectUri 客户端回调地址
 * @returns 授权码
 */
export async function generateSsoCode(userId: string, redirectUri: string): Promise<string> {
  // 校验 redirect_uri 是否在允许列表中
  const allowed = SSO.ALLOWED_REDIRECT_PATTERNS.some((pattern) => pattern.test(redirectUri));
  if (!allowed) {
    throw new AppError('VALIDATION_FAILED', 'Invalid redirect_uri', { redirectUri });
  }

  const code = uuidv4();
  const key = `sso:code:${code}`;
  const payload = JSON.stringify({ userId, redirectUri });

  await redis.set(key, payload, 'EX', SSO.CODE_EXPIRES_SEC);

  log.info({ userId, redirectUri }, 'SSO code generated');
  return code;
}

/**
 * 用 SSO 授权码换取 tokens
 * @param code 授权码
 * @param redirectUri 必须与生成时一致
 * @throws AUTH_CODE_INVALID / AUTH_CODE_EXPIRED
 */
export async function exchangeSsoCode(
  code: string,
  redirectUri: string,
): Promise<AuthResult> {
  const key = `sso:code:${code}`;
  const raw = await redis.get(key);

  if (!raw) {
    throw new AppError('AUTH_CODE_EXPIRED');
  }

  // 一次性使用 — 立即删除
  await redis.del(key);

  let parsed: { userId: string; redirectUri: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError('AUTH_CODE_INVALID');
  }

  // redirect_uri 必须与生成时一致
  if (parsed.redirectUri !== redirectUri) {
    throw new AppError('AUTH_CODE_INVALID', 'redirect_uri mismatch');
  }

  const user = await prisma.user.findUnique({ where: { id: parsed.userId } });
  if (!user) {
    throw new AppError('AUTH_CODE_INVALID', 'User not found');
  }

  log.info({ userId: user.id }, 'SSO code exchanged');

  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
  };

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
    },
    tokens: {
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
    },
  };
}
