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
import {
  buildRouterPrompt,
  parseRouterResult,
  buildGenerationPrompt,
  decorateGenerationPrompt,
} from './scene-router.service';
import { AppError } from '../utils/errors';
import { createChildLogger } from '../utils/logger';
import { logAiRequest } from '../utils/aiLogger';
import { lookupGeo } from '../utils/geoip';
import type { EnhanceRequest, EnhanceResponse, StreamChunk } from '../types/ai';

const log = createChildLogger('ai-gateway');

// 2026-04-10 修复
// 变更类型：修复
// 功能描述：为后端两步增强链路引入统一超时预算，避免旧 Provider 配置仍为 30000ms 时在生成阶段过早触发 AI_TIMEOUT。
// 设计思路：Router 阶段继续保持 30s 上限以便快速失败；Generation 阶段至少保留 90s，和 VS Code / IntelliJ 客户端的等待窗口对齐。
// 参数与返回值：getGatewayGenerationTimeoutMs(timeoutMs) 返回实际生成阶段超时；getGatewayRouterTimeoutMs(timeoutMs) 返回实际路由阶段超时。
// 影响范围：/api/v1/ai/enhance、/api/v1/ai/enhance/stream、VS Code 与 IntelliJ 共用的 backend enhance 请求。
// 潜在风险：单次慢请求最长会占用后端 AI 调用 90s；但这是两步增强的已知成本，且仅对旧 30s 配置做兜底。
const AI_GATEWAY_ROUTER_TIMEOUT_MS = 30_000;
const AI_GATEWAY_MIN_GENERATION_TIMEOUT_MS = 90_000;

function getGatewayGenerationTimeoutMs(timeoutMs?: number | null): number {
  return Math.max(
    timeoutMs ?? AI_GATEWAY_MIN_GENERATION_TIMEOUT_MS,
    AI_GATEWAY_MIN_GENERATION_TIMEOUT_MS,
  );
}

function getGatewayRouterTimeoutMs(timeoutMs?: number | null): number {
  return Math.min(getGatewayGenerationTimeoutMs(timeoutMs), AI_GATEWAY_ROUTER_TIMEOUT_MS);
}

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
 * 执行 AI 增强请求 — 两步路由+生成流程
 * 2026-04-09 重构：从单次 AI 调用改为两步流程（port from core/router.js + core/composer.js）
 * Step 1（Router）：意图识别 — 构建分类 prompt → AI 调用 → 解析 JSON → scenes[]
 * Step 2（Generation）：Prompt 生成 — 根据 scenes 构建专业 prompt → AI 调用 → 增强输出
 * 参数：input — 增强请求；context — 请求上下文
 * 返回：EnhanceResponse（含 scenes + composite 供客户端展示）
 * 影响范围：所有客户端（浏览器/VSCode/Web/IntelliJ）的增强请求
 * 潜在风险：两次 AI 调用总耗时更长（routing ~3-8s + generation ~15-45s）
 */
export async function enhance(
  input: EnhanceRequest,
  context: GatewayContext,
): Promise<EnhanceResponse> {
  const startTime = Date.now();
  let provider;
  // 2026-04-13 修复 — 提升路由阶段变量作用域
  // 变更类型：修复
  // 功能描述：将路由阶段产出（routerParsed / routerDurationMs / decoratedPrompt）从 try 内 const 改为外层 let，
  //   使 catch 块在生成阶段失败时仍可将已完成的路由数据写入错误日志
  // 设计思路：原 const 声明在 try 块内，catch 块访问不到；改为 let + 外层声明后，
  //   catch 中检测是否已赋值来决定是否传递
  // 影响范围：enhance() 错误日志的 routerResult / routerDurationMs / actualSystemPrompt 字段
  // 潜在风险：无已知风险（仅扩大变量可见域，不改变控制流）
  let routerParsed: ReturnType<typeof parseRouterResult> | undefined;
  let routerDurationMs: number | undefined;
  let decoratedPrompt: string | undefined;

  try {
    // 1. 获取激活的 provider
    provider = await getActiveProvider();
    const model = input.model || provider.defaultModel;
    const extraHeaders = (provider.extraHeaders as Record<string, string>) ?? {};
    const generationTimeoutMs = getGatewayGenerationTimeoutMs(provider.timeoutMs);
    const routerTimeoutMs = getGatewayRouterTimeoutMs(provider.timeoutMs);

    // ── Step 1: 意图识别（Router） ──
    // 使用低 temperature + 短 maxTokens + 短超时，快速获取场景分类
    const routerSystemPrompt = buildRouterPrompt();
    log.info({ requestId: context.requestId }, 'Step 1: routing — identifying intent');

    // 2026-04-13 修复 — 记录路由阶段耗时
    const routerStartTime = Date.now();
    const routerResult = await callAiProvider({
      apiMode: provider.apiMode,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model,
      systemPrompt: routerSystemPrompt,
      userMessage: input.input,
      maxTokens: 500,
      timeoutMs: routerTimeoutMs,
      extraHeaders,
    });
    routerDurationMs = Date.now() - routerStartTime;

    routerParsed = parseRouterResult(routerResult.content);
    log.info(
      {
        requestId: context.requestId,
        scenes: routerParsed.scenes,
        composite: routerParsed.composite,
        routerDurationMs,
      },
      'Step 1 done: routing result',
    );

    // ── Step 2: Prompt 生成（Generation） ──
    // 根据路由结果构建专业生成 prompt，使用 enhance mode 装饰
    const { prompt: genSystemPrompt, sceneNames } = buildGenerationPrompt(routerParsed);
    decoratedPrompt = decorateGenerationPrompt(genSystemPrompt, input.enhanceMode);

    // Generation 参数根据 enhanceMode 调整
    const isDeep = input.enhanceMode === 'deep';
    const genMaxTokens = isDeep
      ? routerParsed.composite
        ? 8192
        : 4096
      : routerParsed.composite
        ? 4096
        : 2048;

    log.info(
      {
        requestId: context.requestId,
        sceneNames,
        enhanceMode: input.enhanceMode || 'fast',
        genMaxTokens,
      },
      'Step 2: generating — building enhanced prompt',
    );

    // 2026-04-13 修复 — 记录生成阶段耗时
    const genStartTime = Date.now();
    const genResult = await callAiProvider({
      apiMode: provider.apiMode,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model,
      systemPrompt: decoratedPrompt,
      userMessage: input.input,
      maxTokens: genMaxTokens,
      timeoutMs: generationTimeoutMs,
      extraHeaders,
    });
    const genDurationMs = Date.now() - genStartTime;

    const duration = Date.now() - startTime;

    // 合并两步 token 统计
    const totalUsage = {
      promptTokens: (routerResult.promptTokens ?? 0) + (genResult.promptTokens ?? 0),
      completionTokens: (routerResult.completionTokens ?? 0) + (genResult.completionTokens ?? 0),
      totalTokens: (routerResult.totalTokens ?? 0) + (genResult.totalTokens ?? 0),
    };

    // 更新 input 的 sceneIds/isComposite 供日志记录
    input.sceneIds = routerParsed.scenes;
    input.isComposite = routerParsed.composite;

    // 异步记录日志（不阻塞响应）
    // 2026-04-13 修复 — 补写 routerResult / routerDurationMs / genDurationMs / actualSystemPrompt
    recordLog({
      context,
      input,
      provider,
      model,
      output: genResult.content,
      status: 'success',
      duration,
      adapterResult: totalUsage,
      routerResult: routerParsed,
      routerDurationMs,
      genDurationMs,
      actualSystemPrompt: decoratedPrompt,
    }).catch((err) => log.error({ err }, 'Failed to record AI request log'));

    logAiRequest({
      requestId: context.requestId,
      userId: context.userId,
      clientType: context.clientType,
      scenes: routerParsed.scenes,
      model,
      provider: provider.slug,
      inputTokens: totalUsage.promptTokens,
      outputTokens: totalUsage.completionTokens,
      totalTokens: totalUsage.totalTokens,
      latencyMs: duration,
      status: 'success',
    });

    return {
      output: genResult.content,
      model,
      provider: provider.slug,
      scenes: routerParsed.scenes,
      composite: routerParsed.composite,
      usage: totalUsage,
      durationMs: duration,
    };
  } catch (err) {
    const duration = Date.now() - startTime;

    const failStatus = err instanceof AppError && err.code === 'AI_TIMEOUT' ? 'timeout' : 'error';
    if (provider) {
      // 2026-04-13 修复 — 错误日志保留已完成的路由阶段数据
      recordLog({
        context,
        input,
        provider,
        model: input.model || provider.defaultModel,
        output: null,
        status: failStatus,
        duration,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
        routerResult: routerParsed,
        routerDurationMs,
        actualSystemPrompt: decoratedPrompt,
      }).catch((logErr) => log.error({ logErr }, 'Failed to record error log'));

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

// 2026-04-13 修改 — 补全日志记录字段
// 变更类型：修复
// 功能描述：扩展 LogParams 以支持 routerResult / routerDurationMs / genDurationMs / actualSystemPrompt
// 设计思路：Prisma schema 已预留这些字段但 recordLog 从未写入，导致详情页大量数据为空
// 影响范围：recordLog → AiRequestLog 表
// 潜在风险：无已知风险
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
  /** 路由器原始 JSON 结果（供管理后台展示） */
  routerResult?: { scenes: string[]; composite: boolean } | null;
  /** 路由阶段耗时（ms） */
  routerDurationMs?: number;
  /** 生成阶段耗时（ms） */
  genDurationMs?: number;
  /** 实际使用的 generation system prompt（非客户端传入的 input.systemPrompt） */
  actualSystemPrompt?: string;
}

/**
 * P6.02 SSE 流式增强
 * 2026-04-09 新增 — P6.02
 * 设计思路：
 *   与同步 enhance() 相同流程（provider 选择 → 适配器调用 → 日志记录）
 *   区别在于通过 onEvent 回调推送 StreamChunk 事件
 *   适配器内部解析 SSE，逐 chunk 回调到此方法，再转发给路由层
 * 参数：input — 增强请求；context — 请求上下文；onEvent — SSE 事件回调
 * 返回：Promise<void>（结果通过回调传递）
 * 影响范围：ai.routes 的 /enhance/stream 端点
 * 潜在风险：长连接超时需 Nginx 配合（proxy_read_timeout）
 */
export async function enhanceStream(
  input: EnhanceRequest,
  context: GatewayContext,
  onEvent: (chunk: StreamChunk) => void,
): Promise<void> {
  const startTime = Date.now();
  let provider: Awaited<ReturnType<typeof getActiveProvider>> | undefined;
  // 2026-04-13 修复 — 提升路由阶段变量作用域（与 enhance() 同理）
  let routerParsed: ReturnType<typeof parseRouterResult> | undefined;
  let routerDurationMs: number | undefined;
  let decoratedPrompt: string | undefined;

  try {
    provider = await getActiveProvider();
    const model = input.model || provider.defaultModel;
    const extraHeaders = (provider.extraHeaders as Record<string, string>) ?? {};
    const generationTimeoutMs = getGatewayGenerationTimeoutMs(provider.timeoutMs);
    const routerTimeoutMs = getGatewayRouterTimeoutMs(provider.timeoutMs);

    // ── Step 1: 意图识别（Router）— 同步调用，不流式 ──
    const routerSystemPrompt = buildRouterPrompt();
    // 2026-04-13 修复 — 记录路由阶段耗时
    const routerStartTime = Date.now();
    const routerResult = await callAiProvider({
      apiMode: provider.apiMode,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model,
      systemPrompt: routerSystemPrompt,
      userMessage: input.input,
      maxTokens: 500,
      timeoutMs: routerTimeoutMs,
      extraHeaders,
    });
    routerDurationMs = Date.now() - routerStartTime;
    routerParsed = parseRouterResult(routerResult.content);
    input.sceneIds = routerParsed.scenes;
    input.isComposite = routerParsed.composite;

    // ── Step 2: Prompt 生成 — 流式输出 ──
    const { prompt: genSystemPrompt } = buildGenerationPrompt(routerParsed);
    decoratedPrompt = decorateGenerationPrompt(genSystemPrompt, input.enhanceMode);
    const isDeep = input.enhanceMode === 'deep';
    const genMaxTokens = isDeep
      ? routerParsed.composite
        ? 8192
        : 4096
      : routerParsed.composite
        ? 4096
        : 2048;

    // 2026-04-13 修复 — 记录生成阶段起始时间
    const genStartTime = Date.now();
    await callAiProviderStream(
      {
        apiMode: provider.apiMode,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model,
        systemPrompt: decoratedPrompt,
        userMessage: input.input,
        maxTokens: genMaxTokens,
        timeoutMs: generationTimeoutMs,
        extraHeaders,
      },
      {
        onChunk: (content) => {
          onEvent({ type: 'chunk', content });
        },
        onDone: (fullContent, usage) => {
          const genDurationMs = Date.now() - genStartTime;
          const duration = Date.now() - startTime;
          // 合并 router + generation token 统计
          const totalUsage = {
            promptTokens: (routerResult.promptTokens ?? 0) + (usage?.promptTokens ?? 0),
            completionTokens: (routerResult.completionTokens ?? 0) + (usage?.completionTokens ?? 0),
            totalTokens: (routerResult.totalTokens ?? 0) + (usage?.totalTokens ?? 0),
          };

          onEvent({
            type: 'done',
            fullContent,
            model,
            provider: provider!.slug,
            usage: totalUsage,
            durationMs: duration,
          });

          // 异步记录日志（不阻塞 SSE 关闭）
          // 2026-04-13 修复 — 补写 routerResult / routerDurationMs / genDurationMs / actualSystemPrompt
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
            routerResult: routerParsed,
            routerDurationMs,
            genDurationMs,
            actualSystemPrompt: decoratedPrompt,
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
            // 2026-04-13 修复 — 错误日志保留已完成的路由阶段数据
            recordLog({
              context,
              input,
              provider,
              model,
              output: null,
              status: failStatus,
              duration,
              errorMessage: error.message,
              routerResult: routerParsed,
              routerDurationMs,
              actualSystemPrompt: decoratedPrompt,
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
      // 2026-04-13 修复 — 错误日志保留已完成的路由阶段数据
      recordLog({
        context,
        input,
        provider,
        model: input.model || provider.defaultModel,
        output: null,
        status: 'error',
        duration,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
        routerResult: routerParsed,
        routerDurationMs,
        actualSystemPrompt: decoratedPrompt,
      }).catch((logErr) => log.error({ logErr }, 'Failed to record stream gateway error log'));
    }
  }
}

// ── 日志记录 ──────────────────────────────────────────

// 2026-04-13 修复 — 补全 routerResult / routerDurationMs / genDurationMs / systemPrompt 写入
// 变更类型：修复
// 功能描述：将 recordLog 中缺失的 5 个字段补齐写入 AiRequestLog 表
// 设计思路：
//   - systemPrompt：改用 actualSystemPrompt（实际 generation prompt），而非 input.systemPrompt（客户端传入，通常为空）
//   - routerResult：存储路由器解析结果 JSON，供管理后台展示路由决策过程
//   - routerDurationMs / genDurationMs：分步耗时，便于性能分析
// 参数与返回值：params.routerResult / params.routerDurationMs / params.genDurationMs / params.actualSystemPrompt
// 影响范围：AiRequestLog 表新增 4 个字段的实际写入
// 潜在风险：无已知风险
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
      // 2026-04-13 修复：使用实际 generation prompt 而非客户端传入的空 systemPrompt
      systemPrompt: params.actualSystemPrompt ?? params.input.systemPrompt,
      aiOutput: params.output,
      // 2026-04-13 修复：写入路由器解析结果（JsonB）
      routerResult: params.routerResult ?? undefined,
      sceneIds: params.input.sceneIds ?? [],
      isComposite: params.input.isComposite ?? false,
      providerId: params.provider.id,
      providerSlug: params.provider.slug,
      modelUsed: params.model,
      apiMode: params.provider.apiMode,
      durationMs: params.duration,
      // 2026-04-13 修复：写入分步耗时
      routerDurationMs: params.routerDurationMs,
      genDurationMs: params.genDurationMs,
      promptTokens: params.adapterResult?.promptTokens,
      completionTokens: params.adapterResult?.completionTokens,
      totalTokens: params.adapterResult?.totalTokens,
      status: params.status,
      errorMessage: params.errorMessage,
    },
  });
}
