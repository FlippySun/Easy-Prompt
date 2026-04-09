const vscode = require("vscode");
const {
  smartRoute,
  isValidInput,
  SCENES,
  SCENE_NAMES,
  getBuiltinDefaults,
  testApiConfig,
  fetchModels,
  API_MODES,
  DEFAULT_API_PATHS,
  detectApiMode,
  dualTrackEnhance,
} = require("./core");
const { checkAndShowWelcome, showWelcomePage } = require("./welcomeView");

// ============ 场景命中计数 ============

const SCENE_STATS_KEY = "easyPrompt.sceneStats";

/** 全局上下文引用，在 activate 中赋值 */
let _context = null;

/** configureApi 面板复用引用 */
let _configPanel = null;
let _historyPanel = null;

// ============ 模块级静态数据（场景分类 + 画像分组） ============

const SCENE_CATEGORIES = [
  {
    id: "requirement",
    scenes: ["optimize", "split-task", "techstack", "api-design"],
  },
  {
    id: "development",
    scenes: [
      "refactor",
      "perf",
      "regex",
      "sql",
      "convert",
      "typescript",
      "css",
      "state",
      "component",
      "form",
      "async",
      "schema",
    ],
  },
  {
    id: "quality",
    scenes: ["review", "test", "debug", "error", "security", "comment"],
  },
  {
    id: "docs",
    scenes: [
      "doc",
      "changelog",
      "commit",
      "proposal",
      "present",
      "explain",
      "followup",
    ],
  },
  { id: "ops", scenes: ["devops", "env", "script", "deps", "git", "incident"] },
  {
    id: "writing",
    scenes: [
      "topic-gen",
      "outline",
      "copy-polish",
      "style-rewrite",
      "word-adjust",
      "headline",
      "fact-check",
      "research",
      "platform-adapt",
      "compliance",
      "seo-write",
      "social-post",
    ],
  },
  {
    id: "product",
    scenes: [
      "prd",
      "user-story",
      "competitor",
      "data-analysis",
      "meeting-notes",
      "acceptance",
    ],
  },
  {
    id: "marketing",
    scenes: [
      "ad-copy",
      "brand-story",
      "email-marketing",
      "event-plan",
      "growth-hack",
    ],
  },
  {
    id: "design",
    scenes: ["design-brief", "ux-review", "design-spec", "copy-ux"],
  },
  {
    id: "data",
    scenes: ["data-report", "ab-test", "metric-define", "data-viz"],
  },
  {
    id: "hr",
    scenes: [
      "jd-write",
      "interview-guide",
      "performance-review",
      "onboarding-plan",
    ],
  },
  {
    id: "service",
    scenes: ["faq-write", "response-template", "feedback-analysis"],
  },
  {
    id: "startup",
    scenes: ["business-plan", "pitch-deck", "okr", "swot", "risk-assess"],
  },
  { id: "education", scenes: ["study-plan", "summary", "essay", "quiz-gen"] },
  { id: "general", scenes: ["translate", "mock", "algo"] },
];

// 场景 → 分类 反向映射（仅构建一次）
const SCENE_TO_CATEGORY = {};
for (const cat of SCENE_CATEGORIES) {
  for (const s of cat.scenes) {
    SCENE_TO_CATEGORY[s] = cat.id;
  }
}

const PERSONA_GROUPS = [
  {
    label: "软件工程师",
    categories: [
      "requirement",
      "development",
      "quality",
      "docs",
      "ops",
      "general",
    ],
  },
  { label: "内容创作者", categories: ["writing"] },
  { label: "产品经理", categories: ["product"] },
  { label: "市场运营", categories: ["marketing"] },
  { label: "设计师", categories: ["design"] },
  { label: "数据分析师", categories: ["data"] },
  { label: "HR 人事", categories: ["hr"] },
  { label: "客户服务", categories: ["service"] },
  { label: "创业者/管理者", categories: ["startup"] },
  { label: "学生/教育", categories: ["education"] },
];

/**
 * 获取场景命中统计 { [sceneId]: number }
 */
function getSceneStats() {
  if (!_context) return {};
  return _context.globalState.get(SCENE_STATS_KEY, {});
}

/**
 * 增加场景命中计数（支持传入多个场景 ID）
 */
function incrementSceneHits(sceneIds) {
  if (!_context || !sceneIds || sceneIds.length === 0) return;
  const stats = getSceneStats();
  for (const id of sceneIds) {
    stats[id] = (stats[id] || 0) + 1;
  }
  _context.globalState.update(SCENE_STATS_KEY, stats);
}

// ============ 增强历史记录 ============

const HISTORY_KEY = "easyPrompt.history";
const MAX_HISTORY = 100;

function loadHistory() {
  if (!_context) return [];
  return _context.globalState.get(HISTORY_KEY, []);
}

function saveHistory(originalText, enhancedText, mode, sceneIds, sceneName) {
  if (!_context) return;
  const history = loadHistory();
  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: Date.now(),
    mode,
    sceneIds: sceneIds || [],
    sceneName: sceneName || "",
    originalText,
    enhancedText,
  };
  history.unshift(record);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  _context.globalState.update(HISTORY_KEY, history);
  return record;
}

function clearHistoryStorage() {
  if (!_context) return;
  _context.globalState.update(HISTORY_KEY, []);
}

/**
 * 构建带命中计数的场景列表项（用于 QuickPick），按命中次数降序排列
 * @param {Object} options - { showDetail: boolean }
 */
function buildSceneItems(options = {}) {
  const stats = getSceneStats();
  const { showDetail = true } = options;

  const items = [];
  for (const group of PERSONA_GROUPS) {
    // QuickPick separator (kind: -1 is QuickPickItemKind.Separator)
    items.push({ label: group.label, kind: -1 });
    const groupScenes = [];
    for (const catId of group.categories) {
      const cat = SCENE_CATEGORIES.find((c) => c.id === catId);
      if (!cat) continue;
      for (const sceneId of cat.scenes) {
        if (!SCENES[sceneId]) continue;
        groupScenes.push(sceneId);
      }
    }
    // Sort by hits within group
    groupScenes.sort((a, b) => (stats[b] || 0) - (stats[a] || 0));
    for (const id of groupScenes) {
      const scene = SCENES[id];
      const hits = stats[id] || 0;
      const fireLabel = hits > 0 ? ` 🔥${hits}` : "";
      items.push({
        label: `$(symbol-method) ${scene.name}${fireLabel}`,
        description: id,
        detail: showDetail
          ? `${scene.description}${scene.painPoint ? " · 💡 " + scene.painPoint.split("—")[0].trim() : ""}`
          : scene.painPoint
            ? scene.painPoint.split("—")[0].trim()
            : scene.description,
        sceneId: id,
        hits,
      });
    }
  }

  return items;
}

/**
 * 公共错误处理：分析错误类型，展示友好消息和操作按钮
 * @param {Error} err - 错误对象
 * @param {Function} retryFn - 点击重试时执行的函数
 */
function handleCommandError(err, retryFn) {
  let errorMsg = err.message;
  let actions = ["重试"];

  if (
    errorMsg.includes("API Key") ||
    errorMsg.includes("认证") ||
    errorMsg.includes("Unauthorized") ||
    errorMsg.includes("🔑")
  ) {
    actions.push("配置 API Key");
  } else if (
    errorMsg.includes("Base URL") ||
    errorMsg.includes("格式错误") ||
    errorMsg.includes("📋")
  ) {
    actions.push("检查设置");
  } else if (
    errorMsg.includes("繁忙") ||
    errorMsg.includes("过载") ||
    errorMsg.includes("超限") ||
    errorMsg.includes("⚡") ||
    errorMsg.includes("⏳")
  ) {
    actions = ["稍后重试"];
  }

  vscode.window
    .showErrorMessage(`❌ ${errorMsg}`, ...actions)
    .then((action) => {
      if (action === "重试" || action === "稍后重试") {
        retryFn();
      } else if (action === "配置 API Key" || action === "检查设置") {
        vscode.commands.executeCommand("easy-prompt.configureApi");
      }
    });
}

// 从 VSCode Settings 读取配置，未配置时使用内置默认值
function getConfig() {
  const cfg = vscode.workspace.getConfiguration("easyPrompt");
  const userApiKey = cfg.get("apiKey", "");
  const userBaseUrl = cfg.get("apiBaseUrl", ""); // 兼容旧版
  const userModel = cfg.get("model", "");
  const userEnhanceMode = cfg.get("enhanceMode", "fast");
  const userApiMode = cfg.get("apiMode", "");
  const userApiHost = cfg.get("apiHost", "");
  const userApiPath = cfg.get("apiPath", "");

  // 用户配置了自定义 API Key → 使用用户的全套配置
  if (userApiKey && userApiKey.trim() !== "") {
    let baseUrl;
    let apiMode = userApiMode || "";

    if (userApiHost && userApiHost.trim()) {
      // 新版配置：apiHost + apiPath
      const host = userApiHost.trim().replace(/\/+$/, "");
      const path =
        userApiPath && userApiPath.trim()
          ? userApiPath.trim()
          : apiMode
            ? DEFAULT_API_PATHS[apiMode] || "/v1/chat/completions"
            : "/v1/chat/completions";
      baseUrl = host + path;
    } else if (userBaseUrl && userBaseUrl.trim()) {
      // 旧版兼容：使用 apiBaseUrl
      baseUrl = userBaseUrl.trim().replace(/\/+$/, "");
    } else {
      baseUrl = "https://vpsairobot.com/v1/chat/completions";
    }

    const model = (userModel && userModel.trim()) || "gpt-5.4";

    // 验证 Base URL 格式
    if (!baseUrl.match(/^https?:\/\//)) {
      throw new Error("API Host 格式错误：必须以 http:// 或 https:// 开头");
    }

    // 自动推断 apiMode（向后兼容）
    if (!apiMode) {
      apiMode = detectApiMode(baseUrl);
    }

    return {
      baseUrl: baseUrl.trim(),
      apiKey: userApiKey.trim(),
      model: model.trim(),
      apiMode,
      enhanceMode: userEnhanceMode === "deep" ? "deep" : "fast",
    };
  }

  // 用户未配置 → 使用内置默认配置
  const defaults = getBuiltinDefaults();
  return {
    baseUrl: defaults.baseUrl,
    apiKey: defaults.apiKey,
    model: defaults.model,
    apiMode: detectApiMode(defaults.baseUrl),
    enhanceMode: userEnhanceMode === "deep" ? "deep" : "fast",
  };
}

/**
 * 使用 smartRoute 增强文本（公共逻辑）
 * 2026-04-08 P2.12: 改为双轨模式 — 优先后端 API，失败自动回退本地 curl
 */
async function runSmartRoute(config, text, progress) {
  const startTime = Date.now();
  progress.report({ message: "🔍 正在识别意图..." });

  const onProgress = (stage, detail) => {
    if (stage === "routing") {
      progress.report({ message: "🔍 正在识别意图..." });
    } else if (stage === "generating") {
      progress.report({ message: `✍️ ${detail}` });
    } else if (stage === "retrying") {
      progress.report({ message: `🔄 ${detail}` });
    }
  };

  // 本地增强函数（原 smartRoute 调用）
  const localEnhanceFn = async (cfg, input, progressFn) => {
    return await smartRoute(cfg, input, progressFn);
  };

  // 2026-04-08 P9.09+P9.10: 后端选项 — 读取三模式开关、自定义 URL、Access Token
  // mode: "auto" | "backend-only" | "local-only"
  // accessToken: 手动输入的 Bearer Token（留空则匿名）
  const backendCfg = vscode.workspace.getConfiguration("easyPrompt");
  const backendMode = backendCfg.get("backendMode", "auto");
  const backendUrl = backendCfg.get("backendUrl", "");
  const backendToken = backendCfg.get("backendToken", "");

  const result = await dualTrackEnhance(
    config,
    text,
    localEnhanceFn,
    {
      enhanceMode: config.enhanceMode || "fast",
      model: config.model || "",
      clientType: "vscode",
      mode: backendMode,
      backendUrl: backendUrl || undefined,
      accessToken: backendToken || undefined,
    },
    onProgress,
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const label = result.composite
    ? `复合：${result.scenes.map((s) => SCENE_NAMES[s] || s).join(" + ")}`
    : SCENE_NAMES[result.scenes[0]] || result.scenes[0];

  // 提示回退信息
  if (result.source === "local-fallback") {
    vscode.window.showWarningMessage(
      "Easy Prompt: 后端服务不可用，已通过本地模式完成",
    );
  }

  return { ...result, label, elapsed };
}

/**
 * 使用指定场景直接生成（跳过路由）
 */
async function runWithScene(config, text, sceneId, progress) {
  const { buildGenerationPrompt } = require("./core");
  const { callGenerationApi } = require("./core");

  const startTime = Date.now();
  const sceneName = SCENE_NAMES[sceneId] || sceneId;
  progress.report({ message: `✍️ 使用「${sceneName}」场景生成 Prompt...` });

  // 重试时更新进度
  const onRetry = (attempt, maxRetries, delayMs) => {
    progress.report({
      message: `🔄 服务器繁忙，正在第 ${attempt}/${maxRetries} 次重试（${delayMs / 1000}s 后）...`,
    });
  };

  const routerResult = { scenes: [sceneId], composite: false };
  const { prompt: genPrompt } = buildGenerationPrompt(routerResult);
  const result = await callGenerationApi(
    config,
    genPrompt,
    text,
    false,
    onRetry,
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  return {
    result,
    scenes: [sceneId],
    composite: false,
    label: sceneName,
    elapsed,
  };
}

/**
 * 命令 1：增强选中文本（Ctrl+Alt+P）
 * 无选中文本时自动转发到智能增强
 */
async function enhanceSelected() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("$(warning) 请先打开一个编辑器");
    return;
  }

  // 提前保存选区和文档引用，防止 API 调用期间用户切换文件导致竞态
  const savedSelection = editor.selection;
  const savedDocUri = editor.document.uri.toString();
  const text = editor.document.getText(savedSelection);
  if (!text.trim()) {
    // 没有选中文本 → 自动转发到智能增强（处理文件/剪贴板）
    return smartEnhance();
  }
  if (!isValidInput(text)) {
    vscode.window.showWarningMessage("选中的内容无效，请选择有意义的文本内容");
    return;
  }

  let config;
  try {
    config = getConfig();
  } catch (e) {
    vscode.window.showErrorMessage(e.message);
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Easy Prompt",
      cancellable: true,
    },
    async (progress, token) => {
      try {
        const res = await runSmartRoute(config, text, progress);

        if (token.isCancellationRequested) {
          vscode.window.showInformationMessage("$(info) 操作已取消");
          return;
        }

        // 竞态保护：验证当前编辑器和文档未被用户切换
        const currentEditor = vscode.window.activeTextEditor;
        if (
          !currentEditor ||
          currentEditor.document.uri.toString() !== savedDocUri
        ) {
          // 文档已切换，改为新标签页显示 + 复制到剪贴板
          const doc = await vscode.workspace.openTextDocument({
            content: res.result,
            language: "markdown",
          });
          await vscode.window.showTextDocument(doc, { preview: false });
          await vscode.env.clipboard.writeText(res.result);
          vscode.window.showWarningMessage(
            "⚠️ 原文档已关闭或切换，结果已在新标签页显示并复制到剪贴板",
          );
          incrementSceneHits(res.scenes);
          saveHistory(text, res.result, "smart", res.scenes, res.label);
          return;
        }

        await editor.edit((editBuilder) => {
          editBuilder.replace(savedSelection, res.result);
        });

        // 记录场景命中 + 历史
        incrementSceneHits(res.scenes);
        saveHistory(text, res.result, "smart", res.scenes, res.label);

        vscode.window
          .showInformationMessage(
            `✅ 增强完成 [${res.label}] · ${res.elapsed}s`,
            "复制结果",
            "撤销 (Cmd+Z)",
          )
          .then((action) => {
            if (action === "复制结果") {
              vscode.env.clipboard.writeText(res.result);
              vscode.window.showInformationMessage("$(check) 已复制到剪贴板");
            } else if (action && action.includes("撤销")) {
              vscode.commands.executeCommand("undo");
            }
          });
      } catch (err) {
        if (token.isCancellationRequested) {
          vscode.window.showInformationMessage("$(info) 操作已取消");
          return;
        }

        // 友好化错误提示（错误消息已在 api.js 中预处理为中文）
        handleCommandError(err, enhanceSelected);
      }
    },
  );
}

/**
 * 命令 1.5：智能增强（自动判断增强选中/文件/剪贴板内容）
 */
async function smartEnhance() {
  const editor = vscode.window.activeTextEditor;
  const MAX_FILE_LINES = 50;
  const MAX_FILE_CHARS = 2000;
  const MAX_INPUT_LENGTH = 10000;

  // 收集可用的增强源
  const sources = [];

  // 源 1: 选中文本（优先级最高）
  if (editor && editor.selection && !editor.selection.isEmpty) {
    const selectedText = editor.document.getText(editor.selection);
    if (selectedText.trim()) {
      sources.push({
        type: "selection",
        label: "$(selection) 选中的文本",
        description: `${selectedText.length} 字符`,
        detail:
          selectedText.substring(0, 100) +
          (selectedText.length > 100 ? "..." : ""),
        text: selectedText,
        selection: editor.selection,
      });
    }
  }

  // 源 2: 活动编辑器的完整内容（仅当内容不多时）
  if (editor) {
    const docText = editor.document.getText();
    const lineCount = editor.document.lineCount;
    const charCount = docText.length;

    if (
      docText.trim() &&
      lineCount <= MAX_FILE_LINES &&
      charCount <= MAX_FILE_CHARS
    ) {
      // 排除与选中文本内容完全相同的情况（避免重复）
      const isDupOfSelection = sources.some(
        (s) => s.type === "selection" && s.text === docText,
      );
      if (!isDupOfSelection) {
        sources.push({
          type: "file",
          label: "$(file-text) 当前文件内容",
          description: `${lineCount} 行，${charCount} 字符`,
          detail:
            docText.substring(0, 100) + (docText.length > 100 ? "..." : ""),
          text: docText,
        });
      }
    } else if (
      docText.trim() &&
      (lineCount > MAX_FILE_LINES || charCount > MAX_FILE_CHARS)
    ) {
      // 文件太大，记录但不作为可选源
      sources.push({
        type: "file-too-large",
        label: "$(warning) 当前文件内容过多",
        description: `${lineCount} 行，${charCount} 字符`,
        detail: `文件内容超过限制（最多 ${MAX_FILE_LINES} 行或 ${MAX_FILE_CHARS} 字符）。请选中具体片段，或使用"快速输入增强"功能。`,
        text: null,
      });
    }
  }

  // 源 3: 剪贴板内容
  try {
    const clipboardText = await vscode.env.clipboard.readText();
    if (clipboardText && clipboardText.trim()) {
      if (clipboardText.length <= MAX_INPUT_LENGTH) {
        // 排除与已有源重复的内容
        const isDuplicate = sources.some((s) => s.text === clipboardText);
        if (!isDuplicate) {
          sources.push({
            type: "clipboard",
            label: "$(clippy) 剪贴板内容",
            description: `${clipboardText.length} 字符`,
            detail:
              clipboardText.substring(0, 100) +
              (clipboardText.length > 100 ? "..." : ""),
            text: clipboardText,
          });
        }
      } else {
        sources.push({
          type: "clipboard-too-large",
          label: "$(warning) 剪贴板内容过长",
          description: `${clipboardText.length} 字符`,
          detail: `剪贴板内容超过限制（最多 ${MAX_INPUT_LENGTH} 字符）。请缩短内容后重试。`,
          text: null,
        });
      }
    }
  } catch (e) {
    // 读取剪贴板失败，静默跳过
  }

  // 过滤掉无效源（text 为 null 的）
  const validSources = sources.filter((s) => s.text !== null);

  // 情况 1: 无任何可用源
  if (validSources.length === 0) {
    const invalidReasons = sources
      .filter((s) => s.text === null)
      .map((s) => s.detail);
    let message = "未找到可增强的内容。";
    if (invalidReasons.length > 0) {
      message +=
        "\n\n原因：\n" + invalidReasons.map((r) => "• " + r).join("\n");
    } else {
      message +=
        '\n\n请尝试：\n• 选中要增强的文本\n• 在编辑器中打开要增强的内容（≤50行）\n• 复制要增强的文本到剪贴板\n• 使用"快速输入增强"功能手动输入';
    }
    vscode.window.showWarningMessage(message);
    return;
  }

  // 情况 2: 只有一个可用源 → 直接使用
  let selectedSource = null;
  if (validSources.length === 1) {
    selectedSource = validSources[0];
  } else {
    // 情况 3: 多个可用源 → 弹框让用户选择
    const quickPickItems = validSources.map((s) => ({
      label: s.label,
      description: s.description,
      detail: s.detail,
      source: s,
    }));

    const picked = await vscode.window.showQuickPick(quickPickItems, {
      placeHolder: "检测到多个可增强的内容，请选择要增强的内容",
      matchOnDescription: false,
      matchOnDetail: false,
    });

    if (!picked) return; // 用户取消
    selectedSource = picked.source;
  }

  // 执行增强
  let config;
  try {
    config = getConfig();
  } catch (e) {
    vscode.window.showErrorMessage(e.message);
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Easy Prompt",
      cancellable: true,
    },
    async (progress, token) => {
      try {
        const res = await runSmartRoute(config, selectedSource.text, progress);

        if (token.isCancellationRequested) return;

        // 记录场景命中 + 历史
        incrementSceneHits(res.scenes);
        saveHistory(
          selectedSource.text,
          res.result,
          "smart",
          res.scenes,
          res.label,
        );

        // 结果处理：根据源类型决定回显方式
        if (
          selectedSource.type === "selection" &&
          editor &&
          selectedSource.selection
        ) {
          // 竞态保护：验证编辑器和文档未被切换
          const currentEditor = vscode.window.activeTextEditor;
          if (
            !currentEditor ||
            currentEditor.document.uri.toString() !==
              editor.document.uri.toString()
          ) {
            const doc = await vscode.workspace.openTextDocument({
              content: res.result,
              language: "markdown",
            });
            await vscode.window.showTextDocument(doc, { preview: false });
            await vscode.env.clipboard.writeText(res.result);
            vscode.window.showWarningMessage(
              "⚠️ 原文档已关闭或切换，结果已在新标签页显示并复制到剪贴板",
            );
            return;
          }

          // 选中文本 → 原地替换
          await editor.edit((editBuilder) => {
            editBuilder.replace(selectedSource.selection, res.result);
          });
          vscode.window
            .showInformationMessage(
              `✅ 增强完成 [${res.label}] · ${res.elapsed}s`,
              "复制结果",
              "撤销 (Cmd+Z)",
            )
            .then((action) => {
              if (action === "复制结果") {
                vscode.env.clipboard.writeText(res.result);
                vscode.window.showInformationMessage("$(check) 已复制到剪贴板");
              } else if (action && action.includes("撤销")) {
                vscode.commands.executeCommand("undo");
              }
            });
        } else {
          // 文件内容 / 剪贴板内容 → 新标签页显示 + 复制到剪贴板
          const doc = await vscode.workspace.openTextDocument({
            content: res.result,
            language: "markdown",
          });
          await vscode.window.showTextDocument(doc, { preview: false });
          await vscode.env.clipboard.writeText(res.result);

          vscode.window.showInformationMessage(
            `✅ 增强完成 [${res.label}] · ${res.elapsed}s · 已复制到剪贴板`,
          );
        }
      } catch (err) {
        if (token.isCancellationRequested) {
          vscode.window.showInformationMessage("$(info) 操作已取消");
          return;
        }

        handleCommandError(err, smartEnhance);
      }
    },
  );
}

/**
 * 命令 2：快速输入增强（Ctrl+Alt+O）
 */
async function enhanceInput() {
  const input = await vscode.window.showInputBox({
    prompt: "输入要优化的 Prompt / 需求描述",
    placeHolder: "例如：帮我写个登录页面、优化这段代码、分析性能问题...",
    ignoreFocusOut: true,
  });

  if (!input?.trim()) return;

  let config;
  try {
    config = getConfig();
  } catch (e) {
    vscode.window.showErrorMessage(e.message);
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Easy Prompt",
      cancellable: true,
    },
    async (progress, token) => {
      try {
        const res = await runSmartRoute(config, input, progress);

        if (token.isCancellationRequested) return;

        const doc = await vscode.workspace.openTextDocument({
          content: res.result,
          language: "markdown",
        });
        await vscode.window.showTextDocument(doc, { preview: false });

        // 记录场景命中 + 历史
        incrementSceneHits(res.scenes);
        saveHistory(input, res.result, "smart", res.scenes, res.label);

        vscode.window
          .showInformationMessage(
            `✅ 增强完成 [${res.label}] · ${res.elapsed}s`,
            "复制结果",
          )
          .then((action) => {
            if (action === "复制结果") {
              vscode.env.clipboard.writeText(res.result);
              vscode.window.showInformationMessage("已复制到剪贴板");
            }
          });
      } catch (err) {
        if (token.isCancellationRequested) {
          vscode.window.showInformationMessage("$(info) 操作已取消");
          return;
        }

        handleCommandError(err, enhanceInput);
      }
    },
  );
}

/**
 * 命令 3：浏览场景列表（Ctrl+Alt+L）
 */
async function showScenes() {
  const items = buildSceneItems({ showDetail: true });

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: "选择场景查看详情 · 按命中次数排序 · 按 Esc 取消",
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (selected) {
    const scene = SCENES[selected.sceneId];
    let content = `# ${scene.name} (${selected.sceneId})\n\n> ${scene.description}\n\n`;

    if (scene.painPoint) {
      content += `## 💡 痛点\n\n${scene.painPoint}\n\n`;
    }
    if (scene.example) {
      content += `## ✨ 示例\n\n**❌ 用户原始输入：**\n> ${scene.example.before}\n\n**✅ 增强后效果：**\n> ${scene.example.after}\n\n`;
    }
    content += `## 🔑 关键词\n\n${scene.keywords.join(", ")}\n\n`;
    content += `## 📋 System Prompt\n\n\`\`\`\n${scene.prompt}\n\`\`\``;

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: "markdown",
    });
    await vscode.window.showTextDocument(doc, { preview: true });
  }
}

/**
 * 命令 4：指定场景增强（Ctrl+Alt+M）
 * 让用户手动选择场景，跳过 AI 意图识别，精准定向增强
 */
async function enhanceWithScene() {
  // Step 1: 选择场景（按命中次数排序）
  const items = buildSceneItems({ showDetail: false });

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: "🎯 选择一个场景来定向增强 Prompt · 按命中次数排序",
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (!selected) return;

  // Step 2: 获取输入文本（优先用选中文本，否则弹输入框）
  const editor = vscode.window.activeTextEditor;
  let text = "";

  // 提前捕获选区和文档引用，避免 API 调用期间用户切换导致竞态
  const savedSelection = editor ? editor.selection : null;
  const savedDocUri = editor ? editor.document.uri.toString() : null;
  if (editor && savedSelection && !savedSelection.isEmpty) {
    text = editor.document.getText(savedSelection);
  }

  if (!text.trim()) {
    const scene = SCENES[selected.sceneId];
    text =
      (await vscode.window.showInputBox({
        prompt: `使用「${scene.name}」场景增强 — 输入你的描述`,
        placeHolder: scene.example
          ? `例如：${scene.example.before}`
          : "输入要增强的内容...",
        ignoreFocusOut: true,
      })) || "";
  }

  if (!isValidInput(text)) {
    if (text.trim()) {
      vscode.window.showWarningMessage("输入内容无效，请输入有意义的文本内容");
    }
    return;
  }

  let config;
  try {
    config = getConfig();
  } catch (e) {
    vscode.window.showErrorMessage(e.message);
    return;
  }

  // Step 3: 直接使用指定场景生成
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Easy Prompt",
      cancellable: true,
    },
    async (progress, token) => {
      try {
        const res = await runWithScene(
          config,
          text,
          selected.sceneId,
          progress,
        );

        if (token.isCancellationRequested) return;

        // 如果有选中文本 → 替换；否则 → 新标签页
        if (editor && savedSelection && !savedSelection.isEmpty) {
          // 竞态保护：验证编辑器和文档未被切换
          const currentEditor = vscode.window.activeTextEditor;
          if (
            !currentEditor ||
            currentEditor.document.uri.toString() !== savedDocUri
          ) {
            const doc = await vscode.workspace.openTextDocument({
              content: res.result,
              language: "markdown",
            });
            await vscode.window.showTextDocument(doc, { preview: false });
            await vscode.env.clipboard.writeText(res.result);
            vscode.window.showWarningMessage(
              "⚠️ 原文档已关闭或切换，结果已在新标签页显示并复制到剪贴板",
            );
            incrementSceneHits(res.scenes);
            saveHistory(text, res.result, "scene", res.scenes, res.label);
            return;
          }

          await editor.edit((editBuilder) => {
            editBuilder.replace(savedSelection, res.result);
          });
        } else {
          const doc = await vscode.workspace.openTextDocument({
            content: res.result,
            language: "markdown",
          });
          await vscode.window.showTextDocument(doc, { preview: false });
        }

        // 记录场景命中 + 历史
        incrementSceneHits(res.scenes);
        saveHistory(text, res.result, "scene", res.scenes, res.label);

        vscode.window
          .showInformationMessage(
            `✅ 定向增强完成 [${res.label}] · ${res.elapsed}s`,
            "复制结果",
          )
          .then((action) => {
            if (action === "复制结果") {
              vscode.env.clipboard.writeText(res.result);
              vscode.window.showInformationMessage("已复制到剪贴板");
            }
          });
      } catch (err) {
        if (token.isCancellationRequested) {
          vscode.window.showInformationMessage("$(info) 操作已取消");
          return;
        }

        handleCommandError(err, enhanceWithScene);
      }
    },
  );
}

/**
 * 命令 5：显示 Welcome 页面
 */
function showWelcome(context) {
  return () => showWelcomePage(context);
}

/**
 * 命令 6：配置自定义 API 与增强模式（带测试 + 保存）
 */
function configureApi(context) {
  return async () => {
    // 复用已有面板
    if (_configPanel) {
      _configPanel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "easyPromptConfig",
      "Easy Prompt — 自定义 API 配置",
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    _configPanel = panel;
    panel.onDidDispose(() => {
      _configPanel = null;
    });

    // 读取当前用户已保存的自定义配置（不暴露内置默认值）
    const cfg = vscode.workspace.getConfiguration("easyPrompt");
    const savedApiMode = cfg.get("apiMode", "") || "";
    const savedApiHost = cfg.get("apiHost", "") || "";
    const savedApiPath = cfg.get("apiPath", "") || "";
    const savedBaseUrl = cfg.get("apiBaseUrl", "") || "";
    const savedApiKey = cfg.get("apiKey", "") || "";
    const savedModel = cfg.get("model", "") || "";
    const savedEnhanceMode = cfg.get("enhanceMode", "fast") || "fast";

    panel.webview.html = getConfigHtml(
      savedApiMode,
      savedApiHost,
      savedApiPath,
      savedBaseUrl,
      savedApiKey,
      savedModel,
      savedEnhanceMode,
    );

    panel.webview.onDidReceiveMessage(
      async (msg) => {
        switch (msg.command) {
          case "test": {
            const apiMode = (msg.apiMode || "").trim();
            const apiHost = (msg.apiHost || "").trim();
            const apiPath = (msg.apiPath || "").trim();
            const apiKey = (msg.apiKey || "").trim();
            const model = (msg.model || "").trim();

            // 组装 baseUrl
            let baseUrl = "";
            if (apiHost) {
              const host = apiHost.replace(/\/+$/, "");
              const path =
                apiPath ||
                (apiMode
                  ? DEFAULT_API_PATHS[apiMode] || "/v1/chat/completions"
                  : "/v1/chat/completions");
              baseUrl = host + path;
            }

            const config = {
              baseUrl,
              apiKey,
              model,
              apiMode: apiMode || detectApiMode(baseUrl),
            };

            // 全部为空 → 使用内置默认，无需测试
            if (!apiHost && !apiKey && !model) {
              panel.webview.postMessage({
                type: "testResult",
                ok: true,
                message: "当前为内置默认配置，无需测试，开箱即用 🎉",
              });
              return;
            }

            // 部分为空 → 提示填完整
            if (!apiHost || !apiKey || !model) {
              panel.webview.postMessage({
                type: "testResult",
                ok: false,
                message:
                  "请填写完整的 API Host、API Key 和模型名称（或全部清空使用内置默认服务）",
              });
              return;
            }

            panel.webview.postMessage({
              type: "testing",
              message: "正在测试连接...",
            });

            try {
              const result = await testApiConfig(config);
              if (!panel.visible) return;
              panel.webview.postMessage({
                type: "testResult",
                ok: result.ok,
                message: result.message,
                latency: result.latency,
              });
            } catch (e) {
              if (!panel.visible) return;
              panel.webview.postMessage({
                type: "testResult",
                ok: false,
                message: `测试出错: ${e.message}`,
              });
            }
            break;
          }

          case "save": {
            const apiMode = (msg.apiMode || "").trim();
            const apiHost = (msg.apiHost || "").trim();
            const apiPath = (msg.apiPath || "").trim();
            const apiKey = (msg.apiKey || "").trim();
            const model = (msg.model || "").trim();
            const enhanceMode =
              (msg.enhanceMode || "fast").trim() === "deep" ? "deep" : "fast";

            // 组装 baseUrl
            let baseUrl = "";
            if (apiHost) {
              const host = apiHost.replace(/\/+$/, "");
              const path =
                apiPath ||
                (apiMode
                  ? DEFAULT_API_PATHS[apiMode] || "/v1/chat/completions"
                  : "/v1/chat/completions");
              baseUrl = host + path;
            }

            const config = {
              baseUrl,
              apiKey,
              model,
              apiMode: apiMode || detectApiMode(baseUrl),
            };

            // 全部为空 → 清除自定义配置，恢复使用内置默认
            if (!apiHost && !apiKey && !model) {
              try {
                const target = vscode.ConfigurationTarget.Global;
                const cfgNow = vscode.workspace.getConfiguration("easyPrompt");
                await cfgNow.update("apiMode", undefined, target);
                await cfgNow.update("apiHost", undefined, target);
                await cfgNow.update("apiPath", undefined, target);
                await cfgNow.update("apiBaseUrl", undefined, target);
                await cfgNow.update("apiKey", undefined, target);
                await cfgNow.update("model", undefined, target);
                await cfgNow.update("enhanceMode", enhanceMode, target);
                if (!panel.visible) return;
                panel.webview.postMessage({
                  type: "saveResult",
                  ok: true,
                  message: "✅ 已保存 — 当前使用内置免费服务",
                });
                panel.webview.postMessage({ type: "switchToDefault" });
              } catch (e) {
                if (!panel.visible) return;
                panel.webview.postMessage({
                  type: "saveResult",
                  ok: false,
                  message: `保存失败: ${e.message}`,
                });
              }
              return;
            }

            // 部分为空 → 提示填完整
            if (!apiHost || !apiKey || !model) {
              panel.webview.postMessage({
                type: "saveResult",
                ok: false,
                message:
                  "请填写完整的 API Host、API Key 和模型名称（或全部清空使用内置默认服务）",
              });
              return;
            }

            // 先测试再保存
            panel.webview.postMessage({
              type: "testing",
              message: "保存前验证中...",
            });

            try {
              const result = await testApiConfig(config);
              if (!panel.visible) return;
              if (!result.ok) {
                panel.webview.postMessage({
                  type: "saveResult",
                  ok: false,
                  message: `验证失败，未保存：${result.message}`,
                });
                return;
              }

              // 测试通过，写入配置
              const target = vscode.ConfigurationTarget.Global;
              const cfgNow = vscode.workspace.getConfiguration("easyPrompt");
              await cfgNow.update("apiMode", apiMode || undefined, target);
              await cfgNow.update("apiHost", apiHost || undefined, target);
              await cfgNow.update("apiPath", apiPath || undefined, target);
              await cfgNow.update("apiBaseUrl", config.baseUrl, target);
              await cfgNow.update("apiKey", config.apiKey, target);
              await cfgNow.update("model", config.model, target);
              await cfgNow.update("enhanceMode", enhanceMode, target);

              if (!panel.visible) return;
              panel.webview.postMessage({
                type: "saveResult",
                ok: true,
                message: `✅ 配置已保存并生效 · 响应耗时 ${result.latency}ms`,
              });
            } catch (e) {
              if (!panel.visible) return;
              panel.webview.postMessage({
                type: "saveResult",
                ok: false,
                message: `保存失败: ${e.message}`,
              });
            }
            break;
          }

          case "reset": {
            // 清除用户自定义配置，恢复使用内置默认
            try {
              const target = vscode.ConfigurationTarget.Global;
              const cfgNow = vscode.workspace.getConfiguration("easyPrompt");
              await cfgNow.update("apiMode", undefined, target);
              await cfgNow.update("apiHost", undefined, target);
              await cfgNow.update("apiPath", undefined, target);
              await cfgNow.update("apiBaseUrl", undefined, target);
              await cfgNow.update("apiKey", undefined, target);
              await cfgNow.update("model", undefined, target);
              await cfgNow.update("enhanceMode", "fast", target);

              if (!panel.visible) return;
              panel.webview.postMessage({
                type: "resetResult",
                message: "已恢复使用内置默认服务",
              });
            } catch (e) {
              if (!panel.visible) return;
              panel.webview.postMessage({
                type: "resetResult",
                message: `重置失败: ${e.message}`,
              });
            }
            break;
          }

          case "fetchModels": {
            const fmApiMode = (msg.apiMode || "").trim();
            const fmApiHost = (msg.apiHost || "").trim();
            const fmApiPath = (msg.apiPath || "").trim();
            const fmApiKey = (msg.apiKey || "").trim();

            if (!fmApiHost || !fmApiKey) {
              panel.webview.postMessage({
                type: "fetchModelsResult",
                ok: false,
                models: [],
                message: "请先填写 API Host 和 API Key",
              });
              return;
            }

            let fmBaseUrl = "";
            const host = fmApiHost.replace(/\/+$/, "");
            const path =
              fmApiPath ||
              (fmApiMode
                ? DEFAULT_API_PATHS[fmApiMode] || "/v1/chat/completions"
                : "/v1/chat/completions");
            fmBaseUrl = host + path;

            const fmConfig = {
              baseUrl: fmBaseUrl,
              apiKey: fmApiKey,
              model: "dummy",
              apiMode: fmApiMode || detectApiMode(fmBaseUrl),
            };

            panel.webview.postMessage({
              type: "fetchingModels",
              message: "正在获取模型列表...",
            });

            try {
              const result = await fetchModels(fmConfig, host);
              if (!panel.visible) return;
              panel.webview.postMessage({
                type: "fetchModelsResult",
                ok: result.ok,
                models: result.models,
                message: result.message,
              });
            } catch (e) {
              if (!panel.visible) return;
              panel.webview.postMessage({
                type: "fetchModelsResult",
                ok: false,
                models: [],
                message: `获取失败: ${e.message}`,
              });
            }
            break;
          }
        }
      },
      undefined,
      context.subscriptions,
    );
  };
}

/**
 * 生成配置面板 Webview HTML
 * 支持 4 种 API 模式 + Host/Path 分离 + 模型获取 + Fast/Deep 模式
 */
function getConfigHtml(
  apiMode,
  apiHost,
  apiPath,
  baseUrl,
  apiKey,
  model,
  enhanceMode,
) {
  // HTML 实体转义（防 XSS）
  const esc = (s) =>
    String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  // 如果用户有旧版 baseUrl 但没有新版 apiHost/apiPath，自动拆分
  let displayHost = apiHost || "";
  let displayPath = apiPath || "";
  if (!displayHost && baseUrl) {
    try {
      const u = new URL(baseUrl);
      displayHost = u.origin;
      displayPath = u.pathname;
    } catch {}
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
:root {
  --bg: var(--vscode-editor-background, #1e1e1e);
  --card: var(--vscode-sideBar-background, #252526);
  --border: var(--vscode-input-border, #3e3e42);
  --text: var(--vscode-foreground, #cccccc);
  --text-dim: var(--vscode-descriptionForeground, #858585);
  --accent: var(--vscode-textLink-foreground, #0078d4);
  --accent-light: var(--vscode-textLink-activeForeground, #1a8cff);
  --success: var(--vscode-terminal-ansiGreen, #4ec9b0);
  --error: var(--vscode-errorForeground, #f48771);
  --warn: var(--vscode-editorWarning-foreground, #dcdcaa);
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg); color: var(--text); padding: 40px 32px;
  max-width: 680px; margin: 0 auto;
}
h1 { font-size: 24px; color: #fff; margin-bottom: 8px; }
.subtitle { color: var(--text-dim); font-size: 14px; margin-bottom: 32px; }

.status-bar {
  background: #1a2a3a; border-left: 3px solid var(--accent);
  padding: 12px 16px; border-radius: 0 6px 6px 0;
  font-size: 13px; margin-bottom: 28px; display: flex;
  align-items: center; gap: 8px;
}
.status-bar.using-default { border-left-color: var(--success); }
.status-bar.using-custom { border-left-color: var(--warn); }
.status-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--success); flex-shrink: 0;
}
.status-bar.using-custom .status-dot { background: var(--warn); }

.form-group { margin-bottom: 20px; }
.form-group label {
  display: block; font-size: 13px; font-weight: 500;
  color: #fff; margin-bottom: 6px;
}
.form-group .hint {
  font-size: 12px; color: var(--text-dim); margin-bottom: 6px;
}
input[type="text"], input[type="password"], select {
  width: 100%; padding: 10px 12px; border-radius: 6px;
  border: 1px solid var(--border); background: var(--card);
  color: var(--text); font-size: 14px; font-family: inherit;
  outline: none; transition: border-color 0.2s;
}
input:focus, select:focus { border-color: var(--accent); }
input::placeholder { color: #555; }
select { cursor: pointer; -webkit-appearance: none; appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23858585' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px;
}
select option { background: var(--card); color: var(--text); }

.field-row {
  display: flex; gap: 12px;
}
.field-row > .form-group { flex: 1; min-width: 0; }
.field-row > .form-group.field-host { flex: 1.2; }
.field-row > .form-group.field-path { flex: 0.8; }

.model-row { display: flex; gap: 8px; align-items: flex-start; }
.model-row .combo-box { flex: 1; }
.btn-fetch {
  padding: 10px 14px; border-radius: 6px; font-size: 13px;
  font-weight: 500; cursor: pointer; border: 1px solid var(--border);
  background: var(--card); color: var(--accent-light);
  white-space: nowrap; transition: background 0.2s, border-color 0.2s;
  display: flex; align-items: center; gap: 5px;
  height: 42px;
}
.btn-fetch:hover:not(:disabled) { background: #2a3a4a; border-color: var(--accent); }
.btn-fetch:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-row {
  display: flex; gap: 12px; margin-top: 28px; flex-wrap: wrap;
}
.btn {
  padding: 10px 24px; border-radius: 6px; font-size: 14px;
  font-weight: 500; cursor: pointer; border: none;
  transition: background 0.2s, transform 0.1s;
}
.btn:hover { transform: translateY(-1px); }
.btn:active { transform: translateY(0); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--accent-light); }
.btn-test { background: #2d4a2d; color: var(--success); }
.btn-test:hover:not(:disabled) { background: #355a35; }
.btn-reset {
  background: transparent; color: var(--text-dim);
  border: 1px solid var(--border);
}
.btn-reset:hover { background: var(--card); color: var(--error); border-color: var(--error); }

.result-box {
  margin-top: 16px; padding: 12px 16px; border-radius: 6px;
  font-size: 13px; display: none; line-height: 1.5;
}
.result-box.success { background: #1e3a1e; color: var(--success); display: block; }
.result-box.error { background: #3a2020; color: var(--error); display: block; }
.result-box.info { background: #1a2a3a; color: var(--accent-light); display: block; }

.toggle-btn {
  background: none; border: none; color: var(--accent-light);
  cursor: pointer; font-size: 12px; padding: 2px 6px;
  margin-left: 8px;
}

.divider {
  border: none; border-top: 1px solid var(--border);
  margin: 28px 0;
}

/* Combo Box 可编辑下拉框 */
.combo-box {
  position: relative; width: 100%;
}
.combo-box input[type="text"] {
  width: 100%; padding-right: 36px;
}
.combo-toggle {
  position: absolute; right: 1px; top: 1px; bottom: 1px;
  width: 34px; background: var(--card); border: none;
  border-left: 1px solid var(--border); border-radius: 0 5px 5px 0;
  color: var(--text-dim); cursor: pointer; font-size: 12px;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.2s;
}
.combo-toggle:hover { color: var(--text); }
.combo-dropdown {
  display: none; position: absolute; top: calc(100% + 4px);
  left: 0; right: 0; max-height: 260px; overflow-y: auto;
  background: var(--card); border: 1px solid var(--border);
  border-radius: 6px; z-index: 100;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}
.combo-dropdown.open { display: block; }
.combo-group {
  padding: 6px 12px 2px; font-size: 11px; font-weight: 600;
  color: var(--accent-light); text-transform: uppercase;
  letter-spacing: 0.5px;
}
.combo-option {
  padding: 8px 12px; font-size: 13px; cursor: pointer;
  display: flex; justify-content: space-between; align-items: center;
  transition: background 0.1s;
}
.combo-option:hover { background: #2a2d2e; }
.combo-option .model-id { color: var(--text); }
.combo-option .model-desc { color: var(--text-dim); font-size: 11px; }
.combo-option.active { background: #094771; }
.combo-separator {
  border: none; border-top: 1px solid var(--border);
  margin: 4px 0;
}
</style>
</head>
<body>
  <h1>⚙️ 自定义 API 配置</h1>
  <p class="subtitle">配置你自己的 API 服务，支持 OpenAI / Claude / Gemini / DeepSeek 等多种 API 格式</p>

  <div class="status-bar ${apiKey ? "using-custom" : "using-default"}" id="statusBar">
    <span class="status-dot"></span>
    <span id="statusText">${apiKey ? "当前使用：自定义 API 配置" : "当前使用：内置免费服务（无需任何配置）"}</span>
  </div>

  <div class="form-group">
    <label>API 模式</label>
    <div class="hint">选择你的 API 服务商使用的协议格式，切换时会自动填充对应的默认路径</div>
    <select id="apiMode">
      <option value=""${!apiMode ? " selected" : ""}>自动检测（根据路径推断）</option>
      <option value="openai"${apiMode === "openai" ? " selected" : ""}>OpenAI Chat Completions 兼容</option>
      <option value="openai-responses"${apiMode === "openai-responses" ? " selected" : ""}>OpenAI Responses API 兼容</option>
      <option value="claude"${apiMode === "claude" ? " selected" : ""}>Claude API 兼容</option>
      <option value="gemini"${apiMode === "gemini" ? " selected" : ""}>Google Gemini API 兼容</option>
    </select>
  </div>

  <div class="field-row">
    <div class="form-group field-host">
      <label>API Host</label>
      <div class="hint">服务器地址（协议+域名+端口）</div>
      <input type="text" id="apiHost" value="${esc(displayHost)}" placeholder="留空 = 使用内置免费服务" />
    </div>
    <div class="form-group field-path">
      <label>API Path</label>
      <div class="hint">切换模式自动填充</div>
      <input type="text" id="apiPath" value="${esc(displayPath)}" placeholder="/v1/chat/completions" />
    </div>
  </div>

  <div class="form-group">
    <label>API Key <button class="toggle-btn" id="toggleKey" onclick="toggleKeyVisibility()">显示</button></label>
    <div class="hint">你的 API Key，保存后不会在设置页面明文展示</div>
    <input type="password" id="apiKey" value="${esc(apiKey)}" placeholder="${apiKey ? "已配置（点击显示查看）" : "留空 = 使用内置免费服务"}" />
  </div>

  <div class="form-group">
    <label>模型名称</label>
    <div class="hint">${apiKey ? "从下拉列表选择常用模型，点击「获取模型」自动查询，或手动输入模型名称" : "从下拉列表选择内置服务支持的模型，或手动输入模型名称"}</div>
    <div class="model-row">
      <div class="combo-box" id="comboBox">
        <input type="text" id="model" value="${esc(model)}" placeholder="留空 = 使用内置默认模型" autocomplete="off" />
        <button type="button" class="combo-toggle" id="comboToggle" onclick="toggleDropdown()">▾</button>
        <div class="combo-dropdown" id="comboDropdown">
          <div id="fetchedModelsSection" style="display:none"></div>
${
  apiKey
    ? `
          <div class="combo-group">Anthropic</div>
          <div class="combo-option" data-value="claude-opus-4-6"><span class="model-id">claude-opus-4-6</span><span class="model-desc">Opus 4.6 最智能</span></div>
          <div class="combo-option" data-value="claude-sonnet-4-5"><span class="model-id">claude-sonnet-4-5</span><span class="model-desc">Sonnet 4.5 均衡</span></div>
          <div class="combo-option" data-value="claude-haiku-4-5"><span class="model-id">claude-haiku-4-5</span><span class="model-desc">Haiku 4.5 最快</span></div>
          <div class="combo-option" data-value="claude-opus-4-1"><span class="model-id">claude-opus-4-1</span><span class="model-desc">Opus 4.1</span></div>
          <div class="combo-option" data-value="claude-sonnet-4"><span class="model-id">claude-sonnet-4</span><span class="model-desc">Sonnet 4</span></div>
          <hr class="combo-separator" />
          <div class="combo-group">OpenAI</div>
          <div class="combo-option" data-value="gpt-5.4"><span class="model-id">gpt-5.4</span><span class="model-desc">默认旗舰</span></div>
          <div class="combo-option" data-value="gpt-5.2"><span class="model-id">gpt-5.2</span><span class="model-desc">最新旗舰</span></div>
          <div class="combo-option" data-value="gpt-5.2-pro"><span class="model-id">gpt-5.2-pro</span><span class="model-desc">更智能更精准</span></div>
          <div class="combo-option" data-value="gpt-5-mini"><span class="model-id">gpt-5-mini</span><span class="model-desc">快速高效</span></div>
          <div class="combo-option" data-value="gpt-5-nano"><span class="model-id">gpt-5-nano</span><span class="model-desc">极致性价比</span></div>
          <div class="combo-option" data-value="gpt-5"><span class="model-id">gpt-5</span><span class="model-desc">上一代推理</span></div>
          <div class="combo-option" data-value="gpt-4.1"><span class="model-id">gpt-4.1</span><span class="model-desc">最强非推理</span></div>
          <div class="combo-option" data-value="gpt-4.1-mini"><span class="model-id">gpt-4.1-mini</span><span class="model-desc">轻量快速</span></div>
          <div class="combo-option" data-value="gpt-4o"><span class="model-id">gpt-4o</span><span class="model-desc">灵活智能</span></div>
          <div class="combo-option" data-value="gpt-4o-mini"><span class="model-id">gpt-4o-mini</span><span class="model-desc">经济实惠</span></div>
          <div class="combo-option" data-value="o3"><span class="model-id">o3</span><span class="model-desc">复杂推理</span></div>
          <div class="combo-option" data-value="o4-mini"><span class="model-id">o4-mini</span><span class="model-desc">快速推理</span></div>
          <hr class="combo-separator" />
`
    : ""
}
          <div class="combo-group">Google</div>
          <div class="combo-option" data-value="gemini-3-pro-preview"><span class="model-id">gemini-3-pro-preview</span><span class="model-desc">最强多模态</span></div>
          <div class="combo-option" data-value="gemini-3-flash-preview"><span class="model-id">gemini-3-flash-preview</span><span class="model-desc">速度与智能</span></div>
          <div class="combo-option" data-value="gemini-3.0-pro"><span class="model-id">gemini-3.0-pro</span><span class="model-desc">Gemini 3.0</span></div>
          <div class="combo-option" data-value="gemini-2.5-pro"><span class="model-id">gemini-2.5-pro</span><span class="model-desc">高级思维</span></div>
${
  apiKey
    ? `
          <div class="combo-option" data-value="gemini-2.5-flash"><span class="model-id">gemini-2.5-flash</span><span class="model-desc">高性价比</span></div>
`
    : ""
}
          <hr class="combo-separator" />
          <div class="combo-group">DeepSeek</div>
          <div class="combo-option" data-value="deepseek-v3.2-chat"><span class="model-id">deepseek-v3.2-chat</span><span class="model-desc">V3.2 通用对话</span></div>
          <div class="combo-option" data-value="deepseek-v3.2-reasoner"><span class="model-id">deepseek-v3.2-reasoner</span><span class="model-desc">V3.2 深度推理</span></div>
          <div class="combo-option" data-value="deepseek-r1"><span class="model-id">deepseek-r1</span><span class="model-desc">R1 推理</span></div>
${
  apiKey
    ? ""
    : `
          <hr class="combo-separator" />
          <div class="combo-group">OpenAI</div>
          <div class="combo-option" data-value="gpt-5.4"><span class="model-id">gpt-5.4</span><span class="model-desc">默认旗舰</span></div>
          <div class="combo-option" data-value="gpt-5"><span class="model-id">gpt-5</span><span class="model-desc">GPT-5</span></div>
          <div class="combo-option" data-value="gpt-5-mini"><span class="model-id">gpt-5-mini</span><span class="model-desc">快速高效</span></div>
          <div class="combo-option" data-value="gpt-5-nano"><span class="model-id">gpt-5-nano</span><span class="model-desc">极致性价比</span></div>
          <div class="combo-option" data-value="gpt-4.1"><span class="model-id">gpt-4.1</span><span class="model-desc">最强非推理</span></div>
          <div class="combo-option" data-value="gpt-4o"><span class="model-id">gpt-4o</span><span class="model-desc">灵活智能</span></div>
          <div class="combo-option" data-value="o3"><span class="model-id">o3</span><span class="model-desc">复杂推理</span></div>
          <div class="combo-option" data-value="o4-mini"><span class="model-id">o4-mini</span><span class="model-desc">快速推理</span></div>
          <hr class="combo-separator" />
          <div class="combo-group">xAI</div>
          <div class="combo-option" data-value="grok-4"><span class="model-id">grok-4</span><span class="model-desc">Grok 4</span></div>
          <div class="combo-option" data-value="grok-3"><span class="model-id">grok-3</span><span class="model-desc">Grok 3</span></div>
          <hr class="combo-separator" />
          <div class="combo-group">智谱 GLM</div>
          <div class="combo-option" data-value="glm-5"><span class="model-id">glm-5</span><span class="model-desc">GLM-5</span></div>
          <div class="combo-option" data-value="glm-4.7"><span class="model-id">glm-4.7</span><span class="model-desc">GLM-4.7</span></div>
          <hr class="combo-separator" />
          <div class="combo-group">Kimi</div>
          <div class="combo-option" data-value="kimi-k2.5"><span class="model-id">kimi-k2.5</span><span class="model-desc">K2.5</span></div>
          <div class="combo-option" data-value="kimi-k2"><span class="model-id">kimi-k2</span><span class="model-desc">K2</span></div>
          <hr class="combo-separator" />
          <div class="combo-group">通义千问</div>
          <div class="combo-option" data-value="qwen3-max"><span class="model-id">qwen3-max</span><span class="model-desc">Qwen3 Max</span></div>
          <div class="combo-option" data-value="qwen3-235b"><span class="model-id">qwen3-235b</span><span class="model-desc">Qwen3 235B</span></div>
          <hr class="combo-separator" />
          <div class="combo-group">MiniMax</div>
          <div class="combo-option" data-value="minimax-m2.5"><span class="model-id">minimax-m2.5</span><span class="model-desc">M2.5</span></div>
`
}
        </div>
      </div>
      <button type="button" class="btn-fetch" id="btnFetch" onclick="doFetchModels()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/></svg>
        获取模型
      </button>
    </div>
  </div>

  <div class="form-group">
    <label>增强模式</label>
    <div class="hint">Fast / Deep 只影响输出深度，不会自动切换模型或更改请求接口；Fast 更精炼，Deep 更完整</div>
    <select id="enhanceMode">
      <option value="fast"${enhanceMode !== "deep" ? " selected" : ""}>Fast（默认，速度优先）</option>
      <option value="deep"${enhanceMode === "deep" ? " selected" : ""}>Deep（质量优先）</option>
    </select>
  </div>

  <div class="btn-row">
    <button class="btn btn-test" id="btnTest" onclick="doTest()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="m21 21-4.343-4.343M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"/></svg>
      测试连接
    </button>
    <button class="btn btn-primary" id="btnSave" onclick="doSave()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
      测试并保存
    </button>
    <button class="btn btn-reset" onclick="doReset()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      恢复默认
    </button>
  </div>

  <div class="result-box" id="resultBox"></div>

  <hr class="divider" />
  <p style="color:var(--text-dim);font-size:12px;">
    💡 <strong>提示：</strong>切换「API 模式」会自动填充对应的 API 路径。
    「获取模型」按钮可自动查询服务商支持的模型。
    「测试并保存」会在测试通过后才写入配置。
    「恢复默认」会清除自定义配置，恢复使用内置免费服务。
  </p>

<script>
const vscode = acquireVsCodeApi();

// 模式 → 默认路径映射
const DEFAULT_PATHS = {
  "openai": "/v1/chat/completions",
  "openai-responses": "/v1/responses",
  "claude": "/v1/messages",
  "gemini": "/v1beta"
};

// 模式切换时自动填充默认路径
document.getElementById('apiMode').addEventListener('change', function() {
  const mode = this.value;
  if (mode && DEFAULT_PATHS[mode]) {
    document.getElementById('apiPath').value = DEFAULT_PATHS[mode];
  }
});

// ===== Combo Box 下拉框逻辑 =====
const comboInput = document.getElementById('model');
const comboDropdown = document.getElementById('comboDropdown');
let allOptions = comboDropdown.querySelectorAll('.combo-option');

function toggleDropdown() {
  const isOpen = comboDropdown.classList.contains('open');
  if (isOpen) { closeDropdown(); } else { openDropdown(); }
}

function openDropdown() {
  allOptions.forEach(o => o.style.display = '');
  comboDropdown.querySelectorAll('.combo-group, .combo-separator').forEach(el => el.style.display = '');
  comboDropdown.classList.add('open');
  highlightActive();
}

function closeDropdown() {
  comboDropdown.classList.remove('open');
}

function highlightActive() {
  const val = comboInput.value;
  allOptions.forEach(o => {
    o.classList.toggle('active', o.getAttribute('data-value') === val);
  });
}

comboDropdown.addEventListener('click', e => {
  const opt = e.target.closest('.combo-option');
  if (opt) {
    comboInput.value = opt.getAttribute('data-value');
    closeDropdown();
    comboInput.focus();
  }
});

comboInput.addEventListener('input', () => {
  const q = comboInput.value.toLowerCase();
  if (!q) { openDropdown(); return; }
  let anyVisible = false;
  allOptions.forEach(o => {
    const val = o.getAttribute('data-value');
    const desc = o.textContent.toLowerCase();
    const match = val.toLowerCase().includes(q) || desc.includes(q);
    o.style.display = match ? '' : 'none';
    if (match) anyVisible = true;
  });
  if (!comboDropdown.classList.contains('open') && anyVisible) {
    comboDropdown.classList.add('open');
  }
});

comboInput.addEventListener('focus', () => {
  if (!comboDropdown.classList.contains('open')) openDropdown();
});

document.addEventListener('click', e => {
  if (!document.getElementById('comboBox').contains(e.target)) {
    closeDropdown();
  }
});

comboInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeDropdown(); return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!comboDropdown.classList.contains('open')) { openDropdown(); return; }
    const visible = [...allOptions].filter(o => o.style.display !== 'none');
    if (!visible.length) return;
    const curIdx = visible.findIndex(o => o.classList.contains('active'));
    let nextIdx = e.key === 'ArrowDown' ? curIdx + 1 : curIdx - 1;
    if (nextIdx >= visible.length) nextIdx = 0;
    if (nextIdx < 0) nextIdx = visible.length - 1;
    visible.forEach(o => o.classList.remove('active'));
    visible[nextIdx].classList.add('active');
    visible[nextIdx].scrollIntoView({ block: 'nearest' });
  }
  if (e.key === 'Enter') {
    const active = comboDropdown.querySelector('.combo-option.active');
    if (active && comboDropdown.classList.contains('open')) {
      e.preventDefault();
      comboInput.value = active.getAttribute('data-value');
      closeDropdown();
    }
  }
});
// ===== End Combo Box =====

function getValues() {
  return {
    apiMode: document.getElementById('apiMode').value,
    apiHost: document.getElementById('apiHost').value,
    apiPath: document.getElementById('apiPath').value,
    apiKey: document.getElementById('apiKey').value,
    model: document.getElementById('model').value,
    enhanceMode: document.getElementById('enhanceMode').value,
  };
}

function doTest() {
  const vals = getValues();
  setButtons(true);
  vscode.postMessage({ command: 'test', ...vals });
}

function doSave() {
  const vals = getValues();
  setButtons(true);
  vscode.postMessage({ command: 'save', ...vals });
}

function doReset() {
  vscode.postMessage({ command: 'reset' });
}

function doFetchModels() {
  const vals = getValues();
  if (!vals.apiHost || !vals.apiKey) {
    showResult('error', '❌ 请先填写 API Host 和 API Key');
    return;
  }
  document.getElementById('btnFetch').disabled = true;
  vscode.postMessage({ command: 'fetchModels', ...vals });
}

function setButtons(disabled) {
  document.getElementById('btnTest').disabled = disabled;
  document.getElementById('btnSave').disabled = disabled;
}

function showResult(cls, msg) {
  const box = document.getElementById('resultBox');
  box.className = 'result-box ' + cls;
  box.textContent = msg;
  box.style.display = 'block';
}

function toggleKeyVisibility() {
  const input = document.getElementById('apiKey');
  const btn = document.getElementById('toggleKey');
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '隐藏';
  } else {
    input.type = 'password';
    btn.textContent = '显示';
  }
}

function populateFetchedModels(models) {
  const section = document.getElementById('fetchedModelsSection');
  if (!models || models.length === 0) {
    section.style.display = 'none';
    return;
  }
  let html = '<div class="combo-group">API 返回的模型</div>';
  models.forEach(m => {
    html += '<div class="combo-option" data-value="' + m + '"><span class="model-id">' + m + '</span></div>';
  });
  html += '<hr class="combo-separator" />';
  section.innerHTML = html;
  section.style.display = '';
  // 刷新选项列表
  allOptions = comboDropdown.querySelectorAll('.combo-option');
}

window.addEventListener('message', e => {
  const msg = e.data;
  setButtons(false);
  switch (msg.type) {
    case 'testing':
      showResult('info', '⏳ ' + msg.message);
      setButtons(true);
      break;
    case 'testResult':
      showResult(msg.ok ? 'success' : 'error', (msg.ok ? '✅ ' : '❌ ') + msg.message);
      break;
    case 'saveResult':
      showResult(msg.ok ? 'success' : 'error', msg.message);
      if (msg.ok) {
        const bar = document.getElementById('statusBar');
        bar.className = 'status-bar using-custom';
        document.getElementById('statusText').textContent = '当前使用：自定义 API 配置';
      }
      break;
    case 'resetResult':
      showResult('success', '✅ ' + msg.message);
      document.getElementById('apiMode').value = '';
      document.getElementById('apiHost').value = '';
      document.getElementById('apiHost').placeholder = '留空 = 使用内置免费服务';
      document.getElementById('apiPath').value = '';
      document.getElementById('apiPath').placeholder = '/v1/chat/completions';
      document.getElementById('apiKey').value = '';
      document.getElementById('apiKey').placeholder = '留空 = 使用内置免费服务';
      document.getElementById('apiKey').type = 'password';
      document.getElementById('toggleKey').textContent = '显示';
      document.getElementById('model').value = '';
      document.getElementById('model').placeholder = '留空 = 使用内置默认模型';
      document.getElementById('enhanceMode').value = 'fast';
      const section = document.getElementById('fetchedModelsSection');
      section.innerHTML = '';
      section.style.display = 'none';
      allOptions = comboDropdown.querySelectorAll('.combo-option');
      const bar = document.getElementById('statusBar');
      bar.className = 'status-bar using-default';
      document.getElementById('statusText').textContent = '当前使用：内置免费服务（无需任何配置）';
      break;
    case 'switchToDefault':
      document.getElementById('statusBar').className = 'status-bar using-default';
      document.getElementById('statusText').textContent = '当前使用：内置免费服务（无需任何配置）';
      break;
    case 'fetchingModels':
      showResult('info', '⏳ ' + msg.message);
      break;
    case 'fetchModelsResult':
      document.getElementById('btnFetch').disabled = false;
      if (msg.ok) {
        showResult('success', '✅ ' + msg.message);
        populateFetchedModels(msg.models);
        openDropdown();
      } else {
        showResult('error', '❌ ' + msg.message);
      }
      break;
  }
});
</script>
</body>
</html>`;
}

/**
 * 命令 9：查看增强历史（Ctrl+Alt+Y）
 * 使用 Webview 展示历史记录列表，支持 before/after 对比和复制
 */
function showHistoryCommand(context) {
  function formatTime(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    const now = new Date();
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return `今天 ${time}`;
    if (diffDays === 1) return `昨天 ${time}`;
    if (diffDays < 7) return `${diffDays} 天前 ${time}`;
    const month = d.getMonth() + 1;
    const day = d.getDate();
    if (d.getFullYear() === now.getFullYear())
      return `${month}月${day}日 ${time}`;
    return `${d.getFullYear()}/${month}/${day} ${time}`;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildHistoryHtml(history) {
    const historyCards =
      history.length === 0
        ? `<div class="empty"><h2>暂无增强记录</h2><p>使用 Prompt 增强后，历史记录会自动保存在这里</p></div>`
        : history
            .map(
              (r) => `
        <div class="card" data-id="${r.id}">
          <div class="card-header">
            <div class="meta">
              <span class="time">${formatTime(r.timestamp)}</span>
              <span class="badge badge-${r.mode}">${r.mode === "smart" ? "智能路由" : r.sceneName || "场景"}</span>
            </div>
            <div class="preview">${escapeHtml(r.originalText.slice(0, 100))}${r.originalText.length > 100 ? "..." : ""}</div>
            <span class="chevron"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>
          </div>
          <div class="card-body">
            <div class="diff-section">
              <div class="diff-label diff-before">
                <span>原始文本</span>
                <button class="copy-btn" data-action="copy" data-type="original" data-id="${r.id}">复制</button>
              </div>
              <pre class="diff-text">${escapeHtml(r.originalText)}</pre>
            </div>
            <div class="diff-section">
              <div class="diff-label diff-after">
                <span>增强结果</span>
                <button class="copy-btn" data-action="copy" data-type="enhanced" data-id="${r.id}">复制</button>
              </div>
              <pre class="diff-text">${escapeHtml(r.enhancedText)}</pre>
            </div>
            <div class="card-actions">
              <button class="del-btn" data-action="delete" data-id="${r.id}">删除此记录</button>
            </div>
          </div>
        </div>
      `,
            )
            .join("");

    return `<!DOCTYPE html>
<html><head><style>
  body { font-family: var(--vscode-font-family); background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); padding: 20px; margin: 0; }
  h1 { font-size: 18px; margin: 0 0 6px; }
  .subtitle { font-size: 13px; color: var(--vscode-descriptionForeground); margin-bottom: 20px; }
  .toolbar { display: flex; gap: 10px; margin-bottom: 16px; }
  .toolbar button { padding: 6px 14px; border: 1px solid var(--vscode-button-border, var(--vscode-input-border)); border-radius: 4px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer; font-size: 12px; }
  .toolbar button:hover { background: var(--vscode-button-secondaryHoverBackground); }
  .empty { text-align: center; padding: 60px 20px; color: var(--vscode-descriptionForeground); }
  .empty h2 { font-size: 16px; margin-bottom: 8px; }
  .empty p { font-size: 13px; }
  .card { border: 1px solid var(--vscode-input-border); border-radius: 6px; margin-bottom: 10px; overflow: hidden; }
  .card-header { padding: 12px 16px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; position: relative; }
  .card-header:hover { background: var(--vscode-list-hoverBackground); }
  .meta { display: flex; align-items: center; gap: 8px; }
  .time { font-size: 12px; color: var(--vscode-descriptionForeground); font-variant-numeric: tabular-nums; }
  .badge { font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 100px; }
  .badge-smart { background: rgba(139,92,246,0.15); color: rgb(167,139,250); }
  .badge-scene { background: rgba(34,197,94,0.15); color: rgb(74,222,128); }
  .preview { font-size: 13px; color: var(--vscode-editor-foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.7; }
  .chevron { position: absolute; right: 16px; top: 14px; color: var(--vscode-descriptionForeground); transition: transform 0.15s; display: flex; align-items: center; }
  .card.expanded .chevron { transform: rotate(180deg); }
  .card-body { display: none; border-top: 1px solid var(--vscode-input-border); padding: 16px; }
  .card.expanded .card-body { display: block; }
  .diff-section { margin-bottom: 12px; border-radius: 4px; overflow: hidden; }
  .diff-label { display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; font-size: 12px; font-weight: 600; }
  .diff-before { background: rgba(239,68,68,0.12); color: rgb(248,113,113); }
  .diff-after { background: rgba(34,197,94,0.12); color: rgb(74,222,128); }
  .copy-btn { padding: 2px 8px; border: none; border-radius: 3px; background: transparent; color: inherit; font-size: 11px; cursor: pointer; opacity: 0.7; }
  .copy-btn:hover { opacity: 1; }
  .diff-text { margin: 0; padding: 12px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; background: var(--vscode-editor-background); border: 1px solid var(--vscode-input-border); border-top: none; max-height: 200px; overflow-y: auto; }
  .card-actions { display: flex; justify-content: flex-end; margin-top: 8px; }
  .del-btn { padding: 4px 12px; border: 1px solid rgba(239,68,68,0.3); border-radius: 4px; background: transparent; color: rgb(248,113,113); font-size: 12px; cursor: pointer; }
  .del-btn:hover { background: rgba(239,68,68,0.12); }
</style></head><body>
  <h1>增强历史</h1>
  <p class="subtitle">${history.length} 条记录（最多保留 ${MAX_HISTORY} 条）</p>
  ${history.length > 0 ? '<div class="toolbar"><button id="btn-clear">清空全部历史</button></div>' : ""}
  <div id="history-container">${historyCards}</div>
  <script>
    const vscode = acquireVsCodeApi();
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        e.stopPropagation();
        vscode.postMessage({ action: btn.dataset.action, type: btn.dataset.type, id: btn.dataset.id });
        return;
      }
      const header = e.target.closest('.card-header');
      if (header) {
        const card = header.closest('.card');
        if (card) card.classList.toggle('expanded');
      }
    });
    const clearBtn = document.getElementById('btn-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('确定要清空所有增强历史记录吗？此操作不可撤销。')) {
          vscode.postMessage({ action: 'clearAll' });
        }
      });
    }
  </script>
</body></html>`;
  }

  function refreshPanel(panel) {
    panel.webview.html = buildHistoryHtml(loadHistory());
  }

  return () => {
    // 复用已存在的面板
    if (_historyPanel) {
      _historyPanel.reveal(vscode.ViewColumn.One);
      refreshPanel(_historyPanel);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "easyPromptHistory",
      "Easy Prompt 增强历史",
      vscode.ViewColumn.One,
      { enableScripts: true },
    );

    _historyPanel = panel;
    panel.onDidDispose(() => {
      _historyPanel = null;
    });

    refreshPanel(panel);

    panel.webview.onDidReceiveMessage((msg) => {
      if (msg.action === "copy") {
        const record = loadHistory().find((r) => r.id === msg.id);
        if (!record) return;
        const text =
          msg.type === "original" ? record.originalText : record.enhancedText;
        vscode.env.clipboard.writeText(text);
        vscode.window.showInformationMessage("已复制到剪贴板");
      } else if (msg.action === "delete") {
        const history = loadHistory().filter((r) => r.id !== msg.id);
        _context.globalState.update(HISTORY_KEY, history);
        refreshPanel(panel);
      } else if (msg.action === "clearAll") {
        clearHistoryStorage();
        refreshPanel(panel);
        vscode.window.showInformationMessage("历史记录已清空");
      }
    });
  };
}

function activate(context) {
  // 保存全局上下文引用（用于场景命中计数）
  _context = context;

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "easy-prompt.enhanceSelected",
      enhanceSelected,
    ),
    vscode.commands.registerCommand("easy-prompt.smartEnhance", smartEnhance),
    vscode.commands.registerCommand("easy-prompt.enhanceInput", enhanceInput),
    vscode.commands.registerCommand("easy-prompt.showScenes", showScenes),
    vscode.commands.registerCommand(
      "easy-prompt.enhanceWithScene",
      enhanceWithScene,
    ),
    vscode.commands.registerCommand(
      "easy-prompt.showWelcome",
      showWelcome(context),
    ),
    vscode.commands.registerCommand(
      "easy-prompt.configureApi",
      configureApi(context),
    ),
    vscode.commands.registerCommand(
      "easy-prompt.statusBarMenu",
      showStatusBarMenu(context),
    ),
    vscode.commands.registerCommand(
      "easy-prompt.showHistory",
      showHistoryCommand(context),
    ),
  );

  // 状态栏常驻入口
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.text = "$(sparkle) Easy Prompt";
  statusBarItem.tooltip = "Easy Prompt — 点击打开快捷菜单";
  statusBarItem.command = "easy-prompt.statusBarMenu";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // 首次安装检测 → 弹出 Welcome 引导页
  checkAndShowWelcome(context);
}

/**
 * 状态栏菜单：简洁的快捷入口
 */
function showStatusBarMenu(context) {
  return async () => {
    const menuItems = [
      {
        label: "$(zap) 智能增强",
        description: "Ctrl+Alt+I",
        detail: "自动判断增强选中/文件/粘贴板内容，无需手动选择",
        command: "easy-prompt.smartEnhance",
      },
      {
        label: "$(edit) 快速输入增强",
        description: "Ctrl+Alt+O",
        detail: "输入一句描述，AI 自动识别意图并生成专业 Prompt",
        command: "easy-prompt.enhanceInput",
      },
      {
        label: "$(selection) 增强选中文本",
        description: "Ctrl+Alt+P",
        detail: "选中编辑器中的文本，原地替换为增强后的 Prompt",
        command: "easy-prompt.enhanceSelected",
      },
      {
        label: "$(symbol-method) 指定场景增强",
        description: "Ctrl+Alt+M",
        detail: "手动选择场景，跳过 AI 识别，精准定向增强",
        command: "easy-prompt.enhanceWithScene",
      },
      {
        label: "$(list-unordered) 浏览场景大全",
        description: "Ctrl+Alt+L",
        detail: "查看 97 个场景的详情和 System Prompt",
        command: "easy-prompt.showScenes",
      },
      {
        label: "$(history) 增强历史",
        description: "Ctrl+Alt+Y",
        detail: "查看过往 Prompt 增强记录，支持对比与复制",
        command: "easy-prompt.showHistory",
      },
      {
        label: "$(book) 使用教程",
        description: "Ctrl+Alt+H",
        detail: "查看快速入门、快捷键和场景预览",
        command: "easy-prompt.showWelcome",
      },
      {
        label: "$(gear) API 配置",
        description: "",
        detail: "配置自定义 API Key（OpenAI/Gemini/DeepSeek 等）",
        command: "easy-prompt.configureApi",
      },
    ];

    const selected = await vscode.window.showQuickPick(menuItems, {
      placeHolder: "Easy Prompt — 选择操作",
      matchOnDescription: false,
      matchOnDetail: true,
    });

    if (selected) {
      vscode.commands.executeCommand(selected.command);
    }
  };
}

function deactivate() {}

module.exports = { activate, deactivate };
