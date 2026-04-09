/**
 * 日志压缩清理任务
 * 2026-04-08 新增 — P2.08
 * 变更类型：新增
 * 设计思路：每天凌晨 3:30 执行，清理超过保留期的旧 AI 请求日志记录。
 *   日志文件压缩由 pino-roll 或外部 logrotate 处理（P2.03），
 *   此任务仅负责 DB 层面的日志清理：
 *   1. 删除超过 90 天的 ai_request_logs 记录（减少 DB 膨胀）
 *   文件级别的压缩在 P2.03 logRotation 配置中已覆盖。
 * 参数：无
 * 影响范围：ai_request_logs 表
 * 潜在风险：大量删除可能造成短暂锁表，凌晨执行降低影响
 */

import { prisma } from '../lib/prisma';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('cron:logCompress');

/** AI 请求日志 DB 记录保留天数 */
const AI_LOG_RETENTION_DAYS = 90;

/** 每批删除上限（避免长事务） */
const DELETE_BATCH_SIZE = 5000;

export const logCompressJob = {
  name: 'log-compress-cleanup',
  /** 每天凌晨 3:30 执行 */
  schedule: '30 3 * * *',
  handler: cleanupOldLogs,
};

async function cleanupOldLogs(): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - AI_LOG_RETENTION_DAYS);

  log.info(
    { retentionDays: AI_LOG_RETENTION_DAYS, cutoff: cutoff.toISOString() },
    'Starting old AI request log cleanup',
  );

  let totalDeleted = 0;
  let batchDeleted: number;

  // 分批删除，避免单次删除大量记录造成长事务
  do {
    // Prisma deleteMany 不支持 LIMIT，使用 findMany + deleteMany by IDs
    const oldLogs = await prisma.aiRequestLog.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      take: DELETE_BATCH_SIZE,
    });

    if (oldLogs.length === 0) break;

    const ids = oldLogs.map((l) => l.id);
    const result = await prisma.aiRequestLog.deleteMany({
      where: { id: { in: ids } },
    });

    batchDeleted = result.count;
    totalDeleted += batchDeleted;

    if (batchDeleted > 0) {
      log.info(
        { batch: batchDeleted, total: totalDeleted },
        `Deleted batch of old AI request logs`,
      );
    }
  } while (batchDeleted === DELETE_BATCH_SIZE);

  log.info({ totalDeleted, retentionDays: AI_LOG_RETENTION_DAYS }, 'Old AI request log cleanup completed');
}
