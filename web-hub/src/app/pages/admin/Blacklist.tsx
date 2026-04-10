/**
 * Blacklist 管理页面
 * 2026-04-09 新增 — P6.07
 * 2026-04-09 重构 — light-theme 设计，参考 sub2api 表格风格
 * 变更类型：重构
 * 设计思路：
 *   白底卡片内表格展示黑名单规则，支持新增/删除
 *   维度包括 ip / user / fingerprint / email
 *   新增使用 Modal 弹窗（白色主题），支持维度选择、值输入、原因说明、可选过期时间
 *   配色参考 sub2api：白底卡片、柔和圆角、Lucide 图标
 * 影响范围：/admin/blacklist 路由
 * 潜在风险：误封可能影响正常用户
 */

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';
import type { BlacklistItem } from '../../../lib/api';
import { Plus, Trash2, X, ShieldBan, AlertCircle } from 'lucide-react';

const DIMENSION_OPTIONS = [
  { value: 'ip', label: 'IP 地址' },
  { value: 'user', label: '用户 ID' },
  { value: 'fingerprint', label: '指纹' },
  { value: 'email', label: '邮箱' },
] as const;

const DIMENSION_LABELS: Record<string, string> = Object.fromEntries(DIMENSION_OPTIONS.map((d) => [d.value, d.label]));

const EXPIRY_PRESETS = [
  { label: '永久', hours: 0 },
  { label: '1 小时', hours: 1 },
  { label: '24 小时', hours: 24 },
  { label: '7 天', hours: 168 },
  { label: '30 天', hours: 720 },
] as const;

interface BlacklistFormData {
  dimension: string;
  value: string;
  reason: string;
  expiryHours: number;
}

const DEFAULT_FORM: BlacklistFormData = {
  dimension: 'ip',
  value: '',
  reason: '',
  expiryHours: 0,
};

// 2026-04-09 — 通用输入框样式（light-theme，与 Providers 页面一致）
const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400/30';
const SELECT_CLS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400/30';
const LABEL_CLS = 'mb-1.5 block text-xs font-medium text-slate-500';

// ── 新增黑名单规则 Modal ────────────────────────────────
function BlacklistCreateModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<BlacklistFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(DEFAULT_FORM);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.value.trim()) return setError('值不能为空');

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        type: form.dimension,
        value: form.value.trim(),
        reason: form.reason.trim() || undefined,
      };
      if (form.expiryHours > 0) {
        payload.expiresAt = new Date(Date.now() + form.expiryHours * 3600 * 1000).toISOString();
      }

      await adminApi.createBlacklist(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">添加黑名单规则</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className={LABEL_CLS}>封禁维度 *</label>
            <select
              value={form.dimension}
              onChange={(e) => setForm((f) => ({ ...f, dimension: e.target.value }))}
              className={SELECT_CLS}
            >
              {DIMENSION_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL_CLS}>{DIMENSION_LABELS[form.dimension] || '值'} *</label>
            <input
              type="text"
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              placeholder={
                form.dimension === 'ip'
                  ? '192.168.1.100'
                  : form.dimension === 'email'
                    ? 'spam@example.com'
                    : form.dimension === 'user'
                      ? '用户 UUID'
                      : '设备指纹哈希'
              }
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>封禁原因</label>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="滥用 API / 恶意请求 / ..."
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>有效期</label>
            <div className="flex flex-wrap gap-2">
              {EXPIRY_PRESETS.map((preset) => (
                <button
                  key={preset.hours}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, expiryHours: preset.hours }))}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    form.expiryHours === preset.hours
                      ? 'border-teal-300 bg-teal-50 text-teal-600'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            {saving ? '添加中...' : '添加规则'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 主页面组件 ──────────────────────────────────────────

export function Blacklist() {
  const [items, setItems] = useState<BlacklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.listBlacklist();
      setItems(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定移除此黑名单规则?')) return;
    try {
      await adminApi.deleteBlacklist(id);
      await fetchList();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">黑名单管理</h1>
          <p className="mt-0.5 text-xs text-slate-400">管理封禁规则，支持 IP / 用户 / 指纹 / 邮箱维度</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-600"
        >
          <Plus className="h-4 w-4" />
          添加规则
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* 表格卡片 */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-4 py-3 text-xs font-medium text-slate-500">维度</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">值</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">原因</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">过期时间</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">创建时间</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <ShieldBan className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                  <p className="text-sm text-slate-400">暂无黑名单规则</p>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                      {DIMENSION_LABELS[item.type] || item.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{item.value}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{item.reason || '--'}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {item.expiresAt ? new Date(item.expiresAt).toLocaleString('zh-CN') : '永久'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(item.createdAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      title="移除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <BlacklistCreateModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={fetchList} />
    </div>
  );
}

export default Blacklist;
