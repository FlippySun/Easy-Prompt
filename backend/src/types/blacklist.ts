/**
 * Blacklist 相关类型
 * 2026-04-07 新增 — P1.06
 */

export type BlacklistType = 'user' | 'ip' | 'fingerprint' | 'ip_range';
export type BlacklistSource = 'admin' | 'auto';
export type BlacklistSeverity = 'block' | 'warn' | 'throttle';

export interface BlacklistRule {
  id: string;
  type: BlacklistType;
  value: string;
  source: BlacklistSource;
  violationLevel: number;
  reason: string;
  blockedBy: string | null;
  severity: BlacklistSeverity;
  expiresAt: Date | null;
  isActive: boolean;
  hitCount: number;
  lastHitAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RateViolation {
  id: string;
  entityType: string;
  entityValue: string;
  violationCount: number;
  currentLevel: number;
  lastWindowHits: number;
  lastThreshold: number;
  lastViolationAt: Date;
  activeRuleId: string | null;
  lastUnbanAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 黑名单检查结果 */
export interface BlacklistCheckResult {
  blocked: boolean;
  rule?: BlacklistRule;
  retryAfter?: number;
}
