/**
 * usePromptData — 共享 Prompt 数据上下文
 * 2026-04-09 新增 — P5 页面消费层迁移
 * 变更类型：新增
 * 功能描述：在 Layout 层加载全量 Prompt 数据（API 优先 + mock 降级），
 *   通过 React Context 提供给所有子组件，避免各组件直接 import MOCK_PROMPTS。
 * 设计思路：
 *   - 单次 API 调用（pageSize: 200），全局共享
 *   - 提供 useAllPrompts() 读取全量列表
 *   - 提供 usePromptById() 按 ID 查找
 *   - 提供 useRelatedPrompts() 按分类查找相关 prompt
 * 参数：无（通过 PromptDataProvider 组件注入）
 * 返回：Prompt[]（通过 context）
 * 影响范围：所有需要 Prompt 数据的组件
 * 潜在风险：无已知风险
 */

import { createContext, useContext, useMemo } from 'react';
import type { Prompt } from '../data/prompts';

// ── Context ──────────────────────────────────────────────
const PromptDataContext = createContext<Prompt[]>([]);

/**
 * 获取全量已加载的 Prompt 列表
 * 数据源：Layout 层 usePrompts hook（API 优先 + mock 降级）
 */
export function useAllPrompts(): Prompt[] {
  return useContext(PromptDataContext);
}

/**
 * 按 ID 查找单个 Prompt
 * 用于 CompareModal 等需要按 ID 查找的场景
 */
export function usePromptById(id: string | undefined): Prompt | undefined {
  const prompts = useContext(PromptDataContext);
  return useMemo(() => (id ? prompts.find((p) => p.id === id) : undefined), [prompts, id]);
}

/**
 * 获取与指定 Prompt 同分类的相关推荐（排除自身）
 * 用于 PromptCard / PromptDetailDrawer 的 "相关推荐" 功能
 */
export function useRelatedPrompts(promptId: string, category: string, limit: number = 3): Prompt[] {
  const prompts = useContext(PromptDataContext);
  return useMemo(
    () => prompts.filter((p) => p.id !== promptId && p.category === category).slice(0, limit),
    [prompts, promptId, category, limit],
  );
}

export { PromptDataContext };
