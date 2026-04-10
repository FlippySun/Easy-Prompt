package com.easyprompt.ui

import com.intellij.ide.util.PropertiesComponent
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.options.ShowSettingsUtil
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity
import com.easyprompt.core.Scenes
import com.easyprompt.core.SsoAuthClient

// ========================== 变更记录 ==========================
// [日期]     2026-04-10
// [类型]     修改
// [描述]     B7a+B8: 启动时迁移旧版手动 Token 并恢复 SSO Token 刷新
// [思路]     在 execute() 开头调用 migrateLegacyToken + restoreOnStartup
// [影响范围] 启动流程
// [潜在风险] 无已知风险
// ==============================================================

class WelcomeStartupActivity : ProjectActivity {

    override suspend fun execute(project: Project) {
        val app = ApplicationManager.getApplication()
        // 跳过无头环境和单元测试（含 JetBrains Marketplace 自动化验证）
        if (app.isHeadlessEnvironment || app.isUnitTestMode) return

        // 2026-04-10 B7a: 迁移旧版手动 backendToken
        SsoAuthClient.migrateLegacyToken()
        // 2026-04-10 B8: 恢复 SSO Token 刷新定时器
        SsoAuthClient.restoreOnStartup()

        val props = PropertiesComponent.getInstance()
        val welcomed = props.getBoolean(WELCOME_KEY, false)
        if (!welcomed) {
            props.setValue(WELCOME_KEY, true)
            app.invokeLater {
                // 首次安装：自动打开侧边栏面板（非阻塞），并给出清晰的触发指引
                EasyPromptToolWindow.activate(project)

                NotificationGroupManager.getInstance()
                    .getNotificationGroup("Easy Prompt")
                    .createNotification(
                        "Easy Prompt 已就绪",
                        "${Scenes.all.size} 个专业场景已加载。右键菜单顶层 / Tools 菜单 / 状态栏 / 右侧面板均可一键触发。快捷键：Ctrl+Alt+I（智能增强）/ Ctrl+Alt+P（增强选中）。",
                        NotificationType.INFORMATION
                    )
                    .addAction(NotificationAction.createSimple("打开 Easy Prompt 面板") {
                        EasyPromptToolWindow.activate(project)
                    })
                    .addAction(NotificationAction.createSimple("打开设置 / API 配置") {
                        ShowSettingsUtil.getInstance().showSettingsDialog(project, "Easy Prompt")
                    })
                    .notify(project)
            }
        }
    }

    companion object {
        private const val WELCOME_KEY = "easyPrompt.welcomed.v5.2.toolwindow"
    }
}
