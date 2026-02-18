package com.easyprompt.actions

import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.ide.scratch.ScratchRootType
import com.intellij.lang.Language
import com.easyprompt.core.PersonaConfig
import com.easyprompt.core.Scenes
import com.easyprompt.settings.EasyPromptSettings

class ShowScenesAction : AnAction() {

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val stats = EasyPromptSettings.getInstance().getSceneStats()

        // 按画像分组构建列表
        val items = mutableListOf<String>()
        data class ItemEntry(val sceneId: String, val scene: com.easyprompt.core.Scene)
        val itemEntries = mutableListOf<ItemEntry?>() // null = separator

        for (persona in PersonaConfig.personas) {
            val personaSceneIds = PersonaConfig.getScenesForPersona(persona.id)
            val personaEntries = Scenes.all.entries
                .filter { it.key in personaSceneIds }
                .sortedByDescending { stats[it.key] ?: 0 }

            if (personaEntries.isNotEmpty()) {
                // 分隔符
                items.add("── ${persona.name} ──")
                itemEntries.add(null)

                for (entry in personaEntries) {
                    val hits = stats[entry.key] ?: 0
                    val fireLabel = if (hits > 0) " 🔥$hits" else ""
                    items.add("  ${entry.value.name}$fireLabel (${entry.key}) — ${entry.value.description}")
                    itemEntries.add(ItemEntry(entry.key, entry.value))
                }
            }
        }

        // 未分类场景
        val allCategorized = PersonaConfig.personas.flatMap { PersonaConfig.getScenesForPersona(it.id) }.toSet()
        val uncategorized = Scenes.all.entries.filter { it.key !in allCategorized }.sortedByDescending { stats[it.key] ?: 0 }
        if (uncategorized.isNotEmpty()) {
            items.add("── 其他 ──")
            itemEntries.add(null)
            for (entry in uncategorized) {
                val hits = stats[entry.key] ?: 0
                val fireLabel = if (hits > 0) " 🔥$hits" else ""
                items.add("  ${entry.value.name}$fireLabel (${entry.key}) — ${entry.value.description}")
                itemEntries.add(ItemEntry(entry.key, entry.value))
            }
        }

        JBPopupFactory.getInstance()
            .createPopupChooserBuilder(items)
            .setTitle("Easy Prompt — 场景列表 (${Scenes.all.size} 个) · 按画像分组")
            .setItemChosenCallback { chosen ->
                val selectedIndex = items.indexOf(chosen)
                if (selectedIndex >= 0) {
                    val entry = itemEntries[selectedIndex] ?: return@setItemChosenCallback // skip separators
                    val scene = entry.scene
                    val hits = stats[entry.sceneId] ?: 0
                    val content = buildString {
                        appendLine("# ${scene.name} (${entry.sceneId})")
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
                            "Scene-${entry.sceneId}.md",
                            Language.findLanguageByID("Markdown"),
                            content
                        )
                        if (scratchFile != null) {
                            FileEditorManager.getInstance(project).openFile(scratchFile, true)
                        }
                    }
                }
            }
            .createPopup()
            .showInFocusCenter()
    }
}
