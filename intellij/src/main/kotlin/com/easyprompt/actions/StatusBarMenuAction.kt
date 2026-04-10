package com.easyprompt.actions

import com.easyprompt.core.SsoAuthClient
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.ui.awt.RelativePoint
import java.awt.event.MouseEvent

// ========================== 变更记录 ==========================
// [日期]     2026-04-10
// [类型]     修改
// [描述]     B8: 在快捷菜单中添加动态 SSO 登录/退出选项
// [思路]     根据 SsoAuthClient.isLoggedIn() 动态切换"登录"/"退出登录 (username)"
// [影响范围] 状态栏快捷菜单
// [潜在风险] 无已知风险
// ==============================================================

class StatusBarMenuAction : AnAction() {

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    private data class MenuItem(
        val label: String,
        val actionId: String
    )

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return

        // 2026-04-10 B8: 动态构建菜单（含 SSO 登录/退出）
        val items = mutableListOf(
            MenuItem("打开右侧面板 / 新手指引", "EasyPrompt.ShowWelcome"),
            MenuItem("智能增强 (Ctrl+Alt+I)", "EasyPrompt.SmartEnhance"),
            MenuItem("增强选中文本 (Ctrl+Alt+P)", "EasyPrompt.EnhanceSelected"),
            MenuItem("快速输入增强 (Ctrl+Alt+O)", "EasyPrompt.EnhanceInput"),
            MenuItem("指定场景增强 (Ctrl+Alt+M)", "EasyPrompt.EnhanceWithScene"),
            MenuItem("浏览场景列表 (Ctrl+Alt+L)", "EasyPrompt.ShowScenes"),
            MenuItem("增强历史 (Ctrl+Alt+Y)", "EasyPrompt.ShowHistory"),
            MenuItem("打开设置 / API 配置", "ShowSettings"),
        )

        // SSO 登录/退出选项
        if (SsoAuthClient.isLoggedIn()) {
            val user = SsoAuthClient.currentUser
            val name = user?.displayName?.takeIf { it.isNotBlank() } ?: user?.username ?: "用户"
            items.add(MenuItem("退出登录 ($name)", "EasyPrompt.Logout"))
        } else {
            items.add(MenuItem("登录 zhiz.chat", "EasyPrompt.Login"))
        }

        val labels = items.map { it.label }

        val popup = JBPopupFactory.getInstance()
            .createPopupChooserBuilder(labels)
            .setTitle("Easy Prompt — 快捷菜单")
            .setItemChosenCallback { chosen ->
                val selectedIndex = labels.indexOf(chosen)
                if (selectedIndex >= 0) {
                    val item = items[selectedIndex]
                    if (item.actionId == "ShowSettings") {
                        com.intellij.openapi.options.ShowSettingsUtil.getInstance()
                            .showSettingsDialog(project, "Easy Prompt")
                    } else {
                        val action = ActionManager.getInstance().getAction(item.actionId)
                        if (action != null) {
                            val currentEditor = FileEditorManager.getInstance(project).selectedTextEditor
                            val contextComponent = currentEditor?.component ?: e.inputEvent?.component
                            ActionManager.getInstance().tryToExecute(action, e.inputEvent, contextComponent, "EasyPromptMenu", true)
                        }
                    }
                }
            }
            .createPopup()

        val mouseEvent = e.inputEvent as? MouseEvent
        if (mouseEvent != null) popup.show(RelativePoint(mouseEvent)) else popup.showInFocusCenter()
    }
}
