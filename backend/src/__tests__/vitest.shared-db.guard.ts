/**
 * Vitest shared DB runtime guard
 * 2026-04-16 新增 — Batch B shared DB hardening
 * 变更类型：新增/安全/测试
 * 功能描述：在 Vitest 运行时最早阶段统一执行 shared-DB 安全检查，阻断直接 `vitest`/`npm run test` 误跑到共享库的路径。
 * 设计思路：
 *   1. setupFiles 级别 guard 比 helper/runners 更靠前，可覆盖直接 CLI 调用。
 *   2. 仅限制 backend Vitest 运行；普通后端开发与服务启动不受影响。
 *   3. unlock 口令复用 `ALLOW_SHARED_DB_TESTS=I_ACK_SHARED_DB_TEST_MUTATIONS`，避免不同入口产生多套例外规则。
 * 参数与返回值：模块加载时执行一次，无导出；安全时静默，不安全时抛出 Error 中止测试进程。
 * 影响范围：backend/vitest.config.ts、所有 backend Vitest 入口。
 * 潜在风险：若确需在 shared/prod DB 上运行 backend Vitest，必须显式设置 unlock 环境变量；这是预期安全门。
 */

import {
  SHARED_DB_TEST_UNLOCK_ENV,
  SHARED_DB_TEST_UNLOCK_VALUE,
  assertSharedDbTestExecutionAllowed,
} from '../utils/dbSafety';

assertSharedDbTestExecutionAllowed(
  `initialize backend Vitest runtime (requires ${SHARED_DB_TEST_UNLOCK_ENV}=${SHARED_DB_TEST_UNLOCK_VALUE})`,
);
