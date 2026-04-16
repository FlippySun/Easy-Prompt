/**
 * 邮件模板公开预览页
 * 2026-04-16 新增 — 腾讯云 SES HTML 验证码邮件模板预览
 * 2026-04-16 兼容性修正 — 避免使用当前 TS 目标库未声明的 `replaceAll`
 * 2026-04-16 Logo 预览适配 — 预览阶段将生产 logo 地址重写为当前 origin 静态资源
 * 2026-04-16 品牌修正 — 预览与下载逻辑切换到正确的 Easy Prompt 白色品牌 PNG
 * 变更类型：新增/优化/前端
 * 功能描述：提供 Zhiz 登录验证码邮件模板的公开预览、源码复制与 HTML 下载，方便在 Web-Hub 内直接查验腾讯云 SES 上传版本。
 * 设计思路：
 *   1. 直接复用仓库内唯一 HTML 模板源文件，避免“测试页效果”和“实际上传文件”发生分叉。
 *   2. 预览区使用 iframe `srcDoc` 渲染示例验证码，源码区始终保留 `{{verifyCode}}` 占位符，确保腾讯云模板语法不被破坏。
 *   3. 字符串替换采用 `split/join` 兼容实现，避免受当前 TypeScript lib target 对 `replaceAll` 的类型声明限制。
 *   4. 预览阶段仅替换 logo 的绝对生产地址到当前站点 origin，确保本地开发可见而下载源码仍保持腾讯云上传所需内容。
 *   5. 补充文件体积、变量名、上传约束与复制/下载能力，降低人工核对成本并提升上线前自检效率。
 * 参数与返回值：页面组件无外部 props；内部允许用户输入示例验证码，仅影响 iframe 预览，不修改原始模板内容。
 * 影响范围：`/preview/email/zhiz-verification` 公开路由、邮件模板人工验收流程、腾讯云 SES HTML 模板交付物。
 * 潜在风险：若浏览器环境禁用 Clipboard API，将回退到 `execCommand('copy')`；极旧环境可能仅保留下载能力，无已知核心业务风险。
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, CheckCheck, Copy, Download, FileCode2, MailCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import zhizVerificationTemplateHtml from '../../assets/email/zhiz-verification-template.html?raw';

const PREVIEW_ROUTE_PATH = '/preview/email/zhiz-verification';
const TEMPLATE_PLACEHOLDER = '{{verifyCode}}';
const DEFAULT_PREVIEW_CODE = '418691';
const DOWNLOAD_FILE_NAME = 'zhiz-verification-template.html';
const PRODUCTION_LOGO_URL = 'https://zhiz.chat/email/easy-prompt-logo-white.png';
const LOCAL_LOGO_PATH = '/email/easy-prompt-logo-white.png';
const TEMPLATE_SIZE_KB = (
  new Blob([zhizVerificationTemplateHtml], { type: 'text/html;charset=utf-8' }).size / 1024
).toFixed(1);

async function copyPlainText(content: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = content;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error('copy_failed');
  }
}

function downloadHtmlFile(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

function buildPreviewHtml(code: string, previewLogoUrl: string): string {
  return zhizVerificationTemplateHtml
    .split(TEMPLATE_PLACEHOLDER)
    .join(code || DEFAULT_PREVIEW_CODE)
    .split(PRODUCTION_LOGO_URL)
    .join(previewLogoUrl);
}

export function EmailTemplatePreviewPage() {
  const [previewCodeInput, setPreviewCodeInput] = useState(DEFAULT_PREVIEW_CODE);
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'success' | 'error'>('idle');
  const [downloadFeedback, setDownloadFeedback] = useState<'idle' | 'success'>('idle');
  const previewLogoUrl =
    typeof window === 'undefined' ? PRODUCTION_LOGO_URL : `${window.location.origin}${LOCAL_LOGO_PATH}`;

  const normalizedPreviewCode = useMemo(() => {
    const digitsOnly = previewCodeInput.replace(/\D/g, '').slice(0, 6);
    return digitsOnly || DEFAULT_PREVIEW_CODE;
  }, [previewCodeInput]);

  const previewHtml = useMemo(
    () => buildPreviewHtml(normalizedPreviewCode, previewLogoUrl),
    [normalizedPreviewCode, previewLogoUrl],
  );

  const handleCopy = async () => {
    try {
      await copyPlainText(zhizVerificationTemplateHtml);
      setCopyFeedback('success');
    } catch {
      setCopyFeedback('error');
    }
  };

  const handleDownload = () => {
    downloadHtmlFile(zhizVerificationTemplateHtml, DOWNLOAD_FILE_NAME);
    setDownloadFeedback('success');
  };

  const handleReset = () => {
    setPreviewCodeInput(DEFAULT_PREVIEW_CODE);
    setCopyFeedback('idle');
    setDownloadFeedback('idle');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-indigo-950/20 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3 py-1 text-xs font-semibold tracking-wide text-indigo-200">
                Public Preview
              </span>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                腾讯云 SES HTML 模板
              </span>
            </div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-white/20 hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              返回首页
            </Link>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Zhiz 登录邮箱验证码模板预览
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                这份页面用于验收新的验证码邮件视觉稿。上方预览会把模板里的
                <code className="mx-1 rounded bg-white/10 px-1.5 py-0.5 text-[0.95em] text-indigo-100">
                  {TEMPLATE_PLACEHOLDER}
                </code>
                替换成示例验证码，源码区则始终保留腾讯云要求的原始占位符，便于你直接复制或下载上传。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">预览路由</div>
                <div className="mt-2 break-all text-sm font-semibold text-white">{PREVIEW_ROUTE_PATH}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">模板大小</div>
                <div className="mt-2 text-sm font-semibold text-white">{TEMPLATE_SIZE_KB} KB / 400 KB 上限内</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">动态变量</div>
                <div className="mt-2 text-sm font-semibold text-white">{TEMPLATE_PLACEHOLDER}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">文件编码</div>
                <div className="mt-2 text-sm font-semibold text-white">UTF-8 HTML</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-950/20 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-200">
                  <MailCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">预览控制</h2>
                  <p className="text-sm text-slate-400">调整示例验证码，但不会修改原始模板变量。</p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor="previewCode" className="mb-2 block text-sm font-medium text-slate-200">
                    示例验证码
                  </label>
                  <input
                    id="previewCode"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={previewCodeInput}
                    onChange={(event) => {
                      setPreviewCodeInput(event.target.value);
                      setCopyFeedback('idle');
                      setDownloadFeedback('idle');
                    }}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-base font-semibold tracking-[0.3em] text-white outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-400/60"
                    placeholder={DEFAULT_PREVIEW_CODE}
                  />
                  <p className="mt-2 text-xs leading-6 text-slate-400">
                    预览时会自动保留数字并截断为 6 位，当前展示值为 {normalizedPreviewCode}。
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-400"
                  >
                    <Copy className="h-4 w-4" />
                    复制原始 HTML
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10"
                  >
                    <Download className="h-4 w-4" />
                    下载 HTML 文件
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-white"
                >
                  <RefreshCw className="h-4 w-4" />
                  重置示例状态
                </button>
              </div>

              <div className="mt-5 space-y-2 text-sm">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-500/10 px-3 py-1.5 text-emerald-200">
                  <CheckCheck className="h-4 w-4" />
                  {copyFeedback === 'success'
                    ? '原始 HTML 已复制到剪贴板'
                    : copyFeedback === 'error'
                      ? '复制失败，请改用下载或手动复制源码'
                      : '源码区保留腾讯云变量格式，可直接复制'}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/15 bg-sky-500/10 px-3 py-1.5 text-sky-200">
                  <Download className="h-4 w-4" />
                  {downloadFeedback === 'success'
                    ? `已触发下载：${DOWNLOAD_FILE_NAME}`
                    : '可下载为独立 HTML 文件后上传腾讯云'}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-950/20 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-200">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">设计与投递要点</h2>
                  <p className="text-sm text-slate-400">基于成熟验证码邮件范式收敛出的交付标准。</p>
                </div>
              </div>

              <div className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="font-medium text-white">结构稳定</div>
                  <div className="mt-1 text-slate-400">
                    使用 640px 居中 table 布局与 inline styles，避免依赖外部 CSS、脚本和远程图片。
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="font-medium text-white">视觉重点明确</div>
                  <div className="mt-1 text-slate-400">
                    品牌头部 + 验证码主卡片 + 有效期说明 + 安全提醒，减少无关 CTA 干扰。
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="font-medium text-white">变量兼容现状</div>
                  <div className="mt-1 text-slate-400">
                    模板只保留一个动态变量{' '}
                    <code className="rounded bg-white/10 px-1.5 py-0.5 text-indigo-100">{TEMPLATE_PLACEHOLDER}</code>
                    ，和当前后端 SES 入参完全一致。
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-slate-950/20 backdrop-blur sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">邮件渲染预览</h2>
                  <p className="text-sm text-slate-400">此区域展示替换示例验证码后的真实邮件渲染效果。</p>
                </div>
                <div className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-100">
                  当前预览码：{normalizedPreviewCode}
                </div>
              </div>
              <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/60 p-3">
                <iframe
                  title="Zhiz verification email preview"
                  srcDoc={previewHtml}
                  className="h-[900px] w-full rounded-3xl border-0 bg-white"
                />
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-slate-950/20 backdrop-blur sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-200">
                  <FileCode2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">腾讯云上传源码</h2>
                  <p className="text-sm text-slate-400">下方源码保留原始占位符，可直接复制或下载后上传控制台。</p>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
                <pre className="max-h-[720px] overflow-auto whitespace-pre-wrap break-words text-[12px] leading-6 text-slate-300">
                  {zhizVerificationTemplateHtml}
                </pre>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmailTemplatePreviewPage;
