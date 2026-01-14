import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import { getApiErrorMessage } from '../../services/api';
import type { Department, MasterStatus } from '../../services/master-data';
import { createDepartment, listDepartments, updateDepartment } from '../../services/master-data';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function SettingsDepartmentsPage() {
  const { hasPermission } = useAuth();

  const canView = hasPermission(PERMISSIONS.MASTER_DATA.DEPARTMENT.VIEW);
  const canCreate = hasPermission(PERMISSIONS.MASTER_DATA.DEPARTMENT.CREATE);
  const canEdit = hasPermission(PERMISSIONS.MASTER_DATA.DEPARTMENT.EDIT);

  const [rows, setRows] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<MasterStatus>('ACTIVE');
  const [effectiveFrom, setEffectiveFrom] = useState(todayIsoDate());
  const [effectiveTo, setEffectiveTo] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    listDepartments()
      .then((res) => setRows(res ?? []))
      .catch((e: any) => setError(getApiErrorMessage(e, 'Failed to load departments')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }, [rows]);

  const openCreate = () => {
    if (!canCreate) return;
    setEditing(null);
    setCode('');
    setName('');
    setStatus('ACTIVE');
    setEffectiveFrom(todayIsoDate());
    setEffectiveTo('');
    setModalOpen(true);
  };

  const openEdit = (d: Department) => {
    if (!canEdit) return;
    setEditing(d);
    setCode(d.code);
    setName(d.name);
    setStatus(d.status);
    setEffectiveFrom(String(d.effectiveFrom).slice(0, 10));
    setEffectiveTo(d.effectiveTo ? String(d.effectiveTo).slice(0, 10) : '');
    setModalOpen(true);
  };

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      const payload: any = {
        code: code.trim(),
        name: name.trim(),
        status,
        effectiveFrom,
        effectiveTo: effectiveTo.trim() || undefined,
      };

      if (editing) {
        await updateDepartment(editing.id, payload);
      } else {
        await createDepartment(payload);
      }
      setModalOpen(false);
      setEditing(null);
      load();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  if (!canView) return <div style={{ color: 'crimson' }}>Access denied</div>;

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <Link to="/settings">← Back to Settings</Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Departments</h2>
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: '18px', color: 'rgba(11,12,30,0.62)' }}>
            Organisational cost and responsibility units used across transactions and reporting.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {canCreate ? (
            <button type="button" onClick={openCreate}>
              New Department
            </button>
          ) : null}
        </div>
      </div>

      {loading ? <div>Loading...</div> : null}
      {error ? <div style={{ color: 'crimson', marginTop: 10 }}>{error}</div> : null}

      {!loading && !error && sorted.length === 0 ? (
        <div style={{ marginTop: 14, fontSize: 13, color: 'rgba(11,12,30,0.62)', lineHeight: '18px' }}>
          No departments have been created for this tenant yet.
        </div>
      ) : null}

      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Code</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Name</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Effective</th>
            <th style={{ borderBottom: '1px solid #ddd', padding: 8 }} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((d) => (
            <tr key={d.id}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{d.code}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{d.name}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{d.status}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                {String(d.effectiveFrom).slice(0, 10)} – {d.effectiveTo ? String(d.effectiveTo).slice(0, 10) : 'open'}
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                {canEdit ? (
                  <button type="button" onClick={() => openEdit(d)} disabled={saving}>
                    Edit
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11,12,30,0.38)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 60,
          }}
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) setModalOpen(false);
          }}
        >
          <div
            style={{
              width: 640,
              maxWidth: '96vw',
              background: '#fff',
              borderRadius: 16,
              border: '1px solid rgba(11,12,30,0.08)',
              boxShadow: '0 10px 30px rgba(11,12,30,0.20)',
              padding: 16,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 16 }}>{editing ? 'Edit Department' : 'New Department'}</div>

            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, alignItems: 'center' }}>
              <div>Code</div>
              <input value={code} onChange={(e) => setCode(e.target.value)} disabled={saving} />

              <div>Name</div>
              <input value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />

              <div>Status</div>
              <select value={status} onChange={(e) => setStatus(e.target.value as MasterStatus)} disabled={saving}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>

              <div>Effective From</div>
              <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} disabled={saving} />

              <div>Effective To</div>
              <input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} disabled={saving} />
            </div>

            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancel
              </button>
              <button type="button" onClick={() => void onSave()} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
