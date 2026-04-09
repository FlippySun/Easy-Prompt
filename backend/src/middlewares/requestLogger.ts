/**
 * 请求日志中间件
 * 2026-04-07 新增 — P1.11
 * 设计思路：为每个请求生成 requestId，记录请求开始和结束（含耗时），
 *   同时将 requestId 注入 req 对象供下游使用
 * 影响范围：Express 中间件链（最前端）
 * 潜在风险：无已知风险
 */

import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('http');

/**
 * 为每个请求注入 requestId 并记录请求日志
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  const startTime = Date.now();

  // 注入 requestId 到 req 对象
  req.requestId = requestId;

  // 同步设置响应头
  res.setHeader('X-Request-Id', requestId);

  // 响应结束时记录
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    log[level](
      {
        requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: duration,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
      `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`,
    );
  });

  next();
}
