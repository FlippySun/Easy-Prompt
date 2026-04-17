/**
 * 集成测试辅助 — 数据库清理 + App 实例创建
 * 2026-04-07 新增 — 集成测试基础设施
 * 设计思路：每个测试文件前清理相关表数据，确保测试独立性
 *   使用真实的 VPS PostgreSQL 和 Redis（通过 SSH tunnel）
 * 影响范围：仅测试环境
 * 潜在风险：2026-04-16 事故复盘确认“表级 deleteMany 限制范围”并不能避免误清共享库；现已改为 shared-DB 测试默认锁定 + 显式 unlock 机制，防止误跑 backend tests 再次清空共享数据。
 */

import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { createApp } from '../../app';
import {
  SHARED_DB_TEST_UNLOCK_ENV,
  SHARED_DB_TEST_UNLOCK_VALUE,
  assertSharedDbDestructiveTestMutationAllowed,
  assertSharedDbTestExecutionAllowed,
} from '../../utils/dbSafety';
import type { Express } from 'express';

/**
 * 2026-04-16 更新 — Backend integration test shared-DB guard
 * 变更类型：修复/安全/测试/运维
 * 功能描述：在保留“本地可直连正常数据库”工作流的前提下，把 backend Vitest 与 destructive test cleanup 默认锁死，只有显式设置共享库测试 unlock 后才允许继续。
 * 设计思路：
 *   1. 不再把“是否 test 库”作为唯一判定，而是把 shared/prod DB backend tests 视为高风险动作并默认拒绝。
 *   2. createTestApp 只要求“显式允许 backend tests”，cleanup/Redis 清理则进一步要求“显式允许 destructive test mutation”。
 *   3. unlock 口令统一复用 `ALLOW_SHARED_DB_TESTS=I_ACK_SHARED_DB_TEST_MUTATIONS`，避免 helper、Vitest setup、shell runner 各自发明不同开关。
 * 参数与返回值：assertSharedDb* 接收当前危险操作名称；安全时无返回，不安全时抛出 Error。
 * 影响范围：backend/src/__tests__/helpers/setup.ts、所有依赖该 helper 的 integration tests、shared-DB 下的 backend Vitest 执行口径。
 * 潜在风险：若确需在 shared/prod DB 上执行 backend tests，必须显式设置环境变量 `ALLOW_SHARED_DB_TESTS=I_ACK_SHARED_DB_TEST_MUTATIONS`；这是预期安全门。
 */
const SHARED_DB_TEST_UNLOCK_HINT = `${SHARED_DB_TEST_UNLOCK_ENV}=${SHARED_DB_TEST_UNLOCK_VALUE}`;

/**
 * 清理测试数据（仅删除测试中创建的行，不 DROP 表）
 * 按外键依赖顺序删除的
 */
export async function cleanupTestData() {
  assertSharedDbDestructiveTestMutationAllowed(
    `cleanup integration test data (requires ${SHARED_DB_TEST_UNLOCK_HINT})`,
  );
  await prisma.aiRequestLog.deleteMany({});
  await prisma.rateViolation.deleteMany({});
  await prisma.blacklistRule.deleteMany({});
  // 2026-04-09 新增 — P6.01 / P6.03：清理历史同步 + OAuth 关联数据
  await prisma.enhanceHistory.deleteMany({});
  await prisma.oAuthAccount.deleteMany({});
  await prisma.userLike.deleteMany({});
  await prisma.userSave.deleteMany({});
  await prisma.userCopy.deleteMany({});
  await prisma.userView.deleteMany({});
  await prisma.userCollectionSave.deleteMany({});
  await prisma.collectionPrompt.deleteMany({});
  await prisma.collection.deleteMany({});
  await prisma.prompt.deleteMany({});
  await prisma.userAchievement.deleteMany({});
  await prisma.achievement.deleteMany({});
  await prisma.userVisitedCategory.deleteMany({});
  await prisma.aiProvider.deleteMany({});
  await prisma.dailyStat.deleteMany({});
  await prisma.user.deleteMany({});
}

/**
 * 清理 Redis 测试 key（按前缀）
 */
export async function cleanupRedis() {
  assertSharedDbDestructiveTestMutationAllowed(
    `cleanup integration test Redis keys (requires ${SHARED_DB_TEST_UNLOCK_HINT})`,
  );
  const patterns = [
    'sso:code:*',
    'oauth:state:*',
    'oauth:zhiz:ticket:*',
    'oauth:zhiz:replay:*',
    'oauth:zhiz:email-verify:*',
    'bl:*',
    'rl:*',
  ];
  for (const pattern of patterns) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

/**
 * 创建测试用 Express app 实例
 */
export function createTestApp(): Express {
  assertSharedDbTestExecutionAllowed(
    `create integration test app (requires ${SHARED_DB_TEST_UNLOCK_HINT})`,
  );
  return createApp();
}

/**
 * 全局清理（测试结束后断开连接）
 */
export async function globalTeardown() {
  await prisma.$disconnect();
  redis.disconnect();
}
