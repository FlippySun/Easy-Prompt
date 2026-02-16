package com.easyprompt.actions

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.ui.Messages
import com.intellij.ide.scratch.ScratchRootType
import com.intellij.lang.Language
import com.easyprompt.core.ApiClient
import com.easyprompt.core.Scenes
import com.easyprompt.settings.EasyPromptSettings

class EnhanceInputAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return

        val input = Messages.showInputDialog(
            project,
            "输入要优化的 Prompt / 需求描述：",
            "Easy Prompt",
            null
        )

        if (input.isNullOrBlank()) return

        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Easy Prompt", true) {
            override fun run(indicator: ProgressIndicator) {
                try {
                    val result = ApiClient.smartRoute(input, { msg ->
                        indicator.text = msg
                    }, indicator)

                    if (indicator.isCanceled) return

                    // 记录场景命中
                    EasyPromptSettings.getInstance().incrementSceneHits(result.scenes)

                    // 保存历史记录
                    val historySceneName = if (result.composite) {
                        result.scenes.map { Scenes.nameMap[it] ?: it }.joinToString(" + ")
                    } else {
                        Scenes.nameMap[result.scenes.firstOrNull() ?: ""] ?: ""
                    }
                    EasyPromptSettings.getInstance().saveHistory(
                        mode = "smart",
                        sceneIds = result.scenes,
                        sceneName = historySceneName,
                        originalText = input,
                        enhancedText = result.result
                    )

                    ApplicationManager.getApplication().invokeLater {
                        val scratchFile = ScratchRootType.getInstance().createScratchFile(
                            project,
                            "Easy-Prompt-Result.md",
                            Language.findLanguageByID("Markdown"),
                            result.result
                        )
                        if (scratchFile != null) {
                            FileEditorManager.getInstance(project).openFile(scratchFile, true)
                        }

                        // 复制到剪贴板
                        val transferable = java.awt.datatransfer.StringSelection(result.result)
                        com.intellij.openapi.ide.CopyPasteManager.getInstance().setContents(transferable)

                        val label = if (result.composite) {
                            "复合：${result.scenes.map { Scenes.nameMap[it] ?: it }.joinToString(" + ")}"
                        } else {
                            Scenes.nameMap[result.scenes.first()] ?: result.scenes.first()
                        }
                        NotificationGroupManager.getInstance()
                            .getNotificationGroup("Easy Prompt")
                            .createNotification("✅ Prompt 增强完成 [$label]", NotificationType.INFORMATION)
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
