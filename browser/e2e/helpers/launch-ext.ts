/**
 * E2E Test Helper: Launch Easy Prompt extension in a browser page
 *
 * For Chromium (Chrome/Edge): uses chrome://extensions + loadExtension approach
 * via browser.contextBridge.experimental.webdriver (Playwright native support)
 *
 * This helper provides a consistent way to interact with the extension's
 * options.html and popup.html pages across all supported browsers.
 */
import { test as base, chromium, firefox, type BrowserContext } from "@playwright/test";
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
  const browserType = chromium;
  const extPath = getDistDir(browserName);
  const channel = browserName === "edge" ? "msedge" : undefined;

  const context = await browserType.launchPersistentContext("", {
    channel,
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

/**
 * Launch Firefox with the Easy Prompt extension loaded.
 *
 * @param options Additional Playwright browser options
 */
export async function launchFirefoxExtension(
  options: Record<string, unknown> = {},
): Promise<BrowserContext> {
  const extPath = getDistDir("firefox");

  const context = await firefox.launchPersistentContext("", {
    headless: true,
    ...options,
    args: [
      `--extensions-dir=${extPath}`,
      ...((options.args as string[]) ?? []),
    ],
  });

  return context;
}

/**
 * Extended test fixture that provides a fresh extension context.
 * Use this in your spec files instead of plain `test`.
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
}

export const test = base.extend<ExtensionFixtures>({
  // Default to Chromium; override with test.use({ browserName: 'firefox' })
  browserName: ["chromium", { option: true }],

  extensionContext: async ({ browserName }, use) => {
    const context =
      browserName === "firefox"
        ? await launchFirefoxExtension()
        : await launchChromiumExtension(browserName as "chromium" | "edge");

    await use(context);
    await context.close();
  },

  extensionPage: async ({ extensionContext }, use) => {
    const page = extensionContext.pages[0] ?? await extensionContext.newPage();
    await use(page);
  },
});

export { expect } from "@playwright/test";
