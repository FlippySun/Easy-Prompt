/**
 * SSO 登录页面 — 统一登录入口
 * 2026-04-08 新增 — P4.09 SSO Login Page
 * 变更类型：新增
 * 设计思路：
 *   1. 所有客户端（VS Code / Browser / Web / IntelliJ）统一跳转到此页面登录
 *   2. 接收 redirect_uri + state 查询参数
 *   3. 登录成功后：
 *      - 同域名（zhiz.chat）→ 直接设置 cookie + 跳回
 *      - 跨域名 → 生成 code → redirect 到 redirect_uri?code=xxx&state=yyy
 *   4. 预留 GitHub / Google OAuth 按钮（Phase 6）
 *   5. 样式与 PromptHub 一致的设计语言
 * 参数：URL query: redirect_uri, state
 * 影响范围：/auth/login 路由
 * 潜在风险：SSO 核心入口，需严格校验 redirect_uri 防止开放重定向
 */

import { useState, useCallback, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, LogIn, Github, Loader2 } from 'lucide-react';
// 2026-04-10 — P5 修复：改用 authApi 替代直接 fetch，获得统一错误处理、token 自动存储
import { authApi, ApiError } from '@/lib/api';
// 2026-04-10 — SSO Plan v2 A3：登录成功后生成 SSO code 再 redirect
import { handleSsoRedirect } from '@/lib/api/sso';

// 2026-04-10 — SSO Plan v2 A3：移除前端 ALLOWED_REDIRECT_DOMAINS 白名单
// redirect_uri 校验统一由后端 /sso/authorize → ALLOWED_REDIRECT_PATTERNS 负责
// 前端仅判断是否存在 redirectUri，不做域名过滤

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirectUri = searchParams.get('redirect_uri') ?? '';
  const state = searchParams.get('state') ?? '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError('');

      // 2026-04-10 修复 — 前后端校验对齐审计
      // 变更类型：修复
      // 设计思路：后端 loginSchema 校验 email 格式（z.string().email()），
      //   前端也应同步校验，避免后端返回泛化 VALIDATION_FAILED
      // 影响范围：登录表单客户端校验
      // 潜在风险：无已知风险
      if (!email.trim() || !password.trim()) {
        setError('请填写邮箱和密码');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError('请输入有效的邮箱地址');
        return;
      }

      setLoading(true);

      try {
        // 2026-04-10 — P5 修复：改用 authApi.login()（自动存储 token + 统一错误处理）
        await authApi.login({ email: email.trim(), password });

        // 2026-04-10 — SSO Plan v2 A3（Gap #7 修正）：
        // 登录成功后 authApi.login() 已自动 setTokens()
        // 有 redirectUri → 调 handleSsoRedirect 生成一次性 code 再跳转
        // 无 redirectUri → 直接跳首页（Web-Hub 自身登录场景）
        if (redirectUri && state) {
          try {
            await handleSsoRedirect(redirectUri, state);
            return; // redirect 已执行，不会走到这里
          } catch (ssoErr) {
            // SSO 授权码生成失败（如 redirect_uri 不在白名单）
            // 登录态已保存，仅提示 SSO 错误
            if (ssoErr instanceof ApiError) {
              setError(`SSO 授权失败：${ssoErr.message}`);
            } else {
              setError('SSO 授权失败，请重试');
            }
            return;
          }
        }
        // 无 redirect_uri → Web-Hub 自身登录，跳首页
        window.location.href = '/';
      } catch (err) {
        // 使用后端返回的错误码映射中文消息
        const ERROR_MESSAGES: Record<string, string> = {
          AUTH_LOGIN_FAILED: '邮箱或密码错误',
          RATE_LOGIN_LIMIT_EXCEEDED: '登录尝试次数过多，请稍后再试',
          VALIDATION_FAILED: '邮箱或密码格式不正确',
        };
        if (err instanceof ApiError) {
          setError(ERROR_MESSAGES[err.code] ?? err.message ?? '登录失败，请重试');
        } else {
          setError('网络错误，请检查连接后重试');
        }
      } finally {
        setLoading(false);
      }
    },
    [email, password, redirectUri, state],
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-gray-950 via-gray-900 to-indigo-950 px-4">
      {/* 背景装饰 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        {/* Logo + 标题 */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 text-2xl shadow-lg shadow-indigo-500/20">
            ✨
          </div>
          <h1 className="text-2xl font-bold text-white">登录 Easy Prompt</h1>
          <p className="mt-1.5 text-sm text-gray-400">登录以使用 PromptHub 完整功能</p>
        </div>

        {/* 登录表单卡片 */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-8 shadow-2xl backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
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
                  autoComplete="current-password"
                  placeholder="输入密码"
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

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 to-purple-600 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-indigo-600 hover:to-purple-700 hover:shadow-indigo-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {loading ? '登录中...' : '登录'}
            </button>
          </form>

          {/* 分隔线 */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-800" />
            <span className="text-xs text-gray-500">或</span>
            <div className="h-px flex-1 bg-gray-800" />
          </div>

          {/* OAuth 按钮（预留 Phase 6） */}
          <div className="space-y-3">
            <button
              type="button"
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-800/40 py-2.5 text-sm text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Github className="h-4 w-4" />
              GitHub 登录（即将推出）
            </button>
            <button
              type="button"
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-800/40 py-2.5 text-sm text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google 登录（即将推出）
            </button>
          </div>

          {/* 注册链接 */}
          <p className="mt-6 text-center text-sm text-gray-400">
            还没有账号？{' '}
            <Link
              to={`/auth/register${redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}` : ''}`}
              className="font-medium text-indigo-400 hover:text-indigo-300"
            >
              立即注册
            </Link>
          </p>
        </div>

        {/* 底部信息 */}
        <p className="mt-6 text-center text-xs text-gray-600">
          登录即表示同意{' '}
          <a href="/privacy" className="text-gray-500 hover:text-gray-400">
            隐私政策
          </a>
        </p>
      </motion.div>
    </div>
  );
}
