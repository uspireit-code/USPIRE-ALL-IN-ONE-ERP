import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';
import { getApiErrorMessage } from '../../services/api';
import type { Fund, MasterStatus, Project } from '../../services/master-data';
import { createFund, listFunds, listProjects, updateFund } from '../../services/master-data';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function SettingsFundsPage() {
  const { hasPermission } = useAuth();

  const canView = hasPermission(PERMISSIONS.MASTER_DATA.FUND.VIEW);
  const canCreate = hasPermission(PERMISSIONS.MASTER_DATA.FUND.CREATE);
  const canEdit = hasPermission(PERMISSIONS.MASTER_DATA.FUND.EDIT);

  const [rows, setRows] = useState<Fund[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Fund | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<MasterStatus>('ACTIVE');
  const [projectId, setProjectId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(todayIsoDate());
  const [effectiveTo, setEffectiveTo] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    Promise.all([listFunds(), listProjects()])
      .then(([f, p]) => {
        setRows(f ?? []);
        setProjects(p ?? []);
      })
      .catch((e: any) => setError(getApiErrorMessage(e, 'Failed to load funds')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const projectLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      map.set(p.id, `${p.code} - ${p.name}`);
    }
    return map;
  }, [projects]);

  const activeProjects = useMemo(() => {
    return (projects ?? []).filter((p) => p.status === 'ACTIVE' && p.isActive);
  }, [projects]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }, [rows]);

  const openCreate = () => {
    if (!canCreate) return;
    setEditing(null);
    setCode('');
    setName('');
    setStatus('ACTIVE');
    setProjectId('');
    setEffectiveFrom(todayIsoDate());
    setEffectiveTo('');
    setModalOpen(true);
  };

  const openEdit = (f: Fund) => {
    if (!canEdit) return;
    setEditing(f);
    setCode(f.code);
    setName(f.name);
    setStatus(f.status);
    setProjectId(f.projectId ?? '');
    setEffectiveFrom(String(f.effectiveFrom).slice(0, 10));
    setEffectiveTo(f.effectiveTo ? String(f.effectiveTo).slice(0, 10) : '');
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
        projectId: projectId.trim() || undefined,
        effectiveFrom,
        effectiveTo: effectiveTo.trim() || undefined,
      };

      if (editing) {
        await updateFund(editing.id, payload);
      } else {
        await createFund(payload);
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
      <SettingsPageHeader
        title="Funds"
        subtitle="Restricted or designated funding sources."
        rightSlot={
          canCreate ? (
            <button type="button" onClick={openCreate}>
              New Fund
            </button>
          ) : null
        }
      />

      {loading ? <div>Loading...</div> : null}
      {error ? <div style={{ color: 'crimson', marginTop: 10 }}>{error}</div> : null}

      {!loading && !error && sorted.length === 0 ? (
        <div style={{ marginTop: 14, fontSize: 13, color: 'rgba(11,12,30,0.62)', lineHeight: '18px' }}>
          No funds have been created for this tenant yet.
        </div>
      ) : null}

      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Code</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Name</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Project</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Effective</th>
            <th style={{ borderBottom: '1px solid #ddd', padding: 8 }} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((f) => (
            <tr key={f.id}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{f.code}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{f.name}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{f.projectId ? projectLabelById.get(f.projectId) ?? f.projectId : '-'}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{f.status}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                {String(f.effectiveFrom).slice(0, 10)} – {f.effectiveTo ? String(f.effectiveTo).slice(0, 10) : 'open'}
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                {canEdit ? (
                  <button type="button" onClick={() => openEdit(f)} disabled={saving}>
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
            <div style={{ fontWeight: 800, fontSize: 16 }}>{editing ? 'Edit Fund' : 'New Fund'}</div>

            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, alignItems: 'center' }}>
              <div>Code</div>
              <input value={code} onChange={(e) => setCode(e.target.value)} disabled={saving} />

              <div>Name</div>
              <input value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />

              <div>Project (optional)</div>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={saving}>
                <option value="">(none)</option>
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>

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
