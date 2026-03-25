/**
 * Easy Prompt Browser Extension — Router
 * 意图识别 Prompt + JSON 解析 + Generation Prompt 构建
 * 与 core/router.js、web/app.js 完全一致的逻辑
 */

// ========================== 变更记录 ==========================
// [日期]     2026-03-24
// [类型]     配置变更
// [描述]     为 Router 增加 ESM 显式依赖声明，适配 WXT 的模块打包方式。
// [思路]     仅补充 Api 与 Scenes 的 import/export，不改变路由识别与生成逻辑，降低回归面。
// [影响范围] browser/shared/router.js、browser/popup/popup.js、browser/background/service-worker.js。
// [潜在风险] 无已知风险。
// ==============================================================

import { Api } from "./api.js";
import { Scenes } from "./scenes.js";

let cachedRouterPrompt = null;
let cachedScenesRef = null;

// ========================== 变更记录 ==========================
// [日期]     2026-03-16
// [类型]     重构
// [描述]     Browser 端恢复 Fast/Deep，但仅影响第二步生成深度，不再改模型、端点或请求形状。
// [思路]     浏览器端最敏感的是跨域与服务商风控，因此模式差异只放在 token 预算、温度与提示词密度层。
// [影响范围] browser/shared/router.js，被 popup 与 background 共用。
// [潜在风险] Fast 模式的提速幅度会比切轻量模型更温和，但可显著降低真实浏览器回归风险。
// ==============================================================

const ENHANCE_MODES = {
  FAST: "fast",
  DEEP: "deep",
};

const DEFAULT_ENHANCE_MODE = ENHANCE_MODES.FAST;

function getEnhanceMode(config) {
  return config?.enhanceMode === ENHANCE_MODES.DEEP
    ? ENHANCE_MODES.DEEP
    : DEFAULT_ENHANCE_MODE;
}

function getGenerationCallOptions(config, isComposite, onRetry, signal) {
  if (getEnhanceMode(config) === ENHANCE_MODES.DEEP) {
    return {
      temperature: 0.7,
      maxTokens: isComposite ? 8192 : 4096,
      timeout: 120,
      onRetry,
      signal,
    };
  }

  return {
    temperature: 0.5,
    maxTokens: isComposite ? 4096 : 2048,
    timeout: 60,
    onRetry,
    signal,
  };
}

function decorateGenerationPrompt(systemPrompt, config) {
  const mode = getEnhanceMode(config);
  const modeHint =
    mode === ENHANCE_MODES.DEEP
      ? "\n\n[增强模式: Deep]\n请优先保证完整性，补充关键边界条件、风险提示、验证步骤与输出结构，允许结果更充分展开。"
      : "\n\n[增强模式: Fast]\n请在保证专业度与可执行性的前提下，优先输出更精炼、更直接的 Prompt，避免不必要的铺陈和重复说明。";
  return `${systemPrompt}${modeHint}`;
}

/**
 * 检查输入文本是否适合进行 Prompt 增强
 * @param {string} text
 * @returns {boolean}
 */
function isValidInput(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;

  const meaningful = trimmed.replace(/[^\p{L}\p{N}]/gu, "");
  if (meaningful.length < 2) return false;

  if (!/\p{L}/u.test(trimmed)) return false;

  const uniqueChars = new Set([...meaningful.toLowerCase()]);
  if (uniqueChars.size < 2) return false;

  if (/^\s*(https?:\/\/\S+|ftp:\/\/\S+|www\.\S+)\s*$/i.test(trimmed))
    return false;

  if (/^\s*[\w.+-]+@[\w.-]+\.\w{2,}\s*$/i.test(trimmed)) return false;

  if (
    /^\s*(\/[\w.@-]+){2,}\s*$/.test(trimmed) ||
    /^\s*[A-Z]:\\[\w\\.~-]+\s*$/i.test(trimmed)
  )
    return false;

  return true;
}

function buildRouterPrompt() {
  const scenes = Scenes.getScenes();
  // Invalidate cache when scenes reference changes
  if (cachedRouterPrompt && cachedScenesRef === scenes)
    return cachedRouterPrompt;
  if (!scenes) return "";
  cachedScenesRef = scenes;

  const sceneList = Object.entries(scenes)
    .map(([id, s]) => `- ${id}: ${s.keywords.join("/")} → ${s.name}`)
    .join("\n");

  cachedRouterPrompt = `你是一个意图分类器。分析用户输入，识别其中包含的所有意图场景。

场景列表：
${sceneList}

规则：
1. 返回 JSON，格式：{"scenes":["场景ID1","场景ID2",...],"composite":true/false}
2. 如果用户只有单一意图：{"scenes":["场景ID"],"composite":false}
3. 如果用户有多个意图（如"审查代码并优化性能再写文档"）：{"scenes":["review","perf","doc"],"composite":true}
4. scenes 数组按主次顺序排列，最重要的在前面，最多 5 个
5. 如果都不太匹配，返回 {"scenes":["optimize"],"composite":false}
6. 不要返回任何其他文字，只返回 JSON`;

  return cachedRouterPrompt;
}

function parseRouterResult(text) {
  const scenes = Scenes.getScenes();
  let parsed = null;
  const trimmed = text.trim();

  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    const patterns = [
      /```json\s*\n?({[\s\S]*?})\s*\n?```/,
      /```\s*\n?({[\s\S]*?})\s*\n?```/,
      /({\s*"scenes"\s*:[\s\S]*?})/,
    ];
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        try {
          parsed = JSON.parse(match[1]);
          break;
        } catch (e2) {
          continue;
        }
      }
    }
  }

  if (parsed && parsed.scenes && Array.isArray(parsed.scenes)) {
    const validScenes = parsed.scenes
      .filter((s) => typeof s === "string" && scenes[s])
      .slice(0, 5);

    let composite = false;
    if (typeof parsed.composite === "boolean") composite = parsed.composite;
    else if (typeof parsed.composite === "string")
      composite = parsed.composite.toLowerCase() === "true";

    return {
      scenes: validScenes.length > 0 ? validScenes : ["optimize"],
      composite: composite && validScenes.length > 1,
    };
  }

  return { scenes: ["optimize"], composite: false };
}

function buildGenerationPrompt(routerResult) {
  const scenes = Scenes.getScenes();
  const sceneNames = Scenes.getSceneNames();
  const validScenes = routerResult.scenes.filter((s) => scenes[s]);
  if (validScenes.length === 0) validScenes.push("optimize");

  if (validScenes.length === 1 && validScenes[0] === "optimize") {
    return {
      prompt: scenes.optimize.prompt,
      sceneNames: [scenes.optimize.name],
    };
  }

  const names = validScenes.map((s) => sceneNames[s] || s);

  if (routerResult.composite && validScenes.length > 1) {
    const sceneSections = validScenes
      .map(
        (s, i) =>
          `### 子任务 ${i + 1}：${sceneNames[s]}\n以下是该领域的专家知识（作为参考素材，用于生成该子任务的专业 Prompt）：\n${scenes[s].prompt}`,
      )
      .join("\n\n");

    const prompt = `⚠️ 核心原则：你是一个「Prompt 生成器」，不是「任务执行者」。你的任务是「写出一个专业 Prompt」，不是去执行用户的任务。

用户的复合需求涉及 ${validScenes.length} 个方面：${names.join("、")}。

${sceneSections}

请基于以上参考素材，将用户的复合需求重写为一个**结构化的专业 Prompt**：

1. 设定一个能覆盖所有子任务的综合专家角色
2. 将复合需求拆分为清晰的子任务章节
3. 每个子任务引用对应领域的专家方法论
4. 子任务间标明依赖和执行顺序
5. 给出统一的输出格式要求

⚠️ Prompt 末尾必须包含执行力约束：
- 要求 AI 直接动手实现/修改，不只给方案
- 分步执行，每步有具体代码改动
- 每步验证确认后再继续
- 以"请立即开始执行第一步"结尾

只输出生成的 Prompt，不要前言。`;

    return { prompt, sceneNames: names };
  } else {
    const sceneId = validScenes[0];
    const prompt = `⚠️ 核心原则：你是一个「Prompt 生成器」，不是「任务执行者」。你的任务是「写出一个专业 Prompt」，不是去执行用户的任务。

以下是「${sceneNames[sceneId]}」领域的专家知识（作为参考素材）：
${scenes[sceneId].prompt}

请基于以上参考素材，将用户的输入重写为一个**专业级 Prompt**：
1. 设定该领域的专家角色
2. 结构化任务要求
3. 补全隐含约束和边界条件
4. 明确输出格式

⚠️ Prompt 末尾必须包含执行力约束：
- 要求 AI 直接动手实现/修改，不只给方案
- 分步执行，每步有具体代码改动
- 每步验证确认后再继续
- 以"请立即开始执行"结尾

只输出生成的 Prompt，不要前言。`;

    return { prompt, sceneNames: names };
  }
}

function callRouterApi(config, systemPrompt, userMessage, onRetry, signal) {
  return Api.callApi(config, systemPrompt, userMessage, {
    temperature: 0.1,
    maxTokens: 500,
    timeout: 30,
    onRetry,
    signal,
  });
}

function callGenerationApi(
  config,
  systemPrompt,
  userMessage,
  isComposite,
  onRetry,
  signal,
) {
  const effectiveSystemPrompt = decorateGenerationPrompt(systemPrompt, config);
  return Api.callApi(config, effectiveSystemPrompt, userMessage, {
    ...getGenerationCallOptions(config, isComposite, onRetry, signal),
  });
}

async function smartRoute(config, userInput, onProgress, signal) {
  if (!isValidInput(userInput)) {
    throw new Error("输入内容无效，请输入有意义的文本内容");
  }
  const sceneNames = Scenes.getSceneNames();
  const onRetry = (attempt, maxRetries, delayMs) => {
    if (onProgress)
      onProgress(
        "retrying",
        `服务器繁忙，正在第 ${attempt}/${maxRetries} 次重试（${delayMs / 1000}s 后）...`,
      );
  };

  if (onProgress) onProgress("routing", "正在识别意图...");
  const routerPrompt = buildRouterPrompt();
  const routerText = await callRouterApi(
    config,
    routerPrompt,
    userInput,
    onRetry,
    signal,
  );
  const routerResult = parseRouterResult(routerText);

  const names = routerResult.scenes.map((s) => sceneNames[s] || s);
  if (onProgress) {
    const label = routerResult.composite
      ? `复合任务：${names.join(" + ")}`
      : `场景：${names[0]}`;
    onProgress("generating", `意图识别完成 → ${label}，正在生成 Prompt...`);
  }

  const { prompt: genPrompt } = buildGenerationPrompt(routerResult);
  const result = await callGenerationApi(
    config,
    genPrompt,
    userInput,
    routerResult.composite,
    onRetry,
    signal,
  );

  return {
    result,
    scenes: routerResult.scenes,
    composite: routerResult.composite || false,
  };
}

async function directGenerate(config, userInput, sceneId, onProgress, signal) {
  const sceneNames = Scenes.getSceneNames();
  const onRetry = (attempt, maxRetries, delayMs) => {
    if (onProgress)
      onProgress(
        "retrying",
        `服务器繁忙，正在第 ${attempt}/${maxRetries} 次重试（${delayMs / 1000}s 后）...`,
      );
  };

  if (onProgress)
    onProgress(
      "generating",
      `正在使用「${sceneNames[sceneId]}」场景生成 Prompt...`,
    );

  const routerResult = { scenes: [sceneId], composite: false };
  const { prompt: genPrompt } = buildGenerationPrompt(routerResult);
  const result = await callGenerationApi(
    config,
    genPrompt,
    userInput,
    false,
    onRetry,
    signal,
  );

  return { result, scenes: [sceneId], composite: false };
}

// eslint-disable-next-line no-unused-vars
const Router = {
  isValidInput,
  buildRouterPrompt,
  parseRouterResult,
  buildGenerationPrompt,
  smartRoute,
  directGenerate,
};
export { Router };
