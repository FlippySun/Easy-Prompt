/**
 * EnhanceHistory 相关类型
 * 2026-04-09 新增 — P6.01 跨设备历史同步
 * 设计思路：定义历史记录的请求/响应类型，供 service 和 route 共享
 * 影响范围：history.service / history.routes
 * 潜在风险：无已知风险
 */

/** 单条历史记录（客户端上传格式） */
export interface HistorySyncItem {
  clientId: string;       // 客户端生成的唯一 ID（用于去重）
  inputText: string;
  outputText: string;
  scene?: string;
  model?: string;
  clientType?: string;    // vscode / browser / web / intellij / web-hub
  enhanceMode?: string;   // fast / deep
  language?: string;
  createdAt?: string;     // ISO 8601，客户端原始创建时间
}

/** 同步请求体 */
export interface HistorySyncRequest {
  items: HistorySyncItem[];
}

/** 同步响应 */
export interface HistorySyncResponse {
  synced: number;         // 成功同步（含 upsert）的条数
  skipped: number;        // 跳过的条数（校验失败等）
  total: number;          // 服务端当前历史总数
}

/** 导出格式 */
export type HistoryExportFormat = 'json' | 'csv';

/** 历史列表查询参数 */
export interface HistoryListQuery {
  page?: number;
  limit?: number;
  clientType?: string;
  startDate?: string;     // ISO 8601
  endDate?: string;       // ISO 8601
}
