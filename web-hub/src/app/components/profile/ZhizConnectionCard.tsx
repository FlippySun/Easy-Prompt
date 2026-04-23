/**
 * ZhizConnectionCard — Profile 页 Zhiz 绑定专区
 * 2026-04-22 新增 — Zhiz 绑定专区落地
 * 变更类型：新增/前端/交互
 * 功能描述：在 Profile 页面展示当前账号的 Zhiz 绑定状态、绑定入口与 Skills Manager 跳转入口，让用户可以在个人主页内完成查看与继续绑定。
 * 设计思路：
 *   1. 卡片内部直接消费 `useZhizLinkStatus()`，把状态读取、错误兜底与刷新入口收敛到专区组件，不污染 Profile 主页面统计逻辑。
 *   2. 未登录、已绑定、未绑定三种状态分别提供最小必要 CTA：登录、前往 Skills Manager、发起 Zhiz 绑定。
 *   3. 绑定按钮统一通过 `buildZhizStartUrl({ postBindTarget: 'skills-manager' })` 生成，保证与登录页使用同一 query 契约。
 * 参数与返回值：组件接收 `darkMode` 控制明暗样式；无返回值（React 节点）。
 * 影响范围：`/profile` 页面 Zhiz 绑定专区、Zhiz OAuth 起始入口。
 * 潜在风险：当前“Skills Manager”仍映射到 Prompt Web 主应用入口；若后续出现专属路由，应调整 `resolveZhizPostBindUrl()`。
 */

import { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router';
import { AlertCircle, Link2, Loader2, RefreshCcw, Rocket, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useZhizLinkStatus } from '../../hooks/useZhizLinkStatus';
import { buildZhizStartUrl, resolveZhizPostBindUrl } from '@/lib/zhiz-auth';

interface ZhizConnectionCardProps {
  darkMode: boolean;
}

export function ZhizConnectionCard({ darkMode }: ZhizConnectionCardProps) {
  const { isAuthenticated } = useAuth();
  const { status, phase, loading, error, refresh } = useZhizLinkStatus();
  const location = useLocation();
  const sectionRef = useRef<HTMLElement | null>(null);

  const bindZhizUrl = useMemo(() => {
    const fallbackReturnTo =
      typeof window === 'undefined'
        ? '/profile'
        : `${window.location.pathname}${window.location.search}${window.location.hash}`;

    // 2026-04-22 新增 — Profile 绑定入口统一附带 skills-manager 目标
    // 变更类型：新增/交互
    // 功能描述：让 Profile 发起的 Zhiz OAuth 在无 outer SSO 时优先回到 Skills Manager，同时保留当前 Profile 作为后端 `webReturnTo` 兜底。
    // 设计思路：`postBindTarget` 负责“成功后去哪”，`webReturnTo` 负责“目标无法识别时回哪”；两者分层，避免把回跳语义混在同一个 query 上。
    // 参数与返回值：无新增组件参数；返回完整 Zhiz start URL 字符串。
    // 影响范围：Profile Zhiz 绑定按钮、ZhizCompletePage 完成跳转。
    // 潜在风险：若当前页面未来不再是 /profile，fallbackReturnTo 会跟随浏览器地址变化；这是预期行为。
    return buildZhizStartUrl({
      webReturnTo: fallbackReturnTo,
      postBindTarget: 'skills-manager',
    });
  }, []);

  const skillsManagerUrl = resolveZhizPostBindUrl('skills-manager') ?? '/';
  const shouldFocusBindingSection = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('connect') === 'zhiz' || location.hash === '#zhiz-oauth';
  }, [location.hash, location.search]);
  const cardClass = `rounded-2xl border p-5 ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200/80 bg-white'}`;
  const isLinked = phase === 'ready' && Boolean(status?.linked);
  const badgeClass =
    phase === 'error'
      ? darkMode
        ? 'bg-amber-500/15 text-amber-200'
        : 'bg-amber-50 text-amber-700'
      : isLinked
        ? darkMode
          ? 'bg-green-500/15 text-green-300'
          : 'bg-green-50 text-green-700'
        : darkMode
          ? 'bg-slate-500/15 text-slate-200'
          : 'bg-slate-100 text-slate-700';
  const badgeLabel = phase === 'error' ? '待重试' : isLinked ? '已绑定' : isAuthenticated ? '待确认' : '待登录';

  useEffect(() => {
    if (!shouldFocusBindingSection || !sectionRef.current) {
      return;
    }

    /**
     * 2026-04-22 修复 — Profile 深链真正聚焦 Zhiz 绑定专区
     * 变更类型：修复
     * 功能描述：当页面通过 `?connect=zhiz` 或 `#zhiz-oauth` 打开时，把视口滚动到 Zhiz 绑定卡片并设置键盘焦点，补齐原计划里的“前往绑定专区”体验。
     * 设计思路：聚焦逻辑收口在专区组件内部，只消费当前路由信息，不把 hash/connect 解析散落到 Profile 主页面；同时保留平滑滚动，便于用户感知“已带到目标区域”。
     * 参数与返回值：无新增组件参数；副作用仅在命中 Zhiz 深链时执行 `scrollIntoView + focus`。
     * 影响范围：Profile 页面从 slash 编辑入口/登录成功回跳后的定位体验。
     * 风险：若未来 Profile 页面布局大改，滚动位置可能需要微调；当前无已知功能风险。
     */
    const frameId = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      sectionRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [shouldFocusBindingSection]);

  return (
    <section
      ref={sectionRef}
      id="zhiz-oauth"
      tabIndex={-1}
      className={`${cardClass} ${shouldFocusBindingSection ? (darkMode ? 'ring-2 ring-indigo-400/60 ring-offset-2 ring-offset-gray-950' : 'ring-2 ring-indigo-500/50 ring-offset-2 ring-offset-white') : ''}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${darkMode ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}
          >
            {isLinked ? <ShieldCheck size={20} /> : phase === 'error' ? <AlertCircle size={20} /> : <Link2 size={20} />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Zhiz 绑定专区</h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass}`}>{badgeLabel}</span>
            </div>
            <p className={`mt-1 text-sm leading-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              绑定 Zhiz 后，可直接回到 Skills Manager 继续使用真实技能数据与后续联动能力。
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={!isAuthenticated || loading}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-sm transition-colors ${darkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          刷新状态
        </button>
      </div>

      <div
        className={`mt-4 rounded-2xl border p-4 ${darkMode ? 'border-gray-800 bg-gray-950/50' : 'border-gray-100 bg-gray-50/80'}`}
      >
        {!isAuthenticated ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={`text-sm font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                登录后即可查看绑定状态
              </p>
              <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                当前需要先登录 Easy Prompt 账号，才能读取 Zhiz link-status 并发起绑定。
              </p>
            </div>
            <a
              href="/auth/login?postBindTarget=skills-manager"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 to-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-600 hover:to-purple-700"
            >
              <Rocket className="h-4 w-4" />
              去登录
            </a>
          </div>
        ) : loading && !status ? (
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在读取 Zhiz 绑定状态...
          </div>
        ) : phase === 'error' ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={`text-sm font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                暂时无法确认当前账号的 Zhiz 绑定状态
              </p>
              <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                当前不会把失败误判成“未绑定”。请先刷新状态；若仍失败，再检查登录状态或稍后重试。
              </p>
              {error && <p className="mt-1 text-xs text-amber-400">状态读取失败：{error}</p>}
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 to-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-600 hover:to-purple-700"
            >
              <RefreshCcw className="h-4 w-4" />
              重新读取状态
            </button>
          </div>
        ) : isLinked ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className={`text-sm font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                {status?.displayName || 'Zhiz 账号已连接'}
              </p>
              <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                当前 Zhiz 身份已可用于后续 Skills Manager 场景。
              </p>
              {error && <p className="mt-1 text-xs text-amber-400">状态刷新失败：{error}</p>}
            </div>
            <a
              href={skillsManagerUrl}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 to-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-600 hover:to-purple-700"
            >
              <Rocket className="h-4 w-4" />
              前往 Skills Manager
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={`text-sm font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                当前账号尚未绑定 Zhiz
              </p>
              <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                立即发起 Zhiz OAuth，完成后会优先跳回 Skills Manager；若目标不可用，则回到当前 Profile 页面。
              </p>
              {error && <p className="mt-1 text-xs text-amber-400">状态读取失败：{error}</p>}
            </div>
            <a
              href={bindZhizUrl}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 to-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-600 hover:to-purple-700"
            >
              <Link2 className="h-4 w-4" />
              绑定 Zhiz
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
