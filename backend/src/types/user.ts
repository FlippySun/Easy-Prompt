/**
 * User 相关类型
 * 2026-04-07 新增 — P1.06
 */

export type UserRole = 'user' | 'admin' | 'super_admin';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

/** 当前登录用户资料（不含密码 hash） */
export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  role: UserRole;
  createdAt: string;
}

/** 公开用户资料（他人可见） */
export interface UserPublicProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  promptCount: number;
  joinedAt: string;
}
