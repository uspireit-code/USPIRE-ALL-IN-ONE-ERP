import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';
import { getApiErrorMessage } from '../../services/api';
import type { SettingsUser } from '../../services/settings';
import { listSettingsUsers } from '../../services/settings';
import type { Department, DepartmentMember } from '../../services/master-data';
import {
  addDepartmentMember,
  listDepartmentMembers,
  listDepartments,
  updateDepartmentMemberStatus,
} from '../../services/master-data';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function SettingsDepartmentMembersPage() {
  const { id } = useParams();
  const departmentId = String(id ?? '');
  const { hasPermission } = useAuth();

  const canManage = hasPermission(PERMISSIONS.MASTER_DATA.DEPARTMENT.MEMBERS_MANAGE);

  const [department, setDepartment] = useState<Department | null>(null);
  const [members, setMembers] = useState<DepartmentMember[]>([]);
  const [users, setUsers] = useState<SettingsUser[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const [selectedUserId, setSelectedUserId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(todayIsoDate());
  const [effectiveTo, setEffectiveTo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    if (!departmentId) return;
    setLoading(true);
    setError('');
    try {
      const [deps, ms, us] = await Promise.all([
        listDepartments(),
        listDepartmentMembers(departmentId),
        listSettingsUsers(),
      ]);
      setDepartment((deps ?? []).find((d) => d.id === departmentId) ?? null);
      setMembers(ms ?? []);
      setUsers(us ?? []);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to load department members'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManage) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, departmentId]);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const sa = String(a.status ?? '');
      const sb = String(b.status ?? '');
      if (sa !== sb) return sa.localeCompare(sb);
      return String(a.user?.name ?? '').localeCompare(String(b.user?.name ?? ''));
    });
  }, [members]);

  const availableUsers = useMemo(() => {
    const existing = new Set(members.map((m) => m.userId));
    return users
      .filter((u) => u.status === 'ACTIVE')
      .filter((u) => !existing.has(u.id))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [members, users]);

  const onAddMember = async () => {
    if (!selectedUserId) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await addDepartmentMember(departmentId, {
        userId: selectedUserId,
        effectiveFrom: effectiveFrom || undefined,
        effectiveTo: effectiveTo.trim() || undefined,
      });
      setSelectedUserId('');
      setEffectiveFrom(todayIsoDate());
      setEffectiveTo('');
      setSuccess('Member assigned');
      await refresh();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to assign member'));
    } finally {
      setSubmitting(false);
    }
  };

  const onToggle = async (m: DepartmentMember) => {
    const next = m.status !== 'ACTIVE';
    const ok = window.confirm(
      `Are you sure you want to ${next ? 'activate' : 'deactivate'} ${m.user?.email}?`,
    );
    if (!ok) return;

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await updateDepartmentMemberStatus(departmentId, m.userId, {
        isActive: next,
      });
      setSuccess('Member updated');
      await refresh();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to update member'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!canManage) return <div style={{ color: 'crimson' }}>Access denied</div>;

  return (
    <div>
      <SettingsPageHeader
        title="Department Members"
        subtitle={department ? `${department.code} - ${department.name}` : 'Manage department membership assignments.'}
        rightSlot={
          <Link to="/settings/master-data/departments" style={{ fontSize: 13 }}>
            ← Back to Departments
          </Link>
        }
      />

      {loading ? <div style={{ marginTop: 12 }}>Loading...</div> : null}
      {error ? <div style={{ color: 'crimson', marginTop: 12 }}>{error}</div> : null}
      {success ? <div style={{ color: 'green', marginTop: 12 }}>{success}</div> : null}

      <div
        style={{
          marginTop: 14,
          padding: 12,
          border: '1px solid rgba(11,12,30,0.08)',
          borderRadius: 12,
          background: '#fff',
        }}
      >
        <div style={{ fontWeight: 800 }}>Assign user to this department</div>
        <div
          style={{
            marginTop: 10,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr auto',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            disabled={submitting || availableUsers.length === 0}
          >
            <option value="">Select user…</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>

          <input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            disabled={submitting}
          />

          <input
            type="date"
            value={effectiveTo}
            onChange={(e) => setEffectiveTo(e.target.value)}
            disabled={submitting}
            placeholder="Effective to"
          />

          <button
            type="button"
            onClick={() => void onAddMember()}
            disabled={submitting || !selectedUserId || !departmentId}
          >
            Add
          </button>
        </div>
      </div>

      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 14 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>User</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Email</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Effective</th>
            <th style={{ borderBottom: '1px solid #ddd', padding: 8 }} />
          </tr>
        </thead>
        <tbody>
          {sortedMembers.map((m) => (
            <tr key={m.id}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{m.user?.name ?? m.userId}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{m.user?.email ?? ''}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{m.status}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                {String(m.effectiveFrom).slice(0, 10)} – {m.effectiveTo ? String(m.effectiveTo).slice(0, 10) : 'open'}
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                <button type="button" onClick={() => void onToggle(m)} disabled={submitting}>
                  {m.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!loading && sortedMembers.length === 0 ? (
        <div style={{ marginTop: 12, fontSize: 13, color: 'rgba(11,12,30,0.62)' }}>
          No members assigned yet.
        </div>
      ) : null}
    </div>
  );
}
