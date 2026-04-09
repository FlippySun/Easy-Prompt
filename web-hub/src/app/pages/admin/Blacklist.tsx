/**
 * Blacklist 管理页面
 * 2026-04-09 新增 — P6.07
 * 2026-04-10 修复 — P6.07 实现新增黑名单规则 Modal，消除 TODO stub
 * 变更类型：修复
 * 设计思路：
 *   表格展示黑名单规则，支持新增/删除
 *   维度包括 ip / user / fingerprint / email
 *   新增使用 Modal 弹窗，支持维度选择、值输入、原因说明、可选过期时间
 * 影响范围：/admin/blacklist 路由
 * 潜在风险：误封可能影响正常用户
 */

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';
import type { BlacklistItem } from '../../../lib/api';

// 2026-04-10 — 维度选项及显示标签
const DIMENSION_OPTIONS = [
  { value: 'ip', label: 'IP 地址' },
  { value: 'user', label: '用户 ID' },
  { value: 'fingerprint', label: '指纹' },
  { value: 'email', label: '邮箱' },
] as const;

const DIMENSION_LABELS: Record<string, string> = Object.fromEntries(DIMENSION_OPTIONS.map((d) => [d.value, d.label]));

// 2026-04-10 — 过期时间快捷选项（小时数，0 表示永久）
const EXPIRY_PRESETS = [
  { label: '永久', hours: 0 },
  { label: '1 小时', hours: 1 },
  { label: '24 小时', hours: 24 },
  { label: '7 天', hours: 168 },
  { label: '30 天', hours: 720 },
] as const;

// ── 新增黑名单规则表单类型 ──────────────────────────────
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

// ── 新增黑名单规则 Modal ────────────────────────────────
// 2026-04-10 新增 — P6.07 消除 TODO stub
// 设计思路：Modal 弹窗收集维度、值、原因、过期时间，调用 adminApi.createBlacklist
// 参数：open — 是否显示；onClose — 关闭回调；onSaved — 创建成功后刷新列表
// 影响范围：Blacklist 页面内部
// 潜在风险：无已知风险
function BlacklistCreateModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<BlacklistFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 每次打开时重置表单
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
      // 2026-04-09 修复 — dimension → type，对齐后端 blacklist_rules 字段名
      const payload: Record<string, unknown> = {
        type: form.dimension,
        value: form.value.trim(),
        reason: form.reason.trim() || undefined,
      };
      // 计算过期时间（0 表示永久，不传 expiresAt）
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-100">添加黑名单规则</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* 维度选择 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">封禁维度 *</label>
            <select
              value={form.dimension}
              onChange={(e) => setForm((f) => ({ ...f, dimension: e.target.value }))}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none"
            >
              {DIMENSION_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* 值 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">
              {DIMENSION_LABELS[form.dimension] || '值'} *
            </label>
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
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* 原因 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">封禁原因</label>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="滥用 API / 恶意请求 / ..."
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* 过期时间 — 快捷选项 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">有效期</label>
            <div className="flex flex-wrap gap-2">
              {EXPIRY_PRESETS.map((preset) => (
                <button
                  key={preset.hours}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, expiryHours: preset.hours }))}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    form.expiryHours === preset.hours
                      ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </form>

        <div className="flex justify-end gap-3 border-t border-gray-800 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
          >
            取消
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
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
  // 2026-04-10 — Modal 状态
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
    if (!window.confirm('确定移除此黑名单规则？')) return;
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">黑名单管理</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
        >
          + 添加规则
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-800 bg-gray-900/50 text-xs uppercase text-gray-400">
            <tr>
              <th className="px-4 py-3">维度</th>
              <th className="px-4 py-3">值</th>
              <th className="px-4 py-3">原因</th>
              <th className="px-4 py-3">过期时间</th>
              <th className="px-4 py-3">创建时间</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  暂无黑名单规则
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-gray-900/30">
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-300">
                      {DIMENSION_LABELS[item.type] || item.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-200">{item.value}</td>
                  <td className="px-4 py-3 text-gray-400">{item.reason || '—'}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {item.expiresAt ? new Date(item.expiresAt).toLocaleString('zh-CN') : '永久'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(item.createdAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(item.id)} className="text-xs text-red-400 hover:text-red-300">
                      移除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 2026-04-10 — 新增黑名单规则 Modal */}
      <BlacklistCreateModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={fetchList} />
    </div>
  );
}

export default Blacklist;
