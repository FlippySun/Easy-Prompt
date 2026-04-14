/**
 * Easy Prompt Web — Skill 数据层
 * 2026-04-13 新增：加载 Skill 数据 + 注入 Web Component CSS
 *
 * [类型]     新增
 * [描述]     加载 mock.json skill 数据，导入 <ep-skill-panel> Web Component，
 *            通过 Vite ?raw 导入 CSS 并注入到 WC 静态属性。
 * [思路]     Vite 打包环境下 document.currentScript 为 null，WC 无法 fetch CSS，
 *            因此在 import 阶段通过 injectCss() 预注入 CSS 文本。
 * [影响范围] web/src/ui/index.js（引用本模块获取 skill 数据）
 * [潜在风险] 无已知风险
 */

// --- 2026-04-13 导入 Web Component（IIFE 自注册 <ep-skill-panel>）---
import "../../shared-ui/skill-panel.js";

// --- 2026-04-13 通过 Vite ?raw 导入 CSS 文本并注入到 WC ---
import skillPanelCss from "../../shared-ui/skill-panel.css?raw";

// --- 2026-04-13 导入 mock.json skill 数据（Vite 原生支持 JSON import）---
import skillsData from "../../core/mock.json";

// --- 2026-04-13 导入 SVG 图标映射 ---
import {
  SKILL_ICON_MAP,
  FOLDER_ICON_SVG,
} from "../../shared-ui/icons/index.js";

// 2026-04-13 修复：统一解析 CustomElementRegistry，避免共享 skill 组件在
//   不同打包/运行时中裸用 customElements 触发 null.get。
// [参数与返回值] 无参数；返回 CustomElementRegistry|null。
// [影响范围] web/src/skill.js 对 shared-ui/skill-panel.js 的消费路径。
// [潜在风险] 无已知风险。
function getCustomElementRegistry() {
  if (typeof globalThis !== "undefined" && globalThis.customElements) {
    return globalThis.customElements;
  }
  if (typeof window !== "undefined" && window.customElements) {
    return window.customElements;
  }
  if (
    typeof document !== "undefined" &&
    document.defaultView &&
    document.defaultView.customElements
  ) {
    return document.defaultView.customElements;
  }
  return null;
}

// 注入 CSS 到 Web Component 静态属性
const skillRegistry = getCustomElementRegistry();
const EpSkillPanel = skillRegistry ? skillRegistry.get("ep-skill-panel") : null;
if (EpSkillPanel && EpSkillPanel.injectCss) {
  EpSkillPanel.injectCss(skillPanelCss);
}

/**
 * Skill 数据数组
 * Schema: { id, name, description, icon, placeholder, instructions, skillType, sortNum, sys }
 * @type {object[]}
 */
export const SKILLS = Array.isArray(skillsData) ? skillsData : [];

/**
 * SkillType 分组名映射
 * @type {Record<string, string>}
 */
export const SKILL_TYPE_MAP = {
  1: "通用",
  2: "写作",
  3: "制图",
  4: "编程",
};

/**
 * Skill 图标映射（icon 名称 → SVG 字符串）
 * @type {Record<string, string>}
 */
export { SKILL_ICON_MAP, FOLDER_ICON_SVG };
