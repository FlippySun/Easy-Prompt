package com.easyprompt.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage

@Service
@State(name = "EasyPromptSettings", storages = [Storage("easyPrompt.xml")])
class EasyPromptSettings : PersistentStateComponent<EasyPromptSettings.State> {

    data class State(
        var apiBaseUrl: String = "",
        var apiKey: String = "",
        var model: String = "",
        var language: String = "zh-CN",
        /** 场景命中统计：JSON 格式 {"sceneId": count, ...} */
        var sceneStats: String = "{}"
    )

    private var myState = State()

    override fun getState(): State = myState

    override fun loadState(state: State) {
        myState = state
    }

    /**
     * 获取场景命中统计
     */
    fun getSceneStats(): Map<String, Int> {
        return try {
            val json = com.google.gson.Gson().fromJson(myState.sceneStats, Map::class.java)
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
        myState.sceneStats = com.google.gson.Gson().toJson(stats)
    }

    companion object {
        fun getInstance(): EasyPromptSettings =
            ApplicationManager.getApplication().getService(EasyPromptSettings::class.java)
    }
}
