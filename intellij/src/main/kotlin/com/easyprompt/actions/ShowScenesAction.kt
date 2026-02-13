package com.easyprompt.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.testFramework.LightVirtualFile
import com.easyprompt.core.Scenes
import javax.swing.DefaultListModel
import javax.swing.JList

class ShowScenesAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return

        val items = Scenes.all.entries.map { (id, scene) ->
            "${scene.name} ($id) — ${scene.description}"
        }

        val model = DefaultListModel<String>()
        items.forEach { model.addElement(it) }
        val list = JList(model)

        JBPopupFactory.getInstance()
            .createListPopupBuilder(list)
            .setTitle("Easy Prompt — 场景列表 (${items.size} 个)")
            .setItemChosenCallback {
                val selectedIndex = list.selectedIndex
                if (selectedIndex >= 0) {
                    val entry = Scenes.all.entries.toList()[selectedIndex]
                    val scene = entry.value
                    val content = buildString {
                        appendLine("# ${scene.name} (${entry.key})")
                        appendLine()
                        appendLine("> ${scene.description}")
                        appendLine()
                        if (scene.painPoint.isNotBlank()) {
                            appendLine("## 💡 痛点")
                            appendLine()
                            appendLine(scene.painPoint)
                            appendLine()
                        }
                        appendLine("## System Prompt")
                        appendLine()
                        appendLine("```")
                        appendLine(scene.prompt)
                        appendLine("```")
                        appendLine()
                        appendLine("## 关键词")
                        appendLine()
                        appendLine(scene.keywords.joinToString(", "))
                    }
                    ApplicationManager.getApplication().invokeLater {
                        val file = LightVirtualFile("Scene-${entry.key}.md", content)
                        FileEditorManager.getInstance(project).openFile(file, true)
                    }
                }
            }
            .createPopup()
            .showInFocusCenter()
    }
}
