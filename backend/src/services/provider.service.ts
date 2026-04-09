/**
 * AI Provider 管理服务
 * 2026-04-07 新增 — P1.30
 * 设计思路：封装 provider CRUD + 加密 key 管理，
 *   获取当前激活 provider 时自动解密 API Key
 * 影响范围：AI Gateway、管理员 API
 * 潜在风险：PROVIDER_ENCRYPTION_KEY 泄露导致所有 key 暴露
 */

import { prisma } from '../lib/prisma';
import { encrypt, decrypt } from '../utils/crypto';
import { AppError } from '../utils/errors';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('provider');

/**
 * 获取当前激活的 provider（解密 API Key）
 * @throws PROVIDER_NOT_FOUND / PROVIDER_INACTIVE
 */
export async function getActiveProvider() {
  const provider = await prisma.aiProvider.findFirst({
    where: { isActive: true },
  });

  if (!provider) {
    throw new AppError('PROVIDER_INACTIVE', 'No active AI provider configured');
  }

  return {
    ...provider,
    apiKey: decrypt(provider.apiKey),
  };
}

/**
 * 根据 ID 获取 provider（解密 API Key）
 */
export async function getProviderById(id: string) {
  const provider = await prisma.aiProvider.findUnique({ where: { id } });
  if (!provider) {
    throw new AppError('PROVIDER_NOT_FOUND');
  }
  return {
    ...provider,
    apiKey: decrypt(provider.apiKey),
  };
}

/**
 * 列出所有 provider（不解密 Key，安全展示）
 */
export async function listProviders() {
  const providers = await prisma.aiProvider.findMany({
    orderBy: { priority: 'desc' },
  });

  // 隐藏 apiKey 明文
  return providers.map((p) => ({
    ...p,
    apiKey: '***encrypted***',
  }));
}

export interface CreateProviderInput {
  name: string;
  slug: string;
  apiMode: string;
  baseUrl: string;
  apiKey: string; // 明文，存储时加密
  defaultModel: string;
  models?: string[];
  isActive?: boolean;
  priority?: number;
  maxRpm?: number;
  maxTokens?: number;
  timeoutMs?: number;
  extraHeaders?: Record<string, unknown>;
  notes?: string;
}

/**
 * 创建 provider（自动加密 API Key）
 */
export async function createProvider(input: CreateProviderInput) {
  // 如果标记为 active，先停用其他 provider
  if (input.isActive) {
    await prisma.aiProvider.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
  }

  const provider = await prisma.aiProvider.create({
    data: {
      name: input.name,
      slug: input.slug,
      apiMode: input.apiMode,
      baseUrl: input.baseUrl,
      apiKey: encrypt(input.apiKey),
      defaultModel: input.defaultModel,
      models: input.models ?? [],
      isActive: input.isActive ?? false,
      priority: input.priority ?? 0,
      maxRpm: input.maxRpm ?? 60,
      maxTokens: input.maxTokens ?? 4096,
      timeoutMs: input.timeoutMs ?? 30000,
      extraHeaders: (input.extraHeaders ?? {}) as Record<string, string>,
      notes: input.notes ?? null,
    },
  });

  log.info({ providerId: provider.id, slug: provider.slug }, 'Provider created');
  return { ...provider, apiKey: '***encrypted***' };
}

/**
 * 更新 provider
 */
export async function updateProvider(id: string, input: Partial<CreateProviderInput>) {
  const existing = await prisma.aiProvider.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('PROVIDER_NOT_FOUND');
  }

  // 如果标记为 active，先停用其他 provider
  if (input.isActive) {
    await prisma.aiProvider.updateMany({
      where: { isActive: true, id: { not: id } },
      data: { isActive: false },
    });
  }

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.slug !== undefined) data.slug = input.slug;
  if (input.apiMode !== undefined) data.apiMode = input.apiMode;
  if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl;
  if (input.apiKey !== undefined) data.apiKey = encrypt(input.apiKey);
  if (input.defaultModel !== undefined) data.defaultModel = input.defaultModel;
  if (input.models !== undefined) data.models = input.models;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.maxRpm !== undefined) data.maxRpm = input.maxRpm;
  if (input.maxTokens !== undefined) data.maxTokens = input.maxTokens;
  if (input.timeoutMs !== undefined) data.timeoutMs = input.timeoutMs;
  if (input.extraHeaders !== undefined) data.extraHeaders = input.extraHeaders;
  if (input.notes !== undefined) data.notes = input.notes;

  const provider = await prisma.aiProvider.update({ where: { id }, data });

  log.info({ providerId: provider.id }, 'Provider updated');
  return { ...provider, apiKey: '***encrypted***' };
}

/**
 * 删除 provider
 */
export async function deleteProvider(id: string) {
  const existing = await prisma.aiProvider.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('PROVIDER_NOT_FOUND');
  }

  await prisma.aiProvider.delete({ where: { id } });
  log.info({ providerId: id }, 'Provider deleted');
}
