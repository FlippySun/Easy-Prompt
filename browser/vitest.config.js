/**
 * Vitest Configuration for browser/shared Unit Tests
 * Tests for browser/shared/api.js, router.js, storage.js, defaults.js
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "wxt-entrypoints/**",
        "background/**",
        "popup/**",
        "options/**",
        "content/**",
        "scripts/**",
        "**/*.test.js",
        "**/*.spec.js",
      ],
    },
    include: ["__tests__/**/*.test.js"],
    exclude: ["node_modules/**", "dist/**"],
  },
});
