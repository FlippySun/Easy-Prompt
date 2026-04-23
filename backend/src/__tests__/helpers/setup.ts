/**
 * 集成测试辅助 — 数据库清理 + App 实例创建
 * 2026-04-07 新增 — 集成测试基础设施
 * 设计思路：每个测试文件前清理相关表数据，确保测试独立性
 *   使用真实的 VPS PostgreSQL 和 Redis（通过 SSH tunnel）
 * 影响范围：仅测试环境
 * 潜在风险：2026-04-16/2026-04-22 事故复盘确认“共享生产库 + backend tests”本身就是危险组合；现已改为 shared/prod DB 永久拒绝 backend tests，防止再次清空共享数据。
 */

import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { createApp } from '../../app';
import {
  TEST_DATABASE_REQUIREMENT_HINT,
  assertSharedDbDestructiveTestMutationAllowed,
  assertSharedDbTestExecutionAllowed,
} from '../../utils/dbSafety';
import type { Express } from 'express';

/**
 * 2026-04-16 更新 — Backend integration test shared-DB guard
 * 2026-04-22 更新 — 共享生产库事故后的永久止血
 * 变更类型：修复/安全/测试/运维
 * 功能描述：在保留“本地可直连正常数据库”工作流的前提下，把 backend Vitest 与 destructive test cleanup 永久限制到 dedicated test DB，彻底取消 shared/prod DB 的人工解锁路径。
 * 设计思路：
 *   1. 根因不是“误敲命令”，而是 shared/prod DB 上仍存在可被手工绕过的测试入口，因此这里直接 fail closed。
 *   2. createTestApp、cleanupTestData、cleanupRedis 都复用同一条 dedicated test DB 断言，避免 helper 口径漂移。
 *   3. 通过统一 hint 明确告诉操作者需要把 DATABASE_URL 指到显式 `*_test` / `*_ci` / `*_spec` 库。
 * 参数与返回值：assertSharedDb* 接收当前危险操作名称；安全时无返回，不安全时抛出 Error。
 * 影响范围：backend/src/__tests__/helpers/setup.ts、所有依赖该 helper 的 integration tests、shared-DB 下的 backend Vitest 执行口径。
 * 潜在风险：若历史测试流程仍默认连接 shared/prod DB，会立即失败；这是预期安全门。
 */
const TEST_DB_REQUIREMENT_HINT = TEST_DATABASE_REQUIREMENT_HINT;

/**
 * 清理测试数据（仅删除测试中创建的行，不 DROP 表）
 * 按外键依赖顺序删除的
 */
export async function cleanupTestData() {
  assertSharedDbDestructiveTestMutationAllowed(
    `cleanup integration test data (${TEST_DB_REQUIREMENT_HINT})`,
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
    `cleanup integration test Redis keys (${TEST_DB_REQUIREMENT_HINT})`,
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
  assertSharedDbTestExecutionAllowed(`create integration test app (${TEST_DB_REQUIREMENT_HINT})`);
  return createApp();
}

/**
 * 全局清理（测试结束后断开连接）
 */
export async function globalTeardown() {
  await prisma.$disconnect();
  redis.disconnect();
}
