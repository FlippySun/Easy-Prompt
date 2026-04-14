// ========================== 变更记录 ==========================
// [日期]     2026-04-13
// [类型]     重构
// [描述]     重写 Skill 数据层：废弃骨架 schema，改用 mock.json 结构。
//            导出 SKILLS 数组、SKILL_TYPE_MAP、getAllSkills()、getSkillById()、
//            getSkillsByType()、searchSkills(keyword)。
// [思路]     mock.json 作为数据源，CommonJS require 加载。
//            Skill schema: { id, name, description, icon, placeholder,
//            instructions, skillType, sortNum, sys }。
//            getSkillsByType() 按 skillType 分组返回 { typeName, skills[] }。
//            searchSkills() 按 name + description 模糊匹配。
// [影响范围] core/skill.js；后续 web/app.js、browser/ 需适配引入。
// [潜在风险] 无已知风险（当前无业务调用者）。
// ==============================================================

"use strict";

// --- 2026-04-13 数据加载：从 mock.json 加载内置 Skill 列表 ---
const _rawSkills = require("./mock.json");

/**
 * 内置 Skill 列表
 * Schema: { id, name, description, icon, placeholder, instructions,
 *           skillType, sortNum, sys }
 * @type {object[]}
 */
const SKILLS = Array.isArray(_rawSkills) ? _rawSkills : [];

/**
 * SkillType 分组名映射
 * key = skillType 字符串, value = 中文分组名
 * @type {Record<string, string>}
 */
const SKILL_TYPE_MAP = {
  1: "通用",
  2: "写作",
  3: "制图",
  4: "编程",
};

/**
 * 获取所有 skill（浅拷贝）
 * @returns {object[]}
 */
function getAllSkills() {
  return SKILLS.slice();
}

/**
 * 根据 id 查找 skill
 * @param {number|string} id - skill id（mock.json 中为数字）
 * @returns {object|undefined}
 */
function getSkillById(id) {
  // 兼容数字和字符串比较
  return SKILLS.find((s) => String(s.id) === String(id));
}

/**
 * 按 skillType 分组返回技能
 * @returns {Record<string, { typeName: string, skills: object[] }>}
 */
function getSkillsByType() {
  const grouped = {};
  for (const skill of SKILLS) {
    const type = String(skill.skillType);
    if (!grouped[type]) {
      grouped[type] = {
        typeName: SKILL_TYPE_MAP[type] || type,
        skills: [],
      };
    }
    grouped[type].skills.push(skill);
  }
  return grouped;
}

/**
 * 按 name + description 模糊搜索 skill
 * @param {string} keyword - 搜索关键词
 * @returns {object[]} 匹配的 skill 列表
 */
function searchSkills(keyword) {
  if (!keyword) return [];
  const lower = keyword.toLowerCase();
  return SKILLS.filter(
    (s) =>
      s.name.toLowerCase().includes(lower) ||
      s.description.toLowerCase().includes(lower),
  );
}

module.exports = {
  SKILLS,
  SKILL_TYPE_MAP,
  getAllSkills,
  getSkillById,
  getSkillsByType,
  searchSkills,
};
