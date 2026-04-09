/**
 * ErrorBoundary — React 渲染错误捕获与友好降级
 * 2026-04-09 新增 — P5.12 错误处理统一
 * 变更类型：新增
 * 设计思路：
 *   1. 包裹子组件树，捕获 render / lifecycle 中未处理的异常
 *   2. 降级 UI：显示友好错误页面 + "重试"按钮
 *   3. 错误信息仅在开发环境显示 stack trace
 *   4. 支持 fallback prop 自定义降级组件
 * 参数：children, fallback?(可选自定义降级组件)
 * 影响范围：应用级或页面级错误捕获
 * 潜在风险：无已知风险
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 自定义降级 UI，接收 error 和 resetError 回调 */
  fallback?: (props: { error: Error; resetError: () => void }) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 生产环境可接入 Sentry 等监控
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // 自定义 fallback
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, resetError: this.resetError });
      }

      // 默认降级 UI
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center px-4 py-16 text-center">
          <div className="mb-4 text-5xl">😵</div>
          <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">页面出错了</h2>
          <p className="mb-6 max-w-md text-sm text-gray-500 dark:text-gray-400">
            很抱歉，页面遇到了意外错误。你可以尝试刷新页面或返回首页。
          </p>

          {/* 开发环境显示错误详情 */}
          {import.meta.env.DEV && (
            <pre className="mb-6 max-w-lg overflow-auto rounded-lg bg-red-50 p-4 text-left text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {this.state.error.message}
              {this.state.error.stack && (
                <>
                  {'\n\n'}
                  {this.state.error.stack}
                </>
              )}
            </pre>
          )}

          <div className="flex gap-3">
            <button
              onClick={this.resetError}
              className="rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-indigo-600 hover:shadow-lg"
            >
              重试
            </button>
            <a
              href="/"
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition-all hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              返回首页
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
