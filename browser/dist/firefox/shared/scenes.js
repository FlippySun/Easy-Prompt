/**
 * Easy Prompt Browser Extension — Scenes Data Layer
 * 场景分类 · 热门场景 · 人物画像 · 场景加载
 * 85 个场景数据从 scenes.json 加载
 */

/* ─── 场景分类（15 个分类） ─── */
const SCENE_CATEGORIES = [
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

/* ─── 热门场景 ─── */
const HOT_SCENES = [
  "optimize",
  "refactor",
  "debug",
  "review",
  "copy-polish",
  "topic-gen",
  "platform-adapt",
  "headline",
];

/* ─── 人物画像（10 + 全部） ─── */
const PERSONAS = [
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

/* ─── 场景数据（运行时填充） ─── */
let _scenes = null;
let _sceneNames = {};

/**
 * 从扩展包内加载 scenes.json
 * 浏览器扩展使用 chrome.runtime.getURL 获取打包资源
 */
async function loadScenes() {
  if (_scenes) return true;
  try {
    const url =
      typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL
        ? chrome.runtime.getURL("scenes.json")
        : "scenes.json";
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    _scenes = await resp.json();
    _sceneNames = {};
    for (const [id, s] of Object.entries(_scenes)) {
      _sceneNames[id] = s.name;
    }
    return true;
  } catch (err) {
    console.error("[Easy Prompt] Failed to load scenes:", err);
    return false;
  }
}

function getScenes() {
  return _scenes;
}
function getSceneNames() {
  return _sceneNames;
}

// eslint-disable-next-line no-unused-vars
const Scenes = {
  SCENE_CATEGORIES,
  HOT_SCENES,
  PERSONAS,
  loadScenes,
  getScenes,
  getSceneNames,
};
