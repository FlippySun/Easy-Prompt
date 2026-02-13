package com.easyprompt.ui

import com.intellij.ide.util.PropertiesComponent
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity

class WelcomeStartupActivity : ProjectActivity {

    override suspend fun execute(project: Project) {
        val props = PropertiesComponent.getInstance()
        val welcomed = props.getBoolean(WELCOME_KEY, false)
        if (!welcomed) {
            props.setValue(WELCOME_KEY, true)
            com.intellij.openapi.application.ApplicationManager.getApplication().invokeLater {
                WelcomeDialog(project).show()
            }
        }
    }

    companion object {
        private const val WELCOME_KEY = "easyPrompt.welcomed.v3"
    }
}
