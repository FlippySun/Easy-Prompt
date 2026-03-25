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

async function loadPopup(
  extensionPage: import("@playwright/test").Page,
  extensionId: string,
) {
  await extensionPage.goto(
    `chrome-extension://${extensionId}/popup.html`,
  );
  // Wait for the module script to execute and populate the UI.
  // The popup main.js mounts styles/behaviour via the module script.
  await extensionPage.waitForLoadState("domcontentloaded");
  await extensionPage.waitForSelector(".header", { timeout: 15_000 });
}

test.describe("Popup UI", () => {
  test("should load the popup page without console errors", async ({
    extensionPage,
    extensionId,
  }) => {
    const errors: string[] = [];
    extensionPage.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await extensionPage.goto(
      `chrome-extension://${extensionId}/popup.html`,
    );
    await extensionPage.waitForSelector("body", { timeout: 15_000 });

    const realErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("net::ERR_FILE_NOT_FOUND"),
    );
    expect(realErrors).toHaveLength(0);
  });

  test("should display the Easy Prompt logo", async ({
    extensionPage,
    extensionId,
  }) => {
    await loadPopup(extensionPage, extensionId);
    const header = extensionPage.locator(".header");
    await expect(header).toBeVisible();
  });

  test("should have an input textarea for user text", async ({
    extensionPage,
    extensionId,
  }) => {
    await loadPopup(extensionPage, extensionId);
    const textarea = extensionPage.locator("textarea");
    await expect(textarea).toBeVisible();
  });

  test("should have an enhance button", async ({
    extensionPage,
    extensionId,
  }) => {
    await loadPopup(extensionPage, extensionId);
    const enhanceBtn = extensionPage.locator("button");
    await expect(enhanceBtn.first()).toBeVisible();
  });

  test("should display scene selection UI", async ({
    extensionPage,
    extensionId,
  }) => {
    await loadPopup(extensionPage, extensionId);
    // Match any element whose class or id contains "scene"
    const sceneExists =
      (await extensionPage.locator("[class*='scene'], #scene-select").count()) > 0;
    expect(sceneExists).toBe(true);
  });

  test("should have a theme toggle", async ({
    extensionPage,
    extensionId,
  }) => {
    await loadPopup(extensionPage, extensionId);
    const themeBtn = extensionPage.locator(
      "#btn-theme, .btn-theme, button[title*='主题'], button[title*='theme']",
    );
    await expect(themeBtn.first()).toBeVisible();
  });

  test("should have a history button or history indicator", async ({
    extensionPage,
    extensionId,
  }) => {
    await loadPopup(extensionPage, extensionId);
    const historyExists =
      (await extensionPage.locator(
        ".history, #history, button[title*='历史'], [class*='history']",
      ).count()) > 0;
    expect(historyExists).toBe(true);
  });
});
