/**
 * auditLogger 单元测试
 * 2026-04-08 新增 — P2.02
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInfo } = vi.hoisted(() => ({
  mockInfo: vi.fn(),
}));

vi.mock('../../config/logRotation', () => ({
  createChannelLogger: () => ({
    info: mockInfo,
  }),
}));

import { logAudit, type AuditEntry } from '../auditLogger';

describe('logAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log provider creation with all fields', () => {
    const entry: AuditEntry = {
      adminId: 'admin-001',
      action: 'provider.create',
      targetType: 'provider',
      targetId: 'prov-001',
      changes: {
        after: { name: 'OpenAI', apiMode: 'openai' },
      },
      ip: '192.168.1.1',
    };

    logAudit(entry);
    expect(mockInfo).toHaveBeenCalledTimes(1);

    const [payload, msg] = mockInfo.mock.calls[0];
    expect(payload.adminId).toBe('admin-001');
    expect(payload.action).toBe('provider.create');
    expect(payload.targetType).toBe('provider');
    expect(payload.targetId).toBe('prov-001');
    expect(payload.changes?.after?.name).toBe('OpenAI');
    expect(payload.ip).toBe('192.168.1.1');
    expect(payload.timestamp).toBeDefined();
    expect(msg).toContain('AUDIT');
    expect(msg).toContain('provider.create');
  });

  it('should log blacklist deactivation with before/after', () => {
    logAudit({
      adminId: 'admin-002',
      action: 'blacklist.deactivate',
      targetType: 'blacklist_rule',
      targetId: 'rule-123',
      changes: {
        before: { isActive: true },
        after: { isActive: false },
      },
      ip: '10.0.0.1',
      note: 'User requested unblock',
    });

    expect(mockInfo).toHaveBeenCalledTimes(1);
    const [payload] = mockInfo.mock.calls[0];
    expect(payload.changes?.before?.isActive).toBe(true);
    expect(payload.changes?.after?.isActive).toBe(false);
    expect(payload.note).toBe('User requested unblock');
  });

  it('should handle entry without optional fields', () => {
    logAudit({
      adminId: 'admin-003',
      action: 'user.role_change',
      targetType: 'user',
      targetId: 'user-456',
    });

    expect(mockInfo).toHaveBeenCalledTimes(1);
    const [payload] = mockInfo.mock.calls[0];
    expect(payload.changes).toBeUndefined();
    expect(payload.ip).toBeUndefined();
  });
});
