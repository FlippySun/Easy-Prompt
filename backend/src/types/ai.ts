/**
 * AI 网关相关类型
 * 2026-04-07 新增 — P1.06
 */

export type ApiMode = 'openai' | 'openai-responses' | 'claude' | 'gemini';
export type EnhanceMode = 'fast' | 'deep';

/** 客户端发送的增强请求 */
export interface EnhanceRequest {
  /** 用户原始输入 */
  input: string;
  /** 指定场景（可选） */
  scene?: string;
  /** 指定模型（可选，不传则用 provider 默认） */
  model?: string;
  /** 增强模式 */
  enhanceMode?: EnhanceMode;
  /** 系统提示词（由 ai-router 或客户端生成） */
  systemPrompt?: string;
  /** 识别到的场景 ID 列表（由 ai-router 填充） */
  sceneIds?: string[];
  /** 是否复合场景（由 ai-router 填充） */
  isComposite?: boolean;
  /** 客户端元数据 */
  clientType?: string;
  clientVersion?: string;
  language?: string;
}

/** 后端返回的增强响应 */
export interface EnhanceResponse {
  output: string;
  model: string;
  provider: string;
  scenes?: string[];
  composite?: boolean;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs: number;
}

/** Provider 公开信息（脱敏） */
export interface ProviderInfo {
  id: string;
  name: string;
  slug: string;
  apiMode: ApiMode;
  defaultModel: string;
  models: string[];
  isActive: boolean;
  priority: number;
}

/** Provider 完整配置（管理员可见） */
export interface ProviderConfig extends ProviderInfo {
  baseUrl: string;
  maxRpm: number;
  maxTokens: number;
  timeoutMs: number;
  extraHeaders: Record<string, string>;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** AI 适配器统一返回接口 */
export interface AdapterResponse {
  content: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  durationMs: number;
}

// ── P6.02 SSE 流式增强类型 ─────────────────────────────
// 2026-04-09 新增 — P6.02 SSE 流式增强
// 设计思路：定义 SSE 事件类型，adapter → gateway → route 逐层传递
// 影响范围：openai.adapter / ai-gateway.service / ai.routes

/** SSE 事件类型 */
export type StreamEventType = 'chunk' | 'done' | 'error';

/** 单个 SSE 事件数据 */
export interface StreamChunk {
  type: StreamEventType;
  /** 增量文本片段（type='chunk' 时） */
  content?: string;
  /** 完整聚合文本（type='done' 时） */
  fullContent?: string;
  /** token 用量统计（type='done' 时） */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 错误信息（type='error' 时） */
  error?: string;
  /** 模型和 provider 信息（type='done' 时） */
  model?: string;
  provider?: string;
  durationMs?: number;
}

/** 流式回调接口 — adapter 向上层推送事件 */
export interface StreamCallbacks {
  onChunk: (content: string) => void;
  onDone: (
    fullContent: string,
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number },
  ) => void;
  onError: (error: Error) => void;
}
