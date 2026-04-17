/**
 * Shared DB 安全辅助
 * 2026-04-16 新增 — Batch B shared DB hardening
 * 变更类型：新增/安全/运维/测试
 * 功能描述：统一识别当前 DATABASE_URL 是否指向受保护数据库，并为 Vitest / 集成测试 helper 提供显式解锁常量与 fail-fast 断言。
 * 设计思路：
 *   1. 保留“本地可直连正常数据库”的工作流，不把 shared/prod DB 连接本身视为非法。
 *   2. 仅对高风险入口（Vitest、测试清理）增加显式 unlock，避免误跑测试再次批量清表。
 *   3. 判断策略保持保守：凡不是显式 `*_test` / `*_ci` / `*_spec` 的库，都视为受保护数据库，宁可多拦一次也不放过 destructive 入口。
 * 参数与返回值：parseDatabaseName/getDatabaseTargetInfo 返回规范化数据库目标信息；assertSharedDb* 在危险场景抛出 Error。
 * 影响范围：backend Vitest setup、集成测试 helper、shared-DB 风险提示口径。
 * 潜在风险：若确需在 shared/prod DB 上跑后端测试，必须显式设置 unlock 环境变量；这是预期安全门。
 */

export const SHARED_DB_TEST_UNLOCK_ENV = 'ALLOW_SHARED_DB_TESTS';
export const SHARED_DB_TEST_UNLOCK_VALUE = 'I_ACK_SHARED_DB_TEST_MUTATIONS';

const EXPLICIT_TEST_DB_PATTERN = /(^|[_-])(test|ci|spec)([_-]|$)/i;

export interface DatabaseTargetInfo {
  databaseUrl: string;
  databaseName: string;
  isExplicitTestDb: boolean;
  isProtectedDb: boolean;
}

export function parseDatabaseName(databaseUrl: string): string {
  if (!databaseUrl) {
    return '';
  }

  try {
    return new URL(databaseUrl).pathname.replace(/^\/+/, '').trim();
  } catch {
    const withoutQuery = databaseUrl.split('?')[0] || '';
    const segments = withoutQuery.split('/').filter(Boolean);
    return segments[segments.length - 1] || '';
  }
}

export function isExplicitTestDatabaseName(databaseName: string): boolean {
  return EXPLICIT_TEST_DB_PATTERN.test(databaseName);
}

export function isProtectedDatabaseName(databaseName: string): boolean {
  if (!databaseName) {
    return false;
  }

  return !isExplicitTestDatabaseName(databaseName);
}

export function getDatabaseTargetInfo(
  databaseUrl = process.env.DATABASE_URL || '',
): DatabaseTargetInfo {
  const databaseName = parseDatabaseName(databaseUrl);
  const isExplicitTestDb = isExplicitTestDatabaseName(databaseName);

  return {
    databaseUrl,
    databaseName,
    isExplicitTestDb,
    isProtectedDb: isProtectedDatabaseName(databaseName),
  };
}

export function hasSharedDbTestUnlock(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[SHARED_DB_TEST_UNLOCK_ENV] === SHARED_DB_TEST_UNLOCK_VALUE;
}

export function assertSharedDbTestExecutionAllowed(
  operation: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const target = getDatabaseTargetInfo(env.DATABASE_URL || '');

  if (!target.databaseUrl || !target.databaseName) {
    throw new Error(
      `[TEST_DB_GUARD] Refusing to ${operation}: DATABASE_URL is missing or unreadable. Configure DATABASE_URL explicitly before running backend Vitest.`,
    );
  }

  if (!target.isProtectedDb) {
    return;
  }

  if (hasSharedDbTestUnlock(env)) {
    return;
  }

  throw new Error(
    `[TEST_DB_GUARD] Refusing to ${operation} against protected database "${target.databaseName}". This repo now keeps shared/prod DB backend tests locked by default. Export ${SHARED_DB_TEST_UNLOCK_ENV}=${SHARED_DB_TEST_UNLOCK_VALUE} only for a deliberate run.`,
  );
}

export function assertSharedDbDestructiveTestMutationAllowed(
  operation: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  assertSharedDbTestExecutionAllowed(operation, env);
}
