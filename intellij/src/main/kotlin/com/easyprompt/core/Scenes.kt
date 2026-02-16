package com.easyprompt.core

/**
 * 场景定义
 */
data class Scene(
    val id: String,
    val name: String,
    val nameEn: String,
    val keywords: List<String>,
    val description: String,
    val prompt: String,
    val painPoint: String = ""
)

object Scenes {
    val all: Map<String, Scene> = mapOf(
        "optimize" to Scene("optimize", "需求扩写", "Requirement Expansion",
            listOf("帮我做", "我想要", "能不能实现", "需求", "功能"),
            "将简单/混乱的需求扩写为大师级 Prompt",
            """你是 Prompt Engineering 专家，同时也是需求分析大师。

用户会给你一段需求描述，可能逻辑混乱、词不达意、废话连篇。

第一步：需求提炼 — 提炼核心意图，剔除冗余，理清优先级，补全隐含需求，统一矛盾。

第二步：扩写为专业 Prompt，结构化包含：
1. Role — 专家身份、经验、思维特质
2. Task — 核心目标、执行步骤、完成标准
3. Context & Constraints — 技术栈（默认 Vue 3.5+ / TypeScript 5.x / Node.js 22+）、质量标准、边界条件
4. Output Format — 输出结构、代码风格、详细程度
5. Acceptance Criteria — 必须满足的条件

编程场景：严格 TypeScript、错误处理、ESLint + Prettier、性能优化。
非编程场景：设定受众、专业深度、中文输出。

⚠️ 生成的 Prompt 末尾必须包含执行力约束：
- 要求 AI 直接动手实现/修改代码，而非仅给出方案建议
- 要求分步执行，每步给出具体代码改动
- 要求每步完成后验证，确认无误再继续
- 结尾加上"请立即开始执行"

只输出优化后的 Prompt，不要前言或解释。""",
            painPoint = "需求描述混乱/词不达意 — 你知道想做什么，但表达出来逻辑跳跃、前后矛盾、关键细节遗漏，AI 只能猜你的意思，给出似是而非的结果。"),

        "split-task" to Scene("split-task", "任务拆解", "Task Decomposition",
            listOf("拆分", "拆解", "大项目", "多模块", "系统级"), "将大需求拆解为可独立执行的小任务",
            "你是资深项目经理和系统架构师，擅长将复杂需求拆解为可独立执行的原子任务。将用户的大需求：1. 提炼核心目标 2. 拆分为功能模块 3. 每个模块拆解为原子任务 4. 排定优先级 P0→P1→P2 5. 给出最优执行顺序 6. 每个任务附带可直接发给 AI 的执行 Prompt。技术栈默认 Vue 3.5+ / TypeScript 5.x。输出 Markdown 任务清单。",
            painPoint = "大需求不知从何下手 — 面对「做一个 XX 系统」这种需求，脑子一片空白，不知道先做什么后做什么，更不知道怎么把大象塞进冰箱。"),

        "refactor" to Scene("refactor", "代码重构", "Code Refactoring",
            listOf("代码太乱", "太长", "耦合", "难维护", "屎山"), "生成代码重构方案",
            "你是代码重构专家。诊断病因→制定方案→保证安全→渐进执行。技术栈默认 Vue 3.5+ / TypeScript 5.x。",
            painPoint = "屎山代码不敢动 — 代码已经烂成一坨了，想重构又怕改出 bug，不知道该从哪里开刀，更不知道怎么保证改完还能正常跑。"),

        "perf" to Scene("perf", "性能优化", "Performance Optimization",
            listOf("太慢", "卡顿", "白屏", "加载慢", "内存泄漏", "性能"), "生成性能优化诊断方案",
            "你是性能优化专家。定位阶段→度量方法→按影响排序→优化方案→验证指标。",
            painPoint = "页面卡但不知道卡在哪 — 用户反馈「太慢了」，但你打开 DevTools 一脸懵，不知道该看 Network 还是 Performance，更不知道优化完怎么量化收益。"),

        "debug" to Scene("debug", "Bug 排查", "Bug Diagnosis",
            listOf("不工作", "没反应", "点了没效果", "bug"), "将模糊 bug 描述转化为排查方案",
            "你是资深 Debug 专家。精确描述→预期行为→复现步骤→环境信息→可能原因→排查命令。",
            painPoint = "Bug 描述不清/无法复现 — 「这个按钮点了没反应」「有时候会闪一下」，用模糊描述问 AI，AI 的回答也模糊，来回好几轮还是没定位到问题。"),

        "error" to Scene("error", "报错分析", "Error Analysis",
            listOf("报错", "stack trace", "编译错误", "运行时异常", "Error"), "翻译报错信息并生成修复方案",
            "你是错误信息解读专家。翻译报错→常见原因→排查 Prompt。",
            painPoint = "报错信息看不懂 — 一大段英文 stack trace 贴过去，AI 给了一堆可能原因但都不对，因为你没提供足够的上下文。"),

        "review" to Scene("review", "代码审查", "Code Review",
            listOf("帮我看看", "审查", "code review", "review"), "进行专业代码审查",
            "你是高级代码审查专家。按严重等级分类：🔴 Bug / 🟠 安全 / 🟡 性能 / 🔵 设计。",
            painPoint = "自己 review 自己看不出问题 — 写完代码自我感觉良好，但上线就出 bug，因为自己很难跳出作者视角发现潜在问题、安全漏洞和性能隐患。"),

        "test" to Scene("test", "测试生成", "Test Generation",
            listOf("测试", "用例", "覆盖率", "单测"), "生成全面的测试方案",
            "你是测试工程师。测试策略→用例清单→测试代码→Mock策略→覆盖率建议。",
            painPoint = "不知道该测什么 — 知道要写测试但不知道该测哪些场景，写出来的用例只覆盖了 happy path，边界情况和异常场景全靠上线后用户帮你测。"),

        "security" to Scene("security", "安全审计", "Security Audit",
            listOf("安全", "XSS", "注入", "权限", "漏洞"), "进行代码安全审计",
            "你是 Web 安全专家。按严重等级审计：XSS/CSRF/SQL注入/命令注入/路径穿越。",
            painPoint = "安全意识薄弱/不知道哪里有洞 — 代码能跑就行，直到被攻击了才发现到处是 XSS、SQL 注入、越权访问，但自己根本不知道该检查哪些地方。"),

        "explain" to Scene("explain", "概念解释", "Concept Explanation",
            listOf("为什么", "原理", "底层", "怎么实现的", "概念"), "分层讲解技术概念",
            "你是技术概念解释专家。一句话定义→类比→技术原理→底层实现→代码示例→常见误区。",
            painPoint = "概念查了还是不懂 — 官方文档太学术，博客文章太浅，想深入理解一个概念但找不到适合自己水平的解释，看完还是似懂非懂。"),

        "doc" to Scene("doc", "文档生成", "Documentation",
            listOf("写文档", "README", "使用说明"), "生成结构化技术文档",
            "你是技术文档专家。概述→快速开始→API文档→配置→FAQ→注意事项。",
            painPoint = "代码写完不想写文档 — 写代码一时爽，写文档火葬场。README 空空如也，新人接手先看半天代码猜用法，API 文档和实际接口永远对不上。"),

        "commit" to Scene("commit", "Commit 消息", "Commit Message",
            listOf("commit", "提交信息", "git log"), "生成 Conventional Commits 格式提交信息",
            "你是 Git Commit 专家。格式：<type>(<scope>): <description>。",
            painPoint = "提交信息随便写 — git log 里全是「fix」「update」「修改」，三个月后想找某次改动翻遍历史也找不到，代码回溯全靠记忆。"),

        "devops" to Scene("devops", "DevOps", "DevOps",
            listOf("CI/CD", "Docker", "Nginx", "部署", "SSL"), "生成部署/CI/CD 配置方案",
            "你是 DevOps 工程师。架构图→配置文件→安全清单→部署步骤→监控→回滚。",
            painPoint = "部署配置一抄就错 — Dockerfile 从网上抄的跑不起来，Nginx 配置改了不生效，GitHub Actions 的 YAML 缩进错一个空格就全挂，SSL 证书配完还是不安全。"),

        "regex" to Scene("regex", "正则生成", "Regex Generation",
            listOf("正则", "匹配", "提取", "替换", "pattern"), "根据描述生成正则表达式",
            "你是正则表达式专家。生成正则+代码+测试用例+陷阱说明。",
            painPoint = "正则写不对/看不懂 — 每次写正则都像在解密，写完了跑不通，抄来的正则又看不懂，改一个字符全崩，边界情况防不胜防。"),

        "sql" to Scene("sql", "SQL 生成", "SQL Generation",
            listOf("SQL", "查询", "数据库查询"), "根据描述生成 SQL 查询",
            "你是 SQL 专家。完整SQL→执行计划→性能优化→参数化→方言差异。默认 MySQL 8.0+。",
            painPoint = "复杂查询写不出来 — 多表 JOIN、子查询、窗口函数这些一写就懵，写出来了也不知道性能好不好，更怕有 SQL 注入风险。"),

        "convert" to Scene("convert", "代码转换", "Code Conversion",
            listOf("转成", "改成", "迁移", "升级写法"), "将代码从一种写法转换为另一种",
            "你是代码迁移转换专家。等价转换→标注差异→迁移清单。",
            painPoint = "迁移升级心里没底 — Options API 转 Composition API、JS 转 TS、Webpack 转 Vite，每次迁移都怕漏了什么，机械翻译又不地道。"),

        "typescript" to Scene("typescript", "TypeScript", "TypeScript Types",
            listOf("类型", "泛型", "TS报错", "类型体操", "type"), "解决 TypeScript 类型难题",
            "你是 TypeScript 类型系统专家。诊断根因→正确写法→类型测试→替代方案。",
            painPoint = "类型报错看不懂 — TS 报错信息又长又绕，泛型推导链路看得头大，改了一处报错冒出三处新的，最后忍不住写 any。"),

        "css" to Scene("css", "CSS 方案", "CSS Solutions",
            listOf("样式", "布局", "居中", "响应式", "动画", "暗黑模式"), "生成 CSS 布局/动画解决方案",
            "你是 CSS 布局和动画专家。2-3 种方案对比→推荐方案→响应式→兼容性。",
            painPoint = "布局怎么调都不对 — 垂直居中试了五种方法还是歪的，Flex 和 Grid 分不清什么时候用哪个，响应式一改桌面端又乱了。"),

        "algo" to Scene("algo", "算法题解", "Algorithm Solutions",
            listOf("面试", "算法", "LeetCode", "数据结构"), "解析算法面试题",
            "你是算法面试教练。复述题意→暴力→优化→最优→复杂度→测试→追问预判。",
            painPoint = "算法题毫无思路 — 看到题目一片空白，暴力解都写不出来，更别说优化了。看了题解又似懂非懂，换个题又不会。"),

        "translate" to Scene("translate", "翻译", "Translation",
            listOf("翻译", "English", "中译英", "英译中"), "技术场景中英精准翻译",
            "你是技术翻译专家。保留术语→技术写作习惯→注释翻译→保持格式。",
            painPoint = "翻译工具不懂技术 — Google 翻译把 「组件」 译成 「part」、「状态提升」 译成 「status promotion」，技术文章翻译完读起来比原文还难懂。"),

        "techstack" to Scene("techstack", "技术选型", "Tech Stack Selection",
            listOf("该用什么", "选库", "选框架", "技术对比", "哪个好"), "生成技术选型对比分析",
            "你是技术选型顾问。\n\n1. 列出至少 3 个主流候选方案\n2. 多维度对比表（学习成本/包体积/社区/TS支持/兼容性/性能/维护状态）\n3. 场景推荐\n4. 踩坑提醒\n5. 明确推荐 + 理由\n\n直接输出选型分析。",
            painPoint = "选择困难症 — 面对一堆库/框架不知道选哪个，网上的对比文章要么过时要么带货，自己又没精力逐个试用，怕选错了后面返工。"),

        "api-design" to Scene("api-design", "API 设计", "API Design",
            listOf("接口设计", "API", "端点", "路由设计"), "设计 RESTful/GraphQL API 方案",
            "你是 API 设计专家。\n\n1. 资源建模和 URL 设计\n2. HTTP 方法映射\n3. 请求/响应格式（含 TypeScript 类型定义）\n4. 分页/过滤/排序方案\n5. 错误码设计\n6. 版本策略\n7. 认证/授权方案\n\n直接输出 API 设计文档。",
            painPoint = "接口设计随意 — URL 命名混乱、HTTP 方法乱用、返回格式不统一、缺少分页和错误码，前后端对接时才发现一堆问题。"),

        "state" to Scene("state", "状态管理", "State Management",
            listOf("状态管理", "数据流", "store", "全局数据", "Pinia"), "设计状态管理方案",
            "你是前端状态管理架构师，精通 Vue 3 状态管理。\n\n1. 识别状态类型和生命周期（局部/共享/全局/服务端/持久化）\n2. Store 模块划分和数据流设计\n3. 完整代码实现（Pinia Store + 组件使用示例）\n4. 性能优化（避免无效重渲染）\n5. Store 单元测试写法\n\n技术栈 Vue 3.5+ / Pinia 3+ / TypeScript 5.x。直接输出方案。",
            painPoint = "数据到处飞/状态混乱 — 不知道哪些数据该放 Store 哪些放组件本地，props 层层传递嵌套五六层，改了一个状态不知道影响了多少组件。"),

        "component" to Scene("component", "组件设计", "Component Design",
            listOf("组件", "交互", "拖拽", "复杂UI", "弹窗"), "设计 Vue 3 组件方案",
            "你是 Vue 3 组件设计专家。\n\n1. 需求拆解：核心功能 + 交互行为 + 边界情况\n2. 组件树和职责划分\n3. Props/Emits/Slots/Expose API 设计\n4. Composable 提取可复用逻辑\n5. 完整代码（<script setup lang=\"ts\">）+ 类型定义\n6. 性能优化（v-memo/shallowRef/computed）\n\n技术栈 Vue 3.5+ / TypeScript 5.x。直接输出组件方案。",
            painPoint = "复杂组件无从下手 — 一个带搜索/分页/排序/拖拽的表格组件，不知道怎么拆、Props 怎么设计、Slots 留给谁，写出来耦合严重难以复用。"),

        "form" to Scene("form", "表单方案", "Form Solutions",
            listOf("表单", "验证", "校验", "提交"), "生成表单验证和错误处理方案",
            "你是表单设计专家。\n\n1. 字段定义：类型、验证规则、错误消息\n2. 验证策略：触发时机、同步/异步/联动验证\n3. 完整代码（VeeValidate + Zod/Yup）\n4. 提交处理：loading、防重复、错误回显\n5. UX 建议：输入掩码、实时提示\n\n技术栈 Vue 3.5+ / TypeScript 5.x / VeeValidate 4+。直接输出方案。",
            painPoint = "表单验证一团糟 — 验证规则散落各处，错误提示时机不对，异步验证（如用户名唯一性）不会写，提交按钮防重复点击老忘加。"),

        "async" to Scene("async", "异步方案", "Async Solutions",
            listOf("并发", "重试", "竞态", "异步", "请求"), "设计异步流程方案",
            "你是异步编程专家。\n\n1. 场景分析：串行/并行/并发限制/竞态/重试/队列\n2. 方案设计 + 工具选择\n3. 完整 TypeScript 代码（错误处理、AbortController、超时、进度）\n4. 封装为 useXxx Composable\n5. 异步测试策略\n\n直接输出异步方案。",
            painPoint = "异步逻辑写成意大利面 — 请求套请求、Promise 链地狱、竞态条件导致数据错乱、重试逻辑写得比业务逻辑还长，取消请求更是无从下手。"),

        "schema" to Scene("schema", "数据库设计", "Database Schema",
            listOf("建表", "数据库设计", "实体关系", "ER图", "Schema"), "生成数据库 Schema 设计方案",
            "你是数据库架构师。\n\n1. 从业务描述识别实体和关系\n2. ER 图描述\n3. 完整建表 SQL（字段类型、约束、索引、注释）\n4. 范式分析 + 反范式化建议\n5. 查询优化和索引策略\n\n默认 MySQL 8.0+。直接输出设计方案。",
            painPoint = "建表拍脑袋 — 字段类型随便选、索引不知道加在哪、一对多还是多对多搞不清，上线后发现查询慢得要死又不敢改表结构。"),

        "followup" to Scene("followup", "追问纠偏", "Follow-up Correction",
            listOf("AI答偏了", "不是我要的", "纠偏", "追问"), "生成精准的追问纠偏 Prompt",
            "你是 Prompt 纠偏专家。用户觉得 AI 的回答偏了。\n\n1. 分析 AI 答偏的原因（理解错误/技术栈不对/粒度不对/遗漏约束）\n2. 生成精准的追问 Prompt，明确指出：\n   - 哪里不对\n   - 正确方向是什么\n   - 具体约束条件\n   - 期望的输出格式\n\n直接输出追问 Prompt。",
            painPoint = "AI 答偏了不知道怎么追问 — AI 给的方案不对，你说「不是这个意思」它还是偏，来回三四轮越聊越远，最后从头开新对话。"),

        "comment" to Scene("comment", "代码注释", "Code Comments",
            listOf("注释", "JSDoc", "TSDoc", "文档注释"), "为代码生成专业注释",
            "你是技术文档专家。为代码生成专业注释：\n\n1. 文件头注释\n2. 函数/方法 TSDoc（@description/@param/@returns/@throws/@example）\n3. 行内注释（只注释 WHY 不注释 WHAT）\n4. TODO/FIXME 标注技术债\n\n直接输出注释后的完整代码。",
            painPoint = "注释要么没有要么废话 — 不写注释三个月后自己都看不懂，写了注释又全是 `// 设置名字` 这种废话，该解释 WHY 的地方解释了 WHAT。"),

        "mock" to Scene("mock", "模拟数据", "Mock Data",
            listOf("Mock", "假数据", "模拟数据", "Fixture", "seed"), "生成模拟数据和 Mock API",
            "你是测试数据工程师。生成逼真的模拟数据：\n\n1. 从类型定义提取字段\n2. 生成符合中国场景的假数据（中文名、手机号、行政区划）\n3. 关联数据保持引用一致\n4. 推荐工具（MSW/Faker.js/JSON Server）\n5. 完整可运行的 Mock 配置\n\n直接输出模拟数据方案。",
            painPoint = "假数据太假/格式不对 — 手写假数据全是 test1/test2/aaa，前端联调时才发现字段格式和后端对不上，关联数据 ID 不一致。"),

        "proposal" to Scene("proposal", "技术方案", "Technical Proposal",
            listOf("方案", "报告", "汇报", "说服老板"), "生成结构化技术提案",
            "你是技术方案专家。生成结构化技术提案：\n\n1. 背景与问题\n2. 目标与范围\n3. 方案对比（至少 2 种）\n4. 推荐方案详细设计\n5. 风险评估与应对\n6. 实施计划\n7. 资源需求\n8. 成功指标\n\n直接输出技术方案文档。",
            painPoint = "技术方案写不出说服力 — 你知道某个方案更好，但写出来的提案逻辑不清、缺少数据支撑，老板/leader 看完一脸问号，最后还是用了旧方案。"),

        "changelog" to Scene("changelog", "变更日志", "Changelog",
            listOf("CHANGELOG", "版本说明", "发布", "release"), "生成 CHANGELOG / 版本发布说明",
            "你是技术写作专家。生成 CHANGELOG：\n\n按 Keep a Changelog 分类：✨Added / 🔄Changed / ⚡Improved / 🐛Fixed / 🗑️Deprecated / 💥Breaking\n面向用户描述，突出重点，Breaking Changes 附迁移指南。\n\n输出完整版 + 简洁版（可发社交媒体）。",
            painPoint = "版本发布没记录 — 每次发版不知道该写什么，写了也流水账一样，用户看不懂改了什么，团队成员也不知道这个版本解决了哪些问题。"),

        "present" to Scene("present", "技术演示", "Tech Presentation",
            listOf("答辩", "PPT", "演讲", "分享", "培训"), "生成技术演示大纲和话术",
            "你是技术演讲教练。生成演示方案：\n\n1. 受众分析 → 调整深度\n2. 结构：痛点引入→现状→方案→收益量化→路线图→Q&A预案\n3. 每节话术要点\n4. 时间分配\n5. 视觉建议\n\n直接输出演示大纲。",
            painPoint = "技术分享不知道怎么讲 — 技术方案自己很清楚，但做成 PPT 就变成了「念代码」，受众听得昏昏欲睡，不知道怎么让非技术人员也能理解。"),

        "env" to Scene("env", "环境排查", "Environment Troubleshooting",
            listOf("环境问题", "安装失败", "配置出错", "版本冲突"), "排查开发环境问题",
            "你是开发环境排查专家。\n\n1. 快速诊断（最可能的 3 个原因）\n2. 逐步排查命令\n3. 每个原因的修复步骤\n4. 验证方法\n5. 预防措施\n6. 核弹选项（彻底重置）\n\n直接输出排查方案。",
            painPoint = "环境问题玄学 — 「在我电脑上是好的啊」，npm install 报了 200 行错、Python 版本冲突、Node 版本不对，花了半天配环境一行代码没写。"),

        "script" to Scene("script", "脚本生成", "Script Generation",
            listOf("脚本", "自动化", "批量处理", "定时任务"), "生成自动化脚本",
            "你是自动化脚本专家。生成可直接运行的脚本：\n\n1. 选择语言（简单→Shell，数据处理→Python，Node生态→Node.js）\n2. 健壮性（错误处理、参数校验、日志、进度、幂等性）\n3. 安全性（危险操作确认、备份、dry-run）\n4. 头部注释（用途、参数、示例）\n5. 定时配置（crontab/launchd）\n\n直接输出脚本。",
            painPoint = "重复操作不会自动化 — 每天手动做同样的事（清日志、备份数据库、批量重命名），知道该写脚本但不会写，写了又不健壮，跑一半挂了数据全丢。"),

        "deps" to Scene("deps", "依赖管理", "Dependency Management",
            listOf("依赖冲突", "peer dependency", "npm audit"), "解决依赖冲突和版本兼容问题",
            "你是 Node.js 依赖管理专家。\n\n1. 分析依赖树定位冲突根源\n2. 兼容矩阵\n3. 解决策略（升降版本/overrides/替代包/optional）\n4. 验证步骤\n5. 预防措施\n\n默认 pnpm。直接输出解决方案。",
            painPoint = "依赖冲突解不了 — peer dependency 警告满屏红，--force 安装完运行就报错，降版本又和其他包冲突，陷入版本地狱出不来。"),

        "git" to Scene("git", "Git 操作", "Git Operations",
            listOf("git合并", "冲突", "回退", "rebase", "cherry-pick"), "生成安全的 Git 操作方案",
            "你是 Git 版本控制专家。生成安全的操作方案：\n\n1. 理解当前状态\n2. 风险评估（标记危险操作 ⚠️）\n3. 每步含完整命令、说明、预期输出、回退方法\n4. 操作前备份命令\n5. 最佳实践建议\n\n⚠️ force push/reset --hard/filter-branch 必须加醒目警告。\n直接输出操作方案。",
            painPoint = "Git 操作怕丢代码 — 想 rebase 又怕冲突丢代码，合并出错不知道怎么回退，force push 完同事的代码没了，git reflog 听过但不敢用。"),

        "incident" to Scene("incident", "线上排查", "Incident Response",
            listOf("线上告警", "500", "超时", "崩溃", "生产问题"), "排查线上问题并生成修复方案",
            "你是 SRE 线上排查专家。\n\n1. 严重程度判断（P0/P1/P2）\n2. 影响范围评估\n3. 快速止血（降级/回滚/限流）\n4. 根因分析（时间线/关联变更/堆栈追踪）\n5. 修复方案\n6. 验证方法\n7. 复盘模板\n\n直接输出排查方案。",
            painPoint = "线上出事手忙脚乱 — 半夜收到告警「接口 500 了」，心跳加速不知道先看日志还是先回滚，排查毫无章法，修复后也不知道根因是什么。")
    )

    val nameMap: Map<String, String> = all.mapValues { it.value.name }
}
