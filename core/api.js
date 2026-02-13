/**
 * Easy Prompt — API 调用层
 * 平台无关的 HTTP 请求封装，使用 curl 避免 Cloudflare 拦截
 */

const { execFile } = require('child_process');

/**
 * 调用 OpenAI 兼容 API
 * @param {Object} config - {baseUrl, apiKey, model}
 * @param {string} systemPrompt - 系统 Prompt
 * @param {string} userMessage - 用户输入
 * @param {Object} [options] - {temperature, maxTokens, timeout}
 * @returns {Promise<string>} AI 返回的文本
 */
function callApi(config, systemPrompt, userMessage, options = {}) {
    const { baseUrl, apiKey, model } = config;
    const { temperature = 0.7, maxTokens = 4096, timeout = 60 } = options;

    const body = JSON.stringify({
        model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
        ],
        temperature,
        max_tokens: maxTokens
    });

    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

    return new Promise((resolve, reject) => {
        const args = [
            '-s', '-S',
            '--max-time', String(timeout),
            '-X', 'POST',
            url,
            '-H', 'Content-Type: application/json',
            '-H', `Authorization: Bearer ${apiKey}`,
            '-d', body
        ];

        execFile('curl', args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) {
                reject(new Error(`API 调用失败: ${err.message}`));
                return;
            }
            try {
                const resp = JSON.parse(stdout);
                if (resp.error) {
                    reject(new Error(`API 错误: ${resp.error.message || JSON.stringify(resp.error)}`));
                    return;
                }
                const content = resp.choices?.[0]?.message?.content;
                if (!content) {
                    reject(new Error(`API 返回为空: ${stdout.substring(0, 200)}`));
                    return;
                }
                resolve(content);
            } catch (e) {
                reject(new Error(`解析响应失败: ${e.message}\n原始响应: ${stdout.substring(0, 500)}`));
            }
        });
    });
}

/**
 * 两步路由：第一步意图识别（快速低温），第二步生成（正常温度）
 */
async function callRouterApi(config, systemPrompt, userMessage) {
    return callApi(config, systemPrompt, userMessage, {
        temperature: 0.1,
        maxTokens: 150,
        timeout: 30
    });
}

async function callGenerationApi(config, systemPrompt, userMessage, isComposite = false) {
    return callApi(config, systemPrompt, userMessage, {
        temperature: 0.7,
        maxTokens: isComposite ? 8192 : 4096,
        timeout: 120
    });
}

module.exports = { callApi, callRouterApi, callGenerationApi };
