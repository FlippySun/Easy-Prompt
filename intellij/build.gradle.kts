plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "1.9.25"
    id("org.jetbrains.intellij.platform") version "2.3.0"
}

group = "com.easyprompt"
version = "5.2.1"

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        intellijIdeaCommunity("2024.3")
        bundledPlugin("com.intellij.java")
    }
    implementation("com.google.code.gson:gson:2.11.0")
}

kotlin {
    jvmToolchain(21)
}

intellijPlatform {
    pluginConfiguration {
        id = "com.easyprompt.plugin"
        name = "Easy Prompt"
        version = project.version.toString()
        description = """
            <b>Easy Prompt</b> 是一款面向 IntelliJ IDEA 的 AI Prompt 增强插件：基于“两步意图识别 → 专业 Prompt 生成”，把你的简单描述自动扩写为结构化、高质量的 Prompt。
            <br/><br/>
            <b>30 秒快速开始</b>
            <ul>
                <li>在编辑器里写下你的需求描述（可以很简短、很随意）。</li>
                <li>选中文本后：右键菜单（顶层）→ 点击 “Easy Prompt：智能增强 / 增强选中文本”。</li>
                <li>或使用快捷键：<b>Ctrl+Alt+I</b>（智能增强）/ <b>Ctrl+Alt+P</b>（增强选中）。Mac 上 Alt=Option。</li>
                <li>首次使用建议打开右侧 <b>ToolWindow</b>：Easy Prompt 面板（新手指引 + 一键入口）。</li>
            </ul>
            <b>核心能力</b>
            <ul>
                <li><b>两步智能路由</b>：先识别意图/场景，再生成对应的专业 Prompt</li>
                <li><b>复合意图支持</b>：一句话包含多个意图也能合并处理</li>
                <li><b>85 个专业场景 + 10 大用户画像</b>：覆盖开发、内容、产品、营销、设计、数据、HR、客服、创业、教育等</li>
                <li><b>智能增强</b>：自动判断增强选中文本 / 当前文件 / 剪贴板内容</li>
                <li><b>增强历史</b>：查看 before/after，对比、复制、删除</li>
                <li><b>Smart Nudge</b>：浏览器扩展在 AI 网站（ChatGPT/Claude/Gemini 等）输入暂停后自动弹出增强提醒，一键增强</li>
                <li><b>多供应商兼容</b>：OpenAI / Azure / Gemini / DeepSeek / Ollama</li>
                <li><b>开箱即用</b>：默认内置服务；也支持自定义 API（OpenAI/Gemini/DeepSeek/Ollama 等）</li>
                <li><b>安全加固</b>：AES-256-CBC 加密内置凭证、2MB 响应限制、7 规则智能输入验证、竞态保护</li>
                <li><b>多端覆盖</b>：同一套场景与路由思路也提供 VSCode / 浏览器扩展 / Web 在线版</li>
            </ul>
            <b>如何触发（关键）</b>
            <ul>
                <li><b>右键菜单顶层</b>：编辑器中选中文本后右键，直接点击 “Easy Prompt：智能增强 / 增强选中文本”</li>
                <li><b>侧边栏面板</b>：右侧 ToolWindow 打开 “Easy Prompt” 面板，一键操作 + 新手指引</li>
                <li><b>Tools 菜单</b>：Tools → Easy Prompt</li>
                <li><b>状态栏</b>：右下角状态栏 Easy Prompt → 打开快捷菜单</li>
            </ul>
            <b>快捷键</b>
            <ul>
                <li><b>Ctrl+Alt+I</b>：智能增强</li>
                <li><b>Ctrl+Alt+P</b>：增强选中文本（无选中时会自动转智能增强）</li>
                <li><b>Ctrl+Alt+O</b>：快速输入增强</li>
                <li><b>Ctrl+Alt+L</b>：浏览场景列表</li>
                <li><b>Ctrl+Alt+M</b>：指定场景增强</li>
                <li><b>Ctrl+Alt+Y</b>：增强历史</li>
                <li><b>Ctrl+Alt+H</b>：使用教程 / 新手指引</li>
            </ul>
            <b>配置</b>
            <ul>
                <li>Settings → Tools → Easy Prompt：支持一键「测试并保存」</li>
                <li>支持自定义 Base URL / API Key / Model（以你的服务商为准，兼容 OpenAI 风格接口）</li>
            </ul>
            <b>链接</b>
            <ul>
                <li>GitHub：<a href="https://github.com/FlippySun/Easy-Prompt">https://github.com/FlippySun/Easy-Prompt</a></li>
                <li>Web 在线版：<a href="https://prompt.zhiz.chat">https://prompt.zhiz.chat</a></li>
            </ul>

            <br/><br/>
            <b>English</b>
            <br/><br/>
            <b>Easy Prompt</b> is an AI prompt enhancer for IntelliJ IDEA. It uses a two-step pipeline (intent/scene recognition → professional prompt generation) to turn rough text into structured, high-quality prompts.
            <br/><br/>
            <b>Quick Start (30 seconds)</b>
            <ul>
                <li>Write your requirement in the editor (it can be short and messy — that's fine).</li>
                <li>Select the text → right click (top-level menu) → “Easy Prompt: Smart Enhance / Enhance Selection”.</li>
                <li>Or use shortcuts: <b>Ctrl+Alt+I</b> (Smart Enhance) / <b>Ctrl+Alt+P</b> (Enhance Selection). On macOS, Alt = Option.</li>
                <li>For a guided entry, open the right-side <b>ToolWindow</b>: Easy Prompt panel (quick actions + onboarding).</li>
            </ul>
            <b>Key Features</b>
            <ul>
                <li><b>Two-step AI routing</b>: detect intent/scene first, then generate a professional prompt</li>
                <li><b>Composite intent support</b>: handles multiple intents in a single input</li>
                <li><b>85 scenes + 10 personas</b>: covers dev, content, product, marketing, design, data, HR, support, startups, education</li>
                <li><b>Smart enhance</b>: automatically picks from selection / current file / clipboard</li>
                <li><b>History</b>: before/after comparison, copy, delete</li>
                <li><b>Smart Nudge</b>: (Browser Extension) pops an enhancement reminder when you pause typing on AI sites (ChatGPT/Claude/Gemini, etc.)</li>
                <li><b>Multi-provider</b>: OpenAI / Azure / Gemini / DeepSeek / Ollama</li>
                <li><b>Works out of the box</b>: built-in provider; optional custom API (OpenAI/Gemini/DeepSeek/Ollama, etc.)</li>
                <li><b>Hardened</b>: AES-256-CBC encrypted defaults, 2MB response cap, 7-rule input validation, race-condition protection</li>
                <li><b>Multi-platform</b>: also available on VSCode / Browser Extension / Web</li>
            </ul>
            <b>How to Trigger</b>
            <ul>
                <li><b>Top-level context menu</b>: select text → right click → “Easy Prompt: Smart Enhance / Enhance Selection”</li>
                <li><b>ToolWindow</b>: open the right-side “Easy Prompt” panel</li>
                <li><b>Tools menu</b>: Tools → Easy Prompt</li>
                <li><b>Status bar</b>: bottom-right “Easy Prompt” → open quick menu</li>
            </ul>
            <b>Shortcuts</b>
            <ul>
                <li><b>Ctrl+Alt+I</b>: Smart Enhance</li>
                <li><b>Ctrl+Alt+P</b>: Enhance Selection (falls back to Smart Enhance when nothing is selected)</li>
                <li><b>Ctrl+Alt+O</b>: Enhance Input</li>
                <li><b>Ctrl+Alt+L</b>: Browse Scenes</li>
                <li><b>Ctrl+Alt+M</b>: Enhance with Scene</li>
                <li><b>Ctrl+Alt+Y</b>: History</li>
                <li><b>Ctrl+Alt+H</b>: Tutorial / Onboarding</li>
            </ul>
            <b>Configuration</b>
            <ul>
                <li>Settings → Tools → Easy Prompt: one-click “Test & Save”</li>
                <li>Custom Base URL / API Key / Model (OpenAI-compatible API style)</li>
            </ul>
            <b>Links</b>
            <ul>
                <li>GitHub: <a href="https://github.com/FlippySun/Easy-Prompt">https://github.com/FlippySun/Easy-Prompt</a></li>
                <li>Web: <a href="https://prompt.zhiz.chat">https://prompt.zhiz.chat</a></li>
            </ul>
        """.trimIndent()
        vendor {
            name = "Easy Prompt"
            url = "https://github.com/FlippySun/Easy-Prompt"
        }
        ideaVersion {
            sinceBuild = "243"
        }
        changeNotes = """
            <h3>v5.2.1 — IntelliJ 可发现性提升 & 全端描述双语化</h3>
            <b>IntelliJ 插件体验升级</b>
            <ul>
                <li><b>新增 ToolWindow 侧边栏面板</b>：右侧"Easy Prompt"面板（JCEF 渲染），新手指引 + 一键触发全部功能</li>
                <li><b>新增右键菜单顶层入口</b>：选中文本右键直接出现"智能增强/增强选中"（无需子菜单）</li>
                <li><b>新增 Tools 菜单入口</b>：Tools → Easy Prompt（全部 7 个 Action）</li>
                <li><b>新增状态栏快捷菜单</b>：右下角"Easy Prompt"一键打开 7 项快捷操作</li>
                <li><b>新增首次安装指引</b>：自动打开 ToolWindow + 通知提示多入口位置</li>
                <li><b>统一插件图标</b>：Marketplace / 已安装列表 / ToolWindow 均使用 Sparkles 风格 SVG</li>
                <li><b>统一快捷键</b>：全部为 Ctrl+Alt+X（含 Mac OS X keymap），与 VSCode 一致</li>
            </ul>
            <b>全端市场描述双语化</b>
            <ul>
                <li>IntelliJ Marketplace 描述扩写为完整中英双语</li>
                <li>VSCode Marketplace（README）追加英文翻译</li>
                <li>修复 README 中 Smart Nudge 行乱码字符</li>
            </ul>
            <h3>v5.2.0 — 默认模型升级</h3>
            <ul>
                <li>升级：默认 AI 模型切换至 Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)</li>
                <li>升级：默认 API 提供商切换至 ModelVerse</li>
                <li>同步：全端默认配置统一更新</li>
            </ul>
            <h3>v5.1.1 — 链接修正 & 多端同步</h3>
            <ul>
                <li>修正：多端 Web 在线版链接统一指向 https://prompt.zhiz.chat</li>
                <li>新增：浏览器扩展 + VSCode Welcome 页添加 Web 在线版入口</li>
                <li>修正：IntelliJ Marketplace 描述中 Web 添加超链接</li>
            </ul>
            <h3>v5.1.0 — 智能输入验证增强</h3>
            <ul>
                <li>增强：输入验证升级为 7 规则引擎 — 最小长度/有效字符/字母检测/重复字符/纯URL/纯邮箱/纯路径</li>
                <li>增强：支持 Unicode 全脚本字符检测（CJK/拉丁/阿拉伯等）</li>
                <li>优化：放宽最小长度至 2 字符，适配 CJK 双字词（如"翻译"）</li>
                <li>同步：五端（VSCode/IntelliJ/Web/Browser/Content Script）验证逻辑完全一致</li>
            </ul>
            <h3>v5.0.1 — IntelliJ 兼容性升级 + 浏览器扩展稳定性修复</h3>
            <ul>
                <li>升级：SDK 2024.1 → 2024.3，解决 CredentialAttributes 废弃构造函数警告</li>
                <li>修复：全部 8 个 Action 添加 getActionUpdateThread()，解决 Marketplace 验证警告</li>
                <li>修复：StatusBarWidget 移除废弃 getPresentation() 覆写</li>
                <li>升级：构建工具链 JDK 17 → 21，sinceBuild 241 → 243</li>
                <li>修复：Browser Popup debounce 状态丢失 + selectScene 恢复重复保存</li>
                <li>修复：Browser Popup 动画 class 残留 + 定时器泄漏 + 事件穿透</li>
                <li>修复：Web 端清空按钮进度条残留 + CSS 变量 + 复制按钮样式</li>
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
