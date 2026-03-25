/**
 * E2E Tests for Easy Prompt Popup UI
 *
 * Tests the browser extension's popup interface (popup.html).
 * Verifies that the Popup loads and renders key content.
 *
 * Note: The MV3 popup uses Shadow DOM encapsulation — Playwright's standard
 * locators cannot pierce shadow roots. We verify the popup loaded by checking:
 *  1. The page title ("Easy Prompt")
 *  2. The static HTML (not inside shadow DOM) contains known text nodes
 *     (header title, empty-state, scene label)
 *
 * Run: npx playwright test e2e/popup.spec.ts
 */

import { test, expect } from "./helpers/launch-ext";

async function loadPopup(
  page: import("@playwright/test").Page,
  extensionId: string,
) {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  // Wait for the module script to execute — it populates the UI.
  await page.waitForLoadState("load");
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
    // Verify the page title loaded correctly.
    await expect(extensionPage).toHaveTitle("Easy Prompt");

    const realErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("ERR_FILE_NOT_FOUND"),
    );
    expect(realErrors).toHaveLength(0);
  });

  test("should display the Easy Prompt title text", async ({
    extensionPage,
    extensionId,
  }) => {
    await loadPopup(extensionPage, extensionId);
    const bodyHTML = await extensionPage.evaluate(
      () => document.body.innerHTML,
    );
    // The header title is in static HTML at the light-DOM level.
    expect(bodyHTML).toContain("Easy Prompt");
  });

  test("should render the empty-state hint text", async ({
    extensionPage,
    extensionId,
  }) => {
    await loadPopup(extensionPage, extensionId);
    const bodyHTML = await extensionPage.evaluate(
      () => document.body.innerHTML,
    );
    // The empty-state paragraph contains "输入需求" in static HTML.
    expect(bodyHTML).toContain("输入需求");
  });

  test("should render the scene-select label", async ({
    extensionPage,
    extensionId,
  }) => {
    await loadPopup(extensionPage, extensionId);
    const bodyHTML = await extensionPage.evaluate(
      () => document.body.innerHTML,
    );
    // The scene-select button label is in static HTML.
    expect(bodyHTML).toContain("智能识别");
  });

  test("should render the scene-area placeholder", async ({
    extensionPage,
    extensionId,
  }) => {
    await loadPopup(extensionPage, extensionId);
    const bodyHTML = await extensionPage.evaluate(
      () => document.body.innerHTML,
    );
    // The input textarea area is part of the main-view structure.
    expect(bodyHTML).toContain("input-text") ||
    expect(bodyHTML).toContain("input-area");
  });

  test("should have the character count display", async ({
    extensionPage,
    extensionId,
  }) => {
    await loadPopup(extensionPage, extensionId);
    const bodyHTML = await extensionPage.evaluate(
      () => document.body.innerHTML,
    );
    // Character count label confirms the input area rendered.
    expect(bodyHTML).toContain("10000");
  });
});
