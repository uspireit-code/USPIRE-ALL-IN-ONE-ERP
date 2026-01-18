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
import { listBankCashAccounts, type BankCashAccount } from '../../../services/bankAccounts';
import { listDepartments, listGlAccounts, listLegalEntities, type DepartmentLookup, type GlAccountLookup, type LegalEntityLookup } from '../../../services/gl';
import { listSettingsUsers, type SettingsUser } from '../../../services/settings';
import {
  createImprestFacility,
  listImprestFacilities,
  listImprestTypePolicies,
  updateImprestFacility,
  type ImprestFacility,
  type ImprestRiskRating,
  type ImprestTypePolicy,
} from '../../../services/imprest';

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

function StatusPill(props: { status: string }) {
  const s = (props.status ?? '').toUpperCase();
  const isActive = s === 'ACTIVE';
  const isSuspended = s === 'SUSPENDED';
  const bg = isActive ? 'rgba(16,185,129,0.12)' : isSuspended ? 'rgba(237,186,53,0.14)' : 'rgba(239,68,68,0.10)';
  const border = isActive ? 'rgba(16,185,129,0.25)' : isSuspended ? 'rgba(237,186,53,0.32)' : 'rgba(239,68,68,0.22)';
  const text = isActive ? 'rgba(16,185,129,0.95)' : isSuspended ? 'rgba(154,52,18,0.95)' : 'rgba(239,68,68,0.85)';

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
          width: props.width ?? 820,
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

function asOptions<T extends { id: string; name?: string; code?: string }>(
  rows: T[],
  label: (row: T) => string,
): Array<{ value: string; label: string }> {
  return (rows ?? []).map((r) => ({ value: r.id, label: label(r) }));
}

export function ImprestFacilitiesPage() {
  const { state, hasPermission } = useAuth();
  const authLoading = Boolean(state.isAuthenticated) && !state.me;

  const canView = hasPermission(PERMISSIONS.IMPREST.FACILITY_VIEW);
  const canCreate = hasPermission(PERMISSIONS.IMPREST.FACILITY_CREATE);
  const canEdit = hasPermission(PERMISSIONS.IMPREST.FACILITY_EDIT);
  const canSuspend = hasPermission(PERMISSIONS.IMPREST.FACILITY_SUSPEND);
  const canClose = hasPermission(PERMISSIONS.IMPREST.FACILITY_CLOSE);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<ImprestFacility[]>([]);
  const [policies, setPolicies] = useState<ImprestTypePolicy[]>([]);
  const [users, setUsers] = useState<SettingsUser[]>([]);
  const [entities, setEntities] = useState<LegalEntityLookup[]>([]);
  const [departments, setDepartments] = useState<DepartmentLookup[]>([]);
  const [glAccounts, setGlAccounts] = useState<GlAccountLookup[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankCashAccount[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const editingId = (searchParams.get('edit') ?? '').trim();
  const editing = useMemo(() => rows.find((f) => f.id === editingId) ?? null, [editingId, rows]);
  const isEditing = Boolean(editingId);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [typePolicyId, setTypePolicyId] = useState('');
  const [custodianUserId, setCustodianUserId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [approvedFloatLimit, setApprovedFloatLimit] = useState('5000');
  const [settlementDays, setSettlementDays] = useState('7');
  const [fundingSourceType, setFundingSourceType] = useState<'BANK' | 'CASH' | 'MOBILE_MONEY'>('BANK');
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [riskRating, setRiskRating] = useState<ImprestRiskRating>('LOW');
  const [controlGlAccountId, setControlGlAccountId] = useState('');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [validTo, setValidTo] = useState(new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10));

  const bankOnly = useMemo(() => (bankAccounts ?? []).filter((b) => (b.type ?? '').toUpperCase() === 'BANK'), [bankAccounts]);
  const activeBalanceSheetAccounts = useMemo(
    () => (glAccounts ?? []).filter((a) => a.isActive),
    [glAccounts],
  );

  useEffect(() => {
    if (!canView) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  useEffect(() => {
    if (!isEditing) return;
    if (!editing) return;

    setShowForm(true);
    setTypePolicyId(editing.typePolicyId ?? '');
    setCustodianUserId(editing.custodianUserId ?? '');
    setEntityId(editing.entityId ?? '');
    setDepartmentId(editing.departmentId ?? '');
    setCurrency(editing.currency ?? '');
    setApprovedFloatLimit(String(editing.approvedFloatLimit ?? ''));
    setSettlementDays(String(editing.settlementDays ?? ''));
    setFundingSourceType((editing.fundingSourceType ?? 'BANK') as any);
    setBankAccountId(editing.bankAccountId ?? '');
    setRiskRating((editing.riskRating ?? 'LOW') as any);
    setControlGlAccountId(editing.controlGlAccountId ?? '');
    setValidFrom(String(editing.validFrom ?? '').slice(0, 10));
    setValidTo(String(editing.validTo ?? '').slice(0, 10));
  }, [editing, isEditing]);

  async function refresh() {
    if (!canView) return;
    setLoading(true);
    setError('');
    try {
      const [facilities, typePolicies, settingsUsers, le, deps, accounts, banks] = await Promise.all([
        listImprestFacilities(),
        listImprestTypePolicies(),
        listSettingsUsers(),
        listLegalEntities(),
        listDepartments(),
        listGlAccounts(),
        listBankCashAccounts(),
      ]);

      setRows(Array.isArray(facilities) ? facilities : []);
      setPolicies(Array.isArray(typePolicies) ? typePolicies : []);
      setUsers(Array.isArray(settingsUsers) ? settingsUsers : []);
      setEntities(Array.isArray(le) ? le : []);
      setDepartments(Array.isArray(deps) ? deps : []);
      setGlAccounts(Array.isArray(accounts) ? accounts : []);
      setBankAccounts(Array.isArray(banks) ? banks : []);

      if (!typePolicyId && Array.isArray(typePolicies) && typePolicies[0]?.id) setTypePolicyId(typePolicies[0].id);
      if (!custodianUserId && Array.isArray(settingsUsers) && settingsUsers[0]?.id) setCustodianUserId(settingsUsers[0].id);
      if (!entityId && Array.isArray(le) && le[0]?.id) setEntityId(le[0].id);
      if (!departmentId && Array.isArray(deps) && deps[0]?.id) setDepartmentId(deps[0].id);
      if (!controlGlAccountId && Array.isArray(accounts) && accounts[0]?.id) setControlGlAccountId(accounts[0].id);
      if (!bankAccountId && Array.isArray(banks)) {
        const firstBank = banks.find((b) => (b.type ?? '').toUpperCase() === 'BANK');
        if (firstBank) setBankAccountId(firstBank.id);
      }
    } catch (e) {
      setError(getApiErrorMessage(e as ApiError, 'Failed to load imprest facilities'));
    } finally {
      setLoading(false);
    }
  }

  function clearForm() {
    setTypePolicyId(policies[0]?.id ?? '');
    setCustodianUserId(users[0]?.id ?? '');
    setEntityId(entities[0]?.id ?? '');
    setDepartmentId(departments[0]?.id ?? '');
    setCurrency('USD');
    setApprovedFloatLimit('5000');
    setSettlementDays('7');
    setFundingSourceType('BANK');
    setBankAccountId(bankOnly[0]?.id ?? '');
    setRiskRating('LOW');
    setControlGlAccountId(activeBalanceSheetAccounts[0]?.id ?? '');
    setValidFrom(new Date().toISOString().slice(0, 10));
    setValidTo(new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10));
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
      if (!typePolicyId) {
        setFormError('Type policy is required');
        return;
      }
      if (!custodianUserId) {
        setFormError('Custodian is required');
        return;
      }
      if (!entityId) {
        setFormError('Entity is required');
        return;
      }
      if (!departmentId) {
        setFormError('Department is required');
        return;
      }
      if (!currency.trim()) {
        setFormError('Currency is required');
        return;
      }
      if (!approvedFloatLimit.trim()) {
        setFormError('Approved float limit is required');
        return;
      }
      if (!controlGlAccountId) {
        setFormError('Imprest control GL account is required');
        return;
      }
      if (!validFrom.trim() || !validTo.trim()) {
        setFormError('Valid from/to dates are required');
        return;
      }
      if (fundingSourceType === 'BANK' && !bankAccountId) {
        setFormError('Bank account is required when funding source is BANK');
        return;
      }

      if (isEditing) {
        if (!canEdit) {
          setFormError('You do not have permission to edit facilities');
          return;
        }

        if ((editing?.status ?? 'ACTIVE') === 'CLOSED') {
          setFormError('Closed facilities cannot be edited');
          return;
        }

        await updateImprestFacility(editingId, {
          typePolicyId,
          custodianUserId,
          entityId,
          departmentId,
          currency: currency.trim().toUpperCase(),
          approvedFloatLimit: approvedFloatLimit.trim(),
          settlementDays: parsedSettlementDays,
          fundingSourceType,
          bankAccountId: fundingSourceType === 'BANK' ? bankAccountId : null,
          riskRating,
          controlGlAccountId,
          validFrom: validFrom.trim(),
          validTo: validTo.trim(),
        } as any);

        setSuccess('Facility updated');
      } else {
        if (!canCreate) {
          setFormError('You do not have permission to create facilities');
          return;
        }
        await createImprestFacility({
          typePolicyId,
          custodianUserId,
          entityId,
          departmentId,
          currency: currency.trim().toUpperCase(),
          approvedFloatLimit: approvedFloatLimit.trim(),
          settlementDays: parsedSettlementDays,
          fundingSourceType,
          bankAccountId: fundingSourceType === 'BANK' ? bankAccountId : undefined,
          riskRating,
          controlGlAccountId,
          validFrom: validFrom.trim(),
          validTo: validTo.trim(),
        });
        setSuccess('Facility created');
      }

      await refresh();
      closeForm();
    } catch (e) {
      setFormError(getApiErrorMessage(e as ApiError, 'Failed to save facility'));
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(row: ImprestFacility, status: 'SUSPENDED' | 'ACTIVE' | 'CLOSED') {
    setError('');
    setSuccess('');
    try {
      await updateImprestFacility(row.id, { status } as any);
      setSuccess(`Facility status updated to ${status}`);
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e as ApiError, 'Failed to update facility status'));
    }
  }

  const typePolicyById = useMemo(() => {
    const m = new Map<string, ImprestTypePolicy>();
    for (const p of policies ?? []) m.set(p.id, p);
    return m;
  }, [policies]);

  const userById = useMemo(() => {
    const m = new Map<string, SettingsUser>();
    for (const u of users ?? []) m.set(u.id, u);
    return m;
  }, [users]);

  const entityById = useMemo(() => {
    const m = new Map<string, LegalEntityLookup>();
    for (const e of entities ?? []) m.set(e.id, e);
    return m;
  }, [entities]);

  const departmentById = useMemo(() => {
    const m = new Map<string, DepartmentLookup>();
    for (const d of departments ?? []) m.set(d.id, d);
    return m;
  }, [departments]);

  const glById = useMemo(() => {
    const m = new Map<string, GlAccountLookup>();
    for (const a of glAccounts ?? []) m.set(a.id, a);
    return m;
  }, [glAccounts]);

  if (authLoading) {
    return <div style={{ padding: 18 }}>Loading…</div>;
  }

  if (!canView) {
    return (
      <div style={{ padding: 18 }}>
        <h2 style={{ margin: 0 }}>Imprest Facilities</h2>
        <div style={{ marginTop: 10, color: '#b00020' }}>Access denied.</div>
      </div>
    );
  }

  const canAccessForm = isEditing ? canEdit : canCreate;

  return (
    <PageLayout
      title="Imprest Facilities"
      description="Governance: define custodian, funding source, and control account. Status transitions are enforced." 
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          {canCreate ? (
            <Button variant="accent" onClick={openCreate}>
              Create Facility
            </Button>
          ) : null}
          <Button onClick={() => navigate('/finance/imprest/policies')}>Types</Button>
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
              <DataTable.Th>Facility</DataTable.Th>
              <DataTable.Th>Type Policy</DataTable.Th>
              <DataTable.Th>Custodian</DataTable.Th>
              <DataTable.Th>Entity</DataTable.Th>
              <DataTable.Th>Department</DataTable.Th>
              <DataTable.Th>Currency</DataTable.Th>
              <DataTable.Th align="right">Approved Float</DataTable.Th>
              <DataTable.Th align="right">Settlement Days</DataTable.Th>
              <DataTable.Th>Risk</DataTable.Th>
              <DataTable.Th>Status</DataTable.Th>
              <DataTable.Th>Actions</DataTable.Th>
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            {(rows ?? []).length === 0 ? (
              <DataTable.Empty
                colSpan={11}
                title="No imprest facilities"
                action={canCreate ? <Button onClick={openCreate}>Create Facility</Button> : null}
              />
            ) : null}

            {(rows ?? []).map((r, idx) => {
              const tp = typePolicyById.get(r.typePolicyId);
              const custodian = userById.get(r.custodianUserId);
              const le = entityById.get(r.entityId);
              const dep = departmentById.get(r.departmentId);
              const status = (r.status ?? 'ACTIVE').toUpperCase();

              const isClosed = status === 'CLOSED';

              return (
                <DataTable.Row key={r.id} zebra index={idx}>
                  <DataTable.Td>
                    <div style={{ fontWeight: 750 }}>{r.reference ?? r.id}</div>
                    <div style={{ marginTop: 2, fontSize: 12, color: tokens.colors.text.secondary }}>Updated: {formatDateTime(r.updatedAt)}</div>
                  </DataTable.Td>
                  <DataTable.Td>{tp?.name ?? r.typePolicyId}</DataTable.Td>
                  <DataTable.Td>{custodian?.email ?? r.custodianUserId}</DataTable.Td>
                  <DataTable.Td>{le ? `${le.code} — ${le.name}` : r.entityId}</DataTable.Td>
                  <DataTable.Td>{dep ? `${dep.code} — ${dep.name}` : r.departmentId}</DataTable.Td>
                  <DataTable.Td>{r.currency}</DataTable.Td>
                  <DataTable.Td align="right">{r.approvedFloatLimit}</DataTable.Td>
                  <DataTable.Td align="right">{r.settlementDays}</DataTable.Td>
                  <DataTable.Td>{r.riskRating}</DataTable.Td>
                  <DataTable.Td>
                    <StatusPill status={status} />
                  </DataTable.Td>
                  <DataTable.Td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {canEdit ? (
                        <Button size="sm" disabled={isClosed} title={isClosed ? 'Closed facilities cannot be edited' : ''} onClick={() => openEdit(r.id)}>
                          Edit
                        </Button>
                      ) : null}

                      {canSuspend ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={isClosed}
                          title={isClosed ? 'Closed facilities cannot change status' : ''}
                          onClick={() => updateStatus(r, status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED')}
                        >
                          {status === 'SUSPENDED' ? 'Re-Activate' : 'Suspend'}
                        </Button>
                      ) : null}

                      {canClose ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isClosed}
                          title={isClosed ? 'Already closed' : 'Close facility'}
                          onClick={() => updateStatus(r, 'CLOSED')}
                        >
                          Close
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
          title={isEditing ? 'Edit Imprest Facility' : 'Create Imprest Facility'}
          subtitle={isEditing ? `Facility ID: ${editingId}` : 'Dimensions and status transitions are enforced by backend rules.'}
          onClose={saving ? () => {} : closeForm}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>No edits are allowed when status is CLOSED.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="ghost" disabled={saving} onClick={closeForm}>
                  Cancel
                </Button>
                <Button variant="accent" disabled={saving || !canAccessForm} onClick={onSave}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          }
        >
          {!canAccessForm ? <Alert tone="warning" title="Read-only">You do not have permission to {isEditing ? 'edit' : 'create'} facilities.</Alert> : null}
          {formError ? <Alert tone="error" title="Cannot save">{formError}</Alert> : null}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Type Policy">
              <Select
                value={typePolicyId}
                onChange={setTypePolicyId}
                disabled={!canAccessForm}
                options={asOptions(policies, (p) => p.name)}
              />
            </Field>

            <Field label="Custodian">
              <Select
                value={custodianUserId}
                onChange={setCustodianUserId}
                disabled={!canAccessForm}
                options={asOptions(users, (u) => `${u.email}${u.name ? ` (${u.name})` : ''}`)}
              />
            </Field>

            <Field label="Entity">
              <Select
                value={entityId}
                onChange={setEntityId}
                disabled={!canAccessForm}
                options={asOptions(entities, (e) => `${e.code} — ${e.name}`)}
              />
            </Field>

            <Field label="Department">
              <Select
                value={departmentId}
                onChange={setDepartmentId}
                disabled={!canAccessForm}
                options={asOptions(departments, (d) => `${d.code} — ${d.name}`)}
              />
            </Field>

            <Field label="Currency">
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={!canAccessForm} placeholder="USD" />
            </Field>

            <Field label="Approved Float Limit" hint="String amount (backend expects string/decimal).">
              <Input value={approvedFloatLimit} onChange={(e) => setApprovedFloatLimit(e.target.value)} disabled={!canAccessForm} inputMode="decimal" />
            </Field>

            <Field label="Settlement Days">
              <Input value={settlementDays} onChange={(e) => setSettlementDays(e.target.value)} disabled={!canAccessForm} inputMode="numeric" />
            </Field>

            <Field label="Risk Rating">
              <Select
                value={riskRating}
                onChange={(v) => setRiskRating(v as any)}
                disabled={!canAccessForm}
                options={[
                  { value: 'LOW', label: 'LOW' },
                  { value: 'MEDIUM', label: 'MEDIUM' },
                  { value: 'HIGH', label: 'HIGH' },
                ]}
              />
            </Field>

            <Field label="Funding Source">
              <Select
                value={fundingSourceType}
                onChange={(v) => {
                  setFundingSourceType(v as any);
                }}
                disabled={!canAccessForm}
                options={[
                  { value: 'BANK', label: 'BANK' },
                  { value: 'CASH', label: 'CASH' },
                  { value: 'MOBILE_MONEY', label: 'MOBILE_MONEY' },
                ]}
              />
            </Field>

            <Field label="Bank Account" hint={fundingSourceType === 'BANK' ? 'Required when funding source is BANK.' : 'Not applicable for non-BANK funding sources.'}>
              <Select
                value={bankAccountId}
                onChange={setBankAccountId}
                disabled={!canAccessForm || fundingSourceType !== 'BANK'}
                options={bankOnly.length ? asOptions(bankOnly, (b) => `${b.name} (${b.currency})`) : [{ value: '', label: 'No bank accounts found' }]}
              />
            </Field>

            <Field label="Imprest Control GL Account">
              <Select
                value={controlGlAccountId}
                onChange={setControlGlAccountId}
                disabled={!canAccessForm}
                options={asOptions(activeBalanceSheetAccounts, (a) => `${a.code} — ${a.name}`)}
              />
              {controlGlAccountId ? (
                <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.secondary }}>
                  Selected: {glById.get(controlGlAccountId)?.type ?? ''}
                </div>
              ) : null}
            </Field>

            <Field label="Valid From">
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} disabled={!canAccessForm} />
            </Field>

            <Field label="Valid To">
              <Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} disabled={!canAccessForm} />
            </Field>
          </div>

          {isEditing ? (
            <div style={{ marginTop: 14 }}>
              <Alert tone="info" title="Status transitions">
                Use the row actions (Suspend/Close). Editing the status directly is not supported in this screen.
              </Alert>
            </div>
          ) : null}

          <div style={{ marginTop: 14, fontSize: 12, color: tokens.colors.text.secondary }}>
            Validity: {formatDate(validFrom)} → {formatDate(validTo)}
          </div>
        </ModalShell>
      ) : null}
    </PageLayout>
  );
}
