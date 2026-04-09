/**
 * AI Gateway 路由
 * 2026-04-07 新增 — P1.29
 * 2026-04-08 新增 — /models 和 /test 端点（P1.27 补全）
 * 设计思路：统一入口接收各客户端的增强请求，
 *   校验输入 → 调用 gateway service → 返回结果
 *   /models — 返回当前活跃 provider 可用模型列表
 *   /test — 验证 provider 连通性（发送最小化请求）
 * 影响范围：/api/v1/ai/* 端点
 * 潜在风险：/test 会产生实际 API 调用，需管理员权限
 */

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate';
import { optionalAuth, requireAuth, requireAdmin } from '../middlewares/auth';
import { enhance, enhanceStream } from '../services/ai-gateway.service';
import { getActiveProvider } from '../services/provider.service';
import { callAiProvider } from '../services/adapters/openai.adapter';
import { AI_LIMITS } from '../config/constants';

const router = Router();

// ── Zod Schemas ──────────────────────────────────────

const enhanceSchema = z.object({
  input: z
    .string()
    .min(
      AI_LIMITS.MIN_INPUT_LENGTH,
      `Input must be at least ${AI_LIMITS.MIN_INPUT_LENGTH} characters`,
    )
    .max(
      AI_LIMITS.MAX_INPUT_LENGTH,
      `Input exceeds maximum length of ${AI_LIMITS.MAX_INPUT_LENGTH}`,
    ),
  scene: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  enhanceMode: z.enum(['fast', 'deep']).optional(),
  systemPrompt: z.string().max(10000).optional(),
  sceneIds: z.array(z.string()).optional(),
  isComposite: z.boolean().optional(),
  clientType: z.string().max(20).optional(),
  clientVersion: z.string().max(20).optional(),
  language: z.string().max(10).optional(),
});

// ── Routes ──────────────────────────────────────────

/**
 * POST /api/v1/ai/enhance — AI 增强
 * 支持匿名和已登录用户
 */
router.post('/enhance', optionalAuth, validate({ body: enhanceSchema }), async (req, res, next) => {
  try {
    const result = await enhance(req.body, {
      requestId: req.requestId,
      userId: req.user?.userId,
      clientType: req.body.clientType || 'unknown',
      clientVersion: req.body.clientVersion,
      clientPlatform: req.headers['x-client-platform'] as string | undefined,
      language: req.body.language || (req.headers['accept-language'] as string | undefined),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      fingerprint: req.fingerprint,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/ai/enhance/stream — SSE 流式 AI 增强
 * 2026-04-09 新增 — P6.02 SSE 流式增强
 * 设计思路：
 *   1. 使用 text/event-stream 格式推送增量文本
 *   2. 事件格式：data: {"type":"chunk","content":"..."}\n\n
 *   3. 完成时发送 done 事件，包含完整文本和 usage 统计
 *   4. 客户端断开时自动清理
 * 影响范围：/api/v1/ai/enhance/stream
 * 潜在风险：Nginx 需配置 proxy_buffering off + proxy_read_timeout
 */
router.post(
  '/enhance/stream',
  optionalAuth,
  validate({ body: enhanceSchema }),
  async (req, res) => {
    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginx 禁用代理缓冲
    res.flushHeaders();

    // 客户端断开检测
    let clientDisconnected = false;
    req.on('close', () => {
      clientDisconnected = true;
    });

    /**
     * 向客户端发送 SSE 事件
     * 格式：data: <json>\n\n
     */
    const sendSSE = (data: unknown) => {
      if (clientDisconnected) return;
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    await enhanceStream(
      req.body,
      {
        requestId: req.requestId,
        userId: req.user?.userId,
        clientType: req.body.clientType || 'unknown',
        clientVersion: req.body.clientVersion,
        clientPlatform: req.headers['x-client-platform'] as string | undefined,
        language: req.body.language || (req.headers['accept-language'] as string | undefined),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        fingerprint: req.fingerprint,
      },
      (chunk) => {
        sendSSE(chunk);
        // done/error 事件后关闭连接
        if (chunk.type === 'done' || chunk.type === 'error') {
          res.end();
        }
      },
    );
  },
);

/**
 * GET /api/v1/ai/models — 获取当前活跃 provider 的可用模型列表
 * 2026-04-08 新增 — P1.27 补全
 */
router.get('/models', async (_req, res, next) => {
  try {
    const provider = await getActiveProvider();
    res.json({
      success: true,
      data: {
        provider: provider.slug,
        defaultModel: provider.defaultModel,
        models: provider.models,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/ai/test — 测试当前 provider 连通性（仅管理员）
 * 2026-04-08 新增 — P1.27 补全
 * 发送最小化请求验证 provider 可用性
 */
router.post('/test', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const provider = await getActiveProvider();
    const startTime = Date.now();

    const result = await callAiProvider({
      apiMode: provider.apiMode,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: provider.defaultModel,
      systemPrompt: 'Reply with exactly: OK',
      userMessage: 'ping',
      maxTokens: 10,
      timeoutMs: 15000,
      extraHeaders: (provider.extraHeaders as Record<string, string>) ?? {},
    });

    res.json({
      success: true,
      data: {
        provider: provider.slug,
        model: provider.defaultModel,
        response: result.content.slice(0, 100),
        durationMs: Date.now() - startTime,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
