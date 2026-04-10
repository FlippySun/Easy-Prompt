package com.easyprompt.core

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.intellij.credentialStore.CredentialAttributes
import com.intellij.credentialStore.Credentials
import com.intellij.credentialStore.generateServiceName
import com.intellij.ide.ActivityTracker
import com.intellij.ide.passwordSafe.PasswordSafe
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.sun.net.httpserver.HttpServer
import java.awt.Desktop
import java.net.HttpURLConnection
import java.net.InetSocketAddress
import java.net.URI
import java.util.*
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

// ========================== 变更记录 ==========================
// [日期]     2026-04-10
// [类型]     新增
// [描述]     SSO 认证客户端 — 实现 IntelliJ 端 OAuth 2.0 授权码流程
// [思路]     使用 localhost HTTP server 接收浏览器回调，
//            通过 PasswordSafe 安全存储 tokens，
//            后台定时刷新 access token（过期前 60s）。
// [参数]     无外部参数
// [返回值]   各函数见注释
// [影响范围] ApiClient.callBackendEnhance、StatusBarWidget、StatusBarMenu
// [潜在风险] 随机端口可能被防火墙阻断（概率极低）
// ==============================================================

/**
 * SSO 认证客户端（Singleton）
 *
 * 设计思路：
 *   1. LoginAction 调用 startLogin() → 启动 localhost HTTP server → 打开浏览器
 *   2. 用户在 zhiz.chat 登录后 redirect 到 localhost:<port>/callback?code=xxx&state=yyy
 *   3. server 校验 state → POST /sso/token → PasswordSafe 存 tokens → 关闭 server
 *   4. 后台 ScheduledExecutor 在过期前 60s 自动刷新
 *   5. LogoutAction 调用 logout() 清除所有 tokens
 */
object SsoAuthClient {

    private val LOG = Logger.getInstance(SsoAuthClient::class.java)
    private val gson = Gson()

    // ── 常量 ──
    private const val SSO_HUB_BASE = "https://zhiz.chat"
    private const val BACKEND_API_BASE = "https://api.zhiz.chat"
    private const val LOGIN_TIMEOUT_MIN = 5L

    // ── PasswordSafe credential keys ──
    private val accessTokenAttr = CredentialAttributes(
        generateServiceName("EasyPrompt", "ssoAccessToken")
    )
    private val refreshTokenAttr = CredentialAttributes(
        generateServiceName("EasyPrompt", "ssoRefreshToken")
    )

    // ── 内存状态 ──
    @Volatile
    var currentUser: SsoUser? = null
        private set

    @Volatile
    var expiresAt: Long = 0L
        private set

    private var refreshFuture: ScheduledFuture<*>? = null
    private val scheduler = Executors.newSingleThreadScheduledExecutor { r ->
        Thread(r, "EasyPrompt-SSO-Refresh").apply { isDaemon = true }
    }

    // ── 登录状态变更监听 ──
    private val listeners = mutableListOf<() -> Unit>()

    fun addLoginStateListener(listener: () -> Unit) {
        synchronized(listeners) { listeners.add(listener) }
    }

    fun removeLoginStateListener(listener: () -> Unit) {
        synchronized(listeners) { listeners.remove(listener) }
    }

    // 2026-04-10 修复
    // 变更类型：修复
    // 功能描述：在 IntelliJ SSO 登录态变化后主动触发 Action System 刷新，确保启动 Welcome Screen 上的 zhiz.chat CTA 立即更新为最新账号文案。
    // 设计思路：notifyListeners() 除了通知 ToolWindow/fallback 的自定义监听器外，再通过 ActivityTracker.getInstance().inc() 通知 IDE 重新计算 action presentation，避免 WelcomeScreenLoginAction 的 update() 滞后。
    // 参数与返回值：notifyListeners() 无参数、无返回值；在 saveTokens()/clearTokens()/refreshToken() 等统一状态变更路径中调用。
    // 影响范围：IntelliJ 启动 Welcome Screen、ToolWindow 欢迎页、状态依赖 action 的可见性与文案刷新。
    // 潜在风险：登录态变化时会额外触发一次 action update；触发频率很低，性能风险可忽略。
    private fun notifyListeners() {
        synchronized(listeners) { listeners.toList() }.forEach { it() }
        try {
            val app = ApplicationManager.getApplication()
            if (!app.isDisposed) {
                app.invokeLater {
                    ActivityTracker.getInstance().inc()
                }
            }
        } catch (_: Exception) { }
    }

    // ── Token 读写 ──

    fun getAccessToken(): String? {
        return try {
            PasswordSafe.instance.getPassword(accessTokenAttr)?.takeIf { it.isNotBlank() }
        } catch (e: Exception) {
            LOG.warn("Failed to read SSO access token", e)
            null
        }
    }

    private fun getRefreshToken(): String? {
        return try {
            PasswordSafe.instance.getPassword(refreshTokenAttr)?.takeIf { it.isNotBlank() }
        } catch (e: Exception) {
            LOG.warn("Failed to read SSO refresh token", e)
            null
        }
    }

    private fun saveTokens(accessToken: String, refreshToken: String, expiresInSec: Long, user: SsoUser?) {
        try {
            PasswordSafe.instance.set(accessTokenAttr, Credentials("EasyPrompt", accessToken))
            PasswordSafe.instance.set(refreshTokenAttr, Credentials("EasyPrompt", refreshToken))
        } catch (e: Exception) {
            LOG.error("Failed to save SSO tokens", e)
        }
        expiresAt = System.currentTimeMillis() + expiresInSec * 1000
        if (user != null) {
            currentUser = user
            // 2026-04-10 修复 — SSO 全端审计 P1-1
            // 持久化用户信息到 Settings XML，IDE 重启后可恢复
            try {
                val settings = com.easyprompt.settings.EasyPromptSettings.getInstance()
                settings.state.ssoUsername = user.username
                settings.state.ssoDisplayName = user.displayName
            } catch (_: Exception) { /* 非关键路径，忽略 */ }
        }
        scheduleRefresh()
        notifyListeners()
    }

    private fun clearTokens() {
        try {
            PasswordSafe.instance.set(accessTokenAttr, null)
            PasswordSafe.instance.set(refreshTokenAttr, null)
        } catch (e: Exception) {
            LOG.warn("Failed to clear SSO tokens", e)
        }
        currentUser = null
        expiresAt = 0L
        // 2026-04-10 修复 — SSO 全端审计 P1-1：清除持久化的用户信息
        try {
            val settings = com.easyprompt.settings.EasyPromptSettings.getInstance()
            settings.state.ssoUsername = ""
            settings.state.ssoDisplayName = ""
        } catch (_: Exception) { /* 非关键路径 */ }
        cancelRefresh()
        notifyListeners()
    }

    fun isLoggedIn(): Boolean = getAccessToken() != null

    // ── 登录流程 ──

    /**
     * 启动 SSO 登录流程：
     *   1. 随机端口启动 localhost HTTP server（仅 /callback）
     *   2. 生成 CSRF state
     *   3. 打开浏览器跳转 zhiz.chat/auth/login
     *   4. 等待回调或超时 5 分钟
     */
    // 2026-04-10 修复 — SSO 全端审计 P2-3
    // 变更类型：修复
    // 设计思路：包裹 try-catch，HttpServer 创建/启动失败时显示友好提示，
    //   防止企业防火墙阻断 localhost 端口时 IDE 弹出 unhandled exception
    // 影响范围：startLogin() 异常路径
    // 潜在风险：无已知风险
    fun startLogin() {
        val state = UUID.randomUUID().toString()
        val server: HttpServer
        try {
            server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        } catch (e: Exception) {
            LOG.error("Failed to create localhost HTTP server for SSO", e)
            notify("SSO 登录失败：无法在本地创建回调服务器 (${e.message})。请检查防火墙设置。", NotificationType.ERROR)
            return
        }
        val port = server.address.port
        val redirectUri = "http://localhost:$port/callback"

        server.createContext("/callback") { exchange ->
            try {
                val query = exchange.requestURI.query ?: ""
                val params = parseQuery(query)
                val code = params["code"]
                val returnedState = params["state"]

                if (code.isNullOrBlank() || returnedState != state) {
                    // CSRF 校验失败或缺少 code
                    val errorHtml = buildCallbackHtml(false, "登录失败：参数校验错误")
                    exchange.sendResponseHeaders(400, errorHtml.toByteArray().size.toLong())
                    exchange.responseBody.write(errorHtml.toByteArray())
                    exchange.responseBody.close()
                    return@createContext
                }

                // 用授权码换取 tokens
                val tokenData = exchangeCode(code, redirectUri)

                val successHtml = buildCallbackHtml(true, "登录成功！可以关闭此页面")
                exchange.sendResponseHeaders(200, successHtml.toByteArray().size.toLong())
                exchange.responseBody.write(successHtml.toByteArray())
                exchange.responseBody.close()

                // 保存 tokens
                val tokens = tokenData.getAsJsonObject("tokens")
                val userObj = tokenData.getAsJsonObject("user")
                val user = if (userObj != null) SsoUser(
                    username = userObj.get("username")?.asString ?: "",
                    displayName = userObj.get("displayName")?.asString ?: ""
                ) else null
                val accessToken = tokens.get("accessToken").asString
                val refreshToken = tokens.get("refreshToken").asString
                val expiresIn = tokens.get("expiresIn")?.asLong ?: 3600L

                saveTokens(accessToken, refreshToken, expiresIn, user)

                // 通知用户
                val displayName = user?.displayName ?: user?.username ?: "用户"
                ApplicationManager.getApplication().invokeLater {
                    notify("登录成功: $displayName", NotificationType.INFORMATION)
                }
            } catch (e: Exception) {
                LOG.error("SSO callback error", e)
                val errorHtml = buildCallbackHtml(false, "登录失败：${e.message}")
                try {
                    exchange.sendResponseHeaders(500, errorHtml.toByteArray().size.toLong())
                    exchange.responseBody.write(errorHtml.toByteArray())
                    exchange.responseBody.close()
                } catch (_: Exception) { }
                ApplicationManager.getApplication().invokeLater {
                    notify("登录失败: ${e.message}", NotificationType.ERROR)
                }
            } finally {
                // 关闭 server（延迟 1 秒让浏览器完成页面渲染）
                scheduler.schedule({ server.stop(0) }, 1, TimeUnit.SECONDS)
            }
        }

        server.executor = Executors.newSingleThreadExecutor()
        server.start()

        // 超时 5 分钟自动关闭 server
        scheduler.schedule({
            try { server.stop(0) } catch (_: Exception) { }
        }, LOGIN_TIMEOUT_MIN, TimeUnit.MINUTES)

        // 打开浏览器
        val loginUrl = "$SSO_HUB_BASE/auth/login?" +
            "redirect_uri=${java.net.URLEncoder.encode(redirectUri, "UTF-8")}" +
            "&state=${java.net.URLEncoder.encode(state, "UTF-8")}"
        try {
            Desktop.getDesktop().browse(URI(loginUrl))
        } catch (e: Exception) {
            LOG.error("Failed to open browser", e)
            server.stop(0)
            notify("无法打开浏览器: ${e.message}", NotificationType.ERROR)
        }
    }

    // ── 退出 ──

    fun logout() {
        clearTokens()
        notify("已退出登录", NotificationType.INFORMATION)
    }

    // ── Token 刷新 ──

    /**
     * 刷新 access token（B8）
     * @return 新的 accessToken，刷新失败返回 null
     */
    fun refreshToken(): String? {
        val rt = getRefreshToken() ?: return null
        return try {
            val url = URI("$BACKEND_API_BASE/api/v1/auth/refresh").toURL()
            val conn = url.openConnection() as HttpURLConnection
            try {
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.connectTimeout = 15000
                conn.readTimeout = 15000
                conn.doOutput = true

                val body = JsonObject().apply { addProperty("refreshToken", rt) }
                conn.outputStream.write(body.toString().toByteArray())

                val code = conn.responseCode
                if (code !in 200..299) {
                    LOG.warn("SSO refresh failed: HTTP $code")
                    return null
                }

                val respBody = conn.inputStream.bufferedReader().readText()
                val data = gson.fromJson(respBody, JsonObject::class.java)
                if (data.get("success")?.asBoolean != true) return null

                val tokens = data.getAsJsonObject("data")?.getAsJsonObject("tokens") ?: return null
                val newAccess = tokens.get("accessToken")?.asString ?: return null
                val newRefresh = tokens.get("refreshToken")?.asString ?: rt
                val expiresIn = tokens.get("expiresIn")?.asLong ?: 3600L

                saveTokens(newAccess, newRefresh, expiresIn, null)
                newAccess
            } finally {
                conn.disconnect()
            }
        } catch (e: Exception) {
            LOG.warn("SSO refresh error", e)
            null
        }
    }

    /**
     * 定时刷新调度（过期前 60 秒）
     */
    private fun scheduleRefresh() {
        cancelRefresh()
        val delay = maxOf(expiresAt - System.currentTimeMillis() - 60_000, 30_000)
        refreshFuture = scheduler.schedule({
            val newToken = refreshToken()
            if (newToken == null) {
                LOG.info("SSO refresh failed, clearing tokens")
                clearTokens()
            }
        }, delay, TimeUnit.MILLISECONDS)
    }

    private fun cancelRefresh() {
        refreshFuture?.cancel(false)
        refreshFuture = null
    }

    // 2026-04-10 修复 — SSO 全端审计 P1-1
    // 变更类型：修复
    // 设计思路：从 EasyPromptSettings 恢复持久化的用户名/显示名，
    //   避免 IDE 重启后状态栏显示占位符"已登录"
    // 影响范围：IDE 启动时 SSO 状态恢复
    // 潜在风险：无已知风险
    fun restoreOnStartup() {
        if (!isLoggedIn()) return
        if (currentUser == null) {
            // 从持久化 Settings 恢复用户信息
            try {
                val settings = com.easyprompt.settings.EasyPromptSettings.getInstance()
                val username = settings.state.ssoUsername
                val displayName = settings.state.ssoDisplayName
                currentUser = if (username.isNotBlank() || displayName.isNotBlank()) {
                    SsoUser(username, displayName)
                } else {
                    SsoUser("", "已登录")
                }
            } catch (_: Exception) {
                currentUser = SsoUser("", "已登录")
            }
        }
        scheduleRefresh()
    }

    // ── 内部工具方法 ──

    /**
     * 用授权码换取 tokens
     */
    private fun exchangeCode(code: String, redirectUri: String): JsonObject {
        val url = URI("$BACKEND_API_BASE/api/v1/auth/sso/token").toURL()
        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.connectTimeout = 15000
            conn.readTimeout = 15000
            conn.doOutput = true

            val body = JsonObject().apply {
                addProperty("code", code)
                addProperty("redirectUri", redirectUri)
            }
            conn.outputStream.write(body.toString().toByteArray())

            val responseCode = conn.responseCode
            val respBody = if (responseCode in 200..299) {
                conn.inputStream.bufferedReader().readText()
            } else {
                val err = try { conn.errorStream?.bufferedReader()?.readText() } catch (_: Exception) { null }
                throw RuntimeException("授权码兑换失败 (HTTP $responseCode): ${err ?: "Unknown"}")
            }

            val data = gson.fromJson(respBody, JsonObject::class.java)
            if (data.get("success")?.asBoolean != true) {
                val msg = data.getAsJsonObject("error")?.get("message")?.asString ?: "授权码兑换失败"
                throw RuntimeException(msg)
            }

            return data.getAsJsonObject("data")
                ?: throw RuntimeException("响应缺少 data 字段")
        } finally {
            conn.disconnect()
        }
    }

    private fun parseQuery(query: String): Map<String, String> {
        return query.split("&").associate {
            val parts = it.split("=", limit = 2)
            val key = java.net.URLDecoder.decode(parts[0], "UTF-8")
            val value = if (parts.size > 1) java.net.URLDecoder.decode(parts[1], "UTF-8") else ""
            key to value
        }
    }

    private fun buildCallbackHtml(success: Boolean, message: String): String {
        val color = if (success) "#22c55e" else "#ef4444"
        val icon = if (success) "&#10003;" else "&#10007;"
        return """
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"><title>Easy Prompt - SSO</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                     display: flex; justify-content: center; align-items: center;
                     min-height: 100vh; margin: 0; background: #0a0a0b; color: #fafafa; }
              .card { text-align: center; padding: 3rem; border-radius: 1rem;
                      background: #18181b; border: 1px solid #27272a; }
              .icon { font-size: 3rem; color: $color; margin-bottom: 1rem; }
              h2 { margin: 0 0 0.5rem; font-weight: 600; }
              p { color: #a1a1aa; margin: 0; }
            </style>
            </head>
            <body>
              <div class="card">
                <div class="icon">$icon</div>
                <h2>Easy Prompt</h2>
                <p>$message</p>
              </div>
            </body>
            </html>
        """.trimIndent()
    }

    private fun notify(content: String, type: NotificationType) {
        try {
            NotificationGroupManager.getInstance()
                .getNotificationGroup("Easy Prompt")
                .createNotification(content, type)
                .notify(null)
        } catch (_: Exception) { }
    }

    // ── 迁移旧版手动 Token ──

    /**
     * B7a: 启动时检查旧 backendToken → 清除 + 提示用户使用 SSO 登录
     */
    fun migrateLegacyToken() {
        val settings = com.easyprompt.settings.EasyPromptSettings.getInstance()
        @Suppress("DEPRECATION")
        val legacyToken = settings.state.backendToken
        if (legacyToken.isNotBlank()) {
            @Suppress("DEPRECATION")
            settings.state.backendToken = ""
            notify("Easy Prompt 已升级为 SSO 登录。旧的手动 Token 已清除，请使用「登录」功能。", NotificationType.WARNING)
        }
    }
}

/** SSO 用户信息 */
data class SsoUser(
    val username: String,
    val displayName: String
)
