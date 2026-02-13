/**
 * Easy Prompt — Prompt 合成器
 * 编排完整的两步路由流程
 */

const { buildRouterPrompt, parseRouterResult, buildGenerationPrompt } = require('./router');
const { callRouterApi, callGenerationApi } = require('./api');

/**
 * 执行两步智能路由
 * @param {Object} config - {baseUrl, apiKey, model}
 * @param {string} userInput - 用户原始输入
 * @param {Function} [onProgress] - 进度回调 (stage, detail)
 * @returns {Promise<{result: string, scenes: string[], composite: boolean}>}
 */
async function smartRoute(config, userInput, onProgress) {
    // 第一步：意图识别
    if (onProgress) onProgress('routing', '正在识别意图...');

    const routerPrompt = buildRouterPrompt();
    const routerText = await callRouterApi(config, routerPrompt, userInput);
    const routerResult = parseRouterResult(routerText);

    const sceneNames = routerResult.scenes
        .map(s => {
            try {
                const { SCENE_NAMES } = require('./scenes');
                return SCENE_NAMES[s] || s;
            } catch { return s; }
        });

    if (onProgress) {
        const label = routerResult.composite
            ? `复合任务：${sceneNames.join(' + ')}`
            : `场景：${sceneNames[0]}`;
        onProgress('generating', `意图识别完成 → ${label}，正在生成 Prompt...`);
    }

    // 第二步：生成专业 Prompt
    const { prompt: genPrompt } = buildGenerationPrompt(routerResult);
    const result = await callGenerationApi(
        config,
        genPrompt,
        userInput,
        routerResult.composite
    );

    return {
        result,
        scenes: routerResult.scenes,
        composite: routerResult.composite || false
    };
}

module.exports = { smartRoute };
