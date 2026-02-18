package com.easyprompt.ui

import com.intellij.openapi.actionSystem.ActionManager
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

    override fun getText(): String = "✨ Easy Prompt"

    override fun getTooltipText(): String = "Easy Prompt — 点击打开快捷菜单"

    override fun getAlignment(): Float = Component.CENTER_ALIGNMENT

    @Suppress("DEPRECATION")
    override fun getClickConsumer(): Consumer<MouseEvent> = Consumer { mouseEvent ->
        val action = ActionManager.getInstance().getAction("EasyPrompt.StatusBarMenu") ?: return@Consumer
        // 使用编辑器组件提供 DataContext（包含 PROJECT + EDITOR），回退到点击组件
        val currentEditor = FileEditorManager.getInstance(project).selectedTextEditor
        val contextComponent = currentEditor?.component ?: mouseEvent.component
        ActionManager.getInstance().tryToExecute(action, mouseEvent, contextComponent, "EasyPromptStatusBar", true)
    }
}
