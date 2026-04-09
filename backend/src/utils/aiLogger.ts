/**
 * AI 增强专用结构化日志
 * 2026-04-08 新增 — P2.01
 * 2026-04-08 修复 — Gap B：改用独立 pino 实例 + aiRequest 通道 pino-roll transport
 * 变更类型：修复
 * 设计思路：在 DB 日志（ai-gateway.service.ts recordLog）之外，
 *   同步输出 Pino 结构化日志到独立文件 ai-request.log（§8B.3）。
 *   生产环境通过 createChannelLogger 创建独立 pino 实例，
 *   输出到 logs/ai-request.log（pino-roll 每日轮转，保留 60 天）+ stdout。
 *   开发环境保持 pino-pretty 输出。
 *   成功=info, 失败=error, 慢请求(>5s)=warn
 * 参数：requestId, userId, clientType, scene, model, provider,
 *       inputTokens, outputTokens, latencyMs, status, errorCode
 * 影响范围：ai-gateway.service.ts 调用此模块输出结构化日志
 * 潜在风险：无已知风险
 */

import { createChannelLogger } from '../config/logRotation';

const aiLog = createChannelLogger('aiRequest', 'ai-enhance');

// ── 慢请求阈值（毫秒）──────────────────────────────
const SLOW_REQUEST_THRESHOLD_MS = 5000;

export interface AiLogEntry {
  /** 请求追踪 ID */
  requestId?: string;
  /** 用户 ID（可选，匿名用户为 null） */
  userId?: string | null;
  /** 客户端类型：vscode / browser / web / intellij / web-hub */
  clientType: string;
  /** 匹配到的场景 ID 列表 */
  scenes?: string[];
  /** 使用的模型 */
  model: string;
  /** Provider slug */
  provider: string;
  /** 输入 token 数 */
  inputTokens?: number;
  /** 输出 token 数 */
  outputTokens?: number;
  /** 总 token 数 */
  totalTokens?: number;
  /** 请求总耗时（毫秒） */
  latencyMs: number;
  /** 请求状态：success / error / timeout */
  status: string;
  /** 错误码（失败时填充） */
  errorCode?: string;
  /** 错误消息（失败时填充） */
  errorMessage?: string;
}

/**
 * 输出 AI 增强请求的结构化日志
 * 自动根据 status 和 latencyMs 选择日志级别：
 *   - error → error
 *   - timeout → error
 *   - success 且 latencyMs > 5000 → warn（慢请求）
 *   - success → info
 */
export function logAiRequest(entry: AiLogEntry): void {
  const payload = {
    requestId: entry.requestId,
    userId: entry.userId ?? null,
    clientType: entry.clientType,
    scenes: entry.scenes,
    model: entry.model,
    provider: entry.provider,
    inputTokens: entry.inputTokens ?? 0,
    outputTokens: entry.outputTokens ?? 0,
    totalTokens: entry.totalTokens ?? 0,
    latencyMs: entry.latencyMs,
    status: entry.status,
    errorCode: entry.errorCode,
  };

  if (entry.status === 'error' || entry.status === 'timeout') {
    aiLog.error(
      { ...payload, errorMessage: entry.errorMessage },
      `AI enhance failed: ${entry.errorCode ?? entry.status}`,
    );
    return;
  }

  if (entry.latencyMs > SLOW_REQUEST_THRESHOLD_MS) {
    aiLog.warn(payload, `AI enhance slow: ${entry.latencyMs}ms`);
    return;
  }

  aiLog.info(payload, 'AI enhance completed');
}
