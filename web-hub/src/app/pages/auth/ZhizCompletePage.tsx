/**
 * Zhiz OAuth complete 页面
 * 2026-04-14 新增 — Zhiz OAuth Superpowers Execute T6+T7
 * 2026-04-15 更新 — Zhiz 首绑必验邮前端状态机
 * 变更类型：新增/前端/修复/安全
 * 功能描述：承接后端 Zhiz continuation ticket，支持 ready 自动完成登录、needs_email 补邮箱进入验邮，
 *   并同时覆盖 `verify_email` 与 `verify_email_and_set_password` 两类邮件验证码交互流程。
 * 设计思路：
 *   1. 页面启动先调 `zhizStatus(ticket)` 恢复真实状态，避免刷新后 UI 丢失。
 *   2. `ready` 状态自动调用 `zhizFinish(ticket)`，与后端 consumed ticket 语义保持一致。
 *   3. `needs_email/collect_email`、`verify_email` 与 `verify_email_and_set_password` 共用同一页状态机，避免首登流程拆页。
 *   4. 登录成功后遵循既有优先级：外层 SSO → 站内 `webReturnTo` → 首页。
 * 参数与返回值：URL query `ticket`；组件内部消费 `authApi.zhizStatus/zhizFinish/zhizPasswordSetup*`。
 * 影响范围：`/auth/zhiz/complete` 路由、Zhiz 登录完成态、Web-Hub 登录入口。
 * 潜在风险：验证码倒计时基于前端本地递减，若页面长时间挂起会在下一次 status 恢复时重新对齐后端剩余时间。
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Lock, Mail, ShieldAlert } from 'lucide-react';
import {
  ApiError,
  authApi,
  getErrorMessage,
  type ZhizContinuationStatusResult,
  type ZhizFinishRequest,
  type ZhizPasswordSetupChallengeResult,
  type ZhizVerificationMode,
} from '@/lib/api';
import { handleSsoRedirect } from '@/lib/api/sso';
import zhizLogo from '@/assets/icon/zhiz-logo.png';

interface ZhizChallengeDetails {
  maskedEmail?: string;
  resendAfterSec?: number;
  challengeExpiresInSec?: number;
  remainingAttempts?: number;
  step?: string;
  verificationMode?: ZhizVerificationMode;
  requiresNewPassword?: boolean;
}

interface ZhizValidationDetails extends ZhizChallengeDetails {
  field?: 'email' | 'password' | 'newPassword' | 'code';
  reason?: string;
  ruleText?: string;
  validationErrors?: Array<{
    target?: string;
    issues?: Array<{
      path?: string;
      message?: string;
      code?: string;
    }>;
  }>;
}

interface ZhizFieldErrors {
  email?: string;
  password?: string;
  verificationCode?: string;
  newPassword?: string;
}

const ZHIZ_PASSWORD_RULE_HINT = '至少 8 位，包含大写字母、小写字母和数字';

function extractZhizValidationDetails(error: unknown): ZhizValidationDetails {
  if (!(error instanceof ApiError) || !error.details || typeof error.details !== 'object') {
    return {};
  }
  return error.details as ZhizValidationDetails;
}

function extractZhizChallengeDetails(error: unknown): ZhizChallengeDetails {
  return extractZhizValidationDetails(error);
}

/**
 * 2026-04-15 恢复 — Zhiz complete 字段级错误映射 helper
 * 变更类型：修复/前端/重构
 * 功能描述：恢复 Zhiz complete 页面把后端 `VALIDATION_FAILED` 细节映射到具体输入框的 helper，供首次验邮与验证码完成态共用。
 * 设计思路：
 *   1. 保留字段级错误优先、顶部横幅兜底的交互策略，避免用户只能看到泛化报错。
 *   2. 继续兼容 `password_policy` 与 `validationErrors[].issues[].path` 两类后端细节来源。
 *   3. 统一把后端 `code` 字段映射为页面内的 `verificationCode`，减少 UI 字段命名差异带来的分支判断。
 * 参数与返回值：`buildZhizFieldErrors(error)` 返回字段错误对象；`hasZhizFieldErrors(fieldErrors)` 返回是否存在字段级错误。
 * 影响范围：Zhiz 首次补邮箱、验证码验证、补设本地密码三个子流程。
 * 潜在风险：若后端未来调整字段路径命名，需同步更新 `mapZhizValidationField()`。
 */
function mapZhizValidationField(field: string): keyof ZhizFieldErrors | null {
  switch (field) {
    case 'email':
      return 'email';
    case 'password':
      return 'password';
    case 'newPassword':
      return 'newPassword';
    case 'code':
      return 'verificationCode';
    default:
      return null;
  }
}

function hasZhizFieldErrors(fieldErrors: ZhizFieldErrors): boolean {
  return Boolean(fieldErrors.email || fieldErrors.password || fieldErrors.verificationCode || fieldErrors.newPassword);
}

function buildZhizFieldErrors(error: unknown): ZhizFieldErrors {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_FAILED') {
    return {};
  }

  const details = extractZhizValidationDetails(error);
  const fieldErrors: ZhizFieldErrors = {};

  if (details.reason === 'password_policy' && typeof details.field === 'string') {
    const normalizedField = mapZhizValidationField(details.field);
    const ruleText =
      typeof details.ruleText === 'string' && details.ruleText ? details.ruleText : ZHIZ_PASSWORD_RULE_HINT;

    if (normalizedField === 'password') {
      fieldErrors.password = `新账号密码格式要求：${ruleText}`;
    }
    if (normalizedField === 'newPassword') {
      fieldErrors.newPassword = `新密码格式要求：${ruleText}`;
    }
  }

  if (!Array.isArray(details.validationErrors)) {
    return fieldErrors;
  }

  for (const group of details.validationErrors) {
    const issues = Array.isArray(group.issues) ? group.issues : [];
    for (const issue of issues) {
      const normalizedField = mapZhizValidationField(typeof issue.path === 'string' ? issue.path : '');
      if (!normalizedField || fieldErrors[normalizedField]) {
        continue;
      }

      switch (normalizedField) {
        case 'email':
          fieldErrors.email = '请输入有效的邮箱地址';
          break;
        case 'password':
          fieldErrors.password = '请填写本地密码';
          break;
        case 'verificationCode':
          fieldErrors.verificationCode = '请输入 6 位邮箱验证码';
          break;
        case 'newPassword':
          fieldErrors.newPassword = '请设置新的本地密码';
          break;
      }
    }
  }

  return fieldErrors;
}

function buildZhizChallengeState(
  snapshot: ZhizContinuationStatusResult | null,
  details: Partial<ZhizChallengeDetails> = {},
): ZhizPasswordSetupChallengeResult | null {
  const verificationMode =
    typeof details.verificationMode === 'string' ? details.verificationMode : snapshot?.verificationMode;
  const requiresNewPassword =
    typeof details.requiresNewPassword === 'boolean'
      ? details.requiresNewPassword
      : typeof snapshot?.requiresNewPassword === 'boolean'
        ? snapshot.requiresNewPassword
        : snapshot?.step === 'verify_email_and_set_password';
  const maskedEmail = typeof details.maskedEmail === 'string' ? details.maskedEmail : (snapshot?.maskedEmail ?? '');
  const resendAfterSec =
    typeof details.resendAfterSec === 'number' ? details.resendAfterSec : (snapshot?.resendAfterSec ?? 0);
  const challengeExpiresInSec =
    typeof details.challengeExpiresInSec === 'number'
      ? details.challengeExpiresInSec
      : (snapshot?.challengeExpiresInSec ?? 0);

  if (!maskedEmail && resendAfterSec <= 0 && challengeExpiresInSec <= 0) {
    return null;
  }

  return {
    maskedEmail,
    verificationMode,
    requiresNewPassword,
    resendAfterSec,
    challengeExpiresInSec,
  };
}

function isZhizVerifyStep(step: string | undefined): step is 'verify_email' | 'verify_email_and_set_password' {
  return step === 'verify_email' || step === 'verify_email_and_set_password';
}

function resolveZhizVerificationMode(
  snapshot: ZhizContinuationStatusResult | null,
  details: Partial<ZhizChallengeDetails> = {},
): ZhizVerificationMode | undefined {
  return typeof details.verificationMode === 'string' ? details.verificationMode : snapshot?.verificationMode;
}

function resolveZhizRequiresNewPassword(
  snapshot: ZhizContinuationStatusResult | null,
  details: Partial<ZhizChallengeDetails> = {},
): boolean {
  if (typeof details.requiresNewPassword === 'boolean') {
    return details.requiresNewPassword;
  }
  if (typeof snapshot?.requiresNewPassword === 'boolean') {
    return snapshot.requiresNewPassword;
  }
  return snapshot?.step === 'verify_email_and_set_password';
}

function buildZhizVerifyErrorMessage(error: unknown): string {
  const baseMessage = getErrorMessage(error);
  if (!(error instanceof ApiError) || error.code !== 'AUTH_ZHIZ_EMAIL_CODE_INVALID') {
    return baseMessage;
  }

  const details = extractZhizChallengeDetails(error);
  if (typeof details.remainingAttempts !== 'number') {
    return baseMessage;
  }

  return details.remainingAttempts > 0
    ? `${baseMessage}（剩余 ${details.remainingAttempts} 次）`
    : `${baseMessage}，请重新获取验证码`;
}

function normalizeZhizChallengeDetailsForUi(error: unknown): Partial<ZhizChallengeDetails> {
  const details = extractZhizChallengeDetails(error);
  if (!(error instanceof ApiError)) {
    return details;
  }

  if (error.code === 'AUTH_ZHIZ_EMAIL_CODE_EXPIRED') {
    return {
      ...details,
      resendAfterSec: 0,
      challengeExpiresInSec: 0,
    };
  }

  if (error.code === 'AUTH_ZHIZ_EMAIL_CODE_INVALID' && details.remainingAttempts === 0) {
    return {
      ...details,
      resendAfterSec: 0,
      challengeExpiresInSec: 0,
    };
  }

  return details;
}

function buildLoginHref(snapshot: ZhizContinuationStatusResult | null): string {
  const url = new URL('/auth/login', window.location.origin);
  if (snapshot?.clientRedirectUri) {
    url.searchParams.set('redirect_uri', snapshot.clientRedirectUri);
  }
  if (snapshot?.clientState) {
    url.searchParams.set('state', snapshot.clientState);
  }
  return `${url.pathname}${url.search}`;
}

function normalizeWebReturnTo(webReturnTo: string): string {
  if (!webReturnTo) {
    return '/';
  }
  if (/^\/(?!\/)/.test(webReturnTo)) {
    return webReturnTo;
  }
  try {
    const url = new URL(webReturnTo, window.location.origin);
    if (url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    // ignore invalid URL and fall back to home
  }
  return '/';
}

export function ZhizCompletePage() {
  const [searchParams] = useSearchParams();
  const ticket = searchParams.get('ticket') ?? '';

  const [snapshot, setSnapshot] = useState<ZhizContinuationStatusResult | null>(null);
  const [challengeState, setChallengeState] = useState<ZhizPasswordSetupChallengeResult | null>(null);
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState<'loading' | 'form' | 'verify' | 'error'>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ZhizFieldErrors>({});

  const loginHref = useMemo(() => buildLoginHref(snapshot), [snapshot]);
  const hasActiveChallenge = (challengeState?.challengeExpiresInSec ?? 0) > 0;
  const resendAfterSec = challengeState?.resendAfterSec ?? 0;
  const verifyMode = resolveZhizVerificationMode(snapshot, challengeState ?? {});
  const requiresNewPassword = resolveZhizRequiresNewPassword(snapshot, challengeState ?? {});
  const verifyMaskedEmail = challengeState?.maskedEmail || snapshot?.maskedEmail || '（未返回邮箱）';
  const verifyTitle =
    verifyMode === 'bind_existing_user'
      ? '验证邮箱并绑定现有账号'
      : verifyMode === 'set_password_and_bind'
        ? '补完本地密码并绑定 Zhiz'
        : '验证邮箱并创建本地账号';
  const verifyDescription =
    verifyMode === 'bind_existing_user'
      ? `我们识别到邮箱 ${verifyMaskedEmail} 已存在本地账号。请先完成邮箱验证码校验，验证通过后会把当前 Zhiz 身份绑定到该账号。`
      : verifyMode === 'set_password_and_bind'
        ? `我们识别到邮箱 ${verifyMaskedEmail} 已存在，但该账号是历史 OAuth-only 账号，需要先完成邮箱验证码校验并设置本地密码。`
        : `我们会向邮箱 ${verifyMaskedEmail} 发送验证码。验证通过后会创建本地账号，并用你设置的新密码完成首次 Zhiz 绑定。`;
  const verifyHint = hasActiveChallenge
    ? `当前验证码剩余有效期约 ${challengeState?.challengeExpiresInSec ?? 0} 秒。`
    : requiresNewPassword
      ? '请先发送验证码，再输入验证码和新密码完成绑定。'
      : '请先发送验证码，再输入邮件中的验证码完成绑定。';
  const verifySubmitLabel = requiresNewPassword ? '验证并完成登录' : '验证邮箱并完成绑定';

  const syncVerifyState = useCallback(
    (baseSnapshot: ZhizContinuationStatusResult, details: Partial<ZhizChallengeDetails> = {}) => {
      const nextChallengeState = buildZhizChallengeState(baseSnapshot, details);
      const nextRequiresNewPassword = resolveZhizRequiresNewPassword(baseSnapshot, details);
      const requestedStep = typeof details.step === 'string' ? details.step : baseSnapshot.step;
      const nextStep = isZhizVerifyStep(requestedStep)
        ? requestedStep
        : nextRequiresNewPassword
          ? 'verify_email_and_set_password'
          : 'verify_email';
      const maskedEmail = nextChallengeState?.maskedEmail || baseSnapshot.maskedEmail;
      const nextSnapshot: ZhizContinuationStatusResult = {
        ...baseSnapshot,
        status: 'needs_email',
        step: nextStep,
        maskedEmail,
        verificationMode: resolveZhizVerificationMode(baseSnapshot, details),
        requiresNewPassword: nextRequiresNewPassword,
        resendAfterSec: nextChallengeState?.resendAfterSec,
        challengeExpiresInSec: nextChallengeState?.challengeExpiresInSec,
      };
      setSnapshot(nextSnapshot);
      setChallengeState(nextChallengeState);
      setStatus('verify');
    },
    [],
  );

  const finalizeRedirect = useCallback(async (currentSnapshot: ZhizContinuationStatusResult) => {
    if (currentSnapshot.clientRedirectUri && currentSnapshot.clientState) {
      await handleSsoRedirect(currentSnapshot.clientRedirectUri, currentSnapshot.clientState);
      return;
    }
    window.location.href = normalizeWebReturnTo(currentSnapshot.webReturnTo);
  }, []);

  const finishTicket = useCallback(
    async (data: ZhizFinishRequest, currentSnapshot: ZhizContinuationStatusResult) => {
      setSubmitting(true);
      setError('');
      setFieldErrors({});
      try {
        await authApi.zhizFinish(data);
        await finalizeRedirect(currentSnapshot);
      } catch (err) {
        if (
          err instanceof ApiError &&
          (err.code === 'AUTH_ZHIZ_PASSWORD_SETUP_REQUIRED' || err.code === 'AUTH_ZHIZ_EMAIL_VERIFICATION_REQUIRED')
        ) {
          setFieldErrors({});
          syncVerifyState(currentSnapshot, extractZhizChallengeDetails(err));
          return;
        }
        const nextFieldErrors = buildZhizFieldErrors(err);
        setFieldErrors(nextFieldErrors);
        setError(hasZhizFieldErrors(nextFieldErrors) ? '' : getErrorMessage(err));
        setStatus(
          currentSnapshot.status === 'needs_email'
            ? isZhizVerifyStep(currentSnapshot.step)
              ? 'verify'
              : 'form'
            : 'error',
        );
      } finally {
        setSubmitting(false);
      }
    },
    [finalizeRedirect, syncVerifyState],
  );

  const handleStartPasswordSetup = useCallback(async () => {
    if (!snapshot) {
      return;
    }

    setSendingCode(true);
    setError('');
    setFieldErrors({});
    try {
      const result = await authApi.zhizPasswordSetupStart({ ticket });
      setVerificationCode('');
      syncVerifyState(snapshot, result);
    } catch (err) {
      const details = normalizeZhizChallengeDetailsForUi(err);
      if (isZhizVerifyStep(snapshot.step)) {
        syncVerifyState(snapshot, details);
      }
      setError(getErrorMessage(err));
    } finally {
      setSendingCode(false);
    }
  }, [snapshot, syncVerifyState, ticket]);

  const handleCompletePasswordSetup = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!snapshot) {
        return;
      }

      const normalizedCode = verificationCode.trim();
      const nextFieldErrors: ZhizFieldErrors = {};
      if (!/^\d{6}$/.test(normalizedCode)) {
        nextFieldErrors.verificationCode = '请输入 6 位邮箱验证码';
      }
      if (requiresNewPassword && !newPassword.trim()) {
        nextFieldErrors.newPassword = '请设置新的本地密码';
      }
      if (hasZhizFieldErrors(nextFieldErrors)) {
        setFieldErrors(nextFieldErrors);
        setError('');
        return;
      }

      setSubmitting(true);
      setError('');
      setFieldErrors({});
      try {
        await authApi.zhizPasswordSetupComplete({
          ticket,
          code: normalizedCode,
          ...(requiresNewPassword ? { newPassword } : {}),
        });
        await finalizeRedirect(snapshot);
      } catch (err) {
        const details = normalizeZhizChallengeDetailsForUi(err);
        if (isZhizVerifyStep(snapshot.step)) {
          syncVerifyState(snapshot, details);
        }
        const nextFieldErrors = buildZhizFieldErrors(err);
        setFieldErrors(nextFieldErrors);
        setError(hasZhizFieldErrors(nextFieldErrors) ? '' : buildZhizVerifyErrorMessage(err));
      } finally {
        setSubmitting(false);
      }
    },
    [finalizeRedirect, newPassword, requiresNewPassword, snapshot, syncVerifyState, ticket, verificationCode],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSnapshot() {
      if (!ticket) {
        if (!cancelled) {
          setStatus('error');
          setError('缺少 Zhiz 登录票据，请重新发起登录');
        }
        return;
      }

      try {
        const result = await authApi.zhizStatus(ticket);
        if (cancelled) {
          return;
        }
        setSnapshot(result);
        setChallengeState(buildZhizChallengeState(result));

        if (result.status === 'ready') {
          await finishTicket({ ticket }, result);
          return;
        }

        if (isZhizVerifyStep(result.step)) {
          syncVerifyState(result);
          return;
        }

        setStatus('form');
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setError(getErrorMessage(err));
        }
      }
    }

    void loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, [finishTicket, syncVerifyState, ticket]);

  useEffect(() => {
    if (!challengeState || (challengeState.resendAfterSec <= 0 && challengeState.challengeExpiresInSec <= 0)) {
      return;
    }

    const timerId = window.setInterval(() => {
      setChallengeState((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          resendAfterSec: Math.max(0, current.resendAfterSec - 1),
          challengeExpiresInSec: Math.max(0, current.challengeExpiresInSec - 1),
        };
      });
      setSnapshot((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          resendAfterSec: Math.max(0, (current.resendAfterSec ?? 0) - 1),
          challengeExpiresInSec: Math.max(0, (current.challengeExpiresInSec ?? 0) - 1),
        };
      });
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [challengeState]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!snapshot) {
        return;
      }
      const normalizedEmail = email.trim().toLowerCase();
      const nextFieldErrors: ZhizFieldErrors = {};

      if (!normalizedEmail) {
        nextFieldErrors.email = '请填写邮箱地址';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        nextFieldErrors.email = '请输入有效的邮箱地址';
      }

      if (hasZhizFieldErrors(nextFieldErrors)) {
        setFieldErrors(nextFieldErrors);
        setError('');
        return;
      }

      setFieldErrors({});
      await finishTicket({ ticket, email: normalizedEmail }, snapshot);
    },
    [email, finishTicket, snapshot, ticket],
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-gray-950 via-gray-900 to-indigo-950 px-4 py-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg shadow-indigo-500/20">
            <img src={zhizLogo} alt="Zhiz" className="h-8 w-8 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white">完成 Zhiz 登录</h1>
          <p className="mt-1.5 text-sm text-gray-400">正在同步你的 Zhiz 身份与 Easy Prompt 账号</p>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-8 shadow-2xl backdrop-blur-sm">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {snapshot?.status === 'ready' ? '正在完成登录...' : '正在读取登录状态...'}
                </h2>
                <p className="mt-1.5 text-sm text-gray-400">
                  {snapshot?.status === 'ready'
                    ? '请稍候，我们会自动为你完成 Zhiz 登录。'
                    : '请稍候，我们正在恢复你的登录流程。'}
                </p>
              </div>
            </div>
          )}

          {status === 'form' && snapshot && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gray-800">
                    {snapshot.profile.avatarUrl ? (
                      <img
                        src={snapshot.profile.avatarUrl}
                        alt={snapshot.profile.displayName ?? 'Zhiz avatar'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-lg font-semibold text-indigo-300">Z</span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-indigo-300">Zhiz 账号</p>
                    <h2 className="mt-1 text-lg font-semibold text-white">
                      {snapshot.profile.displayName ?? '未命名 Zhiz 用户'}
                    </h2>
                    <p className="mt-1 text-sm text-gray-400">首次登录需要先补充邮箱，并进入邮箱验证码校验</p>
                  </div>
                </div>
              </div>

              {error && <div className="rounded-lg bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{error}</div>}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="zhiz-email" className="mb-1.5 block text-sm font-medium text-gray-300">
                    邮箱地址
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <input
                      id="zhiz-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setFieldErrors((current) => ({ ...current, email: undefined }));
                      }}
                      disabled={submitting}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-gray-700 bg-gray-800/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    我们会先根据这个邮箱识别本地账号情况，再通过邮件验证码完成首次 Zhiz 绑定。
                  </p>
                  {fieldErrors.email && <p className="mt-1.5 text-xs text-red-400">{fieldErrors.email}</p>}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 to-purple-600 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-indigo-600 hover:to-purple-700 hover:shadow-indigo-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {submitting ? '提交中...' : '下一步：验证邮箱'}
                </button>
              </form>
            </div>
          )}

          {status === 'verify' && snapshot && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                    <ShieldAlert className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-amber-300">需要二次校验</p>
                    <h2 className="mt-1 text-lg font-semibold text-white">{verifyTitle}</h2>
                    <p className="mt-2 text-sm leading-6 text-gray-300">{verifyDescription}</p>
                    <p className="mt-2 text-xs text-amber-100/80">{verifyHint}</p>
                  </div>
                </div>
              </div>

              {error && <div className="rounded-lg bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{error}</div>}

              <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4 text-sm text-gray-300">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-white">邮箱验证码</p>
                    <p className="mt-1 text-xs text-gray-500">
                      未收到邮件可稍后重发；验证码有效期 10 分钟，仅用于当前 Zhiz 绑定流程。
                    </p>
                  </div>
                  {/* 2026-04-15
                      变更类型：修复/交互
                      功能描述：修复发送验证码按钮在横向布局下被压缩后，邮箱图标与按钮文案挤在一起并换行的问题，并同步降低按钮视觉体量。
                      设计思路：按钮增加 `whitespace-nowrap` 保持文案单行，并在 `sm` 断点以上使用 `shrink-0` 避免被左侧说明文本继续压缩；同时收窄内边距、间距、字号与图标尺寸，让按钮与说明卡片的层级更平衡。
                      参数与返回值：按钮仍依赖 `sendingCode`、`resendAfterSec`、`hasActiveChallenge` 控制禁用态与显示文案；无新增返回值。
                      影响范围：ZhizCompletePage 邮箱验证码区块的发送按钮排版与响应式观感。
                      潜在风险：极窄宽度下左侧说明文本会优先换行；按钮视觉权重降低后需留意可点击性；无已知功能风险。 */}
                  <button
                    type="button"
                    onClick={handleStartPasswordSetup}
                    disabled={sendingCode || resendAfterSec > 0}
                    className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-2 text-xs font-medium text-indigo-100 transition-colors hover:border-indigo-400/60 hover:bg-indigo-500/15 sm:shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sendingCode ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                    {sendingCode
                      ? '发送中...'
                      : resendAfterSec > 0
                        ? `${resendAfterSec}s 后可重发`
                        : hasActiveChallenge
                          ? '重新发送验证码'
                          : '发送验证码'}
                  </button>
                </div>
              </div>

              <form onSubmit={handleCompletePasswordSetup} className="space-y-4">
                <div>
                  <label htmlFor="zhiz-verification-code" className="mb-1.5 block text-sm font-medium text-gray-300">
                    6 位邮箱验证码
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <input
                      id="zhiz-verification-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={verificationCode}
                      onChange={(event) => {
                        setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                        setFieldErrors((current) => ({ ...current, verificationCode: undefined }));
                      }}
                      disabled={submitting}
                      placeholder="输入 6 位验证码"
                      className="w-full rounded-xl border border-gray-700 bg-gray-800/60 py-2.5 pl-10 pr-4 text-sm tracking-[0.25em] text-white placeholder:tracking-normal placeholder-gray-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50"
                    />
                  </div>
                  {fieldErrors.verificationCode && (
                    <p className="mt-1.5 text-xs text-red-400">{fieldErrors.verificationCode}</p>
                  )}
                </div>

                {requiresNewPassword && (
                  <div>
                    <label htmlFor="zhiz-new-password" className="mb-1.5 block text-sm font-medium text-gray-300">
                      新的本地密码
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                      <input
                        id="zhiz-new-password"
                        type="password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(event) => {
                          setNewPassword(event.target.value);
                          setFieldErrors((current) => ({ ...current, newPassword: undefined }));
                        }}
                        disabled={submitting}
                        placeholder="至少 8 位，包含大小写字母和数字"
                        className="w-full rounded-xl border border-gray-700 bg-gray-800/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50"
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">
                      格式要求：{ZHIZ_PASSWORD_RULE_HINT}。设置完成后，此邮箱可继续使用本地密码和 Zhiz 两种方式登录。
                    </p>
                    {fieldErrors.newPassword && (
                      <p className="mt-1.5 text-xs text-red-400">{fieldErrors.newPassword}</p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !hasActiveChallenge}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 to-purple-600 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-indigo-600 hover:to-purple-700 hover:shadow-indigo-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {submitting ? '验证中...' : verifySubmitLabel}
                </button>
              </form>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to={loginHref}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-sm text-gray-200 transition-colors hover:border-gray-600 hover:bg-gray-800"
                >
                  <ArrowLeft className="h-4 w-4" />
                  返回登录
                </Link>
                <Link
                  to="/"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 to-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-600 hover:to-purple-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  返回首页
                </Link>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
                <AlertCircle className="h-7 w-7 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Zhiz 登录未完成</h2>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  {error || '当前无法恢复你的 Zhiz 登录流程，请重新发起登录。'}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to={loginHref}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-sm text-gray-200 transition-colors hover:border-gray-600 hover:bg-gray-800"
                >
                  <ArrowLeft className="h-4 w-4" />
                  返回登录
                </Link>
                <Link
                  to="/"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 to-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-600 hover:to-purple-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  前往首页
                </Link>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
