/**
 * Galaxy Cosmos — 类型定义
 * 所有 Galaxy 子组件共享的类型
 */

import type { Prompt } from '../../data/prompts';

// ─── 星图布局 ────────────────────────────────────────────

/** 3D 空间中一颗 Prompt 星的位置和属性 */
export interface PromptStarData {
  /** Prompt 原始数据 */
  prompt: Prompt;
  /** 3D 位置 [x, y, z] */
  position: [number, number, number];
  /** 视觉半径（基于热度） */
  radius: number;
  /** 分类颜色（hex） */
  color: string;
  /** 分类 ID */
  category: string;
  /** 闪烁偏移（随机） */
  twinkleOffset: number;
  /** 浮动偏移（随机） */
  floatOffset: number;
  /** 在全局星数组中的索引 */
  index: number;
}

/** 分类星团数据 */
export interface CategoryCluster {
  /** 分类 ID */
  id: string;
  /** 分类名称 */
  label: string;
  /** 分类颜色 */
  color: string;
  /** 暗色模式颜色 */
  darkColor: string;
  /** Emoji */
  emoji: string;
  /** 旋臂中心参考点（第一颗星附近） */
  center: [number, number, number];
  /** 该分类下的所有 Prompt 星 */
  stars: PromptStarData[];
}

// ─── 悬停信息 ─────────────────────────────────────────────

/** Hover 回调传递的信息 */
export interface HoverInfo {
  star: PromptStarData;
  screenX: number;
  screenY: number;
}

// ─── 相机状态 ────────────────────────────────────────────

/** 相机控制状态 */
export interface CameraState {
  /** 相机观察目标 */
  target: [number, number, number];
  /** 相机距离 */
  distance: number;
}

// ─── 入场动画 ────────────────────────────────────────────

/** 入场动画阶段 */
export type WarpPhase =
  | 'idle' // 等待开始
  | 'warp' // 跃迁隧道
  | 'decelerate' // 减速着陆
  | 'reveal' // 星系绽放显现
  | 'complete'; // 动画完成，进入交互

// ─── 展示模式 ────────────────────────────────────────────

/** 主展示模式（5 种完全不同的视觉范式） */
export type DisplayMode = 'galaxy' | 'ocean' | 'planet' | 'universe' | 'matrix';

// ─── 相机信息（MiniMap 用） ──────────────────────────────

/** 相机实时信息（通过 ref 共享，避免 setState 每帧触发） */
export interface CameraInfo {
  theta: number;
  phi: number;
  distance: number;
  target: { x: number; y: number; z: number };
}

// ─── 搜索 ─────────────────────────────────────────────────

/** 搜索状态 */
export interface SearchState {
  /** 搜索关键词 */
  query: string;
  /** 是否打开搜索面板 */
  isOpen: boolean;
  /** 匹配的 Prompt ID 集合 */
  matchedIds: Set<string>;
}

// ─── 常量 ──────────────────────────────────────────────────

/** 虚拟世界参数 — 螺旋星系 */
export const COSMOS_CONFIG = {
  // ── 螺旋布局参数 ──
  /** 星系总半径 */
  GALAXY_RADIUS: 28,
  /** 旋臂核心半径（最内侧起始距离） */
  ARM_CORE_RADIUS: 3,
  /** 旋臂圈数（θ 旋转圈数） */
  ARM_WINDS: 1.3,
  /** 旋臂垂直散布（Y 轴） */
  ARM_Y_SCATTER: 0.6,
  /** 旋臂横向散布 */
  ARM_SCATTER: 2.0,

  // ── 星体参数 ──
  /** 星的最小渲染大小 */
  STAR_MIN_SIZE: 6,
  /** 星的最大渲染大小 */
  STAR_MAX_SIZE: 16,
  /** 星云精灵大小 */
  NEBULA_SIZE: 10,

  // ── 粒子 ──
  /** 背景星数量 */
  BG_STAR_COUNT: 1500,
  /** 背景星分布范围 */
  BG_STAR_RANGE: 90,
  /** 旋臂尘埃粒子数 */
  DUST_COUNT: 800,

  // ── 相机 ──
  /** 初始相机距离 */
  INITIAL_DISTANCE: 45,
  /** 最小缩放距离 */
  MIN_DISTANCE: 6,
  /** 最大缩放距离 */
  MAX_DISTANCE: 70,
  /** 飞跃动画时长 (ms) */
  FLY_TO_DURATION: 1500,
  /** 自动旋转速度 (rad/s) */
  AUTO_ROTATE_SPEED: 0.03,

  // ── 后处理 ──
  /** Bloom 强度 */
  BLOOM_INTENSITY: 1.8,
  /** Bloom 阈值 */
  BLOOM_THRESHOLD: 0.2,
} as const;
