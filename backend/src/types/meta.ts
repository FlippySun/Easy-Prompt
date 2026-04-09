/**
 * Meta 相关类型（分类 & 模型配置）
 * 2026-04-07 新增 — P1.06
 */

export interface CategoryMeta {
  slug: string;
  label: string;
  labelEn: string | null;
  emoji: string | null;
  icon: string | null;
  color: string | null;
  bgColor: string | null;
  darkBgColor: string | null;
  darkColor: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ModelMeta {
  slug: string;
  label: string;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
}
