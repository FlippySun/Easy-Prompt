/**
 * E2E Test Helper: Launch Easy Prompt extension in a browser page
 *
 * Playwright only reliably supports MV3 extensions with the bundled Chromium
 * (`channel: "chromium"`). Chrome/Edge stable channels removed the sideload
 * flags; Edge-targeted builds are still validated by loading `edge-mv3` via
 * Chromium. See: https://playwright.dev/docs/chrome-extensions
 */
import { test as base, chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export const DIST_DIR = path.resolve(__dirname, "../dist");

/**
 * Returns the dist subdirectory for a given browser target.
 * @param browserName "chromium" | "firefox" | "edge"
 */
export function getDistDir(browserName: string): string {
  const map: Record<string, string> = {
    chromium: "chrome-mv3",
    edge: "edge-mv3",
    firefox: "firefox-mv3",
  };
  return path.join(DIST_DIR, map[browserName] ?? "chrome-mv3");
}

/**
 * Launch a Chromium-based browser context with the Easy Prompt extension loaded.
 * Works for both Chrome and Edge (both use Chromium).
 *
 * @param browserName "chromium" | "edge"
 * @param options Additional Playwright browser options
 */
export async function launchChromiumExtension(
  browserName: "chromium" | "edge",
  options: Record<string, unknown> = {},
): Promise<BrowserContext> {
  const extPath = getDistDir(browserName);

  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    ...options,
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
      ...((options.args as string[]) ?? []),
    ],
  });

  return context;
}

export async function extensionIdFromContext(
  context: BrowserContext,
): Promise<string> {
  let [sw] = context.serviceWorkers();
  if (!sw) {
    sw = await context.waitForEvent("serviceworker");
  }
  const id = sw.url().split("/")[2];
  if (!id) {
    throw new Error(`Could not parse extension id from ${sw.url()}`);
  }
  return id;
}

/**
 * Extended test fixture that provides a fresh extension context.
 * Use this in your spec files instead of plain `test`.
 * Which browser loads the extension follows `playwright.config` project
 * (`--project=chromium|edge`).
 *
 * @example
 * import { test as extTest } from './helpers/launch-ext';
 * extTest('Options page loads', async ({ extensionPage }) => {
 *   await extensionPage.goto('options.html');
 *   await expect(extensionPage.locator('#logo-icon')).toBeVisible();
 * });
 */
export interface ExtensionFixtures {
  extensionPage: import("@playwright/test").Page;
  extensionContext: BrowserContext;
  extensionId: string;
}

function extensionBrowserFromProject(
  projectName: string,
): "chromium" | "edge" {
  if (projectName === "edge") return "edge";
  return "chromium";
}

export const test = base.extend<ExtensionFixtures>({
  extensionContext: async ({}, use, testInfo) => {
    const browserName = extensionBrowserFromProject(testInfo.project.name);
    const context = await launchChromiumExtension(browserName);

    await use(context);
    await context.close();
  },

  extensionId: async ({ extensionContext }, use) => {
    await use(await extensionIdFromContext(extensionContext));
  },

  extensionPage: async ({ extensionContext }, use) => {
    const pages = extensionContext.pages();
    const page = pages[0] ?? (await extensionContext.newPage());
    await use(page);
  },
});

export { expect } from "@playwright/test";
