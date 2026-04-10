/**
 * 增强日志详情页 — 方案 B
 * 2026-04-10 新增
 * 变更类型：新增
 * 设计思路：
 *   顶部返回按钮 + 日志 ID / 状态标签
 *   分区卡片展示：请求来源、业务数据、Provider & 模型、性能 & Token、状态
 *   关键词高亮：从 URL query ?keyword=xxx 读取，对 originalInput / aiOutput 高亮
 *   长文本折叠/展开
 * 参数：路由参数 :id
 * 影响范围：/admin/logs/:id 路由
 * 潜在风险：无已知风险
 */

import { useEffect, useState, Fragment } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { adminApi } from '../../../lib/api';
import type { EnhanceLogDetail as LogDetailType } from '../../../lib/api';
import { ArrowLeft, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Copy } from 'lucide-react';

export function LogDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const keyword = searchParams.get('keyword') || '';

  const [detail, setDetail] = useState<LogDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    adminApi
      .getEnhanceLogDetail(id)
      .then((d) => setDetail(d))
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <XCircle className="mb-2 h-8 w-8 text-red-400" />
        <p className="text-sm text-red-500">{error || '日志不存在'}</p>
        <button onClick={() => navigate('/admin/logs')} className="mt-2 text-xs text-teal-600 hover:underline">
          返回列表
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部导航栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回
          </button>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-800">日志详情</h2>
            <StatusTag status={detail.status} />
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-400">{detail.id}</span>
      </div>

      {/* 请求来源 */}
      <DetailCard title="请求来源">
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">
          <Field label="客户端类型" value={detail.clientType} />
          <Field label="客户端版本" value={detail.clientVersion} />
          <Field label="平台" value={detail.clientPlatform} />
          <Field label="语言" value={detail.language} />
          <Field label="IP 地址" value={detail.ipAddress} />
          <Field label="国家/地区" value={[detail.country, detail.region].filter(Boolean).join(' / ') || null} />
          <Field label="设备指纹" value={detail.fingerprint} mono />
          <Field label="用户 ID" value={detail.userId} mono />
          <Field label="请求 ID" value={detail.requestId} mono />
        </div>
        <CollapsibleText label="User-Agent" text={detail.userAgent} keyword={keyword} />
      </DetailCard>

      {/* 业务数据 */}
      <DetailCard title="业务数据">
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">
          <Field label="增强模式" value={detail.enhanceMode} />
          <Field label="复合场景" value={detail.isComposite ? '是' : '否'} />
          <Field label="场景 ID">
            {detail.sceneIds.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {detail.sceneIds.map((s) => (
                  <span key={s} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-300">-</span>
            )}
          </Field>
        </div>
        <CollapsibleText label="原始输入" text={detail.originalInput} keyword={keyword} defaultOpen />
        <CollapsibleText label="AI 输出" text={detail.aiOutput} keyword={keyword} />
        <CollapsibleText label="System Prompt" text={detail.systemPrompt} keyword={keyword} />
        {detail.routerResult && (
          <div className="mt-3">
            <span className="text-[11px] font-medium text-slate-500">路由结果</span>
            <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600">
              {JSON.stringify(detail.routerResult, null, 2)}
            </pre>
          </div>
        )}
      </DetailCard>

      {/* Provider & 模型 */}
      <DetailCard title="Provider & 模型">
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">
          <Field label="Provider" value={detail.providerSlug} />
          <Field label="Provider ID" value={detail.providerId} mono />
          <Field label="模型" value={detail.modelUsed} />
          <Field label="API 模式" value={detail.apiMode} />
        </div>
      </DetailCard>

      {/* 性能 & Token */}
      <DetailCard title="性能 & Token">
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-4">
          <MetricField label="总耗时" value={detail.durationMs} unit="ms" />
          <MetricField label="路由耗时" value={detail.routerDurationMs} unit="ms" />
          <MetricField label="生成耗时" value={detail.genDurationMs} unit="ms" />
          <MetricField label="重试次数" value={detail.retryCount} />
          <MetricField label="Prompt Tokens" value={detail.promptTokens} />
          <MetricField label="Completion Tokens" value={detail.completionTokens} />
          <MetricField label="总 Tokens" value={detail.totalTokens} highlight />
          <MetricField label="预估成本" value={detail.estimatedCost ? `$${detail.estimatedCost}` : null} />
        </div>
      </DetailCard>

      {/* 状态 */}
      <DetailCard title="状态信息">
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">
          <Field label="状态" value={detail.status} />
          <Field label="创建时间" value={formatFullTime(detail.createdAt)} />
          <Field label="重试次数" value={String(detail.retryCount)} />
        </div>
        {detail.errorMessage && (
          <div className="mt-3">
            <span className="text-[11px] font-medium text-red-500">错误信息</span>
            <pre className="mt-1 rounded-lg bg-red-50 p-3 text-[11px] text-red-600">{detail.errorMessage}</pre>
          </div>
        )}
      </DetailCard>
    </div>
  );
}

// ── 子组件 ────────────────────────────────────────────

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-700">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  children,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-xs text-slate-700 ${mono ? 'font-mono' : ''}`}>
        {children ?? (value || <span className="text-slate-300">-</span>)}
      </dd>
    </div>
  );
}

function MetricField({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value?: string | number | null;
  unit?: string;
  highlight?: boolean;
}) {
  const display =
    value != null ? `${typeof value === 'number' ? value.toLocaleString() : value}${unit ? ` ${unit}` : ''}` : '-';
  return (
    <div>
      <dt className="text-[11px] font-medium text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-sm font-semibold ${highlight ? 'text-teal-600' : 'text-slate-700'}`}>{display}</dd>
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
        <CheckCircle className="h-3 w-3" /> 成功
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
        <XCircle className="h-3 w-3" /> 错误
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
      <Clock className="h-3 w-3" /> {status}
    </span>
  );
}

/**
 * 可折叠长文本展示 + 关键词高亮
 * 2026-04-10 新增
 * 设计思路：默认折叠超过 300 字符的文本，展开后全文显示
 *   keyword 非空时对匹配文本用 <mark> 高亮
 */
function CollapsibleText({
  label,
  text,
  keyword,
  defaultOpen,
}: {
  label: string;
  text: string | null;
  keyword: string;
  defaultOpen?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen ?? false);
  const [copied, setCopied] = useState(false);

  if (!text) return null;

  const isLong = text.length > 300;
  const displayText = expanded || !isLong ? text : text.slice(0, 300) + '...';

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-500">{label}</span>
        <div className="flex items-center gap-2">
          <button onClick={handleCopy} className="text-[10px] text-slate-400 hover:text-teal-600" title="复制">
            <Copy className="h-3 w-3" />
          </button>
          {copied && <span className="text-[10px] text-teal-500">已复制</span>}
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-0.5 text-[10px] text-slate-400 hover:text-teal-600"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? '收起' : '展开'}
            </button>
          )}
        </div>
      </div>
      <div className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
        {keyword ? <HighlightedText text={displayText} keyword={keyword} /> : displayText}
      </div>
    </div>
  );
}

/**
 * 关键词高亮组件
 * 2026-04-10 新增
 * 设计思路：将 keyword 按空格拆分为多个词，用正则全局匹配并用 <mark> 包裹
 *   大小写不敏感
 * 参数：text — 原始文本；keyword — 搜索关键词
 */
function HighlightedText({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword.trim()) return <>{text}</>;

  const words = keyword.trim().split(/\s+/).filter(Boolean);
  // 转义正则特殊字符
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) => {
        const isMatch = pattern.test(part);
        pattern.lastIndex = 0; // reset regex
        return isMatch ? (
          <mark key={i} className="rounded bg-yellow-200 px-0.5 text-yellow-900">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        );
      })}
    </>
  );
}

// ── 工具函数 ──────────────────────────────────────────

function formatFullTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default LogDetail;
