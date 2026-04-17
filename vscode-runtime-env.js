/**
 * 2026-04-17 新增 — 环境区分任务 6A：VS Code 运行时环境解析
 * 变更类型：新增/配置/重构
 * 功能描述：集中解析 VS Code 扩展在 Development / Test / Production 三种运行模式下的 backend、Web、Web-Hub、SSO/profile 基准地址，并正确处理 `easyPrompt.backendUrl` 仅在用户显式配置时才覆盖默认值的语义。
 * 设计思路：
 *   1. 官方 VS Code API 提供 `ExtensionContext.extensionMode`，可安全区分 Development / Production / Test。
 *   2. `package.json` 中 `easyPrompt.backendUrl` 仍需保持生产默认值给最终用户，但调试态不能因为贡献默认值而误判为“用户显式配置了生产地址”。
 *   3. 因此这里使用 `configuration.inspect("backendUrl")` 只读取用户/工作区显式覆盖值；未显式配置时，Development/Test 默认走本地 3000/5173/5174，Production 保持线上地址。
 * 参数与返回值：`normalizeBaseUrl(value)` 返回去空白与尾斜杠后的地址；`getExplicitBackendOverride(config)` 返回用户显式配置的 backendUrl（无则空字符串）；`isDevelopmentLikeExtensionMode(context)` 返回是否为 Development/Test；`getVscodeRuntimeEnv(context)` 返回 `{ isDevelopmentLike, backendBaseUrl, webAppBaseUrl, webHubBaseUrl, ssoHubBaseUrl, webHubProfileUrl }`。
 * 影响范围：extension.js、welcomeView.js、VS Code 扩展调试态 / 发布态的 SSO 与后端请求链路。
 * 潜在风险：若未来新增独立的 Web-Hub / Web app 设置项，此处需要同步扩展优先级规则；当前无已知风险。
 */
const vscode = require("vscode");

const LOCAL_BACKEND_BASE_URL = "http://localhost:3000";
const LOCAL_WEB_APP_BASE_URL = "http://localhost:5174";
const LOCAL_WEB_HUB_BASE_URL = "http://localhost:5173";
const PRODUCTION_BACKEND_BASE_URL = "https://api.zhiz.chat";
const PRODUCTION_WEB_APP_BASE_URL = "https://prompt.zhiz.chat";
const PRODUCTION_WEB_HUB_BASE_URL = "https://zhiz.chat";

function normalizeBaseUrl(value) {
  return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
}

function getExplicitBackendOverride(config) {
  const inspected = config.inspect("backendUrl");
  const overrideCandidates = [
    inspected?.workspaceFolderLanguageValue,
    inspected?.workspaceFolderValue,
    inspected?.workspaceLanguageValue,
    inspected?.workspaceValue,
    inspected?.globalLanguageValue,
    inspected?.globalValue,
  ];

  for (const candidate of overrideCandidates) {
    const normalized = normalizeBaseUrl(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function isDevelopmentLikeExtensionMode(context) {
  return (
    context?.extensionMode === vscode.ExtensionMode.Development ||
    context?.extensionMode === vscode.ExtensionMode.Test
  );
}

function resolveModeBaseUrl(isDevelopmentLike, productionBaseUrl, localBaseUrl) {
  return isDevelopmentLike ? localBaseUrl : productionBaseUrl;
}

function getVscodeRuntimeEnv(context) {
  const config = vscode.workspace.getConfiguration("easyPrompt");
  const isDevelopmentLike = isDevelopmentLikeExtensionMode(context);
  const explicitBackendOverride = getExplicitBackendOverride(config);
  const backendBaseUrl =
    explicitBackendOverride ||
    resolveModeBaseUrl(
      isDevelopmentLike,
      PRODUCTION_BACKEND_BASE_URL,
      LOCAL_BACKEND_BASE_URL,
    );
  const webAppBaseUrl = resolveModeBaseUrl(
    isDevelopmentLike,
    PRODUCTION_WEB_APP_BASE_URL,
    LOCAL_WEB_APP_BASE_URL,
  );
  const webHubBaseUrl = resolveModeBaseUrl(
    isDevelopmentLike,
    PRODUCTION_WEB_HUB_BASE_URL,
    LOCAL_WEB_HUB_BASE_URL,
  );

  return {
    isDevelopmentLike,
    backendBaseUrl,
    webAppBaseUrl,
    webHubBaseUrl,
    ssoHubBaseUrl: webHubBaseUrl,
    webHubProfileUrl: `${webHubBaseUrl}/profile`,
  };
}

module.exports = {
  LOCAL_BACKEND_BASE_URL,
  LOCAL_WEB_APP_BASE_URL,
  LOCAL_WEB_HUB_BASE_URL,
  PRODUCTION_BACKEND_BASE_URL,
  PRODUCTION_WEB_APP_BASE_URL,
  PRODUCTION_WEB_HUB_BASE_URL,
  normalizeBaseUrl,
  getExplicitBackendOverride,
  isDevelopmentLikeExtensionMode,
  getVscodeRuntimeEnv,
};
