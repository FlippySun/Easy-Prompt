/**
 * 定时任务调度器入口
 * 2026-04-08 新增 — P2.08
 * 变更类型：新增
 * 设计思路：统一注册所有 cron 任务，由 server.ts 启动时调用 initCronJobs()。
 *   每个任务独立文件，导出 { schedule, handler, name } 三元组。
 *   生产环境启用，开发环境可通过 CRON_ENABLED=false 禁用。
 * 参数：无
 * 影响范围：server.ts 启动流程
 * 潜在风险：cron handler 异常不应影响主服务，已用 try/catch 隔离
 */

import cron from 'node-cron';
import { createChildLogger } from '../utils/logger';
import { dailyStatsJob } from './dailyStats';
import { cleanupJob } from './cleanup';
import { logCompressJob } from './logCompress';
// 2026-04-08 新增 — P2.08 Gap C+D 补齐
import { rateDecayJob } from './rateDecay';
import { blacklistCacheSyncJob } from './blacklistCacheSync';
import { featuredRefreshJob } from './featuredRefresh';
import { scenesSyncJob } from './scenesSync';

const log = createChildLogger('cron');

/** 任务注册表（按执行频率排列：高频 → 低频） */
const JOBS = [
  rateDecayJob, // 每 5 分钟 — 限流计数器衰减
  blacklistCacheSyncJob, // 每 10 分钟 — 黑名单缓存同步
  cleanupJob, // 每小时 — 过期黑名单 + 限流记录清理
  scenesSyncJob, // 每日 01:00 — 核心场景同步
  dailyStatsJob, // 每日 02:00 — 统计聚合
  logCompressJob, // 每日 03:30 — 旧日志清理
  featuredRefreshJob, // 每日 04:00 — 精选刷新（P4.03 实际算法）
];

/**
 * 初始化并启动所有定时任务
 * 应在 server.ts listen 回调之后调用
 */
export function initCronJobs(): void {
  const enabled = process.env.CRON_ENABLED !== 'false';
  if (!enabled) {
    log.info('Cron jobs disabled (CRON_ENABLED=false)');
    return;
  }

  for (const job of JOBS) {
    if (!cron.validate(job.schedule)) {
      log.error({ name: job.name, schedule: job.schedule }, 'Invalid cron schedule, skipping');
      continue;
    }

    cron.schedule(job.schedule, async () => {
      const start = Date.now();
      log.info({ name: job.name }, `Cron job [${job.name}] started`);
      try {
        await job.handler();
        log.info(
          { name: job.name, durationMs: Date.now() - start },
          `Cron job [${job.name}] completed`,
        );
      } catch (err) {
        log.error(
          { name: job.name, err, durationMs: Date.now() - start },
          `Cron job [${job.name}] failed`,
        );
      }
    });

    log.info({ name: job.name, schedule: job.schedule }, `Cron job [${job.name}] registered`);
  }

  log.info({ count: JOBS.length }, 'All cron jobs initialized');
}
