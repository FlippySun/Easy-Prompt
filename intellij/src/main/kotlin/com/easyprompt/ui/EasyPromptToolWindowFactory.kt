package com.easyprompt.ui

import com.easyprompt.core.Scenes
import com.intellij.ide.BrowserUtil
import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.extensions.PluginId
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.options.ShowSettingsUtil
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import com.intellij.ui.jcef.JBCefApp
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefJSQuery
import com.intellij.util.ui.JBUI
import java.awt.BorderLayout
import java.awt.Component
import java.awt.FlowLayout
import javax.swing.Box
import javax.swing.BoxLayout
import javax.swing.JButton
import javax.swing.JComponent
import javax.swing.JLabel
import javax.swing.JPanel
import javax.swing.JScrollPane

class EasyPromptToolWindowFactory : ToolWindowFactory {

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val contentComponent = createContentComponent(project, toolWindow)
        val content = ContentFactory.getInstance().createContent(contentComponent, "", false)
        toolWindow.contentManager.addContent(content)
    }

    private fun createContentComponent(project: Project, toolWindow: ToolWindow): JComponent {
        if (!JBCefApp.isSupported()) {
            return createFallbackPanel(project)
        }

        val browser = JBCefBrowser()
        val jsQuery = JBCefJSQuery.create(browser as JBCefBrowserBase)
        val contextComponent = browser.component

        Disposer.register(toolWindow.disposable, browser)
        Disposer.register(toolWindow.disposable, jsQuery)

        jsQuery.addHandler { cmd ->
            handleCommand(project, cmd, contextComponent)
            JBCefJSQuery.Response("")
        }

        // Kotlin 的三引号字符串里不需要转义双引号；历史原因导致 HTML 中出现了 \"，会使 class/style 等属性失效。
        // 这里做一次归一化，确保 ToolWindow 内样式正常生效。
        val html = buildWelcomeHtml(jsQuery).replace("\\\"", "\"")
        browser.loadHTML(html)
        return browser.component
    }

    private fun handleCommand(project: Project, cmd: String?, contextComponent: Component?) {
        ApplicationManager.getApplication().invokeLater {
            when (cmd) {
                "tryEnhance" -> executeAction(project, "EasyPrompt.EnhanceInput", contextComponent)
                "smartEnhance" -> executeAction(project, "EasyPrompt.SmartEnhance", contextComponent)
                "enhanceSelected" -> executeAction(project, "EasyPrompt.EnhanceSelected", contextComponent)
                "selectScene" -> executeAction(project, "EasyPrompt.EnhanceWithScene", contextComponent)
                "showScenes" -> executeAction(project, "EasyPrompt.ShowScenes", contextComponent)
                "showHistory" -> executeAction(project, "EasyPrompt.ShowHistory", contextComponent)
                "openSettings", "configureApi" -> {
                    ShowSettingsUtil.getInstance().showSettingsDialog(project, "Easy Prompt")
                }
                "openGitHub" -> BrowserUtil.browse("https://github.com/FlippySun/Easy-Prompt")
                "openWeb" -> BrowserUtil.browse("https://prompt.zhiz.chat")
            }
        }
    }

    private fun executeAction(project: Project, actionId: String, contextComponent: Component? = null) {
        val action = ActionManager.getInstance().getAction(actionId) ?: return
        val currentEditor = FileEditorManager.getInstance(project).selectedTextEditor
        val componentForContext = currentEditor?.component ?: contextComponent
        ActionManager.getInstance().tryToExecute(action, null, componentForContext, "EasyPromptToolWindow", true)
    }

    private fun createFallbackPanel(project: Project): JComponent {
        val panel = JPanel().apply {
            layout = BoxLayout(this, BoxLayout.Y_AXIS)
            border = JBUI.Borders.empty(16)
        }

        panel.add(JLabel("Easy Prompt").apply {
            alignmentX = Component.LEFT_ALIGNMENT
            font = font.deriveFont(16f)
        })
        panel.add(Box.createVerticalStrut(8))
        panel.add(JLabel(
            "<html>当前 IDE 环境未启用内置浏览器组件（JCEF），因此无法显示欢迎页。<br/>" +
                "你仍可通过右键菜单 / Tools 菜单 / 状态栏快捷菜单使用全部功能。</html>"
        ).apply {
            alignmentX = Component.LEFT_ALIGNMENT
        })
        panel.add(Box.createVerticalStrut(12))

        val buttonRow = JPanel(FlowLayout(FlowLayout.LEFT, 8, 0)).apply {
            isOpaque = false
            alignmentX = Component.LEFT_ALIGNMENT
        }

        buttonRow.add(JButton("智能增强").apply {
            addActionListener { executeAction(project, "EasyPrompt.SmartEnhance", panel) }
        })
        buttonRow.add(JButton("增强选中文本").apply {
            addActionListener { executeAction(project, "EasyPrompt.EnhanceSelected", panel) }
        })
        buttonRow.add(JButton("打开设置").apply {
            addActionListener {
                ShowSettingsUtil.getInstance().showSettingsDialog(project, "Easy Prompt")
            }
        })
        panel.add(buttonRow)

        return JScrollPane(panel).apply { border = null }
    }

    private fun buildWelcomeHtml(jsQuery: JBCefJSQuery): String {
        val version = PluginManagerCore
            .getPlugin(PluginId.getId("com.easyprompt.plugin"))
            ?.version
            ?: "local"

        val scenesCount = Scenes.all.size
        val sceneSections = buildSceneSections()

        return """<!DOCTYPE html>
<html lang=\"zh-CN\">
<head>
<meta charset=\"UTF-8\">
<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
<title>Easy Prompt</title>
<style>
:root {
    --bg: #1e1e1e;
    --card: #252526;
    --card-hover: #2d2d30;
    --border: #3e3e42;
    --text: #cccccc;
    --text-dim: #9da0a6;
    --accent: #0078d4;
    --accent-light: #1a8cff;
    --success: #4ec9b0;
    --warn: #dcdcaa;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
}
.container {
    max-width: 920px;
    margin: 0 auto;
    padding: 28px 24px 44px;
}
.hero {
    text-align: center;
    padding: 32px 0 28px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 28px;
}
.hero h1 {
    font-size: 28px;
    font-weight: 650;
    color: #fff;
    margin-bottom: 10px;
    letter-spacing: -0.4px;
}
.hero h1 span { color: var(--accent); }
.hero p {
    font-size: 14px;
    color: var(--text-dim);
    max-width: 680px;
    margin: 0 auto;
}
.version-badge {
    display: inline-block;
    background: var(--accent);
    color: #fff;
    font-size: 12px;
    padding: 2px 10px;
    border-radius: 999px;
    margin-bottom: 14px;
    font-weight: 600;
}
.section { margin-bottom: 26px; }
.section h2 {
    font-size: 18px;
    font-weight: 650;
    color: #fff;
    margin-bottom: 14px;
}
.steps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 14px;
}
.step {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 18px;
    transition: border-color 0.2s, transform 0.15s;
}
.step:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
}
.step-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    margin-bottom: 12px;
}
.step h4 { color: #fff; font-size: 15px; margin-bottom: 6px; }
.step p { font-size: 13px; color: var(--text-dim); }
.btn-group {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 14px;
}
.btn {
    display: inline-flex;
    align-items: center;
    padding: 9px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: background 0.2s, transform 0.1s;
}
.btn:hover { transform: translateY(-1px); }
.btn:active { transform: translateY(0); }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { background: var(--accent-light); }
.btn-secondary {
    background: var(--card);
    color: var(--text);
    border: 1px solid var(--border);
}
.btn-secondary:hover { background: var(--card-hover); border-color: var(--accent); }
.shortcut-table { width: 100%; border-collapse: collapse; }
.shortcut-table td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    font-size: 13px;
}
.shortcut-table tr:hover { background: var(--card); }
kbd {
    background: #3c3c3c;
    border: 1px solid #555;
    border-radius: 4px;
    padding: 2px 8px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
    font-size: 12px;
    color: #fff;
    white-space: nowrap;
}
.shortcut-desc { color: var(--text-dim); font-size: 12px; }

/* Before/After Demo */
.demo-box {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 14px;
}
.demo-header {
    display: flex;
    gap: 0;
}
.demo-tab {
    flex: 1;
    text-align: center;
    padding: 10px;
    font-size: 12px;
    font-weight: 650;
}
.demo-tab.before { background: #3a2020; color: #f48771; }
.demo-tab.after { background: #1e3a1e; color: var(--success); }
.demo-content { display: flex; }
.demo-col {
    flex: 1;
    padding: 14px;
    font-size: 13px;
    line-height: 1.7;
}
.demo-col.before {
    border-right: 1px solid var(--border);
    color: var(--text-dim);
}
.demo-col.after { color: var(--success); }

.tip-box {
    background: #1a2a3a;
    border-left: 3px solid var(--accent);
    border-radius: 0 6px 6px 0;
    padding: 12px 14px;
    font-size: 13px;
    color: var(--text);
    margin-top: 12px;
}
.tip-box strong { color: var(--accent-light); }
.category h3 {
    font-size: 14px;
    color: var(--warn);
    margin-bottom: 10px;
    font-weight: 600;
}
.scene-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
    margin-bottom: 18px;
}
.scene-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 12px;
    cursor: pointer;
    transition: border-color 0.2s, transform 0.15s;
}
.scene-card:hover { border-color: var(--accent); transform: translateY(-1px); }
.scene-name { font-size: 13px; color: #fff; font-weight: 650; }
.scene-tag { font-size: 11px; color: var(--accent-light); font-family: ui-monospace, monospace; margin: 4px 0; }
.scene-pain { font-size: 12px; color: var(--text-dim); line-height: 1.4; }
.footer {
    text-align: center;
    padding-top: 22px;
    border-top: 1px solid var(--border);
    color: var(--text-dim);
    font-size: 12px;
}
.footer a { color: var(--accent-light); text-decoration: none; }
.footer a:hover { text-decoration: underline; }
</style>
</head>
<body>
<div class=\"container\">
    <div class=\"hero\">
        <div class=\"version-badge\">v${version}</div>
        <h1>Welcome to <span>Easy Prompt</span></h1>
        <p>AI 驱动的智能 Prompt 工程工具包 —— 两步意图识别 + ${scenesCount} 个专业场景 + 10 大用户画像，把简单描述扩写为专业级 Prompt</p>
    </div>

    <div class=\"section\">
        <h2>30 秒快速开始</h2>
        <div class=\"steps\">
            <div class=\"step\">
                <div class=\"step-num\">1</div>
                <h4>开箱即用</h4>
                <p>无需配置即可使用内置服务；也可以在设置中填入自己的 API Key（支持 OpenAI/Gemini/DeepSeek/Ollama 等）</p>
            </div>
            <div class=\"step\">
                <div class=\"step-num\">2</div>
                <h4>写下你的想法</h4>
                <p>在编辑器里写一句需求描述，可以很简单，甚至很混乱 —— 没关系</p>
            </div>
            <div class=\"step\">
                <div class=\"step-num\">3</div>
                <h4>按下快捷键</h4>
                <p>选中文本，按 <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>P</kbd>（增强选中）或 <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>I</kbd>（智能增强）</p>
            </div>
        </div>
        <div class=\"btn-group\">
            <button class=\"btn btn-primary\" onclick=\"send('tryEnhance')\">立即体验</button>
            <button class=\"btn btn-secondary\" onclick=\"send('smartEnhance')\">智能增强</button>
            <button class=\"btn btn-secondary\" onclick=\"send('openSettings')\">打开设置 / API 配置</button>
        </div>
        <div class=\"tip-box\">
            <strong>如何触发：</strong>
            右键菜单（顶层） / Tools 菜单 / 状态栏快捷菜单 / 右侧 Easy Prompt 面板均可一键使用。
        </div>
    </div>

    <div class=\"section\">
        <h2>快捷键</h2>
        <table class=\"shortcut-table\">
            <tr>
                <td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>I</kbd></td>
                <td><strong>智能增强</strong><br><span class=\"shortcut-desc\">自动判断增强选中/文件/剪贴板内容，多来源时弹窗选择</span></td>
            </tr>
            <tr>
                <td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>P</kbd></td>
                <td><strong>增强选中</strong><br><span class=\"shortcut-desc\">选中文本 → 自动识别意图 → 原地替换为专业 Prompt</span></td>
            </tr>
            <tr>
                <td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>O</kbd></td>
                <td><strong>快速输入</strong><br><span class=\"shortcut-desc\">输入描述 → 新 Scratch 标签页展示结果，并复制到剪贴板</span></td>
            </tr>
            <tr>
                <td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>L</kbd></td>
                <td><strong>浏览场景</strong><br><span class=\"shortcut-desc\">查看全部 ${scenesCount} 个场景详情与 System Prompt</span></td>
            </tr>
            <tr>
                <td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>M</kbd></td>
                <td><strong>指定场景</strong><br><span class=\"shortcut-desc\">手动选择场景，跳过意图识别，精准定向增强</span></td>
            </tr>
            <tr>
                <td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Y</kbd></td>
                <td><strong>增强历史</strong><br><span class=\"shortcut-desc\">查看历史记录，支持对比与复制</span></td>
            </tr>
        </table>
        <div class=\"btn-group\">
            <button class=\"btn btn-secondary\" onclick=\"send('enhanceSelected')\">增强选中文本</button>
            <button class=\"btn btn-secondary\" onclick=\"send('selectScene')\">指定场景增强</button>
            <button class=\"btn btn-secondary\" onclick=\"send('showHistory')\">打开增强历史</button>
            <button class=\"btn btn-secondary\" onclick=\"send('showScenes')\">浏览场景列表</button>
        </div>
    </div>

    <div class=\"section\">
        <h2>看看效果</h2>
        <div class=\"demo-box\">
            <div class=\"demo-header\">
                <div class=\"demo-tab before\">原始输入</div>
                <div class=\"demo-tab after\">增强后示例</div>
            </div>
            <div class=\"demo-content\">
                <div class=\"demo-col before\">帮我做个登录页面，要好看点，能记住密码，对了还要第三方登录</div>
                <div class=\"demo-col after\">扩写为包含 Role/Task/Context/Output/Criteria 的结构化 Prompt，并补全验证规则、安全要求、技术栈约束等隐含需求</div>
            </div>
        </div>
        <div class=\"demo-box\">
            <div class=\"demo-header\">
                <div class=\"demo-tab before\">模糊描述</div>
                <div class=\"demo-tab after\">专业排查方案</div>
            </div>
            <div class=\"demo-content\">
                <div class=\"demo-col before\">登录按钮点了没反应，不知道怎么回事</div>
                <div class=\"demo-col after\">明确现象 → 推断复现步骤 → 按概率列出排查方向 → 每个方向给出验证方法与修复建议</div>
            </div>
        </div>
        <div class=\"tip-box\">
            <strong>提示：</strong>
            支持复合问题，例如“审查代码并优化性能再写文档”，AI 会自动识别多个意图并合并生成结构化 Prompt。
        </div>
    </div>

    <div class=\"section\">
        <h2>${scenesCount} 个专业场景</h2>
        <p style=\"color:var(--text-dim);font-size:12px;margin-bottom:12px;\">点击任意场景卡片可打开场景列表。场景按使用频率智能排序。</p>
        ${sceneSections}
    </div>

    <div class=\"section\" style=\"text-align:center;\">
        <h2 style=\"justify-content:center;\">准备好了吗</h2>
        <p style=\"color:var(--text-dim);font-size:13px;margin-bottom:14px;\">随便写一句话，选中后试试智能增强</p>
        <div class=\"btn-group\" style=\"justify-content:center;\">
            <button class=\"btn btn-primary\" onclick=\"send('tryEnhance')\">立即体验</button>
            <button class=\"btn btn-secondary\" onclick=\"send('openSettings')\">打开设置 / API 配置</button>
            <button class=\"btn btn-secondary\" onclick=\"send('selectScene')\">指定场景增强</button>
        </div>
    </div>

    <div class=\"footer\">
        <p>Easy Prompt v${version}</p>
        <p style=\"margin-top:8px;\">右键菜单顶层 / Tools 菜单 / 状态栏 / 右侧面板均可一键触发</p>
        <p style=\"margin-top:8px;\">
            <a href=\"#\" onclick=\"send('openGitHub')\">GitHub</a>
            &nbsp;·&nbsp;
            <a href=\"#\" onclick=\"send('openWeb')\">Web 在线版</a>
        </p>
    </div>
</div>

<script>
function send(cmd) { ${jsQuery.inject("cmd")} }

document.querySelectorAll('.scene-card').forEach(card => {
    card.addEventListener('click', () => send('showScenes'));
});
</script>
</body>
</html>"""
    }

    private fun buildSceneSections(): String {
        val categories = linkedMapOf(
            "需求与规划" to listOf("optimize", "split-task", "techstack", "api-design"),
            "编码与开发" to listOf(
                "refactor", "perf", "regex", "sql", "convert", "typescript", "css", "state", "component", "form", "async", "schema", "algo"
            ),
            "调试与质量" to listOf("review", "test", "debug", "error", "security", "comment"),
            "文档与协作" to listOf("doc", "changelog", "commit", "proposal", "present", "translate", "mock"),
            "运维与环境" to listOf("devops", "env", "script", "deps", "git", "incident"),
            "学习与纠偏" to listOf("explain", "followup"),
            "内容创作" to listOf(
                "topic-gen", "outline", "copy-polish", "style-rewrite", "word-adjust", "headline", "fact-check", "research", "platform-adapt", "compliance", "seo-write", "social-post"
            ),
            "产品管理" to listOf("prd", "user-story", "competitor", "data-analysis", "meeting-notes", "acceptance"),
            "市场运营" to listOf("ad-copy", "brand-story", "email-marketing", "event-plan", "growth-hack"),
            "设计体验" to listOf("design-brief", "ux-review", "design-spec", "copy-ux"),
            "数据分析" to listOf("data-report", "ab-test", "metric-define", "data-viz"),
            "人事" to listOf("jd-write", "interview-guide", "performance-review", "onboarding-plan"),
            "客户服务" to listOf("faq-write", "response-template", "feedback-analysis"),
            "创业管理" to listOf("business-plan", "pitch-deck", "okr", "swot", "risk-assess"),
            "学习教育" to listOf("study-plan", "summary", "essay", "quiz-gen")
        )

        fun esc(s: String): String {
            return s
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;")
        }

        return categories.entries.joinToString("") { (cat, ids) ->
            val cards = ids.mapNotNull { id ->
                val scene = Scenes.all[id] ?: return@mapNotNull null
                val pp = scene.painPoint.substringBefore("—").trim().ifBlank { scene.description }
                """<div class=\"scene-card\" data-id=\"${esc(id)}\">
<div class=\"scene-name\">${esc(scene.name)}</div>
<div class=\"scene-tag\">${esc(id)}</div>
<div class=\"scene-pain\">${esc(pp)}</div>
</div>"""
            }.joinToString("")

            """<div class=\"category\">
<h3>${esc(cat)}</h3>
<div class=\"scene-grid\">$cards</div>
</div>"""
        }
    }
}
