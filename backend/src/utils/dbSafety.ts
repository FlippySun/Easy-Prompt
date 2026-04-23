/**
 * Shared DB 安全辅助
 * 2026-04-16 新增 — Batch B shared DB hardening
 * 2026-04-22 更新 — 共享生产库事故后的永久止血
 * 变更类型：修复/安全/运维/测试
 * 功能描述：统一识别当前 DATABASE_URL 是否指向受保护数据库，并把 backend Vitest / 集成测试 helper 永久限制在显式 test/ci/spec 库上运行。
 * 设计思路：
 *   1. 保留“本地可直连正常数据库”的工作流，不把 shared/prod DB 连接本身视为非法。
 *   2. backend tests 的根因不是“缺少口令”，而是“允许 shared/prod DB 被人为解锁后继续跑测试”，因此直接取消该后门。
 *   3. 判断策略保持保守：凡不是显式 `*_test` / `*_ci` / `*_spec` 的库，都视为受保护数据库，backend tests 一律拒绝执行。
 * 参数与返回值：parseDatabaseName/getDatabaseTargetInfo 返回规范化数据库目标信息；assertSharedDb* 在危险场景抛出 Error。
 * 影响范围：backend Vitest setup、集成测试 helper、shared-DB 风险提示口径。
 * 潜在风险：共享/prod DB 上的 backend tests 将无法再通过环境变量强行解锁；若确需执行，必须显式切换到 dedicated test DB。
 */

export const TEST_DATABASE_REQUIREMENT_HINT =
  'Point DATABASE_URL to an explicit *_test / *_ci / *_spec database before running backend Vitest.';

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

export function assertSharedDbTestExecutionAllowed(
  operation: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const target = getDatabaseTargetInfo(env.DATABASE_URL || '');

  if (!target.databaseUrl || !target.databaseName) {
    throw new Error(
      `[TEST_DB_GUARD] Refusing to ${operation}: DATABASE_URL is missing or unreadable. ${TEST_DATABASE_REQUIREMENT_HINT}`,
    );
  }

  if (!target.isProtectedDb) {
    return;
  }

  throw new Error(
    `[TEST_DB_GUARD] Refusing to ${operation} against protected database "${target.databaseName}". Backend Vitest and destructive integration helpers are permanently disabled on shared/prod DB. ${TEST_DATABASE_REQUIREMENT_HINT}`,
  );
}

export function assertSharedDbDestructiveTestMutationAllowed(
  operation: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  assertSharedDbTestExecutionAllowed(operation, env);
}
