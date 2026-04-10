/**
 * 黑名单服务 — 封禁规则 CRUD + 检查
 * 2026-04-07 新增 — P1.19
 * 设计思路：DB 持久化 + Redis 缓存热规则，中间件每次请求查 Redis 快速判断
 *   过期规则由定时任务清理，Redis 缓存 TTL 与规则 expiresAt 对齐
 * 影响范围：blacklist 中间件、管理员 API
 * 潜在风险：Redis 不可用时降级为 DB 查询（性能下降但功能保全）
 */

import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { createChildLogger } from '../utils/logger';
import type { BlacklistCheckResult, BlacklistRule } from '../types/blacklist';

const log = createChildLogger('blacklist');

// Redis key 前缀
const CACHE_PREFIX = 'bl:';

/**
 * 构建 Redis 缓存 key
 * 格式：bl:ip:1.2.3.4 / bl:user:uuid / bl:fingerprint:hash
 */
function cacheKey(type: string, value: string): string {
  return `${CACHE_PREFIX}${type}:${value}`;
}

// ── 检查 ──────────────────────────────────────────────

/**
 * 检查某维度是否被封禁
 * 优先查 Redis 缓存，miss 时查 DB 并回填缓存
 * @returns { blocked, rule?, retryAfter? }
 */
export async function checkBlacklist(type: string, value: string): Promise<BlacklistCheckResult> {
  if (!value) return { blocked: false };

  const key = cacheKey(type, value);

  // 1. 查 Redis 缓存
  try {
    const cached = await redis.get(key);
    if (cached === 'blocked') {
      // 命中缓存 — 被封禁
      const ttl = await redis.ttl(key);
      await incrementHitCount(type, value);
      return {
        blocked: true,
        retryAfter: ttl > 0 ? ttl : undefined,
      };
    }
    if (cached === 'clean') {
      // 命中缓存 — 未封禁
      return { blocked: false };
    }
  } catch (err) {
    log.warn({ err }, 'Redis blacklist cache read failed, falling back to DB');
  }

  // 2. 查 DB
  const rule = await prisma.blacklistRule.findFirst({
    where: {
      type,
      value,
      isActive: true,
      OR: [
        { expiresAt: null }, // 永久封禁
        { expiresAt: { gt: new Date() } }, // 未过期
      ],
    },
  });

  if (rule) {
    // 写入 Redis 缓存
    try {
      if (rule.expiresAt) {
        const ttlSec = Math.max(1, Math.floor((rule.expiresAt.getTime() - Date.now()) / 1000));
        await redis.set(key, 'blocked', 'EX', ttlSec);
      } else {
        // 永久封禁 — 缓存 24h，定时刷新
        await redis.set(key, 'blocked', 'EX', 86400);
      }
    } catch (err) {
      log.warn({ err }, 'Redis blacklist cache write failed');
    }

    await incrementHitCount(type, value);

    const retryAfter = rule.expiresAt
      ? Math.max(1, Math.floor((rule.expiresAt.getTime() - Date.now()) / 1000))
      : undefined;

    return { blocked: true, rule: rule as unknown as BlacklistRule, retryAfter };
  }

  // 未封禁 — 缓存 clean 状态 60 秒（避免频繁查 DB）
  try {
    await redis.set(key, 'clean', 'EX', 60);
  } catch {
    // 忽略缓存写入失败
  }

  return { blocked: false };
}

/**
 * 批量检查多维度（IP + user + fingerprint）
 * 任一命中即返回 blocked
 */
export async function checkMultiDimension(
  ip?: string,
  userId?: string,
  fingerprint?: string,
): Promise<BlacklistCheckResult> {
  const checks: Promise<BlacklistCheckResult>[] = [];

  if (ip) checks.push(checkBlacklist('ip', ip));
  if (userId) checks.push(checkBlacklist('user', userId));
  if (fingerprint) checks.push(checkBlacklist('fingerprint', fingerprint));

  const results = await Promise.all(checks);
  const blockedResult = results.find((r) => r.blocked);

  return blockedResult ?? { blocked: false };
}

// ── 管理 CRUD ──────────────────────────────────────────

export interface CreateRuleInput {
  type: string;
  value: string;
  reason: string;
  severity?: string;
  expiresAt?: Date | null;
  blockedBy?: string;
  source?: string;
  violationLevel?: number;
}

/**
 * 创建封禁规则
 * 如果同维度已存在规则则更新
 */
export async function createOrUpdateRule(input: CreateRuleInput) {
  const existing = await prisma.blacklistRule.findUnique({
    where: { type_value: { type: input.type, value: input.value } },
  });

  if (existing) {
    const rule = await prisma.blacklistRule.update({
      where: { id: existing.id },
      data: {
        reason: input.reason,
        severity: input.severity ?? existing.severity,
        expiresAt: input.expiresAt !== undefined ? input.expiresAt : existing.expiresAt,
        blockedBy: input.blockedBy ?? existing.blockedBy,
        source: input.source ?? existing.source,
        violationLevel: input.violationLevel ?? existing.violationLevel,
        isActive: true,
      },
    });

    // 清除 Redis 缓存
    await invalidateCache(input.type, input.value);
    log.info({ ruleId: rule.id, type: rule.type, value: rule.value }, 'Blacklist rule updated');
    return rule;
  }

  const rule = await prisma.blacklistRule.create({
    data: {
      type: input.type,
      value: input.value,
      reason: input.reason,
      severity: input.severity ?? 'block',
      expiresAt: input.expiresAt ?? null,
      blockedBy: input.blockedBy ?? null,
      source: input.source ?? 'admin',
      violationLevel: input.violationLevel ?? 0,
    },
  });

  await invalidateCache(input.type, input.value);
  log.info({ ruleId: rule.id, type: rule.type, value: rule.value }, 'Blacklist rule created');
  return rule;
}

/**
 * 停用（软删除）封禁规则
 */
export async function deactivateRule(ruleId: string) {
  const rule = await prisma.blacklistRule.update({
    where: { id: ruleId },
    data: { isActive: false },
  });

  await invalidateCache(rule.type, rule.value);
  log.info({ ruleId: rule.id }, 'Blacklist rule deactivated');
  return rule;
}

/**
 * 列出封禁规则（分页）
 */
export async function listRules(opts: {
  page?: number;
  limit?: number;
  type?: string;
  isActive?: boolean;
}) {
  const page = opts.page ?? 1;
  const limit = Math.min(opts.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (opts.type) where.type = opts.type;
  if (opts.isActive !== undefined) where.isActive = opts.isActive;

  const [rules, total] = await Promise.all([
    prisma.blacklistRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.blacklistRule.count({ where }),
  ]);

  return {
    data: rules,
    meta: { total, page, pageSize: limit, totalPages: Math.ceil(total / limit) },
  };
}

// ── 内部工具 ──────────────────────────────────────────

async function incrementHitCount(type: string, value: string) {
  try {
    await prisma.blacklistRule.updateMany({
      where: { type, value, isActive: true },
      data: { hitCount: { increment: 1 }, lastHitAt: new Date() },
    });
  } catch (err) {
    log.warn({ err, type, value }, 'Failed to increment hit count');
  }
}

async function invalidateCache(type: string, value: string) {
  try {
    await redis.del(cacheKey(type, value));
  } catch (err) {
    log.warn({ err }, 'Failed to invalidate blacklist cache');
  }
}
