/**
 * E2E Test Helper: Launch Easy Prompt extension in a browser page
 *
 * Playwright only reliably supports MV3 extensions with the bundled Chromium
 * (`channel: "chromium"`). Chrome/Edge stable channels removed the sideload
 * flags; Edge-targeted builds are still validated by loading `edge-mv3` via
 * Chromium. See: https://playwright.dev/docs/chrome-extensions
 */
import {
  test as base,
  chromium,
  type BrowserContext,
} from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export const DIST_DIR = path.resolve(__dirname, "../dist");

/**
 * Returns the dist subdirectory for a given browser target.
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
    args: [`--load-extension=${extPath}`],
  });

  return context;
}

/**
 * Resolve the MV3 extension id.
 *
 * Strategy (fastest first):
 *  1. Fast path: active SW already registered → grab id from its URL.
 *  2. CDP on BrowserContext: attach a CDP session at the context level and
 *     call Target.getTargets.  The service worker target URL is
 *     chrome-extension://<id>/background.js.
 *
 * The 2-step approach avoids Playwright's unreliable "serviceworker" event
 * in headless Chromium and avoids chrome-extension:// route interception
 * (which is subject to SW fetch handler interception internals).
 */
export async function extensionIdFromContext(
  context: BrowserContext,
): Promise<string> {
  // ── 1. Fast path: SW already active ─────────────────────────────────
  const active = context.serviceWorkers();
  if (active.length > 0) {
    const id = active[0].url().split("/")[2];
    if (id) return id;
  }

  // ── 2. CDP: enumerate targets via a helper page ────────────────────────
  // newCDPSession() only accepts Page | Frame (not BrowserContext), so we
  // attach to the first open page. With Target.setDiscoverTargets enabled,
  // it will also report service worker targets in the same context.
  const helperPage = context.pages()[0] ?? (await context.newPage());
  try {
    const cdp = await context.newCDPSession(helperPage);
    await cdp.send("Target.setDiscoverTargets", { discover: true });

    // Wait up to 5 s for the extension SW to register and appear.
    const deadline = Date.now() + 5_000;
    let targets: { targetInfo: { type: string; url: string } }[] = [];

    while (Date.now() < deadline) {
      const result = (await cdp.send(
        "Target.getTargets",
      )) as unknown as { targetInfo: { type: string; url: string } }[];
      targets = result;

      const sw = targets.find(
        (t) =>
          t.targetInfo.type === "service_worker" &&
          t.targetInfo.url.includes("background.js"),
      );
      if (sw) {
        const id = sw.targetInfo.url.split("/")[2];
        if (id) return id;
      }

      // No SW yet — the SW may still be starting. Give it a moment.
      await new Promise((r) => setTimeout(r, 500));
    }

    // If we still haven't found the SW, try one more broad search.
    const all = (await cdp.send("Target.getTargets")) as unknown as {
      targetInfo: { type: string; url: string };
    }[];
    const ext = all.find(
      (t) =>
        t.targetInfo.type === "service_worker" &&
        t.targetInfo.url.includes("background.js"),
    );
    if (ext) {
      const id = ext.targetInfo.url.split("/")[2];
      if (id) return id;
    }
  } catch {
    // CDP failed — fall through to route interception
  }

  // ── 3. Route interception (final fallback) ────────────────────────────
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

    // Trigger the SW by opening a new page.
    context.newPage().then((p) => {
      p.goto("chrome://newtab/").catch(() => {});
      setTimeout(() => p.close().catch(() => {}), 2_000);
    });
  });
}

export interface ExtensionFixtures {
  extensionPage: import("@playwright/test").Page;
  extensionContext: BrowserContext;
  extensionId: string;
}

function extensionBrowserFromProject(projectName: string): "chromium" | "edge" {
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
