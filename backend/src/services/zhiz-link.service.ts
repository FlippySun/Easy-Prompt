/**
 * Zhiz 绑定状态服务
 * 2026-04-22 新增
 * 变更类型：新增/服务
 * 功能描述：为已登录用户返回当前 Zhiz 绑定状态与可展示的最小资料快照。
 * 设计思路：
 *   1. 只查询当前用户自己的 zhiz OAuthAccount，避免把 route 层耦合到 Prisma 细节。
 *   2. 对外只暴露 provider/linked/profile 这些稳定字段，避免不同客户端各自消费额外字段后再次产生契约分叉。
 *   3. 未绑定时返回空 profile 快照，让 Web / Browser / Web-Hub 都能在不做 null 分支猜测的前提下统一消费。
 * 参数与返回值：`getZhizLinkStatus(userId)` 接收当前用户 ID，返回 `{ provider, linked, profile }`。
 * 影响范围：`GET /api/v1/auth/oauth/zhiz/link-status`、skills-manager 等需要判断 Zhiz 是否已绑定的入口。
 * 潜在风险：若历史数据里同一用户存在多条 zhiz 记录，当前实现按 `updatedAt desc` 返回最新一条；这是最小兼容策略。
 */

import { prisma } from '../lib/prisma';

export interface ZhizLinkStatusResult {
  provider: 'zhiz';
  linked: boolean;
  profile: {
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export async function getZhizLinkStatus(userId: string): Promise<ZhizLinkStatusResult> {
  const linkedAccount = await prisma.oAuthAccount.findFirst({
    where: {
      userId,
      provider: 'zhiz',
    },
    orderBy: {
      updatedAt: 'desc',
    },
    select: {
      displayName: true,
      avatarUrl: true,
    },
  });

  return {
    provider: 'zhiz',
    linked: Boolean(linkedAccount),
    profile: {
      displayName: linkedAccount?.displayName ?? null,
      avatarUrl: linkedAccount?.avatarUrl ?? null,
    },
  };
}
