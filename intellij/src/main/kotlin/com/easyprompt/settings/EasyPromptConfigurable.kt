package com.easyprompt.settings

import com.easyprompt.core.ApiClient
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.options.Configurable
import com.intellij.openapi.ui.Messages
import java.awt.Color
import java.awt.FlowLayout
import java.awt.Graphics
import java.awt.Graphics2D
import java.awt.RenderingHints
import javax.swing.*

class EasyPromptConfigurable : Configurable {

    private var panel: JPanel? = null
    private var apiBaseUrlField: JTextField? = null
    private var apiKeyField: JPasswordField? = null
    private var modelField: JComboBox<String>? = null
    private var statusLabel: JLabel? = null
    private var testPassed = false

    // 记录上次成功保存的配置（用于 reset 时恢复，而非回显未保存的脏数据）
    private var lastSavedBaseUrl = ""
    private var lastSavedApiKey = ""
    private var lastSavedModel = ""

    override fun getDisplayName(): String = "Easy Prompt"

    override fun createComponent(): JComponent {
        val settings = EasyPromptSettings.getInstance()

        // 记住当前已保存的配置
        lastSavedBaseUrl = settings.state.apiBaseUrl
        lastSavedApiKey = settings.state.apiKey
        lastSavedModel = settings.state.model

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

        apiBaseUrlField = PlaceholderTextField("留空 = 使用内置免费服务", 40).apply {
            text = settings.state.apiBaseUrl
        }
        apiKeyField = PlaceholderPasswordField("留空 = 使用内置免费服务", 40).apply {
            text = settings.state.apiKey
        }
        // 内置服务支持的模型（无自定义 API Key 时显示）
        val builtinModels = arrayOf(
            "",
            "gemini-3-pro-preview", "gemini-3-flash-preview", "gemini-3.0-pro", "gemini-2.5-pro",
            "deepseek-v3.2-chat", "deepseek-v3.2-reasoner", "deepseek-r1",
            "gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-4.1", "gpt-4o", "o3", "o4-mini",
            "grok-4", "grok-3",
            "glm-5", "glm-4.7",
            "kimi-k2.5", "kimi-k2",
            "qwen3-max", "qwen3-235b",
            "minimax-m2.5"
        )
        // 全量模型（有自定义 API Key 时显示）
        val fullModels = arrayOf(
            "",
            "claude-opus-4-6", "claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-1", "claude-sonnet-4",
            "gpt-5.2", "gpt-5.2-pro", "gpt-5-mini", "gpt-5-nano", "gpt-5",
            "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "o3", "o4-mini",
            "gemini-3-pro-preview", "gemini-3-flash-preview", "gemini-3.0-pro", "gemini-2.5-pro", "gemini-2.5-flash",
            "deepseek-v3.2-chat", "deepseek-v3.2-reasoner", "deepseek-r1"
        )
        val hasCustomApiKey = settings.state.apiKey.isNotBlank()
        val modelOptions = if (hasCustomApiKey) fullModels else builtinModels
        modelField = JComboBox(modelOptions).apply {
            isEditable = true
            selectedItem = settings.state.model.ifBlank { "" }
            // 自定义渲染：空值显示占位提示
            renderer = object : DefaultListCellRenderer() {
                override fun getListCellRendererComponent(
                    list: javax.swing.JList<*>?, value: Any?, index: Int,
                    isSelected: Boolean, cellHasFocus: Boolean
                ): java.awt.Component {
                    val comp = super.getListCellRendererComponent(list, value, index, isSelected, cellHasFocus)
                    if (value == null || value.toString().isBlank()) {
                        text = "留空 = 使用内置免费服务"
                        foreground = Color.GRAY
                    }
                    return comp
                }
            }
        }

        // 输入变化时重置测试状态
        val resetTestState = {
            testPassed = false
            statusLabel?.text = ""
        }
        apiBaseUrlField!!.document.addDocumentListener(SimpleDocListener(resetTestState))
        apiKeyField!!.document.addDocumentListener(SimpleDocListener(resetTestState))
        // ComboBox 用 ActionListener 监听选择变化
        modelField!!.addActionListener { resetTestState() }
        (modelField!!.editor.editorComponent as? javax.swing.text.JTextComponent)?.document
            ?.addDocumentListener(SimpleDocListener(resetTestState))

        panel!!.add(addField("API Base URL:", apiBaseUrlField!!))
        panel!!.add(Box.createVerticalStrut(8))
        panel!!.add(addField("API Key:", apiKeyField!!))
        panel!!.add(Box.createVerticalStrut(8))
        panel!!.add(addField("Model:", modelField!!))
        panel!!.add(Box.createVerticalStrut(16))

        // 状态标签
        statusLabel = JLabel("").apply {
            alignmentX = JPanel.LEFT_ALIGNMENT
        }
        panel!!.add(statusLabel!!)
        panel!!.add(Box.createVerticalStrut(8))

        // 按钮区域
        val buttonPanel = JPanel(FlowLayout(FlowLayout.LEFT, 8, 0)).apply {
            alignmentX = JPanel.LEFT_ALIGNMENT
            maximumSize = java.awt.Dimension(Int.MAX_VALUE, 40)
        }

        val testButton = JButton("🔍 测试连接").apply {
            addActionListener { doTest() }
        }
        val saveButton = JButton("💾 测试并保存").apply {
            addActionListener { doSave() }
        }
        val resetButton = JButton("🗑️ 恢复默认").apply {
            addActionListener { doReset() }
        }

        buttonPanel.add(testButton)
        buttonPanel.add(saveButton)
        buttonPanel.add(resetButton)
        panel!!.add(buttonPanel)

        panel!!.add(Box.createVerticalStrut(16))
        panel!!.add(JLabel("<html><i>以上配置均为可选 — 留空即使用内置 AI 服务，无需任何配置即可使用。</i></html>").apply {
            alignmentX = JPanel.LEFT_ALIGNMENT
        })
        panel!!.add(Box.createVerticalStrut(4))
        panel!!.add(JLabel("<html><i>如需使用自己的 Key，填入后请点「💾 测试并保存」，测试通过后自动保存。</i></html>").apply {
            alignmentX = JPanel.LEFT_ALIGNMENT
        })
        panel!!.add(Box.createVerticalGlue())

        return panel!!
    }

    /**
     * 测试连接（仅测试，不保存）
     */
    private fun doTest() {
        val baseUrl = apiBaseUrlField?.text?.trim() ?: ""
        val apiKey = String(apiKeyField?.password ?: charArrayOf()).trim()
        val model = (modelField?.selectedItem?.toString() ?: "").trim()
        if (baseUrl.isBlank() && apiKey.isBlank() && model.isBlank()) {
            statusLabel?.text = "当前为内置默认配置，无需测试，开箱即用 🎉"
            statusLabel?.foreground = Color(0x00, 0x88, 0x00)
            testPassed = true
            return
        }

        // 部分为空 → 提示填完整
        if (apiKey.isBlank() || baseUrl.isBlank() || model.isBlank()) {
            statusLabel?.text = "⚠️ 请填写完整的 API Base URL、API Key 和模型名称（或全部清空使用内置默认）"
            statusLabel?.foreground = Color(0xCC, 0x66, 0x00)
            testPassed = false
            return
        }

        statusLabel?.text = "⏳ 正在测试连接..."
        statusLabel?.foreground = Color.GRAY

        // 在后台线程执行测试
        ApplicationManager.getApplication().executeOnPooledThread {
            val (ok, msg, _) = ApiClient.testApiConfig(baseUrl, apiKey, model)
            SwingUtilities.invokeLater {
                if (ok) {
                    statusLabel?.text = "✅ $msg"
                    statusLabel?.foreground = Color(0x00, 0x88, 0x00)
                    testPassed = true
                } else {
                    statusLabel?.text = "❌ $msg"
                    statusLabel?.foreground = Color(0xCC, 0x00, 0x00)
                    testPassed = false
                }
            }
        }
    }

    /**
     * 测试并保存（测试通过才写入配置）
     */
    private fun doSave() {
        val baseUrl = apiBaseUrlField?.text?.trim() ?: ""
        val apiKey = String(apiKeyField?.password ?: charArrayOf()).trim()
        val model = (modelField?.selectedItem?.toString() ?: "").trim()
        if (baseUrl.isBlank() && apiKey.isBlank() && model.isBlank()) {
            val settings = EasyPromptSettings.getInstance()
            val currentStats = settings.state.sceneStats
            settings.loadState(EasyPromptSettings.State(sceneStats = currentStats))
            lastSavedBaseUrl = ""
            lastSavedApiKey = ""
            lastSavedModel = ""
            statusLabel?.text = "✅ 已保存 — 当前使用内置免费服务"
            statusLabel?.foreground = Color(0x00, 0x88, 0x00)
            testPassed = true
            return
        }

        // 部分为空 → 提示填完整
        if (apiKey.isBlank() || baseUrl.isBlank() || model.isBlank()) {
            statusLabel?.text = "⚠️ 请填写完整的配置信息（或全部清空使用内置默认服务）"
            statusLabel?.foreground = Color(0xCC, 0x66, 0x00)
            return
        }

        statusLabel?.text = "⏳ 保存前验证中..."
        statusLabel?.foreground = Color.GRAY

        ApplicationManager.getApplication().executeOnPooledThread {
            val (ok, msg, latency) = ApiClient.testApiConfig(baseUrl, apiKey, model)
            SwingUtilities.invokeLater {
                if (ok) {
                    // 测试通过，保存配置
                    val settings = EasyPromptSettings.getInstance()
                    val currentStats = settings.state.sceneStats
                    settings.loadState(EasyPromptSettings.State(
                        apiBaseUrl = baseUrl,
                        apiKey = apiKey,
                        model = model,
                        sceneStats = currentStats
                    ))
                    lastSavedBaseUrl = baseUrl
                    lastSavedApiKey = apiKey
                    lastSavedModel = model
                    statusLabel?.text = "✅ 配置已保存并生效 · 响应耗时 ${latency}ms"
                    statusLabel?.foreground = Color(0x00, 0x88, 0x00)
                    testPassed = true
                } else {
                    statusLabel?.text = "❌ 验证失败，未保存：$msg"
                    statusLabel?.foreground = Color(0xCC, 0x00, 0x00)
                    testPassed = false
                }
            }
        }
    }

    /**
     * 恢复默认配置（清空所有字段 + 清除已保存的配置）
     */
    private fun doReset() {
        apiBaseUrlField?.text = ""
        apiKeyField?.text = ""
        modelField?.selectedItem = ""
        val settings = EasyPromptSettings.getInstance()
        val currentStats = settings.state.sceneStats
        settings.loadState(EasyPromptSettings.State(sceneStats = currentStats))
        lastSavedBaseUrl = ""
        lastSavedApiKey = ""
        lastSavedModel = ""

        statusLabel?.text = "✅ 已恢复为内置默认配置"
        statusLabel?.foreground = Color(0x00, 0x88, 0x00)
        testPassed = true
    }

    /**
     * IntelliJ 框架判断是否有未保存的修改 — 始终返回 false，
     * 因为我们用自己的「测试并保存」按钮控制保存流程，
     * 不走 IntelliJ 的 Apply/OK 按钮保存逻辑。
     */
    override fun isModified(): Boolean = false

    /**
     * IntelliJ Apply/OK 按钮触发 — 由于 isModified() 始终返回 false，
     * 这个方法不会被自动触发。仅做安全兜底。
     */
    override fun apply() {
        // 不做任何事。配置保存完全由 doSave() 和 doReset() 控制。
    }

    /**
     * IntelliJ 打开设置面板时调用 — 从已保存的配置恢复 UI
     */
    override fun reset() {
        val settings = EasyPromptSettings.getInstance()
        lastSavedBaseUrl = settings.state.apiBaseUrl
        lastSavedApiKey = settings.state.apiKey
        lastSavedModel = settings.state.model

        apiBaseUrlField?.text = lastSavedBaseUrl
        apiKeyField?.text = lastSavedApiKey
        modelField?.selectedItem = lastSavedModel
        statusLabel?.text = ""
        testPassed = false
    }

    /**
     * 带 placeholder 的 JTextField
     */
    private class PlaceholderTextField(private val placeholder: String, columns: Int) : JTextField(columns) {
        override fun paintComponent(g: Graphics) {
            super.paintComponent(g)
            if (text.isNullOrEmpty() && !hasFocus()) {
                val g2 = g as Graphics2D
                g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)
                g2.color = Color.GRAY
                g2.font = font.deriveFont(font.size.toFloat())
                val fm = g2.fontMetrics
                g2.drawString(placeholder, insets.left + 2, height / 2 + fm.ascent / 2 - 1)
            }
        }
    }

    /**
     * 带 placeholder 的 JPasswordField
     */
    private class PlaceholderPasswordField(private val placeholder: String, columns: Int) : JPasswordField(columns) {
        override fun paintComponent(g: Graphics) {
            super.paintComponent(g)
            if (password.isEmpty() && !hasFocus()) {
                val g2 = g as Graphics2D
                g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)
                g2.color = Color.GRAY
                g2.font = font.deriveFont(font.size.toFloat())
                val fm = g2.fontMetrics
                g2.drawString(placeholder, insets.left + 2, height / 2 + fm.ascent / 2 - 1)
            }
        }
    }

    /**
     * 简单的文档变化监听器
     */
    private class SimpleDocListener(private val onChange: () -> Unit) : javax.swing.event.DocumentListener {
        override fun insertUpdate(e: javax.swing.event.DocumentEvent?) = onChange()
        override fun removeUpdate(e: javax.swing.event.DocumentEvent?) = onChange()
        override fun changedUpdate(e: javax.swing.event.DocumentEvent?) = onChange()
    }
}
