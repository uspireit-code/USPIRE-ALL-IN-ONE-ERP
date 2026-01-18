import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { PERMISSIONS } from '../../../auth/permission-catalog';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { DataTable } from '../../../components/DataTable';
import { Input } from '../../../components/Input';
import { PageLayout } from '../../../components/PageLayout';
import { tokens } from '../../../designTokens';
import { getApiErrorMessage, type ApiError } from '../../../services/api';
import { createImprestTypePolicy, listImprestTypePolicies, updateImprestTypePolicy, type ImprestTypePolicy } from '../../../services/imprest';

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function StatusPill(props: { label: string }) {
  const s = String(props.label ?? '').toUpperCase();
  const isActive = s === 'ACTIVE' || s === 'TRUE' || s === 'ENABLED';
  const bg = isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)';
  const border = isActive ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.22)';
  const text = isActive ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.85)';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        fontSize: 12,
        fontWeight: 750,
        color: text,
        whiteSpace: 'nowrap',
      }}
    >
      {s || '—'}
    </span>
  );
}

function ModalShell(props: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  return (
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
        zIndex: 50,
      }}
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) props.onClose();
      }}
    >
      <div
        style={{
          width: props.width ?? 720,
          maxWidth: '96vw',
          maxHeight: '85vh',
          background: '#fff',
          borderRadius: 16,
          border: '1px solid rgba(11,12,30,0.08)',
          boxShadow: '0 10px 30px rgba(11,12,30,0.20)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: 16,
            borderBottom: '1px solid rgba(11,12,30,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: tokens.colors.text.primary }}>{props.title}</div>
            {props.subtitle ? (
              <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>{props.subtitle}</div>
            ) : null}
          </div>
          <Button variant="ghost" size="sm" onClick={props.onClose}>
            Close
          </Button>
        </div>

        <div style={{ padding: 16, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>{props.children}</div>

        {props.footer ? (
          <div
            style={{
              padding: 16,
              borderTop: '1px solid rgba(11,12,30,0.08)',
              boxShadow: '0 -8px 20px rgba(11,12,30,0.06)',
              background: '#fff',
            }}
          >
            {props.footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Select(props: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={props.value}
      disabled={props.disabled}
      onChange={(e) => props.onChange(e.target.value)}
      style={{
        width: '100%',
        height: 40,
        padding: '0 10px',
        borderRadius: tokens.radius.sm,
        border: `1px solid ${tokens.colors.border.default}`,
        background: tokens.colors.white,
        color: tokens.colors.text.primary,
        fontSize: 14,
        outline: 'none',
        boxSizing: 'border-box',
        opacity: props.disabled ? 0.6 : 1,
      }}
    >
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Field(props: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 750, color: tokens.colors.text.primary }}>{props.label}</div>
      {props.hint ? <div style={{ marginTop: 4, fontSize: 12, color: tokens.colors.text.secondary }}>{props.hint}</div> : null}
      <div style={{ marginTop: 6 }}>{props.children}</div>
    </div>
  );
}

export function ImprestPoliciesPage() {
  const { state, hasPermission } = useAuth();
  const authLoading = Boolean(state.isAuthenticated) && !state.me;

  const canView = hasPermission(PERMISSIONS.IMPREST.TYPE_POLICY_VIEW);
  const canCreate = hasPermission(PERMISSIONS.IMPREST.TYPE_POLICY_CREATE);
  const canEdit = hasPermission(PERMISSIONS.IMPREST.TYPE_POLICY_EDIT);
  const canDeactivate = hasPermission(PERMISSIONS.IMPREST.TYPE_POLICY_DEACTIVATE);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState<ImprestTypePolicy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const editingId = (searchParams.get('edit') ?? '').trim();
  const editing = useMemo(() => items.find((p) => p.id === editingId) ?? null, [editingId, items]);

  const isEditing = Boolean(editingId);

  const [name, setName] = useState('');
  const [defaultFloatLimit, setDefaultFloatLimit] = useState('5000');
  const [settlementDays, setSettlementDays] = useState('7');
  const [receiptRule, setReceiptRule] = useState('REQUIRED');
  const [receiptThresholdAmount, setReceiptThresholdAmount] = useState('');
  const [approvalStrength, setApprovalStrength] = useState('STANDARD');
  const [defaultRiskRating, setDefaultRiskRating] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('LOW');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!isEditing) return;
    if (!editing) return;

    setShowForm(true);
    setName(editing.name ?? '');
    setDefaultFloatLimit(String(editing.defaultFloatLimit ?? ''));
    setSettlementDays(String(editing.settlementDays ?? ''));
    setReceiptRule(String(editing.receiptRule ?? 'REQUIRED'));
    setReceiptThresholdAmount(String(editing.receiptThresholdAmount ?? ''));
    setApprovalStrength(String(editing.approvalStrength ?? 'STANDARD'));
    setDefaultRiskRating((editing.defaultRiskRating ?? 'LOW') as any);
    setEffectiveFrom(String(editing.effectiveFrom ?? '').slice(0, 10));
    setEffectiveTo(editing.effectiveTo ? String(editing.effectiveTo).slice(0, 10) : '');
    setIsActive(Boolean((editing as any).isActive ?? true));
  }, [editing, isEditing]);

  useEffect(() => {
    if (!canView) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  async function refresh() {
    if (!canView) return;
    setLoading(true);
    setError('');
    try {
      const res = await listImprestTypePolicies();
      setItems(Array.isArray(res) ? res : []);
    } catch (e) {
      setError(getApiErrorMessage(e as ApiError, 'Failed to load imprest type policies'));
    } finally {
      setLoading(false);
    }
  }

  function clearForm() {
    setName('');
    setDefaultFloatLimit('5000');
    setSettlementDays('7');
    setReceiptRule('REQUIRED');
    setReceiptThresholdAmount('');
    setApprovalStrength('STANDARD');
    setDefaultRiskRating('LOW');
    setEffectiveFrom(new Date().toISOString().slice(0, 10));
    setEffectiveTo('');
    setIsActive(true);
  }

  function openCreate() {
    if (!canCreate) return;
    setFormError('');
    setSuccess('');
    setShowForm(true);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('edit');
      return p;
    });
    clearForm();
  }

  function openEdit(id: string) {
    if (!canEdit) return;
    setFormError('');
    setSuccess('');
    setShowForm(true);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('edit', id);
      return p;
    });
  }

  function closeForm() {
    setShowForm(false);
    setFormError('');
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('edit');
      return p;
    });
  }

  async function onSave() {
    setSaving(true);
    setFormError('');
    setSuccess('');
    try {
      const parsedSettlementDays = Number(settlementDays);
      if (!Number.isFinite(parsedSettlementDays) || parsedSettlementDays < 1) {
        setFormError('Settlement days must be a number >= 1');
        return;
      }
      if (!name.trim()) {
        setFormError('Name is required');
        return;
      }
      if (!defaultFloatLimit.trim()) {
        setFormError('Default float limit is required');
        return;
      }
      if (!effectiveFrom.trim()) {
        setFormError('Effective from is required');
        return;
      }

      if (isEditing) {
        if (!canEdit) {
          setFormError('You do not have permission to edit policies');
          return;
        }
        await updateImprestTypePolicy(editingId, {
          name: name.trim(),
          defaultFloatLimit: defaultFloatLimit.trim(),
          settlementDays: parsedSettlementDays,
          receiptRule: receiptRule.trim(),
          receiptThresholdAmount: receiptThresholdAmount.trim() ? receiptThresholdAmount.trim() : null,
          approvalStrength: approvalStrength.trim(),
          defaultRiskRating,
          effectiveFrom: effectiveFrom.trim(),
          effectiveTo: effectiveTo.trim() ? effectiveTo.trim() : null,
          isActive,
        });
        setSuccess('Policy updated');
      } else {
        if (!canCreate) {
          setFormError('You do not have permission to create policies');
          return;
        }
        await createImprestTypePolicy({
          name: name.trim(),
          defaultFloatLimit: defaultFloatLimit.trim(),
          settlementDays: parsedSettlementDays,
          receiptRule: receiptRule.trim(),
          receiptThresholdAmount: receiptThresholdAmount.trim() ? receiptThresholdAmount.trim() : undefined,
          approvalStrength: approvalStrength.trim(),
          defaultRiskRating,
          effectiveFrom: effectiveFrom.trim(),
          effectiveTo: effectiveTo.trim() ? effectiveTo.trim() : undefined,
        });
        setSuccess('Policy created');
      }

      await refresh();
      closeForm();
    } catch (e) {
      setFormError(getApiErrorMessage(e as ApiError, 'Failed to save policy'));
    } finally {
      setSaving(false);
    }
  }

  async function onDeactivate(row: ImprestTypePolicy) {
    if (!canDeactivate) return;
    setError('');
    setSuccess('');
    try {
      await updateImprestTypePolicy(row.id, { isActive: false });
      setSuccess('Policy deactivated');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e as ApiError, 'Failed to deactivate policy'));
    }
  }

  if (authLoading) {
    return <div style={{ padding: 18 }}>Loading…</div>;
  }

  if (!canView) {
    return (
      <div style={{ padding: 18 }}>
        <h2 style={{ margin: 0 }}>Imprest Type Policies</h2>
        <div style={{ marginTop: 10, color: '#b00020' }}>Access denied.</div>
      </div>
    );
  }

  return (
    <PageLayout
      title="Imprest Type Policies"
      description="Governance: define float limits, settlement days, evidence/receipt rules, and effective dates."
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          {canCreate ? (
            <Button variant="accent" onClick={openCreate}>
              Create Policy
            </Button>
          ) : null}
          <Button onClick={() => navigate('/finance/imprest/facilities')}>Facilities</Button>
          <Button onClick={() => navigate('/finance/imprest/cases')}>Cases</Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error ? <Alert tone="error" title="Error">{error}</Alert> : null}
        {success ? <Alert tone="success" title="Success">{success}</Alert> : null}

        {loading ? <div>Loading…</div> : null}

        <DataTable>
          <DataTable.Head>
            <DataTable.Row>
              <DataTable.Th>Name</DataTable.Th>
              <DataTable.Th align="right">Default Float</DataTable.Th>
              <DataTable.Th align="right">Settlement Days</DataTable.Th>
              <DataTable.Th>Receipt Rule</DataTable.Th>
              <DataTable.Th>Approval Strength</DataTable.Th>
              <DataTable.Th>Risk</DataTable.Th>
              <DataTable.Th>Status</DataTable.Th>
              <DataTable.Th>Effective</DataTable.Th>
              <DataTable.Th>Actions</DataTable.Th>
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            {(items ?? []).length === 0 ? (
              <DataTable.Empty
                colSpan={9}
                title="No imprest type policies"
                action={canCreate ? <Button onClick={openCreate}>Create Policy</Button> : null}
              />
            ) : null}

            {(items ?? []).map((row, idx) => {
              const statusLabel = (row as any).status ?? ((row as any).isActive === false ? 'INACTIVE' : 'ACTIVE');
              const effective = `${formatDate(row.effectiveFrom)}${row.effectiveTo ? ` → ${formatDate(row.effectiveTo)}` : ''}`;

              return (
                <DataTable.Row key={row.id} zebra index={idx}>
                  <DataTable.Td>
                    <div style={{ fontWeight: 750 }}>{row.name}</div>
                    <div style={{ marginTop: 2, fontSize: 12, color: tokens.colors.text.secondary }}>Updated: {formatDateTime(row.updatedAt)}</div>
                  </DataTable.Td>
                  <DataTable.Td align="right">{row.defaultFloatLimit}</DataTable.Td>
                  <DataTable.Td align="right">{row.settlementDays}</DataTable.Td>
                  <DataTable.Td>{row.receiptRule}</DataTable.Td>
                  <DataTable.Td>{row.approvalStrength}</DataTable.Td>
                  <DataTable.Td>{row.defaultRiskRating}</DataTable.Td>
                  <DataTable.Td>
                    <StatusPill label={String(statusLabel)} />
                  </DataTable.Td>
                  <DataTable.Td>{effective}</DataTable.Td>
                  <DataTable.Td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {canEdit ? <Button size="sm" onClick={() => openEdit(row.id)}>Edit</Button> : null}
                      {canDeactivate ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={String(statusLabel).toUpperCase() !== 'ACTIVE'}
                          title={String(statusLabel).toUpperCase() !== 'ACTIVE' ? 'Already inactive' : 'Deactivate policy'}
                          onClick={() => onDeactivate(row)}
                        >
                          Deactivate
                        </Button>
                      ) : null}
                    </div>
                  </DataTable.Td>
                </DataTable.Row>
              );
            })}
          </DataTable.Body>
        </DataTable>
      </div>

      {showForm ? (
        <ModalShell
          title={isEditing ? 'Edit Imprest Type Policy' : 'Create Imprest Type Policy'}
          subtitle={isEditing ? `Policy ID: ${editingId}` : 'Define effective-dated rules. No delete; only deactivate.'}
          onClose={saving ? () => {} : closeForm}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>Changes are audited. Effective dating is enforced by backend rules.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="ghost" disabled={saving} onClick={closeForm}>
                  Cancel
                </Button>
                <Button variant="accent" disabled={saving} onClick={onSave}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          }
        >
          {formError ? <Alert tone="error" title="Cannot save">{formError}</Alert> : null}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Petty Cash" />
            </Field>

            <Field label="Default Float Limit" hint="String amount (backend expects string/decimal).">
              <Input value={defaultFloatLimit} onChange={(e) => setDefaultFloatLimit(e.target.value)} placeholder="5000" inputMode="decimal" />
            </Field>

            <Field label="Settlement Days">
              <Input value={settlementDays} onChange={(e) => setSettlementDays(e.target.value)} placeholder="7" inputMode="numeric" />
            </Field>

            <Field label="Receipt Rule">
              <Select
                value={receiptRule}
                onChange={setReceiptRule}
                options={[
                  { value: 'REQUIRED', label: 'REQUIRED' },
                  { value: 'OPTIONAL', label: 'OPTIONAL' },
                  { value: 'THRESHOLD', label: 'THRESHOLD' },
                ]}
              />
            </Field>

            <Field label="Receipt Threshold" hint="Only used if Receipt Rule is THRESHOLD.">
              <Input value={receiptThresholdAmount} onChange={(e) => setReceiptThresholdAmount(e.target.value)} placeholder="" inputMode="decimal" />
            </Field>

            <Field label="Approval Strength">
              <Select
                value={approvalStrength}
                onChange={setApprovalStrength}
                options={[
                  { value: 'STANDARD', label: 'STANDARD' },
                  { value: 'STRICT', label: 'STRICT' },
                ]}
              />
            </Field>

            <Field label="Default Risk Rating">
              <Select
                value={defaultRiskRating}
                onChange={(v) => setDefaultRiskRating(v as any)}
                options={[
                  { value: 'LOW', label: 'LOW' },
                  { value: 'MEDIUM', label: 'MEDIUM' },
                  { value: 'HIGH', label: 'HIGH' },
                ]}
              />
            </Field>

            <Field label="Effective From">
              <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </Field>

            <Field label="Effective To" hint="Optional. Leave blank for open-ended.">
              <Input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
            </Field>

            <Field label="Status" hint="No delete. Use deactivate.">
              <Select
                value={isActive ? 'ACTIVE' : 'INACTIVE'}
                onChange={(v) => setIsActive(v === 'ACTIVE')}
                disabled={!canDeactivate}
                options={[
                  { value: 'ACTIVE', label: 'ACTIVE' },
                  { value: 'INACTIVE', label: 'INACTIVE' },
                ]}
              />
            </Field>
          </div>
        </ModalShell>
      ) : null}
    </PageLayout>
  );
}
