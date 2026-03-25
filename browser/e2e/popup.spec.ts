/**
 * E2E Tests for Easy Prompt Popup UI
 *
 * Tests the browser extension's popup interface (popup.html).
 * Verifies that the Popup loads, scene list is rendered, and
 * the main enhance flow UI is present.
 *
 * Run: npx playwright test e2e/popup.spec.ts
 */

import { test, expect } from "./helpers/launch-ext";

test.describe("Popup UI", () => {
  test("should load the popup page without console errors", async ({
    extensionPage,
  }) => {
    const errors: string[] = [];
    extensionPage.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Popup is the first page that loads when the extension opens
    await extensionPage.goto("popup.html");

    const body = extensionPage.locator("body");
    await expect(body).toBeVisible();

    // Ignore known benign errors (favicon, etc.)
    const realErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("net::ERR_FILE_NOT_FOUND"),
    );
    expect(realErrors).toHaveLength(0);
  });

  test("should display the Easy Prompt logo", async ({ extensionPage }) => {
    await extensionPage.goto("popup.html");
    // Look for logo element (typically a header icon or SVG)
    const header = extensionPage.locator(".header");
    await expect(header).toBeVisible();
  });

  test("should have an input textarea for user text", async ({
    extensionPage,
  }) => {
    await extensionPage.goto("popup.html");
    // The main input area should be visible
    const textarea = extensionPage.locator("textarea");
    await expect(textarea).toBeVisible();
  });

  test("should have an enhance button", async ({ extensionPage }) => {
    await extensionPage.goto("popup.html");
    const enhanceBtn = extensionPage.locator("button");
    // At least one button should be present (enhance / submit)
    await expect(enhanceBtn.first()).toBeVisible();
  });

  test("should display scene selection UI", async ({ extensionPage }) => {
    await extensionPage.goto("popup.html");
    // Look for scene-related elements (may be a list, chips, or quick-pick)
    const sceneArea = extensionPage.locator(
      ".scenes, .scene-list, .scene-grid, #scenes, [class*='scene']",
    );
    // The popup should contain some scene-related UI
    // (either visible or present in DOM)
    const sceneExists =
      (await sceneArea.count()) > 0 ||
      (await extensionPage.locator(".quick-pick, .scene-tabs, #scene-select").count()) >
        0;
    expect(sceneExists).toBe(true);
  });

  test("should have a theme toggle", async ({ extensionPage }) => {
    await extensionPage.goto("popup.html");
    const themeBtn = extensionPage.locator(
      "#btn-theme, .btn-theme, button[title*='主题'], button[title*='theme']",
    );
    await expect(themeBtn.first()).toBeVisible();
  });

  test("should have a history button or history indicator", async ({
    extensionPage,
  }) => {
    await extensionPage.goto("popup.html");
    // History might be a button, tab, or section
    const historyExists =
      (await extensionPage.locator(
        ".history, #history, button[title*='历史'], [class*='history']",
      ).count()) > 0;
    expect(historyExists).toBe(true);
  });
});
