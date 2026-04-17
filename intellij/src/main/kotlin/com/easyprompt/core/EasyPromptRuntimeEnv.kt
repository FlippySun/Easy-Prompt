package com.easyprompt.core

import com.easyprompt.settings.EasyPromptSettings
import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.extensions.PluginId

/**
 * 2026-04-17 新增 — IntelliJ 运行时环境解析
 * 变更类型：新增/配置/重构
 * 功能描述：集中解析 IntelliJ 插件在开发沙箱 / 单元测试 / 发布安装态下的 backend、Web、Web-Hub、SSO/profile 基准地址，并允许用户显式覆盖 backend API 基准地址，避免各调用点散落硬编码生产域名。
 * 设计思路：
 *   1. IntelliJ Platform 官方文档明确存在 development sandbox 约定，但未提供单一、稳定的“开发态 API”。
 *   2. 因此这里采用保守组合信号：`ApplicationManager.isUnitTestMode` 识别测试态；插件安装路径命中 sandbox 目录约定时识别开发态。
 *   3. 用户显式设置 `backendUrl` 时，仅覆盖 backend API 基准地址；Web / Web-Hub / SSO 页仍保持运行模式默认映射，和 VS Code 端语义对齐。
 *   4. 所有 IntelliJ 端运行时 URL 统一经由本文件导出，确保 SSO 登录、token 兑换/刷新、后端增强、个人主页和 Web 外链保持同一环境契约。
 * 参数与返回值：`isDevelopmentLikeRuntime()` 返回当前是否为开发/测试态；`getExplicitBackendOverride()` 返回用户显式 backend override（无则空）；`getEasyPromptRuntimeEnv()` 返回 `{ isDevelopmentLike, backendBaseUrl, webAppBaseUrl, webHubBaseUrl, ssoHubBaseUrl, webHubProfileUrl }`。
 * 影响范围：SsoAuthClient.kt、ApiClient.kt、WelcomeScreenLoginAction.kt、EasyPromptToolWindowFactory.kt、StatusBarMenuAction.kt。
 * 潜在风险：sandbox 路径判定属于工程约定而非单独运行时枚举；若用户显式填入不可达 backend override，后端请求会按显式配置失败；当前无其他已知风险。
 */
const val LOCAL_BACKEND_BASE_URL = "http://localhost:3000"
const val LOCAL_WEB_APP_BASE_URL = "http://localhost:5174"
const val LOCAL_WEB_HUB_BASE_URL = "http://localhost:5173"
const val PRODUCTION_BACKEND_BASE_URL = "https://api.zhiz.chat"
const val PRODUCTION_WEB_APP_BASE_URL = "https://prompt.zhiz.chat"
const val PRODUCTION_WEB_HUB_BASE_URL = "https://zhiz.chat"

private const val EASY_PROMPT_PLUGIN_ID = "com.easyprompt.plugin"

data class EasyPromptRuntimeEnv(
    val isDevelopmentLike: Boolean,
    val backendBaseUrl: String,
    val webAppBaseUrl: String,
    val webHubBaseUrl: String,
    val ssoHubBaseUrl: String,
    val webHubProfileUrl: String
)

private fun normalizeBaseUrl(value: String): String = value.trim().trimEnd('/')

/**
 * 2026-04-17 修复 — 环境区分任务 7：读取 IntelliJ 显式 backend override
 * 变更类型：修复/配置/兼容
 * 功能描述：从持久化设置中读取 `backendUrl`，作为 IntelliJ 端唯一的用户显式 backend override 来源。
 * 设计思路：与 VS Code `configuration.inspect("backendUrl")` 的“仅用户显式覆盖才生效”语义保持一致；空字符串仍代表未配置。
 * 参数与返回值：`getExplicitBackendOverride()` 无参数；返回归一化后的 backend 基准地址，未配置时返回空字符串。
 * 影响范围：getEasyPromptRuntimeEnv()、ApiClient、SsoAuthClient、IntelliJ 后端相关请求链路。
 * 潜在风险：应用级服务在极早期未就绪时会安全回退空字符串，不影响默认环境判定。
 */
fun getExplicitBackendOverride(): String {
    return try {
        normalizeBaseUrl(EasyPromptSettings.getInstance().state.backendUrl)
    } catch (_: Exception) {
        ""
    }
}

fun isDevelopmentLikeRuntime(): Boolean {
    val app = ApplicationManager.getApplication()
    if (app?.isUnitTestMode == true) {
        return true
    }

    val pluginPath = try {
        PluginManagerCore.getPlugin(PluginId.getId(EASY_PROMPT_PLUGIN_ID))
            ?.pluginPath
            ?.toString()
            ?.lowercase()
            ?: ""
    } catch (_: Exception) {
        ""
    }

    return pluginPath.contains(".intellijplatform/sandbox") ||
        pluginPath.contains("idea-sandbox") ||
        pluginPath.contains("/sandbox/plugins/") ||
        pluginPath.contains("\\sandbox\\plugins\\")
}

fun getEasyPromptRuntimeEnv(): EasyPromptRuntimeEnv {
    val isDevelopmentLike = isDevelopmentLikeRuntime()
    val explicitBackendOverride = getExplicitBackendOverride()
    val backendBaseUrl = explicitBackendOverride.ifBlank {
        if (isDevelopmentLike) LOCAL_BACKEND_BASE_URL else PRODUCTION_BACKEND_BASE_URL
    }
    val webAppBaseUrl = if (isDevelopmentLike) LOCAL_WEB_APP_BASE_URL else PRODUCTION_WEB_APP_BASE_URL
    val webHubBaseUrl = if (isDevelopmentLike) LOCAL_WEB_HUB_BASE_URL else PRODUCTION_WEB_HUB_BASE_URL

    return EasyPromptRuntimeEnv(
        isDevelopmentLike = isDevelopmentLike,
        backendBaseUrl = normalizeBaseUrl(backendBaseUrl),
        webAppBaseUrl = normalizeBaseUrl(webAppBaseUrl),
        webHubBaseUrl = normalizeBaseUrl(webHubBaseUrl),
        ssoHubBaseUrl = normalizeBaseUrl(webHubBaseUrl),
        webHubProfileUrl = "${normalizeBaseUrl(webHubBaseUrl)}/profile"
    )
}
