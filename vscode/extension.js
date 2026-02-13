const vscode = require('vscode');
const path = require('path');
const { smartRoute, SCENES, SCENE_NAMES } = require('../core');
const { checkAndShowWelcome, showWelcomePage } = require('./welcomeView');

// 从 VSCode Settings 读取配置
function getConfig() {
    const cfg = vscode.workspace.getConfiguration('easyPrompt');
    const apiKey = cfg.get('apiKey', '');
    const baseUrl = cfg.get('apiBaseUrl', 'https://api.openai.com/v1');
    const model = cfg.get('model', 'gpt-4o');

    if (!apiKey) {
        throw new Error('请先配置 API Key：设置 → Easy Prompt → API Key');
    }

    return { baseUrl, apiKey, model };
}

/**
 * 使用 smartRoute 增强文本（公共逻辑）
 */
async function runSmartRoute(config, text, progress) {
    const startTime = Date.now();
    progress.report({ message: '🔍 正在识别意图...' });

    const result = await smartRoute(config, text, (stage, detail) => {
        if (stage === 'routing') {
            progress.report({ message: '🔍 正在识别意图...' });
        } else if (stage === 'generating') {
            progress.report({ message: `✍️ ${detail}` });
        }
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const label = result.composite
        ? `复合：${result.scenes.map(s => SCENE_NAMES[s] || s).join(' + ')}`
        : SCENE_NAMES[result.scenes[0]] || result.scenes[0];

    return { ...result, label, elapsed };
}

/**
 * 使用指定场景直接生成（跳过路由）
 */
async function runWithScene(config, text, sceneId, progress) {
    const { buildGenerationPrompt } = require('../core');
    const { callGenerationApi } = require('../core');

    const startTime = Date.now();
    const sceneName = SCENE_NAMES[sceneId] || sceneId;
    progress.report({ message: `✍️ 使用「${sceneName}」场景生成 Prompt...` });

    const routerResult = { scenes: [sceneId], composite: false };
    const { prompt: genPrompt } = buildGenerationPrompt(routerResult);
    const result = await callGenerationApi(config, genPrompt, text, false);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return {
        result,
        scenes: [sceneId],
        composite: false,
        label: sceneName,
        elapsed
    };
}

/**
 * 命令 1：增强选中文本（Ctrl+Alt+P）
 */
async function enhanceSelected() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('$(warning) 请先打开一个编辑器');
        return;
    }

    const selection = editor.selection;
    const text = editor.document.getText(selection);
    if (!text.trim()) {
        vscode.window.showWarningMessage('$(selection) 请先选中要优化的文本');
        return;
    }

    let config;
    try {
        config = getConfig();
    } catch (e) {
        vscode.window.showErrorMessage(e.message);
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Easy Prompt",
        cancellable: true
    }, async (progress, token) => {
        try {
            const res = await runSmartRoute(config, text, progress);

            if (token.isCancellationRequested) return;

            await editor.edit(editBuilder => {
                editBuilder.replace(selection, res.result);
            });

            vscode.window.showInformationMessage(
                `✅ 增强完成 [${res.label}] · ${res.elapsed}s`,
                '复制结果'
            ).then(action => {
                if (action === '复制结果') {
                    vscode.env.clipboard.writeText(res.result);
                    vscode.window.showInformationMessage('已复制到剪贴板');
                }
            });
        } catch (err) {
            if (!token.isCancellationRequested) {
                vscode.window.showErrorMessage(`❌ 生成失败: ${err.message}`, '重试', '检查设置').then(action => {
                    if (action === '重试') enhanceSelected();
                    else if (action === '检查设置') vscode.commands.executeCommand('workbench.action.openSettings', 'easyPrompt');
                });
            }
        }
    });
}

/**
 * 命令 2：快速输入增强（Ctrl+Alt+O）
 */
async function enhanceInput() {
    const input = await vscode.window.showInputBox({
        prompt: '输入要优化的 Prompt / 需求描述',
        placeHolder: '例如：帮我写个登录页面、优化这段代码、分析性能问题...',
        ignoreFocusOut: true
    });

    if (!input?.trim()) return;

    let config;
    try {
        config = getConfig();
    } catch (e) {
        vscode.window.showErrorMessage(e.message);
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Easy Prompt",
        cancellable: true
    }, async (progress, token) => {
        try {
            const res = await runSmartRoute(config, input, progress);

            if (token.isCancellationRequested) return;

            const doc = await vscode.workspace.openTextDocument({
                content: res.result,
                language: 'markdown'
            });
            await vscode.window.showTextDocument(doc, { preview: false });

            vscode.window.showInformationMessage(
                `✅ 增强完成 [${res.label}] · ${res.elapsed}s`,
                '复制结果'
            ).then(action => {
                if (action === '复制结果') {
                    vscode.env.clipboard.writeText(res.result);
                    vscode.window.showInformationMessage('已复制到剪贴板');
                }
            });
        } catch (err) {
            if (!token.isCancellationRequested) {
                vscode.window.showErrorMessage(`❌ 生成失败: ${err.message}`, '重试', '检查设置').then(action => {
                    if (action === '重试') enhanceInput();
                    else if (action === '检查设置') vscode.commands.executeCommand('workbench.action.openSettings', 'easyPrompt');
                });
            }
        }
    });
}

/**
 * 命令 3：浏览场景列表（Ctrl+Alt+L）
 */
async function showScenes() {
    const items = Object.entries(SCENES).map(([id, scene]) => ({
        label: `$(symbol-method) ${scene.name}`,
        description: id,
        detail: `${scene.description}${scene.painPoint ? ' · 💡 ' + scene.painPoint.split('—')[0].trim() : ''}`,
        sceneId: id
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: '选择场景查看详情 · 按 Esc 取消',
        matchOnDescription: true,
        matchOnDetail: true
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
        content += `## 🔑 关键词\n\n${scene.keywords.join(', ')}\n\n`;
        content += `## 📋 System Prompt\n\n\`\`\`\n${scene.prompt}\n\`\`\``;

        const doc = await vscode.workspace.openTextDocument({ content, language: 'markdown' });
        await vscode.window.showTextDocument(doc, { preview: true });
    }
}

/**
 * 命令 4：指定场景增强（Ctrl+Alt+M）
 * 让用户手动选择场景，跳过 AI 意图识别，精准定向增强
 */
async function enhanceWithScene() {
    // Step 1: 选择场景
    const items = Object.entries(SCENES).map(([id, scene]) => ({
        label: `$(symbol-method) ${scene.name}`,
        description: id,
        detail: scene.painPoint ? scene.painPoint.split('—')[0].trim() : scene.description,
        sceneId: id
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: '🎯 选择一个场景来定向增强 Prompt',
        matchOnDescription: true,
        matchOnDetail: true
    });

    if (!selected) return;

    // Step 2: 获取输入文本（优先用选中文本，否则弹输入框）
    const editor = vscode.window.activeTextEditor;
    let text = '';

    if (editor && !editor.selection.isEmpty) {
        text = editor.document.getText(editor.selection);
    }

    if (!text.trim()) {
        const scene = SCENES[selected.sceneId];
        text = await vscode.window.showInputBox({
            prompt: `使用「${scene.name}」场景增强 — 输入你的描述`,
            placeHolder: scene.example ? `例如：${scene.example.before}` : '输入要增强的内容...',
            ignoreFocusOut: true
        }) || '';
    }

    if (!text.trim()) return;

    let config;
    try {
        config = getConfig();
    } catch (e) {
        vscode.window.showErrorMessage(e.message);
        return;
    }

    // Step 3: 直接使用指定场景生成
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Easy Prompt",
        cancellable: true
    }, async (progress, token) => {
        try {
            const res = await runWithScene(config, text, selected.sceneId, progress);

            if (token.isCancellationRequested) return;

            // 如果有选中文本 → 替换；否则 → 新标签页
            if (editor && !editor.selection.isEmpty) {
                await editor.edit(editBuilder => {
                    editBuilder.replace(editor.selection, res.result);
                });
            } else {
                const doc = await vscode.workspace.openTextDocument({
                    content: res.result,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc, { preview: false });
            }

            vscode.window.showInformationMessage(
                `✅ 定向增强完成 [${res.label}] · ${res.elapsed}s`,
                '复制结果'
            ).then(action => {
                if (action === '复制结果') {
                    vscode.env.clipboard.writeText(res.result);
                    vscode.window.showInformationMessage('已复制到剪贴板');
                }
            });
        } catch (err) {
            if (!token.isCancellationRequested) {
                vscode.window.showErrorMessage(`❌ 生成失败: ${err.message}`, '重试', '检查设置').then(action => {
                    if (action === '重试') enhanceWithScene();
                    else if (action === '检查设置') vscode.commands.executeCommand('workbench.action.openSettings', 'easyPrompt');
                });
            }
        }
    });
}

/**
 * 命令 5：显示 Welcome 页面
 */
function showWelcome(context) {
    return () => showWelcomePage(context);
}

function activate(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand('easy-prompt.enhanceSelected', enhanceSelected),
        vscode.commands.registerCommand('easy-prompt.enhanceInput', enhanceInput),
        vscode.commands.registerCommand('easy-prompt.showScenes', showScenes),
        vscode.commands.registerCommand('easy-prompt.enhanceWithScene', enhanceWithScene),
        vscode.commands.registerCommand('easy-prompt.showWelcome', showWelcome(context))
    );

    // 首次安装检测 → 弹出 Welcome 引导页
    checkAndShowWelcome(context);

    // 如果未配置 API Key，温馨提示
    const cfg = vscode.workspace.getConfiguration('easyPrompt');
    if (!cfg.get('apiKey')) {
        vscode.window.showInformationMessage(
            '🚀 Easy Prompt: 配置 API Key 即可开始使用',
            '配置 API Key',
            '查看教程'
        ).then(action => {
            if (action === '配置 API Key') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'easyPrompt');
            } else if (action === '查看教程') {
                vscode.commands.executeCommand('easy-prompt.showWelcome');
            }
        });
    }
}

function deactivate() {}

module.exports = { activate, deactivate };
