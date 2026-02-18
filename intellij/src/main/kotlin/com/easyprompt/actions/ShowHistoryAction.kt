package com.easyprompt.actions

import com.easyprompt.settings.EasyPromptSettings
import com.easyprompt.settings.HistoryRecord
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.ide.CopyPasteManager
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.openapi.ui.Messages
import com.intellij.ui.JBColor
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBScrollPane
import com.intellij.util.ui.JBUI
import java.awt.*
import java.awt.datatransfer.StringSelection
import java.text.SimpleDateFormat
import java.util.Date
import javax.swing.*
import javax.swing.border.MatteBorder

/**
 * 查看增强历史 Action
 * 展示所有增强历史记录，支持查看 before/after 对比、复制、删除
 *
 * @since 4.1.0
 */
class ShowHistoryAction : AnAction() {

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        HistoryDialog(project).show()
    }
}

/**
 * 历史记录对话框
 */
private class HistoryDialog(
    private val project: com.intellij.openapi.project.Project
) : DialogWrapper(project) {

    private val listPanel = JPanel().apply {
        layout = BoxLayout(this, BoxLayout.Y_AXIS)
        background = JBColor.PanelBackground
    }

    init {
        title = "增强历史"
        setOKButtonText("关闭")
        setCancelButtonText("清空全部")
        init()
        renderHistory()
    }

    override fun createCenterPanel(): JComponent {
        val mainPanel = JPanel(BorderLayout())
        mainPanel.preferredSize = Dimension(680, 520)

        // 顶部标题栏
        val headerPanel = JPanel(BorderLayout()).apply {
            border = JBUI.Borders.empty(12, 16, 8, 16)
            background = JBColor.PanelBackground
        }
        val records = EasyPromptSettings.getInstance().getHistory()
        val titleLabel = JBLabel("增强历史 (${records.size})").apply {
            font = font.deriveFont(Font.BOLD, 16f)
        }
        headerPanel.add(titleLabel, BorderLayout.WEST)

        mainPanel.add(headerPanel, BorderLayout.NORTH)

        // 滚动列表
        val scrollPane = JBScrollPane(listPanel).apply {
            border = JBUI.Borders.empty()
            verticalScrollBarPolicy = ScrollPaneConstants.VERTICAL_SCROLLBAR_AS_NEEDED
            horizontalScrollBarPolicy = ScrollPaneConstants.HORIZONTAL_SCROLLBAR_NEVER
        }
        mainPanel.add(scrollPane, BorderLayout.CENTER)

        return mainPanel
    }

    private fun renderHistory() {
        listPanel.removeAll()
        val records = EasyPromptSettings.getInstance().getHistory()

        if (records.isEmpty()) {
            // 空状态
            val emptyPanel = JPanel(GridBagLayout()).apply {
                background = JBColor.PanelBackground
                border = JBUI.Borders.empty(60, 20)
            }
            val emptyBox = JPanel().apply {
                layout = BoxLayout(this, BoxLayout.Y_AXIS)
                isOpaque = false
            }
            emptyBox.add(JBLabel("暂无增强历史").apply {
                font = font.deriveFont(Font.BOLD, 14f)
                foreground = JBColor.GRAY
                alignmentX = Component.CENTER_ALIGNMENT
            })
            emptyBox.add(Box.createVerticalStrut(8))
            emptyBox.add(JBLabel("使用 Easy Prompt 增强后，记录会自动保存在这里").apply {
                foreground = JBColor.GRAY
                alignmentX = Component.CENTER_ALIGNMENT
            })
            emptyPanel.add(emptyBox)
            listPanel.add(emptyPanel)
        } else {
            for (record in records) {
                listPanel.add(createHistoryCard(record))
                listPanel.add(Box.createVerticalStrut(1))
            }
        }

        listPanel.revalidate()
        listPanel.repaint()
    }

    private fun createHistoryCard(record: HistoryRecord): JPanel {
        val card = JPanel(BorderLayout()).apply {
            border = JBUI.Borders.compound(
                MatteBorder(0, 0, 1, 0, JBColor.border()),
                JBUI.Borders.empty(12, 16)
            )
            background = JBColor.PanelBackground
            maximumSize = Dimension(Int.MAX_VALUE, Int.MAX_VALUE)
        }

        // 头部：时间 + 标签 + 操作按钮
        val headerPanel = JPanel(BorderLayout()).apply { isOpaque = false }

        val metaPanel = JPanel(FlowLayout(FlowLayout.LEFT, 8, 0)).apply { isOpaque = false }

        // 时间
        val dateFormat = SimpleDateFormat("MM-dd HH:mm")
        val timeLabel = JBLabel(dateFormat.format(Date(record.timestamp))).apply {
            foreground = JBColor.GRAY
            font = font.deriveFont(12f)
        }
        metaPanel.add(timeLabel)

        // 模式标签
        val modeText = if (record.mode == "smart") "智能" else "定向"
        val modeLabel = JBLabel(" $modeText ").apply {
            foreground = if (record.mode == "smart") JBColor(Color(59, 130, 246), Color(96, 165, 250))
                else JBColor(Color(16, 185, 129), Color(52, 211, 153))
            font = font.deriveFont(11f)
        }
        metaPanel.add(modeLabel)

        // 场景名
        if (record.sceneName.isNotBlank()) {
            val sceneLabel = JBLabel(record.sceneName).apply {
                foreground = JBColor.GRAY
                font = font.deriveFont(12f)
            }
            metaPanel.add(sceneLabel)
        }

        headerPanel.add(metaPanel, BorderLayout.WEST)

        // 操作按钮
        val actionsPanel = JPanel(FlowLayout(FlowLayout.RIGHT, 4, 0)).apply { isOpaque = false }
        val deleteBtn = JButton("删除").apply {
            font = font.deriveFont(11f)
            isFocusPainted = false
            cursor = Cursor.getPredefinedCursor(Cursor.HAND_CURSOR)
            addActionListener {
                EasyPromptSettings.getInstance().deleteHistory(record.id)
                renderHistory()
            }
        }
        actionsPanel.add(deleteBtn)
        headerPanel.add(actionsPanel, BorderLayout.EAST)

        card.add(headerPanel, BorderLayout.NORTH)

        // 内容区：原文预览 + 展开面板
        val contentPanel = JPanel().apply {
            layout = BoxLayout(this, BoxLayout.Y_AXIS)
            isOpaque = false
            border = JBUI.Borders.emptyTop(8)
        }

        // 原文预览
        val preview = truncate(record.originalText, 120)
        val previewLabel = JBLabel("<html><body style='width:580px'>${escapeHtml(preview)}</body></html>").apply {
            foreground = JBColor.foreground()
            font = font.deriveFont(13f)
        }
        contentPanel.add(previewLabel)

        // 展开/折叠 before/after 对比
        val diffPanel = JPanel().apply {
            layout = BoxLayout(this, BoxLayout.Y_AXIS)
            isOpaque = false
            isVisible = false
            border = JBUI.Borders.emptyTop(8)
        }

        // Before
        diffPanel.add(createDiffSection("原文", record.originalText, JBColor(Color(239, 68, 68), Color(248, 113, 113))))
        diffPanel.add(Box.createVerticalStrut(8))
        // After
        diffPanel.add(createDiffSection("增强后", record.enhancedText, JBColor(Color(34, 197, 94), Color(74, 222, 128))))

        contentPanel.add(diffPanel)

        // 展开/折叠按钮
        val toggleBtn = JButton("查看对比").apply {
            font = font.deriveFont(12f)
            isFocusPainted = false
            cursor = Cursor.getPredefinedCursor(Cursor.HAND_CURSOR)
            alignmentX = Component.LEFT_ALIGNMENT
            addActionListener {
                diffPanel.isVisible = !diffPanel.isVisible
                text = if (diffPanel.isVisible) "收起" else "查看对比"
                listPanel.revalidate()
                listPanel.repaint()
            }
        }
        val toggleWrapper = JPanel(FlowLayout(FlowLayout.LEFT, 0, 4)).apply {
            isOpaque = false
            add(toggleBtn)
        }
        contentPanel.add(toggleWrapper)

        card.add(contentPanel, BorderLayout.CENTER)

        return card
    }

    private fun createDiffSection(label: String, text: String, accentColor: JBColor): JPanel {
        val section = JPanel(BorderLayout()).apply {
            isOpaque = false
            border = JBUI.Borders.empty(4, 0)
        }

        // Label + Copy 按钮
        val labelPanel = JPanel(FlowLayout(FlowLayout.LEFT, 8, 0)).apply { isOpaque = false }
        labelPanel.add(JBLabel(label).apply {
            foreground = accentColor
            font = font.deriveFont(Font.BOLD, 12f)
        })
        val copyBtn = JButton("复制").apply {
            font = font.deriveFont(11f)
            isFocusPainted = false
            cursor = Cursor.getPredefinedCursor(Cursor.HAND_CURSOR)
            addActionListener {
                CopyPasteManager.getInstance().setContents(StringSelection(text))
                val btn = this
                btn.text = "已复制"
                javax.swing.Timer(1500) { btn.text = "复制" }.apply {
                    isRepeats = false
                    start()
                }
            }
        }
        labelPanel.add(copyBtn)
        section.add(labelPanel, BorderLayout.NORTH)

        // 文本内容
        val textArea = JTextArea(text).apply {
            lineWrap = true
            wrapStyleWord = true
            isEditable = false
            rows = minOf(6, text.lines().size + 1)
            font = Font("JetBrains Mono", Font.PLAIN, 12)
            border = JBUI.Borders.empty(8)
            background = JBColor(Color(245, 245, 245), Color(43, 43, 43))
        }
        val scrollPane = JBScrollPane(textArea).apply {
            border = JBUI.Borders.customLine(JBColor.border(), 1)
            preferredSize = Dimension(600, minOf(120, textArea.rows * 18 + 16))
        }
        section.add(scrollPane, BorderLayout.CENTER)

        return section
    }

    override fun doCancelAction() {
        // "清空全部" 按钮
        val confirm = Messages.showYesNoDialog(
            project,
            "确定要清空所有增强历史记录吗？此操作不可恢复。",
            "清空历史",
            "清空",
            "取消",
            Messages.getWarningIcon()
        )
        if (confirm == Messages.YES) {
            EasyPromptSettings.getInstance().clearHistory()
            renderHistory()
        }
    }

    private fun truncate(text: String, maxLen: Int): String {
        val normalized = text.replace(Regex("\\s+"), " ").trim()
        return if (normalized.length > maxLen) normalized.take(maxLen) + "..." else normalized
    }

    private fun escapeHtml(text: String): String {
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    }
}
