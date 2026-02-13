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
import com.intellij.testFramework.LightVirtualFile
import com.easyprompt.core.ApiClient
import com.easyprompt.core.Scenes
import com.easyprompt.settings.EasyPromptSettings
import javax.swing.DefaultListModel
import javax.swing.JList

class EnhanceWithSceneAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return

        val settings = EasyPromptSettings.getInstance().state
        if (settings.apiKey.isBlank()) {
            NotificationGroupManager.getInstance()
                .getNotificationGroup("Easy Prompt")
                .createNotification("请先在 Settings → Tools → Easy Prompt 中配置 API Key", NotificationType.ERROR)
                .notify(project)
            return
        }

        // Step 1: 选择场景
        val items = Scenes.all.entries.map { (id, scene) ->
            "${scene.name} ($id)"
        }

        val model = DefaultListModel<String>()
        items.forEach { model.addElement(it) }
        val list = JList(model)

        JBPopupFactory.getInstance()
            .createListPopupBuilder(list)
            .setTitle("🎯 选择场景 — 定向增强 Prompt")
            .setItemChosenCallback {
                val selectedIndex = list.selectedIndex
                if (selectedIndex >= 0) {
                    val entry = Scenes.all.entries.toList()[selectedIndex]
                    val sceneId = entry.key
                    val sceneName = entry.value.name

                    // Step 2: 获取文本
                    val editor = e.getData(CommonDataKeys.EDITOR)
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

                                ApplicationManager.getApplication().invokeLater {
                                    if (editor != null && editor.selectionModel.hasSelection()) {
                                        WriteCommandAction.runWriteCommandAction(project) {
                                            editor.document.replaceString(
                                                editor.selectionModel.selectionStart,
                                                editor.selectionModel.selectionEnd,
                                                result
                                            )
                                        }
                                    } else {
                                        val file = LightVirtualFile("Easy-Prompt-Result.md", result)
                                        FileEditorManager.getInstance(project).openFile(file, true)
                                    }

                                    NotificationGroupManager.getInstance()
                                        .getNotificationGroup("Easy Prompt")
                                        .createNotification("✅ 定向增强完成 [${sceneName}]", NotificationType.INFORMATION)
                                        .notify(project)
                                }
                            } catch (ex: Exception) {
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
