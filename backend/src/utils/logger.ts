/**
 * Pino 日志初始化
 * 2026-04-07 新增 — P1.10 Pino 日志系统
 * 设计思路：开发环境用 pino-pretty 人类可读格式，生产环境输出 JSON 到 stdout
 *   自动 redact 敏感字段，子 logger 工厂方便各模块标记来源
 * 影响范围：全局日志基础设施
 * 潜在风险：无已知风险
 */

import pino from 'pino';
// 2026-04-08 修复 — P2.03 生产环境日志轮转接入（验证报告 Gap #2）
import { buildRollTransport } from '../config/logRotation';

// 延迟读取避免循环依赖 — config 模块可能还未初始化
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const IS_DEV = process.env.NODE_ENV !== 'production';

// ── 敏感字段 redact ──────────────────────────────────
const REDACT_PATHS = [
  'password',
  'passwordHash',
  'password_hash',
  'token',
  'accessToken',
  'refreshToken',
  'access_token',
  'refresh_token',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'req.headers.authorization',
  'req.headers.cookie',
];

// ── 创建根 logger ──────────────────────────────────────
// 2026-04-08 修复 — P2.03：生产环境使用 pino-roll 日志轮转 + stdout 双输出
//   开发环境保持 pino-pretty 人类可读格式
//   设计思路：生产环境同时写入文件（pino-roll 每日轮转）和 stdout（PM2 采集），
//     确保日志既持久化又可被进程管理器捕获
//   影响范围：全局日志输出目标
//   潜在风险：pino-roll 目录不存在时自动 mkdir；磁盘满时 pino-roll 抛错
function buildTransportConfig() {
  if (IS_DEV) {
    return {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    };
  }

  // 生产环境：pino-roll 文件轮转 + stdout 双通道
  return {
    targets: [
      buildRollTransport('app'),
      { target: 'pino/file', options: { destination: 1 } }, // stdout for PM2
    ],
  };
}

export const logger = pino({
  level: LOG_LEVEL,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  transport: buildTransportConfig(),
});

/**
 * 创建子 logger，自动附加 module 字段
 * @param module 模块名称，如 'auth', 'ai-gateway', 'blacklist'
 */
export function createChildLogger(module: string) {
  return logger.child({ module });
}
