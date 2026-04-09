/**
 * 每日统计聚合任务
 * 2026-04-08 新增 — P2.08
 * 变更类型：新增
 * 设计思路：每天凌晨 2:00 执行，将前一天的 ai_request_logs 聚合写入 daily_stats 表。
 *   DailyStat 以 date 为主键（单行/天），按端分拆为 aiReqVscode/aiReqBrowser 等列。
 *   使用 upsert 保证幂等（重复执行不产生重复行）。
 * 参数：无（自动取前一天日期）
 * 影响范围：daily_stats 表
 * 潜在风险：大量日志时聚合查询耗时，但凌晨执行影响低
 */

import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('cron:dailyStats');

export const dailyStatsJob = {
  name: 'daily-stats-aggregation',
  /** 每天凌晨 2:00 执行 */
  schedule: '0 2 * * *',
  handler: aggregateDailyStats,
};

/** clientType → DailyStat 列名映射 */
const CLIENT_COL_MAP: Record<string, keyof Prisma.DailyStatUncheckedCreateInput> = {
  vscode: 'aiReqVscode',
  browser: 'aiReqBrowser',
  web: 'aiReqWeb',
  intellij: 'aiReqIntelij',
  'web-hub': 'aiReqWebhub',
};

async function aggregateDailyStats(): Promise<void> {
  // 计算前一天的时间范围（UTC）
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const dayEnd = new Date(yesterday);
  dayEnd.setHours(23, 59, 59, 999);

  const dateStr = yesterday.toISOString().slice(0, 10); // YYYY-MM-DD

  log.info({ date: dateStr }, 'Starting daily stats aggregation');

  const dateWhere = { createdAt: { gte: yesterday, lte: dayEnd } };

  // 全量聚合
  const total = await prisma.aiRequestLog.aggregate({
    where: dateWhere,
    _count: { id: true },
    _sum: { totalTokens: true, estimatedCost: true },
  });

  // 错误数
  const errorCount = await prisma.aiRequestLog.count({
    where: { ...dateWhere, status: { not: 'success' } },
  });

  // 按 clientType 分组统计请求数
  const byClient = await prisma.aiRequestLog.groupBy({
    by: ['clientType'],
    where: dateWhere,
    _count: { id: true },
  });

  // 构造按端分拆数据
  const perClient: Record<string, number> = {};
  for (const g of byClient) {
    const col = CLIENT_COL_MAP[g.clientType];
    if (col) {
      perClient[col] = g._count.id;
    }
  }

  const aiRequests = total._count.id;
  const aiTokens = total._sum.totalTokens ?? 0;
  const aiCost = total._sum.estimatedCost ?? new Prisma.Decimal(0);

  const data = {
    aiRequests,
    aiErrors: errorCount,
    aiTokens,
    aiCost,
    ...perClient,
  };

  await prisma.dailyStat.upsert({
    where: { date: yesterday },
    create: {
      date: yesterday,
      ...data,
    },
    update: data,
  });

  log.info(
    { date: dateStr, aiRequests, aiErrors: errorCount },
    'Daily stats aggregation completed',
  );
}
