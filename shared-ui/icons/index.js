// ========================== 变更记录 ==========================
// [日期]     2026-04-13
// [类型]     新增
// [描述]     Skill 图标索引模块，通过 Vite/WXT ?raw 导入 SVG 并导出 iconMap。
// [思路]     文件名格式 skill-{name}.svg，name 与 mock.json 的 icon 字段对应。
//            使用 ?raw 后缀将 SVG 内容作为字符串导入，构建 { name: svgString } 映射。
// [影响范围] shared-ui/icons/index.js（新文件），被 web/src/skill.js 和 browser/popup/popup.js 引入。
// [潜在风险] 无已知风险。仅在打包环境（Vite/WXT）中可用，?raw 是 Vite 特有语法。
// ==============================================================

import skillStrategy from "./skill-strategy.svg?raw";
import skillLight from "./skill-light.svg?raw";
import skillAnalyze from "./skill-analyze.svg?raw";
import skillList from "./skill-list.svg?raw";
import skillText from "./skill-text.svg?raw";
import skillMessage from "./skill-message.svg?raw";
import skillEdit from "./skill-edit.svg?raw";
import skillCheck from "./skill-check.svg?raw";
import skillPicture from "./skill-picture.svg?raw";
import skillWrite from "./skill-write.svg?raw";
import skillCoding from "./skill-coding.svg?raw";
import folderIcon from "./folder.svg?raw";

/**
 * Skill 图标映射：icon 名称 → SVG 字符串
 * key 与 core/mock.json 中每个 skill 的 icon 字段一致
 */
/**
 * 分类标题前的 folder 图标 SVG
 */
export const FOLDER_ICON_SVG = folderIcon;

/**
 * Skill 图标映射：icon 名称 → SVG 字符串
 * key 与 core/mock.json 中每个 skill 的 icon 字段一致
 */
export const SKILL_ICON_MAP = {
  strategy: skillStrategy,
  light: skillLight,
  analyze: skillAnalyze,
  list: skillList,
  text: skillText,
  message: skillMessage,
  edit: skillEdit,
  check: skillCheck,
  picture: skillPicture,
  write: skillWrite,
  coding: skillCoding,
};
