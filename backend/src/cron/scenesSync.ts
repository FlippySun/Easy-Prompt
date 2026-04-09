/**
 * 核心场景数据同步任务
 * 2026-04-08 新增 — P2.07 Gap D 补齐
 * 变更类型：新增
 * 设计思路：每日凌晨 1:00 执行，将 core/scenes.js 的场景数据同步到 DB。
 *   scenes.service.ts 的 syncCoreToDB() 使用 upsert 保证幂等，
 *   即使重复执行也不会产生重复数据。
 *   此任务确保 DB 中的 scenes 表始终与 core 场景语料库保持一致，
 *   适用于场景数据更新后自动同步到后端数据库的场景。
 * 参数：无
 * 影响范围：scenes 表
 * 潜在风险：DB 不可用时任务失败（由 cron/index.ts 的 try-catch 捕获）
 */

import { syncCoreToDB } from '../services/scenes.service';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('cron:scenesSync');

export const scenesSyncJob = {
  name: 'scenes-sync',
  /** 每日凌晨 1:00 执行（在 dailyStats 之前，确保场景数据最新） */
  schedule: '0 1 * * *',
  handler: syncScenes,
};

async function syncScenes(): Promise<void> {
  const synced = await syncCoreToDB();
  log.info({ synced }, 'Core scenes synced to DB');
}
