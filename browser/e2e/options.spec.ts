/**
 * E2E Tests for Easy Prompt Options Page
 *
 * Tests the browser extension's settings page (options.html).
 * Verifies that the Options UI loads correctly and form interactions work.
 *
 * Run: npx playwright test e2e/options.spec.ts
 */

import { test, expect } from "./helpers/launch-ext";

test.describe("Options Page", () => {
  test.beforeEach(async ({ extensionPage, browserName }) => {
    // Navigate to the options page using chrome-extension:// URL
    const pages = extensionPage.context().pages();
    const optionsPage = pages.find(
      (p) => p.url().includes("options.html") || p.url().includes("options"),
    );

    if (optionsPage) {
      await optionsPage.bringToFront();
    }
  });

  test("should load the options page without errors", async ({ extensionPage }) => {
    // Navigate directly to options.html
    // Note: Extension pages use chrome-extension:// URLs
    const errors: string[] = [];
    extensionPage.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Try to find the options page among open pages
    const allPages = extensionPage.context().pages();
    const optionsPage =
      allPages.find((p) => p.url().includes("options")) ?? extensionPage;

    // Check that the page has loaded (has title or body)
    await optionsPage.goto("options.html");
    const body = optionsPage.locator("body");
    await expect(body).toBeVisible();
    expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
  });

  test("should display the Easy Prompt logo", async ({ extensionPage }) => {
    const logoIcon = extensionPage.locator("#logo-icon");
    // The logo should be present in the header
    await expect(logoIcon).toBeVisible();
  });

  test("should have an API Mode dropdown", async ({ extensionPage }) => {
    const modeDropdown = extensionPage.locator("#input-api-mode");
    await expect(modeDropdown).toBeVisible();
    // Should have 5 options (including the "auto-detect" option)
    const options = modeDropdown.locator("option");
    await expect(options).toHaveCount(5);
  });

  test("should have API Host input field", async ({ extensionPage }) => {
    const hostInput = extensionPage.locator("#input-api-host");
    await expect(hostInput).toBeVisible();
    await expect(hostInput).toHaveAttribute("type", "url");
  });

  test("should have API Path input field", async ({ extensionPage }) => {
    const pathInput = extensionPage.locator("#input-api-path");
    await expect(pathInput).toBeVisible();
    await expect(pathInput).toHaveAttribute("type", "text");
  });

  test("should have API Key input field", async ({ extensionPage }) => {
    const keyInput = extensionPage.locator("#input-api-key");
    await expect(keyInput).toBeVisible();
    await expect(keyInput).toHaveAttribute("type", "password");
  });

  test("should have Model input field", async ({ extensionPage }) => {
    const modelInput = extensionPage.locator("#input-model");
    await expect(modelInput).toBeVisible();
  });

  test("should have Enhance Mode dropdown", async ({ extensionPage }) => {
    const modeInput = extensionPage.locator("#input-enhance-mode");
    await expect(modeInput).toBeVisible();
    const options = modeInput.locator("option");
    await expect(options).toHaveCount(2); // fast + deep
  });

  test("should have a Save button", async ({ extensionPage }) => {
    const saveBtn = extensionPage.locator("#btn-save");
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toHaveText("保存配置");
  });

  test("should have a Test Connection button", async ({ extensionPage }) => {
    const testBtn = extensionPage.locator("#btn-test");
    await expect(testBtn).toBeVisible();
    await expect(testBtn).toContainText("测试连接");
  });

  test("should have a Fetch Models button", async ({ extensionPage }) => {
    const fetchBtn = extensionPage.locator("#btn-fetch-models");
    await expect(fetchBtn).toBeVisible();
  });

  test("should have a theme toggle button", async ({ extensionPage }) => {
    const themeBtn = extensionPage.locator("#btn-theme");
    await expect(themeBtn).toBeVisible();
  });

  test("API Mode dropdown should auto-fill path when changed", async ({
    extensionPage,
  }) => {
    const modeDropdown = extensionPage.locator("#input-api-mode");
    const pathInput = extensionPage.locator("#input-api-path");

    // Clear the path first
    await pathInput.clear();

    // Select Claude mode
    await modeDropdown.selectOption("claude");

    // Path should be auto-filled with Claude's default path
    await expect(pathInput).toHaveValue("/v1/messages");
  });

  test("Save button should be clickable", async ({ extensionPage }) => {
    const saveBtn = extensionPage.locator("#btn-save");
    await saveBtn.click();
    // No assertion needed — just verify it doesn't throw
  });
});
