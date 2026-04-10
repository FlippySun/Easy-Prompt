package com.easyprompt.core

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.easyprompt.settings.EasyPromptSettings
import com.intellij.openapi.progress.ProgressIndicator
import java.net.HttpURLConnection
import java.net.URI
import java.net.URLEncoder

data class RouterResult(
    val scenes: List<String>,
    val composite: Boolean
)

data class SmartRouteResult(
    val result: String,
    val scenes: List<String>,
    val composite: Boolean
)

/** 有效配置（内部传递用） */
data class EffectiveConfig(
    val baseUrl: String,
    val apiKey: String,
    val model: String,
    val apiMode: String,
    val enhanceMode: String
)

object ApiClient {
    private val gson = Gson()

    // ========================== 变更记录 ==========================
    // [日期]     2026-03-16
    // [类型]     重构
    // [描述]     将 IntelliJ 端 Fast/Deep 调整为“同模型同端点、不同输出深度”的保守策略。
    // [思路]     模式切换仅影响第二步生成的 token 预算、温度与提示词密度，不再触碰模型切换与请求形状。
    // [影响范围] ApiClient 的 smartRoute / directGenerate / callApi。
    // [潜在风险] Fast 模式的加速幅度会比轻量模型方案更温和，但换来跨端一致性与更低回归风险。
    // ==============================================================

    private const val DEFAULT_ENHANCE_MODE = "fast"

    // 输入长度限制（与 VSCode core/api.js 保持一致）
    private const val MAX_INPUT_LENGTH = 10000

    // 重试配置
    private const val MAX_RETRIES = 3
    private val RETRY_DELAYS = longArrayOf(2000, 4000, 8000) // 指数退避：2s, 4s, 8s

    /** 4 种 API 模式 */
    val API_MODES = mapOf(
        "openai" to "OpenAI Chat Completions",
        "openai-responses" to "OpenAI Responses API",
        "claude" to "Claude API",
        "gemini" to "Google Gemini API"
    )

    /** 各模式默认路径 */
    val DEFAULT_API_PATHS = mapOf(
        "openai" to "/v1/chat/completions",
        "openai-responses" to "/v1/responses",
        "claude" to "/v1/messages",
        "gemini" to "/v1beta"
    )

    /**
     * 从 URL 自动检测 API 模式（向后兼容用）
     */
    fun detectApiMode(url: String): String {
        val lower = url.trimEnd('/').lowercase()
        return when {
            lower.endsWith("/responses") -> "openai-responses"
            lower.contains("anthropic") || lower.contains("/v1/messages") || lower.endsWith("/messages") -> "claude"
            lower.contains("generativelanguage.googleapis.com") || lower.contains("/v1beta") || lower.contains("/v1alpha") -> "gemini"
            else -> "openai"
        }
    }

    /**
     * 判断错误是否值得重试
     */
    private fun isRetryableError(msg: String): Boolean {
        val lower = msg.lowercase()
        val patterns = listOf(
            "cpu overloaded", "overloaded", "503", "529", "502",
            "bad gateway", "service unavailable", "temporarily unavailable",
            "server_error", "internal_error",
            "econnreset", "etimedout", "socket hang up", "connection reset",
            "请求超时", "rate limit", "rate_limit", "429", "too many requests",
            "upstream request failed"
        )
        return patterns.any { lower.contains(it) }
    }

    /**
     * 判断是否应尝试从 openai-responses 回退到 /chat/completions
     * 仅当 apiMode 为 openai-responses 且错误为上游请求失败时触发
     */
    private fun shouldTryResponsesFallback(errorMsg: String, apiMode: String): Boolean {
        return apiMode == "openai-responses" &&
            errorMsg.contains("upstream request failed", ignoreCase = true)
    }

    /**
     * 从 baseUrl 中剥离末尾的 API 端点路径
     * 用于 openai-responses → openai 回退时构建 /chat/completions URL
     */
    private fun stripApiEndpoint(baseUrl: String): String {
        return baseUrl.trimEnd('/')
            .replace(Regex("/responses$", RegexOption.IGNORE_CASE), "")
            .replace(Regex("/chat/completions$", RegexOption.IGNORE_CASE), "")
            .replace(Regex("/messages$", RegexOption.IGNORE_CASE), "")
    }

    /**
     * 友好化错误消息 — 将技术错误转换为用户可理解的中文提示
     */
    fun friendlyError(errorMsg: String, model: String = ""): String {
        val msg = errorMsg.lowercase()

        // 服务端过载/不可用
        if (msg.contains("cpu overloaded") || msg.contains("overloaded"))
            return "⚡ API 服务器繁忙（CPU 过载）· 当前使用人数过多，请等待 10-30 秒后重试"
        if (msg.contains("503") || msg.contains("service unavailable") || msg.contains("temporarily unavailable"))
            return "🔧 API 服务暂时不可用（503）· 服务器维护或临时故障，请等待几分钟后重试"
        if (msg.contains("502") || msg.contains("bad gateway"))
            return "🌐 API 网关错误（502）· 中转服务器连接问题，请稍后重试"
        if (msg.contains("529"))
            return "🔥 API 服务器过载（529）· 请求量过大，请等待 30 秒后重试"
        if (msg.contains("server_error") || msg.contains("internal_error") || msg.contains("500") || msg.contains("internal server error"))
            return "🛠️ API 服务器内部错误 · 服务端临时故障，请稍后重试"

        // 认证/授权错误
        if (msg.contains("401") || msg.contains("unauthorized") || msg.contains("incorrect api key") || msg.contains("invalid api key") || msg.contains("authentication"))
            return "🔑 API Key 无效或已过期 · 请在设置中检查 API Key 是否正确"
        if (msg.contains("403") || msg.contains("forbidden"))
            return "🚫 API 访问被拒绝（403）· Key 权限不足或 IP 被限制，请检查配置"

        // 频率限制
        if (msg.contains("429") || msg.contains("rate limit") || msg.contains("too many requests"))
            return "⏳ API 请求频率超限（429）· 请等待 30-60 秒后重试"

        // 模型错误
        if (msg.contains("model") && (msg.contains("does not exist") || msg.contains("not found") || msg.contains("not available")))
            return "🤖 模型 \"$model\" 不可用 · 请在设置中检查模型名称是否正确"

        // 额度/配额
        if (msg.contains("quota") || msg.contains("insufficient") || msg.contains("billing") || msg.contains("payment")) {
            // 尝试从错误消息中提取金额信息（如 "remain quota: $0.014000, need quota: $0.096000"）
            val remainMatch = Regex("""remain[^$]*\$([0-9.]+)""", RegexOption.IGNORE_CASE).find(errorMsg)
            val needMatch = Regex("""need[^$]*\$([0-9.]+)""", RegexOption.IGNORE_CASE).find(errorMsg)
            if (remainMatch != null && needMatch != null) {
                val remain = "%.2f".format(remainMatch.groupValues[1].toDoubleOrNull() ?: 0.0)
                val need = "%.2f".format(needMatch.groupValues[1].toDoubleOrNull() ?: 0.0)
                return "💰 API 额度不足（剩余 $$remain，需要 $$need）· 请在设置中配置您自己的 API Key，或为当前 Key 充值"
            }
            return "💰 API 额度不足 · 请在设置中配置您自己的 API Key，或检查当前账户余额"
        }

        // 网络连接问题
        if (msg.contains("unknownhostexception") || msg.contains("could not resolve host") || msg.contains("dns"))
            return "🌐 无法连接到 API 服务器 · 请检查网络连接和 VPN/代理设置"
        if (msg.contains("connection refused") || msg.contains("connectexception"))
            return "🔌 连接被拒绝 · 请检查 API Base URL 是否正确"
        if (msg.contains("timeout") || msg.contains("timed out") || msg.contains("sockettimeoutexception") || msg.contains("请求超时"))
            return "⏱️ API 请求超时 · 请检查网络连接，或缩短输入文本后重试"
        if (msg.contains("connection reset") || msg.contains("socket hang up"))
            return "🔄 连接被重置 · 网络不稳定，请稍后重试"
        if (msg.contains("ssl") || msg.contains("certificate") || msg.contains("cert"))
            return "🔒 SSL/TLS 证书错误 · 请检查系统时间和代理证书配置"

        // 响应解析错误
        if (msg.contains("json") || msg.contains("解析"))
            return "📋 API 返回格式错误 · 请检查 Base URL 是否正确"

        // 输入相关
        if (msg.contains("过长") || msg.contains("too long") || msg.contains("max"))
            return "📏 输入文本过长 · 最大支持 $MAX_INPUT_LENGTH 字符，请缩短后重试"
        if (msg.contains("返回为空") || msg.contains("empty"))
            return "📭 API 返回结果为空 · 请修改输入内容后重试"

        // 上游请求失败（Responses API 中转错误）
        if (msg.contains("upstream request failed"))
            return "🔄 上游模型服务暂时不可用 · 请稍后重试，或在设置中切换 API 模式/模型"

        // 兜底
        return "❌ API 调用出错: $errorMsg · 请检查网络和 API 配置后重试"
    }

    /**
     * 获取有效配置（用户自定义优先，否则使用内置默认）
     */
    private fun getEffectiveConfig(): EffectiveConfig {
        val settingsInstance = EasyPromptSettings.getInstance()
        val state = settingsInstance.state
        val userApiKey = settingsInstance.getApiKey()
        return if (userApiKey.isNotBlank()) {
            // 用户配置了自定义 Key，使用用户的全套配置
            // 优先使用新版 apiHost + apiPath，兼容旧版 apiBaseUrl
            val baseUrl = if (state.apiHost.isNotBlank()) {
                (state.apiHost.trimEnd('/') + state.apiPath).trimEnd('/')
            } else if (state.apiBaseUrl.isNotBlank()) {
                state.apiBaseUrl.trimEnd('/')
            } else {
                "https://vpsairobot.com/v1/chat/completions"
            }
            val model = state.model.ifBlank { "gpt-5.4" }
            val apiMode = state.apiMode.ifBlank { detectApiMode(baseUrl) }

            // 格式验证（与 VSCode getConfig 一致）
            if (!baseUrl.matches(Regex("^https?://.*"))) {
                throw RuntimeException("API Host 格式错误：必须以 http:// 或 https:// 开头")
            }

            EffectiveConfig(
                baseUrl,
                userApiKey,
                model,
                apiMode,
                state.enhanceMode.ifBlank { DEFAULT_ENHANCE_MODE }
            )
        } else {
            // 使用内置默认配置
            val defaults = BuiltinDefaults.getDefaults()
            val baseUrl = defaults.baseUrl.trimEnd('/')
            EffectiveConfig(
                baseUrl,
                defaults.apiKey,
                defaults.model,
                detectApiMode(baseUrl),
                state.enhanceMode.ifBlank { DEFAULT_ENHANCE_MODE }
            )
        }
    }

    private data class GenerationPlan(
        val temperature: Double,
        val maxTokens: Int,
        val timeout: Int
    )

    private fun buildGenerationPlan(baseConfig: EffectiveConfig, isComposite: Boolean): GenerationPlan {
        return if (baseConfig.enhanceMode == "deep") {
            GenerationPlan(
                temperature = 0.7,
                maxTokens = if (isComposite) 8192 else 4096,
                timeout = 120000
            )
        } else {
            GenerationPlan(
                temperature = 0.5,
                maxTokens = if (isComposite) 4096 else 2048,
                timeout = 60000
            )
        }
    }

    private fun decorateGenerationPrompt(systemPrompt: String, baseConfig: EffectiveConfig): String {
        val modeHint = if (baseConfig.enhanceMode == "deep") {
            "\n\n[增强模式: Deep]\n请优先保证完整性，补充关键边界条件、风险提示、验证步骤与输出结构，允许结果更充分展开。"
        } else {
            "\n\n[增强模式: Fast]\n请在保证专业度与可执行性的前提下，优先输出更精炼、更直接的 Prompt，避免不必要的铺陈和重复说明。"
        }
        return systemPrompt + modeHint
    }

    /**
     * 执行单次 API 调用（无重试），支持 4 种 API 模式
     */
    private fun callApiOnce(
        systemPrompt: String,
        userMessage: String,
        temperature: Double = 0.7,
        maxTokens: Int = 4096,
        timeout: Int = 60000,
        indicator: ProgressIndicator? = null,
        configOverride: EffectiveConfig? = null
    ): String {
        val cfg = configOverride ?: getEffectiveConfig()
        val mode = cfg.apiMode

        // ── URL 构建 ──
        val url = when (mode) {
            "gemini" -> {
                val encodedModel = URLEncoder.encode(cfg.model, "UTF-8")
                val encodedKey = URLEncoder.encode(cfg.apiKey, "UTF-8")
                URI("${cfg.baseUrl}/models/$encodedModel:generateContent?key=$encodedKey").toURL()
            }
            "openai-responses" -> {
                val base = cfg.baseUrl
                if (base.endsWith("/responses")) URI(base).toURL()
                else URI("$base/responses").toURL()
            }
            "claude" -> {
                val base = cfg.baseUrl
                if (base.endsWith("/messages")) URI(base).toURL()
                else URI("$base/messages").toURL()
            }
            else -> /* openai */ {
                val base = cfg.baseUrl
                if (base.endsWith("/chat/completions")) URI(base).toURL()
                else URI("$base/chat/completions").toURL()
            }
        }

        // ── 请求体构建 ──
        val body = when (mode) {
            "openai-responses" -> JsonObject().apply {
                addProperty("model", cfg.model)
                addProperty("instructions", systemPrompt)
                addProperty("input", userMessage)
                addProperty("temperature", temperature)
                addProperty("max_output_tokens", maxTokens)
            }
            "claude" -> JsonObject().apply {
                addProperty("model", cfg.model)
                addProperty("system", systemPrompt)
                add("messages", gson.toJsonTree(listOf(
                    mapOf("role" to "user", "content" to userMessage)
                )))
                addProperty("max_tokens", maxTokens)
                addProperty("temperature", temperature)
            }
            "gemini" -> JsonObject().apply {
                add("contents", gson.toJsonTree(listOf(
                    mapOf("role" to "user", "parts" to listOf(mapOf("text" to userMessage)))
                )))
                if (systemPrompt.isNotBlank()) {
                    add("systemInstruction", gson.toJsonTree(
                        mapOf("parts" to listOf(mapOf("text" to systemPrompt)))
                    ))
                }
                add("generationConfig", gson.toJsonTree(mapOf(
                    "temperature" to temperature,
                    "maxOutputTokens" to maxTokens
                )))
            }
            else -> /* openai */ JsonObject().apply {
                addProperty("model", cfg.model)
                add("messages", gson.toJsonTree(listOf(
                    mapOf("role" to "system", "content" to systemPrompt),
                    mapOf("role" to "user", "content" to userMessage)
                )))
                addProperty("temperature", temperature)
                addProperty("max_tokens", maxTokens)
            }
        }

        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")

            // ── Headers ──
            when (mode) {
                "claude" -> {
                    conn.setRequestProperty("x-api-key", cfg.apiKey)
                    conn.setRequestProperty("anthropic-version", "2023-06-01")
                }
                "gemini" -> { /* key in URL, no auth header */ }
                else -> conn.setRequestProperty("Authorization", "Bearer ${cfg.apiKey}")
            }

            conn.connectTimeout = timeout
            conn.readTimeout = timeout
            conn.doOutput = true

            // 写入请求体前检查取消
            if (indicator?.isCanceled == true) {
                throw RuntimeException("已取消")
            }
            conn.outputStream.write(body.toString().toByteArray())

            // 等待响应前检查取消
            if (indicator?.isCanceled == true) {
                throw RuntimeException("已取消")
            }

            val responseCode = conn.responseCode
            // 安全限制：响应体最大 2MB，错误体最大 2MB
            val maxSize = 2 * 1024 * 1024
            val responseBody = if (responseCode in 200..299) {
                // 流式读取，超过限制立即中断，防止 OOM
                val reader = conn.inputStream.bufferedReader()
                val sb = StringBuilder()
                val buf = CharArray(8192)
                var totalRead = 0
                while (true) {
                    if (indicator?.isCanceled == true) {
                        reader.close()
                        throw RuntimeException("已取消")
                    }
                    val n = reader.read(buf)
                    if (n == -1) break
                    totalRead += n
                    if (totalRead > maxSize) {
                        reader.close()
                        throw RuntimeException("响应体过大（超过 2MB），已中断")
                    }
                    sb.append(buf, 0, n)
                }
                sb.toString()
            } else {
                // 错误响应体也做大小限制（防止异常服务器返回超大错误体导致 OOM）
                val errorBody = try {
                    val errStream = conn.errorStream
                    if (errStream != null) {
                        val errReader = errStream.bufferedReader()
                        val errBuf = CharArray(8192)
                        val errSb = StringBuilder()
                        var errTotal = 0
                        while (true) {
                            val n = errReader.read(errBuf)
                            if (n == -1) break
                            errTotal += n
                            if (errTotal > maxSize) break  // 截断，不抛异常
                            errSb.append(errBuf, 0, n)
                        }
                        errReader.close()
                        errSb.toString()
                    } else "Unknown error"
                } catch (_: Exception) { "Unknown error" }
                // 尝试从 JSON 错误体中提取 error.message（更友好的错误信息）
                val errorMsg = try {
                    val errJson = gson.fromJson(errorBody, JsonObject::class.java)
                    errJson.getAsJsonObject("error")?.get("message")?.asString ?: errorBody
                } catch (_: Exception) { errorBody }
                throw RuntimeException("API 错误 ($responseCode): $errorMsg")
            }

            val json = gson.fromJson(responseBody, JsonObject::class.java)

            // ── 按模式解析响应 ──
            return when (mode) {
                "openai-responses" -> {
                    val outputArray = json.getAsJsonArray("output")
                    val msgOutput = outputArray?.firstOrNull {
                        it.asJsonObject?.get("type")?.asString == "message"
                    }?.asJsonObject
                    val content = msgOutput?.getAsJsonArray("content")
                        ?.firstOrNull { it.asJsonObject?.get("type")?.asString == "output_text" }
                        ?.asJsonObject?.get("text")?.asString
                    content ?: throw RuntimeException("API 返回为空")
                }
                "claude" -> {
                    json.getAsJsonArray("content")
                        ?.get(0)?.asJsonObject
                        ?.get("text")?.asString
                        ?: throw RuntimeException("API 返回为空")
                }
                "gemini" -> {
                    json.getAsJsonArray("candidates")
                        ?.get(0)?.asJsonObject
                        ?.getAsJsonObject("content")
                        ?.getAsJsonArray("parts")
                        ?.get(0)?.asJsonObject
                        ?.get("text")?.asString
                        ?: throw RuntimeException("API 返回为空")
                }
                else -> /* openai */ {
                    json.getAsJsonArray("choices")
                        ?.get(0)?.asJsonObject
                        ?.getAsJsonObject("message")
                        ?.get("content")?.asString
                        ?: throw RuntimeException("API 返回为空")
                }
            }
        } finally {
            conn.disconnect()
        }
    }

    /**
     * 调用 OpenAI 兼容 API（带自动重试）
     */
    fun callApi(
        systemPrompt: String,
        userMessage: String,
        temperature: Double = 0.7,
        maxTokens: Int = 4096,
        timeout: Int = 60000,
        onRetry: ((Int, String) -> Unit)? = null,
        indicator: ProgressIndicator? = null,
        configOverride: EffectiveConfig? = null
    ): String {
        // 输入长度检查
        if (userMessage.length > MAX_INPUT_LENGTH) {
            throw RuntimeException("输入文本过长（${userMessage.length} 字符），最大支持 $MAX_INPUT_LENGTH 字符")
        }

        var lastError: Exception? = null
        val baseConfig = configOverride ?: getEffectiveConfig()

        for (attempt in 0..MAX_RETRIES) {
            if (indicator?.isCanceled == true) {
                throw RuntimeException("已取消")
            }
            try {
                return callApiOnce(
                    systemPrompt,
                    userMessage,
                    temperature,
                    maxTokens,
                    timeout,
                    indicator,
                    baseConfig
                )
            } catch (e: Exception) {
                var effectiveError = e
                val errorMsg = e.message ?: "Unknown error"

                // 用户取消 — 直接抛出，不重试
                if (errorMsg == "已取消" || indicator?.isCanceled == true) {
                    throw RuntimeException("已取消")
                }

                // openai-responses 模式遇到 upstream request failed → 自动回退到 /chat/completions
                if (shouldTryResponsesFallback(errorMsg, baseConfig.apiMode)) {
                    try {
                        val fallbackConfig = baseConfig.copy(
                            apiMode = "openai",
                            baseUrl = stripApiEndpoint(baseConfig.baseUrl)
                        )
                        return callApiOnce(systemPrompt, userMessage, temperature, maxTokens, timeout, indicator, fallbackConfig)
                    } catch (fallbackErr: Exception) {
                        effectiveError = fallbackErr
                    }
                }

                lastError = effectiveError
                val effectiveMsg = effectiveError.message ?: "Unknown error"

                // 非重试类错误直接抛出（如 401, 403, 模型不存在等）
                if (!isRetryableError(effectiveMsg)) {
                    throw RuntimeException(friendlyError(effectiveMsg, baseConfig.model))
                }

                // 最后一次重试失败
                if (attempt >= MAX_RETRIES) break

                // 重试提示
                val delayMs = RETRY_DELAYS.getOrElse(attempt) { 8000 }
                onRetry?.invoke(attempt + 1, "⚠️ 遇到临时错误，${delayMs / 1000} 秒后第 ${attempt + 2} 次尝试...")

                Thread.sleep(delayMs)
            }
        }

        // 所有重试都失败
        throw RuntimeException(friendlyError(lastError?.message ?: "Unknown error", baseConfig.model))
    }

    /**
     * 解析路由器返回的 JSON
     */
    fun parseRouterResult(text: String): RouterResult {
        return try {
            val clean = text.trim()
            val jsonStr = if (clean.startsWith("{")) {
                clean
            } else {
                // 与 VSCode router.js parseRouterResult 保持一致的 3 种 fallback 正则
                val patterns = listOf(
                    Regex("""```json\s*\n?([\s\S]*?)\s*\n?```"""),
                    Regex("""```\s*\n?([\s\S]*?)\s*\n?```"""),
                    Regex("""(\{\s*"scenes"\s*:[\s\S]*?\})""")
                )
                var extracted: String? = null
                for (pattern in patterns) {
                    val match = pattern.find(clean)
                    if (match != null) {
                        val candidate = match.groupValues[1].trim()
                        try {
                            gson.fromJson(candidate, JsonObject::class.java)
                            extracted = candidate
                            break
                        } catch (_: Exception) {
                            continue
                        }
                    }
                }
                extracted ?: """{"scenes":["optimize"],"composite":false}"""
            }
            val json = gson.fromJson(jsonStr, JsonObject::class.java)
            val scenes = json.getAsJsonArray("scenes")?.map { it.asString } ?: listOf("optimize")
            // 过滤无效场景、截断最多 5 个
            val validScenes = scenes.filter { Scenes.all.containsKey(it) }.take(5).ifEmpty { listOf("optimize") }
            // 规范化 composite：支持字符串 "true"/"false"，单场景时强制 false
            val compositeRaw = json.get("composite")
            val composite = when {
                compositeRaw == null -> false
                compositeRaw.isJsonPrimitive && compositeRaw.asJsonPrimitive.isBoolean -> compositeRaw.asBoolean
                compositeRaw.isJsonPrimitive && compositeRaw.asJsonPrimitive.isString -> compositeRaw.asString.lowercase() == "true"
                else -> false
            }
            RouterResult(validScenes, composite && validScenes.size > 1)
        } catch (e: Exception) {
            RouterResult(listOf("optimize"), false)
        }
    }

    /**
     * 检查输入文本是否适合进行 Prompt 增强
     * 过滤空内容、过短文本、重复字符、纯数字、纯 URL / 邮箱 / 文件路径等无意义输入
     */
    fun isValidInput(text: String?): Boolean {
        if (text.isNullOrBlank()) return false
        val trimmed = text.trim()
        if (trimmed.length < 2) return false

        // 有效字符：字母 + 数字
        val meaningful = trimmed.replace(Regex("[^\\p{L}\\p{N}]"), "")
        if (meaningful.length < 2) return false

        // 必须包含至少 1 个字母字符（拒绝纯数字）
        if (!trimmed.contains(Regex("\\p{L}"))) return false

        // 拒绝单一字符重复
        val uniqueChars = meaningful.lowercase().toSet()
        if (uniqueChars.size < 2) return false

        // 拒绝纯 URL
        if (trimmed.matches(Regex("^\\s*(https?://\\S+|ftp://\\S+|www\\.\\S+)\\s*$", RegexOption.IGNORE_CASE))) return false

        // 拒绝纯邮箱
        if (trimmed.matches(Regex("^\\s*[\\w.+\\-]+@[\\w.\\-]+\\.\\w{2,}\\s*$", RegexOption.IGNORE_CASE))) return false

        // 拒绝纯文件路径
        if (trimmed.matches(Regex("^\\s*(/[\\w.@\\-]+){2,}\\s*$")) ||
            trimmed.matches(Regex("^\\s*[A-Z]:\\\\[\\w\\\\.~\\-]+\\s*$", RegexOption.IGNORE_CASE))) return false

        return true
    }

    /**
     * 两步智能路由
     */
    fun smartRoute(userInput: String, onProgress: ((String) -> Unit)? = null, indicator: ProgressIndicator? = null): SmartRouteResult {
        if (!isValidInput(userInput)) {
            throw IllegalArgumentException("输入内容无效，请输入有意义的文本内容")
        }

        val effectiveConfig = getEffectiveConfig()

        onProgress?.invoke("🔍 正在识别意图...")

        val onRetry: ((Int, String) -> Unit)? = onProgress?.let { progress ->
            { _: Int, msg: String -> progress(msg) }
        }

        // 第一步：意图识别
        val routerPrompt = Router.buildRouterPrompt()
        val routerText = callApi(
            routerPrompt,
            userInput,
            temperature = 0.1,
            maxTokens = 500,
            timeout = 30000,
            onRetry = onRetry,
            indicator = indicator,
            configOverride = effectiveConfig
        )
        val routerResult = parseRouterResult(routerText)

        val sceneLabels = routerResult.scenes.map { Scenes.nameMap[it] ?: it }
        val label = if (routerResult.composite) "复合：${sceneLabels.joinToString(" + ")}" else sceneLabels.first()
        onProgress?.invoke("✍️ 意图识别完成 → $label，正在生成...")

        // 第二步：生成
        val genPrompt = Router.buildGenerationPrompt(routerResult)
        val generationPlan = buildGenerationPlan(effectiveConfig, routerResult.composite)
        val result = callApi(
            decorateGenerationPrompt(genPrompt, effectiveConfig),
            userInput,
            temperature = generationPlan.temperature,
            maxTokens = generationPlan.maxTokens,
            timeout = generationPlan.timeout,
            onRetry = onRetry,
            indicator = indicator,
            configOverride = effectiveConfig
        )

        return SmartRouteResult(result, routerResult.scenes, routerResult.composite)
    }

    /**
     * 指定场景直接生成（跳过路由）
     */
    fun directGenerate(userInput: String, sceneId: String, onProgress: ((String) -> Unit)? = null, indicator: ProgressIndicator? = null): String {
        val sceneName = Scenes.nameMap[sceneId] ?: sceneId
        val effectiveConfig = getEffectiveConfig()
        onProgress?.invoke("✍️ 使用「${sceneName}」场景生成 Prompt...")

        val onRetry: ((Int, String) -> Unit)? = onProgress?.let { progress ->
            { _: Int, msg: String -> progress(msg) }
        }

        val routerResult = RouterResult(listOf(sceneId), false)
        val genPrompt = Router.buildGenerationPrompt(routerResult)
        val generationPlan = buildGenerationPlan(effectiveConfig, false)
        return callApi(
            decorateGenerationPrompt(genPrompt, effectiveConfig),
            userInput,
            temperature = generationPlan.temperature,
            maxTokens = generationPlan.maxTokens,
            timeout = generationPlan.timeout,
            onRetry = onRetry,
            indicator = indicator,
            configOverride = effectiveConfig
        )
    }

    /**
     * 测试 API 配置是否可用（支持 4 种 API 模式）
     * @return Triple(ok, message, latencyMs)
     */
    fun testApiConfig(baseUrl: String, apiKey: String, model: String, apiMode: String = ""): Triple<Boolean, String, Long> {
        if (apiKey.isBlank()) {
            return Triple(false, "API Key 不能为空", 0)
        }
        if (baseUrl.isBlank()) {
            return Triple(false, "API Host 不能为空", 0)
        }

        val mode = apiMode.ifBlank { detectApiMode(baseUrl) }
        val effectiveModel = model.ifBlank { "gpt-5.4" }

        // ── URL 构建（与 callApiOnce 一致，含 endpoint 自动补全） ──
        val url = when (mode) {
            "gemini" -> {
                val encodedModel = URLEncoder.encode(effectiveModel, "UTF-8")
                val encodedKey = URLEncoder.encode(apiKey, "UTF-8")
                URI("$baseUrl/models/$encodedModel:generateContent?key=$encodedKey").toURL()
            }
            "openai-responses" -> {
                if (baseUrl.endsWith("/responses")) URI(baseUrl).toURL()
                else URI("$baseUrl/responses").toURL()
            }
            "claude" -> {
                if (baseUrl.endsWith("/messages")) URI(baseUrl).toURL()
                else URI("$baseUrl/messages").toURL()
            }
            else -> {
                if (baseUrl.endsWith("/chat/completions")) URI(baseUrl).toURL()
                else URI("$baseUrl/chat/completions").toURL()
            }
        }

        // ── 请求体构建 ──
        val body = when (mode) {
            "openai-responses" -> JsonObject().apply {
                addProperty("model", effectiveModel)
                addProperty("instructions", "Reply OK")
                addProperty("input", "test")
                addProperty("temperature", 0)
                addProperty("max_output_tokens", 5)
            }
            "claude" -> JsonObject().apply {
                addProperty("model", effectiveModel)
                addProperty("system", "Reply OK")
                add("messages", gson.toJsonTree(listOf(
                    mapOf("role" to "user", "content" to "test")
                )))
                addProperty("max_tokens", 5)
                addProperty("temperature", 0)
            }
            "gemini" -> JsonObject().apply {
                add("contents", gson.toJsonTree(listOf(
                    mapOf("role" to "user", "parts" to listOf(mapOf("text" to "test")))
                )))
                add("systemInstruction", gson.toJsonTree(
                    mapOf("parts" to listOf(mapOf("text" to "Reply OK")))
                ))
                add("generationConfig", gson.toJsonTree(mapOf(
                    "temperature" to 0,
                    "maxOutputTokens" to 5
                )))
            }
            else -> /* openai */ JsonObject().apply {
                addProperty("model", effectiveModel)
                add("messages", gson.toJsonTree(listOf(
                    mapOf("role" to "system", "content" to "Reply OK"),
                    mapOf("role" to "user", "content" to "test")
                )))
                addProperty("temperature", 0)
                addProperty("max_tokens", 5)
            }
        }

        val startTime = System.currentTimeMillis()
        return try {
            val conn = url.openConnection() as HttpURLConnection
            try {
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")

                // ── Headers ──
                when (mode) {
                    "claude" -> {
                        conn.setRequestProperty("x-api-key", apiKey)
                        conn.setRequestProperty("anthropic-version", "2023-06-01")
                    }
                    "gemini" -> { /* key in URL */ }
                    else -> conn.setRequestProperty("Authorization", "Bearer $apiKey")
                }

                conn.connectTimeout = 15000
                conn.readTimeout = 15000
                conn.doOutput = true
                conn.outputStream.write(body.toString().toByteArray())

                val responseCode = conn.responseCode
                val latency = System.currentTimeMillis() - startTime

                if (responseCode in 200..299) {
                    val modeLabel = API_MODES[mode] ?: mode
                    Triple(true, "连接成功 · 延迟 ${latency}ms · 模式: $modeLabel · 模型: $effectiveModel", latency)
                } else {
                    // 错误响应体做大小限制（与 callApiOnce 一致）
                    val errorBody = try {
                        val errStream = conn.errorStream
                        if (errStream != null) {
                            val errReader = errStream.bufferedReader()
                            val errBuf = CharArray(4096)
                            val errSb = StringBuilder()
                            var errTotal = 0
                            val errMaxSize = 64 * 1024 // 测试接口错误体限制 64KB 即可
                            while (true) {
                                val n = errReader.read(errBuf)
                                if (n == -1) break
                                errTotal += n
                                if (errTotal > errMaxSize) break
                                errSb.append(errBuf, 0, n)
                            }
                            errReader.close()
                            errSb.toString()
                        } else "Unknown error"
                    } catch (_: Exception) { "Unknown error" }
                    val msg = when (responseCode) {
                        401 -> "API Key 无效 · 请检查你的 Key 是否正确"
                        403 -> "访问被拒绝 · Key 可能没有权限"
                        404 -> "接口地址不存在 · 请检查 API Host/Path 是否正确"
                        429 -> "请求过于频繁 · 请稍后再试"
                        in 500..599 -> "服务端错误 ($responseCode) · 请稍后再试"
                        else -> "HTTP $responseCode · $errorBody"
                    }
                    Triple(false, msg, latency)
                }
            } finally {
                conn.disconnect()
            }
        } catch (e: java.net.SocketTimeoutException) {
            Triple(false, "连接超时 · 请检查网络或 API Host 是否正确", System.currentTimeMillis() - startTime)
        } catch (e: java.net.UnknownHostException) {
            Triple(false, "域名解析失败 · 请检查 API Host 是否正确", System.currentTimeMillis() - startTime)
        } catch (e: java.net.ConnectException) {
            Triple(false, "无法连接到服务器 · 请检查网络和 API Host", System.currentTimeMillis() - startTime)
        } catch (e: Exception) {
            Triple(false, "测试失败: ${e.message}", System.currentTimeMillis() - startTime)
        }
    }

    /* ═══════════════════════════════════════════════════
       Backend API Client (backend-only mode)
       2026-04-08 P2.13 新增，2026-04-09 架构重构
       设计思路：所有增强请求统一走后端 API（api.zhiz.chat），
         后端做中间转接层（记录信息 + 管理 API Key + 内部转发）。
         客户端不再持有 Provider Key，不再有本地直连回退。
       影响范围：smartRoute / directGenerate 调用入口
       潜在风险：无已知风险
       ═══════════════════════════════════════════════════ */

    private const val BACKEND_API_BASE = "https://api.zhiz.chat"
    // 2026-04-10 修复
    // 变更类型：修复
    // 功能描述：将 IntelliJ 端后端增强请求超时从 30s 提升到 90s，避免两步增强尚未完成时客户端先报超时
    // 设计思路：backend /api/v1/ai/enhance 已拆为 routing + generation 两阶段；为避免与浏览器插件/Web 端产生不一致的超时行为，需要统一客户端等待窗口
    // 参数与返回值：BACKEND_TIMEOUT_MS 仅控制 callBackendEnhance 的 HttpURLConnection connect/read timeout，不改变请求参数或返回值
    // 影响范围：IntelliJ 插件 smartRoute / directGenerate / 后端增强链路
    // 潜在风险：无已知风险
    private const val BACKEND_TIMEOUT_MS = 90000

    /** 后端增强结果 */
    data class BackendEnhanceResult(
        val result: String,
        val scenes: List<String>,
        val composite: Boolean,
        val source: String,
        val requestId: String
    )

    /**
     * 生成 UUID v4（用于 requestId 透传 — P2.14）
     */
    fun generateRequestId(): String = java.util.UUID.randomUUID().toString()

    /**
     * 后端错误码 → 用户友好中文提示
     * 2026-04-09 更新：移除“回退到本地模式”提示（本地模式已废弃）
     */
    private val BACKEND_ERROR_MAP = mapOf(
        "AI_PROVIDER_ERROR" to "AI 服务暂时不可用，请稍后重试",
        "AI_TIMEOUT" to "AI 服务响应超时，请稍后重试",
        "RATE_LIMIT_EXCEEDED" to "请求过于频繁，请稍后再试",
        "AUTH_TOKEN_EXPIRED" to "登录已过期，请重新登录",
        "VALIDATION_FAILED" to "请求参数有误",
        "BLACKLISTED" to "您的访问已被限制，请联系管理员"
    )

    private fun mapBackendError(code: String, default: String): String =
        BACKEND_ERROR_MAP[code] ?: default.ifBlank { "后端服务异常" }

    /**
     * 调用后端 AI 增强 API（JVM HttpURLConnection 实现）
     * @param input 用户输入
     * @param enhanceMode fast/deep
     * @param model 模型名称
     * @param indicator 进度指示器（用于取消检测）
     * @return BackendEnhanceResult
     */
    // ========================== 变更记录 ==========================
    // [日期]     2026-04-10
    // [类型]     修改
    // [描述]     B7a+B8: 从手动 backendToken 切换为 SSO token + 401 自动刷新重试
    // [思路]     读取 SsoAuthClient.getAccessToken()，401 时尝试 refreshToken 并重试一次
    // [影响范围] callBackendEnhance → 所有后端 API 调用
    // [潜在风险] 无已知风险
    // ==============================================================

    fun callBackendEnhance(
        input: String,
        enhanceMode: String = "fast",
        model: String = "",
        indicator: ProgressIndicator? = null
    ): BackendEnhanceResult {
        val requestId = generateRequestId()

        // 内部请求函数（支持 token 覆写用于 401 重试）
        fun doRequest(tokenOverride: String? = null): Pair<Int, String> {
            val postBody = JsonObject().apply {
                addProperty("input", input)
                addProperty("enhanceMode", enhanceMode)
                addProperty("model", model)
                addProperty("language", "zh-CN")
                addProperty("clientType", "intellij")
            }

            val url = URI("$BACKEND_API_BASE/api/v1/ai/enhance").toURL()
            val conn = url.openConnection() as HttpURLConnection
            try {
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("X-Request-Id", requestId)
                // 2026-04-10 B7a: SSO Bearer Token（从 PasswordSafe 读取）
                val token = tokenOverride ?: SsoAuthClient.getAccessToken()
                if (!token.isNullOrBlank()) {
                    conn.setRequestProperty("Authorization", "Bearer $token")
                }
                conn.connectTimeout = BACKEND_TIMEOUT_MS
                conn.readTimeout = BACKEND_TIMEOUT_MS
                conn.doOutput = true

                if (indicator?.isCanceled == true) throw RuntimeException("已取消")
                conn.outputStream.write(postBody.toString().toByteArray())
                if (indicator?.isCanceled == true) throw RuntimeException("已取消")

                val responseCode = conn.responseCode
                val responseBody = if (responseCode in 200..299) {
                    conn.inputStream.bufferedReader().readText()
                } else {
                    val errBody = try {
                        conn.errorStream?.bufferedReader()?.readText() ?: "Unknown error"
                    } catch (_: Exception) { "Unknown error" }
                    errBody
                }
                return Pair(responseCode, responseBody)
            } finally {
                conn.disconnect()
            }
        }

        // 第一次请求
        var (responseCode, responseBody) = doRequest()

        // 2026-04-10 B8: 401 自动刷新重试（仅一次）
        if (responseCode == 401) {
            val newToken = SsoAuthClient.refreshToken()
            if (newToken != null) {
                val retry = doRequest(newToken)
                responseCode = retry.first
                responseBody = retry.second
            } else {
                // 2026-04-10 修复 — SSO 全端审计 P1-2
                // refresh 失败 → 提示用户重新登录，而非显示原始 HTTP 401 错误
                throw RuntimeException("登录已过期，请通过「Easy Prompt: 登录」重新登录")
            }
        }

        // 2026-04-10 新增 — SSO 全端审计 P1-3
        // 429 退避重试（最多 2 次，间隔 2s/4s）
        // 设计思路：后端 AI 端 429 是暂态错误，短暂等待后通常可成功
        // 影响范围：callBackendEnhance 429 场景
        // 潜在风险：无已知风险（最多额外等待 6s）
        if (responseCode == 429) {
            val retryDelays = longArrayOf(2000, 4000)
            for (delay in retryDelays) {
                if (indicator?.isCanceled == true) throw RuntimeException("已取消")
                Thread.sleep(delay)
                if (indicator?.isCanceled == true) throw RuntimeException("已取消")
                val retry = doRequest()
                responseCode = retry.first
                responseBody = retry.second
                if (responseCode != 429) break
            }
        }

        // 非 2xx → 抛异常
        if (responseCode !in 200..299) {
            throw RuntimeException("Backend HTTP $responseCode: $responseBody")
        }

        val data = gson.fromJson(responseBody, JsonObject::class.java)
        val success = data.get("success")?.asBoolean ?: false

        if (!success) {
            val errObj = data.getAsJsonObject("error")
            val errCode = errObj?.get("code")?.asString ?: "UNKNOWN"
            val errMsg = errObj?.get("message")?.asString ?: "Backend error"
            if (errCode == "RATE_LIMIT_EXCEEDED" || errCode == "BLACKLISTED") {
                throw RuntimeException(mapBackendError(errCode, errMsg))
            }
            throw RuntimeException(errMsg)
        }

        val dataObj = data.getAsJsonObject("data")
        val output = dataObj?.get("output")?.asString ?: throw RuntimeException("Backend response missing output")
        val scenes = dataObj.getAsJsonArray("scenes")?.map { it.asString } ?: listOf("optimize")
        val composite = dataObj.get("composite")?.asBoolean ?: false

        return BackendEnhanceResult(output, scenes, composite, "backend", requestId)
    }

    /**
     * 2026-04-09 架构重构：统一后端增强（backend-only）
     * 所有增强请求走 backend API，不再有本地直连回退。
     */
    fun dualTrackEnhance(
        userInput: String,
        onProgress: ((String) -> Unit)? = null,
        indicator: ProgressIndicator? = null
    ): SmartRouteResult {
        // 2026-04-10 修复
        // 变更类型：修复
        // 功能描述：恢复 IntelliJ 端 backend-only 增强流程的分阶段进度提示，避免长请求期间一直停留在连接态
        // 设计思路：对齐浏览器插件端已验证的状态机；在同步后端请求执行期间，通过后台线程估计 routing 与 generation 两阶段，保持跨端体验一致
        // 参数与返回值：onProgress 依次接收连接、识别意图、生成 Prompt 文案；函数返回值结构保持 SmartRouteResult 不变
        // 影响范围：IntelliJ 插件增强进度展示、用户对当前执行阶段的感知
        // 潜在风险：无已知风险
        onProgress?.invoke("🌐 正在连接 AI 服务...")

        val progressCallback = onProgress
        var progressThread: Thread? = null
        if (progressCallback != null) {
            progressThread = Thread {
                try {
                    Thread.sleep(2000)
                    if (indicator?.isCanceled != true) {
                        progressCallback("🔍 正在识别意图...")
                    }
                    Thread.sleep(6000)
                    if (indicator?.isCanceled != true) {
                        progressCallback("✍️ 正在生成专业 Prompt...")
                    }
                } catch (_: InterruptedException) {
                }
            }.apply {
                isDaemon = true
                start()
            }
        }

        try {
            val config = getEffectiveConfig()
            val result = callBackendEnhance(
                input = userInput,
                enhanceMode = config.enhanceMode,
                model = config.model,
                indicator = indicator
            )
            return SmartRouteResult(result.result, result.scenes, result.composite)
        } finally {
            progressThread?.interrupt()
        }
    }

    /**
     * 获取可用模型列表（支持 4 种 API 模式）
     * @return Triple(ok, models, message)
     */
    fun fetchModels(baseUrl: String, apiKey: String, apiMode: String = ""): Triple<Boolean, List<String>, String> {
        val mode = apiMode.ifBlank { detectApiMode(baseUrl) }
        try {
            // 从 baseUrl 提取 host（去除 /v1beta, /v1/... 等路径后缀）
            val host = when (mode) {
                "gemini" -> {
                    val idx = baseUrl.indexOf("/v1beta")
                    if (idx > 0) baseUrl.substring(0, idx) else baseUrl
                }
                else -> {
                    val idx = baseUrl.indexOf("/v1")
                    if (idx > 0) baseUrl.substring(0, idx) else baseUrl
                }
            }

            val url = when (mode) {
                "gemini" -> {
                    val encodedKey = URLEncoder.encode(apiKey, "UTF-8")
                    URI("$host/v1beta/models?key=$encodedKey").toURL()
                }
                "claude" -> URI("$host/v1/models").toURL()
                else -> URI("$host/v1/models").toURL()
            }

            val conn = url.openConnection() as HttpURLConnection
            try {
                conn.requestMethod = "GET"
                conn.setRequestProperty("Content-Type", "application/json")

                when (mode) {
                    "claude" -> {
                        conn.setRequestProperty("x-api-key", apiKey)
                        conn.setRequestProperty("anthropic-version", "2023-06-01")
                    }
                    "gemini" -> { /* key in URL */ }
                    else -> conn.setRequestProperty("Authorization", "Bearer $apiKey")
                }

                conn.connectTimeout = 15000
                conn.readTimeout = 15000

                val responseCode = conn.responseCode
                if (responseCode !in 200..299) {
                    return Triple(false, emptyList(), "获取模型列表失败 (HTTP $responseCode)")
                }

                val responseBody = conn.inputStream.bufferedReader().readText()
                val json = gson.fromJson(responseBody, JsonObject::class.java)

                val models = when (mode) {
                    "gemini" -> {
                        json.getAsJsonArray("models")?.mapNotNull {
                            // name: "models/gemini-2.5-pro" → "gemini-2.5-pro"
                            it.asJsonObject?.get("name")?.asString?.removePrefix("models/")
                        } ?: emptyList()
                    }
                    else -> {
                        json.getAsJsonArray("data")?.mapNotNull {
                            it.asJsonObject?.get("id")?.asString
                        } ?: emptyList()
                    }
                }

                return if (models.isNotEmpty()) {
                    Triple(true, models.sorted(), "获取到 ${models.size} 个模型")
                } else {
                    Triple(false, emptyList(), "未获取到模型")
                }
            } finally {
                conn.disconnect()
            }
        } catch (e: Exception) {
            return Triple(false, emptyList(), "获取模型列表失败: ${e.message}")
        }
    }
}
