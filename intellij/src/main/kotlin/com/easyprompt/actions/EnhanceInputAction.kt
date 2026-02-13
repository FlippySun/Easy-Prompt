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
import com.intellij.testFramework.LightVirtualFile
import com.easyprompt.core.ApiClient
import com.easyprompt.core.Scenes
import com.easyprompt.settings.EasyPromptSettings

class EnhanceInputAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return

        val settings = EasyPromptSettings.getInstance().state
        if (settings.apiKey.isBlank()) {
            NotificationGroupManager.getInstance()
                .getNotificationGroup("Easy Prompt")
                .createNotification("请先配置 API Key", NotificationType.ERROR)
                .notify(project)
            return
        }

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
                    val result = ApiClient.smartRoute(input) { msg ->
                        indicator.text = msg
                    }

                    ApplicationManager.getApplication().invokeLater {
                        val file = LightVirtualFile("Easy-Prompt-Result.md", result.result)
                        FileEditorManager.getInstance(project).openFile(file, true)

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
                    NotificationGroupManager.getInstance()
                        .getNotificationGroup("Easy Prompt")
                        .createNotification("生成失败: ${ex.message}", NotificationType.ERROR)
                        .notify(project)
                }
            }
        })
    }
}
