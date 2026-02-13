package com.easyprompt.actions

import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.ui.popup.JBPopupFactory
import javax.swing.DefaultListModel
import javax.swing.JList

class StatusBarMenuAction : AnAction() {

    private data class MenuItem(
        val label: String,
        val actionId: String
    )

    private val menuItems = listOf(
        MenuItem("⚡ 智能增强 (Ctrl+Alt+I)", "EasyPrompt.SmartEnhance"),
        MenuItem("✏️ 快速输入增强 (Ctrl+Alt+O)", "EasyPrompt.EnhanceInput"),
        MenuItem("📝 增强选中文本 (Ctrl+Alt+P)", "EasyPrompt.EnhanceSelected"),
        MenuItem("🎯 指定场景增强 (Ctrl+Alt+M)", "EasyPrompt.EnhanceWithScene"),
        MenuItem("📋 浏览场景大全 (Ctrl+Alt+L)", "EasyPrompt.ShowScenes"),
        MenuItem("📖 使用教程 (Ctrl+Alt+H)", "EasyPrompt.ShowWelcome"),
        MenuItem("⚙️ API 配置", "ShowSettings"),
    )

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return

        val model = DefaultListModel<String>()
        menuItems.forEach { model.addElement(it.label) }
        val list = JList(model)

        JBPopupFactory.getInstance()
            .createListPopupBuilder(list)
            .setTitle("Easy Prompt — 快捷菜单")
            .setItemChosenCallback(Runnable {
                val selectedIndex = list.selectedIndex
                if (selectedIndex >= 0) {
                    val item = menuItems[selectedIndex]
                    if (item.actionId == "ShowSettings") {
                        com.intellij.openapi.options.ShowSettingsUtil.getInstance()
                            .showSettingsDialog(project, "Easy Prompt")
                    } else {
                        val action = ActionManager.getInstance().getAction(item.actionId)
                        action?.actionPerformed(e)
                    }
                }
            })
            .createPopup()
            .showInFocusCenter()
    }
}
