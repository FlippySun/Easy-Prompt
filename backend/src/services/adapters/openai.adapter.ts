/**
 * OpenAI 兼容 API 适配器
 * 2026-04-07 新增 — P1.26
 * 设计思路：统一将多种 API 模式（openai / openai-responses / claude / gemini）
 *   适配为统一的 AdapterResponse 接口。各模式的请求/响应格式差异在此处抹平
 * 影响范围：ai-gateway.service.ts
 * 潜在风险：第三方 API 格式变更时需同步更新适配器
 */

import { createChildLogger } from '../../utils/logger';
import { AppError } from '../../utils/errors';
import type { AdapterResponse, StreamCallbacks } from '../../types/ai';

const log = createChildLogger('ai-adapter');

export interface AdapterCallOptions {
  apiMode: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  maxTokens: number;
  timeoutMs: number;
  extraHeaders: Record<string, string>;
}

/**
 * 统一 AI API 调用适配器
 * 根据 apiMode 选择对应的请求格式
 */
export async function callAiProvider(options: AdapterCallOptions): Promise<AdapterResponse> {
  const startTime = Date.now();
  // 2026-04-10 防御 — 去除 baseUrl 尾部斜杠，避免拼接出 //chat/completions
  options = { ...options, baseUrl: options.baseUrl.replace(/\/+$/, '') };

  try {
    switch (options.apiMode) {
      case 'openai':
        return await callOpenAI(options, startTime);
      case 'openai-responses':
        return await callOpenAIResponses(options, startTime);
      case 'claude':
        return await callClaude(options, startTime);
      case 'gemini':
        return await callGemini(options, startTime);
      default:
        throw new AppError('PROVIDER_CONFIG_ERROR', `Unsupported API mode: ${options.apiMode}`);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;

    const duration = Date.now() - startTime;
    log.error({ err, apiMode: options.apiMode, duration }, 'AI adapter call failed');

    if (err instanceof Error && err.name === 'AbortError') {
      throw new AppError('AI_TIMEOUT');
    }

    throw new AppError(
      'AI_PROVIDER_ERROR',
      err instanceof Error ? err.message : 'Unknown adapter error',
    );
  }
}

// ── OpenAI Chat Completions ──────────────────────────

async function callOpenAI(
  options: AdapterCallOptions,
  startTime: number,
): Promise<AdapterResponse> {
  const url = `${options.baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${options.apiKey}`,
    ...options.extraHeaders,
  };

  const body = JSON.stringify({
    model: options.model,
    messages: [
      { role: 'system', content: options.systemPrompt },
      { role: 'user', content: options.userMessage },
    ],
    max_tokens: options.maxTokens,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      log.error({ status: response.status, errorText }, 'OpenAI API error');
      throw new AppError('AI_PROVIDER_ERROR', `OpenAI API ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new AppError('AI_INVALID_RESPONSE', 'No content in OpenAI response');
    }

    return {
      content,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      totalTokens: data.usage?.total_tokens,
      durationMs: Date.now() - startTime,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ── OpenAI Responses API ────────────────────────────

async function callOpenAIResponses(
  options: AdapterCallOptions,
  startTime: number,
): Promise<AdapterResponse> {
  const url = `${options.baseUrl}/responses`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${options.apiKey}`,
    ...options.extraHeaders,
  };

  const body = JSON.stringify({
    model: options.model,
    instructions: options.systemPrompt,
    input: options.userMessage,
    max_output_tokens: options.maxTokens,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new AppError(
        'AI_PROVIDER_ERROR',
        `OpenAI Responses API ${response.status}: ${errorText}`,
      );
    }

    const data = (await response.json()) as {
      output?: Array<{ content?: Array<{ text?: string }> }>;
      usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
    };

    const content = data.output?.[0]?.content?.[0]?.text;
    if (!content) {
      throw new AppError('AI_INVALID_RESPONSE', 'No content in OpenAI Responses response');
    }

    return {
      content,
      promptTokens: data.usage?.input_tokens,
      completionTokens: data.usage?.output_tokens,
      totalTokens: data.usage?.total_tokens,
      durationMs: Date.now() - startTime,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ── Claude (Anthropic) ──────────────────────────────

async function callClaude(
  options: AdapterCallOptions,
  startTime: number,
): Promise<AdapterResponse> {
  const url = `${options.baseUrl}/messages`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': options.apiKey,
    'anthropic-version': '2023-06-01',
    ...options.extraHeaders,
  };

  const body = JSON.stringify({
    model: options.model,
    system: options.systemPrompt,
    messages: [{ role: 'user', content: options.userMessage }],
    max_tokens: options.maxTokens,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new AppError('AI_PROVIDER_ERROR', `Claude API ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const textBlock = data.content?.find((b) => b.type === 'text');
    if (!textBlock?.text) {
      throw new AppError('AI_INVALID_RESPONSE', 'No text content in Claude response');
    }

    return {
      content: textBlock.text,
      promptTokens: data.usage?.input_tokens,
      completionTokens: data.usage?.output_tokens,
      totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      durationMs: Date.now() - startTime,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ── Gemini (Google) ─────────────────────────────────

async function callGemini(
  options: AdapterCallOptions,
  startTime: number,
): Promise<AdapterResponse> {
  const url = `${options.baseUrl}/models/${options.model}:generateContent?key=${options.apiKey}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.extraHeaders,
  };

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: options.systemPrompt }] },
    contents: [{ parts: [{ text: options.userMessage }] }],
    generationConfig: { maxOutputTokens: options.maxTokens },
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new AppError('AI_PROVIDER_ERROR', `Gemini API ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new AppError('AI_INVALID_RESPONSE', 'No content in Gemini response');
    }

    return {
      content,
      promptTokens: data.usageMetadata?.promptTokenCount,
      completionTokens: data.usageMetadata?.candidatesTokenCount,
      totalTokens: data.usageMetadata?.totalTokenCount,
      durationMs: Date.now() - startTime,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ═══════════════════════════════════════════════════════════
// P6.02 SSE 流式适配器
// 2026-04-09 新增 — P6.02 SSE 流式增强
// 设计思路：
//   1. 仅支持 OpenAI / Claude 流式（这两种 SSE 格式最通用）
//   2. 发送 stream:true 请求，逐行解析 SSE data: 行
//   3. 通过 StreamCallbacks 回调向上层推送增量文本
//   4. 聚合完整文本后调用 onDone
// 参数：options — 与同步调用相同；callbacks — 流式回调
// 返回：void（通过回调传递数据）
// 影响范围：ai-gateway.service.ts 的 enhanceStream 方法
// 潜在风险：网络中断时需确保 onError 被调用
// ═══════════════════════════════════════════════════════════

/**
 * 流式 AI API 调用适配器
 * 当前支持 openai / claude 模式（SSE text/event-stream 格式）
 * Gemini / openai-responses 暂不支持流式，降级为同步调用
 */
export async function callAiProviderStream(
  options: AdapterCallOptions,
  callbacks: StreamCallbacks,
): Promise<void> {
  // 2026-04-10 防御 — 去除 baseUrl 尾部斜杠
  options = { ...options, baseUrl: options.baseUrl.replace(/\/+$/, '') };
  // 不支持流式的模式降级为同步调用
  if (options.apiMode === 'gemini' || options.apiMode === 'openai-responses') {
    log.info(
      { apiMode: options.apiMode },
      'Stream not supported for this API mode, falling back to sync',
    );
    try {
      const result = await callAiProvider(options);
      callbacks.onChunk(result.content);
      callbacks.onDone(result.content, {
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
      });
    } catch (err) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
    return;
  }

  switch (options.apiMode) {
    case 'openai':
      return streamOpenAI(options, callbacks);
    case 'claude':
      return streamClaude(options, callbacks);
    default:
      callbacks.onError(
        new AppError('PROVIDER_CONFIG_ERROR', `Stream not supported for: ${options.apiMode}`),
      );
  }
}

// ── OpenAI SSE 流式 ──────────────────────────────────────

async function streamOpenAI(
  options: AdapterCallOptions,
  callbacks: StreamCallbacks,
): Promise<void> {
  const url = `${options.baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${options.apiKey}`,
    ...options.extraHeaders,
  };

  const body = JSON.stringify({
    model: options.model,
    messages: [
      { role: 'system', content: options.systemPrompt },
      { role: 'user', content: options.userMessage },
    ],
    max_tokens: options.maxTokens,
    stream: true,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new AppError('AI_PROVIDER_ERROR', `OpenAI stream ${response.status}: ${errorText}`);
    }

    if (!response.body) {
      throw new AppError('AI_INVALID_RESPONSE', 'No response body for streaming');
    }

    // 逐行解析 SSE — 聚合完整文本
    let fullContent = '';
    let usage:
      | { promptTokens?: number; completionTokens?: number; totalTokens?: number }
      | undefined;

    await parseSSEStream(response.body, (eventData) => {
      if (eventData === '[DONE]') return;

      try {
        const parsed = JSON.parse(eventData) as {
          choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        };

        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          callbacks.onChunk(delta);
        }

        // OpenAI 在最后一个 chunk 可能附带 usage（需开启 stream_options）
        if (parsed.usage) {
          usage = {
            promptTokens: parsed.usage.prompt_tokens,
            completionTokens: parsed.usage.completion_tokens,
            totalTokens: parsed.usage.total_tokens,
          };
        }
      } catch {
        // 忽略无法解析的 SSE 行（心跳等）
      }
    });

    callbacks.onDone(fullContent, usage);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      callbacks.onError(new AppError('AI_TIMEOUT'));
    } else {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  } finally {
    clearTimeout(timeout);
  }
}

// ── Claude SSE 流式 ──────────────────────────────────────

async function streamClaude(
  options: AdapterCallOptions,
  callbacks: StreamCallbacks,
): Promise<void> {
  const url = `${options.baseUrl}/messages`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': options.apiKey,
    'anthropic-version': '2023-06-01',
    ...options.extraHeaders,
  };

  const body = JSON.stringify({
    model: options.model,
    system: options.systemPrompt,
    messages: [{ role: 'user', content: options.userMessage }],
    max_tokens: options.maxTokens,
    stream: true,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new AppError('AI_PROVIDER_ERROR', `Claude stream ${response.status}: ${errorText}`);
    }

    if (!response.body) {
      throw new AppError('AI_INVALID_RESPONSE', 'No response body for streaming');
    }

    // Claude SSE 事件格式：event: content_block_delta + data: {...}
    let fullContent = '';
    let usage:
      | { promptTokens?: number; completionTokens?: number; totalTokens?: number }
      | undefined;

    await parseSSEStream(response.body, (eventData) => {
      try {
        const parsed = JSON.parse(eventData) as {
          type?: string;
          delta?: { type?: string; text?: string };
          usage?: { input_tokens?: number; output_tokens?: number };
          message?: { usage?: { input_tokens?: number; output_tokens?: number } };
        };

        // content_block_delta 事件包含增量文本
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          fullContent += parsed.delta.text;
          callbacks.onChunk(parsed.delta.text);
        }

        // message_delta 事件可能包含 usage
        if (parsed.type === 'message_delta' && parsed.usage) {
          usage = {
            completionTokens: parsed.usage.output_tokens,
          };
        }

        // message_start 事件包含 input_tokens
        if (parsed.type === 'message_start' && parsed.message?.usage) {
          usage = {
            ...usage,
            promptTokens: parsed.message.usage.input_tokens,
          };
        }
      } catch {
        // 忽略无法解析的 SSE 行
      }
    });

    // 计算 totalTokens
    if (usage) {
      usage.totalTokens = (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0);
    }

    callbacks.onDone(fullContent, usage);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      callbacks.onError(new AppError('AI_TIMEOUT'));
    } else {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  } finally {
    clearTimeout(timeout);
  }
}

// ── SSE 流解析工具 ───────────────────────────────────────

/**
 * 通用 SSE ReadableStream 解析器
 * 逐行读取 data: 开头的 SSE 事件并回调
 * 2026-04-09 — P6.02：从 ReadableStream<Uint8Array> 逐行解码
 */
async function parseSSEStream(
  body: ReadableStream<Uint8Array>,
  onData: (data: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // 保留最后一个可能不完整的行
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          onData(trimmed.slice(6));
        }
      }
    }

    // 处理剩余 buffer
    if (buffer.trim().startsWith('data: ')) {
      onData(buffer.trim().slice(6));
    }
  } finally {
    reader.releaseLock();
  }
}
