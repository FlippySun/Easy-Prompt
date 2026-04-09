/**
 * SSO 注册页面
 * 2026-04-08 新增 — P4.10 SSO Register Page
 * 变更类型：新增
 * 设计思路：
 *   1. 与 LoginPage 共享视觉语言（dark gradient + card）
 *   2. 三字段注册：用户名 / 邮箱 / 密码，实时客户端校验
 *   3. 注册成功后自动登录并跳转（复用 LoginPage 的 redirect 逻辑）
 *   4. 密码强度指示器 + 确认密码校验
 * 参数：URL query: redirect_uri, state（从 LoginPage 传递）
 * 影响范围：/auth/register 路由
 * 潜在风险：无已知风险
 */

import { useState, useCallback, useMemo, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { User, Mail, Lock, Eye, EyeOff, UserPlus, Loader2, Check, X } from 'lucide-react';
// 2026-04-10 — P5 修复：改用 authApi 替代直接 fetch
import { authApi, ApiError } from '@/lib/api';

/** 密码强度等级 */
type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

/**
 * 计算密码强度
 * 规则：长度 ≥8 +1，含大写 +1，含数字 +1，含特殊字符 +1
 */
function getPasswordStrength(pw: string): { level: StrengthLevel; score: number } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  const levels: StrengthLevel[] = ['weak', 'fair', 'good', 'strong'];
  return { level: levels[Math.min(score, 3)] ?? 'weak', score };
}

const STRENGTH_CONFIG: Record<StrengthLevel, { label: string; color: string; width: string }> = {
  weak: { label: '弱', color: 'bg-red-500', width: 'w-1/4' },
  fair: { label: '一般', color: 'bg-yellow-500', width: 'w-2/4' },
  good: { label: '良好', color: 'bg-blue-500', width: 'w-3/4' },
  strong: { label: '强', color: 'bg-green-500', width: 'w-full' },
};

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const redirectUri = searchParams.get('redirect_uri') ?? '';
  const state = searchParams.get('state') ?? '';

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const strengthCfg = STRENGTH_CONFIG[strength.level];

  // 客户端校验规则
  const validations = useMemo(
    () => [
      { label: '用户名 2-50 字符', ok: username.length >= 2 && username.length <= 50 },
      { label: '有效邮箱格式', ok: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) },
      { label: '密码至少 8 位', ok: password.length >= 8 },
      { label: '两次密码一致', ok: password.length > 0 && password === confirmPassword },
    ],
    [username, email, password, confirmPassword],
  );

  const allValid = validations.every((v) => v.ok);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError('');

      if (!allValid) {
        setError('请确保所有字段填写正确');
        return;
      }

      setLoading(true);

      try {
        // 2026-04-10 — P5 修复：改用 authApi.register()（自动存储 token + 统一错误处理）
        await authApi.register({ username: username.trim(), email: email.trim(), password });

        // 注册成功 — 跳转登录页（携带 redirect 参数）
        const loginUrl = redirectUri
          ? `/auth/login?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&registered=1`
          : '/auth/login?registered=1';
        window.location.href = loginUrl;
      } catch (err) {
        const ERROR_MESSAGES: Record<string, string> = {
          AUTH_EMAIL_EXISTS: '该邮箱已被注册',
          AUTH_USERNAME_EXISTS: '该用户名已被占用',
          VALIDATION_FAILED: '输入格式不正确，请检查后重试',
        };
        if (err instanceof ApiError) {
          setError(ERROR_MESSAGES[err.code] ?? err.message ?? '注册失败，请重试');
        } else {
          setError('网络错误，请检查连接后重试');
        }
      } finally {
        setLoading(false);
      }
    },
    [allValid, username, email, password, redirectUri, state],
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-gray-950 via-gray-900 to-indigo-950 px-4 py-8">
      {/* 背景装饰 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        {/* Logo + 标题 */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-purple-500 to-indigo-600 text-2xl shadow-lg shadow-purple-500/20">
            ✨
          </div>
          <h1 className="text-2xl font-bold text-white">创建账号</h1>
          <p className="mt-1.5 text-sm text-gray-400">注册以使用 PromptHub 完整功能</p>
        </div>

        {/* 注册表单卡片 */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-8 shadow-2xl backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 用户名 */}
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-gray-300">
                用户名
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="your-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50"
                />
              </div>
            </div>

            {/* 邮箱 */}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-300">
                邮箱地址
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50"
                />
              </div>
            </div>

            {/* 密码 */}
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-300">
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="至少 8 位"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800/60 py-2.5 pl-10 pr-10 text-sm text-white placeholder-gray-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* 密码强度指示器 */}
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="h-1 overflow-hidden rounded-full bg-gray-800">
                    <div className={`h-full rounded-full transition-all ${strengthCfg.color} ${strengthCfg.width}`} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    密码强度：<span className="text-gray-400">{strengthCfg.label}</span>
                  </p>
                </div>
              )}
            </div>

            {/* 确认密码 */}
            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-gray-300">
                确认密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50"
                />
              </div>
            </div>

            {/* 校验清单 */}
            <div className="space-y-1.5">
              {validations.map((v) => (
                <div key={v.label} className="flex items-center gap-2 text-xs">
                  {v.ok ? (
                    <Check className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-gray-600" />
                  )}
                  <span className={v.ok ? 'text-green-400' : 'text-gray-500'}>{v.label}</span>
                </div>
              ))}
            </div>

            {/* 错误提示 */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
              >
                {error}
              </motion.div>
            )}

            {/* 注册按钮 */}
            <button
              type="submit"
              disabled={loading || !allValid}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-purple-500 to-indigo-600 py-2.5 text-sm font-medium text-white shadow-lg shadow-purple-500/25 transition-all hover:from-purple-600 hover:to-indigo-700 hover:shadow-purple-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {loading ? '注册中...' : '创建账号'}
            </button>
          </form>

          {/* 登录链接 */}
          <p className="mt-6 text-center text-sm text-gray-400">
            已有账号？{' '}
            <Link
              to={`/auth/login${redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}` : ''}`}
              className="font-medium text-indigo-400 hover:text-indigo-300"
            >
              立即登录
            </Link>
          </p>
        </div>

        {/* 底部信息 */}
        <p className="mt-6 text-center text-xs text-gray-600">
          注册即表示同意{' '}
          <a href="/privacy" className="text-gray-500 hover:text-gray-400">
            隐私政策
          </a>
        </p>
      </motion.div>
    </div>
  );
}
