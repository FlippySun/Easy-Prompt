import { readFileSync } from "node:fs";
import { defineConfig } from "wxt";

// ========================== 变更记录 ==========================
// [日期]     2026-03-24
// [类型]     配置变更
// [描述]     为 Easy Prompt Browser 子项目新增 WXT 配置，统一接管 manifest、多浏览器构建与打包流程。
// [思路]     保留现有 popup/options/background/content 业务实现，通过 entrypoints + manifest hook 兼容 Chrome / Firefox / Safari 差异。
// [影响范围] browser/wxt.config.ts、browser/wxt-entrypoints/*、browser/public/*、根目录 package.json 的 browser:* 脚本。
// [潜在风险] Firefox MV3 仍使用 background.scripts 特殊语义；此处已在 manifest hook 中显式修正。
// ==============================================================

const rootPackageJsonPath = new URL("../package.json", import.meta.url);
const rootPackageJson = JSON.parse(
  readFileSync(rootPackageJsonPath, "utf8"),
) as {
  version?: string;
};

const extensionVersion = rootPackageJson.version ?? "5.3.6";
const sharedIcons = {
  16: "icons/icon-16.png",
  32: "icons/icon-32.png",
  48: "icons/icon-48.png",
  128: "icons/icon-128.png",
};

export default defineConfig({
  srcDir: ".",
  entrypointsDir: "wxt-entrypoints",
  publicDir: "public",
  outDir: "dist",
  manifest: ({ browser, manifestVersion }) => ({
    name:
      browser === "chrome"
        ? "__MSG_extName__" // "Easy Prompt AI" — kept in public/_locales/*/messages.json
        : "Easy Prompt", // Edge, Firefox, Safari, etc.
    default_locale: "en",
    version: extensionVersion,
    description:
      "AI Prompt 增强工具：97 场景、10 画像、两步路由，支持网页一键增强，含 PromptHub 精选库（zhiz.chat）。",
    icons: sharedIcons,
    action: {
      default_icon: sharedIcons,
      default_title: browser === "chrome" ? "__MSG_extName__" : "Easy Prompt",
    },
    // 2026-04-10 SSO B1: 新增 identity 权限，用于 chrome.identity.launchWebAuthFlow SSO 登录
    // Safari 不支持 identity API，使用 Tab redirect fallback（auth-callback 页面）
    permissions: [
      "storage",
      "contextMenus",
      "activeTab",
      "scripting",
      "identity",
      "alarms",
    ],
    host_permissions: ["https://*/*", "http://*/*"],
    commands: {
      "smart-enhance": {
        suggested_key: {
          default: "Ctrl+Shift+E",
          mac: "Command+Shift+E",
        },
        description: "智能增强选中文字",
      },
      _execute_action: {
        suggested_key: {
          default: "Ctrl+Shift+Y",
          mac: "Command+Shift+Y",
        },
        description: "打开 Easy Prompt",
      },
    },
    content_security_policy:
      manifestVersion === 3
        ? { extension_pages: "script-src 'self'; object-src 'self'" }
        : undefined,
    browser_specific_settings:
      browser === "firefox"
        ? {
            gecko: {
              id: "easy-prompt@flippysun.com",
              strict_min_version: "140.0",
              data_collection_permissions: {
                required: ["none"],
              },
            },
            gecko_android: {
              strict_min_version: "142.0",
            },
          }
        : browser === "edge"
          ? {
              // Microsoft Edge uses Chromium manifest format with edge-specific settings.
              // extension_id: set after first publish to Microsoft Add-ons.
              // strict_min_version: Edge 130+ supports MV3.
              edge: {
                strict_min_version: "130",
              },
            }
          : undefined,
  }),
  hooks: {
    "build:manifestGenerated": (wxt, manifest) => {
      const targetBrowser = wxt.config.browser;
      const manifestVersion = wxt.config.manifestVersion;

      // Firefox MV3 still uses background.scripts instead of background.service_worker.
      if (
        targetBrowser === "firefox" &&
        manifestVersion === 3 &&
        manifest.background &&
        "service_worker" in manifest.background
      ) {
        const workerFile = manifest.background.service_worker;
        if (workerFile) {
          manifest.background = {
            scripts: [workerFile],
          };
        }
      }

      // Keep options page behavior aligned with the pre-WXT manifests.
      const optionsPage =
        manifest.options_ui && typeof manifest.options_ui === "object"
          ? manifest.options_ui.page
          : manifest.options_page;

      if (optionsPage) {
        if (targetBrowser === "firefox") {
          manifest.options_ui = {
            page: optionsPage,
            open_in_tab: true,
          };
          delete manifest.options_page;
        } else {
          // Chrome, Edge, Safari all use options_page (MV2 compat) or options_ui (MV3).
          // For simplicity, we normalize to options_page for MV3 Chrome/Edge/Safari.
          manifest.options_page = optionsPage;
          delete manifest.options_ui;
        }
      }
    },
  },
});
