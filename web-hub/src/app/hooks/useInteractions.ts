/**
 * useInteractions Hook — Prompt 交互操作（Like/Save/Copy/View）API 集成
 * 2026-04-09 新增 — P5.09 交互操作集成
 * 变更类型：新增
 * 设计思路：
 *   1. 包装 usePromptStore 的本地操作 + 后端 API 同步
 *   2. 乐观更新：先更新本地状态，再调 API；API 失败则回滚
 *   3. 未登录用户点击交互 → 返回 needsLogin 状态，由 UI 层决定跳转
 *   4. 防抖：同一 promptId 300ms 内重复操作合并
 *   5. view 操作仅静默调 API，不阻塞也不回滚
 * 参数：无
 * 返回：交互方法 + 状态查询
 * 影响范围：PromptCard / PromptDetailDrawer / 所有交互组件
 * 潜在风险：乐观更新与服务端状态不一致（由 refresh 解决）
 */

import { useCallback, useRef } from 'react';
import { promptApi, collectionApi } from '@/lib/api';
import { useAuth } from './useAuth';
import { usePromptStore } from './usePromptStore';

// ── 防抖工具 ─────────────────────────────────────────────

/** 防抖 Map：key → timeout ID */
type DebounceMap = Map<string, ReturnType<typeof setTimeout>>;

function debounced(map: DebounceMap, key: string, fn: () => void, ms: number = 300) {
  const existing = map.get(key);
  if (existing) clearTimeout(existing);
  map.set(
    key,
    setTimeout(() => {
      map.delete(key);
      fn();
    }, ms),
  );
}

// ── Hook ─────────────────────────────────────────────────

export interface UseInteractionsReturn {
  /** 切换点赞（乐观更新 + API 同步） */
  toggleLike: (promptId: string) => { needsLogin: boolean };
  /** 切换收藏（乐观更新 + API 同步） */
  toggleSave: (promptId: string) => { needsLogin: boolean };
  /** 记录复制（本地 + API 静默记录） */
  recordCopy: (promptId: string) => void;
  /** 记录浏览（本地 + API 静默记录） */
  recordView: (promptId: string) => void;
  /** 切换合集收藏 */
  toggleCollectionSave: (collectionId: string) => { needsLogin: boolean };
  /** 查询状态 */
  isLiked: (id: string) => boolean;
  isSaved: (id: string) => boolean;
  isCollectionSaved: (id: string) => boolean;
}

export function useInteractions(): UseInteractionsReturn {
  const { isAuthenticated } = useAuth();
  const store = usePromptStore();
  const debounceMapRef = useRef<DebounceMap>(new Map());

  // ── toggleLike ──
  const toggleLike = useCallback(
    (promptId: string): { needsLogin: boolean } => {
      if (!isAuthenticated) return { needsLogin: true };

      // 乐观更新本地
      store.toggleLike(promptId);

      // 防抖 API 调用
      debounced(debounceMapRef.current, `like:${promptId}`, async () => {
        try {
          await promptApi.toggleLike(promptId);
        } catch {
          // API 失败 → 回滚本地状态
          store.toggleLike(promptId);
        }
      });

      return { needsLogin: false };
    },
    [isAuthenticated, store],
  );

  // ── toggleSave ──
  const toggleSave = useCallback(
    (promptId: string): { needsLogin: boolean } => {
      if (!isAuthenticated) return { needsLogin: true };

      store.toggleSave(promptId);

      debounced(debounceMapRef.current, `save:${promptId}`, async () => {
        try {
          await promptApi.toggleSave(promptId);
        } catch {
          store.toggleSave(promptId);
        }
      });

      return { needsLogin: false };
    },
    [isAuthenticated, store],
  );

  // ── recordCopy（无需登录，但登录后同步到 API） ──
  const recordCopy = useCallback(
    (promptId: string) => {
      store.recordCopy(promptId);

      if (isAuthenticated) {
        // 静默记录，不回滚
        promptApi.recordCopy(promptId).catch(() => {
          /* 忽略：复制操作已在前端完成 */
        });
      }
    },
    [isAuthenticated, store],
  );

  // ── recordView（无需登录，静默记录） ──
  const recordView = useCallback(
    (promptId: string) => {
      store.recordView(promptId);

      if (isAuthenticated) {
        promptApi.recordView(promptId).catch(() => {
          /* 忽略：浏览记录丢失不影响用户体验 */
        });
      }
    },
    [isAuthenticated, store],
  );

  // ── toggleCollectionSave ──
  const toggleCollectionSave = useCallback(
    (collectionId: string): { needsLogin: boolean } => {
      if (!isAuthenticated) return { needsLogin: true };

      store.toggleCollectionSave(collectionId);

      debounced(debounceMapRef.current, `col-save:${collectionId}`, async () => {
        try {
          await collectionApi.toggleSave(collectionId);
        } catch {
          store.toggleCollectionSave(collectionId);
        }
      });

      return { needsLogin: false };
    },
    [isAuthenticated, store],
  );

  return {
    toggleLike,
    toggleSave,
    recordCopy,
    recordView,
    toggleCollectionSave,
    isLiked: store.isLiked,
    isSaved: store.isSaved,
    isCollectionSaved: store.isCollectionSaved,
  };
}
