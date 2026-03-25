#!/usr/bin/env node

// ========================== Change Record ==========================
// [Date]        2026-03-24
// [Type]        Configuration change
// [Description] Add a Safari Web Extension converter wrapper so the WXT Safari bundle can be turned into an Xcode project with one command.
// [Approach]    Keep the npm script short and stable, resolve browser-specific defaults in Node, and allow overrides through env vars and flags instead of hard-coding a long shell command.
// [Params/Returns] CLI flags: --dry-run, --copy-resources, --help. Env vars: EASY_PROMPT_SAFARI_APP_NAME, EASY_PROMPT_SAFARI_BUNDLE_ID, EASY_PROMPT_SAFARI_PROJECT_DIR, EASY_PROMPT_SAFARI_PLATFORM (macos|ios|all), EASY_PROMPT_SAFARI_LANGUAGE (swift|objc), EASY_PROMPT_SAFARI_COPY_RESOURCES (1|true). Exits with the spawned process status code; no JS return value.
// [Impact]      browser/scripts/convert-safari.mjs, browser/package.json, package.json, browser/README.md.
// [Risk]        Requires Xcode command line tools on macOS; the default bundle identifier is suitable for local development but may need overriding before distribution.
// =================================================================

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const browserRoot = resolve(scriptDir, '..');
const safariBundleDir = resolve(browserRoot, 'dist', 'safari-mv3');
const cliArgs = new Set(process.argv.slice(2));

/**
 * Read a boolean-like environment variable.
 *
 * @param {string} name Environment variable name.
 * @param {boolean} fallback Value used when the variable is unset.
 * @returns {boolean} Parsed boolean value.
 */
function readBooleanEnv(name, fallback = false) {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(rawValue.toLowerCase());
}

/**
 * Resolve the Safari target platform flag.
 *
 * @param {string} platform Requested platform name: macos, ios, or all.
 * @returns {string[]} CLI flags for safari-web-extension-converter.
 */
function resolvePlatformArgs(platform) {
  if (platform === 'all') return [];
  if (platform === 'macos') return ['--macos-only'];
  if (platform === 'ios') return ['--ios-only'];

  console.error(
    `[Easy Prompt][Safari] Unsupported EASY_PROMPT_SAFARI_PLATFORM: ${platform}. Use macos, ios, or all.`,
  );
  process.exit(1);
}

/**
 * Resolve the language flag for the generated Xcode host app.
 *
 * @param {string} language Requested language: swift or objc.
 * @returns {string} CLI flag for safari-web-extension-converter.
 */
function resolveLanguageArg(language) {
  if (language === 'swift') return '--swift';
  if (language === 'objc') return '--objc';

  console.error(
    `[Easy Prompt][Safari] Unsupported EASY_PROMPT_SAFARI_LANGUAGE: ${language}. Use swift or objc.`,
  );
  process.exit(1);
}

/**
 * Ensure the Safari converter is available on the current machine.
 *
 * @returns {void} Exits the process when xcrun cannot locate the converter.
 */
function ensureConverterAvailable() {
  const lookup = spawnSync('xcrun', ['--find', 'safari-web-extension-converter'], {
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (lookup.status !== 0) {
    console.error(
      '[Easy Prompt][Safari] `xcrun safari-web-extension-converter` was not found. Install Xcode Command Line Tools first.',
    );
    process.exit(lookup.status ?? 1);
  }
}

/**
 * Print the script usage summary.
 *
 * @returns {void} No return value.
 */
function printHelp() {
  console.log(`Easy Prompt Safari converter wrapper

Usage:
  npm run safari:convert
  npm run safari:convert -- --dry-run

Flags:
  --dry-run         Print the resolved xcrun command without running it.
  --copy-resources  Copy the built Safari bundle into the generated Xcode project.
  --help            Show this help message.

Environment variables:
  EASY_PROMPT_SAFARI_APP_NAME      Default: Easy Prompt
  EASY_PROMPT_SAFARI_BUNDLE_ID     Default: chat.zhiz.easy-prompt
  EASY_PROMPT_SAFARI_PROJECT_DIR   Default: dist/safari-xcode
  EASY_PROMPT_SAFARI_PLATFORM      macos | ios | all (default: macos)
  EASY_PROMPT_SAFARI_LANGUAGE      swift | objc (default: swift)
  EASY_PROMPT_SAFARI_COPY_RESOURCES 1 | true | yes | on
`);
}

if (cliArgs.has('--help')) {
  printHelp();
  process.exit(0);
}

const dryRun = cliArgs.has('--dry-run');
const copyResources =
  cliArgs.has('--copy-resources') ||
  readBooleanEnv('EASY_PROMPT_SAFARI_COPY_RESOURCES', false);
const appName = process.env.EASY_PROMPT_SAFARI_APP_NAME ?? 'Easy Prompt';
const bundleIdentifier =
  process.env.EASY_PROMPT_SAFARI_BUNDLE_ID ?? 'chat.zhiz.easy-prompt';
const projectLocation = resolve(
  browserRoot,
  process.env.EASY_PROMPT_SAFARI_PROJECT_DIR ?? 'dist/safari-xcode',
);
const platform = (process.env.EASY_PROMPT_SAFARI_PLATFORM ?? 'macos').toLowerCase();
const language = (process.env.EASY_PROMPT_SAFARI_LANGUAGE ?? 'swift').toLowerCase();

if (!existsSync(safariBundleDir)) {
  console.error(
    `[Easy Prompt][Safari] Safari bundle not found at ${safariBundleDir}. Run \`npm run build:safari\` first.`,
  );
  process.exit(1);
}

ensureConverterAvailable();

const converterArgs = [
  'safari-web-extension-converter',
  '--project-location',
  projectLocation,
  '--app-name',
  appName,
  '--bundle-identifier',
  bundleIdentifier,
  '--no-open',
  '--no-prompt',
  '--force',
  resolveLanguageArg(language),
  ...resolvePlatformArgs(platform),
];

if (copyResources) {
  converterArgs.push('--copy-resources');
}

converterArgs.push(safariBundleDir);

console.log('[Easy Prompt][Safari] Configuration');
console.log(`- Safari bundle : ${safariBundleDir}`);
console.log(`- Xcode project : ${projectLocation}`);
console.log(`- App name      : ${appName}`);
console.log(`- Bundle ID     : ${bundleIdentifier}`);
console.log(`- Platform      : ${platform}`);
console.log(`- Language      : ${language}`);
console.log(`- Copy resources: ${copyResources ? 'yes' : 'no'}`);

if (dryRun) {
  console.log('\n[Easy Prompt][Safari] Dry run command:');
  console.log(`xcrun ${converterArgs.map((item) => JSON.stringify(item)).join(' ')}`);
  process.exit(0);
}

const result = spawnSync('xcrun', converterArgs, {
  cwd: browserRoot,
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log('\n[Easy Prompt][Safari] Safari project is ready. Open the generated Xcode project to run the extension in Safari.');
