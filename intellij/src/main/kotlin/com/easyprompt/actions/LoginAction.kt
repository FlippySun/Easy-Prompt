package com.easyprompt.actions

import com.easyprompt.core.SsoAuthClient
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent

// ========================== 变更记录 ==========================
// [日期]     2026-04-10
// [类型]     新增
// [描述]     SSO 登录 Action — 触发 SSO 授权码登录流程
// [思路]     调用 SsoAuthClient.startLogin()，启动 localhost server + 打开浏览器
// [影响范围] Tools 菜单、快捷菜单
// [潜在风险] 无已知风险
// ==============================================================

class LoginAction : AnAction() {

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    override fun actionPerformed(e: AnActionEvent) {
        SsoAuthClient.startLogin()
    }

    override fun update(e: AnActionEvent) {
        // 已登录时隐藏登录按钮
        e.presentation.isEnabledAndVisible = !SsoAuthClient.isLoggedIn()
    }
}
