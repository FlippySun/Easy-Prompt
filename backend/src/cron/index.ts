/**
 * 定时任务调度器入口
 * 2026-04-08 新增 | 2026-04-16 Batch B 更新 — P2.08
 * 变更类型：新增/安全/运维
 * 功能描述：统一注册所有 cron 任务，由 server.ts 启动时调用 initCronJobs()；Batch B 起默认仅在 production 自动启用，避免 shared DB 直连开发时由本地进程重复执行后台副作用任务。
 * 设计思路：
 *   1. 每个任务独立文件，导出 { schedule, handler, name } 三元组。
 *   2. 未显式配置 `CRON_ENABLED` 时，production 默认启用，非 production 默认关闭。
 *   3. 若用户显式设置 `CRON_ENABLED=true/false`，则优先尊重显式值，便于本地按需调试 cron。
 * 参数：无
 * 影响范围：server.ts 启动流程
 * 潜在风险：cron handler 异常不应影响主服务，已用 try/catch 隔离；若需本地调试 cron，必须显式设置 `CRON_ENABLED=true` 或通过脚本 `--allow-cron` 开启。
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
  const cronEnabledEnv = process.env.CRON_ENABLED;
  const enabled =
    cronEnabledEnv === undefined
      ? process.env.NODE_ENV === 'production'
      : cronEnabledEnv === 'true';
  if (!enabled) {
    log.info(
      {
        cronEnabledEnv: cronEnabledEnv ?? '(unset)',
        env: process.env.NODE_ENV ?? '(unset)',
      },
      'Cron jobs disabled by environment policy',
    );
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
