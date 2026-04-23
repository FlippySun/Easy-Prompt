/**
 * Vitest shared DB runtime guard
 * 2026-04-16 新增 — Batch B shared DB hardening
 * 2026-04-22 更新 — 共享生产库事故后的永久止血
 * 变更类型：修复/安全/测试
 * 功能描述：在 Vitest 运行时最早阶段统一执行 test-DB 安全检查，阻断直接 `vitest`/`npm run test` 误跑到共享/生产库的路径。
 * 设计思路：
 *   1. setupFiles 级别 guard 比 helper/runners 更靠前，可覆盖直接 CLI 调用。
 *   2. 仅限制 backend Vitest 运行；普通后端开发与服务启动不受影响。
 *   3. shared/prod DB 的人工解锁后门已经被移除；backend tests 只能在 dedicated test DB 上运行。
 * 参数与返回值：模块加载时执行一次，无导出；安全时静默，不安全时抛出 Error 中止测试进程。
 * 影响范围：backend/vitest.config.ts、所有 backend Vitest 入口。
 * 潜在风险：若当前 DATABASE_URL 仍指向 shared/prod DB，任何 backend Vitest 都会立即失败；这是预期安全门。
 */

import { TEST_DATABASE_REQUIREMENT_HINT, assertSharedDbTestExecutionAllowed } from '../utils/dbSafety';

assertSharedDbTestExecutionAllowed(
  `initialize backend Vitest runtime (${TEST_DATABASE_REQUIREMENT_HINT})`,
);
