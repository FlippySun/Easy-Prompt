package com.easyprompt.ui

import com.easyprompt.core.SsoAuthClient
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.StatusBarWidgetFactory
import com.intellij.util.Consumer
import java.awt.Component
import java.awt.event.MouseEvent

// ========================== 变更记录 ==========================
// [日期]     2026-04-10
// [类型]     修改
// [描述]     B8: 状态栏显示 SSO 用户名，登录状态变更自动刷新
// [思路]     监听 SsoAuthClient 的 loginState 变更，动态更新 widget 文本
// [影响范围] 状态栏 widget
// [潜在风险] 无已知风险
// ==============================================================

class EasyPromptStatusBarWidgetFactory : StatusBarWidgetFactory {

    override fun getId(): String = "EasyPrompt.StatusBar"

    override fun getDisplayName(): String = "Easy Prompt"

    override fun isAvailable(project: Project): Boolean = true

    override fun createWidget(project: Project): StatusBarWidget {
        return EasyPromptStatusBarWidget(project)
    }

    override fun disposeWidget(widget: StatusBarWidget) {}

    override fun canBeEnabledOn(statusBar: StatusBar): Boolean = true
}

class EasyPromptStatusBarWidget(private val project: Project) : StatusBarWidget, StatusBarWidget.TextPresentation {

    private var statusBar: StatusBar? = null

    // 2026-04-10 B8: 登录状态变更监听器
    private val loginStateListener: () -> Unit = {
        ApplicationManager.getApplication().invokeLater {
            statusBar?.updateWidget(ID())
        }
    }

    override fun ID(): String = "EasyPrompt.StatusBar"

    override fun install(statusBar: StatusBar) {
        this.statusBar = statusBar
        SsoAuthClient.addLoginStateListener(loginStateListener)
    }

    override fun dispose() {
        SsoAuthClient.removeLoginStateListener(loginStateListener)
        statusBar = null
    }

    // 2026-04-10 B8: 动态文本 — 已登录显示用户名，未登录显示 Easy Prompt
    override fun getText(): String {
        val user = SsoAuthClient.currentUser
        return if (SsoAuthClient.isLoggedIn() && user != null) {
            val name = user.displayName.takeIf { it.isNotBlank() } ?: user.username
            if (name.isNotBlank()) "EP · $name" else "Easy Prompt"
        } else {
            "Easy Prompt"
        }
    }

    override fun getTooltipText(): String {
        return if (SsoAuthClient.isLoggedIn()) {
            val user = SsoAuthClient.currentUser
            val name = user?.displayName?.takeIf { it.isNotBlank() } ?: user?.username ?: ""
            "Easy Prompt — 已登录: $name · 点击打开快捷菜单"
        } else {
            "Easy Prompt — 未登录 · 点击打开快捷菜单"
        }
    }

    override fun getAlignment(): Float = Component.CENTER_ALIGNMENT

    @Suppress("DEPRECATION")
    override fun getClickConsumer(): Consumer<MouseEvent> = Consumer { mouseEvent ->
        val action = ActionManager.getInstance().getAction("EasyPrompt.StatusBarMenu") ?: return@Consumer
        val currentEditor = FileEditorManager.getInstance(project).selectedTextEditor
        val contextComponent = currentEditor?.component ?: mouseEvent.component
        ActionManager.getInstance().tryToExecute(action, mouseEvent, contextComponent, "EasyPromptStatusBar", true)
    }
}
