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
import {
  createImprestCase,
  listImprestCases,
  listImprestFacilities,
  type ImprestCase,
  type ImprestFacility,
} from '../../../services/imprest';

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function StatusPill(props: { state: string }) {
  const s = (props.state ?? '').toUpperCase();
  const isDraft = s === 'DRAFT';
  const isSubmitted = s === 'SUBMITTED' || s === 'IN_REVIEW';
  const isApproved = s === 'APPROVED' || s === 'ISSUANCE_PENDING_EVIDENCE';
  const isIssued = s === 'ISSUED';

  const bg = isIssued
    ? 'rgba(16,185,129,0.12)'
    : isApproved
      ? 'rgba(59,130,246,0.12)'
      : isSubmitted
        ? 'rgba(237,186,53,0.14)'
        : isDraft
          ? 'rgba(148,163,184,0.18)'
          : 'rgba(239,68,68,0.10)';

  const border = isIssued
    ? 'rgba(16,185,129,0.25)'
    : isApproved
      ? 'rgba(59,130,246,0.22)'
      : isSubmitted
        ? 'rgba(237,186,53,0.32)'
        : isDraft
          ? 'rgba(148,163,184,0.28)'
          : 'rgba(239,68,68,0.22)';

  const text = isIssued
    ? 'rgba(16,185,129,0.95)'
    : isApproved
      ? 'rgba(59,130,246,0.95)'
      : isSubmitted
        ? 'rgba(154,52,18,0.95)'
        : isDraft
          ? 'rgba(71,85,105,0.95)'
          : 'rgba(239,68,68,0.85)';

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
          width: props.width ?? 860,
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

function CaseTab(props: { label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        border: `1px solid ${props.active ? 'rgba(11,12,30,0.18)' : 'rgba(11,12,30,0.10)'}`,
        background: props.active ? 'rgba(11,12,30,0.04)' : 'transparent',
        borderRadius: 999,
        padding: '8px 12px',
        fontSize: 13,
        fontWeight: 750,
        color: tokens.colors.text.primary,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span>{props.label}</span>
      {typeof props.count === 'number' ? (
        <span
          style={{
            display: 'inline-flex',
            minWidth: 22,
            height: 20,
            padding: '0 6px',
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 800,
            background: 'rgba(11,12,30,0.06)',
            border: '1px solid rgba(11,12,30,0.08)',
            color: 'rgba(11,12,30,0.7)',
          }}
        >
          {props.count}
        </span>
      ) : null}
    </button>
  );
}

export function ImprestCasesPage() {
  const { state, hasPermission } = useAuth();
  const authLoading = Boolean(state.isAuthenticated) && !state.me;

  const canView = hasPermission(PERMISSIONS.IMPREST.CASE_VIEW);
  const canCreate = hasPermission(PERMISSIONS.IMPREST.CASE_CREATE);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [cases, setCases] = useState<ImprestCase[]>([]);
  const [facilities, setFacilities] = useState<ImprestFacility[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [facilityId, setFacilityId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [justification, setJustification] = useState('');
  const [periodFrom, setPeriodFrom] = useState(new Date().toISOString().slice(0, 10));
  const [periodTo, setPeriodTo] = useState(new Date().toISOString().slice(0, 10));
  const [expectedSettlementDate, setExpectedSettlementDate] = useState(new Date().toISOString().slice(0, 10));
  const [requestedAmount, setRequestedAmount] = useState('');
  const [currency, setCurrency] = useState('USD');

  const tab = (searchParams.get('tab') ?? 'my').trim();

  const facilityById = useMemo(() => {
    const m = new Map<string, ImprestFacility>();
    for (const f of facilities ?? []) m.set(f.id, f);
    return m;
  }, [facilities]);

  const myUserId = state.me?.user?.id ?? '';

  const filtered = useMemo(() => {
    const rows = cases ?? [];
    if (tab === 'my') return rows.filter((c) => (c.createdById ?? '') === myUserId);
    if (tab === 'review') return rows.filter((c) => ['SUBMITTED', 'IN_REVIEW'].includes((c.state ?? '').toUpperCase()));
    if (tab === 'approve') return rows.filter((c) => ['IN_REVIEW', 'APPROVED'].includes((c.state ?? '').toUpperCase()));
    if (tab === 'issue-evidence') return rows.filter((c) => (c.state ?? '').toUpperCase() === 'ISSUANCE_PENDING_EVIDENCE');
    if (tab === 'issued') return rows.filter((c) => (c.state ?? '').toUpperCase() === 'ISSUED');
    return rows;
  }, [cases, myUserId, tab]);

  const tabCounts = useMemo(() => {
    const rows = cases ?? [];
    return {
      my: rows.filter((c) => (c.createdById ?? '') === myUserId).length,
      review: rows.filter((c) => ['SUBMITTED', 'IN_REVIEW'].includes((c.state ?? '').toUpperCase())).length,
      approve: rows.filter((c) => ['IN_REVIEW', 'APPROVED'].includes((c.state ?? '').toUpperCase())).length,
      issueEvidence: rows.filter((c) => (c.state ?? '').toUpperCase() === 'ISSUANCE_PENDING_EVIDENCE').length,
      issued: rows.filter((c) => (c.state ?? '').toUpperCase() === 'ISSUED').length,
      all: rows.length,
    };
  }, [cases, myUserId]);

  useEffect(() => {
    if (!canView) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [c, f] = await Promise.all([listImprestCases(), listImprestFacilities()]);
      setCases(Array.isArray(c) ? c : []);
      setFacilities(Array.isArray(f) ? f : []);
      if (!facilityId && Array.isArray(f) && f[0]?.id) setFacilityId(f[0].id);
    } catch (e) {
      setError(getApiErrorMessage(e as ApiError, 'Failed to load imprest cases'));
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    if (!canCreate) return;
    setFormError('');
    setShowCreate(true);
    setPurpose('');
    setJustification('');
    setRequestedAmount('');
    setCurrency('USD');
    setPeriodFrom(new Date().toISOString().slice(0, 10));
    setPeriodTo(new Date().toISOString().slice(0, 10));
    setExpectedSettlementDate(new Date().toISOString().slice(0, 10));
  }

  async function onCreate() {
    setSaving(true);
    setFormError('');
    try {
      if (!facilityId) {
        setFormError('Facility is required');
        return;
      }
      if (!purpose.trim()) {
        setFormError('Purpose is required');
        return;
      }
      if (!justification.trim()) {
        setFormError('Justification is required');
        return;
      }
      if (!periodFrom.trim() || !periodTo.trim()) {
        setFormError('Period from/to is required');
        return;
      }
      if (!expectedSettlementDate.trim()) {
        setFormError('Expected settlement date is required');
        return;
      }
      if (!requestedAmount.trim()) {
        setFormError('Requested amount is required');
        return;
      }
      if (!currency.trim()) {
        setFormError('Currency is required');
        return;
      }

      const created = await createImprestCase({
        facilityId,
        purpose: purpose.trim(),
        justification: justification.trim(),
        periodFrom: periodFrom.trim(),
        periodTo: periodTo.trim(),
        expectedSettlementDate: expectedSettlementDate.trim(),
        requestedAmount: requestedAmount.trim(),
        currency: currency.trim().toUpperCase(),
      });

      setSuccess('Case created');
      setShowCreate(false);
      await refresh();
      navigate(`/finance/imprest/cases/${encodeURIComponent(created.id)}`);
    } catch (e) {
      setFormError(getApiErrorMessage(e as ApiError, 'Failed to create case'));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return <div style={{ padding: 18 }}>Loading…</div>;
  }

  if (!canView) {
    return (
      <div style={{ padding: 18 }}>
        <h2 style={{ margin: 0 }}>Imprest Cases</h2>
        <div style={{ marginTop: 10, color: '#b00020' }}>Access denied.</div>
      </div>
    );
  }

  return (
    <PageLayout
      title="Imprest Cases"
      description="Governance lifecycle only: draft → submit → review → approve → issue (with evidence gates)."
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          {canCreate ? (
            <Button variant="accent" onClick={openCreate}>
              Create Case
            </Button>
          ) : null}
          <Button onClick={() => navigate('/finance/imprest/facilities')}>Facilities</Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error ? <Alert tone="error" title="Error">{error}</Alert> : null}
        {success ? <Alert tone="success" title="Success">{success}</Alert> : null}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <CaseTab label="My Requests" active={tab === 'my'} count={tabCounts.my} onClick={() => setSearchParams({ tab: 'my' })} />
          <CaseTab label="Awaiting Review" active={tab === 'review'} count={tabCounts.review} onClick={() => setSearchParams({ tab: 'review' })} />
          <CaseTab label="Awaiting Approval" active={tab === 'approve'} count={tabCounts.approve} onClick={() => setSearchParams({ tab: 'approve' })} />
          <CaseTab
            label="Awaiting Issuance Evidence"
            active={tab === 'issue-evidence'}
            count={tabCounts.issueEvidence}
            onClick={() => setSearchParams({ tab: 'issue-evidence' })}
          />
          <CaseTab label="Issued" active={tab === 'issued'} count={tabCounts.issued} onClick={() => setSearchParams({ tab: 'issued' })} />
          <CaseTab label="All" active={tab === 'all'} count={tabCounts.all} onClick={() => setSearchParams({ tab: 'all' })} />
        </div>

        {loading ? <div>Loading…</div> : null}

        <DataTable>
          <DataTable.Head>
            <DataTable.Row>
              <DataTable.Th>Reference</DataTable.Th>
              <DataTable.Th>Facility</DataTable.Th>
              <DataTable.Th>Purpose</DataTable.Th>
              <DataTable.Th>Period</DataTable.Th>
              <DataTable.Th align="right">Amount</DataTable.Th>
              <DataTable.Th>State</DataTable.Th>
              <DataTable.Th>Updated</DataTable.Th>
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            {(filtered ?? []).length === 0 ? (
              <DataTable.Empty
                colSpan={7}
                title="No cases in this view"
                action={canCreate ? <Button onClick={openCreate}>Create Case</Button> : null}
              />
            ) : null}

            {(filtered ?? []).map((c, idx) => {
              const f = facilityById.get(c.facilityId);
              return (
                <DataTable.Row
                  key={c.id}
                  zebra
                  index={idx}
                  hoverable
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/finance/imprest/cases/${encodeURIComponent(c.id)}`)}
                >
                  <DataTable.Td>
                    <div style={{ fontWeight: 800 }}>{c.reference}</div>
                    <div style={{ marginTop: 2, fontSize: 12, color: tokens.colors.text.secondary }}>{c.id}</div>
                  </DataTable.Td>
                  <DataTable.Td>
                    <div style={{ fontWeight: 750 }}>{f?.reference ?? c.facilityId}</div>
                    <div style={{ marginTop: 2, fontSize: 12, color: tokens.colors.text.secondary }}>{f?.currency ?? ''}</div>
                  </DataTable.Td>
                  <DataTable.Td>
                    <div style={{ fontWeight: 750 }}>{c.purpose}</div>
                    <div style={{ marginTop: 2, fontSize: 12, color: tokens.colors.text.secondary, maxWidth: 440, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.justification}
                    </div>
                  </DataTable.Td>
                  <DataTable.Td>
                    <div style={{ fontWeight: 750 }}>{formatDate(c.periodFrom)} → {formatDate(c.periodTo)}</div>
                    <div style={{ marginTop: 2, fontSize: 12, color: tokens.colors.text.secondary }}>Expected settle: {formatDate(c.expectedSettlementDate)}</div>
                  </DataTable.Td>
                  <DataTable.Td align="right">
                    <div style={{ fontWeight: 800 }}>{c.requestedAmount}</div>
                    <div style={{ marginTop: 2, fontSize: 12, color: tokens.colors.text.secondary }}>{c.currency}</div>
                  </DataTable.Td>
                  <DataTable.Td>
                    <StatusPill state={c.state} />
                  </DataTable.Td>
                  <DataTable.Td>
                    <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>{formatDateTime(c.updatedAt)}</div>
                  </DataTable.Td>
                </DataTable.Row>
              );
            })}
          </DataTable.Body>
        </DataTable>
      </div>

      {showCreate ? (
        <ModalShell
          title="Create Imprest Case"
          subtitle="You will be blocked from submitting without supporting documents."
          onClose={saving ? () => {} : () => setShowCreate(false)}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="ghost" disabled={saving} onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button variant="accent" disabled={saving} onClick={onCreate}>
                {saving ? 'Creating…' : 'Create'}
              </Button>
            </div>
          }
        >
          {formError ? <Alert tone="error" title="Cannot create">{formError}</Alert> : null}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Facility" hint="Only ACTIVE facilities are expected to be usable (enforced by backend).">
              <Select
                value={facilityId}
                onChange={setFacilityId}
                options={(facilities ?? []).map((f) => ({ value: f.id, label: `${f.reference ?? f.id} (${f.currency})` }))}
              />
            </Field>

            <Field label="Currency">
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="USD" />
            </Field>

            <Field label="Requested Amount" hint="String amount (backend expects string/decimal).">
              <Input value={requestedAmount} onChange={(e) => setRequestedAmount(e.target.value)} inputMode="decimal" />
            </Field>

            <div />

            <Field label="Period From">
              <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
            </Field>

            <Field label="Period To">
              <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
            </Field>

            <Field label="Expected Settlement Date">
              <Input type="date" value={expectedSettlementDate} onChange={(e) => setExpectedSettlementDate(e.target.value)} />
            </Field>

            <div />

            <Field label="Purpose">
              <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Travel imprest" />
            </Field>

            <Field label="Justification">
              <Input value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Explain why this imprest is needed" />
            </Field>
          </div>

          {(facilities ?? []).length === 0 ? (
            <div style={{ marginTop: 14 }}>
              <Alert tone="warning" title="No facilities">Create an Imprest Facility first.</Alert>
            </div>
          ) : null}
        </ModalShell>
      ) : null}
    </PageLayout>
  );
}
