/**
 * Collection 相关类型
 * 2026-04-07 新增 — P1.06
 */

export interface Collection {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  gradientFrom: string | null;
  gradientTo: string | null;
  tags: string[];
  difficulty: string | null;
  estimatedTime: string | null;
  createdBy: string;
  savedCount: number;
  createdAt: Date;
}

export interface CollectionDetail extends Collection {
  prompts: { id: string; title: string; category: string }[];
  isSaved?: boolean;
}
