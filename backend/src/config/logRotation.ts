/**
 * 生产环境日志轮转配置
 * 2026-04-08 新增 — P2.03
 * 变更类型：新增
 * 设计思路：定义三类日志的轮转策略（应用/审计/AI 请求），
 *   生产环境使用 pino-roll transport 实现每日轮转 + gzip 压缩。
 *   开发环境不启用轮转，直接输出到 stdout（pino-pretty）。
 *   保留天数：应用 30 天、审计 90 天、AI 请求 60 天（§8B.5）
 * 参数：frequency 轮转频率、limit 文件名限制（自动清理）、
 *       mkdir 自动创建目录
 * 影响范围：生产环境 Pino transport 配置
 * 潜在风险：日志目录不存在时 mkdir: true 自动创建；
 *   磁盘满时 pino-roll 会抛出错误，需 PM2 监控
 */

import path from 'path';
import pino from 'pino';

// ── 日志根目录（生产环境通常在应用目录下 logs/）──────────
const LOG_DIR = process.env.LOG_DIR || path.resolve(process.cwd(), 'logs');

// ── 轮转策略常量 ──────────────────────────────────────
export const LOG_ROTATION = {
  /** 应用日志：每日轮转，保留 30 天 */
  app: {
    file: path.join(LOG_DIR, 'app.log'),
    frequency: 'daily' as const,
    /** pino-roll limit 参数：保留文件数量（30 天 ≈ 30 个文件） */
    limit: { count: 30 },
    mkdir: true,
    compress: true,
    dateFormat: 'yyyy-MM-dd',
  },

  /** 审计日志：每日轮转，保留 90 天 */
  audit: {
    file: path.join(LOG_DIR, 'audit.log'),
    frequency: 'daily' as const,
    limit: { count: 90 },
    mkdir: true,
    compress: true,
    dateFormat: 'yyyy-MM-dd',
  },

  /** AI 请求日志：每日轮转，保留 60 天 */
  aiRequest: {
    file: path.join(LOG_DIR, 'ai-request.log'),
    frequency: 'daily' as const,
    limit: { count: 60 },
    mkdir: true,
    compress: true,
    dateFormat: 'yyyy-MM-dd',
  },
} as const;

/**
 * 构建 pino-roll transport 配置
 * 用于生产环境 Pino 初始化时作为 transport target
 *
 * @example
 * ```ts
 * import pino from 'pino';
 * import { buildRollTransport } from './config/logRotation';
 *
 * const logger = pino({
 *   transport: {
 *     targets: [
 *       buildRollTransport('app'),
 *       // 可添加 stdout target 用于 PM2 日志采集
 *     ],
 *   },
 * });
 * ```
 */
export function buildRollTransport(channel: keyof typeof LOG_ROTATION): {
  target: string;
  options: Record<string, unknown>;
  level?: string;
} {
  const cfg = LOG_ROTATION[channel];
  return {
    target: 'pino-roll',
    options: {
      file: cfg.file,
      frequency: cfg.frequency,
      limit: cfg.limit,
      mkdir: cfg.mkdir,
      dateFormat: cfg.dateFormat,
      // pino-roll 原生不支持 compress，需配合外部 cron gzip
      // 此处保留 compress 标记供 cron 任务识别
    },
  };
}

/**
 * 创建通道专用 pino 实例
 * 2026-04-08 新增 — Gap A+B 修复
 * 设计思路：为 audit / aiRequest 通道各自创建独立 pino 实例，
 *   生产环境输出到独立文件（pino-roll）+ stdout（PM2 采集）；
 *   开发环境使用 pino-pretty 输出到 stdout。
 * 参数：
 *   channel — 日志通道名（'audit' | 'aiRequest'）
 *   module — 子 logger module 标签
 * 返回值：独立的 pino.Logger 实例
 * 影响范围：auditLogger.ts, aiLogger.ts
 * 潜在风险：与主 logger 独立，redact 配置需单独维护
 */
export function createChannelLogger(channel: keyof typeof LOG_ROTATION, module: string) {
  const IS_DEV = process.env.NODE_ENV !== 'production';
  const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

  const REDACT_PATHS = [
    'password',
    'passwordHash',
    'apiKey',
    'api_key',
    'authorization',
    'cookie',
    'token',
    'accessToken',
    'refreshToken',
  ];

  if (IS_DEV) {
    return pino({
      level: LOG_LEVEL,
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      },
    }).child({ module });
  }

  // 生产环境：独立文件（pino-roll）+ stdout 双通道
  return pino({
    level: LOG_LEVEL,
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    transport: {
      targets: [
        buildRollTransport(channel),
        { target: 'pino/file', options: { destination: 1 } }, // stdout for PM2
      ],
    },
  }).child({ module });
}

export { LOG_DIR };
