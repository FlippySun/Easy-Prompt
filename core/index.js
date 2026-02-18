/**
 * Easy Prompt Core
 * 平台无关的核心模块入口
 */

const { SCENES, SCENE_NAMES, SCENE_NAMES_EN } = require("./scenes");
const {
  isValidInput,
  buildRouterPrompt,
  parseRouterResult,
  buildGenerationPrompt,
} = require("./router");
const {
  callApi,
  callRouterApi,
  callGenerationApi,
  testApiConfig,
} = require("./api");
const { smartRoute } = require("./composer");
const { getBuiltinDefaults } = require("./defaults");

module.exports = {
  // 场景定义
  SCENES,
  SCENE_NAMES,
  SCENE_NAMES_EN,

  // 输入验证
  isValidInput,

  // 路由
  buildRouterPrompt,
  parseRouterResult,
  buildGenerationPrompt,

  // API
  callApi,
  callRouterApi,
  callGenerationApi,
  testApiConfig,

  // 编排
  smartRoute,

  // 内置默认配置
  getBuiltinDefaults,
};
