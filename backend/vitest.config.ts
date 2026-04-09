import { defineConfig } from 'vitest/config';

// 2026-04-07 新增 — Vitest 测试框架配置
// 设计思路：与 web-hub 使用相同测试框架，保持一致性
// 影响范围：backend/tests/ 下所有测试文件
// 潜在风险：无已知风险
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
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
