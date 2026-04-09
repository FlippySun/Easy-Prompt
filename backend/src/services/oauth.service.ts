/**
 * OAuth 服务 — GitHub / Google 第三方登录
 * 2026-04-09 新增 — P6.03
 * 变更类型：新增
 * 设计思路：
 *   1. getAuthUrl() — 构建 OAuth 授权跳转 URL
 *   2. handleCallback() — 用授权码换取 access_token，获取用户信息
 *   3. linkOrCreateUser() — 关联现有用户或自动创建新用户
 *   4. 独立表 OAuthAccount 存储关联，不污染 User 主表
 * 参数：各方法见签名
 * 影响范围：auth 路由的 /oauth/* 端点
 * 潜在风险：
 *   - 第三方 API 可用性不可控
 *   - accessToken 需加密存储（当前明文，后续迭代）
 */

import { prisma } from '../lib/prisma';
import { config } from '../config';
import { AppError } from '../utils/errors';
import { createChildLogger } from '../utils/logger';
import { signAccessToken, signRefreshToken } from '../utils/jwt';
import type { Prisma } from '@prisma/client';

const log = createChildLogger('oauth');

// ── 类型定义 ───────────────────────────────────────────

export type OAuthProvider = 'github' | 'google';

interface OAuthProfile {
  providerId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  rawProfile: Record<string, unknown>;
}

interface OAuthTokenResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    role: string;
  };
  isNewUser: boolean;
}

// ── 授权 URL 构建 ──────────────────────────────────────

/**
 * 构建 OAuth 授权跳转 URL
 * @param provider - github / google
 * @param state - CSRF 防护随机字符串（调用方生成）
 */
export function getAuthUrl(provider: OAuthProvider, state: string): string {
  const callbackBase = config.OAUTH_CALLBACK_BASE_URL || `http://localhost:${config.PORT}`;

  switch (provider) {
    case 'github': {
      if (!config.OAUTH_GITHUB_CLIENT_ID) {
        throw new AppError('AUTH_PROVIDER_ERROR', 'GitHub OAuth not configured');
      }
      const params = new URLSearchParams({
        client_id: config.OAUTH_GITHUB_CLIENT_ID,
        redirect_uri: `${callbackBase}/api/v1/auth/oauth/github/callback`,
        scope: 'read:user user:email',
        state,
      });
      return `https://github.com/login/oauth/authorize?${params}`;
    }
    case 'google': {
      if (!config.OAUTH_GOOGLE_CLIENT_ID) {
        throw new AppError('AUTH_PROVIDER_ERROR', 'Google OAuth not configured');
      }
      const params = new URLSearchParams({
        client_id: config.OAUTH_GOOGLE_CLIENT_ID,
        redirect_uri: `${callbackBase}/api/v1/auth/oauth/google/callback`,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        access_type: 'offline',
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    }
    default:
      throw new AppError('AUTH_PROVIDER_ERROR', `Unsupported OAuth provider: ${provider}`);
  }
}

// ── 回调处理（授权码 → token → profile） ──────────────

/**
 * 处理 OAuth 回调：用授权码换 token，获取用户 profile
 * @param provider - github / google
 * @param code - 授权码
 * @returns OAuthProfile
 */
export async function handleCallback(provider: OAuthProvider, code: string): Promise<OAuthProfile> {
  switch (provider) {
    case 'github':
      return handleGitHubCallback(code);
    case 'google':
      return handleGoogleCallback(code);
    default:
      throw new AppError('AUTH_PROVIDER_ERROR', `Unsupported provider: ${provider}`);
  }
}

// ── GitHub 回调 ────────────────────────────────────────

async function handleGitHubCallback(code: string): Promise<OAuthProfile> {
  // 1. 用 code 换 access_token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.OAUTH_GITHUB_CLIENT_ID,
      client_secret: config.OAUTH_GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenData.access_token) {
    log.error({ tokenData }, 'GitHub token exchange failed');
    throw new AppError(
      'AUTH_PROVIDER_ERROR',
      `GitHub auth failed: ${tokenData.error || 'no token'}`,
    );
  }

  // 2. 获取用户 profile
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userData = (await userRes.json()) as {
    id?: number;
    login?: string;
    name?: string;
    avatar_url?: string;
    email?: string;
  };

  // 3. 获取邮箱（可能 profile 中没有，需单独请求）
  let email = userData.email;
  if (!email) {
    const emailRes = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const emails = (await emailRes.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;
    const primary = emails.find((e) => e.primary && e.verified);
    email = primary?.email ?? emails[0]?.email ?? null;
  }

  return {
    providerId: String(userData.id),
    email: email ?? null,
    displayName: userData.name || userData.login || null,
    avatarUrl: userData.avatar_url || null,
    rawProfile: userData as Record<string, unknown>,
  };
}

// ── Google 回调 ────────────────────────────────────────

async function handleGoogleCallback(code: string): Promise<OAuthProfile> {
  const callbackBase = config.OAUTH_CALLBACK_BASE_URL || `http://localhost:${config.PORT}`;

  // 1. 用 code 换 access_token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.OAUTH_GOOGLE_CLIENT_ID,
      client_secret: config.OAUTH_GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${callbackBase}/api/v1/auth/oauth/google/callback`,
    }),
  });

  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenData.access_token) {
    log.error({ tokenData }, 'Google token exchange failed');
    throw new AppError(
      'AUTH_PROVIDER_ERROR',
      `Google auth failed: ${tokenData.error || 'no token'}`,
    );
  }

  // 2. 获取用户 profile
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userData = (await userRes.json()) as {
    id?: string;
    email?: string;
    name?: string;
    picture?: string;
    verified_email?: boolean;
  };

  return {
    providerId: userData.id || '',
    email: userData.email || null,
    displayName: userData.name || null,
    avatarUrl: userData.picture || null,
    rawProfile: userData as Record<string, unknown>,
  };
}

// ── 用户关联或创建 ─────────────────────────────────────

/**
 * 根据 OAuth profile 关联现有用户或创建新用户
 * 匹配策略：
 *   1. 先查 OAuthAccount（provider + providerId）→ 找到则直接登录
 *   2. 未找到 → 用 email 匹配 User 表 → 找到则关联
 *   3. 都没有 → 创建新用户 + 关联 OAuthAccount
 * @returns JWT tokens + 用户信息
 */
export async function linkOrCreateUser(
  provider: OAuthProvider,
  profile: OAuthProfile,
): Promise<OAuthTokenResult> {
  let isNewUser = false;

  // 1. 查找已有 OAuth 关联
  const existing = await prisma.oAuthAccount.findUnique({
    where: { provider_providerId: { provider, providerId: profile.providerId } },
    include: { user: true },
  });

  let user;

  if (existing) {
    // 已关联 → 更新 profile 信息
    user = existing.user;
    await prisma.oAuthAccount.update({
      where: { id: existing.id },
      data: {
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        rawProfile: profile.rawProfile as Prisma.InputJsonValue,
      },
    });
    log.info({ userId: user.id, provider }, 'OAuth login — existing account');
  } else if (profile.email) {
    // 2. 用 email 匹配已有用户
    const emailUser = await prisma.user.findUnique({ where: { email: profile.email } });

    if (emailUser) {
      user = emailUser;
      // 创建 OAuth 关联
      await prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider,
          providerId: profile.providerId,
          email: profile.email,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          rawProfile: profile.rawProfile as Prisma.InputJsonValue,
        },
      });
      log.info({ userId: user.id, provider }, 'OAuth login — linked to existing user by email');
    } else {
      // 3. 创建新用户
      const username = await generateUniqueUsername(profile.displayName || provider);
      user = await prisma.user.create({
        data: {
          email: profile.email,
          username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          // OAuth 用户使用随机密码（不可直接密码登录）
          passwordHash: `oauth:${provider}:${Date.now()}`,
          oauthAccounts: {
            create: {
              provider,
              providerId: profile.providerId,
              email: profile.email,
              displayName: profile.displayName,
              avatarUrl: profile.avatarUrl,
              rawProfile: profile.rawProfile as Prisma.InputJsonValue,
            },
          },
        },
      });
      isNewUser = true;
      log.info({ userId: user.id, provider, username }, 'OAuth login — new user created');
    }
  } else {
    throw new AppError('AUTH_PROVIDER_ERROR', 'OAuth provider did not return an email address');
  }

  // 签发 JWT — 复用 utils/jwt.ts 中的签发函数
  const tokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role as 'user' | 'admin' | 'super_admin',
  };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
    },
    isNewUser,
  };
}

// ── 工具函数 ───────────────────────────────────────────

/**
 * 生成唯一用户名（基于 displayName 或 provider 名 + 随机后缀）
 */
async function generateUniqueUsername(base: string): Promise<string> {
  // 清理为合法用户名字符
  const cleaned = base.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30) || 'user';
  let candidate = cleaned;
  let attempt = 0;

  while (attempt < 10) {
    const exists = await prisma.user.findUnique({ where: { username: candidate } });
    if (!exists) return candidate;
    // 添加随机后缀
    candidate = `${cleaned}_${Math.random().toString(36).slice(2, 8)}`;
    attempt++;
  }

  // 极端情况：全随机
  return `user_${Date.now().toString(36)}`;
}
