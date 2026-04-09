/**
 * 管理员操作审计日志
 * 2026-04-08 新增 — P2.02
 * 2026-04-08 修复 — Gap A：改用独立 pino 实例 + audit 通道 pino-roll transport
 * 变更类型：修复
 * 设计思路：记录所有管理员敏感操作（Provider CRUD、黑名单 CRUD、
 *   Prompt 审核、用户角色修改），输出到独立日志文件 audit.log（§8B.4）。
 *   生产环境通过 createChannelLogger 创建独立 pino 实例，
 *   输出到 logs/audit.log（pino-roll 每日轮转，保留 90 天）+ stdout。
 *   开发环境保持 pino-pretty 输出。
 *   字段：adminId, action, targetType, targetId, changes(before/after), ip, timestamp
 * 影响范围：admin 路由（providers, blacklist, 未来的 prompts/users 管理）
 * 潜在风险：无已知风险
 */

import { createChannelLogger } from '../config/logRotation';

const auditLog = createChannelLogger('audit', 'audit');

// ── 审计动作枚举 ──────────────────────────────────────
export type AuditAction =
  | 'provider.create'
  | 'provider.update'
  | 'provider.delete'
  | 'blacklist.create'
  | 'blacklist.update'
  | 'blacklist.delete'
  | 'blacklist.deactivate'
  | 'prompt.approve'
  | 'prompt.reject'
  | 'user.role_change'
  | 'user.ban'
  | 'user.unban';

// ── 目标类型枚举 ──────────────────────────────────────
export type AuditTargetType = 'provider' | 'blacklist_rule' | 'prompt' | 'user';

export interface AuditEntry {
  /** 执行操作的管理员 ID */
  adminId: string;
  /** 操作动作 */
  action: AuditAction;
  /** 目标实体类型 */
  targetType: AuditTargetType;
  /** 目标实体 ID */
  targetId: string;
  /** 变更详情：before/after 对比（可选） */
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  /** 管理员操作时的 IP 地址 */
  ip?: string;
  /** 补充说明 */
  note?: string;
}

/**
 * 记录管理员审计日志
 * 始终使用 info 级别（审计日志不区分 warn/error，所有操作都需要记录）
 */
export function logAudit(entry: AuditEntry): void {
  auditLog.info(
    {
      adminId: entry.adminId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      changes: entry.changes,
      ip: entry.ip,
      note: entry.note,
      timestamp: new Date().toISOString(),
    },
    `AUDIT: ${entry.action} on ${entry.targetType}/${entry.targetId}`,
  );
}
