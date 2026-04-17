/**
 * SSO OAuth 回调页面
 * 2026-04-08 新增 — P4.09 SSO Callback Page
 * 变更类型：新增
 * 设计思路：
 *   处理 OAuth 第三方登录回调（GitHub / Google — Phase 6 实现）
 *   当前为预留页面，显示加载状态 + 错误处理
 *   接收 URL query: code, state, error
 * 参数：URL query: code, state, error
 * 影响范围：/auth/callback 路由
 * 潜在风险：无已知风险（当前为预留）
 */

import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import { motion } from 'motion/react';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { BACKEND_API_BASE } from '@/lib/env';

export function CallbackPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (errorParam) {
      setStatus('error');
      setErrorMsg(errorParam === 'access_denied' ? '用户取消了授权' : `OAuth 错误: ${errorParam}`);
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMsg('缺少授权码参数');
      return;
    }

    // 将 code 发送到后端交换 token
    const exchangeCode = async () => {
      try {
        const res = await fetch(`${BACKEND_API_BASE}/api/v1/auth/oauth/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code, state }),
        });

        if (!res.ok) {
          const data = await res.json();
          setStatus('error');
          setErrorMsg(data.message ?? 'OAuth 回调处理失败');
          return;
        }

        // 成功 — 跳转首页（cookie 已设置）
        window.location.href = '/';
      } catch {
        setStatus('error');
        setErrorMsg('网络错误，请检查连接后重试');
      }
    };

    exchangeCode();
  }, [code, state, errorParam]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-gray-950 via-gray-900 to-indigo-950 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm text-center"
      >
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
            <p className="text-sm text-gray-400">正在处理登录...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
              <AlertCircle className="h-7 w-7 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">登录失败</h2>
              <p className="mt-1.5 text-sm text-gray-400">{errorMsg}</p>
            </div>
            <Link
              to="/auth/login"
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回登录
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
