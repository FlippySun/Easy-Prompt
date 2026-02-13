package com.easyprompt.settings

import com.intellij.openapi.options.Configurable
import javax.swing.*

class EasyPromptConfigurable : Configurable {

    private var panel: JPanel? = null
    private var apiBaseUrlField: JTextField? = null
    private var apiKeyField: JPasswordField? = null
    private var modelField: JTextField? = null

    override fun getDisplayName(): String = "Easy Prompt"

    override fun createComponent(): JComponent {
        val settings = EasyPromptSettings.getInstance()
        panel = JPanel().apply {
            layout = BoxLayout(this, BoxLayout.Y_AXIS)
            border = BorderFactory.createEmptyBorder(10, 10, 10, 10)
        }

        fun addField(label: String, field: JComponent): JPanel {
            return JPanel().apply {
                layout = BoxLayout(this, BoxLayout.X_AXIS)
                add(JLabel(label).apply { preferredSize = java.awt.Dimension(120, 30) })
                add(Box.createHorizontalStrut(10))
                add(field)
                maximumSize = java.awt.Dimension(Int.MAX_VALUE, 40)
                alignmentX = JPanel.LEFT_ALIGNMENT
            }
        }

        apiBaseUrlField = JTextField(settings.state.apiBaseUrl, 40)
        apiKeyField = JPasswordField(settings.state.apiKey, 40)
        modelField = JTextField(settings.state.model, 40)

        panel!!.add(addField("API Base URL:", apiBaseUrlField!!))
        panel!!.add(Box.createVerticalStrut(8))
        panel!!.add(addField("API Key:", apiKeyField!!))
        panel!!.add(Box.createVerticalStrut(8))
        panel!!.add(addField("Model:", modelField!!))
        panel!!.add(Box.createVerticalStrut(16))
        panel!!.add(JLabel("<html><i>API Base URL 必须以 /v1 结尾（如 https://api.openai.com/v1）</i></html>").apply {
            alignmentX = JPanel.LEFT_ALIGNMENT
        })
        panel!!.add(Box.createVerticalGlue())

        return panel!!
    }

    override fun isModified(): Boolean {
        val settings = EasyPromptSettings.getInstance()
        return apiBaseUrlField?.text != settings.state.apiBaseUrl ||
               String(apiKeyField?.password ?: charArrayOf()) != settings.state.apiKey ||
               modelField?.text != settings.state.model
    }

    override fun apply() {
        val settings = EasyPromptSettings.getInstance()
        settings.loadState(EasyPromptSettings.State(
            apiBaseUrl = apiBaseUrlField?.text ?: "",
            apiKey = String(apiKeyField?.password ?: charArrayOf()),
            model = modelField?.text ?: "gpt-4o"
        ))
    }

    override fun reset() {
        val settings = EasyPromptSettings.getInstance()
        apiBaseUrlField?.text = settings.state.apiBaseUrl
        apiKeyField?.text = settings.state.apiKey
        modelField?.text = settings.state.model
    }
}
