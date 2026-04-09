/**
 * 精选 Prompt 刷新定时任务
 * 2026-04-08 新增 — P2.08 Gap C 补齐
 * 2026-04-08 修改 — P4.03 接入 featured.service.ts 实际算法
 * 变更类型：修改（从 stub 升级为实际实现）
 * 设计思路：每日凌晨 4:00 执行，调用 featured.service.refreshFeatured()
 *   算法基于最近 7 天 likesCount top 10% + 类别多样性约束
 *   结果存入 Redis Set，供 trending dailyPicks 和列表查询使用
 * 参数：无
 * 影响范围：Redis featured:prompt_ids 集合
 * 潜在风险：Redis 不可用时降级为空操作（不阻塞 cron 执行）
 */

import { createChildLogger } from '../utils/logger';
import { refreshFeatured } from '../services/featured.service';

const log = createChildLogger('cron:featuredRefresh');

export const featuredRefreshJob = {
  name: 'featured-refresh',
  /** 每日凌晨 4:00 执行 */
  schedule: '0 4 * * *',
  handler: refreshFeaturedPrompts,
};

async function refreshFeaturedPrompts(): Promise<void> {
  const result = await refreshFeatured();
  log.info({ added: result.added, total: result.total }, 'Featured prompt refresh completed');
}
