/**
 * API 模块入口 — 按领域分组的 API 方法 + 类型导出
 * 2026-04-09 新增 — P5.01 API Client 封装
 * 变更类型：新增
 * 设计思路：
 *   将 HTTP 调用封装为语义化的领域方法（authApi / promptApi / …）
 *   调用方只需 `import { promptApi } from '@/lib/api'`
 *   各方法返回值已解包到业务 data 层（而非原始 Response）
 * 影响范围：web-hub 全局 API 调用
 * 潜在风险：无已知风险
 */

export * from './types';
export { getAccessToken, getRefreshToken, setTokens, clearTokens } from './client';
export { getErrorMessage, handleApiError, isAuthError, isNetworkError } from './errorHandler';

import { get, post, put, del, postPublic } from './client';
import { setTokens, clearTokens } from './client';
import type {
  ApiSuccessResponse,
  ApiPaginatedResponse,
  AuthTokens,
  AuthUser,
  LoginRequest,
  RegisterRequest,
  PromptListParams,
  PromptItem,
  PromptDetail,
  LikeResult,
  SaveResult,
  CopyResult,
  CollectionSaveResult,
  CollectionListParams,
  CollectionItem,
  CollectionDetail,
  TrendingPromptsParams,
  CategoryTrending,
  AchievementItem,
  UserPublicProfile,
  UserEnhancedProfile,
  ActivityHeatmapItem,
  UpdateProfileRequest,
  CategoryMeta,
  ModelMeta,
  SearchParams,
} from './types';

// ═══════════════════════════════════════════════════════════
// Auth API
// ═══════════════════════════════════════════════════════════

export const authApi = {
  /** 登录 → 返回 tokens + user，自动存储 token */
  // 2026-04-09 修复 — 后端返回 { user, tokens: { accessToken, refreshToken } }，
  //   之前误用 res.data.accessToken（flat），导致 token 未存储、登录态丢失
  async login(data: LoginRequest) {
    const res = await postPublic<ApiSuccessResponse<{ user: AuthUser; tokens: AuthTokens }>>(
      '/api/v1/auth/login',
      data,
    );
    setTokens(res.data.tokens.accessToken, res.data.tokens.refreshToken);
    return res.data;
  },

  /** 注册 → 返回 tokens + user，自动存储 token */
  // 2026-04-09 修复 — 与 login 同理，后端返回嵌套 tokens 对象
  async register(data: RegisterRequest) {
    const res = await postPublic<ApiSuccessResponse<{ user: AuthUser; tokens: AuthTokens }>>(
      '/api/v1/auth/register',
      data,
    );
    setTokens(res.data.tokens.accessToken, res.data.tokens.refreshToken);
    return res.data;
  },

  /** 获取当前登录用户信息 */
  async me() {
    const res = await get<ApiSuccessResponse<AuthUser>>('/api/v1/auth/me');
    return res.data;
  },

  /** 刷新 token（通常由 client.ts 自动调用，此处供手动调用） */
  async refresh(refreshToken: string) {
    const res = await postPublic<ApiSuccessResponse<AuthTokens>>('/api/v1/auth/refresh', { refreshToken });
    setTokens(res.data.accessToken, res.data.refreshToken);
    return res.data;
  },

  /** 登出（清除本地 token） */
  logout() {
    clearTokens();
  },
};

// ═══════════════════════════════════════════════════════════
// Prompt API
// ═══════════════════════════════════════════════════════════

export const promptApi = {
  /** 分页列表 */
  async list(params?: PromptListParams) {
    return get<ApiPaginatedResponse<PromptItem>>('/api/v1/prompts', params as Record<string, unknown>);
  },

  /** 全文搜索 */
  async search(params: SearchParams) {
    return get<ApiPaginatedResponse<PromptItem>>(
      '/api/v1/prompts/search',
      params as unknown as Record<string, unknown>,
    );
  },

  /** 详情 */
  async detail(id: string) {
    const res = await get<ApiSuccessResponse<PromptDetail>>(`/api/v1/prompts/${id}`);
    return res.data;
  },

  /** 随机推荐 */
  async random(count?: number, category?: string) {
    const res = await get<ApiSuccessResponse<PromptItem[]>>('/api/v1/prompts/random', { count, category });
    return res.data;
  },

  /** 精选列表 */
  async featured(limit?: number) {
    const res = await get<ApiSuccessResponse<PromptItem[]>>('/api/v1/prompts/featured', { limit });
    return res.data;
  },

  /** Galaxy 3D 数据 */
  async galaxy(since?: string, chunk?: number) {
    return get<ApiSuccessResponse<unknown>>('/api/v1/prompts/galaxy', { since, chunk });
  },

  // 2026-04-09 修复 — 使用后端实际返回类型替代旧 ToggleResult
  /** 切换点赞 */
  async toggleLike(id: string) {
    const res = await post<ApiSuccessResponse<LikeResult>>(`/api/v1/prompts/${id}/like`);
    return res.data;
  },

  /** 切换收藏 */
  async toggleSave(id: string) {
    const res = await post<ApiSuccessResponse<SaveResult>>(`/api/v1/prompts/${id}/save`);
    return res.data;
  },

  /** 记录复制 */
  async recordCopy(id: string) {
    const res = await post<ApiSuccessResponse<CopyResult>>(`/api/v1/prompts/${id}/copy`);
    return res.data;
  },

  /** 记录浏览 */
  async recordView(id: string) {
    await post<ApiSuccessResponse<null>>(`/api/v1/prompts/${id}/view`);
  },

  /** 创建 Prompt */
  async create(data: Record<string, unknown>) {
    const res = await post<ApiSuccessResponse<PromptItem>>('/api/v1/prompts', data);
    return res.data;
  },

  /** 更新 Prompt */
  async update(id: string, data: Record<string, unknown>) {
    const res = await put<ApiSuccessResponse<PromptItem>>(`/api/v1/prompts/${id}`, data);
    return res.data;
  },

  /** 删除 Prompt */
  async remove(id: string) {
    await del<ApiSuccessResponse<null>>(`/api/v1/prompts/${id}`);
  },
};

// ═══════════════════════════════════════════════════════════
// Collection API
// ═══════════════════════════════════════════════════════════

export const collectionApi = {
  /** 分页列表 */
  async list(params?: CollectionListParams) {
    return get<ApiPaginatedResponse<CollectionItem>>('/api/v1/collections', params as Record<string, unknown>);
  },

  /** 详情（含关联 Prompt） */
  async detail(id: string) {
    const res = await get<ApiSuccessResponse<CollectionDetail>>(`/api/v1/collections/${id}`);
    return res.data;
  },

  // 2026-04-09 修复 — 使用后端实际返回类型 CollectionSaveResult
  /** 切换收藏 */
  async toggleSave(id: string) {
    const res = await post<ApiSuccessResponse<CollectionSaveResult>>(`/api/v1/collections/${id}/save`);
    return res.data;
  },
};

// ═══════════════════════════════════════════════════════════
// Trending API
// ═══════════════════════════════════════════════════════════

export const trendingApi = {
  /** 热门 Prompt 排行 */
  async prompts(params?: TrendingPromptsParams) {
    const res = await get<ApiSuccessResponse<PromptItem[]>>(
      '/api/v1/trending/prompts',
      params as Record<string, unknown>,
    );
    return res.data;
  },

  /** 分类趋势 */
  async categories(period?: string, limit?: number) {
    const res = await get<ApiSuccessResponse<CategoryTrending[]>>('/api/v1/trending/categories', { period, limit });
    return res.data;
  },

  /** 每日精选 */
  async daily(limit?: number) {
    const res = await get<ApiSuccessResponse<PromptItem[]>>('/api/v1/trending/daily', { limit });
    return res.data;
  },
};

// ═══════════════════════════════════════════════════════════
// Achievement API
// ═══════════════════════════════════════════════════════════

export const achievementApi = {
  /** 所有成就列表（含当前用户解锁状态） */
  async list() {
    const res = await get<ApiSuccessResponse<AchievementItem[]>>('/api/v1/achievements');
    return res.data;
  },

  /** 当前用户已解锁的成就 */
  async myUnlocked() {
    const res = await get<ApiSuccessResponse<AchievementItem[]>>('/api/v1/achievements/me');
    return res.data;
  },

  /** 手动触发成就条件检测 */
  async check() {
    const res = await post<ApiSuccessResponse<{ newlyUnlocked: string[] }>>('/api/v1/achievements/check');
    return res.data.newlyUnlocked;
  },
};

// ═══════════════════════════════════════════════════════════
// User API
// ═══════════════════════════════════════════════════════════

export const userApi = {
  /** 用户公开资料 */
  async profile(id: string) {
    const res = await get<ApiSuccessResponse<UserPublicProfile>>(`/api/v1/users/${id}`);
    return res.data;
  },

  /** 增强版公开资料（含统计） */
  async enhancedProfile(id: string) {
    const res = await get<ApiSuccessResponse<UserEnhancedProfile>>(`/api/v1/users/${id}/enhanced`);
    return res.data;
  },

  /** 用户已解锁成就 */
  async achievements(id: string) {
    const res = await get<ApiSuccessResponse<AchievementItem[]>>(`/api/v1/users/${id}/achievements`);
    return res.data;
  },

  /** 活跃度热力图 */
  async activity(id: string) {
    const res = await get<ApiSuccessResponse<ActivityHeatmapItem[]>>(`/api/v1/users/${id}/activity`);
    return res.data;
  },

  /** 我的 Prompt 列表 */
  async myPrompts(params?: { page?: number; pageSize?: number }) {
    return get<ApiPaginatedResponse<PromptItem>>('/api/v1/users/me/prompts', params as Record<string, unknown>);
  },

  /** 我的收藏 Prompt */
  async mySaved(params?: { page?: number; pageSize?: number }) {
    return get<ApiPaginatedResponse<PromptItem>>('/api/v1/users/me/saved', params as Record<string, unknown>);
  },

  /** 我的点赞 Prompt */
  async myLiked(params?: { page?: number; pageSize?: number }) {
    return get<ApiPaginatedResponse<PromptItem>>('/api/v1/users/me/liked', params as Record<string, unknown>);
  },

  /** 我的收藏 Collection */
  async myCollections(params?: { page?: number; pageSize?: number }) {
    return get<ApiPaginatedResponse<CollectionItem>>('/api/v1/users/me/collections', params as Record<string, unknown>);
  },

  /** 更新我的资料 */
  async updateProfile(data: UpdateProfileRequest) {
    const res = await put<ApiSuccessResponse<AuthUser>>('/api/v1/users/me/profile', data);
    return res.data;
  },
};

// ═══════════════════════════════════════════════════════════
// Admin API — P6.05~P6.08 管理后台
// 2026-04-09 新增 — P6.05 Admin Dashboard + Provider + Blacklist 管理
// 设计思路：封装管理后台 API 调用，仅 admin 角色可访问
// 影响范围：admin/* 页面
// ═══════════════════════════════════════════════════════════

export const adminApi = {
  // ── Dashboard 统计 ──
  async dashboardStats() {
    const res = await get<ApiSuccessResponse<DashboardStats>>('/api/v1/admin/dashboard/stats');
    return res.data;
  },

  // ── Provider 管理 ──
  async listProviders() {
    const res = await get<ApiSuccessResponse<ProviderItem[]>>('/api/v1/admin/providers');
    return res.data;
  },
  async createProvider(data: Record<string, unknown>) {
    const res = await post<ApiSuccessResponse<ProviderItem>>('/api/v1/admin/providers', data);
    return res.data;
  },
  async updateProvider(id: string, data: Record<string, unknown>) {
    const res = await put<ApiSuccessResponse<ProviderItem>>(`/api/v1/admin/providers/${id}`, data);
    return res.data;
  },
  async deleteProvider(id: string) {
    await del<ApiSuccessResponse<null>>(`/api/v1/admin/providers/${id}`);
  },

  // ── Blacklist 管理 ──
  async listBlacklist(params?: Record<string, unknown>) {
    return get<ApiPaginatedResponse<BlacklistItem>>('/api/v1/admin/blacklist', params);
  },
  async createBlacklist(data: Record<string, unknown>) {
    const res = await post<ApiSuccessResponse<BlacklistItem>>('/api/v1/admin/blacklist', data);
    return res.data;
  },
  async deleteBlacklist(id: string) {
    await del<ApiSuccessResponse<null>>(`/api/v1/admin/blacklist/${id}`);
  },

  // ── Analytics 分析 ──
  // 2026-04-10 新增 — P6.08 Analytics Dashboard 数据接口
  // 设计思路：封装后端 analytics 路由，供 Analytics 页面图表使用
  // 影响范围：admin/analytics 页面
  // 潜在风险：大时间跨度查询可能慢
  async analyticsSummary(params?: { from?: string; to?: string }) {
    const res = await get<ApiSuccessResponse<AnalyticsSummary>>(
      '/api/v1/admin/analytics/summary',
      params as Record<string, unknown>,
    );
    return res.data;
  },
  async analyticsDaily(params?: { from?: string; to?: string }) {
    const res = await get<ApiSuccessResponse<DailyStatItem[]>>(
      '/api/v1/admin/analytics/daily',
      params as Record<string, unknown>,
    );
    return res.data;
  },
  async analyticsByClient(params?: { from?: string; to?: string }) {
    const res = await get<ApiSuccessResponse<ClientStatItem[]>>(
      '/api/v1/admin/analytics/by-client',
      params as Record<string, unknown>,
    );
    return res.data;
  },
  async analyticsCost(params?: { from?: string; to?: string }) {
    const res = await get<ApiSuccessResponse<CostReportItem[]>>(
      '/api/v1/admin/analytics/cost',
      params as Record<string, unknown>,
    );
    return res.data;
  },

  // ── Prompt 审核管理 ──
  // 2026-04-09 新增 — 对齐后端 admin.routes.ts (P4.05) 的全部端点
  // 设计思路：封装待审核列表、审批、拒绝、批量审批、精选管理
  // 影响范围：admin/prompts 页面
  // 潜在风险：批量操作需控制数量上限

  /** 获取待审核 Prompt 列表（分页） */
  async pendingPrompts(params?: { page?: number; pageSize?: number }) {
    return get<ApiPaginatedResponse<PendingPromptItem>>(
      '/api/v1/admin/prompts/pending',
      params as Record<string, unknown>,
    );
  },

  /** 审批通过单个 Prompt */
  async approvePrompt(id: string) {
    const res = await post<ApiSuccessResponse<{ id: string; status: string; updatedAt: string }>>(
      `/api/v1/admin/prompts/${id}/approve`,
    );
    return res.data;
  },

  /** 拒绝单个 Prompt */
  async rejectPrompt(id: string, reason: string) {
    const res = await post<ApiSuccessResponse<{ id: string; status: string; updatedAt: string }>>(
      `/api/v1/admin/prompts/${id}/reject`,
      { reason },
    );
    return res.data;
  },

  /** 批量审批通过（最多 50 个） */
  async bulkApprovePrompts(ids: string[]) {
    const res = await post<ApiSuccessResponse<{ approved: number; failed: number }>>(
      '/api/v1/admin/prompts/bulk-approve',
      { ids },
    );
    return res.data;
  },

  /** 手动标记 Prompt 为精选 */
  async featurePrompt(id: string) {
    const res = await post<ApiSuccessResponse<{ id: string; isFeatured: boolean }>>(
      `/api/v1/admin/prompts/${id}/feature`,
    );
    return res.data;
  },

  /** 取消 Prompt 精选标记 */
  async unfeaturePrompt(id: string) {
    const res = await post<ApiSuccessResponse<{ id: string; isFeatured: boolean }>>(
      `/api/v1/admin/prompts/${id}/unfeature`,
    );
    return res.data;
  },

  // ── 增强日志管理 ──
  // 2026-04-10 新增 — 增强日志列表 + 详情（复用 GET /admin/analytics/requests 端点）
  // 设计思路：前端「增强日志」页面通过 adminApi 调用已有的 analytics requests 端点，
  //   支持 9 维筛选（时间/客户端/状态/模型/场景/IP/指纹/userId/关键词）
  // 影响范围：admin/logs 页面
  // 潜在风险：无已知风险

  /** 获取增强日志列表（分页 + 9 维筛选） */
  async listEnhanceLogs(params?: EnhanceLogListParams) {
    return get<ApiPaginatedResponse<EnhanceLogItem>>(
      '/api/v1/admin/analytics/requests',
      params as Record<string, unknown>,
    );
  },

  /** 获取单条增强日志详情 */
  async getEnhanceLogDetail(id: string) {
    const res = await get<ApiSuccessResponse<EnhanceLogDetail>>(`/api/v1/admin/analytics/requests/${id}`);
    return res.data;
  },
};

/** Dashboard 统计数据类型 */
export interface DashboardStats {
  totalUsers: number;
  totalPrompts: number;
  totalAiRequests: number;
  activeProviders: number;
  recentUsers: number;
  recentAiRequests: number;
}

// 2026-04-09 修复 — displayName → name，对齐后端 AiProvider.name 字段
/** Provider 管理项类型 */
export interface ProviderItem {
  id: string;
  slug: string;
  name: string;
  apiMode: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
  isActive: boolean;
  priority: number;
  maxTokens: number;
  timeoutMs: number;
  createdAt: string;
  updatedAt: string;
}

// 2026-04-09 修复 — dimension → type，对齐后端 blacklist_rules 实际字段
/** Blacklist 管理项类型 */
export interface BlacklistItem {
  id: string;
  type: string;
  value: string;
  reason: string | null;
  severity: string | null;
  expiresAt: string | null;
  isActive: boolean;
  hitCount: number;
  blockedBy: string | null;
  createdAt: string;
}

// ── Analytics 类型 — P6.08 ──────────────────────────────
// 2026-04-10 新增 — 对齐后端 analytics.service.ts 返回类型

/** 汇总指标（对应 GET /admin/analytics/summary） */
export interface AnalyticsSummary {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  avgLatencyMs: number;
  totalTokens: number;
  totalCost: number;
}

// 2026-04-09 修复 — 对齐后端 DailyStat Prisma 模型实际字段
/** 每日统计项（对应 GET /admin/analytics/daily） */
export interface DailyStatItem {
  date: string;
  totalViews: number;
  totalCopies: number;
  totalLikes: number;
  newPrompts: number;
  newUsers: number;
  aiRequests: number;
  aiTokens: number;
  aiCost: number;
  aiErrors: number;
  aiReqVscode: number;
  aiReqBrowser: number;
  aiReqWeb: number;
  aiReqIntelij: number;
  aiReqWebhub: number;
}

/** 按客户端分组统计（对应 GET /admin/analytics/by-client） */
export interface ClientStatItem {
  clientType: string;
  count: number;
  totalTokens: number;
  totalCost: number;
  avgLatencyMs: number;
}

/** 成本报告项（对应 GET /admin/analytics/cost） */
export interface CostReportItem {
  provider: string;
  model: string;
  count: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCost: number;
  avgLatencyMs: number;
}

// ── 增强日志类型 — 2026-04-10 新增 ──────────────────────────
// 设计思路：对齐后端 analytics.service.ts 返回的 REQUEST_LIST_SELECT 字段集
// 影响范围：admin/logs 列表页 + 详情页

/** 增强日志列表查询参数（9 维筛选 + 分页） */
export interface EnhanceLogListParams {
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  clientType?: string;
  scene?: string;
  model?: string;
  provider?: string;
  status?: string;
  userId?: string;
  ipAddress?: string;
  fingerprint?: string;
  keyword?: string;
}

/** 增强日志列表项（精简字段） */
export interface EnhanceLogItem {
  id: string;
  requestId: string;
  userId: string | null;
  clientType: string;
  ipAddress: string | null;
  fingerprint: string | null;
  userAgent: string | null;
  originalInput: string;
  enhanceMode: string | null;
  sceneIds: string[];
  isComposite: boolean;
  providerSlug: string | null;
  modelUsed: string | null;
  durationMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estimatedCost: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

/** 增强日志详情（全部字段） */
export interface EnhanceLogDetail extends EnhanceLogItem {
  clientVersion: string | null;
  clientPlatform: string | null;
  language: string | null;
  country: string | null;
  region: string | null;
  routerResult: Record<string, unknown> | null;
  systemPrompt: string | null;
  aiOutput: string | null;
  providerId: string | null;
  apiMode: string | null;
  routerDurationMs: number | null;
  genDurationMs: number | null;
  retryCount: number;
}

// ── Prompt 审核管理类型 — P4.05 ──────────────────────────
// 2026-04-09 新增 — 对齐后端 admin.service.ts pendingSelect 返回字段

/** 待审核 Prompt 项（对应 GET /admin/prompts/pending） */
export interface PendingPromptItem {
  id: string;
  title: string;
  description: string | null;
  content: string;
  tags: string[];
  category: string;
  model: string | null;
  status: string;
  likesCount: number;
  viewsCount: number;
  copiesCount: number;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

// ═══════════════════════════════════════════════════════════
// Meta API
// ═══════════════════════════════════════════════════════════

export const metaApi = {
  /** 获取所有活跃分类 */
  async categories() {
    const res = await get<ApiSuccessResponse<CategoryMeta[]>>('/api/v1/meta/categories');
    return res.data;
  },

  /** 获取所有活跃模型配置 */
  async models() {
    const res = await get<ApiSuccessResponse<ModelMeta[]>>('/api/v1/meta/models');
    return res.data;
  },
};
