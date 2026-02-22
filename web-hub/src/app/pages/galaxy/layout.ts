/**
 * Galaxy Cosmos — 螺旋星系布局引擎
 * 将 Prompt 数据映射为螺旋旋臂 3D 布局
 *
 * 布局策略：
 * - 每个分类占据一条螺旋旋臂
 * - 旋臂遵循对数螺旋公式 r = a + b·θ
 * - 星体沿旋臂分布，附带横向/纵向散布
 * - 星体大小由热度（likes + views）决定
 */

import { CATEGORY_CONFIG } from '../../data/constants';
import { MOCK_PROMPTS } from '../../data/prompts';
import type { PromptStarData, CategoryCluster } from './types';
import { COSMOS_CONFIG } from './types';

// ─── 确定性随机数生成器 ────────────────────────────────────

/** Mulberry32 PRNG — 相同 seed 产生相同布局 */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 高斯分布随机（Box-Muller 变换） */
function gaussianRandom(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 + 0.0001)) * Math.cos(2 * Math.PI * u2);
}

// ─── 布局计算 ──────────────────────────────────────────────

/** 计算星的渲染大小（基于热度） */
function computeStarSize(likes: number, views: number): number {
  const popularity = Math.log10(1 + likes * 2 + views * 0.1);
  const { STAR_MIN_SIZE, STAR_MAX_SIZE } = COSMOS_CONFIG;
  return STAR_MIN_SIZE + (STAR_MAX_SIZE - STAR_MIN_SIZE) * Math.min(popularity / 5, 1);
}

/** 生成螺旋星系布局 */
export function buildGalaxyLayout(): CategoryCluster[] {
  const rng = mulberry32(42);
  const categories = Object.keys(CATEGORY_CONFIG);
  const promptsByCategory: Record<string, typeof MOCK_PROMPTS> = {};

  for (const p of MOCK_PROMPTS) {
    if (!promptsByCategory[p.category]) promptsByCategory[p.category] = [];
    promptsByCategory[p.category].push(p);
  }

  const clusters: CategoryCluster[] = [];
  const armCount = categories.length;
  const armAngleStep = (Math.PI * 2) / armCount;

  let globalIndex = 0;

  for (let armIdx = 0; armIdx < armCount; armIdx++) {
    const catId = categories[armIdx];
    const config = CATEGORY_CONFIG[catId];
    const prompts = promptsByCategory[catId] || [];
    const armBaseAngle = armAngleStep * armIdx;

    const stars: PromptStarData[] = [];
    let cx = 0,
      cz = 0;

    for (let j = 0; j < prompts.length; j++) {
      const prompt = prompts[j];
      // t: 0→1 沿旋臂位置
      const t = (j + 0.5) / Math.max(prompts.length, 1);

      // 对数螺旋: r = coreR + (maxR - coreR) * t
      const armCore = COSMOS_CONFIG.ARM_CORE_RADIUS;
      const armEdge = COSMOS_CONFIG.GALAXY_RADIUS;
      const r = armCore + (armEdge - armCore) * t;

      // 旋臂角度: base + t * winds * 2π
      const theta = armBaseAngle + t * COSMOS_CONFIG.ARM_WINDS * Math.PI * 2;

      // 横向散布（高斯，越外圈越宽）
      const scatter = COSMOS_CONFIG.ARM_SCATTER * (0.5 + t * 0.5);
      const scatterX = gaussianRandom(rng) * scatter * 0.5;
      const scatterZ = gaussianRandom(rng) * scatter * 0.5;

      // Y 轴散布（越外圈越薄，模拟盘状结构）
      const yScatter = gaussianRandom(rng) * COSMOS_CONFIG.ARM_Y_SCATTER * (1 - t * 0.7);

      const px = Math.cos(theta) * r + scatterX;
      const py = yScatter;
      const pz = Math.sin(theta) * r + scatterZ;

      // 中间位置作为星团参考中心
      if (j === Math.floor(prompts.length / 2)) {
        cx = px;
        cz = pz;
      }

      stars.push({
        prompt,
        position: [px, py, pz],
        radius: computeStarSize(prompt.likes, prompt.views),
        color: config.darkColor || config.color,
        category: catId,
        twinkleOffset: rng() * Math.PI * 2,
        floatOffset: rng() * Math.PI * 2,
        index: globalIndex++,
      });
    }

    clusters.push({
      id: catId,
      label: config.label,
      color: config.color,
      darkColor: config.darkColor || config.color,
      emoji: config.emoji,
      center: [cx, 0, cz],
      stars,
    });
  }

  return clusters;
}

/** 从所有星团中获取扁平的星列表 */
export function getAllStars(clusters: CategoryCluster[]): PromptStarData[] {
  return clusters.flatMap((c) => c.stars);
}
