import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';
import { getApiErrorMessage } from '../../services/api';
import type { InvoiceCategory } from '../../services/ar';
import { createInvoiceCategory, listInvoiceCategories, setInvoiceCategoryActive, updateInvoiceCategory } from '../../services/ar';
import type { CoaAccount } from '../../services/coa';
import { listCoa } from '../../services/coa';

export function SettingsInvoiceCategoriesPage() {
  const { hasPermission } = useAuth();

  const canView = hasPermission(PERMISSIONS.AR.INVOICE_CATEGORY_VIEW);
  const canCreate = hasPermission(PERMISSIONS.AR.INVOICE_CATEGORY_CREATE);
  const canEdit = hasPermission(PERMISSIONS.AR.INVOICE_CATEGORY_UPDATE);
  const canDisable = hasPermission(PERMISSIONS.AR.INVOICE_CATEGORY_DISABLE);

  const [rows, setRows] = useState<InvoiceCategory[]>([]);
  const [coa, setCoa] = useState<CoaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InvoiceCategory | null>(null);
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [revenueAccountId, setRevenueAccountId] = useState('');
  const [requiresProject, setRequiresProject] = useState(false);
  const [requiresFund, setRequiresFund] = useState(false);
  const [requiresDepartment, setRequiresDepartment] = useState(false);

  const revenueAccounts = useMemo(() => {
    return (coa ?? [])
      .filter((a) => a.type === 'INCOME' && a.isActive)
      .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }, [coa]);

  const load = () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    Promise.all([listInvoiceCategories(), listCoa()])
      .then(([cats, coaRes]) => {
        setRows(cats ?? []);
        setCoa(coaRes?.accounts ?? []);
      })
      .catch((e: any) => setError(getApiErrorMessage(e, 'Failed to load invoice categories')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const ac = String(a.code ?? '');
      const bc = String(b.code ?? '');
      if (ac !== bc) return ac.localeCompare(bc);
      return String(a.name ?? '').localeCompare(String(b.name ?? ''));
    });
  }, [rows]);

  const openCreate = () => {
    if (!canCreate) return;
    setEditing(null);
    setCode('');
    setName('');
    setRevenueAccountId('');
    setRequiresProject(false);
    setRequiresFund(false);
    setRequiresDepartment(false);
    setModalOpen(true);
  };

  const openEdit = (c: InvoiceCategory) => {
    if (!canEdit) return;
    setEditing(c);
    setCode(String(c.code ?? ''));
    setName(String(c.name ?? ''));
    setRevenueAccountId(String(c.revenueAccountId ?? ''));
    setRequiresProject(Boolean(c.requiresProject));
    setRequiresFund(Boolean(c.requiresFund));
    setRequiresDepartment(Boolean(c.requiresDepartment));
    setModalOpen(true);
  };

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      const payload = {
        code: code.trim(),
        name: name.trim(),
        revenueAccountId: String(revenueAccountId).trim(),
        requiresProject: Boolean(requiresProject),
        requiresFund: Boolean(requiresFund),
        requiresDepartment: Boolean(requiresDepartment),
      };

      if (editing) {
        await updateInvoiceCategory(editing.id, payload);
      } else {
        await createInvoiceCategory(payload);
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

  async function toggleActive(c: InvoiceCategory) {
    if (!canDisable) return;
    setError(null);
    setSaving(true);
    try {
      await setInvoiceCategoryActive(c.id, !c.isActive);
      load();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Update failed'));
    } finally {
      setSaving(false);
    }
  }

  if (!canView) return <div style={{ color: 'crimson' }}>Access denied</div>;

  return (
    <div>
      <SettingsPageHeader
        title="Invoice Categories"
        subtitle="Configure tenant-specific invoice categories and posting rules."
        rightSlot={
          canCreate ? (
            <button type="button" onClick={openCreate}>
              Create Category
            </button>
          ) : null
        }
      />

      {loading ? <div>Loading...</div> : null}
      {error ? <div style={{ color: 'crimson', marginTop: 10 }}>{error}</div> : null}

      {!loading && !error && sorted.length === 0 ? (
        <div style={{ marginTop: 14, fontSize: 13, color: 'rgba(11,12,30,0.62)', lineHeight: '18px' }}>
          No invoice categories have been created for this tenant yet.
        </div>
      ) : null}

      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Code</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Name</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Revenue Account</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Rules</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
            <th style={{ borderBottom: '1px solid #ddd', padding: 8 }} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => {
            const acct = c.revenueAccountId ? revenueAccounts.find((a) => a.id === c.revenueAccountId) ?? null : null;
            const rules = [
              c.requiresProject ? 'Project' : null,
              c.requiresFund ? 'Fund' : null,
              c.requiresDepartment ? 'Department' : null,
            ].filter(Boolean);
            return (
              <tr key={c.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{c.code}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{c.name}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  {acct ? `${acct.code} - ${acct.name}` : c.revenueAccountId}
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{rules.length ? rules.join(', ') : 'None'}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{c.isActive ? 'ACTIVE' : 'INACTIVE'}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    {canEdit ? (
                      <button type="button" onClick={() => openEdit(c)} disabled={saving}>
                        Edit
                      </button>
                    ) : null}
                    {canDisable ? (
                      <button type="button" onClick={() => void toggleActive(c)} disabled={saving}>
                        {c.isActive ? 'Disable' : 'Activate'}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
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
              width: 720,
              maxWidth: '96vw',
              background: '#fff',
              borderRadius: 16,
              border: '1px solid rgba(11,12,30,0.08)',
              boxShadow: '0 10px 30px rgba(11,12,30,0.20)',
              padding: 16,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 16 }}>{editing ? 'Edit Invoice Category' : 'New Invoice Category'}</div>

            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, alignItems: 'center' }}>
              <div>Code</div>
              <input value={code} onChange={(e) => setCode(e.target.value)} disabled={saving} />

              <div>Name</div>
              <input value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />

              <div>Revenue Account</div>
              <select value={revenueAccountId} onChange={(e) => setRevenueAccountId(e.target.value)} disabled={saving}>
                <option value="">Select...</option>
                {revenueAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </option>
                ))}
              </select>

              <div>Requires Project</div>
              <input type="checkbox" checked={requiresProject} onChange={(e) => setRequiresProject(e.target.checked)} disabled={saving} />

              <div>Requires Fund</div>
              <input type="checkbox" checked={requiresFund} onChange={(e) => setRequiresFund(e.target.checked)} disabled={saving} />

              <div>Requires Department</div>
              <input type="checkbox" checked={requiresDepartment} onChange={(e) => setRequiresDepartment(e.target.checked)} disabled={saving} />
            </div>

            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={saving || !code.trim() || !name.trim() || !revenueAccountId.trim()}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
