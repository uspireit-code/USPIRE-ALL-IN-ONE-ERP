import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getApiErrorMessage } from '../../services/api';
import type { Project, ProjectStatus } from '../../services/master-data';
import { closeProject, createProject, listProjects, updateProject } from '../../services/master-data';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function SettingsProjectsPage() {
  const { hasPermission } = useAuth();

  const canView = hasPermission('MASTER_DATA_PROJECT_VIEW');
  const canCreate = hasPermission('MASTER_DATA_PROJECT_CREATE');
  const canEdit = hasPermission('MASTER_DATA_PROJECT_EDIT');
  const canClose = hasPermission('MASTER_DATA_PROJECT_CLOSE');

  const [rows, setRows] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('ACTIVE');
  const [isRestricted, setIsRestricted] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState(todayIsoDate());
  const [effectiveTo, setEffectiveTo] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    listProjects()
      .then((res) => setRows(res ?? []))
      .catch((e: any) => setError(getApiErrorMessage(e, 'Failed to load projects')))
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
    setIsRestricted(false);
    setEffectiveFrom(todayIsoDate());
    setEffectiveTo('');
    setModalOpen(true);
  };

  const openEdit = (p: Project) => {
    if (!canEdit) return;
    setEditing(p);
    setCode(p.code);
    setName(p.name);
    setStatus('ACTIVE');
    setIsRestricted(Boolean(p.isRestricted));
    setEffectiveFrom(String(p.effectiveFrom).slice(0, 10));
    setEffectiveTo(p.effectiveTo ? String(p.effectiveTo).slice(0, 10) : '');
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
        isRestricted,
        effectiveFrom,
        effectiveTo: effectiveTo.trim() || undefined,
      };

      if (editing) {
        await updateProject(editing.id, payload);
      } else {
        await createProject(payload);
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
          <h2 style={{ margin: 0 }}>Projects</h2>
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: '18px', color: 'rgba(11,12,30,0.62)' }}>
            Revenue and cost tracking by engagement or initiative.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {canCreate ? (
            <button type="button" onClick={openCreate}>
              New Project
            </button>
          ) : null}
        </div>
      </div>

      {loading ? <div>Loading...</div> : null}
      {error ? <div style={{ color: 'crimson', marginTop: 10 }}>{error}</div> : null}

      {!loading && !error && sorted.length === 0 ? (
        <div style={{ marginTop: 14, fontSize: 13, color: 'rgba(11,12,30,0.62)', lineHeight: '18px' }}>
          No projects have been created for this tenant yet.
        </div>
      ) : null}

      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Code</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Name</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Restricted</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Effective</th>
            <th style={{ borderBottom: '1px solid #ddd', padding: 8 }} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{p.code}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{p.name}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{p.status}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{p.isRestricted ? 'Yes' : 'No'}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                {String(p.effectiveFrom).slice(0, 10)} – {p.effectiveTo ? String(p.effectiveTo).slice(0, 10) : 'open'}
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                {canEdit ? (
                  <button type="button" onClick={() => openEdit(p)} disabled={saving || p.status === 'CLOSED'}>
                    Edit
                  </button>
                ) : null}
                {canClose ? (
                  <button
                    type="button"
                    disabled={saving || p.status === 'CLOSED'}
                    onClick={async () => {
                      const ok = window.confirm('Close this project? This will block future posting to it.');
                      if (!ok) return;
                      setSaving(true);
                      setError(null);
                      try {
                        await closeProject(p.id);
                        load();
                      } catch (e: any) {
                        setError(getApiErrorMessage(e, 'Close failed'));
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    Close
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
            <div style={{ fontWeight: 800, fontSize: 16 }}>{editing ? 'Edit Project' : 'New Project'}</div>

            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, alignItems: 'center' }}>
              <div>Code</div>
              <input value={code} onChange={(e) => setCode(e.target.value)} disabled={saving} />

              <div>Name</div>
              <input value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />

              <div>Status</div>
              <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} disabled={saving}>
                <option value="ACTIVE">ACTIVE</option>
              </select>

              <div>Restricted</div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={isRestricted} onChange={(e) => setIsRestricted(e.target.checked)} disabled={saving} />
                Restricted
              </label>

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
