/**
 * 客户端指纹提取中间件
 * 2026-04-07 新增 — P1.22 指纹中间件
 * 2026-04-08 修复 — 新增服务端 SHA-256 降级生成逻辑
 * 设计思路：优先从 X-Fingerprint 头提取客户端指纹（FingerprintJS 等），
 *   若无则根据 User-Agent + IP + Accept-Language 生成服务端指纹（SHA-256 hash）
 *   注入 req.fingerprint 供后续黑名单/限流模块使用
 * 影响范围：全局中间件链
 * 潜在风险：客户端可伪造指纹；服务端降级指纹精度低于客户端 FingerprintJS
 */

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * 从请求头中提取指纹或服务端生成降级指纹
 * 优先级：X-Fingerprint header > 服务端 SHA-256(UA + IP + Accept-Language)
 */
export function fingerprintExtractor(req: Request, _res: Response, next: NextFunction): void {
  // 1. 优先使用客户端发送的指纹
  const clientFp = req.headers['x-fingerprint'];
  if (typeof clientFp === 'string' && clientFp.length > 0 && clientFp.length <= 64) {
    req.fingerprint = clientFp;
    next();
    return;
  }

  // 2. 服务端降级：基于 UA + IP + Accept-Language 生成 SHA-256 hash
  // 2026-04-08 新增 — 确保无客户端指纹时仍有设备维度用于限流/黑名单
  const ua = req.headers['user-agent'] || '';
  const ip = req.ip || '';
  const lang = req.headers['accept-language'] || '';
  const raw = `${ua}|${ip}|${lang}`;

  if (raw.length > 2) {
    req.fingerprint = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
  }

  next();
}
