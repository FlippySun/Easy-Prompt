package com.easyprompt.ui

import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.ui.components.JBScrollPane
import com.easyprompt.core.Scenes
import java.awt.*
import javax.swing.*
import javax.swing.border.EmptyBorder

class WelcomeDialog(private val project: Project) : DialogWrapper(project, true) {

    init {
        title = "Welcome to Easy Prompt"
        setOKButtonText("开始使用")
        setCancelButtonText("关闭")
        init()
    }

    override fun createCenterPanel(): JComponent {
        val mainPanel = JPanel(BorderLayout()).apply {
            preferredSize = Dimension(700, 560)
        }

        val content = JPanel().apply {
            layout = BoxLayout(this, BoxLayout.Y_AXIS)
            border = EmptyBorder(24, 32, 24, 32)
            background = UIManager.getColor("Panel.background")
        }

        // Hero
        content.add(createLabel("<html><div style='text-align:center;'>" +
                "<span style='font-size:22px;font-weight:bold;'>✨ Easy Prompt</span><br/>" +
                "<span style='font-size:13px;color:gray;'>AI 驱动的智能 Prompt 工程工具包 · 38 个专业场景</span>" +
                "</div></html>").apply {
            alignmentX = Component.CENTER_ALIGNMENT
        })
        content.add(Box.createVerticalStrut(20))

        // Quick Start
        content.add(createSectionTitle("⚡ 快速开始"))
        content.add(Box.createVerticalStrut(8))
        content.add(createStepPanel("1", "开箱即用", "内置 AI 服务，无需配置即可使用。也可在 Settings → Tools → Easy Prompt 填入自己的 Key"))
        content.add(Box.createVerticalStrut(6))
        content.add(createStepPanel("2", "写下你的想法", "在编辑器里随便写一句需求描述，甚至可以很混乱"))
        content.add(Box.createVerticalStrut(6))
        content.add(createStepPanel("3", "按下快捷键", "选中文本 → Ctrl+Alt+I 智能增强 或 Ctrl+Alt+P 增强选中"))
        content.add(Box.createVerticalStrut(20))

        // Shortcuts
        content.add(createSectionTitle("⌨️ 快捷键"))
        content.add(Box.createVerticalStrut(8))
        val shortcuts = arrayOf(
            arrayOf("Ctrl+Alt+I", "智能增强", "自动判断增强选中/文件/剪贴板，多来源时选择"),
            arrayOf("Ctrl+Alt+P", "增强选中", "选中文本 → 自动识别意图 → 原地替换"),
            arrayOf("Ctrl+Alt+O", "快速输入", "弹出输入框 → 新标签页显示结果"),
            arrayOf("Ctrl+Alt+L", "浏览场景", "查看 38 个场景详情"),
            arrayOf("Ctrl+Alt+M", "指定场景", "手动选择场景 → 精准定向增强"),
            arrayOf("Ctrl+Alt+H", "使用教程", "随时打开本引导页")
        )
        val table = JTable(shortcuts, arrayOf("快捷键", "功能", "说明")).apply {
            rowHeight = 28
            tableHeader.reorderingAllowed = false
            setShowGrid(true)
            gridColor = UIManager.getColor("Separator.foreground") ?: Color.GRAY
        }
        content.add(JBScrollPane(table).apply {
            preferredSize = Dimension(600, 186)
            maximumSize = Dimension(Int.MAX_VALUE, 186)
            alignmentX = Component.LEFT_ALIGNMENT
        })
        content.add(Box.createVerticalStrut(20))

        // Scene Preview
        content.add(createSectionTitle("🎯 场景预览（${Scenes.all.size} 个）"))
        content.add(Box.createVerticalStrut(8))
        val categories = mapOf(
            "🚀 需求 & 规划" to listOf("optimize", "split-task", "techstack", "proposal"),
            "💻 编码 & 开发" to listOf("api-design", "refactor", "regex", "sql", "convert", "typescript", "css", "state", "component", "form", "async", "schema", "script", "algo"),
            "🔍 调试 & 质量" to listOf("debug", "error", "perf", "review", "test", "security", "incident"),
            "📝 文档 & 协作" to listOf("comment", "doc", "commit", "changelog", "translate", "present", "mock"),
            "🛠️ 运维 & 环境" to listOf("devops", "env", "deps", "git"),
            "💡 学习 & 纠偏" to listOf("explain", "followup")
        )
        val sceneText = StringBuilder("<html><div style='font-size:12px;line-height:1.6;'>")
        categories.forEach { (cat, ids) ->
            sceneText.append("<b>$cat：</b>")
            sceneText.append(ids.mapNotNull { id -> Scenes.all[id]?.name }.joinToString(" · "))
            sceneText.append(" 等<br/>")
        }
        sceneText.append("</div></html>")
        content.add(createLabel(sceneText.toString()).apply { alignmentX = Component.LEFT_ALIGNMENT })
        content.add(Box.createVerticalStrut(16))

        // Tip
        content.add(createLabel(
            "<html><div style='font-size:12px;color:gray;background:#1a2a3a;padding:10px;border-radius:4px;'>" +
            "💡 <b>提示：</b>支持复合问题！如「审查代码并优化性能再写文档」，AI 会自动识别多个意图并合并生成 Prompt。" +
            "<br/>✨ 状态栏右下角的 ✨ Easy Prompt 图标可随时打开快捷菜单。场景列表按使用频率 🔥 智能排序。" +
            "</div></html>"
        ).apply { alignmentX = Component.LEFT_ALIGNMENT })

        content.add(Box.createVerticalGlue())

        val scrollPane = JBScrollPane(content).apply {
            border = null
            horizontalScrollBarPolicy = JScrollPane.HORIZONTAL_SCROLLBAR_NEVER
        }
        mainPanel.add(scrollPane, BorderLayout.CENTER)

        return mainPanel
    }

    private fun createSectionTitle(text: String): JLabel {
        return JLabel("<html><span style='font-size:15px;font-weight:bold;'>$text</span></html>").apply {
            alignmentX = Component.LEFT_ALIGNMENT
        }
    }

    private fun createStepPanel(num: String, title: String, desc: String): JPanel {
        return JPanel(BorderLayout(10, 0)).apply {
            maximumSize = Dimension(Int.MAX_VALUE, 36)
            alignmentX = Component.LEFT_ALIGNMENT
            isOpaque = false

            val badge = JLabel(num, SwingConstants.CENTER).apply {
                preferredSize = Dimension(26, 26)
                foreground = Color.WHITE
                isOpaque = true
                background = Color(0, 120, 212)
                font = font.deriveFont(Font.BOLD, 13f)
            }
            add(badge, BorderLayout.WEST)
            add(JLabel("<html><b>$title</b> — <span style='color:gray;'>$desc</span></html>"), BorderLayout.CENTER)
        }
    }

    private fun createLabel(html: String): JLabel = JLabel(html)
}
