plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "1.9.25"
    id("org.jetbrains.intellij.platform") version "2.3.0"
}

group = "com.easyprompt"
version = "3.2.0"

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
        id = "com.easyprompt.intellij"
        name = "Easy Prompt"
        version = project.version.toString()
        description = """
            <h2>Easy Prompt — AI 智能 Prompt 增强器</h2>
            <p>两步 AI 意图识别 + 38 个专业场景，将简单描述扩写为大师级 Prompt。</p>
            <ul>
                <li>🧠 智能路由：自动识别意图，匹配最佳场景</li>
                <li>🔀 复合支持：一句话包含多个意图也能精准处理</li>
                <li>⚡ 快捷操作：选中文本 Ctrl+Alt+P 一键增强</li>
                <li>📦 38 个场景：覆盖开发全流程</li>
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
}
