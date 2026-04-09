/**
 * aiLogger 单元测试
 * 2026-04-08 新增 — P2.01
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted 确保 mock fn 在 vi.mock factory 执行时已初始化
const { mockInfo, mockWarn, mockError } = vi.hoisted(() => ({
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
  mockError: vi.fn(),
}));

vi.mock('../../config/logRotation', () => ({
  createChannelLogger: () => ({
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
  }),
}));

// 在 mock 之后导入被测模块
import { logAiRequest, type AiLogEntry } from '../aiLogger';

function baseEntry(overrides?: Partial<AiLogEntry>): AiLogEntry {
  return {
    requestId: 'req-001',
    userId: 'user-001',
    clientType: 'web',
    scenes: ['optimize'],
    model: 'gpt-5.4',
    provider: 'vpsairobot',
    inputTokens: 100,
    outputTokens: 200,
    totalTokens: 300,
    latencyMs: 1200,
    status: 'success',
    ...overrides,
  };
}

describe('logAiRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log info for successful fast requests', () => {
    logAiRequest(baseEntry());
    expect(mockInfo).toHaveBeenCalledTimes(1);
    expect(mockWarn).not.toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();

    const [payload, msg] = mockInfo.mock.calls[0];
    expect(payload.requestId).toBe('req-001');
    expect(payload.model).toBe('gpt-5.4');
    expect(payload.status).toBe('success');
    expect(msg).toContain('completed');
  });

  it('should log warn for slow requests (>5s)', () => {
    logAiRequest(baseEntry({ latencyMs: 6000 }));
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockInfo).not.toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();

    const [, msg] = mockWarn.mock.calls[0];
    expect(msg).toContain('slow');
    expect(msg).toContain('6000');
  });

  it('should log error for failed requests', () => {
    logAiRequest(
      baseEntry({
        status: 'error',
        errorCode: 'AI_PROVIDER_ERROR',
        errorMessage: 'Provider returned 500',
      }),
    );
    expect(mockError).toHaveBeenCalledTimes(1);
    expect(mockInfo).not.toHaveBeenCalled();

    const [payload, msg] = mockError.mock.calls[0];
    expect(payload.errorMessage).toBe('Provider returned 500');
    expect(msg).toContain('AI_PROVIDER_ERROR');
  });

  it('should log error for timeout requests', () => {
    logAiRequest(
      baseEntry({
        status: 'timeout',
        errorCode: 'AI_TIMEOUT',
      }),
    );
    expect(mockError).toHaveBeenCalledTimes(1);

    const [, msg] = mockError.mock.calls[0];
    expect(msg).toContain('AI_TIMEOUT');
  });

  it('should handle missing optional fields gracefully', () => {
    logAiRequest({
      clientType: 'browser',
      model: 'gpt-5.4',
      provider: 'vpsairobot',
      latencyMs: 800,
      status: 'success',
    });
    expect(mockInfo).toHaveBeenCalledTimes(1);

    const [payload] = mockInfo.mock.calls[0];
    expect(payload.userId).toBeNull();
    expect(payload.inputTokens).toBe(0);
    expect(payload.outputTokens).toBe(0);
  });
});
