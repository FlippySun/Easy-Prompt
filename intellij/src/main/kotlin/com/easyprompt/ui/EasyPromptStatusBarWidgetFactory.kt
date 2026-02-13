package com.easyprompt.ui

import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.actionSystem.DataContext
import com.intellij.openapi.actionSystem.Presentation
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.StatusBarWidgetFactory
import com.intellij.util.Consumer
import java.awt.Component
import java.awt.event.MouseEvent

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

    override fun ID(): String = "EasyPrompt.StatusBar"

    override fun install(statusBar: StatusBar) {
        this.statusBar = statusBar
    }

    override fun dispose() {
        statusBar = null
    }

    override fun getPresentation(): StatusBarWidget.WidgetPresentation = this

    override fun getText(): String = "✨ Easy Prompt"

    override fun getTooltipText(): String = "Easy Prompt — 点击打开快捷菜单"

    override fun getAlignment(): Float = Component.CENTER_ALIGNMENT

    override fun getClickConsumer(): Consumer<MouseEvent> = Consumer {
        val action = ActionManager.getInstance().getAction("EasyPrompt.StatusBarMenu") ?: return@Consumer
        // 提供当前活跃编辑器，使 Action 能通过 CommonDataKeys.EDITOR 获取编辑器
        val currentEditor = FileEditorManager.getInstance(project).selectedTextEditor
        val dataContext = DataContext { dataId ->
            when (dataId) {
                CommonDataKeys.PROJECT.name -> project
                CommonDataKeys.EDITOR.name -> currentEditor
                else -> null
            }
        }
        val event = AnActionEvent.createFromAnAction(
            action,
            null,
            "EasyPromptStatusBar",
            dataContext
        )
        action.actionPerformed(event)
    }
}
