/**
 * 集成测试辅助 — 数据库清理 + App 实例创建
 * 2026-04-07 新增 — 集成测试基础设施
 * 设计思路：每个测试文件前清理相关表数据，确保测试独立性
 *   使用真实的 VPS PostgreSQL 和 Redis（通过 SSH tunnel）
 * 影响范围：仅测试环境
 * 潜在风险：误清生产数据（已通过表级 deleteMany 限制范围）
 */

import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { createApp } from '../../app';
import type { Express } from 'express';

/**
 * 清理测试数据（仅删除测试中创建的行，不 DROP 表）
 * 按外键依赖顺序删除
 */
export async function cleanupTestData() {
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
  return createApp();
}

/**
 * 全局清理（测试结束后断开连接）
 */
export async function globalTeardown() {
  await prisma.$disconnect();
  redis.disconnect();
}
