/**
 * Prompt 相关类型
 * 2026-04-07 新增 — P1.06
 */

export type PromptStatus = 'draft' | 'pending' | 'published' | 'rejected';

export interface Prompt {
  id: string;
  title: string;
  description: string | null;
  content: string;
  tags: string[];
  category: string;
  model: string | null;
  authorId: string;
  status: PromptStatus;
  likesCount: number;
  viewsCount: number;
  copiesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 列表页用的精简版 */
export interface PromptSummary {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  category: string;
  model: string | null;
  author: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  likesCount: number;
  viewsCount: number;
  copiesCount: number;
  createdAt: string;
}

/** 详情页完整版（含是否已点赞/收藏） */
export interface PromptDetail extends PromptSummary {
  content: string;
  status: PromptStatus;
  isLiked?: boolean;
  isSaved?: boolean;
  myCopyCount?: number;
  updatedAt: string;
}
