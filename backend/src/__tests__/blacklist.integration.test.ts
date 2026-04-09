/**
 * Blacklist 集成测试 — 封禁规则 CRUD + 中间件拦截
 * 2026-04-07 新增 — 集成测试
 * 设计思路：测试黑名单服务的创建/检查/停用流程，
 *   以及中间件对被封禁请求的拦截行为
 * 影响范围：仅测试环境
 * 潜在风险：无已知风险
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cleanupTestData, cleanupRedis, globalTeardown } from './helpers/setup';
import {
  checkBlacklist,
  checkMultiDimension,
  createOrUpdateRule,
  deactivateRule,
  listRules,
} from '../services/blacklist.service';

beforeAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
});

afterAll(async () => {
  await cleanupTestData();
  await cleanupRedis();
  await globalTeardown();
});

describe('blacklist service', () => {
  let ipRuleId: string;

  it('should return not blocked for clean IP', async () => {
    const result = await checkBlacklist('ip', '192.168.1.100');
    expect(result.blocked).toBe(false);
  });

  it('should create a blocking IP rule', async () => {
    const rule = await createOrUpdateRule({
      type: 'ip',
      value: '10.0.0.1',
      reason: 'Integration test block',
      severity: 'block',
      source: 'admin',
    });

    expect(rule.id).toBeTruthy();
    expect(rule.type).toBe('ip');
    expect(rule.value).toBe('10.0.0.1');
    expect(rule.isActive).toBe(true);
    ipRuleId = rule.id;
  });

  it('should detect blocked IP', async () => {
    const result = await checkBlacklist('ip', '10.0.0.1');
    expect(result.blocked).toBe(true);
  });

  it('should create a temporary fingerprint rule with expiry', async () => {
    const futureDate = new Date(Date.now() + 3600 * 1000); // 1 小时后过期
    const rule = await createOrUpdateRule({
      type: 'fingerprint',
      value: 'test-fp-001',
      reason: 'Temp block for test',
      expiresAt: futureDate,
    });

    expect(rule.isActive).toBe(true);
    expect(rule.expiresAt).toBeTruthy();

    const result = await checkBlacklist('fingerprint', 'test-fp-001');
    expect(result.blocked).toBe(true);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('checkMultiDimension should detect any blocked dimension (IP)', async () => {
    // 清除缓存确保读取最新 DB
    await cleanupRedis();
    const result = await checkMultiDimension('10.0.0.1', undefined, undefined);
    expect(result.blocked).toBe(true);
  });

  it('checkMultiDimension should detect any blocked dimension (fingerprint)', async () => {
    // 清除缓存确保读取最新 DB
    await cleanupRedis();
    const result = await checkMultiDimension('192.168.1.200', undefined, 'test-fp-001');
    expect(result.blocked).toBe(true);
  });

  it('checkMultiDimension should pass for clean dimensions', async () => {
    const result = await checkMultiDimension('192.168.1.200', 'clean-user-id', 'clean-fp');
    expect(result.blocked).toBe(false);
  });

  it('should update existing rule (upsert)', async () => {
    const updated = await createOrUpdateRule({
      type: 'ip',
      value: '10.0.0.1',
      reason: 'Updated reason',
      severity: 'warn',
    });

    expect(updated.reason).toBe('Updated reason');
    expect(updated.severity).toBe('warn');
  });

  it('should list rules with pagination', async () => {
    const result = await listRules({ page: 1, limit: 10 });
    // 至少应该有我们创建的 2 条规则（IP + fingerprint）
    expect(result.data.length).toBeGreaterThanOrEqual(2);
    expect(result.meta.total).toBeGreaterThanOrEqual(2);
    expect(result.meta.page).toBe(1);
  });

  it('should list rules filtered by type', async () => {
    const result = await listRules({ type: 'ip' });
    expect(result.data.every((r) => r.type === 'ip')).toBe(true);
  });

  it('should deactivate IP rule', async () => {
    if (!ipRuleId) throw new Error('ipRuleId not set');
    const deactivated = await deactivateRule(ipRuleId);
    expect(deactivated.isActive).toBe(false);

    // 清除 Redis 缓存后再查
    await cleanupRedis();
    const result = await checkBlacklist('ip', '10.0.0.1');
    expect(result.blocked).toBe(false);
  });
});
