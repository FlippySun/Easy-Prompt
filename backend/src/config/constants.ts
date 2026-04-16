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
// 2026-04-15 修复 — SSO 全端白名单扩展为 zhiz.chat 全子域名 + 多端回调协议
// 变更类型：修复/安全/配置
// 功能描述：允许 zhiz.chat 根域名及其所有受控子域名完成 SSO 回跳，同时显式保留 Browser / VS Code / IntelliJ / Safari 等客户端的回调协议。
// 设计思路：
//   1. Web 侧从枚举单个域名改为限制在 https + *.zhiz.chat 受控命名空间内，避免每新增一个前端子域名都要热修。
//   2. Browser / IDE 继续显式允许各自回调协议，避免 Web wildcard 误扩展到非 HTTP(S) scheme。
//   3. 保留 localhost/127.0.0.1 支持 IntelliJ 随机端口回调，保留 vscode publisher.name 精确匹配。
//   4. 额外补充 moz-extension:// 作为 Firefox fallback / 未来回调兜底，其余浏览器扩展路径继续通过 chrome-extension / chromiumapp.org / allizom.org / safari-web-extension 覆盖。
// 参数与返回值：`SSO.ALLOWED_REDIRECT_PATTERNS` 仅用于授权码模式 redirect_uri 白名单匹配，无单独返回值。
// 影响范围：generateSsoCode() redirect_uri 校验、web/web-hub/browser/VS Code/IntelliJ 的 SSO 回跳。
// 潜在风险：允许整个 *.zhiz.chat 命名空间后，新建子域名会自动获得 SSO 回跳资格；需继续确保该域名体系受控。
export const SSO = {
  CODE_EXPIRES_SEC: 5 * 60, // 5 分钟
  ALLOWED_REDIRECT_PATTERNS: [
    /^https:\/\/(?:[a-z0-9-]+\.)*zhiz\.chat(?:\/|$)/,
    /^chrome-extension:\/\//,
    /^vscode:\/\/flippysun\.easy-prompt-ai\//, // VS Code — 精确匹配 publisher.name
    /^http:\/\/localhost(:\d+)?\//, // IntelliJ — localhost 回调
    /^http:\/\/127\.0\.0\.1(:\d+)?\//, // IntelliJ — loopback 备用
    /^https:\/\/[a-z]+\.chromiumapp\.org\//, // Chrome launchWebAuthFlow redirect
    /^https:\/\/[a-f0-9-]+\.extensions\.allizom\.org\//, // Firefox launchWebAuthFlow redirect
    /^safari-web-extension:\/\//, // Safari WebExtension Tab redirect callback
    /^moz-extension:\/\//, // Firefox fallback / internal callback page
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
