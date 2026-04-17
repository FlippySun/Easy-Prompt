/**
 * 环境变量加载与 Zod 校验
 * 2026-04-07 新增 — P1.02 环境变量与配置模块
 * 设计思路：用 Zod 在启动时校验全部环境变量，缺失必填字段立即报错退出
 * 影响范围：全局配置入口，所有模块通过 import { config } from '@/config' 获取
 * 潜在风险：无已知风险
 */

import { z } from 'zod';
import dotenv from 'dotenv';
import { AppError } from '../utils/errors';

dotenv.config();

const optionalHex64String = z
  .string()
  .default('')
  .refine(
    (value) => value === '' || /^[0-9a-f]{64}$/i.test(value),
    '必须是 64 个 hex 字符，或留空表示暂未启用',
  );

/**
 * 2026-04-17 修复 — 环境区分任务 2：可空 URL 环境变量显式校验
 * 变更类型：修复/配置
 * 功能描述：为 `AUTH_WEB_BASE_URL` / `OAUTH_CALLBACK_BASE_URL` 提供“留空允许、非空必须是合法 URL”的统一约束，避免运行时把坏值带入 OAuth redirect 构造。
 * 设计思路：development/test/production 共享同一 schema；空字符串表示等待启动脚本或部署环境注入，非空时立即在启动阶段 fail-fast。
 * 参数与返回值：`optionalUrlString` 接收字符串环境变量，返回经 Zod 校验的字符串值。
 * 影响范围：backend 配置解析、OAuth provider callback 构造、前端登录/complete 页回跳。
 * 潜在风险：若现有环境写入非 URL 字符串，进程会在启动时直接失败；这是预期的 fail-closed 行为。
 */
const optionalUrlString = z
  .string()
  .default('')
  .refine(
    (value) => value === '' || z.string().url().safeParse(value).success,
    '必须是有效 URL，或留空表示由启动脚本/部署环境注入',
  );

// ── Zod Schema ──────────────────────────────────────────
const configSchema = z.object({
  // 基础
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),

  // 数据库
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL 必须是有效的 PostgreSQL 连接串' }),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT
  JWT_SECRET: z.string().min(16, 'JWT_SECRET 至少 16 字符'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),

  // CORS
  CORS_ORIGINS: z.string().default(''),

  // Cookie
  // 2026-04-17 修复 — 环境区分任务 2：默认不再静默回退生产 `.zhiz.chat` 域；
  // 本地/未显式配置时留空，由运行时决定 host-only cookie 行为。
  COOKIE_DOMAIN: z.string().default(''),
  COOKIE_SECRET: z.string().min(8, 'COOKIE_SECRET 至少 8 字符'),

  // 日志
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Provider 加密（32 字节 hex = 64 字符）
  PROVIDER_ENCRYPTION_KEY: z.string().length(64, 'PROVIDER_ENCRYPTION_KEY 必须是 64 个 hex 字符'),

  // 限流
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_GLOBAL_WINDOW_SEC: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_AI_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_AI_WINDOW_SEC: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_LOGIN_WINDOW_SEC: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_SEARCH_MAX: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_SEARCH_WINDOW_SEC: z.coerce.number().int().positive().default(60),

  // 管理员
  ADMIN_EMAILS: z.string().default(''),

  // 2026-04-09 新增 — P6.03 OAuth 集成（GitHub / Google）
  // 所有 OAuth 字段可选，未配置时对应 OAuth 路由返回 501
  OAUTH_GITHUB_CLIENT_ID: z.string().default(''),
  OAUTH_GITHUB_CLIENT_SECRET: z.string().default(''),
  OAUTH_GOOGLE_CLIENT_ID: z.string().default(''),
  OAUTH_GOOGLE_CLIENT_SECRET: z.string().default(''),
  // OAuth 回调基准 URL（如 https://api.zhiz.chat）
  OAUTH_CALLBACK_BASE_URL: optionalUrlString,
  // 2026-04-15 优化 — Zhiz OAuth Superpowers T4 发信通道切换为腾讯云 SES API
  // 变更类型：优化/配置
  // 功能描述：补齐 Zhiz OAuth 起始链路、前端回跳基准、OAuth token 加密与方案 B 腾讯云 SES 发信配置入口。
  // 设计思路：
  //   1. OAUTH_CALLBACK_BASE_URL 仅用于 provider redirect_uri。
  //   2. AUTH_WEB_BASE_URL 仅用于前端登录页/complete 页回跳。
  //   3. OAuth token 加密 key 与 Provider API key 加密 key 分离，便于后续 T5 独立轮换。
  //   4. 邮件验证码改走腾讯云 SES API，避免继续依赖已下线的旧邮件发信路径。
  // 参数与返回值：环境变量解析后统一暴露到 config 对象，供 OAuth 与邮件验证链路读取。
  // 影响范围：OAuth start/callback、后续 continuation ticket、方案 B 邮箱验证码子流程。
  // 潜在风险：若生产环境遗漏新变量，相关 Zhiz/邮件分支将在运行时按“未配置”处理。
  OAUTH_ZHIZ_CLIENT_ID: z.string().default(''),
  OAUTH_ZHIZ_CLIENT_SECRET: z.string().default(''),
  OAUTH_ZHIZ_BASE_URL: z.string().default('https://8060.zhiz.chat'),
  OAUTH_ZHIZ_AUTH_PAGE_URL: z.string().default('https://3001.zhiz.chat/#/oauth/authorize'),
  OAUTH_TOKEN_ENCRYPTION_KEY: optionalHex64String,
  AUTH_WEB_BASE_URL: optionalUrlString,
  TENCENTCLOUD_SECRET_ID: z.string().default(''),
  TENCENTCLOUD_SECRET_KEY: z.string().default(''),
  TENCENTCLOUD_REGION: z.string().default(''),
  TENCENTCLOUD_SES_FROM_EMAIL: z.string().default(''),
  TENCENTCLOUD_SES_TEMPLATE_ID: z.coerce.number().int().nonnegative().default(0),
  AUTH_EMAIL_CODE_TTL_SEC: z.coerce.number().int().positive().default(600),
  AUTH_EMAIL_CODE_RESEND_COOLDOWN_SEC: z.coerce.number().int().positive().default(60),
  AUTH_EMAIL_CODE_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
});

// ── 类型导出 ──────────────────────────────────────────
export type Config = z.infer<typeof configSchema>;

// ── 解析并导出 ──────────────────────────────────────────
const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`\n❌ 环境变量校验失败:\n${formatted}\n`);
  process.exit(1);
}

export const config: Config = parsed.data;

function normalizeOptionalEnvValue(value: string): string {
  return value.trim();
}

/**
 * 2026-04-17 新增 — 环境区分任务 2：关键基准地址显式 fail-closed helper
 * 变更类型：新增/修复/配置
 * 功能描述：集中要求 `AUTH_WEB_BASE_URL` / `OAUTH_CALLBACK_BASE_URL` 在被实际消费时必须存在，避免 route/service 继续各自静默 fallback。
 * 设计思路：
 *   1. schema 层允许空字符串，兼容不同启动入口按需注入。
 *   2. 真正消费这些基准地址的链路改为调用本 helper，在缺失时抛出统一的 500 配置错误。
 *   3. 返回值统一去掉尾部 `/`，避免 URL 拼接重复斜杠。
 * 参数与返回值：`requireConfiguredBaseUrl(key, usage)` 返回去尾斜杠后的基准 URL；缺失时抛出 `AppError`。
 * 影响范围：OAuth provider callback URL、前端登录/complete 页回跳、后续环境分层测试。
 * 潜在风险：若调用链在未注入关键 env 时触发，会显式失败而不是继续兜底；这是预期的 fail-closed 行为。
 */
export function requireConfiguredBaseUrl(
  key: 'AUTH_WEB_BASE_URL' | 'OAUTH_CALLBACK_BASE_URL',
  usage: string,
): string {
  const value = normalizeOptionalEnvValue(config[key]);
  if (value) {
    return value.replace(/\/+$/, '');
  }

  throw new AppError('SYSTEM_INTERNAL_ERROR', `${key} is required for ${usage}`, {
    missingEnv: key,
    usage,
  });
}

/**
 * 2026-04-17 新增 — 环境区分任务 2：Cookie Domain 归一化 helper
 * 变更类型：新增/修复/配置
 * 功能描述：把 `COOKIE_DOMAIN` 从原始字符串转换为 Express 可安全消费的可选值，空字符串时不再写出生产 domain 属性。
 * 设计思路：development 缺省返回 `undefined` 让浏览器采用 host-only cookie；production 显式配置时继续使用受控 domain。
 * 参数与返回值：`getCookieDomain()` 返回去空白后的 domain 字符串或 `undefined`。
 * 影响范围：OAuth callback refresh cookie、本地会话隔离、生产跨子域 cookie 行为。
 * 潜在风险：若生产遗漏 `COOKIE_DOMAIN`，cookie 会退化为 host-only；这是比静默复用 `.zhiz.chat` 更安全的失败方式。
 */
export function getCookieDomain(): string | undefined {
  const cookieDomain = normalizeOptionalEnvValue(config.COOKIE_DOMAIN);
  return cookieDomain || undefined;
}

/** 解析 CORS_ORIGINS 为字符串数组 */
export function getCorsOrigins(): string[] {
  if (!config.CORS_ORIGINS) return [];
  return config.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 解析 ADMIN_EMAILS 为字符串数组 */
export function getAdminEmails(): string[] {
  if (!config.ADMIN_EMAILS) return [];
  return config.ADMIN_EMAILS.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** 是否为开发环境 */
export const isDev = config.NODE_ENV === 'development';

/** 是否为生产环境 */
export const isProd = config.NODE_ENV === 'production';

/** 是否为测试环境 */
export const isTest = config.NODE_ENV === 'test';
