import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getApiErrorMessage } from '../../services/api';
import type { CoaAccount } from '../../services/coa';
import { listCoa } from '../../services/coa';
import type { TaxRate, TaxRateType } from '../../services/tax';
import { createTaxRate, listTaxRates, setTaxRateActive, updateTaxRate } from '../../services/tax';

export function SettingsTaxRatesPage() {
  const { hasPermission } = useAuth();

  const canView = hasPermission('TAX_RATE_VIEW');
  const canCreate = hasPermission('TAX_RATE_CREATE');
  const canEdit = hasPermission('TAX_RATE_UPDATE');
  const canDeactivate = hasPermission('TAX_RATE_UPDATE');

  const [rows, setRows] = useState<TaxRate[]>([]);
  const [coa, setCoa] = useState<CoaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TaxRate | null>(null);
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [rate, setRate] = useState<number>(0);
  const [type, setType] = useState<TaxRateType>('OUTPUT');
  const [glAccountId, setGlAccountId] = useState<string>('');

  const accountsById = useMemo(() => {
    const map = new Map<string, CoaAccount>();
    for (const a of coa ?? []) map.set(a.id, a);
    return map;
  }, [coa]);

  const selectableAccounts = useMemo(() => {
    const expected = type === 'INPUT' ? 'ASSET' : 'LIABILITY';
    return (coa ?? [])
      .filter((a) => a.isActive && a.type === expected)
      .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }, [coa, type]);

  const load = () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    Promise.all([listTaxRates(), listCoa()])
      .then(([items, coaRes]) => {
        setRows(items ?? []);
        setCoa(coaRes?.accounts ?? []);
      })
      .catch((e: any) => setError(getApiErrorMessage(e, 'Failed to load tax rates')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const sorted = useMemo(() => {
    return [...(rows ?? [])].sort((a, b) => {
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
    setRate(0);
    setType('OUTPUT');
    setGlAccountId('');
    setModalOpen(true);
  };

  const openEdit = (r: TaxRate) => {
    if (!canEdit) return;
    setEditing(r);
    setCode(String(r.code ?? ''));
    setName(String(r.name ?? ''));
    setRate(Number(r.rate ?? 0));
    setType((r.type ?? 'OUTPUT') as TaxRateType);
    setGlAccountId(String(r.glAccountId ?? ''));
    setModalOpen(true);
  };

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      const payload = {
        code: code.trim(),
        name: name.trim(),
        rate: Number(rate ?? 0),
        type,
        glAccountId: glAccountId.trim() || undefined,
      };

      if (editing) {
        await updateTaxRate(editing.id, {
          code: payload.code,
          name: payload.name,
          rate: payload.rate,
          type: payload.type,
          glAccountId: payload.glAccountId ?? null,
        });
      } else {
        await createTaxRate(payload);
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

  async function toggleActive(r: TaxRate) {
    if (!canDeactivate) return;
    setError(null);
    setSaving(true);
    try {
      await setTaxRateActive(r.id, !r.isActive);
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
      <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'flex-end' }}>
        <Link to="/settings">Back to Settings</Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Tax Rates</h2>
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: '18px', color: 'rgba(11,12,30,0.62)' }}>
            Manage tenant tax / VAT rates used on invoices.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {canCreate ? (
            <button type="button" onClick={openCreate}>
              New Tax Rate
            </button>
          ) : null}
        </div>
      </div>

      {loading ? <div>Loading...</div> : null}
      {error ? <div style={{ color: 'crimson', marginTop: 10 }}>{error}</div> : null}

      {!loading && !error && sorted.length === 0 ? (
        <div style={{ marginTop: 14, fontSize: 13, color: 'rgba(11,12,30,0.62)', lineHeight: '18px' }}>
          No tax rates have been created for this tenant yet.
        </div>
      ) : null}

      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Code</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Name</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Rate (%)</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Type</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>VAT Account</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
            <th style={{ borderBottom: '1px solid #ddd', padding: 8 }} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const acct = r.glAccountId ? accountsById.get(r.glAccountId) ?? null : null;
            return (
              <tr key={r.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.code}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.name}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{Number(r.rate ?? 0).toFixed(2)}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.type}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{acct ? `${acct.code} - ${acct.name}` : r.glAccountId ? r.glAccountId : '—'}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.isActive ? 'ACTIVE' : 'INACTIVE'}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    {canEdit ? (
                      <button type="button" onClick={() => openEdit(r)} disabled={saving}>
                        Edit
                      </button>
                    ) : null}
                    {canDeactivate ? (
                      <button type="button" onClick={() => void toggleActive(r)} disabled={saving}>
                        {r.isActive ? 'Deactivate' : 'Activate'}
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
            <div style={{ fontWeight: 800, fontSize: 16 }}>{editing ? 'Edit Tax Rate' : 'New Tax Rate'}</div>

            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, alignItems: 'center' }}>
              <div>Code</div>
              <input value={code} onChange={(e) => setCode(e.target.value)} disabled={saving} />

              <div>Name</div>
              <input value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />

              <div>Type</div>
              <select
                value={type}
                onChange={(e) => {
                  const next = (e.target.value as TaxRateType) || 'OUTPUT';
                  setType(next);
                  setGlAccountId('');
                }}
                disabled={saving || Boolean(editing)}
              >
                <option value="OUTPUT">OUTPUT</option>
                <option value="INPUT">INPUT</option>
              </select>

              <div>Rate (%)</div>
              <input
                type="number"
                value={String(rate)}
                onChange={(e) => setRate(Number(e.target.value))}
                disabled={saving}
                step={0.01}
                min={0}
                max={100}
              />

              <div>VAT Control Account</div>
              <select value={glAccountId} onChange={(e) => setGlAccountId(e.target.value)} disabled={saving}>
                <option value="">(Optional)</option>
                {selectableAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={
                  saving ||
                  !code.trim() ||
                  !name.trim() ||
                  !(Number(rate ?? 0) >= 0 && Number(rate ?? 0) <= 100)
                }
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
