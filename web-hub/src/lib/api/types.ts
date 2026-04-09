/**
 * API 类型定义 — 前端与后端 API 交互的通用类型
 * 2026-04-09 新增 — P5.01 API Client 封装
 * 变更类型：新增
 * 设计思路：
 *   1. 所有后端响应统一为 { success, data, meta?, error? } 格式
 *   2. 前端类型与后端 route 返回结构一一对应
 *   3. 独立于后端 types（前端不直接引用 backend/src/types）
 * 影响范围：web-hub 全局 API 调用
 * 潜在风险：无已知风险
 */

// ── 通用 API 响应 ──────────────────────────────────────

/** 分页元信息 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** 成功响应（单项） */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/** 成功响应（分页列表） */
export interface ApiPaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

/** 错误响应 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** 统一 API 响应 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ── Auth ────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  displayName?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  role: 'user' | 'admin' | 'super_admin';
  createdAt: string;
}

// ── Prompt ──────────────────────────────────────────────

export interface PromptListParams {
  page?: number;
  pageSize?: number;
  category?: string;
  model?: string;
  tags?: string[];
  search?: string;
  authorId?: string;
}

export interface PromptItem {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  model: string | null;
  tags: string[];
  authorId: string;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
  };
  likeCount: number;
  copyCount: number;
  viewCount: number;
  saveCount: number;
  isFeatured: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromptDetail extends PromptItem {
  isLiked?: boolean;
  isSaved?: boolean;
}

export interface ToggleResult {
  action: 'added' | 'removed';
  count: number;
}

// ── Collection ─────────────────────────────────────────

export interface CollectionListParams {
  page?: number;
  pageSize?: number;
  tags?: string[];
  difficulty?: string;
  search?: string;
}

export interface CollectionItem {
  id: string;
  title: string;
  description: string;
  icon: string | null;
  gradientFrom: string | null;
  gradientTo: string | null;
  tags: string[];
  difficulty: string | null;
  estimatedTime: string | null;
  savedCount: number;
  promptCount: number;
  createdAt: string;
}

export interface CollectionDetail extends CollectionItem {
  prompts: PromptItem[];
  isSaved?: boolean;
}

// ── Trending ───────────────────────────────────────────

export type TrendingPeriod = 'day' | 'week' | 'month';

export interface TrendingPromptsParams {
  period?: TrendingPeriod;
  limit?: number;
}

export interface CategoryTrending {
  category: string;
  promptCount: number;
  totalLikes: number;
  totalViews: number;
  growth: number;
}

// ── Achievement ────────────────────────────────────────

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category: string;
  unlockedAt?: string | null;
}

// ── User ───────────────────────────────────────────────

export interface UserPublicProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  bio: string | null;
  createdAt: string;
}

export interface UserEnhancedProfile extends UserPublicProfile {
  stats: {
    promptCount: number;
    likeCount: number;
    copyCount: number;
    viewCount: number;
    collectionCount: number;
    achievementCount: number;
  };
}

export interface ActivityHeatmapItem {
  date: string;
  count: number;
}

export interface UpdateProfileRequest {
  displayName?: string;
  avatar?: string;
  bio?: string;
}

// ── Meta ───────────────────────────────────────────────

export interface CategoryMeta {
  id: string;
  slug: string;
  label: string;
  labelEn: string | null;
  emoji: string | null;
  icon: string | null;
  color: string | null;
  bgColor: string | null;
  darkBgColor: string | null;
  darkColor: string | null;
  sortOrder: number;
}

export interface ModelMeta {
  id: string;
  slug: string;
  label: string;
  color: string | null;
  sortOrder: number;
}

// ── Search ─────────────────────────────────────────────

export interface SearchParams {
  keyword: string;
  category?: string;
  model?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}

// ── API Error 扩展 ─────────────────────────────────────

/**
 * 前端 API 调用抛出的自定义错误
 * 携带后端错误码，供 UI 层映射 i18n 消息
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
