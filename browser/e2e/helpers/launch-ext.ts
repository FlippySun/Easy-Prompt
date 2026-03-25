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
    ],
  });

  return context;
}

/**
 * Resolve the extension id for the loaded MV3 extension.
 *
 * Strategy:
 *  1. Fast path: try serviceWorkers() immediately (may be empty if SW is still
 *     registering, but it's free to check).
 *  2. CDP: attach a Chrome DevTools Protocol session to the SW and call
 *     Target.getTargets to list all targets including service workers. The SW
 *     URL (chrome-extension://<id>/background.js) contains the id.
 *  3. Route interception: as a fallback, intercept the first
 *     chrome-extension:// request to extract the id from the URL.
 */
export async function extensionIdFromContext(
  context: BrowserContext,
): Promise<string> {
  // ── 1. Fast path ──────────────────────────────────────────────────────
  let sw = context.serviceWorkers()[0];
  if (sw) {
    const id = sw.url().split("/")[2];
    if (id) return id;
  }

  // ── 2. CDP: attach to the service worker directly ───────────────────
  // We need a CDPSession attached to the SW target itself to enumerate targets.
  // Launch a fresh page so we have a stable CDP session root.
  const helperPage = await context.newPage();
  try {
    const cdp = await context.newCDPSession(helperPage);
    // Enabling Target domain registers it so we can discover other targets.
    await cdp.send("Target.setDiscoverTargets", { discover: true });
    // Wait for the SW to appear as a target.
    const swTarget = await cdp.send("Target.getTargets") as {
      targetInfo: { targetId: string; url: string; type: string };
    }[];
    const extTarget = swTarget.find(
      (t) =>
        t.targetInfo.type === "service_worker" &&
        t.targetInfo.url.includes("background.js"),
    );
    if (extTarget) {
      const id = extTarget.targetInfo.url.split("/")[2];
      if (id) return id;
    }
  } catch {
    // CDP may not work — fall through to route interception
  }

  // ── 3. Route interception fallback ─────────────────────────────────────
  return new Promise<string>((resolve, reject) => {
    let settled = false;

    const settle = (id: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      context.unrouteAll().catch(() => {});
      resolve(id);
    };

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("Timed out waiting for extension id (10s)"));
      }
    }, 10_000);

    context.route(
      (url) => url.protocol === "chrome-extension:",
      (route) => {
        const id = route.request().url().split("/")[2];
        if (id) settle(id);
        route.continue();
      },
    );

    // Open a new page — this wakes the extension SW (if not yet running)
    // and it will make a chrome-extension:// request (e.g. for scenes.json)
    // that hits our route handler.
    context.newPage().then((p) => {
      p.goto("chrome://newtab/").catch(() => {});
      setTimeout(() => p.close().catch(() => {}), 2_000);
    });
  });
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
