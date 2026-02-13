package com.easyprompt.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.ide.scratch.ScratchRootType
import com.intellij.lang.Language
import com.easyprompt.core.Scenes
import com.easyprompt.settings.EasyPromptSettings
import javax.swing.DefaultListModel
import javax.swing.JList

class ShowScenesAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val stats = EasyPromptSettings.getInstance().getSceneStats()

        // 按命中次数降序排列
        val sortedEntries = Scenes.all.entries.sortedByDescending { stats[it.key] ?: 0 }

        val items = sortedEntries.map { (id, scene) ->
            val hits = stats[id] ?: 0
            val fireLabel = if (hits > 0) " 🔥$hits" else ""
            "${scene.name}$fireLabel ($id) — ${scene.description}"
        }

        val model = DefaultListModel<String>()
        items.forEach { model.addElement(it) }
        val list = JList(model)

        JBPopupFactory.getInstance()
            .createListPopupBuilder(list)
            .setTitle("Easy Prompt — 场景列表 (${items.size} 个) · 按使用频率排序")
            .setItemChosenCallback(Runnable {
                val selectedIndex = list.selectedIndex
                if (selectedIndex >= 0) {
                    val entry = sortedEntries[selectedIndex]
                    val scene = entry.value
                    val hits = stats[entry.key] ?: 0
                    val content = buildString {
                        appendLine("# ${scene.name} (${entry.key})")
                        appendLine()
                        appendLine("> ${scene.description}")
                        if (hits > 0) {
                            appendLine()
                            appendLine("🔥 已使用 $hits 次")
                        }
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
                        val scratchFile = ScratchRootType.getInstance().createScratchFile(
                            project,
                            "Scene-${entry.key}.md",
                            Language.findLanguageByID("Markdown"),
                            content
                        )
                        if (scratchFile != null) {
                            FileEditorManager.getInstance(project).openFile(scratchFile, true)
                        }
                    }
                }
            })
            .createPopup()
            .showInFocusCenter()
    }
}
