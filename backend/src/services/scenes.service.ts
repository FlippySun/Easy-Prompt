/**
 * Scenes 服务 — 场景查询 + core/scenes.js 导入
 * 2026-04-08 新增 — P1.34
 * 2026-04-08 增强 — P2.07：增加 core/scenes.js 内存缓存、搜索、同步
 * 设计思路：
 *   1. DB 优先：listScenes / getSceneById 从 Prisma 读取
 *   2. core 兜底：getCoreScenes() 从 core/scenes.js 加载并缓存，
 *      供 DB 未初始化或 seed 场景时使用
 *   3. syncCoreToDB()：将 core 场景同步到 DB（upsert），供 seed/cron 调用
 *   4. searchScenes()：关键词搜索（name + keywords + description）
 * 参数：各方法见下方签名
 * 影响范围：scenes 路由、AI gateway、seed 脚本、cron 同步
 * 潜在风险：core/scenes.js 为 CommonJS，需 require() 导入
 */

import path from 'path';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/errors';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('scenes');

// ── core/scenes.js 内存缓存 ──────────────────────────

interface CoreScene {
  name: string;
  nameEn?: string;
  keywords: string[];
  description?: string;
  painPoint?: string;
  prompt: string;
  example?: { before: string; after: string };
}

/** core/scenes.js 全量缓存（懒加载，进程生命期内不失效） */
let _coreCache: Map<string, CoreScene> | null = null;

/**
 * 从 core/scenes.js 加载场景到内存（仅首次加载，后续读缓存）
 * 返回 Map<sceneId, CoreScene>
 */
// 2026-04-13 修复 — 兼容本地开发与生产部署的 core/scenes.js 路径
// 变更类型：修复
// 功能描述：使用多路径探测策略加载 core/scenes.js，解决生产环境路径错位导致场景全部 fallback 到 optimize 的问题
// 设计思路：
//   本地开发：__dirname = backend/dist/services/ → ../../../core/scenes.js = 项目根/core/scenes.js ✅
//   生产部署：__dirname = api.zhiz.chat/dist/services/ → ../../../core/scenes.js = /www/wwwroot/core/scenes.js ❌
//   实际文件在 api.zhiz.chat/core/scenes.js，需要 ../../core/scenes.js（2 级而非 3 级）
//   解决方案：按优先级尝试多个候选路径，第一个成功即止
// 影响范围：getCoreScenes() → scene-router.service.ts 路由 + 生成 prompt
// 潜在风险：无已知风险（失败仍回退到空 Map，与原行为一致）
export function getCoreScenes(): Map<string, CoreScene> {
  if (_coreCache) return _coreCache;

  // 候选路径：本地开发（3 级）→ 生产部署（2 级）→ process.cwd() 兜底
  const candidates = [
    path.resolve(__dirname, '../../../core/scenes.js'),
    path.resolve(__dirname, '../../core/scenes.js'),
    path.resolve(process.cwd(), 'core/scenes.js'),
  ];

  for (const corePath of candidates) {
    try {
      // core/scenes.js 是 CommonJS，使用 require 同步导入（缓存模式需同步）
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { SCENES } = require(corePath) as { SCENES: Record<string, CoreScene> };

      _coreCache = new Map(Object.entries(SCENES));
      log.info({ count: _coreCache.size, path: corePath }, 'Core scenes loaded into memory cache');
      return _coreCache;
    } catch {
      // 此路径不可用，尝试下一个
      continue;
    }
  }

  log.error(
    { candidates },
    'Failed to load core/scenes.js from all candidate paths — returning empty map',
  );
  _coreCache = new Map();
  return _coreCache;
}

/**
 * 清除内存缓存（测试用或热更新场景）
 */
export function clearCoreCache(): void {
  _coreCache = null;
}

// ── DB 查询（Phase 1 原有） ──────────────────────────

/**
 * 列出场景（支持按分类/活跃状态筛选）
 */
export async function listScenes(opts?: { category?: string; isActive?: boolean }) {
  const where: Record<string, unknown> = {};
  if (opts?.category) where.category = opts.category;
  if (opts?.isActive !== undefined) where.isActive = opts.isActive;
  else where.isActive = true; // 默认只返回活跃场景

  return prisma.scene.findMany({
    where,
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  });
}

/**
 * 根据 ID 获取场景详情
 */
export async function getSceneById(id: string) {
  const scene = await prisma.scene.findUnique({ where: { id } });
  if (!scene) {
    throw new AppError('RESOURCE_NOT_FOUND', 'Scene not found');
  }
  return scene;
}

// ── P6.04 新增：按分类分组 + i18n ─────────────────────

/**
 * 2026-04-09 新增 — P6.04 场景数据统一服务
 * 按分类分组返回场景列表，支持 i18n（nameEn 字段）
 * 设计思路：一次查询所有活跃场景，在内存中按 category 分组
 *   比多次查询性能更好（场景总量 < 200）
 * @param locale - 语言标识（'en' 时优先返回 nameEn）
 * @returns Record<category, Scene[]>
 */
export async function listScenesByCategory(locale?: string) {
  const scenes = await prisma.scene.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  });

  const grouped: Record<string, typeof scenes> = {};
  for (const scene of scenes) {
    const cat = scene.category || 'uncategorized';
    if (!grouped[cat]) grouped[cat] = [];
    // 2026-04-09 — P6.04 i18n：locale='en' 时用 nameEn 覆盖 name
    if (locale === 'en' && scene.nameEn) {
      grouped[cat].push({ ...scene, name: scene.nameEn });
    } else {
      grouped[cat].push(scene);
    }
  }

  return grouped;
}

// ── P2.07 新增：搜索 ─────────────────────────────────

/**
 * 在 DB 场景中搜索关键词（name / keywords / description 模糊匹配）
 */
export async function searchScenes(keyword: string, limit = 20) {
  const pattern = `%${keyword}%`;
  return prisma.scene.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: keyword, mode: 'insensitive' } },
        { keywords: { contains: pattern, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ],
    },
    take: limit,
    orderBy: [{ sortOrder: 'asc' }],
  });
}

// ── P2.07 新增：core → DB 同步 ───────────────────────

/**
 * 将 core/scenes.js 的场景数据 upsert 到 DB
 * 用于 prisma/seed.ts 初始化或 cron 定期同步
 * @returns 同步的场景数量
 */
export async function syncCoreToDB(): Promise<number> {
  const coreScenes = getCoreScenes();
  let synced = 0;

  for (const [id, scene] of coreScenes) {
    await prisma.scene.upsert({
      where: { id },
      create: {
        id,
        name: scene.name,
        // 2026-04-09 — P6.04：同步 nameEn（i18n 英文场景名）
        nameEn: scene.nameEn ?? null,
        category: 'uncategorized', // seed 脚本可按规则映射分类
        keywords: scene.keywords.join(','),
        prompt: scene.prompt,
        description: scene.description ?? null,
        sortOrder: synced,
        isActive: true,
      },
      update: {
        name: scene.name,
        // 2026-04-09 — P6.04：同步 nameEn（i18n 英文场景名）
        nameEn: scene.nameEn ?? null,
        keywords: scene.keywords.join(','),
        prompt: scene.prompt,
        description: scene.description ?? null,
      },
    });
    synced++;
  }

  log.info({ synced }, 'Core scenes synced to DB');
  return synced;
}
