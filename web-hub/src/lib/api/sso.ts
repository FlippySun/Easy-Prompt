/**
 * SSO redirect 共享函数 — 登录/注册成功后为客户端生成授权码并跳转
 * 2026-04-15 修复 — SSO redirect 白名单失败错误归因
 * 变更类型：修复/前端
 * 功能描述：在登录/注册/Zhiz complete 成功后，若 `/api/v1/auth/sso/authorize` 因 redirectUri 白名单失败被拒绝，向 UI 抛出精确的 SSO 配置错误而非泛化输入错误。
 * 设计思路：
 *   1. 调用前 setTokens() 必须已完成（authApi.login/register 内部自动处理）
 *   2. 使用已认证的 post() 调 /api/v1/auth/sso/authorize 获取一次性 code
 *   3. 拼接 redirectUri + code + state（兼容已有 query string）
 *   4. 执行 window.location.href 跳转
 *   5. 仅在后端返回 `VALIDATION_FAILED + details.redirectUri` 时重写错误，避免污染普通表单校验语义
 * 参数与返回值：`handleSsoRedirect(redirectUri, state)` 成功时执行浏览器跳转，无同步返回值；失败时抛出 `ApiError`。
 * 影响范围：LoginPage、RegisterPage、ZhizCompletePage 的 SSO 跳转逻辑。
 * 潜在风险：若后端未来更换 `details.redirectUri` 字段名，该特判会失效并回退到原始错误。
 */

import { post } from './client';
import { ApiError, type ApiSuccessResponse } from './types';

interface SsoRedirectValidationDetails {
  redirectUri?: string;
}

function normalizeSsoAuthorizeError(error: unknown): never {
  if (
    error instanceof ApiError &&
    error.code === 'VALIDATION_FAILED' &&
    error.details &&
    typeof error.details === 'object' &&
    typeof (error.details as SsoRedirectValidationDetails).redirectUri === 'string'
  ) {
    throw new ApiError(
      'AUTH_SSO_REDIRECT_URI_NOT_ALLOWED',
      'SSO 回调地址未被允许，请联系管理员检查客户端 redirect_uri 配置',
      error.status,
      error.details,
    );
  }

  throw error;
}

/**
 * 为已登录用户生成 SSO 授权码，然后 redirect 到客户端回调地址
 *
 * @param redirectUri 客户端提供的回调 URI（已通过后端白名单校验）
 * @param state       客户端生成的 CSRF 防护随机值（原样回传）
 * @throws ApiError   当 /sso/authorize 调用失败时（如 redirect_uri 不在白名单）
 */
export async function handleSsoRedirect(redirectUri: string, state: string): Promise<void> {
  try {
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
  } catch (error) {
    normalizeSsoAuthorizeError(error);
  }
}
