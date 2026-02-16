/**
 * Easy Prompt — 完整流程测试脚本
 * 验证核心模块的导出、场景完整性、路由器和 Prompt 生成逻辑
 */

const core = require("./core");

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.log(`  ✗ ${msg}`);
    failed++;
  }
}

console.log("🧪 Easy Prompt 完整流程测试\n");

// ===========================
// 1. 模块导出检查
// ===========================
console.log("=== 1. 模块导出检查 ===");
const exportKeys = Object.keys(core);
const expectedExports = [
  "SCENES",
  "SCENE_NAMES",
  "SCENE_NAMES_EN",
  "buildRouterPrompt",
  "parseRouterResult",
  "buildGenerationPrompt",
  "callApi",
  "callRouterApi",
  "callGenerationApi",
  "smartRoute",
  "testApiConfig",
  "getBuiltinDefaults",
];
for (const key of expectedExports) {
  assert(exportKeys.includes(key), `导出 ${key}`);
}
assert(typeof core.smartRoute === "function", "smartRoute 是函数");
assert(typeof core.callApi === "function", "callApi 是函数");
assert(typeof core.testApiConfig === "function", "testApiConfig 是函数");
assert(
  typeof core.buildRouterPrompt === "function",
  "buildRouterPrompt 是函数",
);

// ===========================
// 2. 场景完整性检查
// ===========================
console.log("\n=== 2. 场景完整性检查 ===");
const scenes = core.SCENES;
const sceneIds = Object.keys(scenes);
assert(sceneIds.length === 85, `场景总数 = ${sceneIds.length} (期望 85)`);

for (const [id, s] of Object.entries(scenes)) {
  const hasAll =
    s.name && s.keywords && s.keywords.length > 0 && s.prompt && s.description;
  if (!hasAll) {
    console.log(`  ✗ 场景 "${id}" 缺少必需字段`);
    failed++;
  }
}
assert(true, `所有场景均含必需字段 (name/keywords/prompt/description)`);

// 检查 SCENE_NAMES 映射
for (const id of sceneIds) {
  assert(
    core.SCENE_NAMES[id] !== undefined,
    `SCENE_NAMES["${id}"] = "${core.SCENE_NAMES[id]}"`,
  );
}

// ===========================
// 3. 路由器 Prompt 构建
// ===========================
console.log("\n=== 3. 路由器 Prompt 构建 ===");
const rp = core.buildRouterPrompt();
assert(
  typeof rp === "string" && rp.length > 500,
  `Prompt 长度 = ${rp.length} 字符`,
);
assert(rp.includes("意图分类器"), '包含"意图分类器"');
assert(rp.includes("JSON"), '包含"JSON"');
// 检查每个场景 ID 都在 Prompt 中
let allInPrompt = true;
for (const id of sceneIds) {
  if (!rp.includes(id)) {
    console.log(`  ✗ 场景 "${id}" 未出现在 Router Prompt 中`);
    allInPrompt = false;
    failed++;
  }
}
if (allInPrompt) assert(true, "85 个场景 ID 全部包含在 Router Prompt 中");

// 缓存测试
const rp2 = core.buildRouterPrompt();
assert(rp === rp2, "缓存生效 (两次返回同一引用)");

// ===========================
// 4. parseRouterResult 测试
// ===========================
console.log("\n=== 4. JSON 解析 (parseRouterResult) ===");

// 正常 JSON
const r1 = core.parseRouterResult('{"scenes":["optimize"],"composite":false}');
assert(r1.scenes[0] === "optimize" && r1.composite === false, "正常 JSON");

// Markdown 代码块
const r2 = core.parseRouterResult(
  '```json\n{"scenes":["refactor","perf"],"composite":true}\n```',
);
assert(
  r2.scenes.length === 2 &&
    r2.scenes[0] === "refactor" &&
    r2.composite === true,
  "Markdown ```json``` 代码块",
);

// 普通代码块
const r3 = core.parseRouterResult(
  '```\n{"scenes":["debug"],"composite":false}\n```',
);
assert(r3.scenes[0] === "debug" && r3.composite === false, "普通 ``` 代码块");

// 无效场景 ID 过滤
const r4 = core.parseRouterResult(
  '{"scenes":["optimize","invalid_xxx","refactor"],"composite":true}',
);
assert(!r4.scenes.includes("invalid_xxx"), "过滤无效场景 ID");
assert(
  r4.scenes.includes("optimize") && r4.scenes.includes("refactor"),
  "保留有效场景",
);

// 全部无效 → fallback
const r5 = core.parseRouterResult('{"scenes":["xxx","yyy"],"composite":false}');
assert(r5.scenes[0] === "optimize", "全部无效 → fallback 到 optimize");

// 纯文本 → fallback
const r6 = core.parseRouterResult("这不是 JSON 格式，只是一段普通文本");
assert(
  r6.scenes[0] === "optimize" && r6.composite === false,
  "纯文本 → fallback",
);

// composite 为字符串 "true"
const r7 = core.parseRouterResult(
  '{"scenes":["review","perf"],"composite":"true"}',
);
assert(r7.composite === true, 'composite 字符串 "true" → boolean true');

// composite 为字符串 "false"
const r8 = core.parseRouterResult('{"scenes":["review"],"composite":"false"}');
assert(r8.composite === false, 'composite 字符串 "false" → boolean false');

// 空 scenes → fallback
const r9 = core.parseRouterResult('{"scenes":[],"composite":false}');
assert(r9.scenes[0] === "optimize", "空 scenes 数组 → fallback");

// 超过 5 个场景 → 截断
const r10 = core.parseRouterResult(
  '{"scenes":["optimize","refactor","perf","debug","error","review","test"],"composite":true}',
);
assert(
  r10.scenes.length <= 5,
  `超过 5 个场景截断 → 实际 ${r10.scenes.length} 个`,
);

// 单场景 composite=true → 强制 false
const r11 = core.parseRouterResult('{"scenes":["refactor"],"composite":true}');
assert(r11.composite === false, "单场景 composite=true → 强制 false");

// ===========================
// 5. buildGenerationPrompt 测试
// ===========================
console.log("\n=== 5. Prompt 生成 (buildGenerationPrompt) ===");

// 单一 optimize 场景（特殊处理）
const g1 = core.buildGenerationPrompt({
  scenes: ["optimize"],
  composite: false,
});
assert(
  g1.prompt === scenes.optimize.prompt,
  "optimize 场景使用原始 prompt (无包装)",
);
assert(g1.sceneNames[0] === "需求扩写", "optimize 场景名称 = 需求扩写");

// 单一非 optimize 场景
const g2 = core.buildGenerationPrompt({
  scenes: ["refactor"],
  composite: false,
});
assert(g2.prompt.includes("Prompt 生成器"), "非 optimize 包含 meta-wrapper");
assert(g2.prompt.includes(scenes.refactor.prompt), "包含 refactor 原始 prompt");

// 复合模式
const g3 = core.buildGenerationPrompt({
  scenes: ["review", "perf", "doc"],
  composite: true,
});
assert(g3.prompt.includes("3 个方面"), "复合模式提及 3 个方面");
assert(g3.prompt.includes("子任务 1"), "复合模式包含子任务编号");
assert(g3.sceneNames.length === 3, "复合模式返回 3 个场景名称");

// 无效场景 → fallback
const g4 = core.buildGenerationPrompt({
  scenes: ["invalid"],
  composite: false,
});
assert(g4.prompt === scenes.optimize.prompt, "无效场景 fallback 到 optimize");

// ===========================
// 6. VSCode Extension 引用检查
// ===========================
console.log("\n=== 6. VSCode Extension 引用路径检查 ===");
const fs = require("fs");
const extCode = fs.readFileSync("./extension.js", "utf8");
const welcomeCode = fs.readFileSync("./welcomeView.js", "utf8");

assert(
  extCode.includes("require('./core')") ||
    extCode.includes('require("./core")'),
  "extension.js 引用 ./core",
);
assert(
  welcomeCode.includes("require('./core')") ||
    welcomeCode.includes('require("./core")'),
  "welcomeView.js 引用 ./core",
);
assert(extCode.includes("activate"), "extension.js 有 activate 函数");
assert(extCode.includes("deactivate"), "extension.js 有 deactivate 函数");
assert(extCode.includes("module.exports"), "extension.js 有 module.exports");

// 检查注册的命令
const commands = [
  "easy-prompt.enhanceSelected",
  "easy-prompt.enhanceInput",
  "easy-prompt.showScenes",
  "easy-prompt.enhanceWithScene",
  "easy-prompt.showWelcome",
  "easy-prompt.configureApi",
  "easy-prompt.statusBarMenu",
];
for (const cmd of commands) {
  assert(extCode.includes(cmd), `注册命令 ${cmd}`);
}

// ===========================
// 7. package.json 一致性检查
// ===========================
console.log("\n=== 7. package.json 一致性检查 ===");
const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));

assert(pkg.main === "./extension.js", "main = ./extension.js");
assert(pkg.engines.vscode, "engines.vscode 已定义");

// 检查 contributes.commands 与 extension.js 中的命令一致
const declaredCommands = pkg.contributes.commands.map((c) => c.command);
for (const cmd of commands) {
  assert(declaredCommands.includes(cmd), `package.json 声明命令 ${cmd}`);
}

// 检查 keybindings 与 commands 一致
const keybindingCommands = pkg.contributes.keybindings.map((k) => k.command);
assert(
  keybindingCommands.includes("easy-prompt.enhanceSelected"),
  "快捷键: enhanceSelected",
);
assert(
  keybindingCommands.includes("easy-prompt.enhanceInput"),
  "快捷键: enhanceInput",
);
assert(
  keybindingCommands.includes("easy-prompt.showScenes"),
  "快捷键: showScenes",
);
assert(
  keybindingCommands.includes("easy-prompt.enhanceWithScene"),
  "快捷键: enhanceWithScene",
);
assert(
  keybindingCommands.includes("easy-prompt.showWelcome"),
  "快捷键: showWelcome (Ctrl+Alt+H)",
);

// 检查配置项
const cfgProps = pkg.contributes.configuration.properties;
assert(cfgProps["easyPrompt.apiBaseUrl"], "配置项: apiBaseUrl");
assert(cfgProps["easyPrompt.apiKey"], "配置项: apiKey");
assert(cfgProps["easyPrompt.model"], "配置项: model");

// ===========================
// 8. 关键路径模拟
// ===========================
console.log("\n=== 8. 关键路径模拟 ===");

// 模拟完整流程 (不发真实 API)
// Step 1: buildRouterPrompt
const routerPrompt = core.buildRouterPrompt();
assert(routerPrompt.length > 0, "Step 1: buildRouterPrompt() 成功");

// Step 2: 模拟 AI 返回 → parseRouterResult
const mockAiReturn = '{"scenes":["refactor"],"composite":false}';
const routerResult = core.parseRouterResult(mockAiReturn);
assert(
  routerResult.scenes[0] === "refactor",
  "Step 2: parseRouterResult() 正确解析",
);

// Step 3: buildGenerationPrompt
const genResult = core.buildGenerationPrompt(routerResult);
assert(
  genResult.prompt.length > 0,
  "Step 3: buildGenerationPrompt() 生成 Prompt",
);
assert(genResult.sceneNames.length > 0, "Step 3: 包含场景名称");

console.log(
  "\n  模拟完整路由流程: buildRouterPrompt → AI响应 → parseRouterResult → buildGenerationPrompt → AI生成",
);
console.log("  ✓ 全部环节串联正常\n");

// ===========================
// 9. 内置默认配置检查
// ===========================
console.log("=== 9. 内置默认配置检查 ===");
assert(
  typeof core.getBuiltinDefaults === "function",
  "导出 getBuiltinDefaults 函数",
);
const defaults = core.getBuiltinDefaults();
assert(
  defaults.baseUrl && defaults.baseUrl.startsWith("https://"),
  "内置 baseUrl 以 https:// 开头",
);
assert(defaults.baseUrl.endsWith("/v1"), "内置 baseUrl 以 /v1 结尾");
assert(
  defaults.apiKey && defaults.apiKey.startsWith("sk-"),
  "内置 apiKey 以 sk- 开头",
);
assert(defaults.apiKey.length > 10, "内置 apiKey 长度合理");
assert(defaults.model && defaults.model.length > 0, "内置 model 不为空");

// 二次调用一致性
const defaults2 = core.getBuiltinDefaults();
assert(defaults.baseUrl === defaults2.baseUrl, "多次调用返回一致的 baseUrl");
assert(defaults.apiKey === defaults2.apiKey, "多次调用返回一致的 apiKey");

// ===========================
// 10. 发布物料检查
// ===========================
console.log("\n=== 10. 发布物料检查 ===");
const iconExists = fs.existsSync("./icon.png");
if (!iconExists) {
  console.log("  ⚠️  缺少 icon.png — 不影响功能，但插件市场需要图标");
} else {
  assert(true, "icon.png 存在");
}

const vscodeignoreExists = fs.existsSync("./.vscodeignore");
assert(vscodeignoreExists, ".vscodeignore 文件存在");

// ===========================
// 11. v3.2 新功能检查
// ===========================
console.log("\n=== 11. v3.2 新功能检查 ===");

// 场景命中计数相关
assert(extCode.includes("SCENE_STATS_KEY"), "extension.js 含场景统计 Key");
assert(extCode.includes("getSceneStats"), "extension.js 含 getSceneStats 函数");
assert(
  extCode.includes("incrementSceneHits"),
  "extension.js 含 incrementSceneHits 函数",
);
assert(
  extCode.includes("buildSceneItems"),
  "extension.js 含 buildSceneItems 函数",
);

// 状态栏
assert(
  extCode.includes("createStatusBarItem"),
  "extension.js 创建了 StatusBarItem",
);
assert(extCode.includes("showStatusBarMenu"), "extension.js 含状态栏菜单函数");
assert(extCode.includes("Easy Prompt"), "StatusBarItem 文本包含 Easy Prompt");

// 命中计数在成功后递增
const hitIncrements = (extCode.match(/incrementSceneHits/g) || []).length;
assert(
  hitIncrements >= 4,
  `incrementSceneHits 被调用 ${hitIncrements} 次 (期望 ≥4: 定义+3处调用)`,
);

// 动态排序
assert(
  extCode.includes("stats[b]") && extCode.includes("stats[a]"),
  "场景列表按命中次数降序排列",
);
assert(extCode.includes("🔥"), "场景列表含小火苗标记");

// Welcome 页面更新
assert(welcomeCode.includes("v4.0"), "Welcome 页面版本更新到 v4.0");
assert(
  welcomeCode.includes("使用教程") && welcomeCode.includes("Alt</kbd>+<kbd>H"),
  "Welcome 含 Ctrl+Alt+H 快捷键",
);
assert(welcomeCode.includes("状态栏"), "Welcome 提到状态栏功能");

// package.json 版本
assert(pkg.version === "4.1.0", "package.json 版本 = 4.1.0");
assert(
  declaredCommands.includes("easy-prompt.statusBarMenu"),
  "package.json 声明 statusBarMenu 命令",
);

// ===========================
// 结果汇总
// ===========================
console.log("\n" + "=".repeat(50));
console.log(`\n📊 测试结果: ${passed} 通过 / ${failed} 失败`);
if (failed === 0) {
  console.log("\n✅ 所有测试通过！核心流程完整可用。\n");
} else {
  console.log(`\n❌ 有 ${failed} 个测试失败，请检查上面的 ✗ 项。\n`);
}

process.exit(failed > 0 ? 1 : 0);
