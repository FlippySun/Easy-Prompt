/**
 * SSO redirect 共享函数 — 登录/注册成功后为客户端生成授权码并跳转
 * 2026-04-10 新增 — SSO Plan v2 A2
 * 变更类型：新增
 * 设计思路：
 *   1. 调用前 setTokens() 必须已完成（authApi.login/register 内部自动处理）
 *   2. 使用已认证的 post() 调 /api/v1/auth/sso/authorize 获取一次性 code
 *   3. 拼接 redirectUri + code + state（兼容已有 query string）
 *   4. 执行 window.location.href 跳转
 *   5. 失败时 throw，由调用方（LoginPage/RegisterPage）负责 toast 错误
 * 参数：redirectUri — 客户端注册的回调地址；state — CSRF 防护随机值
 * 影响范围：LoginPage、RegisterPage 的 SSO 跳转逻辑
 * 潜在风险：无已知风险（code 一次性 + 5min 过期 + state 校验由客户端负责）
 */

import { post } from './client';
import type { ApiSuccessResponse } from './types';

/**
 * 为已登录用户生成 SSO 授权码，然后 redirect 到客户端回调地址
 *
 * @param redirectUri 客户端提供的回调 URI（已通过后端白名单校验）
 * @param state       客户端生成的 CSRF 防护随机值（原样回传）
 * @throws ApiError   当 /sso/authorize 调用失败时（如 redirect_uri 不在白名单）
 */
export async function handleSsoRedirect(redirectUri: string, state: string): Promise<void> {
  // 调用后端生成一次性授权码（需要 Bearer token，post() 自动附加）
  const res = await post<ApiSuccessResponse<{ code: string }>>('/api/v1/auth/sso/authorize', {
    redirectUri,
  });

  const code = res.data.code;

  // 拼接跳转 URL：兼容 redirectUri 已有 query string 的情况
  const url = new URL(redirectUri);
  url.searchParams.set('code', code);
  url.searchParams.set('state', state);

  window.location.href = url.toString();
}
