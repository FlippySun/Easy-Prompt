/**
 * Easy Prompt Web — 路由逻辑
 * 2026-04-13 Vite 迁移：从 app.js §5 提取为独立 ESM 模块
 *
 * [类型]     重构（模块化）
 * [描述]     将意图路由逻辑（buildRouterPrompt / parseRouterResult / buildGenerationPrompt）提取为独立模块
 * [影响范围] composer.js（smartRoute / directGenerate 调用这些函数）
 * [潜在风险] 无已知风险
 */

import { SCENES, SCENE_NAMES } from "./scenes.js";

/* ═══════════════════════════════════════════════════
   §5. Router Logic (ported from core/router.js)
   ═══════════════════════════════════════════════════ */

let cachedRouterPrompt = null;

export function buildRouterPrompt() {
  if (cachedRouterPrompt) return cachedRouterPrompt;

  const sceneList = Object.entries(SCENES)
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

export function parseRouterResult(text) {
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
      .filter((s) => typeof s === "string" && SCENES[s])
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

export function buildGenerationPrompt(routerResult) {
  const validScenes = routerResult.scenes.filter((s) => SCENES[s]);
  if (validScenes.length === 0) validScenes.push("optimize");

  if (validScenes.length === 1 && validScenes[0] === "optimize") {
    return {
      prompt: SCENES.optimize.prompt,
      sceneNames: [SCENES.optimize.name],
    };
  }

  const sceneNames = validScenes.map((s) => SCENE_NAMES[s] || s);

  if (routerResult.composite && validScenes.length > 1) {
    const sceneSections = validScenes
      .map(
        (s, i) =>
          `### 子任务 ${i + 1}：${SCENE_NAMES[s]}
以下是该领域的专家知识（作为参考素材，用于生成该子任务的专业 Prompt）：
${SCENES[s].prompt}`,
      )
      .join("\n\n");

    const prompt = `⚠️ 核心原则：你是一个「Prompt 生成器」，不是「任务执行者」。你的任务是「写出一个专业 Prompt」，不是去执行用户的任务。

用户的复合需求涉及 ${validScenes.length} 个方面：${sceneNames.join("、")}。

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

    return { prompt, sceneNames };
  } else {
    const sceneId = validScenes[0];
    const prompt = `⚠️ 核心原则：你是一个「Prompt 生成器」，不是「任务执行者」。你的任务是「写出一个专业 Prompt」，不是去执行用户的任务。

以下是「${SCENE_NAMES[sceneId]}」领域的专家知识（作为参考素材）：
${SCENES[sceneId].prompt}

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

    return { prompt, sceneNames };
  }
}
