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
                    val content = """# ${scene.name} (${entry.key})

> ${scene.description}

## System Prompt

```
${scene.prompt}
```

## 关键词

${scene.keywords.joinToString(", ")}
"""
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
