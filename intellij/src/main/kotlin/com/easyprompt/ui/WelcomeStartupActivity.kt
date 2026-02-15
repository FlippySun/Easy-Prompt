package com.easyprompt.ui

import com.intellij.ide.util.PropertiesComponent
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity

class WelcomeStartupActivity : ProjectActivity {

    override suspend fun execute(project: Project) {
        val app = ApplicationManager.getApplication()
        // 跳过无头环境和单元测试（含 JetBrains Marketplace 自动化验证）
        if (app.isHeadlessEnvironment || app.isUnitTestMode) return

        val props = PropertiesComponent.getInstance()
        val welcomed = props.getBoolean(WELCOME_KEY, false)
        if (!welcomed) {
            props.setValue(WELCOME_KEY, true)
            app.invokeLater {
                // 使用非阻塞通知替代模态对话框，避免阻塞 IDE 启动测试
                NotificationGroupManager.getInstance()
                    .getNotificationGroup("Easy Prompt")
                    .createNotification(
                        "欢迎使用 Easy Prompt！",
                        "AI 驱动的智能 Prompt 工程工具包 · 38 个专业场景。Ctrl+Alt+I 智能增强，Ctrl+Alt+H 查看完整教程。",
                        NotificationType.INFORMATION
                    )
                    .addAction(NotificationAction.createSimple("查看使用教程") {
                        WelcomeDialog(project).show()
                    })
                    .notify(project)
            }
        }
    }

    companion object {
        private const val WELCOME_KEY = "easyPrompt.welcomed.v3.2"
    }
}
