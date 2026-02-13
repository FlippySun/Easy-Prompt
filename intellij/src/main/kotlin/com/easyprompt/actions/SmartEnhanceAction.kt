package com.easyprompt.actions

import com.easyprompt.core.ApiClient
import com.easyprompt.core.Scenes
import com.easyprompt.settings.EasyPromptSettings
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.ide.CopyPasteManager
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.openapi.ui.popup.util.BaseListPopupStep

/**
 * 智能增强 Action
 * 按优先级智能选择增强内容源：
 * 1. 选中文本（最高优先级）
 * 2. 当前文件（≤50 行且 ≤2000 字符）
 * 3. 剪贴板文本（≤10000 字符）
 *
 * 多来源时让用户选择，单来源自动使用
 *
 * 对应 VSCode 的 smartEnhance() 函数
 *
 * @since 3.2.0
 */
class SmartEnhanceAction : AnAction() {

    // 内容来源类型
    data class ContentSource(
        val type: String,           // "selection", "file", "clipboard"
        val label: String,          // 显示标题
        val description: String,    // 副标题
        val detail: String,         // 详细说明
        val text: String?,          // 实际文本内容（null 表示无效）
        val editor: Editor? = null, // 如果是选中文本，需要保存 editor 引用用于替换
        val selectionStart: Int = 0,  // 捕获时的选区起始偏移量（防竞态）
        val selectionEnd: Int = 0     // 捕获时的选区结束偏移量（防竞态）
    )

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val editor = e.getData(CommonDataKeys.EDITOR)

        // 收集所有可能的内容源
        val sources = mutableListOf<ContentSource>()

        // 1. 选中文本（最高优先级）
        if (editor != null) {
            val selectionModel = editor.selectionModel
            val selectedText = selectionModel.selectedText

            if (!selectedText.isNullOrBlank()) {
                sources.add(ContentSource(
                    type = "selection",
                    label = "📝 选中文本",
                    description = "${selectedText.length} 字符",
                    detail = truncatePreview(selectedText, 50),
                    text = selectedText,
                    editor = editor,
                    selectionStart = selectionModel.selectionStart,
                    selectionEnd = selectionModel.selectionEnd
                ))
            }
        }

        // 2. 当前文件（≤50 行且 ≤2000 字符）
        if (editor != null) {
            val document = editor.document
            val lineCount = document.lineCount
            val text = document.text

            if (lineCount <= 50 && text.length <= 2000 && text.isNotBlank()) {
                val file = FileDocumentManager.getInstance().getFile(document)
                val fileName = file?.name ?: "当前文件"

                // 排除与选中文本内容完全相同的情况（避免重复）
                val isDupOfSelection = sources.any { it.type == "selection" && it.text == text }
                if (!isDupOfSelection) {
                    sources.add(ContentSource(
                        type = "file",
                        label = "📄 $fileName",
                        description = "$lineCount 行 · ${text.length} 字符",
                        detail = truncatePreview(text, 50),
                        text = text
                    ))
                }
            } else if (lineCount > 50 || text.length > 2000) {
                // 文件太大，添加为无效项（text = null），用于友好提示
                val file = FileDocumentManager.getInstance().getFile(document)
                val fileName = file?.name ?: "当前文件"

                sources.add(ContentSource(
                    type = "file-too-large",
                    label = "📄 $fileName（文件过大）",
                    description = "$lineCount 行 · ${text.length} 字符",
                    detail = "超过 50 行或 2000 字符限制",
                    text = null
                ))
            }
        }

        // 3. 剪贴板文本（≤10000 字符）
        try {
            val clipboardContent = CopyPasteManager.getInstance().contents
            val clipboardText = clipboardContent?.getTransferData(java.awt.datatransfer.DataFlavor.stringFlavor) as? String

            if (clipboardText != null && clipboardText.isNotBlank()) {
                if (clipboardText.length <= 10000) {
                    sources.add(ContentSource(
                        type = "clipboard",
                        label = "📋 剪贴板",
                        description = "${clipboardText.length} 字符",
                        detail = truncatePreview(clipboardText, 50),
                        text = clipboardText
                    ))
                } else {
                    // 剪贴板内容太大
                    sources.add(ContentSource(
                        type = "clipboard-too-large",
                        label = "📋 剪贴板（内容过大）",
                        description = "${clipboardText.length} 字符",
                        detail = "超过 10000 字符限制",
                        text = null
                    ))
                }
            }
        } catch (e: Exception) {
            // 忽略剪贴板读取错误（可能是非文本内容）
        }

        // 过滤掉无效来源（text == null）
        val validSources = sources.filter { it.text != null }

        when {
            validSources.isEmpty() -> {
                // 没有任何有效来源
                val hasInvalidSources = sources.any { it.text == null }
                val message = if (hasInvalidSources) {
                    buildString {
                        append("未找到可增强的内容，已检测到以下来源但不可用：\n\n")
                        sources.filter { it.text == null }.forEach {
                            append("• ${it.label}：${it.detail}\n")
                        }
                        append("\n💡 建议：\n")
                        append("• 减小文件大小（≤50 行/2000 字符）\n")
                        append("• 减少剪贴板内容（≤10000 字符）\n")
                        append("• 或先选中一段文本再执行")
                    }
                } else {
                    "未找到可增强的内容\n\n" +
                        "💡 请尝试：\n" +
                        "• 选中一段文本\n" +
                        "• 打开一个小文件（≤50 行/2000 字符）\n" +
                        "• 或复制内容到剪贴板（≤10000 字符）"
                }

                Messages.showWarningDialog(project, message, "智能增强")
            }

            validSources.size == 1 -> {
                // 单一来源，直接使用
                val source = validSources[0]
                performEnhancement(project, source)
            }

            else -> {
                // 多个来源，让用户选择
                showSourcePicker(project, validSources)
            }
        }
    }

    /**
     * 显示来源选择器
     */
    private fun showSourcePicker(project: Project, sources: List<ContentSource>) {
        val popupStep = object : BaseListPopupStep<ContentSource>("选择要增强的内容", sources) {
            override fun getTextFor(value: ContentSource): String = value.label

            override fun onChosen(selectedValue: ContentSource, finalChoice: Boolean): com.intellij.openapi.ui.popup.PopupStep<*>? {
                if (finalChoice) {
                    performEnhancement(project, selectedValue)
                }
                return null
            }
        }

        JBPopupFactory.getInstance()
            .createListPopup(popupStep)
            .showCenteredInCurrentWindow(project)
    }

    /**
     * 执行增强操作
     */
    private fun performEnhancement(project: Project, source: ContentSource) {
        val text = source.text ?: return

        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "正在增强内容...", true) {
            var enhancedText: String? = null
            var errorMessage: String? = null
            var resultScenes: List<String> = emptyList()
            var resultComposite: Boolean = false

            override fun run(indicator: com.intellij.openapi.progress.ProgressIndicator) {
                try {
                    // 使用 ApiClient.smartRoute 进行两步路由（意图识别 + 生成）
                    val result = ApiClient.smartRoute(text) { msg ->
                        indicator.text = msg
                    }

                    enhancedText = result.result
                    resultScenes = result.scenes
                    resultComposite = result.composite

                    // 记录场景命中
                    EasyPromptSettings.getInstance().incrementSceneHits(result.scenes)

                } catch (e: Exception) {
                    errorMessage = e.message ?: "未知错误"
                }
            }

            override fun onSuccess() {
                if (enhancedText != null) {
                    handleResult(project, source, enhancedText!!, resultScenes, resultComposite)
                } else if (errorMessage != null) {
                    showErrorDialog(project, errorMessage!!, source)
                }
            }

            override fun onThrowable(error: Throwable) {
                showErrorDialog(project, error.message ?: "增强失败", source)
            }
        })
    }

    /**
     * 处理增强结果
     */
    private fun handleResult(project: Project, source: ContentSource, enhancedText: String, scenes: List<String> = emptyList(), composite: Boolean = false) {
        val label = if (composite && scenes.size > 1) {
            "复合：${scenes.map { Scenes.nameMap[it] ?: it }.joinToString(" + ")}"
        } else if (scenes.isNotEmpty()) {
            Scenes.nameMap[scenes.first()] ?: scenes.first()
        } else {
            "智能增强"
        }

        when (source.type) {
            "selection" -> {
                // 选中文本：原地替换（使用捕获时保存的偏移量，防竞态）
                val editor = source.editor ?: return
                val savedSelStart = source.selectionStart
                val savedSelEnd = source.selectionEnd

                // 竞态保护：验证文档未被切换
                val currentEditor = FileEditorManager.getInstance(project).selectedTextEditor
                if (currentEditor != null && currentEditor.document == editor.document) {
                    WriteCommandAction.runWriteCommandAction(project) {
                        editor.document.replaceString(savedSelStart, savedSelEnd, enhancedText)
                    }
                    notify(project, "✅ 智能增强完成 [$label]", NotificationType.INFORMATION)
                } else {
                    // 文档已切换，改为新 Scratch 文件 + 剪贴板
                    openScratchAndCopy(project, enhancedText, label)
                }
            }

            "file", "clipboard" -> {
                // 文件/剪贴板：新建 Scratch 文件 + 复制到剪贴板
                com.intellij.openapi.application.ApplicationManager.getApplication().invokeLater {
                    openScratchAndCopy(project, enhancedText, label)
                }
            }
        }
    }

    /**
     * 新建 Scratch 文件 + 复制到剪贴板 + 发送通知
     */
    private fun openScratchAndCopy(project: Project, text: String, label: String) {
        val scratchFile = com.intellij.ide.scratch.ScratchRootType.getInstance().createScratchFile(
            project,
            "Enhanced-${System.currentTimeMillis()}.md",
            com.intellij.lang.Language.findLanguageByID("Markdown"),
            text
        )
        if (scratchFile != null) {
            FileEditorManager.getInstance(project).openFile(scratchFile, true)
        }

        val transferable = java.awt.datatransfer.StringSelection(text)
        CopyPasteManager.getInstance().setContents(transferable)

        notify(project, "✅ 智能增强完成 [$label]（已复制到剪贴板）", NotificationType.INFORMATION)
    }

    /**
     * 发送通知（非阻塞气泡，与其他 Action 一致）
     */
    private fun notify(project: Project, content: String, type: NotificationType) {
        NotificationGroupManager.getInstance()
            .getNotificationGroup("Easy Prompt")
            .createNotification(content, type)
            .notify(project)
    }

    /**
     * 显示错误对话框
     */
    private fun showErrorDialog(project: Project, message: String, retrySource: ContentSource? = null) {
        val actions = arrayOf("重试", "检查配置", "取消")
        val result = Messages.showDialog(
            project,
            "增强失败：$message",
            "错误",
            actions,
            0,
            Messages.getErrorIcon()
        )

        when (result) {
            0 -> {
                // 重试：如果有上次的源，直接重新执行增强
                if (retrySource != null) {
                    performEnhancement(project, retrySource)
                }
            }
            1 -> com.intellij.openapi.options.ShowSettingsUtil.getInstance().showSettingsDialog(project, "Easy Prompt")
        }
    }

    /**
     * 截断预览文本
     */
    private fun truncatePreview(text: String, maxLength: Int): String {
        val normalized = text.replace(Regex("\\s+"), " ").trim()
        return if (normalized.length > maxLength) {
            normalized.take(maxLength) + "..."
        } else {
            normalized
        }
    }

    override fun getActionUpdateThread(): ActionUpdateThread {
        return ActionUpdateThread.BGT
    }
}
