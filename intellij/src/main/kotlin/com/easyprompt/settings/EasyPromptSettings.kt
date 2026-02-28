package com.easyprompt.settings

import com.intellij.credentialStore.CredentialAttributes
import com.intellij.credentialStore.Credentials
import com.intellij.credentialStore.generateServiceName
import com.intellij.ide.passwordSafe.PasswordSafe
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage

/**
 * 历史记录数据模型
 */
data class HistoryRecord(
    val id: String = "",
    val timestamp: Long = 0L,
    val mode: String = "smart",          // "smart" | "scene"
    val sceneIds: List<String> = emptyList(),
    val sceneName: String = "",
    val originalText: String = "",
    val enhancedText: String = ""
)

@Service
@State(name = "EasyPromptSettings", storages = [Storage("easyPrompt.xml")])
class EasyPromptSettings : PersistentStateComponent<EasyPromptSettings.State> {

    data class State(
        var apiMode: String = "",       // openai | openai-responses | claude | gemini
        var apiHost: String = "",       // e.g. https://api.openai.com
        var apiPath: String = "",       // e.g. /v1/chat/completions
        var apiBaseUrl: String = "",    // Legacy, kept for backward compat migration
        @Deprecated("Use PasswordSafe instead. Kept for migration only.")
        var apiKey: String = "",
        var model: String = "",
        var language: String = "zh-CN",
        /** 场景命中统计：JSON 格式 {"sceneId": count, ...} */
        var sceneStats: String = "{}",
        /** 增强历史记录：JSON 数组格式 */
        var historyRecords: String = "[]"
    )

    private var myState = State()
    private val gson = com.google.gson.Gson()
    private val maxHistory = 100

    private val credentialAttributes = CredentialAttributes(
        generateServiceName("EasyPrompt", "apiKey")
    )

    override fun getState(): State = myState

    override fun loadState(state: State) {
        myState = state
        // Migrate: if apiKey still in plain-text XML, move to PasswordSafe
        @Suppress("DEPRECATION")
        if (myState.apiKey.isNotBlank()) {
            setApiKey(myState.apiKey)
            @Suppress("DEPRECATION")
            myState.apiKey = ""
        }
    }

    /**
     * 从 PasswordSafe 获取 API Key
     */
    fun getApiKey(): String {
        return try {
            PasswordSafe.instance.getPassword(credentialAttributes) ?: ""
        } catch (_: Exception) {
            ""
        }
    }

    /**
     * 将 API Key 存入 PasswordSafe
     */
    fun setApiKey(key: String) {
        try {
            PasswordSafe.instance.set(credentialAttributes, Credentials("EasyPrompt", key))
        } catch (_: Exception) {
            // Fallback: ignore if PasswordSafe unavailable
        }
    }

    /**
     * 获取场景命中统计
     */
    fun getSceneStats(): Map<String, Int> {
        return try {
            val json = gson.fromJson(myState.sceneStats, Map::class.java)
            json?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap()
        } catch (_: Exception) {
            emptyMap()
        }
    }

    /**
     * 增加场景命中计数
     */
    fun incrementSceneHits(sceneIds: List<String>) {
        val stats = getSceneStats().toMutableMap()
        for (id in sceneIds) {
            stats[id] = (stats[id] ?: 0) + 1
        }
        myState.sceneStats = gson.toJson(stats)
    }

    // ─── 历史记录管理 ───

    /**
     * 获取所有历史记录（按时间倒序）
     */
    fun getHistory(): List<HistoryRecord> {
        return try {
            val type = com.google.gson.reflect.TypeToken.getParameterized(
                List::class.java, HistoryRecord::class.java
            ).type
            val list: List<HistoryRecord> = gson.fromJson(myState.historyRecords, type) ?: emptyList()
            list.sortedByDescending { it.timestamp }
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * 保存一条历史记录（FIFO，最多 100 条）
     */
    fun saveHistory(
        mode: String,
        sceneIds: List<String>,
        sceneName: String,
        originalText: String,
        enhancedText: String
    ) {
        val records = getHistory().toMutableList()
        val record = HistoryRecord(
            id = "${System.currentTimeMillis()}_${(Math.random() * 10000).toInt()}",
            timestamp = System.currentTimeMillis(),
            mode = mode,
            sceneIds = sceneIds,
            sceneName = sceneName,
            originalText = originalText,
            enhancedText = enhancedText
        )
        records.add(0, record)
        // FIFO: 保留最新 100 条
        val trimmed = if (records.size > maxHistory) records.take(maxHistory) else records
        myState.historyRecords = gson.toJson(trimmed)
    }

    /**
     * 删除一条历史记录
     */
    fun deleteHistory(recordId: String) {
        val records = getHistory().toMutableList()
        records.removeAll { it.id == recordId }
        myState.historyRecords = gson.toJson(records)
    }

    /**
     * 清空所有历史记录
     */
    fun clearHistory() {
        myState.historyRecords = "[]"
    }

    companion object {
        fun getInstance(): EasyPromptSettings =
            ApplicationManager.getApplication().getService(EasyPromptSettings::class.java)
    }
}
