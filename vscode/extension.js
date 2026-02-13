const vscode = require('vscode');
const path = require('path');
const { smartRoute, SCENES, SCENE_NAMES } = require('../core');

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
 * 命令 1：增强选中文本（Ctrl+Alt+P）
 */
async function enhanceSelected() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('请先打开一个编辑器');
        return;
    }

    const selection = editor.selection;
    const text = editor.document.getText(selection);
    if (!text.trim()) {
        vscode.window.showWarningMessage('请先选中要优化的文本');
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
            const result = await smartRoute(config, text, (stage, detail) => {
                progress.report({ message: detail });
            });

            // 替换选中文本
            await editor.edit(editBuilder => {
                editBuilder.replace(selection, result.result);
            });

            const label = result.composite
                ? `复合：${result.scenes.map(s => SCENE_NAMES[s] || s).join(' + ')}`
                : SCENE_NAMES[result.scenes[0]] || result.scenes[0];
            vscode.window.showInformationMessage(`✅ Prompt 增强完成 [${label}]`);
        } catch (err) {
            vscode.window.showErrorMessage(`生成失败: ${err.message}`);
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
    }, async (progress) => {
        try {
            const result = await smartRoute(config, input, (stage, detail) => {
                progress.report({ message: detail });
            });

            // 在新标签页显示结果
            const doc = await vscode.workspace.openTextDocument({
                content: result.result,
                language: 'markdown'
            });
            await vscode.window.showTextDocument(doc, { preview: false });

            const label = result.composite
                ? `复合：${result.scenes.map(s => SCENE_NAMES[s] || s).join(' + ')}`
                : SCENE_NAMES[result.scenes[0]] || result.scenes[0];
            vscode.window.showInformationMessage(`✅ Prompt 增强完成 [${label}]`);
        } catch (err) {
            vscode.window.showErrorMessage(`生成失败: ${err.message}`);
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
        detail: scene.description,
        sceneId: id
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: '选择一个场景查看详情，或按 Esc 取消',
        matchOnDescription: true,
        matchOnDetail: true
    });

    if (selected) {
        const scene = SCENES[selected.sceneId];
        const doc = await vscode.workspace.openTextDocument({
            content: `# ${scene.name} (${selected.sceneId})\n\n> ${scene.description}\n\n## System Prompt\n\n\`\`\`\n${scene.prompt}\n\`\`\`\n\n## 关键词\n\n${scene.keywords.join(', ')}`,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc, { preview: true });
    }
}

function activate(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand('easy-prompt.enhanceSelected', enhanceSelected),
        vscode.commands.registerCommand('easy-prompt.enhanceInput', enhanceInput),
        vscode.commands.registerCommand('easy-prompt.showScenes', showScenes)
    );

    // 检查是否配置了 API Key
    const cfg = vscode.workspace.getConfiguration('easyPrompt');
    if (!cfg.get('apiKey')) {
        vscode.window.showInformationMessage(
            'Easy Prompt: 请配置 API Key 以启用功能',
            '打开设置'
        ).then(action => {
            if (action === '打开设置') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'easyPrompt');
            }
        });
    }
}

function deactivate() {}

module.exports = { activate, deactivate };
