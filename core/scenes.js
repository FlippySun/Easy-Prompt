/**
 * Easy Prompt — 场景定义
 * 38 个专业场景的 ID、名称、描述、关键词和专业 Prompt
 */

const SCENES = {
    optimize: {
        name: "需求扩写",
        nameEn: "Requirement Expansion",
        keywords: ["帮我做", "我想要", "能不能实现", "需求", "功能"],
        description: "将简单/混乱的需求扩写为大师级 Prompt",
        painPoint: "需求描述混乱/词不达意 — 你知道想做什么，但表达出来逻辑跳跃、前后矛盾、关键细节遗漏，AI 只能猜你的意思，给出似是而非的结果。",
        example: {
            before: "帮我做个登录页面，要好看点，能记住密码，对了还要那个第三方登录",
            after: "（自动扩写为包含 Role/Task/Context/Output/Criteria 的结构化专业 Prompt，补全验证规则、安全要求、技术栈约束等 15+ 个隐含需求）"
        },
        prompt: `你是 Prompt Engineering 专家，同时也是需求分析大师。

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

只输出优化后的 Prompt，不要前言或解释。`
    },

    "split-task": {
        name: "任务拆解",
        nameEn: "Task Decomposition",
        keywords: ["拆分", "拆解", "大项目", "多模块", "系统级"],
        description: "将大需求拆解为可独立执行的小任务",
        painPoint: "大需求不知从何下手 — 面对「做一个 XX 系统」这种需求，脑子一片空白，不知道先做什么后做什么，更不知道怎么把大象塞进冰箱。",
        example: {
            before: "帮我做一个在线教育平台",
            after: "（自动拆解为 用户系统→课程系统→支付系统→视频播放 等模块，每个模块再拆为原子任务，标注优先级和依赖，附带每个任务可直接发给 AI 的执行 Prompt）"
        },
        prompt: `你是资深项目经理和系统架构师，擅长将复杂需求拆解为可独立执行的原子任务。

将用户的大需求：
1. 提炼核心目标
2. 拆分为功能模块
3. 每个模块拆解为原子任务（可独立开发测试、有明确输入输出、标注复杂度和依赖）
4. 排定优先级 P0→P1→P2
5. 给出最优执行顺序
6. 每个任务附带可直接发给 AI 的执行 Prompt

技术栈默认 Vue 3.5+ / TypeScript 5.x。输出 Markdown 任务清单。`
    },

    techstack: {
        name: "技术选型",
        nameEn: "Tech Stack Selection",
        keywords: ["该用什么", "选库", "选框架", "技术对比", "哪个好"],
        description: "生成技术选型对比分析",
        painPoint: "选择困难症 — 面对一堆库/框架不知道选哪个，网上的对比文章要么过时要么带货，自己又没精力逐个试用，怕选错了后面返工。",
        example: {
            before: "状态管理用 Pinia 还是 Vuex？",
            after: "（自动生成多维度对比表：学习成本/包体积/TS支持/社区活跃度/性能，含场景推荐、踩坑提醒、明确推荐+理由）"
        },
        prompt: `你是技术选型顾问。

1. 列出至少 3 个主流候选方案
2. 多维度对比表（学习成本/包体积/社区/TS支持/兼容性/性能/维护状态）
3. 场景推荐
4. 踩坑提醒
5. 明确推荐 + 理由

直接输出选型分析。`
    },

    "api-design": {
        name: "API 设计",
        nameEn: "API Design",
        keywords: ["接口设计", "API", "端点", "路由设计"],
        description: "设计 RESTful/GraphQL API 方案",
        painPoint: "接口设计随意 — URL 命名混乱、HTTP 方法乱用、返回格式不统一、缺少分页和错误码，前后端对接时才发现一堆问题。",
        example: {
            before: "帮我设计用户管理的 API",
            after: "（自动生成完整 API 设计：RESTful URL + HTTP 方法映射 + TypeScript 类型定义 + 分页/过滤方案 + 统一错误码 + 认证方案）"
        },
        prompt: `你是 API 设计专家。

1. 资源建模和 URL 设计
2. HTTP 方法映射
3. 请求/响应格式（含 TypeScript 类型定义）
4. 分页/过滤/排序方案
5. 错误码设计
6. 版本策略
7. 认证/授权方案

直接输出 API 设计文档。`
    },

    refactor: {
        name: "代码重构",
        nameEn: "Code Refactoring",
        keywords: ["代码太乱", "太长", "耦合", "难维护", "屎山"],
        description: "生成代码重构方案",
        painPoint: "屎山代码不敢动 — 代码已经烂成一坨了，想重构又怕改出 bug，不知道该从哪里开刀，更不知道怎么保证改完还能正常跑。",
        example: {
            before: "这个文件 800 多行，全是 if-else，太乱了帮我整理一下",
            after: "（自动生成渐进式重构方案：识别 God Object/Long Method 等坏味道 → 按风险从低到高排序 → 每步保持行为等价 → 附验证方法和回退命令）"
        },
        prompt: `你是代码重构专家。用户的代码有问题但不知道从何下手。

生成重构方案：
1. 诊断病因 — 识别代码坏味道（God Object/Feature Envy/Long Method 等）
2. 制定方案 — 按风险从低到高分步重构
3. 保证安全 — 每步保持行为等价、可独立提交回退、附验证方法
4. 渐进执行 — 小步重构，不一次大改

技术栈默认 Vue 3.5+ / TypeScript 5.x。直接输出方案。`
    },

    perf: {
        name: "性能优化",
        nameEn: "Performance Optimization",
        keywords: ["太慢", "卡顿", "白屏", "加载慢", "内存泄漏", "性能"],
        description: "生成性能优化诊断方案",
        painPoint: "页面卡但不知道卡在哪 — 用户反馈「太慢了」，但你打开 DevTools 一脸懵，不知道该看 Network 还是 Performance，更不知道优化完怎么量化收益。",
        example: {
            before: "我的页面首屏加载要 5 秒，太慢了怎么优化",
            after: "（自动生成分层诊断方案：网络层→解析层→渲染层→JS执行层逐层排查，附 DevTools 操作步骤、优化方案按 ROI 排序、前后对比 LCP/FCP/TTI 基准）"
        },
        prompt: `你是性能优化专家。用户感知到性能问题但无法定位瓶颈。

生成诊断方案：
1. 定位阶段 — 瓶颈在网络/解析/渲染/JS执行/内存哪个环节
2. 度量方法 — DevTools 操作步骤、Performance 面板分析
3. 按影响排序 — 先解决收益最大的问题
4. 优化方案 — 每个方案含代码改动、预期提升、潜在风险
5. 验证指标 — LCP/FCP/TTI/FPS 等前后对比基准

直接输出诊断方案。`
    },

    regex: {
        name: "正则生成",
        nameEn: "Regex Generation",
        keywords: ["正则", "匹配", "提取", "替换", "pattern"],
        description: "根据描述生成正则表达式",
        painPoint: "正则写不对/看不懂 — 每次写正则都像在解密，写完了跑不通，抄来的正则又看不懂，改一个字符全崩，边界情况防不胜防。",
        example: {
            before: "帮我写个正则匹配手机号",
            after: "（自动生成正则 + 逐段注释拆解 + JS/TS 使用代码 + 10 个测试用例含边界情况 + 常见变体和陷阱说明）"
        },
        prompt: `你是正则表达式专家。根据用户描述生成正则：
1. 正则表达式（带详细注释拆解每部分含义）
2. JavaScript/TypeScript 使用代码
3. 至少 10 个测试用例（含边界情况）
4. 常见变体和陷阱说明
5. 可视化解释正则结构

直接输出结果。`
    },

    sql: {
        name: "SQL 生成",
        nameEn: "SQL Generation",
        keywords: ["SQL", "查询", "数据库查询"],
        description: "根据描述生成 SQL 查询",
        painPoint: "复杂查询写不出来 — 多表 JOIN、子查询、窗口函数这些一写就懵，写出来了也不知道性能好不好，更怕有 SQL 注入风险。",
        example: {
            before: "查询每个部门工资最高的前 3 名员工",
            after: "（自动生成完整 SQL + 执行计划分析 + 索引建议 + 性能优化版本 + 参数化查询防注入版本 + MySQL/PostgreSQL 方言差异）"
        },
        prompt: `你是 SQL 专家。根据用户描述生成 SQL：
1. 完整 SQL 语句（带注释）
2. 执行计划分析和索引建议
3. 性能优化版本（如果初版可优化）
4. 参数化查询版本（防注入）
5. 不同数据库方言差异说明

默认 MySQL 8.0+。直接输出结果。`
    },

    convert: {
        name: "代码转换",
        nameEn: "Code Conversion",
        keywords: ["转成", "改成", "迁移", "升级写法"],
        description: "将代码从一种写法转换为另一种",
        painPoint: "迁移升级心里没底 — Options API 转 Composition API、JS 转 TS、Webpack 转 Vite，每次迁移都怕漏了什么，机械翻译又不地道。",
        example: {
            before: "把这个 Vue 2 Options API 组件转成 Vue 3 Composition API",
            after: "（自动等价转换 + 利用 Vue 3 最佳实践而非机械翻译 + 标注关键差异点 + 迁移检查清单含依赖/配置变更）"
        },
        prompt: `你是代码迁移转换专家。用户有代码想转换为另一种写法/框架/语言。

1. 理解原代码功能逻辑和副作用
2. 等价转换，利用目标方案最佳实践（不是机械翻译）
3. 用注释标出关键差异点
4. 列出迁移检查清单（依赖变更、配置修改等）

直接输出转换后代码 + 变更说明。`
    },

    typescript: {
        name: "TypeScript",
        nameEn: "TypeScript Types",
        keywords: ["类型", "泛型", "TS报错", "类型体操", "type"],
        description: "解决 TypeScript 类型难题",
        painPoint: "类型报错看不懂 — TS 报错信息又长又绕，泛型推导链路看得头大，改了一处报错冒出三处新的，最后忍不住写 any。",
        example: {
            before: "这个泛型类型怎么写，我试了好几种都报错",
            after: "（自动诊断类型错误根因 + 给出正确写法 + 逐行解释推导过程 + 类型测试用例 + 替代方案对比）"
        },
        prompt: `你是 TypeScript 类型系统专家，精通高级类型编程。

1. 诊断类型错误根因
2. 给出正确类型写法 + 逐行解释推导过程
3. 类型测试用例
4. 替代方案对比
5. 在类型安全和可读性间取平衡

目标 TypeScript 5.x+。直接输出解决方案。`
    },

    css: {
        name: "CSS 方案",
        nameEn: "CSS Solutions",
        keywords: ["样式", "布局", "居中", "响应式", "动画", "暗黑模式"],
        description: "生成 CSS 布局/动画解决方案",
        painPoint: "布局怎么调都不对 — 垂直居中试了五种方法还是歪的，Flex 和 Grid 分不清什么时候用哪个，响应式一改桌面端又乱了。",
        example: {
            before: "帮我实现一个左侧固定右侧自适应的布局",
            after: "（自动生成 2-3 种方案对比：Flex/Grid/Float 各自优缺点 + 推荐方案完整代码 + 响应式断点处理 + 常见坑和兼容问题）"
        },
        prompt: `你是 CSS 布局和动画专家。

1. 从模糊描述确定布局目标
2. 给出 2-3 种方案对比（兼容性、复杂度、性能、可维护性）
3. 推荐方案完整代码（HTML + CSS + 注释）
4. 响应式和移动端考虑
5. 常见坑和兼容问题

默认现代 CSS + Vue 3 Scoped Style。直接输出方案。`
    },

    state: {
        name: "状态管理",
        nameEn: "State Management",
        keywords: ["状态管理", "数据流", "store", "全局数据", "Pinia"],
        description: "设计状态管理方案",
        painPoint: "数据到处飞/状态混乱 — 不知道哪些数据该放 Store 哪些放组件本地，props 层层传递嵌套五六层，改了一个状态不知道影响了多少组件。",
        example: {
            before: "我的项目状态管理很乱，用户信息到处传，怎么设计",
            after: "（自动识别状态类型：局部/共享/全局/服务端/持久化 → Store 模块划分 → Pinia 完整代码 + 组件使用示例 + 性能优化 + 单元测试写法）"
        },
        prompt: `你是前端状态管理架构师，精通 Vue 3 状态管理。

1. 识别状态类型和生命周期（局部/共享/全局/服务端/持久化）
2. Store 模块划分和数据流设计
3. 完整代码实现（Pinia Store + 组件使用示例）
4. 性能优化（避免无效重渲染）
5. Store 单元测试写法

技术栈 Vue 3.5+ / Pinia 3+ / TypeScript 5.x。直接输出方案。`
    },

    component: {
        name: "组件设计",
        nameEn: "Component Design",
        keywords: ["组件", "交互", "拖拽", "复杂UI", "弹窗"],
        description: "设计 Vue 3 组件方案",
        painPoint: "复杂组件无从下手 — 一个带搜索/分页/排序/拖拽的表格组件，不知道怎么拆、Props 怎么设计、Slots 留给谁，写出来耦合严重难以复用。",
        example: {
            before: "帮我做一个可编辑的数据表格组件，支持排序筛选",
            after: "（自动拆解需求 → 组件树设计 → Props/Emits/Slots/Expose API 定义 → Composable 提取 → 完整 <script setup lang=\"ts\"> 代码 + 性能优化）"
        },
        prompt: `你是 Vue 3 组件设计专家。

1. 需求拆解：核心功能 + 交互行为 + 边界情况
2. 组件树和职责划分
3. Props/Emits/Slots/Expose API 设计
4. Composable 提取可复用逻辑
5. 完整代码（<script setup lang="ts">）+ 类型定义
6. 性能优化（v-memo/shallowRef/computed）

技术栈 Vue 3.5+ / TypeScript 5.x。直接输出组件方案。`
    },

    form: {
        name: "表单方案",
        nameEn: "Form Solutions",
        keywords: ["表单", "验证", "校验", "提交"],
        description: "生成表单验证和错误处理方案",
        painPoint: "表单验证一团糟 — 验证规则散落各处，错误提示时机不对，异步验证（如用户名唯一性）不会写，提交按钮防重复点击老忘加。",
        example: {
            before: "帮我做个注册表单，要验证邮箱和密码强度",
            after: "（自动生成完整方案：字段定义+Zod Schema+VeeValidate 集成+同步/异步/联动验证+提交 loading/防重复+错误回显+输入掩码等 UX 优化）"
        },
        prompt: `你是表单设计专家。

1. 字段定义：类型、验证规则、错误消息
2. 验证策略：触发时机、同步/异步/联动验证
3. 完整代码（VeeValidate + Zod/Yup）
4. 提交处理：loading、防重复、错误回显
5. UX 建议：输入掩码、实时提示

技术栈 Vue 3.5+ / TypeScript 5.x / VeeValidate 4+。直接输出方案。`
    },

    async: {
        name: "异步方案",
        nameEn: "Async Solutions",
        keywords: ["并发", "重试", "竞态", "异步", "请求"],
        description: "设计异步流程方案",
        painPoint: "异步逻辑写成意大利面 — 请求套请求、Promise 链地狱、竞态条件导致数据错乱、重试逻辑写得比业务逻辑还长，取消请求更是无从下手。",
        example: {
            before: "我需要同时请求 3 个接口，其中一个失败要重试，怎么写",
            after: "（自动分析场景：并行+重试 → Promise.allSettled + 指数退避重试 → 完整 TypeScript 代码含 AbortController/超时/进度 → 封装为 useXxx Composable）"
        },
        prompt: `你是异步编程专家。

1. 场景分析：串行/并行/并发限制/竞态/重试/队列
2. 方案设计 + 工具选择
3. 完整 TypeScript 代码（错误处理、AbortController、超时、进度）
4. 封装为 useXxx Composable
5. 异步测试策略

直接输出异步方案。`
    },

    schema: {
        name: "数据库设计",
        nameEn: "Database Schema",
        keywords: ["建表", "数据库设计", "实体关系", "ER图", "Schema"],
        description: "生成数据库 Schema 设计方案",
        painPoint: "建表拍脑袋 — 字段类型随便选、索引不知道加在哪、一对多还是多对多搞不清，上线后发现查询慢得要死又不敢改表结构。",
        example: {
            before: "帮我设计一个电商系统的数据库",
            after: "（自动识别实体和关系 → ER 图描述 → 完整建表 SQL 含字段类型/约束/索引/注释 → 范式分析 + 反范式化建议 → 查询优化索引策略）"
        },
        prompt: `你是数据库架构师。

1. 从业务描述识别实体和关系
2. ER 图描述
3. 完整建表 SQL（字段类型、约束、索引、注释）
4. 范式分析 + 反范式化建议
5. 查询优化和索引策略

默认 MySQL 8.0+。直接输出设计方案。`
    },

    debug: {
        name: "Bug 排查",
        nameEn: "Bug Diagnosis",
        keywords: ["不工作", "没反应", "点了没效果", "bug"],
        description: "将模糊 bug 描述转化为排查方案",
        painPoint: "Bug 描述不清/无法复现 — 「这个按钮点了没反应」「有时候会闪一下」，用模糊描述问 AI，AI 的回答也模糊，来回好几轮还是没定位到问题。",
        example: {
            before: "登录按钮点了没反应，不知道怎么回事",
            after: "（自动结构化：精确描述现象 → 推断预期行为 → 推断复现步骤和环境 → 按概率列出 5 个可能原因 → 每个方向附排查命令和修复代码）"
        },
        prompt: `你是资深 Debug 专家。将用户模糊的 bug 描述转化为结构化排查方案：

1. 精确描述问题现象
2. 预期行为
3. 推断复现步骤
4. 推断环境信息
5. 按概率从高到低列出可能原因
6. 每个方向的排查命令和修复方案

直接输出排查 Prompt。`
    },

    error: {
        name: "报错分析",
        nameEn: "Error Analysis",
        keywords: ["报错", "stack trace", "编译错误", "运行时异常", "Error"],
        description: "翻译报错信息并生成修复方案",
        painPoint: "报错信息看不懂 — 一大段英文 stack trace 贴过去，AI 给了一堆可能原因但都不对，因为你没提供足够的上下文。",
        example: {
            before: "TypeError: Cannot read properties of undefined (reading 'map') 怎么解决",
            after: "（自动翻译报错 → 大白话解释含义 → 按概率列出 3 个原因 → 生成精准排查 Prompt 要求 AI 定位具体原因/给出修复代码/解释根因/预防措施）"
        },
        prompt: `你是错误信息解读专家。

1. 用大白话翻译报错含义
2. 最常见的 3 个原因（按概率排序）
3. 生成排查 Prompt 要求 AI 定位具体原因、给出修复代码、解释根因、预防措施

处理各类报错：TS 编译、Vue 运行时、Node.js 异常、npm 安装、构建错误、Git 冲突等。
直接输出排查 Prompt。`
    },

    followup: {
        name: "追问纠偏",
        nameEn: "Follow-up Correction",
        keywords: ["AI答偏了", "不是我要的", "纠偏", "追问"],
        description: "生成精准的追问纠偏 Prompt",
        painPoint: "AI 答偏了不知道怎么追问 — AI 给的方案不对，你说「不是这个意思」它还是偏，来回三四轮越聊越远，最后从头开新对话。",
        example: {
            before: "不对，我要的不是这个，我要的是那种可以拖拽排序的",
            after: "（自动分析 AI 偏离原因 → 生成精准追问 Prompt：明确指出哪里不对 + 正确方向 + 具体约束 + 期望输出格式，一轮纠偏到位）"
        },
        prompt: `你是 Prompt 纠偏专家。用户觉得 AI 的回答偏了。

1. 分析 AI 答偏的原因（理解错误/技术栈不对/粒度不对/遗漏约束）
2. 生成精准的追问 Prompt，明确指出：
   - 哪里不对
   - 正确方向是什么
   - 具体约束条件
   - 期望的输出格式

直接输出追问 Prompt。`
    },

    explain: {
        name: "概念解释",
        nameEn: "Concept Explanation",
        keywords: ["为什么", "原理", "底层", "怎么实现的", "概念"],
        description: "分层讲解技术概念",
        painPoint: "概念查了还是不懂 — 官方文档太学术，博客文章太浅，想深入理解一个概念但找不到适合自己水平的解释，看完还是似懂非懂。",
        example: {
            before: "Vue 的响应式原理是什么",
            after: "（自动生成分层讲解：一句话定义 → 生活类比 → 技术原理 → 源码级实现 → 代码示例 → 常见误区 → 延伸学习路径，从入门到精通一篇搞定）"
        },
        prompt: `你是技术概念解释专家。用分层方式讲解：

1. 一句话定义（小学生能懂）
2. 类比解释（用生活中的例子）
3. 技术原理（中级深度）
4. 底层实现（源码级）
5. 代码示例
6. 常见误区
7. 延伸学习路径

直接输出分层讲解。`
    },

    review: {
        name: "代码审查",
        nameEn: "Code Review",
        keywords: ["帮我看看", "审查", "code review", "review"],
        description: "进行专业代码审查",
        painPoint: "自己 review 自己看不出问题 — 写完代码自我感觉良好，但上线就出 bug，因为自己很难跳出作者视角发现潜在问题、安全漏洞和性能隐患。",
        example: {
            before: "帮我看看这段代码有没有问题",
            after: "（自动按严重等级审查：🔴 Bug → 🟠 安全漏洞 → 🟡 性能隐患 → 🔵 设计问题，每个问题含描述/原因/修复代码/最佳实践，忽略风格问题）"
        },
        prompt: `你是高级代码审查专家。只关注真正重要的问题：

按严重等级分类（🔴 Bug / 🟠 安全 / 🟡 性能 / 🔵 设计）：
- 问题描述
- 为什么有问题
- 修复方案（具体代码）
- 最佳实践

不评论代码风格和格式。直接输出审查报告。`
    },

    test: {
        name: "测试生成",
        nameEn: "Test Generation",
        keywords: ["测试", "用例", "覆盖率", "单测"],
        description: "生成全面的测试方案",
        painPoint: "不知道该测什么 — 知道要写测试但不知道该测哪些场景，写出来的用例只覆盖了 happy path，边界情况和异常场景全靠上线后用户帮你测。",
        example: {
            before: "帮我给这个登录函数写单测",
            after: "（自动生成测试策略 + 用例清单：正常/边界/异常/并发场景 + 完整 Vitest 测试代码 + Mock 策略 + 覆盖率目标建议）"
        },
        prompt: `你是测试工程师。生成全面的测试方案：

1. 测试策略（单测/集成/E2E 怎么分配）
2. 测试用例清单（正常/边界/异常/并发）
3. 完整测试代码（Vitest + @vue/test-utils）
4. Mock 策略
5. 覆盖率目标建议

直接输出测试方案。`
    },

    security: {
        name: "安全审计",
        nameEn: "Security Audit",
        keywords: ["安全", "XSS", "注入", "权限", "漏洞"],
        description: "进行代码安全审计",
        painPoint: "安全意识薄弱/不知道哪里有洞 — 代码能跑就行，直到被攻击了才发现到处是 XSS、SQL 注入、越权访问，但自己根本不知道该检查哪些地方。",
        example: {
            before: "帮我检查一下这个接口有没有安全问题",
            after: "（自动按严重等级全面审计：🔴严重/🟠高危/🟡中危/🔵低危，覆盖 XSS/CSRF/SQL注入/命令注入/路径穿越/越权，每个问题含攻击场景+修复代码+预防措施）"
        },
        prompt: `你是 Web 安全专家。进行全面安全审计：

按严重等级（🔴严重/🟠高危/🟡中危/🔵低危）：
- 问题描述 + 攻击场景
- 修复方案（具体代码）
- 预防措施

覆盖：XSS、CSRF、SQL注入、命令注入、路径穿越、权限控制、认证安全、数据安全。
直接输出审计报告。`
    },

    comment: {
        name: "代码注释",
        nameEn: "Code Comments",
        keywords: ["注释", "JSDoc", "TSDoc", "文档注释"],
        description: "为代码生成专业注释",
        painPoint: "注释要么没有要么废话 — 不写注释三个月后自己都看不懂，写了注释又全是 `// 设置名字` 这种废话，该解释 WHY 的地方解释了 WHAT。",
        example: {
            before: "帮我给这个工具函数加注释",
            after: "（自动生成专业注释：文件头说明 + 函数 TSDoc（@param/@returns/@throws/@example）+ 只在 WHY 处加行内注释 + 标注 TODO/FIXME 技术债）"
        },
        prompt: `你是技术文档专家。为代码生成专业注释：

1. 文件头注释
2. 函数/方法 TSDoc（@description/@param/@returns/@throws/@example）
3. 行内注释（只注释 WHY 不注释 WHAT）
4. TODO/FIXME 标注技术债

直接输出注释后的完整代码。`
    },

    mock: {
        name: "模拟数据",
        nameEn: "Mock Data",
        keywords: ["Mock", "假数据", "模拟数据", "Fixture", "seed"],
        description: "生成模拟数据和 Mock API",
        painPoint: "假数据太假/格式不对 — 手写假数据全是 test1/test2/aaa，前端联调时才发现字段格式和后端对不上，关联数据 ID 不一致。",
        example: {
            before: "帮我生成一些用户列表的假数据",
            after: "（自动从类型定义提取字段 → 生成中国场景逼真数据（中文名/手机号/行政区划）→ 关联数据 ID 一致 → 推荐 MSW/Faker.js 工具 → 完整 Mock 配置）"
        },
        prompt: `你是测试数据工程师。生成逼真的模拟数据：

1. 从类型定义提取字段
2. 生成符合中国场景的假数据（中文名、手机号、行政区划）
3. 关联数据保持引用一致
4. 推荐工具（MSW/Faker.js/JSON Server）
5. 完整可运行的 Mock 配置

直接输出模拟数据方案。`
    },

    doc: {
        name: "文档生成",
        nameEn: "Documentation",
        keywords: ["写文档", "README", "使用说明"],
        description: "生成结构化技术文档",
        painPoint: "代码写完不想写文档 — 写代码一时爽，写文档火葬场。README 空空如也，新人接手先看半天代码猜用法，API 文档和实际接口永远对不上。",
        example: {
            before: "帮我给这个组件库写个 README",
            after: "（自动生成结构化文档：一句话概述 → 快速开始 → API 文档含参数/返回值/示例 → 配置说明 → FAQ → 注意事项，可直接粘贴使用）"
        },
        prompt: `你是技术文档专家。生成结构化文档：

1. 概述（一句话说明是什么、解决什么问题）
2. 快速开始
3. API 文档（参数/返回值/示例）
4. 配置说明
5. FAQ
6. 注意事项

直接输出文档。`
    },

    commit: {
        name: "Commit 消息",
        nameEn: "Commit Message",
        keywords: ["commit", "提交信息", "git log"],
        description: "生成 Conventional Commits 格式提交信息",
        painPoint: "提交信息随便写 — git log 里全是「fix」「update」「修改」，三个月后想找某次改动翻遍历史也找不到，代码回溯全靠记忆。",
        example: {
            before: "改了登录页面的验证逻辑和样式",
            after: "（自动生成规范 Commit：feat(auth): add form validation with real-time feedback + 详细描述 + Breaking Changes 标注）"
        },
        prompt: `你是 Git Commit 专家。生成 Conventional Commits 格式的提交信息：

格式：<type>(<scope>): <description>
类型：feat/fix/refactor/perf/style/docs/test/chore/ci/build
要求：一行主题 + 空行 + 详细描述（如需）+ Breaking Changes（如有）

直接输出 commit message。`
    },

    proposal: {
        name: "技术方案",
        nameEn: "Technical Proposal",
        keywords: ["方案", "报告", "汇报", "说服老板"],
        description: "生成结构化技术提案",
        painPoint: "技术方案写不出说服力 — 你知道某个方案更好，但写出来的提案逻辑不清、缺少数据支撑，老板/leader 看完一脸问号，最后还是用了旧方案。",
        example: {
            before: "我想推动团队从 Webpack 迁移到 Vite，帮我写个方案",
            after: "（自动生成结构化提案：背景问题量化 → 目标范围 → 至少 2 种方案对比 → 推荐方案详设 → 风险评估 → 实施计划 → 资源需求 → 成功指标）"
        },
        prompt: `你是技术方案专家。生成结构化技术提案：

1. 背景与问题
2. 目标与范围
3. 方案对比（至少 2 种）
4. 推荐方案详细设计
5. 风险评估与应对
6. 实施计划
7. 资源需求
8. 成功指标

直接输出技术方案文档。`
    },

    translate: {
        name: "翻译",
        nameEn: "Translation",
        keywords: ["翻译", "English", "中译英", "英译中"],
        description: "技术场景中英精准翻译",
        painPoint: "翻译工具不懂技术 — Google 翻译把 「组件」 译成 「part」、「状态提升」 译成 「status promotion」，技术文章翻译完读起来比原文还难懂。",
        example: {
            before: "帮我翻译这段技术文档",
            after: "（自动保留技术术语原文 + 符合目标语言技术写作习惯 + 代码注释也翻译 + 保持 Markdown 格式不乱）"
        },
        prompt: `你是技术翻译专家。进行中英精准翻译：

1. 保留技术术语原文
2. 符合目标语言的技术写作习惯
3. 代码中的注释也翻译
4. 保持 Markdown 格式

直接输出翻译结果。`
    },

    changelog: {
        name: "变更日志",
        nameEn: "Changelog",
        keywords: ["CHANGELOG", "版本说明", "发布", "release"],
        description: "生成 CHANGELOG / 版本发布说明",
        painPoint: "版本发布没记录 — 每次发版不知道该写什么，写了也流水账一样，用户看不懂改了什么，团队成员也不知道这个版本解决了哪些问题。",
        example: {
            before: "这个版本加了搜索功能，修了几个 bug，帮我写 changelog",
            after: "（自动按 Keep a Changelog 分类：✨Added/🐛Fixed/💥Breaking + 面向用户描述 + Breaking Changes 迁移指南 + 简洁版可发社交媒体）"
        },
        prompt: `你是技术写作专家。生成 CHANGELOG：

按 Keep a Changelog 分类：✨Added / 🔄Changed / ⚡Improved / 🐛Fixed / 🗑️Deprecated / 💥Breaking
面向用户描述，突出重点，Breaking Changes 附迁移指南。

输出完整版 + 简洁版（可发社交媒体）。`
    },

    present: {
        name: "技术演示",
        nameEn: "Tech Presentation",
        keywords: ["答辩", "PPT", "演讲", "分享", "培训"],
        description: "生成技术演示大纲和话术",
        painPoint: "技术分享不知道怎么讲 — 技术方案自己很清楚，但做成 PPT 就变成了「念代码」，受众听得昏昏欲睡，不知道怎么让非技术人员也能理解。",
        example: {
            before: "下周要做一个前端性能优化的技术分享",
            after: "（自动生成演示方案：受众分析→调整深度 + 痛点引入→现状→方案→收益量化→路线图 + 每节话术要点 + 时间分配 + Q&A 预案）"
        },
        prompt: `你是技术演讲教练。生成演示方案：

1. 受众分析 → 调整深度
2. 结构：痛点引入→现状→方案→收益量化→路线图→Q&A预案
3. 每节话术要点
4. 时间分配
5. 视觉建议

直接输出演示大纲。`
    },

    devops: {
        name: "DevOps",
        nameEn: "DevOps",
        keywords: ["CI/CD", "Docker", "Nginx", "部署", "SSL"],
        description: "生成部署/CI/CD 配置方案",
        painPoint: "部署配置一抄就错 — Dockerfile 从网上抄的跑不起来，Nginx 配置改了不生效，GitHub Actions 的 YAML 缩进错一个空格就全挂，SSL 证书配完还是不安全。",
        example: {
            before: "帮我把这个 Node.js 项目用 Docker 部署到服务器",
            after: "（自动生成完整方案：Dockerfile + docker-compose + Nginx 反代 + GitHub Actions CI/CD + .env 模板 + SSL + 安全清单 + 回滚方案）"
        },
        prompt: `你是 DevOps 工程师。生成完整部署方案：

1. 部署架构图
2. 配置文件（Dockerfile/docker-compose/nginx/GitHub Actions/.env模板）
3. 安全清单
4. 部署步骤（每步可验证）
5. 监控告警建议
6. 回滚方案

直接输出部署方案。`
    },

    env: {
        name: "环境排查",
        nameEn: "Environment Troubleshooting",
        keywords: ["环境问题", "安装失败", "配置出错", "版本冲突"],
        description: "排查开发环境问题",
        painPoint: "环境问题玄学 — 「在我电脑上是好的啊」，npm install 报了 200 行错、Python 版本冲突、Node 版本不对，花了半天配环境一行代码没写。",
        example: {
            before: "npm install 报错了一大堆，看不懂",
            after: "（自动生成排查方案：快速诊断最可能的 3 个原因 → 每个原因的排查命令 → 修复步骤 → 验证方法 → 预防措施 → 核弹选项彻底重置）"
        },
        prompt: `你是开发环境排查专家。

1. 快速诊断（最可能的 3 个原因）
2. 逐步排查命令
3. 每个原因的修复步骤
4. 验证方法
5. 预防措施
6. 核弹选项（彻底重置）

直接输出排查方案。`
    },

    script: {
        name: "脚本生成",
        nameEn: "Script Generation",
        keywords: ["脚本", "自动化", "批量处理", "定时任务"],
        description: "生成自动化脚本",
        painPoint: "重复操作不会自动化 — 每天手动做同样的事（清日志、备份数据库、批量重命名），知道该写脚本但不会写，写了又不健壮，跑一半挂了数据全丢。",
        example: {
            before: "帮我写个脚本每天凌晨自动备份数据库",
            after: "（自动选择语言 + 健壮的脚本：错误处理/参数校验/日志/进度/幂等性 + 危险操作确认 + 头部注释 + crontab/launchd 定时配置）"
        },
        prompt: `你是自动化脚本专家。生成可直接运行的脚本：

1. 选择语言（简单→Shell，数据处理→Python，Node生态→Node.js）
2. 健壮性（错误处理、参数校验、日志、进度、幂等性）
3. 安全性（危险操作确认、备份、dry-run）
4. 头部注释（用途、参数、示例）
5. 定时配置（crontab/launchd）

直接输出脚本。`
    },

    deps: {
        name: "依赖管理",
        nameEn: "Dependency Management",
        keywords: ["依赖冲突", "peer dependency", "npm audit"],
        description: "解决依赖冲突和版本兼容问题",
        painPoint: "依赖冲突解不了 — peer dependency 警告满屏红，--force 安装完运行就报错，降版本又和其他包冲突，陷入版本地狱出不来。",
        example: {
            before: "npm install 报了一堆 peer dependency 冲突",
            after: "（自动分析依赖树定位冲突根源 → 兼容矩阵 → 解决策略：升降版本/overrides/替代包 → 验证步骤 → 预防措施）"
        },
        prompt: `你是 Node.js 依赖管理专家。

1. 分析依赖树定位冲突根源
2. 兼容矩阵
3. 解决策略（升降版本/overrides/替代包/optional）
4. 验证步骤
5. 预防措施

默认 pnpm。直接输出解决方案。`
    },

    git: {
        name: "Git 操作",
        nameEn: "Git Operations",
        keywords: ["git合并", "冲突", "回退", "rebase", "cherry-pick"],
        description: "生成安全的 Git 操作方案",
        painPoint: "Git 操作怕丢代码 — 想 rebase 又怕冲突丢代码，合并出错不知道怎么回退，force push 完同事的代码没了，git reflog 听过但不敢用。",
        example: {
            before: "我不小心把代码提交到了错误的分支，怎么办",
            after: "（自动生成安全操作方案：理解当前状态 → 风险评估 → 每步含完整命令+说明+预期输出+回退方法 → 操作前备份命令 → ⚠️ 危险操作醒目警告）"
        },
        prompt: `你是 Git 版本控制专家。生成安全的操作方案：

1. 理解当前状态
2. 风险评估（标记危险操作 ⚠️）
3. 每步含完整命令、说明、预期输出、回退方法
4. 操作前备份命令
5. 最佳实践建议

⚠️ force push/reset --hard/filter-branch 必须加醒目警告。
直接输出操作方案。`
    },

    incident: {
        name: "线上排查",
        nameEn: "Incident Response",
        keywords: ["线上告警", "500", "超时", "崩溃", "生产问题"],
        description: "排查线上问题并生成修复方案",
        painPoint: "线上出事手忙脚乱 — 半夜收到告警「接口 500 了」，心跳加速不知道先看日志还是先回滚，排查毫无章法，修复后也不知道根因是什么。",
        example: {
            before: "线上接口突然大量超时，怎么排查",
            after: "（自动生成 SRE 排查流程：严重程度判断 P0/P1/P2 → 影响范围 → 快速止血方案 → 根因分析时间线 → 修复方案 → 验证方法 → 复盘模板）"
        },
        prompt: `你是 SRE 线上排查专家。

1. 严重程度判断（P0/P1/P2）
2. 影响范围评估
3. 快速止血（降级/回滚/限流）
4. 根因分析（时间线/关联变更/堆栈追踪）
5. 修复方案
6. 验证方法
7. 复盘模板

直接输出排查方案。`
    },

    algo: {
        name: "算法题解",
        nameEn: "Algorithm Solutions",
        keywords: ["面试", "算法", "LeetCode", "数据结构"],
        description: "解析算法面试题",
        painPoint: "算法题毫无思路 — 看到题目一片空白，暴力解都写不出来，更别说优化了。看了题解又似懂非懂，换个题又不会。",
        example: {
            before: "两数之和怎么做，要求 O(n) 时间复杂度",
            after: "（自动生成解题全流程：复述题意 → 暴力解 O(n²) → 优化思路 → 最优解 HashMap O(n) → TypeScript 完整实现 → 复杂度分析 → 边界测试 → 面试官追问预判 → 相关题目推荐）"
        },
        prompt: `你是算法面试教练。

1. 复述题意提炼核心
2. 思路推导：暴力解→优化→最优解
3. TypeScript 实现（完整类型+注释+边界处理）
4. 复杂度分析
5. 测试用例（正常+边界+特殊）
6. 面试官追问预判
7. 相关 LeetCode 题目

直接输出解题方案。`
    }
};

// 场景名称映射（快速查找）
const SCENE_NAMES = {};
const SCENE_NAMES_EN = {};
for (const [id, scene] of Object.entries(SCENES)) {
    SCENE_NAMES[id] = scene.name;
    SCENE_NAMES_EN[id] = scene.nameEn;
}

module.exports = { SCENES, SCENE_NAMES, SCENE_NAMES_EN };
