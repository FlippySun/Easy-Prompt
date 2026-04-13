/**
 * Easy Prompt Web — 常量与配置
 * 2026-04-13 Vite 迁移：从 app.js §1 提取为独立 ESM 模块
 *
 * [类型]     重构（模块化）
 * [描述]     将全局常量提取为 ESM 模块，便于其他模块按需引用
 * [影响范围] 所有引用这些常量的模块
 * [潜在风险] 无已知风险
 */

// Pre-declare — will be populated after fetching scenes.json
window.SCENES = null;

export const MAX_INPUT_LENGTH = 10000;
export const MAX_RETRIES = 3;
export const RETRY_DELAYS = [2000, 4000, 8000];

// 2026-04-13 新增 — 客户端元数据（供后端日志记录）
// 变更类型：新增
// 功能描述：定义客户端版本和平台标识，随增强请求发送至后端
// 设计思路：后端 AiRequestLog 中 clientVersion / clientPlatform 始终为空，
//   因为客户端从未在请求中携带这些字段。此处补充定义并在 fetch body 中传递。
// 影响范围：callBackendEnhance 请求体
// 潜在风险：版本号需随发版同步更新（deploy.sh --bump 已覆盖 index.html，此处需手动对齐）
export const CLIENT_VERSION = "5.3.8";
export const CLIENT_PLATFORM = "web";

// 场景分类（用于 Browser 和 Picker）
export const SCENE_CATEGORIES = [
  {
    id: "requirement",
    name: "需求工程",
    scenes: ["optimize", "split-task", "techstack", "api-design"],
  },
  {
    id: "development",
    name: "代码开发",
    scenes: [
      "refactor",
      "perf",
      "regex",
      "sql",
      "convert",
      "typescript",
      "css",
      "state",
      "component",
      "form",
      "async",
      "schema",
    ],
  },
  {
    id: "quality",
    name: "质量保障",
    scenes: ["review", "test", "debug", "error", "security", "comment"],
  },
  {
    id: "docs",
    name: "文档沟通",
    scenes: [
      "doc",
      "changelog",
      "commit",
      "proposal",
      "present",
      "explain",
      "followup",
    ],
  },
  {
    id: "ops",
    name: "工程运维",
    scenes: ["devops", "env", "script", "deps", "git", "incident"],
  },
  {
    id: "writing",
    name: "内容创作",
    scenes: [
      "topic-gen",
      "outline",
      "copy-polish",
      "style-rewrite",
      "word-adjust",
      "headline",
      "fact-check",
      "research",
      "platform-adapt",
      "compliance",
      "seo-write",
      "social-post",
    ],
  },
  {
    id: "product",
    name: "产品管理",
    scenes: [
      "prd",
      "user-story",
      "competitor",
      "data-analysis",
      "meeting-notes",
      "acceptance",
    ],
  },
  {
    id: "marketing",
    name: "市场运营",
    scenes: [
      "ad-copy",
      "brand-story",
      "email-marketing",
      "event-plan",
      "growth-hack",
    ],
  },
  {
    id: "design",
    name: "设计体验",
    scenes: ["design-brief", "ux-review", "design-spec", "copy-ux"],
  },
  {
    id: "data",
    name: "数据分析",
    scenes: ["data-report", "ab-test", "metric-define", "data-viz"],
  },
  {
    id: "hr",
    name: "HR 人事",
    scenes: [
      "jd-write",
      "interview-guide",
      "performance-review",
      "onboarding-plan",
    ],
  },
  {
    id: "service",
    name: "客户服务",
    scenes: ["faq-write", "response-template", "feedback-analysis"],
  },
  {
    id: "startup",
    name: "创业管理",
    scenes: ["business-plan", "pitch-deck", "okr", "swot", "risk-assess"],
  },
  {
    id: "education",
    name: "学习教育",
    scenes: ["study-plan", "summary", "essay", "quiz-gen"],
  },
  { id: "general", name: "综合工具", scenes: ["translate", "mock", "algo"] },
];

// 热门场景（首页快捷标签）
export const HOT_SCENES = [
  "optimize",
  "refactor",
  "debug",
  "review",
  "copy-polish",
  "topic-gen",
  "platform-adapt",
  "headline",
];

// 10 个使用画像 → 对应场景分类
export const PERSONAS = [
  { id: "all", name: "全部", categories: null },
  {
    id: "engineer",
    name: "软件工程师",
    categories: [
      "requirement",
      "development",
      "quality",
      "docs",
      "ops",
      "general",
    ],
  },
  { id: "creator", name: "内容创作者", categories: ["writing"] },
  { id: "pm", name: "产品经理", categories: ["product"] },
  { id: "marketer", name: "市场运营", categories: ["marketing"] },
  { id: "designer", name: "设计师", categories: ["design"] },
  { id: "analyst", name: "数据分析师", categories: ["data"] },
  { id: "hr", name: "HR 人事", categories: ["hr"] },
  { id: "service", name: "客户服务", categories: ["service"] },
  { id: "founder", name: "创业者/管理者", categories: ["startup"] },
  { id: "student", name: "学生/教育", categories: ["education"] },
];

// ========================== 变更记录 ==========================
// [日期]     2026-03-16
// [类型]     重构
// [描述]     将 Web 端 Fast/Deep 收敛为"同模型同端点、不同输出深度"的保守策略，避免模式切换改变请求形状。
// [思路]     保留增强模式配置，但只让第二步生成的 token 预算、温度与提示词密度发生变化，Browser/Web 不再受模型切换影响。
// [影响范围] web/app.js 的 API 调用包装、设置持久化与增强调用链。
// [潜在风险] Fast 模式的提速会比轻量模型方案温和，但能显著降低兼容性与跨域相关回归风险。
// ==============================================================

export const ENHANCE_MODES = {
  FAST: "fast",
  DEEP: "deep",
};

export const DEFAULT_ENHANCE_MODE = ENHANCE_MODES.FAST;

/** 支持的 API 模式 */
export const API_MODES = {
  openai: "OpenAI Chat Completions",
  "openai-responses": "OpenAI Responses API",
  claude: "Claude API",
  gemini: "Google Gemini API",
};

/** 每种模式的默认 API 路径 */
export const DEFAULT_API_PATHS = {
  openai: "/v1/chat/completions",
  "openai-responses": "/v1/responses",
  claude: "/v1/messages",
  gemini: "/v1beta",
};

/** 模型列表（设置面板下拉选择） */
export const MODEL_LIST = [
  { group: "Anthropic" },
  { id: "claude-opus-4-6", desc: "Opus 4.6 最智能" },
  { id: "claude-sonnet-4-5", desc: "Sonnet 4.5 均衡" },
  { id: "claude-haiku-4-5", desc: "Haiku 4.5 最快" },
  { id: "claude-opus-4-1", desc: "Opus 4.1" },
  { id: "claude-sonnet-4", desc: "Sonnet 4" },
  { group: "OpenAI" },
  { id: "gpt-5.4", desc: "默认旗舰" },
  { id: "gpt-5.2", desc: "最新旗舰" },
  { id: "gpt-5.2-pro", desc: "更智能更精准" },
  { id: "gpt-5-mini", desc: "快速高效" },
  { id: "gpt-5-nano", desc: "极致性价比" },
  { id: "gpt-5", desc: "上一代推理" },
  { id: "gpt-4.1", desc: "最强非推理" },
  { id: "gpt-4.1-mini", desc: "轻量快速" },
  { id: "gpt-4o", desc: "灵活智能" },
  { id: "gpt-4o-mini", desc: "经济实惠" },
  { id: "o3", desc: "复杂推理" },
  { id: "o4-mini", desc: "快速推理" },
  { group: "Google" },
  { id: "gemini-3-pro-preview", desc: "最强多模态" },
  { id: "gemini-3-flash-preview", desc: "速度与智能" },
  { id: "gemini-3.0-pro", desc: "Gemini 3.0" },
  { id: "gemini-2.5-pro", desc: "高级思维" },
  { id: "gemini-2.5-flash", desc: "高性价比" },
  { group: "DeepSeek" },
  { id: "deepseek-v3.2-chat", desc: "V3.2 通用对话" },
  { id: "deepseek-v3.2-reasoner", desc: "V3.2 深度推理" },
  { id: "deepseek-r1", desc: "R1 推理" },
  { group: "xAI" },
  { id: "grok-4", desc: "Grok 4" },
  { id: "grok-3", desc: "Grok 3" },
  { group: "智谱 GLM" },
  { id: "glm-5", desc: "GLM-5" },
  { id: "glm-4.7", desc: "GLM-4.7" },
  { group: "Kimi" },
  { id: "kimi-k2.5", desc: "K2.5" },
  { id: "kimi-k2", desc: "K2" },
  { group: "通义千问" },
  { id: "qwen3-max", desc: "Qwen3 Max" },
  { id: "qwen3-235b", desc: "Qwen3 235B" },
  { group: "MiniMax" },
  { id: "minimax-m2.5", desc: "M2.5" },
];
