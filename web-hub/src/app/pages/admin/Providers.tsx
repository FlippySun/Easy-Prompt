/**
 * Provider 管理页面
 * 2026-04-09 新增 — P6.06
 * 2026-04-09 重构 — light-theme 设计，参考 sub2api 表格风格
 * 变更类型：重构
 * 设计思路：
 *   白底卡片内表格展示所有 Provider，支持新增/编辑/删除
 *   通过 adminApi 调用后端 CRUD 接口
 *   新增/编辑使用 Modal 弹窗（白色主题），包含所有 Provider 字段
 *   表单校验：slug、name、baseUrl 为必填；priority/timeout 为数值
 * 影响范围：/admin/providers 路由
 * 潜在风险：删除活跃 Provider 可能影响 AI 服务
 */

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';
import type { ProviderItem } from '../../../lib/api';
import { Plus, Pencil, Trash2, X, Server, AlertCircle } from 'lucide-react';

// ── Provider 表单数据类型 ──────────────────────────────
interface ProviderFormData {
  slug: string;
  name: string;
  apiMode: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  models: string;
  isActive: boolean;
  priority: number;
  maxTokens: number;
  timeoutMs: number;
}

const DEFAULT_FORM: ProviderFormData = {
  slug: '',
  name: '',
  apiMode: 'openai',
  baseUrl: '',
  apiKey: '',
  defaultModel: '',
  models: '',
  isActive: true,
  priority: 10,
  maxTokens: 4096,
  timeoutMs: 30000,
};

const API_MODE_OPTIONS = ['openai', 'openai-responses', 'claude', 'gemini'];

// 2026-04-09 — 通用输入框样式（light-theme）
const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400/30 disabled:bg-slate-50 disabled:text-slate-400';
const SELECT_CLS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400/30';
const LABEL_CLS = 'mb-1.5 block text-xs font-medium text-slate-500';

// ── Provider 新增/编辑 Modal ─────────────────────────────
function ProviderModal({
  open,
  editingProvider,
  onClose,
  onSaved,
}: {
  open: boolean;
  editingProvider: ProviderItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ProviderFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingProvider) {
      setForm({
        slug: editingProvider.slug,
        name: editingProvider.name,
        apiMode: editingProvider.apiMode,
        baseUrl: editingProvider.baseUrl,
        apiKey: '',
        defaultModel: editingProvider.defaultModel,
        models: editingProvider.models.join(', '),
        isActive: editingProvider.isActive,
        priority: editingProvider.priority,
        maxTokens: editingProvider.maxTokens,
        timeoutMs: editingProvider.timeoutMs,
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setError(null);
  }, [editingProvider, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.slug.trim()) return setError('Slug 不能为空');
    if (!form.name.trim()) return setError('显示名不能为空');
    if (!form.baseUrl.trim()) return setError('Base URL 不能为空');

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        slug: form.slug.trim(),
        name: form.name.trim(),
        apiMode: form.apiMode,
        baseUrl: form.baseUrl.trim(),
        defaultModel: form.defaultModel.trim(),
        models: form.models
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean),
        isActive: form.isActive,
        priority: form.priority,
        maxTokens: form.maxTokens,
        timeoutMs: form.timeoutMs,
      };
      if (form.apiKey.trim()) {
        payload.apiKey = form.apiKey.trim();
      }

      if (editingProvider) {
        await adminApi.updateProvider(editingProvider.id, payload);
      } else {
        await adminApi.createProvider(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">
            {editingProvider ? '编辑 Provider' : '新增 Provider'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className={LABEL_CLS}>Slug *</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              disabled={!!editingProvider}
              placeholder="e.g. openai-main"
              className={INPUT_CLS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>显示名 *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. OpenAI"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>API 模式</label>
              <select
                value={form.apiMode}
                onChange={(e) => setForm((f) => ({ ...f, apiMode: e.target.value }))}
                className={SELECT_CLS}
              >
                {API_MODE_OPTIONS.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL_CLS}>Base URL *</label>
            <input
              type="text"
              value={form.baseUrl}
              onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              placeholder="https://api.openai.com/v1"
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>API Key {editingProvider ? '(留空则保持不变)' : '*'}</label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              placeholder={editingProvider ? '--------' : 'sk-...'}
              className={INPUT_CLS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>默认模型</label>
              <input
                type="text"
                value={form.defaultModel}
                onChange={(e) => setForm((f) => ({ ...f, defaultModel: e.target.value }))}
                placeholder="gpt-4o"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>支持模型 (逗号分隔)</label>
              <input
                type="text"
                value={form.models}
                onChange={(e) => setForm((f) => ({ ...f, models: e.target.value }))}
                placeholder="gpt-4o, gpt-4o-mini"
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LABEL_CLS}>优先级</label>
              <input
                type="number"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                min={0}
                max={100}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Max Tokens</label>
              <input
                type="number"
                value={form.maxTokens}
                onChange={(e) => setForm((f) => ({ ...f, maxTokens: Number(e.target.value) }))}
                min={1}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>超时 (ms)</label>
              <input
                type="number"
                value={form.timeoutMs}
                onChange={(e) => setForm((f) => ({ ...f, timeoutMs: Number(e.target.value) }))}
                min={1000}
                step={1000}
                className={INPUT_CLS}
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-slate-600">
            <div className="relative">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="peer h-4 w-4 rounded border-slate-300 text-teal-500 focus:ring-teal-400"
              />
            </div>
            启用此 Provider
          </label>
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
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
          >
            {saving ? '保存中...' : editingProvider ? '更新' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 主页面组件 ──────────────────────────────────────────

export function Providers() {
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderItem | null>(null);

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminApi.listProviders();
      setProviders(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleDelete = async (id: string, slug: string) => {
    if (!window.confirm(`确定删除 Provider "${slug}"? 此操作不可撤销。`)) return;
    try {
      await adminApi.deleteProvider(id);
      await fetchProviders();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleCreate = () => {
    setEditingProvider(null);
    setModalOpen(true);
  };

  const handleEdit = (provider: ProviderItem) => {
    setEditingProvider(provider);
    setModalOpen(true);
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
          <h1 className="text-lg font-semibold text-slate-800">Provider 管理</h1>
          <p className="mt-0.5 text-xs text-slate-400">管理 AI 服务提供商配置</p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-600"
        >
          <Plus className="h-4 w-4" />
          新增 Provider
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
              <th className="px-4 py-3 text-xs font-medium text-slate-500">Slug</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">显示名</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">API 模式</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">默认模型</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">状态</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">优先级</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">超时</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {providers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <Server className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                  <p className="text-sm text-slate-400">暂无 Provider</p>
                </td>
              </tr>
            ) : (
              providers.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-teal-600">{p.slug}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{p.name}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                      {p.apiMode}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.defaultModel}</td>
                  <td className="px-4 py-3">
                    {p.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        活跃
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                        禁用
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{p.priority}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{(p.timeoutMs / 1000).toFixed(0)}s</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(p)}
                      className="mr-1 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-teal-600"
                      title="编辑"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id, p.slug)}
                      className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      title="删除"
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

      <ProviderModal
        open={modalOpen}
        editingProvider={editingProvider}
        onClose={() => setModalOpen(false)}
        onSaved={fetchProviders}
      />
    </div>
  );
}

export default Providers;
