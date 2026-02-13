/**
 * Easy Prompt Core
 * 平台无关的核心模块入口
 */

const { SCENES, SCENE_NAMES, SCENE_NAMES_EN } = require('./scenes');
const { buildRouterPrompt, parseRouterResult, buildGenerationPrompt } = require('./router');
const { callApi, callRouterApi, callGenerationApi } = require('./api');
const { smartRoute } = require('./composer');

module.exports = {
    // 场景定义
    SCENES,
    SCENE_NAMES,
    SCENE_NAMES_EN,

    // 路由
    buildRouterPrompt,
    parseRouterResult,
    buildGenerationPrompt,

    // API
    callApi,
    callRouterApi,
    callGenerationApi,

    // 编排
    smartRoute
};
