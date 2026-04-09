/**
 * 测试数据工厂 — 快速创建测试用 User/Prompt/Collection/Achievement
 * 2026-04-08 新增 — P3.14 Test Data Factory
 * 设计思路：提供带默认值的工厂函数，每次调用生成唯一数据
 *   支持 override 覆盖默认字段
 *   所有工厂函数直接操作 Prisma，需要在测试 beforeEach/afterEach 中清理
 * 参数：各工厂函数接受可选 override 对象
 * 返回：Prisma 创建的完整记录
 * 影响范围：仅用于测试环境
 * 潜在风险：无已知风险
 */

import { prisma } from '../../lib/prisma';
import { hashPassword } from '../../utils/password';

// ── 递增计数器（保证唯一性）──────────────────────────
let counter = 0;
function nextId() {
  return ++counter;
}

/**
 * 重置计数器（每个测试套件开始时调用）
 */
export function resetFactoryCounter() {
  counter = 0;
}

// ── User 工厂 ─────────────────────────────────────────

export interface CreateUserOverrides {
  username?: string;
  email?: string;
  password?: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  role?: string;
}

/**
 * 创建测试用户
 * @param overrides - 覆盖默认字段
 * @returns Prisma User 记录
 */
export async function createTestUser(overrides: CreateUserOverrides = {}) {
  const n = nextId();
  const passwordHash = await hashPassword(overrides.password ?? 'Test1234!');

  return prisma.user.create({
    data: {
      username: overrides.username ?? `testuser${n}`,
      email: overrides.email ?? `testuser${n}@test.local`,
      passwordHash,
      displayName: overrides.displayName ?? `Test User ${n}`,
      bio: overrides.bio ?? null,
      avatarUrl: overrides.avatarUrl ?? null,
      role: overrides.role ?? 'user',
    },
  });
}

/**
 * 创建测试管理员
 * @param overrides - 覆盖默认字段
 * @returns Prisma User 记录（role='admin'）
 */
export async function createTestAdmin(overrides: CreateUserOverrides = {}) {
  return createTestUser({ role: 'admin', ...overrides });
}

// ── Prompt 工厂 ───────────────────────────────────────

export interface CreatePromptOverrides {
  title?: string;
  description?: string;
  content?: string;
  tags?: string[];
  category?: string;
  model?: string;
  status?: string;
  authorId?: string;
}

/**
 * 创建测试 Prompt
 * @param authorId - 作者 ID（必须已存在）
 * @param overrides - 覆盖默认字段
 * @returns Prisma Prompt 记录
 */
export async function createTestPrompt(authorId: string, overrides: CreatePromptOverrides = {}) {
  const n = nextId();

  return prisma.prompt.create({
    data: {
      title: overrides.title ?? `Test Prompt ${n}`,
      description: overrides.description ?? `Description for test prompt ${n}`,
      content: overrides.content ?? `This is the content of test prompt ${n}. Use it wisely.`,
      tags: overrides.tags ?? ['test', 'factory'],
      category: overrides.category ?? 'general',
      model: overrides.model ?? 'gpt-4',
      status: overrides.status ?? 'published',
      authorId,
    },
  });
}

/**
 * 批量创建测试 Prompt
 * @param authorId - 作者 ID
 * @param count - 数量
 * @param overrides - 覆盖默认字段（应用到每个 Prompt）
 * @returns Prisma Prompt 记录数组
 */
export async function createTestPrompts(
  authorId: string,
  count: number,
  overrides: CreatePromptOverrides = {},
) {
  const prompts = [];
  for (let i = 0; i < count; i++) {
    prompts.push(await createTestPrompt(authorId, overrides));
  }
  return prompts;
}

// ── Collection 工厂 ───────────────────────────────────

export interface CreateCollectionOverrides {
  title?: string;
  description?: string;
  icon?: string;
  gradientFrom?: string;
  gradientTo?: string;
  tags?: string[];
  difficulty?: string;
  estimatedTime?: string;
  createdBy?: string;
}

/**
 * 创建测试 Collection
 * @param overrides - 覆盖默认字段
 * @returns Prisma Collection 记录
 */
export async function createTestCollection(overrides: CreateCollectionOverrides = {}) {
  const n = nextId();

  return prisma.collection.create({
    data: {
      title: overrides.title ?? `Test Collection ${n}`,
      description: overrides.description ?? `Description for collection ${n}`,
      icon: overrides.icon ?? '📚',
      gradientFrom: overrides.gradientFrom ?? '#6366f1',
      gradientTo: overrides.gradientTo ?? '#a855f7',
      tags: overrides.tags ?? ['test'],
      difficulty: overrides.difficulty ?? 'beginner',
      estimatedTime: overrides.estimatedTime ?? '5 min',
      createdBy: overrides.createdBy ?? null,
    },
  });
}

/**
 * 创建 Collection 并关联 Prompt
 * @param promptIds - 要关联的 Prompt ID 列表
 * @param overrides - Collection 覆盖默认字段
 * @returns Prisma Collection 记录
 */
export async function createTestCollectionWithPrompts(
  promptIds: string[],
  overrides: CreateCollectionOverrides = {},
) {
  const collection = await createTestCollection(overrides);

  if (promptIds.length > 0) {
    await prisma.collectionPrompt.createMany({
      data: promptIds.map((promptId, index) => ({
        collectionId: collection.id,
        promptId,
        position: index,
      })),
    });
  }

  return collection;
}

// ── Achievement 工厂 ──────────────────────────────────

export interface CreateAchievementOverrides {
  id?: string;
  title?: string;
  description?: string;
  icon?: string;
  color?: string;
  rarity?: string;
  category?: string;
  conditionType?: string | null;
  conditionValue?: number | null;
}

/**
 * 创建测试成就
 * @param overrides - 覆盖默认字段
 * @returns Prisma Achievement 记录
 */
export async function createTestAchievement(overrides: CreateAchievementOverrides = {}) {
  const n = nextId();

  return prisma.achievement.create({
    data: {
      id: overrides.id ?? `test_achievement_${n}`,
      title: overrides.title ?? `Test Achievement ${n}`,
      description: overrides.description ?? `Unlock by completing action ${n}`,
      icon: overrides.icon ?? '🏆',
      color: overrides.color ?? '#fbbf24',
      rarity: overrides.rarity ?? 'common',
      category: overrides.category ?? 'general',
      conditionType:
        overrides.conditionType !== undefined ? overrides.conditionType : 'prompts_created',
      conditionValue: overrides.conditionValue !== undefined ? overrides.conditionValue : 1,
    },
  });
}

// ── 交互工厂（Like/Save/Copy/View）──────────────────

/**
 * 创建点赞关系
 * @param userId - 用户 ID
 * @param promptId - Prompt ID
 */
export async function createTestLike(userId: string, promptId: string) {
  await prisma.$transaction([
    prisma.userLike.create({ data: { userId, promptId } }),
    prisma.prompt.update({ where: { id: promptId }, data: { likesCount: { increment: 1 } } }),
  ]);
}

/**
 * 创建收藏关系
 * @param userId - 用户 ID
 * @param promptId - Prompt ID
 */
export async function createTestSave(userId: string, promptId: string) {
  await prisma.userSave.create({ data: { userId, promptId } });
}

/**
 * 创建 Collection 收藏关系
 * @param userId - 用户 ID
 * @param collectionId - Collection ID
 */
export async function createTestCollectionSave(userId: string, collectionId: string) {
  await prisma.$transaction([
    prisma.userCollectionSave.create({ data: { userId, collectionId } }),
    prisma.collection.update({
      where: { id: collectionId },
      data: { savedCount: { increment: 1 } },
    }),
  ]);
}

/**
 * 解锁成就
 * @param userId - 用户 ID
 * @param achievementId - Achievement ID
 */
export async function createTestAchievementUnlock(userId: string, achievementId: string) {
  await prisma.userAchievement.create({ data: { userId, achievementId } });
}
