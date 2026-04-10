package com.easyprompt.actions

import com.easyprompt.core.SsoAuthClient
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent

// ========================== 变更记录 ==========================
// [日期]     2026-04-10
// [类型]     新增
// [描述]     SSO 退出 Action — 清除所有 SSO tokens
// [思路]     调用 SsoAuthClient.logout()，清除 PasswordSafe 中的 tokens
// [影响范围] Tools 菜单、快捷菜单
// [潜在风险] 无已知风险
// ==============================================================

class LogoutAction : AnAction() {

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    override fun actionPerformed(e: AnActionEvent) {
        SsoAuthClient.logout()
    }

    override fun update(e: AnActionEvent) {
        // 未登录时隐藏退出按钮
        e.presentation.isEnabledAndVisible = SsoAuthClient.isLoggedIn()
    }
}
