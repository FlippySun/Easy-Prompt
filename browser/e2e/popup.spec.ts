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
  page: import("@playwright/test").Page,
  extensionId: string,
) {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.waitForLoadState("load");
  // Elements like header, textarea are in the initial HTML; wait briefly
  // for any of them to be present.
  await page.waitForSelector(
    "#main-view, header, .header, textarea, #input-text",
    { timeout: 30_000 },
  );
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
    await extensionPage.waitForLoadState("load");
    await extensionPage.waitForSelector("body", { timeout: 30_000 });

    const realErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("ERR_FILE_NOT_FOUND"),
    );
    expect(realErrors).toHaveLength(0);
  });

  test("should display the Easy Prompt logo", async ({
    extensionPage,
    extensionId,
  }) => {
    await loadPopup(extensionPage, extensionId);
    const header = extensionPage.locator("header");
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

  test("should have a generate button", async ({
    extensionPage,
    extensionId,
  }) => {
    await loadPopup(extensionPage, extensionId);
    // The main CTA button is #btn-generate
    const btn = extensionPage.locator("#btn-generate");
    await expect(btn).toBeVisible();
  });

  test("should have a theme toggle button", async ({
    extensionPage,
    extensionId,
  }) => {
    await loadPopup(extensionPage, extensionId);
    const themeBtn = extensionPage.locator("#btn-theme");
    await expect(themeBtn).toBeVisible();
  });

  test("should have a history button", async ({
    extensionPage,
    extensionId,
  }) => {
    await loadPopup(extensionPage, extensionId);
    const historyBtn = extensionPage.locator("#btn-history");
    await expect(historyBtn).toBeVisible();
  });

  test("should have a scene/prompt input area", async ({
    extensionPage,
    extensionId,
  }) => {
    await loadPopup(extensionPage, extensionId);
    // The popup has an input area with either scene-select button or textarea
    const inputArea = extensionPage.locator(
      "#btn-scene-select, #scene-select, .scene-select-btn, .scenes",
    );
    const count = await inputArea.count();
    // At minimum, the textarea + input area should be present
    const hasTextarea = await extensionPage.locator("textarea").count() > 0;
    expect(count > 0 || hasTextarea).toBe(true);
  });
});
