package com.easyprompt.ui

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindowManager
import javax.swing.Timer

object EasyPromptToolWindow {

    const val ID: String = "Easy Prompt"

    private const val RETRY_DELAY_MS = 300
    private const val MAX_RETRIES = 10

    fun activate(project: Project) {
        activate(project, 0)
    }

    private fun activate(project: Project, attempt: Int) {
        if (project.isDisposed) return

        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow(ID)
        if (toolWindow != null) {
            toolWindow.activate(null, true)
            return
        }

        if (attempt >= MAX_RETRIES) return

        Timer(RETRY_DELAY_MS) {
            activate(project, attempt + 1)
        }.apply {
            isRepeats = false
            start()
        }
    }
}
