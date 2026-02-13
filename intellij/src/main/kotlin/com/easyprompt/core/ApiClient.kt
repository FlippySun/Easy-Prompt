package com.easyprompt.core

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.easyprompt.settings.EasyPromptSettings
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

    /**
     * 调用 OpenAI 兼容 API
     */
    fun callApi(
        systemPrompt: String,
        userMessage: String,
        temperature: Double = 0.7,
        maxTokens: Int = 4096,
        timeout: Int = 60000
    ): String {
        val settings = EasyPromptSettings.getInstance().state
        val baseUrl = settings.apiBaseUrl.trimEnd('/')
        val url = URI("$baseUrl/chat/completions").toURL()

        val body = JsonObject().apply {
            addProperty("model", settings.model)
            add("messages", gson.toJsonTree(listOf(
                mapOf("role" to "system", "content" to systemPrompt),
                mapOf("role" to "user", "content" to userMessage)
            )))
            addProperty("temperature", temperature)
            addProperty("max_tokens", maxTokens)
        }

        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Authorization", "Bearer ${settings.apiKey}")
        conn.connectTimeout = timeout
        conn.readTimeout = timeout
        conn.doOutput = true
        conn.outputStream.write(body.toString().toByteArray())

        val responseCode = conn.responseCode
        val responseBody = if (responseCode in 200..299) {
            conn.inputStream.bufferedReader().readText()
        } else {
            val errorBody = conn.errorStream?.bufferedReader()?.readText() ?: "Unknown error"
            throw RuntimeException("API 错误 ($responseCode): $errorBody")
        }

        val json = gson.fromJson(responseBody, JsonObject::class.java)
        return json.getAsJsonArray("choices")
            ?.get(0)?.asJsonObject
            ?.getAsJsonObject("message")
            ?.get("content")?.asString
            ?: throw RuntimeException("API 返回为空")
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
                val regex = Regex("""\{[\s\S]*?"scenes"[\s\S]*?\}""")
                regex.find(clean)?.value ?: """{"scenes":["optimize"],"composite":false}"""
            }
            val json = gson.fromJson(jsonStr, JsonObject::class.java)
            val scenes = json.getAsJsonArray("scenes")?.map { it.asString } ?: listOf("optimize")
            val composite = json.get("composite")?.asBoolean ?: false
            RouterResult(scenes.filter { Scenes.all.containsKey(it) }.ifEmpty { listOf("optimize") }, composite)
        } catch (e: Exception) {
            RouterResult(listOf("optimize"), false)
        }
    }

    /**
     * 两步智能路由
     */
    fun smartRoute(userInput: String, onProgress: ((String) -> Unit)? = null): SmartRouteResult {
        onProgress?.invoke("🔍 正在识别意图...")

        // 第一步：意图识别
        val routerPrompt = Router.buildRouterPrompt()
        val routerText = callApi(routerPrompt, userInput, temperature = 0.1, maxTokens = 150, timeout = 30000)
        val routerResult = parseRouterResult(routerText)

        val sceneLabels = routerResult.scenes.map { Scenes.nameMap[it] ?: it }
        val label = if (routerResult.composite) "复合：${sceneLabels.joinToString(" + ")}" else sceneLabels.first()
        onProgress?.invoke("✍️ 意图识别完成 → $label，正在生成...")

        // 第二步：生成
        val genPrompt = Router.buildGenerationPrompt(routerResult)
        val maxTokens = if (routerResult.composite) 8192 else 4096
        val result = callApi(genPrompt, userInput, maxTokens = maxTokens, timeout = 120000)

        return SmartRouteResult(result, routerResult.scenes, routerResult.composite)
    }

    /**
     * 指定场景直接生成（跳过路由）
     */
    fun directGenerate(userInput: String, sceneId: String, onProgress: ((String) -> Unit)? = null): String {
        val sceneName = Scenes.nameMap[sceneId] ?: sceneId
        onProgress?.invoke("✍️ 使用「${sceneName}」场景生成 Prompt...")

        val routerResult = RouterResult(listOf(sceneId), false)
        val genPrompt = Router.buildGenerationPrompt(routerResult)
        return callApi(genPrompt, userInput, maxTokens = 4096, timeout = 120000)
    }
}
