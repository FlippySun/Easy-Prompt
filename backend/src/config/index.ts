/**
 * 环境变量加载与 Zod 校验
 * 2026-04-07 新增 — P1.02 环境变量与配置模块
 * 设计思路：用 Zod 在启动时校验全部环境变量，缺失必填字段立即报错退出
 * 影响范围：全局配置入口，所有模块通过 import { config } from '@/config' 获取
 * 潜在风险：无已知风险
 */

import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

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
  COOKIE_DOMAIN: z.string().default('.zhiz.chat'),
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
  OAUTH_CALLBACK_BASE_URL: z.string().default(''),
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
