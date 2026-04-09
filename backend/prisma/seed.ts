/**
 * Prisma 种子数据脚本
 * 2026-04-08 新增 — P1.05
 * 设计思路：初始化数据库基础数据，包括：
 *   1. 管理员用户（admin@zhiz.chat）
 *   2. 分类元数据（10 大分类）
 *   3. 模型配置（主流 AI 模型）
 *   4. 默认 AI Provider
 *   5. 示例场景数据（核心场景子集）
 * 运行方式：npx prisma db seed 或 npm run db:seed
 * 影响范围：全部基础表
 * 潜在风险：重复运行使用 upsert 保证幂等
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import categories from './data/categories.json';
import models from './data/models.json';
import scenes from './data/scenes.json';

const prisma = new PrismaClient();

// ── 加密工具（与 src/utils/crypto.ts 保持一致）──────────
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function encrypt(plaintext: string): string {
  const key = Buffer.from(process.env.PROVIDER_ENCRYPTION_KEY || '', 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

async function main() {
  console.log('🌱 Seeding database...');

  // ── 1. 管理员用户 ──────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAILS?.split(',')[0]?.trim() || 'admin@zhiz.chat';
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@2026!';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      username: 'admin',
      displayName: 'Administrator',
      passwordHash,
      role: 'super_admin',
    },
  });
  console.log(`  ✅ Admin user: ${adminEmail}`);

  // ── 2. 分类元数据 ──────────────────────────────────
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        label: cat.label,
        labelEn: cat.labelEn ?? null,
        emoji: cat.emoji ?? null,
        icon: cat.icon ?? null,
        color: cat.color ?? null,
        bgColor: cat.bgColor ?? null,
        darkBgColor: cat.darkBgColor ?? null,
        darkColor: cat.darkColor ?? null,
        sortOrder: cat.sortOrder ?? 0,
        isActive: cat.isActive ?? true,
      },
      create: {
        slug: cat.slug,
        label: cat.label,
        labelEn: cat.labelEn ?? null,
        emoji: cat.emoji ?? null,
        icon: cat.icon ?? null,
        color: cat.color ?? null,
        bgColor: cat.bgColor ?? null,
        darkBgColor: cat.darkBgColor ?? null,
        darkColor: cat.darkColor ?? null,
        sortOrder: cat.sortOrder ?? 0,
        isActive: cat.isActive ?? true,
      },
    });
  }
  console.log(`  ✅ Categories: ${categories.length} seeded`);

  // ── 3. 模型配置 ──────────────────────────────────
  for (const model of models) {
    await prisma.modelConfig.upsert({
      where: { slug: model.slug },
      update: {
        label: model.label,
        color: model.color ?? null,
        sortOrder: model.sortOrder ?? 0,
        isActive: model.isActive ?? true,
      },
      create: {
        slug: model.slug,
        label: model.label,
        color: model.color ?? null,
        sortOrder: model.sortOrder ?? 0,
        isActive: model.isActive ?? true,
      },
    });
  }
  console.log(`  ✅ Models: ${models.length} seeded`);

  // ── 4. 默认 AI Provider ──────────────────────────
  const providerApiKey = process.env.DEFAULT_PROVIDER_API_KEY || 'sk-placeholder';
  await prisma.aiProvider.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'Default Provider',
      slug: 'default',
      apiMode: 'openai',
      baseUrl: process.env.DEFAULT_PROVIDER_BASE_URL || 'https://api.openai.com/v1',
      apiKey: encrypt(providerApiKey),
      defaultModel: 'gpt-4o',
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
      isActive: true,
      priority: 100,
      maxRpm: 60,
      maxTokens: 4096,
      timeoutMs: 30000,
    },
  });
  console.log('  ✅ Default AI Provider seeded');

  // ── 5. 场景数据 ──────────────────────────────────
  for (const scene of scenes) {
    await prisma.scene.upsert({
      where: { id: scene.id },
      update: {
        name: scene.name,
        category: scene.category,
        keywords: scene.keywords,
        prompt: scene.prompt,
        description: scene.description ?? null,
        sortOrder: scene.sortOrder ?? 0,
        isActive: scene.isActive ?? true,
      },
      create: {
        id: scene.id,
        name: scene.name,
        category: scene.category,
        keywords: scene.keywords,
        prompt: scene.prompt,
        description: scene.description ?? null,
        sortOrder: scene.sortOrder ?? 0,
        isActive: scene.isActive ?? true,
      },
    });
  }
  console.log(`  ✅ Scenes: ${scenes.length} seeded`);

  console.log('\n🎉 Seed completed successfully!');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
