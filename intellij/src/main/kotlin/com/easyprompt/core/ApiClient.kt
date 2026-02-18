package com.easyprompt.core

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.easyprompt.settings.EasyPromptSettings
import com.intellij.openapi.progress.ProgressIndicator
import java.net.HttpURLConnection
import java.net.URI

data class RouterResult(
    val scenes: List<String>,
    val composite: Boolean
)

data class SmartRouteResult(
    val result: String,
    val scenes: List<String>,
    val composite: Boolean
)

object ApiClient {
    private val gson = Gson()

    // 输入长度限制（与 VSCode core/api.js 保持一致）
    private const val MAX_INPUT_LENGTH = 10000

    // 重试配置
    private const val MAX_RETRIES = 3
    private val RETRY_DELAYS = longArrayOf(2000, 4000, 8000) // 指数退避：2s, 4s, 8s

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
            "请求超时", "rate limit", "rate_limit", "429", "too many requests"
        )
        return patterns.any { lower.contains(it) }
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

        // 兜底
        return "❌ API 调用出错: $errorMsg · 请检查网络和 API 配置后重试"
    }

    /**
     * 获取有效配置（用户自定义优先，否则使用内置默认）
     */
    private fun getEffectiveConfig(): Triple<String, String, String> {
        val settingsInstance = EasyPromptSettings.getInstance()
        val state = settingsInstance.state
        val userApiKey = settingsInstance.getApiKey()
        return if (userApiKey.isNotBlank()) {
            // 用户配置了自定义 Key，使用用户的全套配置
            val baseUrl = state.apiBaseUrl.ifBlank { "https://api.openai.com/v1" }.trimEnd('/')
            val model = state.model.ifBlank { "gpt-4o" }

            // 格式验证（与 VSCode getConfig 一致）
            if (!baseUrl.matches(Regex("^https?://.*"))) {
                throw RuntimeException("API Base URL 格式错误：必须以 http:// 或 https:// 开头")
            }

            Triple(baseUrl, userApiKey, model)
        } else {
            // 使用内置默认配置
            val defaults = BuiltinDefaults.getDefaults()
            Triple(defaults.baseUrl.trimEnd('/'), defaults.apiKey, defaults.model)
        }
    }

    /**
     * 执行单次 API 调用（无重试）
     */
    private fun callApiOnce(
        systemPrompt: String,
        userMessage: String,
        temperature: Double = 0.7,
        maxTokens: Int = 4096,
        timeout: Int = 60000,
        indicator: ProgressIndicator? = null
    ): String {
        val (baseUrl, apiKey, model) = getEffectiveConfig()
        // 智能拼接：如果用户已输入完整路径（含 /chat/completions），直接使用
        val url = if (baseUrl.endsWith("/chat/completions")) {
            URI(baseUrl).toURL()
        } else {
            URI("$baseUrl/chat/completions").toURL()
        }

        val body = JsonObject().apply {
            addProperty("model", model)
            add("messages", gson.toJsonTree(listOf(
                mapOf("role" to "system", "content" to systemPrompt),
                mapOf("role" to "user", "content" to userMessage)
            )))
            addProperty("temperature", temperature)
            addProperty("max_tokens", maxTokens)
        }

        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Authorization", "Bearer $apiKey")
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
                throw RuntimeException("API 错误 ($responseCode): $errorBody")
            }

            val json = gson.fromJson(responseBody, JsonObject::class.java)
            return json.getAsJsonArray("choices")
                ?.get(0)?.asJsonObject
                ?.getAsJsonObject("message")
                ?.get("content")?.asString
                ?: throw RuntimeException("API 返回为空")
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
        indicator: ProgressIndicator? = null
    ): String {
        // 输入长度检查
        if (userMessage.length > MAX_INPUT_LENGTH) {
            throw RuntimeException("输入文本过长（${userMessage.length} 字符），最大支持 $MAX_INPUT_LENGTH 字符")
        }

        var lastError: Exception? = null
        val (_, _, model) = getEffectiveConfig()

        for (attempt in 0..MAX_RETRIES) {
            if (indicator?.isCanceled == true) {
                throw RuntimeException("已取消")
            }
            try {
                return callApiOnce(systemPrompt, userMessage, temperature, maxTokens, timeout, indicator)
            } catch (e: Exception) {
                lastError = e
                val errorMsg = e.message ?: "Unknown error"

                // 用户取消 — 直接抛出，不重试
                if (errorMsg == "已取消" || indicator?.isCanceled == true) {
                    throw RuntimeException("已取消")
                }

                // 非重试类错误直接抛出（如 401, 403, 模型不存在等）
                if (!isRetryableError(errorMsg)) {
                    throw RuntimeException(friendlyError(errorMsg, model))
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
        throw RuntimeException(friendlyError(lastError?.message ?: "Unknown error", model))
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

        onProgress?.invoke("🔍 正在识别意图...")

        val onRetry: ((Int, String) -> Unit)? = onProgress?.let { progress ->
            { _: Int, msg: String -> progress(msg) }
        }

        // 第一步：意图识别
        val routerPrompt = Router.buildRouterPrompt()
        val routerText = callApi(routerPrompt, userInput, temperature = 0.1, maxTokens = 500, timeout = 30000, onRetry = onRetry, indicator = indicator)
        val routerResult = parseRouterResult(routerText)

        val sceneLabels = routerResult.scenes.map { Scenes.nameMap[it] ?: it }
        val label = if (routerResult.composite) "复合：${sceneLabels.joinToString(" + ")}" else sceneLabels.first()
        onProgress?.invoke("✍️ 意图识别完成 → $label，正在生成...")

        // 第二步：生成
        val genPrompt = Router.buildGenerationPrompt(routerResult)
        val maxTokens = if (routerResult.composite) 8192 else 4096
        val result = callApi(genPrompt, userInput, maxTokens = maxTokens, timeout = 120000, onRetry = onRetry, indicator = indicator)

        return SmartRouteResult(result, routerResult.scenes, routerResult.composite)
    }

    /**
     * 指定场景直接生成（跳过路由）
     */
    fun directGenerate(userInput: String, sceneId: String, onProgress: ((String) -> Unit)? = null, indicator: ProgressIndicator? = null): String {
        val sceneName = Scenes.nameMap[sceneId] ?: sceneId
        onProgress?.invoke("✍️ 使用「${sceneName}」场景生成 Prompt...")

        val onRetry: ((Int, String) -> Unit)? = onProgress?.let { progress ->
            { _: Int, msg: String -> progress(msg) }
        }

        val routerResult = RouterResult(listOf(sceneId), false)
        val genPrompt = Router.buildGenerationPrompt(routerResult)
        return callApi(genPrompt, userInput, maxTokens = 4096, timeout = 120000, onRetry = onRetry, indicator = indicator)
    }

    /**
     * 测试 API 配置是否可用
     * @return Triple(ok, message, latencyMs)
     */
    fun testApiConfig(baseUrl: String, apiKey: String, model: String): Triple<Boolean, String, Long> {
        if (apiKey.isBlank()) {
            return Triple(false, "API Key 不能为空", 0)
        }
        if (baseUrl.isBlank()) {
            return Triple(false, "API Base URL 不能为空", 0)
        }

        // 智能拼接：如果用户已输入完整路径（含 /chat/completions），直接使用
        val normalizedBase = baseUrl.trimEnd('/')
        val url = if (normalizedBase.endsWith("/chat/completions")) {
            URI(normalizedBase).toURL()
        } else {
            URI("$normalizedBase/chat/completions").toURL()
        }
        val body = JsonObject().apply {
            addProperty("model", model.ifBlank { "gpt-4o" })
            add("messages", gson.toJsonTree(listOf(
                mapOf("role" to "system", "content" to "Reply OK"),
                mapOf("role" to "user", "content" to "test")
            )))
            addProperty("temperature", 0)
            addProperty("max_tokens", 5)
        }

        val startTime = System.currentTimeMillis()
        return try {
            val conn = url.openConnection() as HttpURLConnection
            try {
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("Authorization", "Bearer $apiKey")
                conn.connectTimeout = 15000
                conn.readTimeout = 15000
                conn.doOutput = true
                conn.outputStream.write(body.toString().toByteArray())

                val responseCode = conn.responseCode
                val latency = System.currentTimeMillis() - startTime

                if (responseCode in 200..299) {
                    Triple(true, "连接成功 · 延迟 ${latency}ms · 模型: ${model.ifBlank { "gpt-4o" }}", latency)
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
                        404 -> "接口地址不存在 · 请检查 Base URL 是否正确"
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
            Triple(false, "连接超时 · 请检查网络或 Base URL 是否正确", System.currentTimeMillis() - startTime)
        } catch (e: java.net.UnknownHostException) {
            Triple(false, "域名解析失败 · 请检查 Base URL 是否正确", System.currentTimeMillis() - startTime)
        } catch (e: java.net.ConnectException) {
            Triple(false, "无法连接到服务器 · 请检查网络和 Base URL", System.currentTimeMillis() - startTime)
        } catch (e: Exception) {
            Triple(false, "测试失败: ${e.message}", System.currentTimeMillis() - startTime)
        }
    }
}
