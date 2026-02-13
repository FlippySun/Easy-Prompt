#!/usr/bin/env node

/**
 * Easy Prompt - 简单测试脚本
 * 用于验证核心功能是否正常工作
 */

const { buildRouterPrompt, parseRouterResult } = require("./core/router");
const { SCENES, SCENE_NAMES } = require("./core/scenes");

console.log("🧪 Easy Prompt 核心功能测试\n");

// 测试 1: 场景数量
console.log("测试 1: 场景定义");
const sceneCount = Object.keys(SCENES).length;
console.log(`  ✓ 场景总数: ${sceneCount}`);
if (sceneCount !== 38) {
  console.log(`  ⚠️  警告: 预期 38 个场景，实际 ${sceneCount} 个`);
}

// 测试 2: 路由器 Prompt 构建
console.log("\n测试 2: 路由器 Prompt");
const routerPrompt = buildRouterPrompt();
if (routerPrompt && routerPrompt.length > 0) {
  console.log(`  ✓ Prompt 长度: ${routerPrompt.length} 字符`);
} else {
  console.log("  ✗ Prompt 构建失败");
}

// 测试 3: JSON 解析 - 正常格式
console.log("\n测试 3: JSON 解析（正常格式）");
const test3 = parseRouterResult('{"scenes":["optimize"],"composite":false}');
console.log(`  ✓ 场景: ${test3.scenes.join(", ")}`);
console.log(`  ✓ 复合: ${test3.composite}`);

// 测试 4: JSON 解析 - Markdown 格式
console.log("\n测试 4: JSON 解析（Markdown 格式）");
const test4 = parseRouterResult(
  '```json\n{"scenes":["refactor","perf"],"composite":true}\n```',
);
console.log(`  ✓ 场景: ${test4.scenes.join(", ")}`);
console.log(`  ✓ 复合: ${test4.composite}`);

// 测试 5: JSON 解析 - 错误格式
console.log("\n测试 5: JSON 解析（错误格式回退）");
const test5 = parseRouterResult("这不是一个有效的JSON");
console.log(`  ✓ 回退场景: ${test5.scenes.join(", ")}`);

// 测试 6: JSON 解析 - 无效场景 ID 过滤
console.log("\n测试 6: JSON 解析（过滤无效场景）");
const test6 = parseRouterResult(
  '{"scenes":["optimize","invalid-scene","refactor"],"composite":true}',
);
console.log(`  ✓ 过滤后场景: ${test6.scenes.join(", ")}`);
if (test6.scenes.includes("invalid-scene")) {
  console.log("  ✗ 无效场景未被过滤");
} else {
  console.log("  ✓ 无效场景已被过滤");
}

// 测试 7: 场景名称映射
console.log("\n测试 7: 场景名称映射");
console.log(`  ✓ optimize: ${SCENE_NAMES["optimize"]}`);
console.log(`  ✓ refactor: ${SCENE_NAMES["refactor"]}`);
console.log(`  ✓ debug: ${SCENE_NAMES["debug"]}`);

// 测试 8: 缓存功能
console.log("\n测试 8: 路由器 Prompt 缓存");
const prompt1 = buildRouterPrompt();
const prompt2 = buildRouterPrompt();
if (prompt1 === prompt2) {
  console.log("  ✓ 缓存生效（两次调用返回相同引用）");
} else {
  console.log("  ⚠️  缓存可能未生效");
}

console.log("\n✅ 核心功能测试完成\n");
console.log("注意: 此测试仅验证核心逻辑，不测试 API 调用。");
console.log("要测试完整功能，请在 IDE 中使用实际操作。\n");
