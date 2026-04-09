/**
 * EnhanceHistory 服务 — 跨设备历史同步
 * 2026-04-09 新增 — P6.01
 * 变更类型：新增
 * 设计思路：
 *   1. getHistory()：分页查询用户历史，支持按 clientType/日期范围筛选
 *   2. syncHistory()：批量 upsert（clientId 去重），单次上限 HISTORY_SYNC_BATCH_MAX
 *   3. exportHistory()：导出 JSON/CSV 格式
 *   4. archiveOldRecords()：超限归档（删除超出 HISTORY_SYNC_LIMIT 的旧记录），供 cron 调用
 * 参数：各方法见签名
 * 返回：见各方法
 * 影响范围：history 路由、cron 归档任务
 * 潜在风险：大批量 upsert 时的事务性能（已用 $transaction 控制）
 */

import { prisma } from '../lib/prisma';
import { createChildLogger } from '../utils/logger';
import { HISTORY_SYNC_LIMIT, HISTORY_SYNC_BATCH_MAX, PAGINATION } from '../config/constants';
import type {
  HistorySyncItem,
  HistorySyncResponse,
  HistoryExportFormat,
  HistoryListQuery,
} from '../types/history';

const log = createChildLogger('history');

// ── 列表查询 ───────────────────────────────────────────

/**
 * 分页查询用户的增强历史
 * @param userId - 用户 ID
 * @param query  - 分页 + 筛选条件
 */
export async function getHistory(userId: string, query: HistoryListQuery = {}) {
  const page = query.page ?? PAGINATION.DEFAULT_PAGE;
  const limit = Math.min(query.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const skip = (page - 1) * limit;

  // 2026-04-09 — P6.01：构建 where 条件（支持 clientType / 日期范围）
  const where: Record<string, unknown> = { userId };
  if (query.clientType) where.clientType = query.clientType;
  if (query.startDate || query.endDate) {
    const createdAt: Record<string, Date> = {};
    if (query.startDate) createdAt.gte = new Date(query.startDate);
    if (query.endDate) createdAt.lte = new Date(query.endDate);
    where.createdAt = createdAt;
  }

  const [data, total] = await Promise.all([
    prisma.enhanceHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.enhanceHistory.count({ where }),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ── 批量同步（upsert 去重） ───────────────────────────

/**
 * 批量同步客户端历史到服务端
 * 使用 [userId, clientId] 唯一约束进行 upsert 去重
 * @param userId - 用户 ID
 * @param items  - 客户端上传的历史条目（最多 HISTORY_SYNC_BATCH_MAX 条）
 * @returns 同步结果统计
 */
export async function syncHistory(
  userId: string,
  items: HistorySyncItem[],
): Promise<HistorySyncResponse> {
  // 截断超出批量限制的部分
  const batch = items.slice(0, HISTORY_SYNC_BATCH_MAX);
  let synced = 0;
  let skipped = 0;

  // 2026-04-09 — P6.01：逐条 upsert，事务保证原子性
  // 注意：Prisma 不支持批量 upsert with unique constraint，需逐条处理
  await prisma.$transaction(async (tx) => {
    for (const item of batch) {
      // 基础校验：clientId + inputText + outputText 必填
      if (!item.clientId || !item.inputText || !item.outputText) {
        skipped++;
        continue;
      }

      try {
        await tx.enhanceHistory.upsert({
          where: {
            userId_clientId: { userId, clientId: item.clientId },
          },
          create: {
            userId,
            clientId: item.clientId,
            inputText: item.inputText,
            outputText: item.outputText,
            scene: item.scene ?? null,
            model: item.model ?? null,
            clientType: item.clientType ?? null,
            enhanceMode: item.enhanceMode ?? null,
            language: item.language ?? null,
            // 保留客户端原始创建时间（如果提供）
            ...(item.createdAt ? { createdAt: new Date(item.createdAt) } : {}),
          },
          update: {
            // upsert 时只更新 outputText（允许客户端修正结果）
            outputText: item.outputText,
          },
        });
        synced++;
      } catch (err) {
        log.warn({ err, clientId: item.clientId }, 'Failed to upsert history item');
        skipped++;
      }
    }
  });

  // 查询当前总数
  const total = await prisma.enhanceHistory.count({ where: { userId } });

  log.info({ userId, synced, skipped, total }, 'History sync completed');
  return { synced, skipped, total };
}

// ── 导出 ──────────────────────────────────────────────

/**
 * 导出用户全部历史（JSON 或 CSV）
 * @param userId - 用户 ID
 * @param format - 'json' | 'csv'
 * @returns 导出内容字符串
 */
export async function exportHistory(
  userId: string,
  format: HistoryExportFormat = 'json',
): Promise<string> {
  const records = await prisma.enhanceHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      clientId: true,
      inputText: true,
      outputText: true,
      scene: true,
      model: true,
      clientType: true,
      enhanceMode: true,
      language: true,
      createdAt: true,
    },
  });

  if (format === 'csv') {
    // 2026-04-09 — P6.01：CSV 导出（双引号转义）
    const header =
      'clientId,inputText,outputText,scene,model,clientType,enhanceMode,language,createdAt';
    const rows = records.map((r) =>
      [
        r.clientId,
        csvEscape(r.inputText),
        csvEscape(r.outputText),
        r.scene ?? '',
        r.model ?? '',
        r.clientType ?? '',
        r.enhanceMode ?? '',
        r.language ?? '',
        r.createdAt.toISOString(),
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }

  // JSON 格式
  return JSON.stringify(records, null, 2);
}

/**
 * CSV 字段转义：包含逗号/换行/双引号时加双引号包裹
 */
function csvEscape(value: string): string {
  if (/[,"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ── 归档（超限清理） ──────────────────────────────────

/**
 * 清理超出 HISTORY_SYNC_LIMIT 的旧记录
 * 保留最新 HISTORY_SYNC_LIMIT 条，删除其余
 * @param userId - 用户 ID（传空则处理所有用户）
 * @returns 删除的记录数
 */
export async function archiveOldRecords(userId?: string): Promise<number> {
  // 2026-04-09 — P6.01：归档策略
  // 查询超限用户：groupBy + 应用层过滤（避免 Prisma having 类型限制）
  let userIds: string[];

  if (userId) {
    userIds = [userId];
  } else {
    const groups = await prisma.enhanceHistory.groupBy({
      by: ['userId'],
      _count: { _all: true },
    });
    userIds = groups.filter((g) => g._count._all > HISTORY_SYNC_LIMIT).map((g) => g.userId);
  }

  let totalDeleted = 0;

  for (const uid of userIds) {
    // 找到第 HISTORY_SYNC_LIMIT 条记录的 createdAt 作为分界线
    const boundary = await prisma.enhanceHistory.findMany({
      where: { userId: uid },
      orderBy: { createdAt: 'desc' },
      skip: HISTORY_SYNC_LIMIT - 1,
      take: 1,
      select: { createdAt: true },
    });

    if (boundary.length === 0) continue;

    const cutoff = boundary[0].createdAt;
    const deleted = await prisma.enhanceHistory.deleteMany({
      where: {
        userId: uid,
        createdAt: { lt: cutoff },
      },
    });

    totalDeleted += deleted.count;
    log.info({ userId: uid, deleted: deleted.count }, 'Archived old history records');
  }

  return totalDeleted;
}
