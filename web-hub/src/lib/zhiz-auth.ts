/**
 * Zhiz OAuth 前端链接工具
 * 2026-04-22 新增 — Zhiz 绑定专区与统一 start URL builder
 * 变更类型：新增/前端/重构
 * 功能描述：集中封装 Zhiz OAuth 起始地址与绑定完成后的 postBindTarget 跳转规则，供 login/profile/complete 共用，避免多页各自手写 query 拼装后发生漂移。
 * 设计思路：
 *   1. start URL 统一落到 backend `/api/v1/auth/oauth/zhiz`，仅由 builder 负责附加 `clientRedirectUri/clientState/webReturnTo/postBindTarget`。
 *   2. `postBindTarget=skills-manager` 先映射到 Prompt Web 主应用入口，由 complete 页在“无 outer SSO”时消费。
 *   3. 所有 query 值都做 trim + 空值过滤，避免把空字符串写入 URL 污染后端状态。
 * 参数与返回值：`buildZhizStartUrl(options)` 返回完整 Zhiz OAuth 起始 URL；`resolveZhizPostBindUrl(target)` 返回绑定完成后的前端落点或 null。
 * 影响范围：LoginPage、Profile Zhiz 绑定专区、ZhizCompletePage。
 * 潜在风险：若后端新增新的 postBindTarget，需要同步扩展 `resolveZhizPostBindUrl()` 映射表。
 */

import { BACKEND_API_BASE, WEB_HUB_BASE_URL, ZHIZ_SKILLS_MANAGER_URL } from './env';
import type { ZhizPostBindTarget } from './api/types';

export interface BuildZhizStartUrlOptions {
  clientRedirectUri?: string;
  clientState?: string;
  webReturnTo?: string;
  postBindTarget?: ZhizPostBindTarget | null;
}

function appendOptionalSearchParam(url: URL, key: string, value: string | null | undefined): void {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  if (normalizedValue) {
    url.searchParams.set(key, normalizedValue);
  }
}

export function buildZhizStartUrl(options: BuildZhizStartUrlOptions = {}): string {
  const url = new URL('/api/v1/auth/oauth/zhiz', BACKEND_API_BASE);
  appendOptionalSearchParam(url, 'clientRedirectUri', options.clientRedirectUri);
  appendOptionalSearchParam(url, 'clientState', options.clientState);
  appendOptionalSearchParam(url, 'webReturnTo', options.webReturnTo);
  appendOptionalSearchParam(url, 'postBindTarget', options.postBindTarget ?? undefined);
  return url.toString();
}

/**
 * 2026-04-22 新增 — PromptHub Zhiz 绑定专区深链构造
 * 变更类型：新增/前端/路由辅助
 * 功能描述：构造 Web-Hub 内用于聚焦 Zhiz OAuth 授权专区的个人页深链，并透传可选的 postBindTarget。
 * 设计思路：让 LoginPage 与外部客户端都复用同一条 `/profile?connect=zhiz...#zhiz-oauth` 规则，避免各处继续手写 query/hash 造成跳转漂移。
 * 参数与返回值：`buildZhizBindingProfileUrl(postBindTarget)` 接收可选 target，返回完整 PromptHub URL。
 * 影响范围：LoginPage 登录成功后的绑定续接、外部客户端跳入 PromptHub 绑定专区。
 * 潜在风险：若个人页锚点命名变更，需要同步更新该 helper 与客户端深链。
 */
export function buildZhizBindingProfileUrl(postBindTarget: ZhizPostBindTarget | null = null): string {
  const url = new URL('/profile', WEB_HUB_BASE_URL);
  url.searchParams.set('connect', 'zhiz');
  appendOptionalSearchParam(url, 'postBindTarget', postBindTarget ?? undefined);
  url.hash = 'zhiz-oauth';
  return url.toString();
}

export function resolveZhizPostBindUrl(target: string | null | undefined): string | null {
  if (target === 'skills-manager') {
    return ZHIZ_SKILLS_MANAGER_URL;
  }
  return null;
}
