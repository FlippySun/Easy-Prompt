package com.easyprompt.actions

import com.easyprompt.core.SsoAuthClient
import com.intellij.ide.BrowserUtil
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent

private const val ZHIZ_CHAT_PROFILE_URL = "https://zhiz.chat/profile"

// ========================== 变更记录 ==========================
// [日期]     2026-04-10
// [类型]     修复
// [描述]     调整 IDEA 启动 Welcome Screen 的 zhiz.chat CTA：登录后展示当前账号，并改为点击直达 Web-Hub 个人页。
// [思路]     未登录时继续复用 SsoAuthClient.startLogin()；已登录时改为 BrowserUtil.browse(ZHIZ_CHAT_PROFILE_URL)，与 ToolWindow 欢迎页 CTA 语义保持一致。
// [参数与返回值] actionPerformed(e) 根据当前登录态决定发起登录或打开 Web-Hub 个人页；update(e) 根据当前登录用户刷新按钮文案与说明。
// [影响范围] IntelliJ IDEA 启动 Welcome Screen、SSO 登录入口发现路径、登录完成后的欢迎页 CTA 语义。
// [潜在风险] 若 JetBrains Welcome Screen 分组 ID 在未来 SDK 版本调整，需要同步 plugin.xml；无已知风险。
// [日期]     2026-04-15
// [类型]     修复/交互
// [描述]     将 IntelliJ Welcome Screen 已登录用户名入口从打开首页改为直达 Web-Hub 个人页，统一所有端“点击用户名”语义。
// [思路]     用户刚完成 SSO 后最关心的是验证当前账号与登录态，因此已登录 CTA 统一跳到 /profile；显式退出入口仍由其他独立动作承载。
// [参数与返回值] actionPerformed(e) 已登录时打开 https://zhiz.chat/profile，未登录时继续发起 SSO；update(e) 同步刷新按钮说明文案。
// [影响范围] IntelliJ Welcome Screen 已登录账号 CTA、跨端 SSO 体验一致性。
// [潜在风险] 若系统默认浏览器与完成登录时使用的浏览器配置文件不同，打开个人页时可能仍需重新识别登录态；无代码层已知风险。
// ==============================================================

class WelcomeScreenLoginAction : AnAction() {

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    override fun actionPerformed(e: AnActionEvent) {
        if (SsoAuthClient.isLoggedIn()) {
            BrowserUtil.browse(ZHIZ_CHAT_PROFILE_URL)
        } else {
            SsoAuthClient.startLogin()
        }
    }

    override fun update(e: AnActionEvent) {
        val user = SsoAuthClient.currentUser
        val accountName = user?.displayName?.takeIf { it.isNotBlank() }
            ?: user?.username?.takeIf { it.isNotBlank() }
            ?: "当前账号"
        val isLoggedIn = SsoAuthClient.isLoggedIn()

        e.presentation.isEnabledAndVisible = true
        e.presentation.text = if (isLoggedIn) "当前登录用户：$accountName" else "登录 zhiz.chat"
        e.presentation.description = if (isLoggedIn) {
            "当前已登录：$accountName。点击可直接打开 zhiz.chat 个人主页。"
        } else {
            "在 IDEA Welcome Screen 中直接发起 zhiz.chat SSO 登录。"
        }
    }
}
