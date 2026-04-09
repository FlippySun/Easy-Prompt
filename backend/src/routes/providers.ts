/**
 * Provider 管理路由
 * 2026-04-07 新增 — P1.30
 * 2026-04-08 新增 — 公开 /active 端点（P1.30 补全），客户端可查询当前活跃 provider 信息（脱敏）
 * 设计思路：管理端点需 admin 权限，公开端点 /active 无需认证
 * 影响范围：/api/v1/admin/providers/*
 * 潜在风险：无已知风险
 */

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate';
import { requireAuth, requireAdmin } from '../middlewares/auth';
import {
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  getActiveProvider,
} from '../services/provider.service';
// 2026-04-08 修复 — P2.02 审计日志接入（验证报告 Gap #1）
import { logAudit } from '../utils/auditLogger';

const router = Router();

/**
 * GET /api/v1/admin/providers/active — 获取当前活跃 provider 信息（公开，脱敏）
 * 2026-04-08 新增 — 客户端发现端点，返回 provider 名称/模型等，不含 API Key
 */
router.get('/active', async (_req, res, next) => {
  try {
    const provider = await getActiveProvider();
    res.json({
      success: true,
      data: {
        id: provider.id,
        name: provider.name,
        slug: provider.slug,
        apiMode: provider.apiMode,
        defaultModel: provider.defaultModel,
        models: provider.models,
        isActive: provider.isActive,
        maxTokens: provider.maxTokens,
        timeoutMs: provider.timeoutMs,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── 以下路由需要管理员权限 ──────────────────────────────
router.use(requireAuth, requireAdmin);

// ── Zod Schemas ──────────────────────────────────────

const createProviderSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  apiMode: z.enum(['openai', 'openai-responses', 'claude', 'gemini']),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  defaultModel: z.string().min(1).max(100),
  models: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
  maxRpm: z.number().int().positive().optional(),
  maxTokens: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional(),
  extraHeaders: z.record(z.string()).optional(),
  notes: z.string().optional(),
});

const updateProviderSchema = createProviderSchema.partial();

// ── Routes ──────────────────────────────────────────

router.get('/', async (_req, res, next) => {
  try {
    const providers = await listProviders();
    res.json({ success: true, data: providers });
  } catch (err) {
    next(err);
  }
});

router.post('/', validate({ body: createProviderSchema }), async (req, res, next) => {
  try {
    const provider = await createProvider(req.body);
    // 2026-04-08 修复 — P2.02 审计日志：记录 provider 创建
    logAudit({
      adminId: req.user!.userId,
      action: 'provider.create',
      targetType: 'provider',
      targetId: provider.id,
      changes: { after: { name: req.body.name, slug: req.body.slug, apiMode: req.body.apiMode } },
      ip: req.ip,
    });
    res.status(201).json({ success: true, data: provider });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', validate({ body: updateProviderSchema }), async (req, res, next) => {
  try {
    const provider = await updateProvider(req.params.id as string, req.body);
    // 2026-04-08 修复 — P2.02 审计日志：记录 provider 更新
    logAudit({
      adminId: req.user!.userId,
      action: 'provider.update',
      targetType: 'provider',
      targetId: req.params.id as string,
      changes: { after: req.body },
      ip: req.ip,
    });
    res.json({ success: true, data: provider });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await deleteProvider(req.params.id);
    // 2026-04-08 修复 — P2.02 审计日志：记录 provider 删除
    logAudit({
      adminId: req.user!.userId,
      action: 'provider.delete',
      targetType: 'provider',
      targetId: req.params.id,
      ip: req.ip,
    });
    res.json({ success: true, message: 'Provider deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
