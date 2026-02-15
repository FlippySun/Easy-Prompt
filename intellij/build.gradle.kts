plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "1.9.25"
    id("org.jetbrains.intellij.platform") version "2.3.0"
}

group = "com.easyprompt"
version = "3.2.2"

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
            Easy Prompt is an AI-powered prompt enhancer that uses two-step intent recognition with 38 specialized scenes to transform simple descriptions into professional-grade prompts.
            <br/><br/>
            <b>Key Features:</b>
            <ul>
                <li>Smart Routing: Automatically identifies intent and matches the best scene</li>
                <li>Composite Support: Handles multiple intents in a single input</li>
                <li>Quick Enhance: Select text and press Ctrl+Alt+P to enhance instantly</li>
                <li>38 Scenes: Covers the entire development workflow</li>
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
                <li>优化：38 个场景添加痛点描述和示例</li>
            </ul>
            <h3>v3.0.0</h3>
            <ul>
                <li>初始版本：两步 AI 路由 + 38 场景</li>
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
