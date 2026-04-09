/**
 * Provider 管理页面
 * 2026-04-09 新增 — P6.06
 * 2026-04-10 修复 — P6.06 实现新增/编辑 Provider Modal，消除 TODO stub
 * 变更类型：修复
 * 设计思路：
 *   表格列表展示所有 Provider，支持新增/编辑/删除
 *   通过 adminApi 调用后端 CRUD 接口
 *   新增/编辑使用 Modal 弹窗，包含所有 Provider 字段
 *   表单校验：slug、name、baseUrl 为必填；priority/timeout 为数值
 * 影响范围：/admin/providers 路由
 * 潜在风险：删除活跃 Provider 可能影响 AI 服务
 */

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';
import type { ProviderItem } from '../../../lib/api';

// ── Provider 表单数据类型 ──────────────────────────────
// 2026-04-09 修复 — displayName → name，对齐后端 AiProvider.name 字段
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

// 2026-04-10 — 默认表单值（新增时使用）
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

// 2026-04-10 — API 模式选项，与后端 openai.adapter.ts 保持一致
const API_MODE_OPTIONS = ['openai', 'openai-responses', 'claude', 'gemini'];

// ── Provider 新增/编辑 Modal ─────────────────────────────
// 2026-04-10 新增 — P6.06 消除 TODO stub
// 设计思路：复用同一 Modal 处理新增和编辑，通过 editingProvider 区分模式
// 参数：open — 是否显示；editingProvider — 编辑时传入已有数据，新增时为 null
// 影响范围：Providers 页面内部
// 潜在风险：无已知风险
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

  // 编辑模式：回填表单数据
  useEffect(() => {
    if (editingProvider) {
      setForm({
        slug: editingProvider.slug,
        name: editingProvider.name,
        apiMode: editingProvider.apiMode,
        baseUrl: editingProvider.baseUrl,
        apiKey: '', // API Key 不回填（安全考虑，后端不返回明文）
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

    // 基础校验
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
      // 仅在填写了 API Key 时传递（避免覆盖已有值）
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-100">{editingProvider ? '编辑 Provider' : '新增 Provider'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-4">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Slug — 编辑模式下不可修改 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Slug *</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              disabled={!!editingProvider}
              placeholder="e.g. openai-main"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* 显示名 + API 模式 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">显示名 *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. OpenAI 主力"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">API 模式</label>
              <select
                value={form.apiMode}
                onChange={(e) => setForm((f) => ({ ...f, apiMode: e.target.value }))}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none"
              >
                {API_MODE_OPTIONS.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Base URL */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Base URL *</label>
            <input
              type="text"
              value={form.baseUrl}
              onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              placeholder="https://api.openai.com/v1"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">
              API Key {editingProvider ? '（留空则保持不变）' : '*'}
            </label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              placeholder={editingProvider ? '••••••••' : 'sk-...'}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* 默认模型 + 支持模型 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">默认模型</label>
            <input
              type="text"
              value={form.defaultModel}
              onChange={(e) => setForm((f) => ({ ...f, defaultModel: e.target.value }))}
              placeholder="gpt-4o"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">支持模型（逗号分隔）</label>
            <input
              type="text"
              value={form.models}
              onChange={(e) => setForm((f) => ({ ...f, models: e.target.value }))}
              placeholder="gpt-4o, gpt-4o-mini, gpt-3.5-turbo"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* 数值参数 */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">优先级</label>
              <input
                type="number"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                min={0}
                max={100}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Max Tokens</label>
              <input
                type="number"
                value={form.maxTokens}
                onChange={(e) => setForm((f) => ({ ...f, maxTokens: Number(e.target.value) }))}
                min={1}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">超时(ms)</label>
              <input
                type="number"
                value={form.timeoutMs}
                onChange={(e) => setForm((f) => ({ ...f, timeoutMs: Number(e.target.value) }))}
                min={1000}
                step={1000}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 启用状态 */}
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
            />
            启用此 Provider
          </label>
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
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
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
  // 2026-04-10 — Modal 状态
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
    if (!window.confirm(`确定删除 Provider "${slug}"？此操作不可撤销。`)) return;
    try {
      await adminApi.deleteProvider(id);
      await fetchProviders();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  // 2026-04-10 — 打开新增 Modal
  const handleCreate = () => {
    setEditingProvider(null);
    setModalOpen(true);
  };

  // 2026-04-10 — 打开编辑 Modal
  const handleEdit = (provider: ProviderItem) => {
    setEditingProvider(provider);
    setModalOpen(true);
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
        <h1 className="text-2xl font-bold text-gray-100">Provider 管理</h1>
        <button
          onClick={handleCreate}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          + 新增 Provider
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
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">显示名</th>
              <th className="px-4 py-3">API 模式</th>
              <th className="px-4 py-3">默认模型</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">优先级</th>
              <th className="px-4 py-3">超时</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {providers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  暂无 Provider
                </td>
              </tr>
            ) : (
              providers.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-gray-900/30">
                  <td className="px-4 py-3 font-mono text-xs text-indigo-300">{p.slug}</td>
                  <td className="px-4 py-3 text-gray-200">{p.name}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-300">{p.apiMode}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{p.defaultModel}</td>
                  <td className="px-4 py-3">
                    {p.isActive ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">活跃</span>
                    ) : (
                      <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-400">禁用</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{p.priority}</td>
                  <td className="px-4 py-3 text-gray-400">{(p.timeoutMs / 1000).toFixed(0)}s</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(p)}
                      className="mr-2 text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(p.id, p.slug)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 2026-04-10 — Provider 新增/编辑 Modal */}
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
