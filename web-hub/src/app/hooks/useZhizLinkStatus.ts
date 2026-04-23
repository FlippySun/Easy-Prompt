/**
 * useZhizLinkStatus Hook — 读取当前登录用户的 Zhiz 绑定状态
 * 2026-04-22 新增 — Zhiz 绑定专区状态消费
 * 变更类型：新增/前端
 * 功能描述：封装 `/api/v1/auth/oauth/zhiz/link-status` 的加载、错误处理与响应归一化，供 Profile Zhiz 绑定专区稳定消费。
 * 设计思路：
 *   1. 仅在已登录时发起请求，未登录直接返回空态，避免 Profile 公开访问时制造无意义 401。
 *   2. 继续把后端显式契约归一化成页面直接可消费的展示态，避免 Profile 组件继续感知 API 字段结构。
 *   3. 复用版本号守卫，避免快速切换登录态时旧请求回写覆盖新状态。
 * 参数与返回值：`useZhizLinkStatus()` 返回 `{ status, loading, error, refresh }`；其中 `status` 为归一化后的展示态对象。
 * 影响范围：Profile Zhiz 绑定专区。
 * 潜在风险：若后端 future schema 引入新的字段别名，需同步更新 `normalizeZhizLinkStatus()`。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, authApi, type ZhizLinkStatusResult } from '@/lib/api';
import { useAuth } from './useAuth';

export interface NormalizedZhizLinkStatus {
  linked: boolean;
  displayName: string | null;
  avatarUrl: string | null;
}

export type ZhizLinkStatusPhase = 'signed_out' | 'loading' | 'ready' | 'error';

export interface UseZhizLinkStatusReturn {
  status: NormalizedZhizLinkStatus | null;
  phase: ZhizLinkStatusPhase;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function normalizeZhizLinkStatus(result: ZhizLinkStatusResult): NormalizedZhizLinkStatus {
  return {
    linked: result.linked,
    displayName: result.profile.displayName,
    avatarUrl: result.profile.avatarUrl,
  };
}

export function useZhizLinkStatus(): UseZhizLinkStatusReturn {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<NormalizedZhizLinkStatus | null>(null);
  const [phase, setPhase] = useState<ZhizLinkStatusPhase>('signed_out');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const versionRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setStatus(null);
      setPhase('signed_out');
      setError(null);
      setLoading(false);
      return;
    }

    const version = ++versionRef.current;
    setLoading(true);
    setPhase('loading');
    setError(null);

    try {
      const result = await authApi.zhizLinkStatus();
      if (version !== versionRef.current) {
        return;
      }

      /**
       * 2026-04-22 修复 — Zhiz link-status 错误态与未绑定态拆分
       * 变更类型：修复
       * 功能描述：当 `/zhiz/link-status` 成功返回时，显式标记当前读取结果为 ready，确保上层组件只会在“真实拿到状态”后才渲染已绑定/未绑定分支。
       * 设计思路：把 `status` 数据本身与 `phase` 生命周期拆开，避免 future error 时仅凭 `status=null` 被误判成“未绑定”。
       * 参数与返回值：无新增入参；成功时同步写入 `status` 与 `phase='ready'`。
       * 影响范围：Profile 的 ZhizConnectionCard 状态分支。
       * 风险：若未来增加更多中间态，需要同步扩展 `ZhizLinkStatusPhase` 枚举；当前无已知风险。
       */
      setStatus(normalizeZhizLinkStatus(result));
      setPhase('ready');
    } catch (err) {
      if (version !== versionRef.current) {
        return;
      }

      /**
       * 2026-04-22 修复 — Zhiz link-status 失败保持 unknown/error 态
       * 变更类型：修复
       * 功能描述：请求失败时不再把 `status=null` 交给上层自由解释，而是显式标记 `phase='error'`，让 UI 呈现“状态暂不可确认”而不是“未绑定”。
       * 设计思路：本次需求把 `/zhiz/link-status` 作为绑定状态真相来源，因此错误只能表现为 unknown，不允许静默退化成 unlinked。
       * 参数与返回值：无新增入参；失败时写入 `status=null`、`phase='error'` 与用户可见错误信息。
       * 影响范围：Profile 的 ZhizConnectionCard 错误态分支。
       * 风险：No known risks.
       */
      setStatus(null);
      setPhase('error');
      setError(err instanceof ApiError ? err.message : '读取 Zhiz 绑定状态失败');
    } finally {
      if (version === versionRef.current) {
        setLoading(false);
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, phase, loading, error, refresh };
}
