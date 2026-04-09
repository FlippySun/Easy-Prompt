/**
 * AI Gateway 服务 — 统一 AI 增强入口
 * 2026-04-07 新增 — P1.28
 * 设计思路：编排 provider 选择 → 适配器调用 → 日志记录 的完整流程
 *   所有客户端的 AI 增强请求通过此服务中转
 * 影响范围：AI 路由、日志记录、成本分析
 * 潜在风险：provider 不可用时返回 503
 */

import { prisma } from '../lib/prisma';
import { getActiveProvider } from './provider.service';
import { callAiProvider, callAiProviderStream } from './adapters/openai.adapter';
import { AppError } from '../utils/errors';
import { createChildLogger } from '../utils/logger';
import { logAiRequest } from '../utils/aiLogger';
import { lookupGeo } from '../utils/geoip';
import type { EnhanceRequest, EnhanceResponse, StreamChunk } from '../types/ai';

const log = createChildLogger('ai-gateway');

export interface GatewayContext {
  /** 请求追踪 ID */
  requestId?: string;
  /** 用户 ID（可选） */
  userId?: string;
  /** 客户端类型 */
  clientType: string;
  /** 客户端版本 */
  clientVersion?: string;
  /** 客户端平台 */
  clientPlatform?: string;
  /** 语言偏好 */
  language?: string;
  /** IP 地址 */
  ipAddress?: string;
  /** User Agent */
  userAgent?: string;
  /** 指纹 */
  fingerprint?: string;
}

/**
 * 执行 AI 增强请求
 * 流程：获取 provider → 调用适配器 → 记录日志 → 返回结果
 */
export async function enhance(
  input: EnhanceRequest,
  context: GatewayContext,
): Promise<EnhanceResponse> {
  const startTime = Date.now();
  let provider;

  try {
    // 1. 获取激活的 provider
    provider = await getActiveProvider();

    // 2. 构建 system prompt（由客户端发送，或未来由 ai-router 生成）
    const systemPrompt =
      input.systemPrompt || 'You are a helpful AI assistant specializing in prompt enhancement.';
    const model = input.model || provider.defaultModel;

    // 3. 调用适配器
    const adapterResult = await callAiProvider({
      apiMode: provider.apiMode,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model,
      systemPrompt,
      userMessage: input.input,
      maxTokens: provider.maxTokens,
      timeoutMs: provider.timeoutMs,
      extraHeaders: (provider.extraHeaders as Record<string, string>) ?? {},
    });

    const duration = Date.now() - startTime;

    // 4. 异步记录日志（不阻塞响应）
    recordLog({
      context,
      input,
      provider,
      model,
      output: adapterResult.content,
      status: 'success',
      duration,
      adapterResult,
    }).catch((err) => log.error({ err }, 'Failed to record AI request log'));

    // 2026-04-08 新增 — P2.01 结构化 AI 日志（与 DB 日志并行输出）
    logAiRequest({
      requestId: context.requestId,
      userId: context.userId,
      clientType: context.clientType,
      scenes: input.sceneIds,
      model,
      provider: provider.slug,
      inputTokens: adapterResult.promptTokens,
      outputTokens: adapterResult.completionTokens,
      totalTokens: adapterResult.totalTokens,
      latencyMs: duration,
      status: 'success',
    });

    return {
      output: adapterResult.content,
      model,
      provider: provider.slug,
      usage: {
        promptTokens: adapterResult.promptTokens ?? 0,
        completionTokens: adapterResult.completionTokens ?? 0,
        totalTokens: adapterResult.totalTokens ?? 0,
      },
      durationMs: duration,
    };
  } catch (err) {
    const duration = Date.now() - startTime;

    // 记录失败日志
    const failStatus = err instanceof AppError && err.code === 'AI_TIMEOUT' ? 'timeout' : 'error';
    if (provider) {
      recordLog({
        context,
        input,
        provider,
        model: input.model || provider.defaultModel,
        output: null,
        status: failStatus,
        duration,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      }).catch((logErr) => log.error({ logErr }, 'Failed to record error log'));

      // 2026-04-08 新增 — P2.01 结构化 AI 错误日志
      logAiRequest({
        requestId: context.requestId,
        userId: context.userId,
        clientType: context.clientType,
        scenes: input.sceneIds,
        model: input.model || provider.defaultModel,
        provider: provider.slug,
        latencyMs: duration,
        status: failStatus,
        errorCode: err instanceof AppError ? err.code : 'UNKNOWN',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    throw err;
  }
}

// ── 日志记录 ──────────────────────────────────────────

interface LogParams {
  context: GatewayContext;
  input: EnhanceRequest;
  provider: { id: string; slug: string; apiMode: string };
  model: string;
  output: string | null;
  status: string;
  duration: number;
  adapterResult?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  errorMessage?: string;
}

// ═══════════════════════════════════════════════════════════
// P6.02 SSE 流式增强
// 2026-04-09 新增 — P6.02
// 设计思路：
//   与同步 enhance() 相同流程（provider 选择 → 适配器调用 → 日志记录）
//   区别在于通过 onEvent 回调推送 StreamChunk 事件
//   适配器内部解析 SSE，逐 chunk 回调到此方法，再转发给路由层
// 参数：input — 增强请求；context — 请求上下文；onEvent — SSE 事件回调
// 返回：Promise<void>（结果通过回调传递）
// 影响范围：ai.routes 的 /enhance/stream 端点
// 潜在风险：长连接超时需 Nginx 配合（proxy_read_timeout）
// ═══════════════════════════════════════════════════════════

/**
 * 执行流式 AI 增强请求
 * 通过 onEvent 回调逐步推送 StreamChunk 事件
 */
export async function enhanceStream(
  input: EnhanceRequest,
  context: GatewayContext,
  onEvent: (chunk: StreamChunk) => void,
): Promise<void> {
  const startTime = Date.now();
  let provider: Awaited<ReturnType<typeof getActiveProvider>> | undefined;

  try {
    provider = await getActiveProvider();
    const systemPrompt =
      input.systemPrompt || 'You are a helpful AI assistant specializing in prompt enhancement.';
    const model = input.model || provider.defaultModel;

    await callAiProviderStream(
      {
        apiMode: provider.apiMode,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model,
        systemPrompt,
        userMessage: input.input,
        maxTokens: provider.maxTokens,
        timeoutMs: provider.timeoutMs,
        extraHeaders: (provider.extraHeaders as Record<string, string>) ?? {},
      },
      {
        onChunk: (content) => {
          onEvent({ type: 'chunk', content });
        },
        onDone: (fullContent, usage) => {
          const duration = Date.now() - startTime;
          onEvent({
            type: 'done',
            fullContent,
            model,
            provider: provider!.slug,
            usage: {
              promptTokens: usage?.promptTokens ?? 0,
              completionTokens: usage?.completionTokens ?? 0,
              totalTokens: usage?.totalTokens ?? 0,
            },
            durationMs: duration,
          });

          // 异步记录日志（不阻塞 SSE 关闭）
          recordLog({
            context,
            input,
            provider: provider!,
            model,
            output: fullContent,
            status: 'success',
            duration,
            adapterResult: {
              promptTokens: usage?.promptTokens,
              completionTokens: usage?.completionTokens,
              totalTokens: usage?.totalTokens,
            },
          }).catch((err) => log.error({ err }, 'Failed to record stream AI request log'));

          logAiRequest({
            requestId: context.requestId,
            userId: context.userId,
            clientType: context.clientType,
            scenes: input.sceneIds,
            model,
            provider: provider!.slug,
            inputTokens: usage?.promptTokens,
            outputTokens: usage?.completionTokens,
            totalTokens: usage?.totalTokens,
            latencyMs: duration,
            status: 'success',
          });
        },
        onError: (error) => {
          const duration = Date.now() - startTime;
          onEvent({ type: 'error', error: error.message });

          if (provider) {
            const failStatus =
              error instanceof AppError && error.code === 'AI_TIMEOUT' ? 'timeout' : 'error';
            recordLog({
              context,
              input,
              provider,
              model,
              output: null,
              status: failStatus,
              duration,
              errorMessage: error.message,
            }).catch((logErr) => log.error({ logErr }, 'Failed to record stream error log'));

            logAiRequest({
              requestId: context.requestId,
              userId: context.userId,
              clientType: context.clientType,
              scenes: input.sceneIds,
              model,
              provider: provider.slug,
              latencyMs: duration,
              status: failStatus,
              errorCode: error instanceof AppError ? error.code : 'UNKNOWN',
              errorMessage: error.message,
            });
          }
        },
      },
    );
  } catch (err) {
    const duration = Date.now() - startTime;
    onEvent({
      type: 'error',
      error: err instanceof Error ? err.message : 'Unknown gateway error',
    });

    if (provider) {
      recordLog({
        context,
        input,
        provider,
        model: input.model || provider.defaultModel,
        output: null,
        status: 'error',
        duration,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      }).catch((logErr) => log.error({ logErr }, 'Failed to record stream gateway error log'));
    }
  }
}

// ── 日志记录 ──────────────────────────────────────────

async function recordLog(params: LogParams): Promise<void> {
  // 2026-04-08 P2.06: GeoIP 解析（纯内存查询，<1ms）
  const geo = params.context.ipAddress ? lookupGeo(params.context.ipAddress) : null;

  await prisma.aiRequestLog.create({
    data: {
      requestId: params.context.requestId,
      userId: params.context.userId || null,
      clientType: params.context.clientType,
      clientVersion: params.context.clientVersion,
      clientPlatform: params.context.clientPlatform,
      language: params.context.language,
      ipAddress: params.context.ipAddress,
      userAgent: params.context.userAgent,
      fingerprint: params.context.fingerprint,
      country: geo?.country ?? null,
      region: geo?.region ?? null,
      enhanceMode: params.input.enhanceMode,
      originalInput: params.input.input,
      systemPrompt: params.input.systemPrompt,
      aiOutput: params.output,
      sceneIds: params.input.sceneIds ?? [],
      isComposite: params.input.isComposite ?? false,
      providerId: params.provider.id,
      providerSlug: params.provider.slug,
      modelUsed: params.model,
      apiMode: params.provider.apiMode,
      durationMs: params.duration,
      promptTokens: params.adapterResult?.promptTokens,
      completionTokens: params.adapterResult?.completionTokens,
      totalTokens: params.adapterResult?.totalTokens,
      status: params.status,
      errorMessage: params.errorMessage,
    },
  });
}
