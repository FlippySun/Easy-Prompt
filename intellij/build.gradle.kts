plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "1.9.25"
    id("org.jetbrains.intellij.platform") version "2.3.0"
}

group = "com.easyprompt"
version = "5.0.1"

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        intellijIdeaCommunity("2024.1")
        bundledPlugin("com.intellij.java")
        instrumentationTools()
    }
    implementation("com.google.code.gson:gson:2.11.0")
}

kotlin {
    jvmToolchain(17)
}

intellijPlatform {
    pluginConfiguration {
        id = "com.easyprompt.plugin"
        name = "Easy Prompt"
        version = project.version.toString()
        description = """
            Easy Prompt is an AI-powered prompt enhancer that uses two-step intent recognition with 85 specialized scenes and 10 persona profiles to transform simple descriptions into professional-grade prompts.
            <br/><br/>
            <b>Key Features:</b>
            <ul>
                <li>Smart Routing: Automatically identifies intent and matches the best scene</li>
                <li>Composite Support: Handles multiple intents in a single input</li>
                <li>Quick Enhance: Select text and press Ctrl+Alt+P to enhance instantly</li>
                <li>85 Scenes + 10 Personas: Covers development, content creation, product, marketing, design, data, HR, service, startup, education</li>
                <li>Multi-Platform: Available on VSCode, IntelliJ IDEA, and Web</li>
                <li>Zero Config: Built-in AI service, works out of the box</li>
            </ul>
        """.trimIndent()
        vendor {
            name = "Easy Prompt"
            url = "https://github.com/FlippySun/Easy-Prompt"
        }
        ideaVersion {
            sinceBuild = "241"
            untilBuild = "252.*"
        }
        changeNotes = """
            <h3>v5.0.1 — 浏览器扩展稳定性修复 + Web 端 Bug 修复</h3>
            <ul>
                <li>修复：Browser Popup debounce 状态丢失，新增 cancel + pagehide flush 机制</li>
                <li>修复：Browser Popup selectScene 恢复时重复保存，新增 skipSave 参数</li>
                <li>修复：Browser Popup handleGenerate 场景方法调用错误（getScenes → getSceneNames）</li>
                <li>修复：Browser Popup 动画 class 残留，添加 animationend 清理 + 定时器泄漏防护</li>
                <li>修复：Browser Popup 清空按钮未隐藏状态提示 + is-entering class 残留</li>
                <li>修复：Browser Popup 场景模态框事件穿透（stopPropagation → stopImmediatePropagation）</li>
                <li>修复：Web 端清空按钮未隐藏进度条</li>
                <li>修复：Web 端 CSS 未定义变量 --text-tertiary → --text-muted</li>
                <li>修复：Web 端缺少 #btn-copy.is-copied 选择器样式</li>
            </ul>
            <h3>v5.0.0 — 浏览器扩展正式上线，四端覆盖</h3>
            <ul>
                <li>🌐 新增：浏览器扩展正式上线（Chrome / Firefox / Safari 三平台 MV3）</li>
                <li>🎨 新增：Popup 快速增强面板 + 场景选择器 + 历史记录 + 状态持久化</li>
                <li>📄 新增：Content Script 浮动增强按钮，选中文本即可一键增强</li>
                <li>⚙️ 新增：Options 设置页，支持 API 配置 + 测试连接</li>
                <li>🐛 修复：Popup 面板 7 项审计问题（Escape 双触发/动画卡死/状态恢复闪烁/debounce 丢失/badge 分隔符/CSS 死代码）</li>
                <li>🔧 优化：四端（VSCode/IntelliJ/Web/Browser）功能完全同步</li>
            </ul>
            <h3>v4.1.0 — 画像系统 + 历史记录 + 35 新场景</h3>
            <ul>
                <li>🧑‍💼 新增：10 大用户画像（软件工程师/内容创作者/产品经理/市场运营/设计师/数据分析师/HR人事/客户服务/创业者/学生教育）</li>
                <li>🎯 新增：35 个专业场景（PRD/用户故事/竞品分析/广告文案/品牌故事/设计Brief/UX评审/数据报告/JD编写/商业计划书等），场景总数 85 个</li>
                <li>🕐 新增：增强历史记录功能（Ctrl+Alt+Y），支持 before/after 对比、一键复制、删除</li>
                <li>📂 优化：场景列表/选择器按画像分组展示，降低认知负荷</li>
                <li>🔧 优化：三端（VSCode/IntelliJ/Web）功能完全同步</li>
            </ul>
            <h3>v4.0.0 — Web 端上线，三端覆盖</h3>
            <ul>
                <li>🌐 新增：Web 在线版，纯前端 SPA 开箱即用，无需安装</li>
                <li>🎨 新增：专业级 UI 设计（参考 Linear / Vercel 设计语言）</li>
                <li>📝 新增：12 个写作专业场景（选题/校验/调研/文风/SEO/社媒等），场景总数 85 个</li>
                <li>🔧 修复：全平台审查修复多处细节问题</li>
            </ul>
            <h3>v3.2.2</h3>
            <ul>
                <li>修复：Welcome 页面版本号显示更新</li>
                <li>优化：IntelliJ 场景详情页新增「💡 痛点」板块，展示场景使用场景</li>
                <li>优化：全平台审查修复多处细节问题</li>
            </ul>
            <h3>v3.2.1</h3>
            <ul>
                <li>优化：API 额度不足错误提示，显示具体金额并引导配置</li>
                <li>优化：移除 Base URL 必须以 /v1 结尾的限制，支持更多 API 格式</li>
            </ul>
            <h3>v3.2.0</h3>
            <ul>
                <li>新增：Ctrl+Alt+H 快捷键快速打开使用教程</li>
                <li>新增：状态栏常驻入口 ✨ Easy Prompt，点击打开快捷菜单</li>
                <li>新增：场景列表按使用频率动态排序，显示 🔥 命中次数</li>
                <li>新增：状态栏快捷菜单（6 项快速操作）</li>
                <li>优化：Welcome 引导页更新快捷键和状态栏提示</li>
            </ul>
            <h3>v3.1.0</h3>
            <ul>
                <li>新增：首次安装 Welcome 引导页</li>
                <li>新增：指定场景增强（Ctrl+Alt+M）</li>
                <li>新增：查看使用教程命令</li>
                <li>优化：增强状态进度通知</li>
                <li>优化：50 个场景添加痛点描述和示例</li>
            </ul>
            <h3>v3.0.0</h3>
            <ul>
                <li>初始版本：两步 AI 路由 + 50 场景</li>
                <li>支持复合意图识别</li>
                <li>配置化 API Key / Base URL / Model</li>
            </ul>
        """.trimIndent()
    }
}

tasks {
    buildSearchableOptions {
        enabled = false
    }
    publishPlugin {
        token.set(providers.environmentVariable("PUBLISH_TOKEN"))
    }
    signPlugin {
        enabled = false
    }
}
