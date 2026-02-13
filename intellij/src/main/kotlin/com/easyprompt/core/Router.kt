package com.easyprompt.core

object Router {

    fun buildRouterPrompt(): String {
        val sceneList = Scenes.all.entries.joinToString("\n") { (id, s) ->
            "- $id: ${s.keywords.joinToString("/")} → ${s.name}"
        }
        return """你是一个意图分类器。分析用户输入，识别其中包含的所有意图场景。

场景列表：
$sceneList

规则：
1. 返回 JSON，格式：{"scenes":["场景ID1","场景ID2",...],"composite":true/false}
2. 如果用户只有单一意图：{"scenes":["场景ID"],"composite":false}
3. 如果用户有多个意图（如"审查代码并优化性能再写文档"）：{"scenes":["review","perf","doc"],"composite":true}
4. scenes 数组按主次顺序排列，最重要的在前面，最多 5 个
5. 如果都不太匹配，返回 {"scenes":["optimize"],"composite":false}
6. 不要返回任何其他文字，只返回 JSON"""
    }

    fun buildGenerationPrompt(routerResult: RouterResult): String {
        val validScenes = routerResult.scenes.filter { Scenes.all.containsKey(it) }.ifEmpty { listOf("optimize") }

        if (validScenes.size == 1 && validScenes[0] == "optimize") {
            return Scenes.all["optimize"]!!.prompt
        }

        val sceneNames = validScenes.map { Scenes.nameMap[it] ?: it }

        return if (routerResult.composite && validScenes.size > 1) {
            val sections = validScenes.mapIndexed { i, s ->
                val scene = Scenes.all[s]!!
                """### 子任务 ${i + 1}：${scene.name}
以下是该领域的专家知识（作为参考素材）：
${scene.prompt}"""
            }.joinToString("\n\n")

            """⚠️ 核心原则：你是一个「Prompt 生成器」，不是「任务执行者」。

用户的复合需求涉及 ${validScenes.size} 个方面：${sceneNames.joinToString("、")}。

$sections

请基于以上参考素材，将用户的复合需求重写为一个**结构化的专业 Prompt**：
1. 设定综合专家角色
2. 拆分为清晰的子任务章节
3. 每个子任务引用对应领域方法论
4. 标明依赖和执行顺序
5. 统一输出格式

⚠️ Prompt 末尾必须包含执行力约束：
- 要求 AI 直接动手实现/修改
- 分步执行，每步有具体代码改动
- 每步验证后再继续
- 以"请立即开始执行第一步"结尾

只输出生成的 Prompt，不要前言。"""
        } else {
            val scene = Scenes.all[validScenes[0]]!!
            """⚠️ 核心原则：你是一个「Prompt 生成器」，不是「任务执行者」。

以下是「${scene.name}」领域的专家知识（作为参考素材）：
${scene.prompt}

请将用户的输入重写为一个**专业级 Prompt**：
1. 设定该领域的专家角色
2. 结构化任务要求
3. 补全隐含约束和边界条件
4. 明确输出格式

⚠️ Prompt 末尾必须包含执行力约束：
- 要求 AI 直接动手实现/修改
- 分步执行，每步有具体代码改动
- 每步验证后再继续
- 以"请立即开始执行"结尾

只输出生成的 Prompt，不要前言。"""
        }
    }
}
