#!/usr/bin/env node
/**
 * Easy Prompt Browser Extension — Build Script
 *
 * Usage:
 *   node build.js              # Build all targets (chrome, firefox, safari)
 *   node build.js chrome       # Build Chrome only
 *   node build.js firefox      # Build Firefox only
 *   node build.js safari       # Build Safari only
 *
 * Output: browser/dist/<target>/  (unzipped) + browser/dist/easy-prompt-<target>.zip
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const BROWSER_DIR = __dirname;
const DIST_DIR = path.join(BROWSER_DIR, "dist");

const TARGETS = {
  chrome: "manifest.chrome.json",
  firefox: "manifest.firefox.json",
  safari: "manifest.safari.json",
};

/* Files to include in each build */
const INCLUDE = [
  "scenes.json",
  "popup/popup.html",
  "popup/popup.css",
  "popup/popup.js",
  "options/options.html",
  "options/options.css",
  "options/options.js",
  "background/service-worker.js",
  "content/content.js",
  "content/content.css",
  "shared/storage.js",
  "shared/defaults.js",
  "shared/api.js",
  "shared/scenes.js",
  "shared/router.js",
  "shared/icons.js",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
];

/* Firefox uses "scripts" array, not "service_worker" — adjustments handled via separate manifest */

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  ensureDir(destDir);
  fs.copyFileSync(src, dest);
}

function build(target) {
  const manifestFile = TARGETS[target];
  if (!manifestFile) {
    console.error(`Unknown target: ${target}`);
    process.exit(1);
  }

  const outDir = path.join(DIST_DIR, target);

  // Clean
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true });
  ensureDir(outDir);

  console.log(`Building ${target}...`);

  // Copy manifest
  const manifestSrc = path.join(BROWSER_DIR, manifestFile);
  if (!fs.existsSync(manifestSrc)) {
    console.error(`Manifest not found: ${manifestFile}`);
    process.exit(1);
  }
  fs.copyFileSync(manifestSrc, path.join(outDir, "manifest.json"));

  // Copy files
  let copied = 0;
  for (const file of INCLUDE) {
    const src = path.join(BROWSER_DIR, file);
    if (!fs.existsSync(src)) {
      console.warn(`  ⚠ Missing: ${file}`);
      continue;
    }
    copyFile(src, path.join(outDir, file));
    copied++;
  }

  console.log(`  Copied ${copied} files`);

  // Zip
  const zipFile = path.join(DIST_DIR, `easy-prompt-${target}.zip`);
  if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile);
  try {
    execSync(`cd "${outDir}" && zip -r "${zipFile}" .`, { stdio: "pipe" });
    const size = (fs.statSync(zipFile).size / 1024).toFixed(1);
    console.log(`  Output: dist/easy-prompt-${target}.zip (${size} KB)`);
  } catch (e) {
    console.warn(
      `  ⚠ zip command failed, directory build is available at dist/${target}/`,
    );
  }

  return outDir;
}

/* ─── Main ─── */
const args = process.argv.slice(2);
const targets = args.length > 0 ? args : Object.keys(TARGETS);

console.log("Easy Prompt Browser Extension Builder\n");

for (const t of targets) {
  build(t.toLowerCase());
}

console.log("\nDone!");
