/**
 * 全局常量定义
 * 2026-04-07 新增 — P1.02 常量模块
 * 设计思路：集中管理业务常量，避免魔法数字散落各处
 * 影响范围：限流服务、黑名单服务、分页等
 * 潜在风险：无已知风险
 */

// ── 渐进式封禁阶梯（fail2ban 风格）──────────────────
// 阶梯等级 → 封禁时长（秒），0 = 仅警告，-1 = 永久
export const BAN_LADDER: Record<number, { duration: number; label: string }> = {
  1: { duration: 5 * 60, label: '5 分钟' },
  2: { duration: 30 * 60, label: '30 分钟' },
  3: { duration: 60 * 60, label: '1 小时' },
  4: { duration: 6 * 60 * 60, label: '6 小时' },
  5: { duration: 24 * 60 * 60, label: '1 天' },
  6: { duration: 7 * 24 * 60 * 60, label: '7 天' },
  7: { duration: -1, label: '永久' },
};

export const MAX_BAN_LEVEL = 7;

// ── 分页默认值 ──────────────────────────────────────
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  // 2026-04-09 修改 — 从 100 提升到 200，匹配 web-hub 全量加载需求（当前 ~102 条 Prompt）
  MAX_LIMIT: 200,
} as const;

// ── 密码强度要求 ──────────────────────────────────────
export const PASSWORD_POLICY = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
  /** 要求至少含：大写、小写、数字 */
  PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
} as const;

// ── AI 增强限制 ──────────────────────────────────────
export const AI_LIMITS = {
  MAX_INPUT_LENGTH: 10000,
  MIN_INPUT_LENGTH: 2,
  DEFAULT_TIMEOUT_MS: 30000,
} as const;

// ── SSO 授权码 ──────────────────────────────────────
export const SSO = {
  CODE_EXPIRES_SEC: 5 * 60, // 5 分钟
  ALLOWED_REDIRECT_PATTERNS: [
    /^https:\/\/zhiz\.chat\//,
    /^https:\/\/prompt\.zhiz\.chat\//,
    /^chrome-extension:\/\//,
    /^vscode:\/\//,
  ],
} as const;

// ── 历史记录上限 ──────────────────────────────────────
export const HISTORY_LIMIT = 100;
// 2026-04-09 新增 — P6.01：跨设备同步时服务端保留上限（超限由 cron 归档）
export const HISTORY_SYNC_LIMIT = 500;
// 单次同步批量上传最大条数
export const HISTORY_SYNC_BATCH_MAX = 100;

// ── 客户端类型枚举 ──────────────────────────────────
export const CLIENT_TYPES = ['vscode', 'browser', 'web', 'intellij', 'web-hub'] as const;

export type ClientType = (typeof CLIENT_TYPES)[number];
