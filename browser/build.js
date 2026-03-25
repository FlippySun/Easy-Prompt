#!/usr/bin/env node
// ========================== Change Record ==========================
// [Date]        2026-03-24
// [Type]        Configuration change
// [Description] Keep the legacy build wrapper while making it Node 18 compatible and aligned with the WXT script matrix.
// [Approach]    Preserve `node build.js [target]` as a thin compatibility layer, but resolve paths via fileURLToPath instead of `import.meta.dirname`.
// [Params/Returns] Accepts zero or more targets from {chrome, firefox, safari}. Returns via process exit code; no JS return value.
// [Impact]      browser/build.js, browser/package.json, root README browser build instructions.
// [Risk]        Running this wrapper still requires `npm install` inside `browser/` so that the local WXT binary is available.
// =================================================================

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const browserRoot = dirname(fileURLToPath(import.meta.url));
const targets = new Set(["chrome", "firefox", "safari"]);
const scriptByTarget = {
  chrome: "build:chrome",
  firefox: "build:firefox",
  safari: "build:safari",
};
const args = process.argv.slice(2).map((item) => item.toLowerCase());
const resolvedTargets = args.length === 0 ? [...targets] : args;

for (const target of resolvedTargets) {
  if (!targets.has(target)) {
    console.error(`Unknown target: ${target}`);
    process.exit(1);
  }
}

for (const target of resolvedTargets) {
  console.log(`\n[Easy Prompt][WXT] Building ${target}...`);
  const result = spawnSync("npm", ["run", scriptByTarget[target]], {
    cwd: resolve(browserRoot),
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\n[Easy Prompt][WXT] Build finished.");
