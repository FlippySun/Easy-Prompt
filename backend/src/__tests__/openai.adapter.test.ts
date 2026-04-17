/**
 * OpenAI 适配器单元测试 — 全局 stream-first 同步聚合
 * 2026-04-16 新增
 * 变更类型：新增/修复/优化/测试
 * 功能描述：验证 openai.adapter 对所有 openai 同步调用直接采用 SSE 聚合文本，并在支持时透传 usage，避免每个增强阶段重复发起非流式探测请求。
 * 设计思路：
 *   1. Mock 全局 fetch，仅覆盖 stream-first 成功与流式无文本失败两类核心路径。
 *   2. 断言同步调用只发起一次上游请求，并携带 `stream: true` 与 `stream_options.include_usage`。
 *   3. 用最小 SSE 样例锁定 `delta.content` 聚合与 usage 透传行为，防止未来回归出重复请求。
 * 参数与返回值：本文件无外部参数；各测试断言 callAiProvider(options) 的统一 AdapterResponse 或错误码。
 * 影响范围：backend/src/services/adapters/openai.adapter.ts、/api/v1/ai/enhance、所有 openai 模式 provider。
 * 潜在风险：若未来上游 SSE 事件字段再次变化，需要同步调整样例；当前无已知风险。
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { callAiProvider, type AdapterCallOptions } from '../services/adapters/openai.adapter';

const fetchMock = vi.fn();

function createSseBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function mockSseResponse(chunks: string[], status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    body: createSseBody(chunks),
    text: vi.fn().mockResolvedValue(chunks.join('')),
  } as unknown as Response;
}

const baseOptions: AdapterCallOptions = {
  apiMode: 'openai',
  baseUrl: 'https://provider.example.com/v1',
  apiKey: 'sk-test',
  model: 'gpt-5.3-codex-spark',
  systemPrompt: 'Reply with exactly: OK',
  userMessage: 'ping',
  maxTokens: 32,
  timeoutMs: 15_000,
  extraHeaders: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('callAiProvider openai stream-first compatibility', () => {
  it('should aggregate SSE content in a single upstream request', async () => {
    fetchMock.mockResolvedValueOnce(
      mockSseResponse([
        'data: {"choices":[{"delta":{"role":"assistant"},"finish_reason":null}]}\n',
        'data: {"choices":[{"delta":{"content":"OK"},"finish_reason":null}]}\n',
        'data: {"choices":[{"delta":{"content":"!"},"finish_reason":null}]}\n',
        'data: {"usage":{"prompt_tokens":11,"completion_tokens":3,"total_tokens":14}}\n',
        'data: [DONE]\n',
      ]),
    );

    const result = await callAiProvider(baseOptions);
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const requestBody = requestInit?.body ? JSON.parse(String(requestInit.body)) : null;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestInit).toMatchObject({ method: 'POST' });
    expect(requestBody).toMatchObject({
      model: 'gpt-5.3-codex-spark',
      stream: true,
      stream_options: { include_usage: true },
    });
    expect(result).toMatchObject({
      content: 'OK!',
      promptTokens: 11,
      completionTokens: 3,
      totalTokens: 14,
    });
  });

  it('should keep AI_INVALID_RESPONSE when stream returns no text chunks', async () => {
    fetchMock.mockResolvedValueOnce(
      mockSseResponse([
        'data: {"choices":[{"delta":{"role":"assistant"},"finish_reason":null}]}\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n',
        'data: [DONE]\n',
      ]),
    );

    await expect(callAiProvider(baseOptions)).rejects.toMatchObject({
      code: 'AI_INVALID_RESPONSE',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
