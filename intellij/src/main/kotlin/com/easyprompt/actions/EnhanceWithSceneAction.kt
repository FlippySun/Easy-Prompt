package com.easyprompt.actions

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.ide.scratch.ScratchRootType
import com.intellij.lang.Language
import com.easyprompt.core.ApiClient
import com.easyprompt.core.Scenes
import com.easyprompt.settings.EasyPromptSettings

class EnhanceWithSceneAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val stats = EasyPromptSettings.getInstance().getSceneStats()

        // Step 1: 选择场景（按命中次数排序）
        val sortedEntries = Scenes.all.entries.sortedByDescending { stats[it.key] ?: 0 }

        val items = sortedEntries.map { (id, scene) ->
            val hits = stats[id] ?: 0
            val fireLabel = if (hits > 0) " 🔥$hits" else ""
            "${scene.name}$fireLabel ($id)"
        }

        JBPopupFactory.getInstance()
            .createPopupChooserBuilder(items)
            .setTitle("🎯 选择场景 — 定向增强 Prompt · 按使用频率排序")
            .setItemChosenCallback { chosen ->
                val selectedIndex = items.indexOf(chosen)
                if (selectedIndex >= 0) {
                    val entry = sortedEntries[selectedIndex]
                    val sceneId = entry.key
                    val sceneName = entry.value.name

                    // Step 2: 获取文本（提前保存选区，防止竞态）
                    val editor = e.getData(CommonDataKeys.EDITOR)
                    val savedSelStart = editor?.selectionModel?.selectionStart ?: 0
                    val savedSelEnd = editor?.selectionModel?.selectionEnd ?: 0
                    val hasSelection = editor != null && savedSelStart != savedSelEnd
                    var text = editor?.selectionModel?.selectedText ?: ""

                    if (text.isBlank()) {
                        text = Messages.showInputDialog(
                            project,
                            "使用「${sceneName}」场景 — 输入你的描述：",
                            "Easy Prompt",
                            null
                        ) ?: ""
                    }

                    if (text.isBlank()) return@setItemChosenCallback

                    // Step 3: 直接使用指定场景生成
                    val inputText = text
                    ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Easy Prompt", true) {
                        override fun run(indicator: ProgressIndicator) {
                            try {
                                indicator.text = "✍️ 使用「${sceneName}」场景生成 Prompt..."
                                val result = ApiClient.directGenerate(inputText, sceneId) { msg ->
                                    indicator.text = msg
                                }

                                if (indicator.isCanceled) return

                                // 记录场景命中
                                EasyPromptSettings.getInstance().incrementSceneHits(listOf(sceneId))

                                ApplicationManager.getApplication().invokeLater {
                                    if (hasSelection && editor != null) {
                                        // 竞态保护：验证文档未被切换
                                        val currentEditor = FileEditorManager.getInstance(project).selectedTextEditor
                                        if (currentEditor != null && currentEditor.document == editor.document) {
                                            WriteCommandAction.runWriteCommandAction(project) {
                                                editor.document.replaceString(
                                                    savedSelStart,
                                                    savedSelEnd,
                                                    result
                                                )
                                            }
                                        } else {
                                            // 文档已切换，改为新 Scratch 文件 + 剪贴板
                                            val scratchFile = ScratchRootType.getInstance().createScratchFile(
                                                project,
                                                "Easy-Prompt-Result.md",
                                                Language.findLanguageByID("Markdown"),
                                                result
                                            )
                                            if (scratchFile != null) {
                                                FileEditorManager.getInstance(project).openFile(scratchFile, true)
                                            }
                                            val transferable = java.awt.datatransfer.StringSelection(result)
                                            com.intellij.openapi.ide.CopyPasteManager.getInstance().setContents(transferable)
                                        }
                                    } else {
                                        // 非选中文本：新建 Scratch 文件 + 复制到剪贴板
                                        val scratchFile = ScratchRootType.getInstance().createScratchFile(
                                            project,
                                            "Easy-Prompt-Result.md",
                                            Language.findLanguageByID("Markdown"),
                                            result
                                        )
                                        if (scratchFile != null) {
                                            FileEditorManager.getInstance(project).openFile(scratchFile, true)
                                        }
                                        val transferable = java.awt.datatransfer.StringSelection(result)
                                        com.intellij.openapi.ide.CopyPasteManager.getInstance().setContents(transferable)
                                    }

                                    NotificationGroupManager.getInstance()
                                        .getNotificationGroup("Easy Prompt")
                                        .createNotification("✅ 定向增强完成 [${sceneName}]", NotificationType.INFORMATION)
                                        .notify(project)
                                }
                            } catch (ex: Exception) {
                                if (indicator.isCanceled) return
                                NotificationGroupManager.getInstance()
                                    .getNotificationGroup("Easy Prompt")
                                    .createNotification("❌ 生成失败: ${ex.message}", NotificationType.ERROR)
                                    .notify(project)
                            }
                        }
                    })
                }
            }
            .createPopup()
            .showInFocusCenter()
    }
}
