package com.easyprompt.actions

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.ActionUpdateThread
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
import com.easyprompt.core.PersonaConfig
import com.easyprompt.core.Scenes
import com.easyprompt.settings.EasyPromptSettings

class EnhanceWithSceneAction : AnAction() {

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val stats = EasyPromptSettings.getInstance().getSceneStats()

        // 按画像分组构建选择列表
        data class SceneItem(val id: String, val name: String)
        val items = mutableListOf<String>()
        val sceneItems = mutableListOf<SceneItem?>() // null = separator

        for (persona in PersonaConfig.personas) {
            val personaSceneIds = PersonaConfig.getScenesForPersona(persona.id)
            val personaEntries = Scenes.all.entries
                .filter { it.key in personaSceneIds }
                .sortedByDescending { stats[it.key] ?: 0 }

            if (personaEntries.isNotEmpty()) {
                items.add("── ${persona.name} ──")
                sceneItems.add(null)

                for (entry in personaEntries) {
                    val hits = stats[entry.key] ?: 0
                    val fireLabel = if (hits > 0) " 🔥$hits" else ""
                    items.add("  ${entry.value.name}$fireLabel (${entry.key})")
                    sceneItems.add(SceneItem(entry.key, entry.value.name))
                }
            }
        }

        // 未分类场景
        val allCategorized = PersonaConfig.personas.flatMap { PersonaConfig.getScenesForPersona(it.id) }.toSet()
        val uncategorized = Scenes.all.entries.filter { it.key !in allCategorized }.sortedByDescending { stats[it.key] ?: 0 }
        if (uncategorized.isNotEmpty()) {
            items.add("── 其他 ──")
            sceneItems.add(null)
            for (entry in uncategorized) {
                val hits = stats[entry.key] ?: 0
                val fireLabel = if (hits > 0) " 🔥$hits" else ""
                items.add("  ${entry.value.name}$fireLabel (${entry.key})")
                sceneItems.add(SceneItem(entry.key, entry.value.name))
            }
        }

        JBPopupFactory.getInstance()
            .createPopupChooserBuilder(items)
            .setTitle("🎯 选择场景 — 定向增强 Prompt · 按画像分组 (${Scenes.all.size} 个)")
            .setItemChosenCallback { chosen ->
                val selectedIndex = items.indexOf(chosen)
                if (selectedIndex >= 0) {
                    val item = sceneItems[selectedIndex] ?: return@setItemChosenCallback // skip separators
                    val sceneId = item.id
                    val sceneName = item.name

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
                                val result = ApiClient.directGenerate(inputText, sceneId, { msg ->
                                    indicator.text = msg
                                }, indicator)

                                if (indicator.isCanceled) return

                                // 记录场景命中
                                EasyPromptSettings.getInstance().incrementSceneHits(listOf(sceneId))

                                // 保存历史记录
                                EasyPromptSettings.getInstance().saveHistory(
                                    mode = "scene",
                                    sceneIds = listOf(sceneId),
                                    sceneName = sceneName,
                                    originalText = inputText,
                                    enhancedText = result
                                )

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
