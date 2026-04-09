/**
 * Prisma Client 单例
 * 2026-04-07 新增 — P1.04 Prisma Client 初始化
 * 设计思路：开发环境复用全局实例避免热重载时连接泄露，
 *   生产环境正常实例化
 * 影响范围：所有数据库操作
 * 潜在风险：无已知风险
 */

import { PrismaClient } from '@prisma/client';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('prisma');

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ]
        : [
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ],
  });

// 开发环境日志桥接
if (process.env.NODE_ENV === 'development') {
  (prisma as PrismaClient & { $on: (event: string, cb: (e: { query: string; duration: number }) => void) => void })
    .$on('query', (e: { query: string; duration: number }) => {
      log.debug({ query: e.query, duration: e.duration }, 'Prisma query');
    });
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
