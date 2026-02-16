package com.easyprompt.core

/**
 * 画像 & 场景分类配置
 * 与 VSCode/Web 三端保持一致
 *
 * @since 4.1.0
 */
object PersonaConfig {

    data class Persona(
        val id: String,
        val name: String,
        val categories: List<String>
    )

    /**
     * 10 个用户画像
     */
    val personas = listOf(
        Persona("engineer", "软件工程师", listOf("requirement", "development", "quality", "docs", "ops", "general")),
        Persona("creator", "内容创作者", listOf("writing")),
        Persona("pm", "产品经理", listOf("product")),
        Persona("marketer", "市场运营", listOf("marketing")),
        Persona("designer", "设计师", listOf("design")),
        Persona("analyst", "数据分析师", listOf("data")),
        Persona("hr", "HR人事", listOf("hr")),
        Persona("service", "客户服务", listOf("service")),
        Persona("founder", "创业者/管理者", listOf("startup")),
        Persona("student", "学生/教育", listOf("education"))
    )

    /**
     * 15 个场景分类（与 SCENE_CATEGORIES 对应）
     */
    data class Category(val id: String, val name: String, val scenes: List<String>)

    val categories = listOf(
        Category("requirement", "需求工程", listOf("optimize", "split-task", "techstack", "api-design")),
        Category("development", "编码开发", listOf("refactor", "perf", "regex", "sql", "convert", "typescript", "css", "state", "component", "form", "async", "schema")),
        Category("quality", "质量保障", listOf("review", "test", "debug", "error", "security", "comment")),
        Category("docs", "文档技术写作", listOf("doc", "changelog", "commit", "proposal", "present", "explain", "followup")),
        Category("ops", "部署运维", listOf("devops", "env", "script", "deps", "git", "incident")),
        Category("writing", "内容创作", listOf("topic-gen", "outline", "copy-polish", "style-rewrite", "word-adjust", "headline", "fact-check", "research", "platform-adapt", "compliance", "seo-write", "social-post")),
        Category("product", "产品管理", listOf("prd", "user-story", "competitor", "data-analysis", "meeting-notes", "acceptance")),
        Category("marketing", "市场营销", listOf("ad-copy", "brand-story", "email-marketing", "event-plan", "growth-hack")),
        Category("design", "设计", listOf("design-brief", "ux-review", "design-spec", "copy-ux")),
        Category("data", "数据分析", listOf("data-report", "ab-test", "metric-define", "data-viz")),
        Category("hr", "人力资源", listOf("jd-write", "interview-guide", "performance-review", "onboarding-plan")),
        Category("service", "客户服务", listOf("faq-write", "response-template", "feedback-analysis")),
        Category("startup", "创业管理", listOf("business-plan", "pitch-deck", "okr", "swot", "risk-assess")),
        Category("education", "教育学习", listOf("study-plan", "summary", "essay", "quiz-gen")),
        Category("general", "通用工具", listOf("translate", "mock", "algo"))
    )

    /**
     * 场景 ID → 分类 ID 的映射
     */
    val sceneToCategoryMap: Map<String, String> by lazy {
        val map = mutableMapOf<String, String>()
        for (cat in categories) {
            for (sceneId in cat.scenes) {
                if (!map.containsKey(sceneId)) {
                    map[sceneId] = cat.id
                }
            }
        }
        map
    }

    /**
     * 获取画像对应的所有场景 ID（去重）
     */
    fun getScenesForPersona(personaId: String): Set<String> {
        if (personaId == "all") return Scenes.all.keys
        val persona = personas.find { it.id == personaId } ?: return emptySet()
        val result = mutableSetOf<String>()
        for (catId in persona.categories) {
            val cat = categories.find { it.id == catId }
            if (cat != null) {
                result.addAll(cat.scenes)
            }
        }
        return result
    }
}
