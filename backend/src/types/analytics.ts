/**
 * Analytics 相关类型
 * 2026-04-07 新增 — P1.06
 */

export interface AnalyticsSummary {
  totalRequests: number;
  totalTokens: number;
  totalCostUsd: number;
  totalErrors: number;
  avgLatencyMs: number;
  byClient: Record<string, number>;
  byModel: Record<string, number>;
  byStatus: Record<string, number>;
}

export interface DailyAnalytics {
  date: string;
  aiRequests: number;
  aiTokens: number;
  aiCost: number;
  aiErrors: number;
  totalViews: number;
  totalCopies: number;
  totalLikes: number;
  newPrompts: number;
  newUsers: number;
}
