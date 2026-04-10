/**
 * 增强日志列表页 — 方案 B
 * 2026-04-10 新增
 * 变更类型：新增
 * 设计思路：
 *   顶部筛选栏（9 维：时间范围、客户端类型、状态、模型、场景 ID、IP、指纹、userId、关键词）
 *   数据表格（时间、客户端、状态、模型、场景、IP/指纹、token、耗时）
 *   分页组件（page + limit）
 *   行点击跳转 /admin/logs/:id（携带 keyword query 供详情页高亮）
 *   风格对齐现有 admin 页面（白卡片、teal 高亮、Lucide 图标）
 * 参数：无（页面级组件）
 * 影响范围：/admin/logs 路由
 * 潜在风险：无已知风险
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { adminApi } from '../../../lib/api';
import type { EnhanceLogItem, EnhanceLogListParams } from '../../../lib/api';
import { Search, Filter, ChevronLeft, ChevronRight, RefreshCw, CheckCircle, XCircle, Clock, X } from 'lucide-react';

// ── 常量 ──────────────────────────────────────────────

const CLIENT_TYPES = ['vscode', 'browser', 'web', 'intellij', 'webhub'] as const;
const STATUS_OPTIONS = ['success', 'error', 'timeout'] as const;

// 时间范围快捷选项
const DATE_PRESETS = [
  { label: '1 小时', hours: 1 },
  { label: '24 小时', hours: 24 },
  { label: '7 天', hours: 168 },
  { label: '30 天', hours: 720 },
] as const;

const PAGE_SIZES = [20, 50, 100] as const;

// ── 主组件 ────────────────────────────────────────────

export function EnhanceLogs() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // 从 URL 恢复筛选状态
  const [filters, setFilters] = useState<EnhanceLogListParams>(() => ({
    page: Number(searchParams.get('page')) || 1,
    limit: Number(searchParams.get('limit')) || 20,
    clientType: searchParams.get('clientType') || undefined,
    status: searchParams.get('status') || undefined,
    model: searchParams.get('model') || undefined,
    scene: searchParams.get('scene') || undefined,
    ipAddress: searchParams.get('ipAddress') || undefined,
    fingerprint: searchParams.get('fingerprint') || undefined,
    userId: searchParams.get('userId') || undefined,
    keyword: searchParams.get('keyword') || undefined,
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
  }));

  const [data, setData] = useState<EnhanceLogItem[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // keyword debounce
  const [keywordInput, setKeywordInput] = useState(filters.keyword || '');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // ── 数据加载 ──

  const fetchData = useCallback(async (params: EnhanceLogListParams) => {
    setLoading(true);
    setError(null);
    try {
      // 清除 undefined 值避免传空参数
      const cleanParams: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '' && v !== null) cleanParams[k] = v;
      }
      const res = await adminApi.listEnhanceLogs(cleanParams as EnhanceLogListParams);
      setData(res.data ?? []);
      setMeta(res.meta ?? { total: 0, page: 1, pageSize: 20, totalPages: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 筛选变更时同步 URL 并请求数据
  useEffect(() => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== '' && v !== null) params.set(k, String(v));
    }
    setSearchParams(params, { replace: true });
    fetchData(filters);
  }, [filters, fetchData, setSearchParams]);

  // ── 筛选操作 ──

  const updateFilter = (key: keyof EnhanceLogListParams, value: string | number | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
      page: key === 'page' ? Number(value) || 1 : 1,
    }));
  };

  const handleKeywordChange = (value: string) => {
    setKeywordInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateFilter('keyword', value || undefined);
    }, 300);
  };

  const handleDatePreset = (hours: number) => {
    const to = new Date().toISOString();
    const from = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    setFilters((prev) => ({ ...prev, from, to, page: 1 }));
  };

  const clearAllFilters = () => {
    setKeywordInput('');
    setFilters({ page: 1, limit: filters.limit });
  };

  const hasActiveFilters = Object.entries(filters).some(
    ([k, v]) => !['page', 'limit'].includes(k) && v !== undefined && v !== '',
  );

  // ── 行点击 ──

  const handleRowClick = (item: EnhanceLogItem) => {
    const query = filters.keyword ? `?keyword=${encodeURIComponent(filters.keyword)}` : '';
    navigate(`/admin/logs/${item.id}${query}`);
  };

  // ── 渲染 ──

  return (
    <div className="space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-800">增强日志</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
            {meta.total.toLocaleString()} 条
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              showFilters || hasActiveFilters ? 'bg-teal-50 text-teal-700' : 'bg-white text-slate-600 hover:bg-slate-50'
            } border border-slate-200`}
          >
            <Filter className="h-3.5 w-3.5" />
            筛选
            {hasActiveFilters && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 text-[10px] text-white">
                {Object.entries(filters).filter(([k, v]) => !['page', 'limit'].includes(k) && v).length}
              </span>
            )}
          </button>
          <button
            onClick={() => fetchData(filters)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      {/* 搜索栏（始终可见） */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => handleKeywordChange(e.target.value)}
            placeholder="搜索原文内容..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-700 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
          />
          {keywordInput && (
            <button
              onClick={() => handleKeywordChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {/* 时间快捷按钮 */}
        <div className="flex gap-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.hours}
              onClick={() => handleDatePreset(p.hours)}
              className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-teal-50 hover:text-teal-700"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 高级筛选面板 */}
      {showFilters && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <FilterSelect
              label="客户端类型"
              value={filters.clientType}
              options={CLIENT_TYPES.map((t) => ({ value: t, label: t }))}
              onChange={(v) => updateFilter('clientType', v)}
            />
            <FilterSelect
              label="状态"
              value={filters.status}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
              onChange={(v) => updateFilter('status', v)}
            />
            <FilterInput
              label="模型"
              value={filters.model}
              placeholder="如 gpt-5.4"
              onChange={(v) => updateFilter('model', v)}
            />
            <FilterInput
              label="场景 ID"
              value={filters.scene}
              placeholder="如 optimize"
              onChange={(v) => updateFilter('scene', v)}
            />
            <FilterInput
              label="IP 地址"
              value={filters.ipAddress}
              placeholder="如 192.168.1.1"
              onChange={(v) => updateFilter('ipAddress', v)}
            />
            <FilterInput
              label="指纹"
              value={filters.fingerprint}
              placeholder="设备指纹"
              onChange={(v) => updateFilter('fingerprint', v)}
            />
            <FilterInput
              label="用户 ID"
              value={filters.userId}
              placeholder="UUID"
              onChange={(v) => updateFilter('userId', v)}
            />
            <FilterInput
              label="Provider"
              value={filters.provider}
              placeholder="如 vpsairobot"
              onChange={(v) => updateFilter('provider', v)}
            />
          </div>
          {hasActiveFilters && (
            <div className="mt-3 flex justify-end">
              <button onClick={clearAllFilters} className="text-xs text-slate-500 hover:text-red-500">
                清除全部筛选
              </button>
            </div>
          )}
        </div>
      )}

      {/* 数据表格 */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <XCircle className="mb-2 h-8 w-8 text-red-400" />
            <p className="text-sm text-red-500">{error}</p>
            <button onClick={() => fetchData(filters)} className="mt-2 text-xs text-teal-600 hover:underline">
              重试
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-500">时间</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-500">客户端</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-500">状态</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-500">模型</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-500">场景</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-500">原文摘要</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-500">IP / 指纹</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-500">Token</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-500">耗时</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-sm text-slate-400">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  data.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => handleRowClick(item)}
                      className="cursor-pointer transition-colors hover:bg-slate-50/80"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatTime(item.createdAt)}</td>
                      <td className="px-4 py-3">
                        <ClientBadge type={item.clientType} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="max-w-30 truncate px-4 py-3 text-slate-600">{item.modelUsed || '-'}</td>
                      <td className="px-4 py-3">
                        {item.sceneIds.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.sceneIds.slice(0, 2).map((s) => (
                              <span
                                key={s}
                                className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600"
                              >
                                {s}
                              </span>
                            ))}
                            {item.sceneIds.length > 2 && (
                              <span className="text-[10px] text-slate-400">+{item.sceneIds.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="max-w-50 truncate px-4 py-3 text-slate-600">
                        {item.originalInput.slice(0, 80)}
                        {item.originalInput.length > 80 ? '...' : ''}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          {item.ipAddress && <span className="text-[10px] text-slate-500">{item.ipAddress}</span>}
                          {item.fingerprint && (
                            <span className="text-[10px] text-slate-400">{item.fingerprint.slice(0, 12)}...</span>
                          )}
                          {!item.ipAddress && !item.fingerprint && <span className="text-slate-300">-</span>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">
                        {item.totalTokens != null ? item.totalTokens.toLocaleString() : '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">
                        {item.durationMs != null ? `${item.durationMs}ms` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 分页 */}
        {!error && meta.totalPages > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>每页</span>
              <select
                value={filters.limit || 20}
                onChange={(e) => updateFilter('limit', Number(e.target.value))}
                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 focus:outline-none"
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span>
                第 {meta.page} / {meta.totalPages} 页，共 {meta.total.toLocaleString()} 条
              </span>
            </div>
            <div className="flex gap-1">
              <button
                disabled={meta.page <= 1}
                onClick={() => updateFilter('page', meta.page - 1)}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={meta.page >= meta.totalPages}
                onClick={() => updateFilter('page', meta.page + 1)}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 子组件 ────────────────────────────────────────────

/** 状态徽章 */
function StatusBadge({ status }: { status: string }) {
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

/** 客户端类型徽章 */
function ClientBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    vscode: 'bg-blue-50 text-blue-600',
    browser: 'bg-orange-50 text-orange-600',
    web: 'bg-purple-50 text-purple-600',
    intellij: 'bg-pink-50 text-pink-600',
    webhub: 'bg-teal-50 text-teal-600',
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[type] || 'bg-slate-50 text-slate-600'}`}
    >
      {type}
    </span>
  );
}

/** 筛选下拉选择 */
function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-slate-500">{label}</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-teal-400 focus:outline-none"
      >
        <option value="">全部</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** 筛选文本输入 */
function FilterInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value?: string;
  placeholder: string;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-slate-500">{label}</label>
      <input
        type="text"
        value={value || ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none"
      />
    </div>
  );
}

// ── 工具函数 ──────────────────────────────────────────

/** 格式化时间为 MM-DD HH:mm:ss */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default EnhanceLogs;
