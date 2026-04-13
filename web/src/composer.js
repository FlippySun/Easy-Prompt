/**
 * Easy Prompt Web — 智能路由编排
 * 2026-04-13 Vite 迁移：从 app.js §7 提取为独立 ESM 模块
 *
 * [类型]     重构（模块化）
 * [描述]     将 smartRoute / directGenerate / isValidInput 提取为独立模块
 * [影响范围] backend.js（dualTrackEnhance 调用）, ui/（handleGenerate 调用）
 * [潜在风险] 无已知风险
 */

import { SCENE_NAMES } from "./scenes.js";
import { buildRouterPrompt, parseRouterResult, buildGenerationPrompt } from "./router.js";
import { callRouterApi, callGenerationApi } from "./api.js";

/* ═══════════════════════════════════════════════════
   §7. Smart Route (Composer)
   ═══════════════════════════════════════════════════ */

/**
 * 检查输入文本是否适合进行 Prompt 增强
 */
export function isValidInput(text) {
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

export async function smartRoute(config, userInput, onProgress, signal) {
  if (!isValidInput(userInput)) {
    throw new Error("输入内容无效，请输入有意义的文本内容");
  }
  const onRetry = (attempt, maxRetries, delayMs) => {
    if (onProgress)
      onProgress(
        "retrying",
        `服务器繁忙，正在第 ${attempt}/${maxRetries} 次重试（${delayMs / 1000}s 后）...`,
      );
  };

  // Step 1: Intent recognition
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

  const sceneNames = routerResult.scenes.map((s) => SCENE_NAMES[s] || s);
  if (onProgress) {
    const label = routerResult.composite
      ? `复合任务：${sceneNames.join(" + ")}`
      : `场景：${sceneNames[0]}`;
    onProgress("generating", `意图识别完成 → ${label}，正在生成 Prompt...`);
  }

  // Step 2: Generate professional prompt
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

/**
 * Direct scene generation (skip router, use specified scene)
 */
export async function directGenerate(config, userInput, sceneId, onProgress, signal) {
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
      `正在使用「${SCENE_NAMES[sceneId]}」场景生成 Prompt...`,
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
