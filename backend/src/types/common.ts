/**
 * 通用共享类型
 * 2026-04-07 新增 — P1.06
 */

/** 分页响应包装 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** API 统一成功响应 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

/** API 统一错误响应 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    httpStatus: number;
    timestamp: string;
    requestId?: string;
  };
}

/** Express Request 扩展字段 */
export interface RequestUser {
  userId: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
}
