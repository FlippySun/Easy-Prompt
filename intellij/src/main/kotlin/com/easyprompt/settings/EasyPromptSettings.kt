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
        var apiBaseUrl: String = "https://api.openai.com/v1",
        var apiKey: String = "",
        var model: String = "gpt-4o",
        var language: String = "zh-CN"
    )

    private var myState = State()

    override fun getState(): State = myState

    override fun loadState(state: State) {
        myState = state
    }

    companion object {
        fun getInstance(): EasyPromptSettings =
            ApplicationManager.getApplication().getService(EasyPromptSettings::class.java)
    }
}
