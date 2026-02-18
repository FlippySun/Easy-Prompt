/**
 * Easy Prompt — 路由器
 * 意图识别 Prompt + 分类逻辑
 */

const { SCENES, SCENE_NAMES } = require("./scenes");

/**
 * 检查输入文本是否适合进行 Prompt 增强
 * 过滤空内容、过短文本、重复字符、纯数字、纯 URL / 邮箱 / 文件路径等无意义输入
 *
 * 规则：
 * 1. 非空且去空格后长度 ≥ 2
 * 2. 有效字符（字母 + 数字）≥ 2
 * 3. 至少包含 1 个字母（拒绝纯数字）
 * 4. 至少 2 个不同有效字符（拒绝 "aaa" / "111" / "哈哈哈"）
 * 5. 拒绝纯 URL（但 "帮我解析 https://..." 通过）
 * 6. 拒绝纯邮箱地址
 * 7. 拒绝纯文件路径
 *
 * @param {string} text
 * @returns {boolean}
 */
function isValidInput(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;

  // 有效字符：字母 + 数字（Unicode 全脚本）
  const meaningful = trimmed.replace(/[^\p{L}\p{N}]/gu, "");
  if (meaningful.length < 2) return false;

  // 必须包含至少 1 个字母字符（拒绝纯数字如 "12345"）
  if (!/\p{L}/u.test(trimmed)) return false;

  // 拒绝单一字符重复（"aaa"、"111"、"哈哈哈"）
  const uniqueChars = new Set([...meaningful.toLowerCase()]);
  if (uniqueChars.size < 2) return false;

  // 拒绝纯 URL 输入（但 "帮我解析 https://example.com" 可以通过）
  if (/^\s*(https?:\/\/\S+|ftp:\/\/\S+|www\.\S+)\s*$/i.test(trimmed))
    return false;

  // 拒绝纯邮箱地址
  if (/^\s*[\w.+-]+@[\w.-]+\.\w{2,}\s*$/i.test(trimmed)) return false;

  // 拒绝纯文件路径（Unix / Windows）
  if (
    /^\s*(\/[\w.@-]+){2,}\s*$/.test(trimmed) ||
    /^\s*[A-Z]:\\[\w\\.~-]+\s*$/i.test(trimmed)
  )
    return false;

  return true;
}

// 缓存路由器 Prompt（场景不变时可复用）
let cachedRouterPrompt = null;

// 路由器 Prompt（第一步：意图识别）
function buildRouterPrompt() {
  if (cachedRouterPrompt) {
    return cachedRouterPrompt;
  }

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

// 解析路由器返回的 JSON，过滤无效场景 ID
function parseRouterResult(text) {
  let parsed = null;
  const trimmed = text.trim();

  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    // 尝试从 Markdown 代码块中提取（更精确的正则）
    // 匹配 ```json...``` 或 直接的 JSON 对象
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
    // 过滤掉无效的场景 ID（确保是字符串且存在于 SCENES 中）
    const validScenes = parsed.scenes
      .filter((s) => typeof s === "string" && SCENES[s])
      .slice(0, 5); // 最多保留 5 个场景

    // 规范化 composite 字段（处理字符串 "true"/"false"）
    let composite = false;
    if (typeof parsed.composite === "boolean") {
      composite = parsed.composite;
    } else if (typeof parsed.composite === "string") {
      composite = parsed.composite.toLowerCase() === "true";
    }

    return {
      scenes: validScenes.length > 0 ? validScenes : ["optimize"],
      composite: composite && validScenes.length > 1,
    };
  }

  return { scenes: ["optimize"], composite: false };
}

// 根据路由结果构建最终的 System Prompt
function buildGenerationPrompt(routerResult) {
  const validScenes = routerResult.scenes.filter((s) => SCENES[s]);
  if (validScenes.length === 0) {
    validScenes.push("optimize");
  }

  if (validScenes.length === 1 && validScenes[0] === "optimize") {
    // optimize 场景直接使用，它本身就是「写 Prompt」的指令
    return {
      prompt: SCENES.optimize.prompt,
      sceneNames: [SCENES.optimize.name],
    };
  }

  const sceneNames = validScenes.map((s) => SCENE_NAMES[s] || s);

  if (routerResult.composite && validScenes.length > 1) {
    // 复合模式：合并多个场景
    const sceneSections = validScenes
      .map((s, i) => {
        return `### 子任务 ${i + 1}：${SCENE_NAMES[s]}
以下是该领域的专家知识（作为参考素材，用于生成该子任务的专业 Prompt）：
${SCENES[s].prompt}`;
      })
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
    // 单一场景
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

module.exports = {
  isValidInput,
  buildRouterPrompt,
  parseRouterResult,
  buildGenerationPrompt,
};
