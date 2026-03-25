/**
 * Playwright Configuration for Easy Prompt Browser Extension E2E Tests
 *
 * Targets: Chromium (Chrome MV3 + Edge MV3 build via bundled Chromium)
 * Tests: Options page, Popup UI (via extension launch)
 *
 * Usage:
 *   npx playwright test                    # Run all tests
 *   npx playwright test --project=chromium  # Chromium only
 *   npx playwright test --project=edge     # Edge-targeted MV3 build
 */

import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Run serially to avoid extension storage conflicts
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report" }],
  ],

  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // ── Chromium (Chrome MV3) ─────────────────────────────────────────────
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chromium",
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve(__dirname, "../dist/chrome-mv3")}`,
            `--load-extension=${path.resolve(__dirname, "../dist/chrome-mv3")}`,
          ],
        },
      },
      testMatch: /.*\.spec\.ts/,
    },

    // ── Edge MV3 build (loaded with Playwright Chromium, not Microsoft Edge) ─
    {
      name: "edge",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chromium",
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve(__dirname, "../dist/edge-mv3")}`,
            `--load-extension=${path.resolve(__dirname, "../dist/edge-mv3")}`,
          ],
        },
      },
      testMatch: /.*\.spec\.ts/,
    },
  ],

  // Build steps before running tests
  webServer: undefined,
});
