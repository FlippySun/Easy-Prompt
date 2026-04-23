import { defineConfig } from 'vitest/config';

// 2026-04-07 新增 | 2026-04-16 Batch B 更新 | 2026-04-22 永久止血更新 — Vitest 测试框架配置
// 变更类型：配置/安全/测试
// 功能描述：保持 backend Vitest 配置统一，并在 setupFiles 阶段注入 test-DB runtime guard，阻断直接 `vitest` / `npm run test` 误跑到 protected/shared DB 的路径。
// 设计思路：与 web-hub 使用相同测试框架，同时把 backend tests 仅允许 dedicated test DB 的规则前置到测试进程最早阶段。
// 影响范围：backend/tests/ 下所有测试文件、backend/package.json 测试入口、直接 CLI 调用 vitest 的场景。
// 潜在风险：若当前 DATABASE_URL 仍指向 shared/prod DB，backend Vitest 会立即失败；这是预期安全门。
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    setupFiles: ['src/__tests__/vitest.shared-db.guard.ts'],
    // 集成测试共享同一数据库，必须串行执行避免数据竞争
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/types/**'],
    },
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
