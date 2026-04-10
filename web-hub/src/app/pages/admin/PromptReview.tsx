/**
 * Prompt 审核管理页面
 * 2026-04-09 新增 — P4.05 对齐后端 admin.routes.ts
 * 2026-04-09 重构 — light-theme 设计，参考 sub2api 表格风格
 * 变更类型：重构
 * 设计思路：
 *   1. 待审核列表 — 白底卡片内分页表格展示 status=pending 的 Prompt
 *   2. 单个审批/拒绝 — Lucide 图标按钮
 *   3. 批量审批 — 多选 checkbox + 批量通过按钮
 *   4. 拒绝 Modal — 白色主题弹窗收集拒绝原因（必填，1-500 字符）
 *   5. Prompt 详情展开 — 点击行可展开查看完整 content
 *   配色参考 sub2api：白底卡片、柔和圆角、Lucide 图标
 * 影响范围：/admin/prompts 路由
 * 潜在风险：批量操作上限 50，超出需分批处理
 */

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';
import type { PendingPromptItem } from '../../../lib/api';
import { Check, XCircle, X, ChevronRight, ChevronLeft, FileCheck, AlertCircle, CheckCheck } from 'lucide-react';

// ── 拒绝原因 Modal ──────────────────────────────────────────
function RejectModal({
  promptId,
  promptTitle,
  onClose,
  onDone,
}: {
  promptId: string;
  promptTitle: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) return setError('拒绝原因不能为空');
    if (trimmed.length > 500) return setError('拒绝原因不能超过 500 字符');

    setSaving(true);
    setError(null);
    try {
      await adminApi.rejectPrompt(promptId, trimmed);
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">拒绝 Prompt</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <p className="text-sm text-slate-500">
            即将拒绝：<span className="font-medium text-slate-700">{promptTitle}</span>
          </p>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">拒绝原因 *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请填写拒绝原因，将通知给作者..."
              rows={3}
              maxLength={500}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400/30"
            />
            <p className="mt-1 text-right text-xs text-slate-400">{reason.length}/500</p>
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
            {saving ? '提交中...' : '确认拒绝'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Prompt 内容展开行 ────────────────────────────────────────
function ExpandedContent({ content }: { content: string }) {
  return (
    <tr>
      <td colSpan={7} className="border-t border-slate-100 bg-slate-50/50 px-4 py-4">
        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{content}</pre>
        </div>
      </td>
    </tr>
  );
}

// ── 主页面组件 ──────────────────────────────────────────────
export function PromptReview() {
  const [items, setItems] = useState<PendingPromptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; title: string } | null>(null);
  const [operating, setOperating] = useState<Set<string>>(new Set());

  const PAGE_SIZE = 20;

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.pendingPrompts({ page, pageSize: PAGE_SIZE });
      setItems(res.data);
      setTotal(res.meta.total);
      setTotalPages(res.meta.totalPages);
      setSelected(new Set());
      setExpandedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleApprove = async (id: string) => {
    setOperating((prev) => new Set(prev).add(id));
    try {
      await adminApi.approvePrompt(id);
      await fetchList();
    } catch (err) {
      alert(err instanceof Error ? err.message : '审批失败');
    } finally {
      setOperating((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleBulkApprove = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`确定批量通过 ${selected.size} 个 Prompt?`)) return;

    const ids = Array.from(selected);
    setOperating(new Set(ids));
    try {
      const result = await adminApi.bulkApprovePrompts(ids);
      alert(`批量审批完成：成功 ${result.approved}，失败 ${result.failed}`);
      await fetchList();
    } catch (err) {
      alert(err instanceof Error ? err.message : '批量审批失败');
    } finally {
      setOperating(new Set());
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((item) => item.id)));
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
          <h1 className="text-lg font-semibold text-slate-800">Prompt 审核</h1>
          <p className="mt-0.5 text-xs text-slate-400">共 {total} 条待审核</p>
        </div>
        {selected.size > 0 && (
          <button
            onClick={handleBulkApprove}
            disabled={operating.size > 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" />
            批量通过 ({selected.size})
          </button>
        )}
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
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={items.length > 0 && selected.size === items.length}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300 text-teal-500 focus:ring-teal-400"
                />
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">标题</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">作者</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">分类</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">标签</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">提交时间</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <FileCheck className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                  <p className="text-sm text-slate-400">暂无待审核 Prompt</p>
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isExpanded = expandedId === item.id;
                const isOperating = operating.has(item.id);

                return (
                  <>
                    <tr
                      key={item.id}
                      className={`transition-colors hover:bg-slate-50/60 ${isExpanded ? 'bg-slate-50/40' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="h-4 w-4 rounded border-slate-300 text-teal-500 focus:ring-teal-400"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          className="group flex items-center gap-1.5 text-left"
                        >
                          <ChevronRight
                            className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                          <span className="font-medium text-slate-700 group-hover:text-teal-600">{item.title}</span>
                        </button>
                        {item.description && (
                          <p className="mt-0.5 max-w-xs truncate pl-5 text-xs text-slate-400">{item.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {item.author.avatarUrl ? (
                            <img src={item.author.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-[10px] font-semibold text-teal-600">
                              {(item.author.displayName || item.author.username)[0].toUpperCase()}
                            </div>
                          )}
                          <span className="text-xs text-slate-600">
                            {item.author.displayName || item.author.username}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {item.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-md bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal-600"
                            >
                              {tag}
                            </span>
                          ))}
                          {item.tags.length > 3 && (
                            <span className="text-[10px] text-slate-400">+{item.tags.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {new Date(item.createdAt).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleApprove(item.id)}
                          disabled={isOperating}
                          className="mr-1 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-500 disabled:opacity-50"
                          title="通过"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setRejectTarget({ id: item.id, title: item.title })}
                          disabled={isOperating}
                          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                          title="拒绝"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && <ExpandedContent key={`${item.id}-content`} content={item.content} />}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            第 {page}/{totalPages} 页，共 {total} 条
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              上一页
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              下一页
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 拒绝 Modal */}
      {rejectTarget && (
        <RejectModal
          promptId={rejectTarget.id}
          promptTitle={rejectTarget.title}
          onClose={() => setRejectTarget(null)}
          onDone={fetchList}
        />
      )}
    </div>
  );
}

export default PromptReview;
