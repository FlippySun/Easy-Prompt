/**
 * 真实 API 全流程测试
 * 使用内置默认配置调用 API，验证完整的两步路由
 */
const {
  getBuiltinDefaults,
  buildRouterPrompt,
  parseRouterResult,
  buildGenerationPrompt,
  callRouterApi,
  callGenerationApi,
} = require("./core");

(async () => {
  try {
    const config = getBuiltinDefaults();
    console.log("🔧 使用内置配置:");
    console.log("   baseUrl:", config.baseUrl);
    console.log("   model:", config.model);
    console.log("   apiKey:", config.apiKey.substring(0, 6) + "***");
    console.log();

    // ===== Step 1: 意图识别 =====
    const testInput = "帮我写一个用户登录的表单，要有邮箱密码验证";
    console.log("📝 测试输入:", testInput);
    console.log();

    console.log("🔍 Step 1: 意图识别...");
    const t1 = Date.now();
    const routerPrompt = buildRouterPrompt();
    const routerRaw = await callRouterApi(config, routerPrompt, testInput);
    const t1Done = ((Date.now() - t1) / 1000).toFixed(1);
    console.log("   Router 原始返回:", routerRaw);

    const routerResult = parseRouterResult(routerRaw);
    console.log("   解析结果:", JSON.stringify(routerResult));
    console.log("   耗时:", t1Done + "s");
    console.log("   ✅ Step 1 完成");
    console.log();

    // ===== Step 2: Prompt 生成 =====
    console.log("✍️ Step 2: 专业 Prompt 生成...");
    const t2 = Date.now();
    const genInfo = buildGenerationPrompt(routerResult);
    console.log("   场景:", genInfo.sceneNames.join(" + "));

    const finalPrompt = await callGenerationApi(
      config,
      genInfo.prompt,
      testInput,
      routerResult.composite,
    );
    const t2Done = ((Date.now() - t2) / 1000).toFixed(1);
    console.log("   耗时:", t2Done + "s");
    console.log("   ✅ Step 2 完成");
    console.log();

    // ===== 结果展示 =====
    console.log("═".repeat(60));
    console.log("📊 全流程测试结果:");
    console.log("   场景识别:", routerResult.scenes.join(", "));
    console.log("   复合模式:", routerResult.composite ? "是" : "否");
    console.log("   生成长度:", finalPrompt.length, "字符");
    console.log();
    console.log("--- 生成的 Prompt 预览 ---");
    console.log(finalPrompt.substring(0, 500));
    if (finalPrompt.length > 500)
      console.log("... (共 " + finalPrompt.length + " 字符)");
    console.log();
    console.log("✅ 全流程测试通过！内置 API 配置完全可用。");
  } catch (err) {
    console.error("❌ 测试失败:", err.message);
    process.exit(1);
  }
})();
