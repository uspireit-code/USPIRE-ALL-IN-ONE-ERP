import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { Alert } from '../../../components/Alert';
import { DataTable } from '../../../components/DataTable';
import { tokens } from '../../../designTokens';
import { getApiErrorMessage } from '../../../services/api';
import {
  listJournalBrowser,
  type JournalBrowserFilters,
  type JournalBrowserListResponse,
  type JournalBrowserRow,
} from '../../../services/gl';

function RiskBadge(props: { score: number | null | undefined }) {
  const score = typeof props.score === 'number' && Number.isFinite(props.score) ? props.score : 0;
  const band = score >= 40 ? 'HIGH' : score >= 20 ? 'MEDIUM' : 'LOW';
  const bg = band === 'HIGH' ? '#fee2e2' : band === 'MEDIUM' ? '#fff7ed' : '#e7f6ec';
  const color = band === 'HIGH' ? '#991b1b' : band === 'MEDIUM' ? '#9a3412' : '#166534';

  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, background: bg, color, fontSize: 12, fontWeight: 750 }}>
      {band}
    </span>
  );
}

function BudgetBadge(props: { status: string | null | undefined }) {
  const s = (props.status ?? 'OK').toUpperCase();
  const status = s === 'BLOCK' || s === 'WARN' || s === 'OK' ? s : 'OK';
  const bg = status === 'BLOCK' ? '#fee2e2' : status === 'WARN' ? '#fff7ed' : '#e7f6ec';
  const color = status === 'BLOCK' ? '#991b1b' : status === 'WARN' ? '#9a3412' : '#166534';
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, background: bg, color, fontSize: 12, fontWeight: 750 }}>
      {status}
    </span>
  );
}

function parseNumber(v: string | null) {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function buildSearchParams(filters: JournalBrowserFilters) {
  const qs = new URLSearchParams();
  const put = (k: keyof JournalBrowserFilters) => {
    const v = filters[k];
    if (typeof v === 'string' && v.trim()) qs.set(String(k), v.trim());
  };

  if (filters.workbench) qs.set('workbench', '1');
  if (filters.drilldown) qs.set('drilldown', '1');

  put('periodId');
  put('fromDate');
  put('toDate');
  put('accountId');
  put('legalEntityId');
  put('departmentId');
  put('projectId');
  put('fundId');
  put('riskLevel');
  put('createdById');
  put('reviewedById');
  put('postedById');

  if (typeof filters.minRiskScore === 'number' && Number.isFinite(filters.minRiskScore)) qs.set('minRiskScore', String(filters.minRiskScore));
  if (typeof filters.maxRiskScore === 'number' && Number.isFinite(filters.maxRiskScore)) qs.set('maxRiskScore', String(filters.maxRiskScore));
  if (typeof filters.limit === 'number' && Number.isFinite(filters.limit)) qs.set('limit', String(filters.limit));
  if (typeof filters.offset === 'number' && Number.isFinite(filters.offset)) qs.set('offset', String(filters.offset));
  if (filters.status) qs.set('status', String(filters.status));
  if (filters.budgetStatus) qs.set('budgetStatus', String(filters.budgetStatus));

  return qs;
}

export function JournalBrowserPage() {
  const { state, hasPermission } = useAuth();
  const authLoading = Boolean(state.isAuthenticated) && !state.me;
  const canView = hasPermission('FINANCE_GL_VIEW');

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const drilldown = searchParams.get('drilldown') === '1';
  const workbench = searchParams.get('workbench') === '1';

  const filters = useMemo<JournalBrowserFilters>(() => {
    const limit = parseNumber(searchParams.get('limit')) ?? 50;
    const offset = parseNumber(searchParams.get('offset')) ?? 0;

    const statusRaw = (searchParams.get('status') ?? '').trim();
    const status =
      statusRaw === 'DRAFT' ||
      statusRaw === 'SUBMITTED' ||
      statusRaw === 'REVIEWED' ||
      statusRaw === 'REJECTED' ||
      statusRaw === 'PARKED' ||
      statusRaw === 'POSTED'
        ? (statusRaw as any)
        : undefined;

    const riskLevelRaw = (searchParams.get('riskLevel') ?? '').trim();
    const riskLevel = riskLevelRaw === 'LOW' || riskLevelRaw === 'MEDIUM' || riskLevelRaw === 'HIGH' ? (riskLevelRaw as any) : undefined;

    const budgetStatusRaw = (searchParams.get('budgetStatus') ?? '').trim();
    const budgetStatus =
      budgetStatusRaw === 'OK' || budgetStatusRaw === 'WARN' || budgetStatusRaw === 'BLOCK'
        ? (budgetStatusRaw as any)
        : undefined;

    return {
      limit,
      offset,
      status,
      budgetStatus,
      drilldown,
      workbench,
      periodId: searchParams.get('periodId') ?? undefined,
      fromDate: searchParams.get('fromDate') ?? undefined,
      toDate: searchParams.get('toDate') ?? undefined,
      accountId: searchParams.get('accountId') ?? undefined,
      legalEntityId: searchParams.get('legalEntityId') ?? undefined,
      departmentId: searchParams.get('departmentId') ?? undefined,
      projectId: searchParams.get('projectId') ?? undefined,
      fundId: searchParams.get('fundId') ?? undefined,
      riskLevel,
      minRiskScore: parseNumber(searchParams.get('minRiskScore')),
      maxRiskScore: parseNumber(searchParams.get('maxRiskScore')),
      createdById: searchParams.get('createdById') ?? undefined,
      reviewedById: searchParams.get('reviewedById') ?? undefined,
      postedById: searchParams.get('postedById') ?? undefined,
    };
  }, [drilldown, searchParams, workbench]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<JournalBrowserListResponse | null>(null);

  const rows: JournalBrowserRow[] = useMemo(() => (Array.isArray(data?.items) ? (data?.items ?? []) : []), [data?.items]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const resp = await listJournalBrowser(filters);
      setData(resp);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to load journals'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!canView) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canView, searchParams]);

  function updateFilter(patch: Partial<JournalBrowserFilters>) {
    const next: JournalBrowserFilters = { ...filters, ...patch };
    if (patch.offset === undefined && patch.limit === undefined) {
      next.offset = 0;
    }
    const qs = buildSearchParams(next);
    setSearchParams(qs);
  }

  const total = data?.total ?? 0;
  const limit = data?.limit ?? filters.limit ?? 50;
  const offset = data?.offset ?? filters.offset ?? 0;
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  const header = (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <h2>{workbench ? 'Draft Journals' : 'Journal Register'}</h2>
      <Link to="/finance/gl/risk">Risk Intelligence</Link>
    </div>
  );

  if (authLoading) {
    return (
      <div>
        {header}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', color: tokens.colors.text.muted }}>Loading…</div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div>
        {header}
        <div style={{ marginTop: 14 }}>
          <Alert tone="error" title="Access Denied">
            You do not have permission to view Journals.
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}

      <div style={{ marginTop: 12 }}>
        {workbench ? (
          <Alert tone="info" title="Preparer workbench">
            Showing only your journals in DRAFT or REJECTED status.
          </Alert>
        ) : drilldown ? (
          <Alert tone="info" title="Read-only drill-down">
            This drill-down is read-only and restricted to REVIEWED and POSTED journals.
          </Alert>
        ) : (
          <Alert tone="info" title="Read-only register">
            This register is read-only and shows journals across all statuses.
          </Alert>
        )}
      </div>

      {!workbench ? (
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <label>
          Accounting period ID
          <input
            value={filters.periodId ?? ''}
            onChange={(e) => updateFilter({ periodId: e.target.value })}
            placeholder="e.g. 2026-10"
            style={{ display: 'block', marginTop: 4, width: '100%' }}
          />
        </label>
        <label>
          From Date
          <input value={filters.fromDate ?? ''} onChange={(e) => updateFilter({ fromDate: e.target.value })} placeholder="YYYY-MM-DD" style={{ display: 'block', marginTop: 4, width: '100%' }} />
        </label>
        <label>
          To Date
          <input value={filters.toDate ?? ''} onChange={(e) => updateFilter({ toDate: e.target.value })} placeholder="YYYY-MM-DD" style={{ display: 'block', marginTop: 4, width: '100%' }} />
        </label>

        <label>
          Natural account ID (COA)
          <input
            value={filters.accountId ?? ''}
            onChange={(e) => updateFilter({ accountId: e.target.value })}
            placeholder="Account ID"
            style={{ display: 'block', marginTop: 4, width: '100%' }}
          />
        </label>
        <label>
          Legal entity code
          <input
            value={filters.legalEntityId ?? ''}
            onChange={(e) => updateFilter({ legalEntityId: e.target.value })}
            placeholder="Legal entity"
            style={{ display: 'block', marginTop: 4, width: '100%' }}
          />
        </label>
        <label>
          Cost centre / department code
          <input
            value={filters.departmentId ?? ''}
            onChange={(e) => updateFilter({ departmentId: e.target.value })}
            placeholder="Department"
            style={{ display: 'block', marginTop: 4, width: '100%' }}
          />
        </label>

        <label>
          Project / Grant ID
          <input
            value={filters.projectId ?? ''}
            onChange={(e) => updateFilter({ projectId: e.target.value })}
            placeholder="Project"
            style={{ display: 'block', marginTop: 4, width: '100%' }}
          />
        </label>
        <label>
          Fund / Donor ID
          <input
            value={filters.fundId ?? ''}
            onChange={(e) => updateFilter({ fundId: e.target.value })}
            placeholder="Fund"
            style={{ display: 'block', marginTop: 4, width: '100%' }}
          />
        </label>
        <label>
          Status
          <select
            value={filters.status ?? ''}
            onChange={(e) => updateFilter({ status: e.target.value ? (e.target.value as any) : undefined })}
            style={{ display: 'block', marginTop: 4, width: '100%' }}
          >
            <option value="">{drilldown ? 'REVIEWED + POSTED' : 'Any'}</option>
            <option value="DRAFT">DRAFT</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="REVIEWED">REVIEWED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="POSTED">POSTED</option>
          </select>
        </label>

        <label>
          Budget Status
          <select
            value={filters.budgetStatus ?? ''}
            onChange={(e) => updateFilter({ budgetStatus: e.target.value ? (e.target.value as any) : undefined })}
            style={{ display: 'block', marginTop: 4, width: '100%' }}
          >
            <option value="">Any</option>
            <option value="OK">OK</option>
            <option value="WARN">WARN</option>
            <option value="BLOCK">BLOCK</option>
          </select>
        </label>

        <label>
          Risk Level
          <select value={filters.riskLevel ?? ''} onChange={(e) => updateFilter({ riskLevel: e.target.value ? (e.target.value as any) : undefined })} style={{ display: 'block', marginTop: 4, width: '100%' }}>
            <option value="">Any</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
        </label>
        <label>
          Min Risk Score
          <input value={filters.minRiskScore ?? ''} onChange={(e) => updateFilter({ minRiskScore: parseNumber(e.target.value) })} style={{ display: 'block', marginTop: 4, width: '100%' }} />
        </label>
        <label>
          Max Risk Score
          <input value={filters.maxRiskScore ?? ''} onChange={(e) => updateFilter({ maxRiskScore: parseNumber(e.target.value) })} style={{ display: 'block', marginTop: 4, width: '100%' }} />
        </label>

        <label>
          Prepared By (createdById)
          <input value={filters.createdById ?? ''} onChange={(e) => updateFilter({ createdById: e.target.value })} style={{ display: 'block', marginTop: 4, width: '100%' }} />
        </label>
        <label>
          Reviewed By (reviewedById)
          <input value={filters.reviewedById ?? ''} onChange={(e) => updateFilter({ reviewedById: e.target.value })} style={{ display: 'block', marginTop: 4, width: '100%' }} />
        </label>
        <label>
          Posted By (postedById)
          <input value={filters.postedById ?? ''} onChange={(e) => updateFilter({ postedById: e.target.value })} style={{ display: 'block', marginTop: 4, width: '100%' }} />
        </label>
        </div>
      ) : null}

      <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => refresh()} disabled={loading}>
          Refresh
        </button>
        <button
          onClick={() => {
            const qs = new URLSearchParams();
            if (workbench) qs.set('workbench', '1');
            if (drilldown) qs.set('drilldown', '1');
            setSearchParams(qs);
          }}
          disabled={loading}
        >
          Clear Filters
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => updateFilter({ offset: Math.max(0, offset - limit) })} disabled={!hasPrev || loading}>
            Prev
          </button>
          <button onClick={() => updateFilter({ offset: offset + limit })} disabled={!hasNext || loading}>
            Next
          </button>
          <span style={{ fontSize: 12, color: tokens.colors.text.muted }}>
            {total === 0 ? '0 results' : `${offset + 1}-${Math.min(offset + limit, total)} of ${total}`}
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', color: tokens.colors.text.muted }}>Loading…</div>
      ) : error ? (
        <div style={{ marginTop: 14 }}>
          <Alert tone="error" title="Error">
            {error}
          </Alert>
        </div>
      ) : null}

      {!loading && !error ? (
        <div style={{ marginTop: 12 }}>
          <DataTable>
            <DataTable.Head>
              <tr>
                <DataTable.Th>Reference</DataTable.Th>
                <DataTable.Th>Journal Date</DataTable.Th>
                <DataTable.Th>Description</DataTable.Th>
                <DataTable.Th align="right">Debit</DataTable.Th>
                <DataTable.Th align="right">Credit</DataTable.Th>
                <DataTable.Th>Status</DataTable.Th>
                {!workbench ? <DataTable.Th>Budget</DataTable.Th> : null}
                {!workbench ? <DataTable.Th>Risk</DataTable.Th> : null}
                {!workbench ? <DataTable.Th>Prepared By</DataTable.Th> : null}
                {!workbench ? <DataTable.Th>Reviewed By</DataTable.Th> : null}
                {!workbench ? <DataTable.Th>Posted By</DataTable.Th> : null}
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {rows.length === 0 ? <DataTable.Empty colSpan={workbench ? 6 : 11} title="No journals found." /> : null}
              {rows.map((j, idx) => (
                <DataTable.Row
                  key={j.id}
                  zebra
                  index={idx}
                  onClick={() =>
                    workbench
                      ? navigate(`/finance/gl/journals/${j.id}`)
                      : navigate(`/finance/gl/journals/${j.id}?readonly=1`)
                  }
                  style={{ cursor: 'pointer' }}
                >
                  <DataTable.Td>
                    <Link
                      to={workbench ? `/finance/gl/journals/${j.id}` : `/finance/gl/journals/${j.id}?readonly=1`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {j.reference ?? j.id.slice(0, 8)}
                    </Link>
                  </DataTable.Td>
                  <DataTable.Td>{(j.journalDate ?? '').slice(0, 10)}</DataTable.Td>
                  <DataTable.Td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {j.description ?? ''}
                  </DataTable.Td>
                  <DataTable.Td align="right">{Number(j.totalDebit ?? 0).toLocaleString()}</DataTable.Td>
                  <DataTable.Td align="right">{Number(j.totalCredit ?? 0).toLocaleString()}</DataTable.Td>
                  <DataTable.Td>{j.status}</DataTable.Td>
                  {!workbench ? (
                    <DataTable.Td>
                      <BudgetBadge status={(j as any).budgetStatus} />
                    </DataTable.Td>
                  ) : null}
                  {!workbench ? (
                    <DataTable.Td>
                      <RiskBadge score={j.riskScore ?? 0} />
                    </DataTable.Td>
                  ) : null}
                  {!workbench ? <DataTable.Td>{j.createdBy?.name ?? '—'}</DataTable.Td> : null}
                  {!workbench ? <DataTable.Td>{j.reviewedBy?.name ?? '—'}</DataTable.Td> : null}
                  {!workbench ? <DataTable.Td>{j.postedBy?.name ?? '—'}</DataTable.Td> : null}
                </DataTable.Row>
              ))}
            </DataTable.Body>
          </DataTable>
        </div>
      ) : null}
    </div>
  );
}
