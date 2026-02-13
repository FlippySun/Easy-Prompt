package com.easyprompt.actions

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.ActionUpdateThread
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
        val project = e.project ?: return
        val editor = e.getData(CommonDataKeys.EDITOR)
        if (editor == null) {
            notify(project, "请先打开一个编辑器", NotificationType.WARNING)
            return
        }
        val selectionModel = editor.selectionModel
        val selectedText = selectionModel.selectedText

        if (selectedText.isNullOrBlank()) {
            // 没有选中文本 → 自动转发到智能增强（处理文件/剪贴板）
            SmartEnhanceAction().actionPerformed(e)
            return
        }

        // 提前保存选区，防止后台任务期间选区变化（竞态修复）
        val savedSelStart = selectionModel.selectionStart
        val savedSelEnd = selectionModel.selectionEnd

        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Easy Prompt", true) {
            override fun run(indicator: ProgressIndicator) {
                try {
                    val result = ApiClient.smartRoute(selectedText) { msg ->
                        indicator.text = msg
                    }

                    if (indicator.isCanceled) return

                    // 记录场景命中
                    EasyPromptSettings.getInstance().incrementSceneHits(result.scenes)

                    ApplicationManager.getApplication().invokeLater {
                        WriteCommandAction.runWriteCommandAction(project) {
                            editor.document.replaceString(
                                savedSelStart,
                                savedSelEnd,
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
                    if (indicator.isCanceled) return
                    notify(project, "❌ 生成失败: ${ex.message}", NotificationType.ERROR)
                }
            }
        })
    }

    override fun update(e: AnActionEvent) {
        // 始终启用（无选中文本时会 fallback 到智能增强）
        e.presentation.isEnabled = e.getData(CommonDataKeys.EDITOR) != null
    }

    override fun getActionUpdateThread(): ActionUpdateThread {
        return ActionUpdateThread.BGT
    }

    private fun notify(project: com.intellij.openapi.project.Project, content: String, type: NotificationType) {
        NotificationGroupManager.getInstance()
            .getNotificationGroup("Easy Prompt")
            .createNotification(content, type)
            .notify(project)
    }
}
