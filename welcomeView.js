/**
 * Easy Prompt — Welcome Webview
 * 首次安装引导页，简约现代风格
 */

const vscode = require("vscode");
const { SCENES, SCENE_NAMES } = require("./core");
const {
  getVscodeRuntimeEnv,
  PRODUCTION_WEB_APP_BASE_URL,
  PRODUCTION_WEB_HUB_BASE_URL,
} = require("./vscode-runtime-env");

const WELCOME_STATE_KEY = "easyPrompt.welcomed.v4.0";

/**
 * 2026-04-10
 * 变更类型：修复
 * 功能描述：让 VS Code Welcome Webview 的 PromptHub CTA 在登录完成后自动刷新，并将已登录按钮改为展示当前账号后跳转当前环境的 Web-Hub 用户页。
 * 设计思路：继续复用 extension.js 已注册的 easy-prompt.ssoLogin 命令，但把欢迎页渲染抽象为可重复调用的 renderWelcomePanel(context)；登录态变化时重绘已打开的欢迎页，避免静态 HTML 长时间停留在旧状态。
 * 参数与返回值：showWelcomePage(context) / refreshWelcomePanels(context) 会根据 globalState 中的 SSO 用户信息与运行时环境重绘 Webview；getWelcomeHtml(options) 接收登录态与环境参数并返回 HTML 字符串。
 * 影响范围：VS Code 首次安装欢迎页、手动打开 welcome 页入口、登录成功后返回 IDE 的欢迎页 CTA。
 * 潜在风险：重绘欢迎页会重置页面滚动位置；当前仅在登录态变化或欢迎页重新可见时触发，风险可控。
 */
const SSO_USER_STATE_KEY = "easy-prompt.ssoUser";
/**
 * 2026-04-15 修复 — Welcome 已登录 CTA 改为打开个人主页
 * 变更类型：修复/交互
 * 功能描述：将 Welcome 页面登录成功后的主按钮从固定生产首页改为打开当前运行环境的 Web-Hub 个人主页，避免与 VS Code 状态栏用户名点击语义不一致。
 * 设计思路：登录成功后的高频入口统一指向当前环境的 `/profile`，让用户在刚完成 SSO 后可直接验证 Web-Hub 已登录态与个人信息展示。
 * 参数与返回值：已登录 CTA 点击后通过 `vscode.env.openExternal(...)` 打开外部浏览器，无同步返回值。
 * 影响范围：VS Code Welcome Webview 已登录 CTA、SSO 完成后的再次访问体验。
 * 潜在风险：若用户系统默认浏览器与 OAuth 登录完成时使用的浏览器配置文件不同，打开个人主页时仍可能需要重新识别登录态。
 */
const _welcomePanels = new Set();

/**
 * 检查是否需要显示 Welcome 页面（首次安装/大版本升级时触发）
 */
function checkAndShowWelcome(context) {
  const welcomed = context.globalState.get(WELCOME_STATE_KEY, false);
  if (!welcomed) {
    showWelcomePage(context);
    context.globalState.update(WELCOME_STATE_KEY, true);
  }
}

function getWelcomeLoginState(context) {
  const ssoUser = context.globalState.get(SSO_USER_STATE_KEY);
  const accountName =
    ssoUser?.displayName || ssoUser?.username || ssoUser?.email || "";

  return {
    isLoggedIn: Boolean(ssoUser),
    accountName,
  };
}

function renderWelcomePanel(panel, context) {
  panel.webview.html = getWelcomeHtml({
    ...getWelcomeLoginState(context),
    runtimeEnv: getVscodeRuntimeEnv(context),
  });
}

function refreshWelcomePanels(context) {
  for (const panel of Array.from(_welcomePanels)) {
    renderWelcomePanel(panel, context);
  }
}

/**
 * 显示 Welcome 引导页
 */
function showWelcomePage(context) {
  const panel = vscode.window.createWebviewPanel(
    "easyPromptWelcome",
    "Welcome to Easy Prompt",
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: false },
  );

  _welcomePanels.add(panel);
  renderWelcomePanel(panel, context);

  panel.onDidDispose(
    () => {
      _welcomePanels.delete(panel);
    },
    undefined,
    context.subscriptions,
  );

  panel.onDidChangeViewState(
    (event) => {
      if (event.webviewPanel.visible) {
        renderWelcomePanel(event.webviewPanel, context);
      }
    },
    undefined,
    context.subscriptions,
  );

  // 接收 Webview 消息
  panel.webview.onDidReceiveMessage(
    (msg) => {
      switch (msg.command) {
        case "openSettings":
          vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "easyPrompt",
          );
          break;
        case "configureApi":
          vscode.commands.executeCommand("easy-prompt.configureApi");
          break;
        case "showScenes":
          vscode.commands.executeCommand("easy-prompt.showScenes");
          break;
        case "tryEnhance":
          vscode.commands.executeCommand("easy-prompt.enhanceInput");
          break;
        case "selectScene":
          vscode.commands.executeCommand("easy-prompt.enhanceWithScene");
          break;
        case "loginZhiz":
          vscode.commands.executeCommand("easy-prompt.ssoLogin");
          break;
        case "openZhizProfile":
          vscode.env.openExternal(
            vscode.Uri.parse(getVscodeRuntimeEnv(context).webHubProfileUrl),
          );
          break;
      }
    },
    undefined,
    context.subscriptions,
  );
}

function getWelcomeHtml({
  isLoggedIn = false,
  accountName = "",
  runtimeEnv = {},
} = {}) {
  // 构建场景分类
  const categories = {
    "🚀 需求 & 规划": ["optimize", "split-task", "techstack", "api-design"],
    "💻 编码 & 开发": [
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
      "algo",
    ],
    "🔍 调试 & 质量": [
      "review",
      "test",
      "debug",
      "error",
      "security",
      "comment",
    ],
    "📝 文档 & 协作": [
      "doc",
      "changelog",
      "commit",
      "proposal",
      "present",
      "translate",
      "mock",
    ],
    "🛠️ 运维 & 环境": ["devops", "env", "script", "deps", "git", "incident"],
    "💡 学习 & 纠偏": ["explain", "followup"],
    "✍️ 内容创作": [
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
    "📋 产品管理": [
      "prd",
      "user-story",
      "competitor",
      "data-analysis",
      "meeting-notes",
      "acceptance",
    ],
    "📣 市场运营": [
      "ad-copy",
      "brand-story",
      "email-marketing",
      "event-plan",
      "growth-hack",
    ],
    "🎨 设计体验": ["design-brief", "ux-review", "design-spec", "copy-ux"],
    "📊 数据分析": ["data-report", "ab-test", "metric-define", "data-viz"],
    "👥 HR 人事": [
      "jd-write",
      "interview-guide",
      "performance-review",
      "onboarding-plan",
    ],
    "💬 客户服务": ["faq-write", "response-template", "feedback-analysis"],
    "🏢 创业管理": [
      "business-plan",
      "pitch-deck",
      "okr",
      "swot",
      "risk-assess",
    ],
    "🎓 学习教育": ["study-plan", "summary", "essay", "quiz-gen"],
  };

  const webAppBaseUrl = runtimeEnv.webAppBaseUrl || PRODUCTION_WEB_APP_BASE_URL;
  const webHubBaseUrl = runtimeEnv.webHubBaseUrl || PRODUCTION_WEB_HUB_BASE_URL;

  function _esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const safeAccountName = _esc(accountName || "PromptHub 账号");
  const loginButtonLabel = isLoggedIn
    ? `当前登录用户：${safeAccountName}`
    : "登录 PromptHub";
  const loginButtonCommand = isLoggedIn ? "openZhizProfile" : "loginZhiz";
  const loginHint = isLoggedIn
    ? `当前已登录：<strong>${safeAccountName}</strong>。点击下方按钮可直接打开当前环境个人主页。`
    : "想直接用账号体系登录？点击下方“登录 PromptHub”即可快速进入登录流程。";

  const sceneSections = Object.entries(categories)
    .map(([cat, ids]) => {
      const cards = ids
        .map((id) => {
          const s = SCENES[id];
          if (!s) return "";
          const pp = (s.painPoint || "").split("—")[0].trim();
          return `<div class="scene-card" data-id="${_esc(id)}">
                <div class="scene-name">${_esc(s.name)}</div>
                <div class="scene-tag">${_esc(id)}</div>
                <div class="scene-pain">${_esc(pp)}</div>
            </div>`;
        })
        .join("");
      return `<div class="category">
            <h3>${_esc(cat)}</h3>
            <div class="scene-grid">${cards}</div>
        </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to Easy Prompt</title>
<style>
:root {
    --bg: var(--vscode-editor-background, #1e1e1e);
    --card: var(--vscode-sideBar-background, #252526);
    --card-hover: var(--vscode-list-hoverBackground, #2d2d30);
    --border: var(--vscode-input-border, #3e3e42);
    --text: var(--vscode-foreground, #cccccc);
    --text-dim: var(--vscode-descriptionForeground, #858585);
    --accent: var(--vscode-textLink-foreground, #0078d4);
    --accent-light: var(--vscode-textLink-activeForeground, #1a8cff);
    --success: var(--vscode-terminal-ansiGreen, #4ec9b0);
    --warn: var(--vscode-editorWarning-foreground, #dcdcaa);
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    padding: 0;
}
.container {
    max-width: 900px;
    margin: 0 auto;
    padding: 40px 32px 60px;
}

/* Hero */
.hero {
    text-align: center;
    padding: 48px 0 40px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 40px;
}
.hero h1 {
    font-size: 32px;
    font-weight: 600;
    color: #fff;
    margin-bottom: 12px;
    letter-spacing: -0.5px;
}
.hero h1 span { color: var(--accent); }
.hero p {
    font-size: 16px;
    color: var(--text-dim);
    max-width: 600px;
    margin: 0 auto;
}
.version-badge {
    display: inline-block;
    background: var(--accent);
    color: #fff;
    font-size: 12px;
    padding: 2px 10px;
    border-radius: 12px;
    margin-bottom: 16px;
    font-weight: 500;
}

/* 快速开始 */
.section { margin-bottom: 40px; }
.section h2 {
    font-size: 20px;
    font-weight: 600;
    color: #fff;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
}

/* Step Cards */
.steps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
}
.step {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px;
    transition: border-color 0.2s, transform 0.15s;
}
.step:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
}
.step-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
}
.step h4 {
    color: #fff;
    font-size: 15px;
    margin-bottom: 6px;
}
.step p { font-size: 13px; color: var(--text-dim); }

/* 快捷键 */
.shortcut-table {
    width: 100%;
    border-collapse: collapse;
}
.shortcut-table td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    font-size: 14px;
}
.shortcut-table tr:last-child td { border-bottom: none; }
.shortcut-table tr:hover { background: var(--card); }
kbd {
    background: #3c3c3c;
    border: 1px solid #555;
    border-radius: 4px;
    padding: 2px 8px;
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 12px;
    color: #fff;
    white-space: nowrap;
}
.shortcut-desc { color: var(--text-dim); font-size: 13px; }

/* Before/After */
.demo-box {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 16px;
}
.demo-header {
    display: flex;
    gap: 0;
}
.demo-tab {
    flex: 1;
    text-align: center;
    padding: 10px;
    font-size: 13px;
    font-weight: 500;
}
.demo-tab.before { background: #3a2020; color: #f48771; }
.demo-tab.after { background: #1e3a1e; color: var(--success); }
.demo-content {
    display: flex;
}
.demo-col {
    flex: 1;
    padding: 16px;
    font-size: 13px;
    line-height: 1.7;
}
.demo-col.before {
    border-right: 1px solid var(--border);
    color: var(--text-dim);
}
.demo-col.after { color: var(--success); }

/* 场景 */
.category h3 {
    font-size: 15px;
    color: var(--warn);
    margin-bottom: 12px;
    font-weight: 500;
}
.scene-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
    margin-bottom: 24px;
}
.scene-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 12px;
    cursor: pointer;
    transition: border-color 0.2s, transform 0.15s;
}
.scene-card:hover {
    border-color: var(--accent);
    transform: translateY(-1px);
}
.scene-name { font-size: 14px; color: #fff; font-weight: 500; }
.scene-tag {
    font-size: 11px;
    color: var(--accent-light);
    font-family: monospace;
    margin: 4px 0;
}
.scene-pain {
    font-size: 12px;
    color: var(--text-dim);
    line-height: 1.4;
}

/* Buttons */
.btn-group {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 16px;
}
.btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: background 0.2s, transform 0.1s;
}
.btn:hover { transform: translateY(-1px); }
.btn:active { transform: translateY(0); }
.btn-primary {
    background: var(--accent);
    color: #fff;
}
.btn-primary:hover { background: var(--accent-light); }
.btn-secondary {
    background: var(--card);
    color: var(--text);
    border: 1px solid var(--border);
}
.btn-secondary:hover {
    background: var(--card-hover);
    border-color: var(--accent);
}

.login-hint {
    margin-top: 12px;
    font-size: 13px;
    color: var(--text-dim);
}

.login-hint strong {
    color: var(--text);
}

/* Tips */
.tip-box {
    background: #1a2a3a;
    border-left: 3px solid var(--accent);
    border-radius: 0 6px 6px 0;
    padding: 14px 18px;
    font-size: 13px;
    color: var(--text);
}

/* Footer */
.footer {
    text-align: center;
    padding-top: 32px;
    border-top: 1px solid var(--border);
    color: var(--text-dim);
    font-size: 13px;
}
.footer a { color: var(--accent-light); text-decoration: none; }
.footer a:hover { text-decoration: underline; }
</style>
</head>
<body>
<div class="container">
    <!-- Hero -->
    <div class="hero">
        <div class="version-badge">v5.3.8</div>
        <h1>Welcome to <span>Easy Prompt</span></h1>
        <p>AI 驱动的智能 Prompt 工程工具包 — 写一句大白话，生成专业级 Prompt，97 个场景 + 10 大画像覆盖你的全部开发与创作痛点</p>
    </div>

    <!-- Quick Start -->
    <div class="section">
        <h2>⚡ 30 秒快速开始</h2>
        <div class="steps">
            <div class="step">
                <div class="step-num">1</div>
                <h4>开箱即用</h4>
                <p>内置 AI 服务，无需配置即可使用。也可以在设置中填入自己的 API Key（支持 OpenAI/Gemini/DeepSeek 等）</p>
            </div>
            <div class="step">
                <div class="step-num">2</div>
                <h4>写下你的想法</h4>
                <p>在编辑器里随便写一句话，可以很简单，甚至很混乱 — 没关系！</p>
            </div>
            <div class="step">
                <div class="step-num">3</div>
                <h4>按下快捷键</h4>
                <p>选中文本，按 <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>P</kbd>，AI 自动识别意图并生成专业 Prompt</p>
            </div>
        </div>
        <div class="btn-group">
            <button class="btn btn-primary" onclick="send('tryEnhance')">🚀 立即体验</button>
            <button class="btn btn-secondary" onclick="send('configureApi')">⚙️ 自定义 API Key</button>
            <button class="btn btn-secondary" onclick="send('${loginButtonCommand}')">${loginButtonLabel}</button>
        </div>
        <p class="login-hint">${loginHint}</p>
    </div>

    <!-- Shortcuts -->
    <div class="section">
        <h2>⌨️ 快捷键</h2>
        <table class="shortcut-table">
            <tr>
                <td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>I</kbd></td>
                <td><strong>智能增强</strong><br><span class="shortcut-desc">自动判断增强选中/文件/剪贴板内容，多来源时弹窗选择</span></td>
            </tr>
            <tr>
                <td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>P</kbd></td>
                <td><strong>增强选中</strong><br><span class="shortcut-desc">选中文本 → AI 自动识别意图 → 原地替换为专业 Prompt</span></td>
            </tr>
            <tr>
                <td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>O</kbd></td>
                <td><strong>快速输入</strong><br><span class="shortcut-desc">弹出输入框 → 输入描述 → 新标签页显示增强结果</span></td>
            </tr>
            <tr>
                <td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>L</kbd></td>
                <td><strong>浏览场景</strong><br><span class="shortcut-desc">查看 97 个场景详情和 System Prompt</span></td>
            </tr>
            <tr>
                <td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>M</kbd></td>
                <td><strong>指定场景</strong><br><span class="shortcut-desc">手动选择场景 → 精准定向增强（跳过 AI 意图识别）</span></td>
            </tr>
            <tr>
                <td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>H</kbd></td>
                <td><strong>使用教程</strong><br><span class="shortcut-desc">随时打开本引导页 · 也可通过状态栏 ✨ 图标访问</span></td>
            </tr>
        </table>
    </div>

    <!-- Before/After Demo -->
    <div class="section">
        <h2>✨ 看看效果</h2>
        <div class="demo-box">
            <div class="demo-header">
                <div class="demo-tab before">❌ 你随手写的</div>
                <div class="demo-tab after">✅ Easy Prompt 生成的</div>
            </div>
            <div class="demo-content">
                <div class="demo-col before">帮我做个登录页面，要好看点，能记住密码，对了还要那个第三方登录</div>
                <div class="demo-col after">自动扩写为包含 Role/Task/Context/Output/Criteria 的结构化 Prompt，补全验证规则、安全要求、技术栈约束等 15+ 个隐含需求</div>
            </div>
        </div>
        <div class="demo-box">
            <div class="demo-header">
                <div class="demo-tab before">❌ 模糊描述</div>
                <div class="demo-tab after">✅ 专业排查方案</div>
            </div>
            <div class="demo-content">
                <div class="demo-col before">登录按钮点了没反应，不知道怎么回事</div>
                <div class="demo-col after">精确描述现象 → 推断复现步骤 → 按概率列出 5 个方向 → 每个附排查命令和修复代码</div>
            </div>
        </div>
        <div class="tip-box">
            <strong>💡 提示：</strong>你甚至可以输入复合问题，如"审查代码并优化性能再写文档"，AI 会自动识别多个意图，合并生成结构化 Prompt。
        </div>
    </div>

    <!-- Scenes -->
    <div class="section">
        <h2>🎯 97 个专业场景</h2>
        <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px;">点击任意场景卡片可查看详情 · 使用 <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>M</kbd> 指定场景增强 · 场景按使用频率 🔥 智能排序</p>
        ${sceneSections}
    </div>

    <!-- CTA -->
    <div class="section" style="text-align:center;">
        <h2 style="justify-content:center;">🎉 准备好了吗？</h2>
        <p style="color:var(--text-dim);margin-bottom:20px;">开箱即用，随便写一句话试试看</p>
        <div class="btn-group" style="justify-content:center;">
            <button class="btn btn-primary" onclick="send('tryEnhance')">🚀 立即体验</button>
            <button class="btn btn-secondary" onclick="send('configureApi')">⚙️ 自定义 API Key</button>
            <button class="btn btn-secondary" onclick="send('selectScene')">🎯 指定场景增强</button>
        </div>
    </div>

    <!-- Footer -->
    <div class="footer">
        <p>Easy Prompt v5.3.8 · Made with ❤️ · <a href="https://github.com/FlippySun/Easy-Prompt">GitHub</a> · <a href="${_esc(webAppBaseUrl)}">Web 在线版</a> · <a href="${_esc(webHubBaseUrl)}">PromptHub 精选库</a></p>
        <p style="margin-top:8px;">💡 状态栏右侧 ✨ 图标可随时打开快捷菜单</p>
    </div>
</div>

<script>
const vscode = acquireVsCodeApi();
function send(cmd) { vscode.postMessage({ command: cmd }); }
document.querySelectorAll('.scene-card').forEach(card => {
    card.addEventListener('click', () => send('showScenes'));
});
</script>
</body>
</html>`;
}

module.exports = { checkAndShowWelcome, showWelcomePage, refreshWelcomePanels };
