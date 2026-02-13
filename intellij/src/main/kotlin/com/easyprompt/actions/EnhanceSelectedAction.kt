package com.easyprompt.actions

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.easyprompt.core.ApiClient
import com.easyprompt.core.Scenes
import com.easyprompt.settings.EasyPromptSettings

class EnhanceSelectedAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val editor = e.getData(CommonDataKeys.EDITOR) ?: return
        val project = e.project ?: return
        val selectionModel = editor.selectionModel
        val selectedText = selectionModel.selectedText

        if (selectedText.isNullOrBlank()) {
            notify(project, "请先选中要优化的文本", NotificationType.WARNING)
            return
        }

        val settings = EasyPromptSettings.getInstance().state
        if (settings.apiKey.isBlank()) {
            notify(project, "请先在 Settings → Tools → Easy Prompt 中配置 API Key", NotificationType.ERROR)
            return
        }

        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Easy Prompt", true) {
            override fun run(indicator: ProgressIndicator) {
                try {
                    val result = ApiClient.smartRoute(selectedText) { msg ->
                        indicator.text = msg
                    }

                    ApplicationManager.getApplication().invokeLater {
                        WriteCommandAction.runWriteCommandAction(project) {
                            editor.document.replaceString(
                                selectionModel.selectionStart,
                                selectionModel.selectionEnd,
                                result.result
                            )
                        }
                        val label = if (result.composite) {
                            "复合：${result.scenes.map { Scenes.nameMap[it] ?: it }.joinToString(" + ")}"
                        } else {
                            Scenes.nameMap[result.scenes.first()] ?: result.scenes.first()
                        }
                        notify(project, "✅ Prompt 增强完成 [$label]", NotificationType.INFORMATION)
                    }
                } catch (ex: Exception) {
                    notify(project, "生成失败: ${ex.message}", NotificationType.ERROR)
                }
            }
        })
    }

    override fun update(e: AnActionEvent) {
        val editor = e.getData(CommonDataKeys.EDITOR)
        e.presentation.isEnabled = editor?.selectionModel?.hasSelection() == true
    }

    private fun notify(project: com.intellij.openapi.project.Project, content: String, type: NotificationType) {
        NotificationGroupManager.getInstance()
            .getNotificationGroup("Easy Prompt")
            .createNotification(content, type)
            .notify(project)
    }
}
