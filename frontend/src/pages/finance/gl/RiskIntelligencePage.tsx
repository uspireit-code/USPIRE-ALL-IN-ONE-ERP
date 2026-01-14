import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { PERMISSIONS } from '../../../auth/permission-catalog';
import { Alert } from '../../../components/Alert';
import { DataTable } from '../../../components/DataTable';
import { tokens } from '../../../designTokens';
import { getApiErrorMessage } from '../../../services/api';
import {
  getJournalRiskAccounts,
  getJournalRiskOrganisation,
  getJournalRiskOverview,
  getJournalRiskPeriods,
  getJournalRiskUsers,
  type GlRiskFilters,
  type JournalRiskAccountsRow,
  type JournalRiskOrganisationResponse,
  type JournalRiskOverviewResponse,
  type JournalRiskPeriodsRow,
  type JournalRiskUsersRow,
} from '../../../services/gl';

type TabKey = 'overview' | 'users' | 'accounts' | 'organisation' | 'periods';

function RiskBadge(props: { score: number }) {
  const score = Number.isFinite(props.score) ? props.score : 0;
  const band = score >= 40 ? 'HIGH' : score >= 20 ? 'MEDIUM' : 'LOW';
  const bg = band === 'HIGH' ? '#fee2e2' : band === 'MEDIUM' ? '#fff7ed' : '#e7f6ec';
  const color = band === 'HIGH' ? '#991b1b' : band === 'MEDIUM' ? '#9a3412' : '#166534';

  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, background: bg, color, fontSize: 12, fontWeight: 750 }}>
      {band} ({Math.round(score)})
    </span>
  );
}

function TabButton(props: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        border: '1px solid rgba(0,0,0,0.10)',
        borderRadius: 10,
        padding: '8px 12px',
        fontWeight: props.active ? 750 : 600,
        background: props.active ? 'rgba(237, 186, 53, 0.18)' : 'white',
        cursor: 'pointer',
      }}
    >
      {props.label}
    </button>
  );
}

export function RiskIntelligencePage() {
  const { state, hasPermission } = useAuth();
  const authLoading = Boolean(state.isAuthenticated) && !state.me;
  const canView = hasPermission(PERMISSIONS.GL.VIEW);

  const navigate = useNavigate();

  const [tab, setTab] = useState<TabKey>('overview');
  const [filters, setFilters] = useState<GlRiskFilters>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<JournalRiskOverviewResponse | null>(null);
  const [users, setUsers] = useState<JournalRiskUsersRow[]>([]);
  const [accounts, setAccounts] = useState<JournalRiskAccountsRow[]>([]);
  const [organisation, setOrganisation] = useState<JournalRiskOrganisationResponse | null>(null);
  const [periods, setPeriods] = useState<JournalRiskPeriodsRow[]>([]);

  const journalBrowserQsFromCurrent = (extra?: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    const put = (k: string, v: string | undefined) => {
      const val = (v ?? '').trim();
      if (val) qs.set(k, val);
    };

    put('periodId', filters.periodId);
    put('fromDate', filters.dateFrom);
    put('toDate', filters.dateTo);
    put('legalEntityId', filters.legalEntityId);
    put('departmentId', filters.departmentId);
    put('projectId', filters.projectId);
    put('fundId', filters.fundId);
    qs.set('drilldown', '1');

    for (const [k, v] of Object.entries(extra ?? {})) {
      put(k, v);
    }

    const s = qs.toString();
    return `/finance/gl/journals${s ? `?${s}` : ''}`;
  };

  const scopedFilters = useMemo(() => {
    if (tab === 'overview' || tab === 'accounts') return filters;
    return { periodId: filters.periodId, dateFrom: filters.dateFrom, dateTo: filters.dateTo };
  }, [filters, tab]);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      if (tab === 'overview') {
        const r = await getJournalRiskOverview(scopedFilters as any);
        setOverview(r);
      } else if (tab === 'users') {
        const r = await getJournalRiskUsers(scopedFilters as any);
        setUsers(Array.isArray(r) ? r : []);
      } else if (tab === 'accounts') {
        const r = await getJournalRiskAccounts(scopedFilters as any);
        setAccounts(Array.isArray(r) ? r : []);
      } else if (tab === 'organisation') {
        const r = await getJournalRiskOrganisation(scopedFilters as any);
        setOrganisation(r);
      } else if (tab === 'periods') {
        const r = await getJournalRiskPeriods(scopedFilters as any);
        setPeriods(Array.isArray(r) ? r : []);
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to load risk intelligence'));
      setOverview(null);
      setUsers([]);
      setAccounts([]);
      setOrganisation(null);
      setPeriods([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!canView) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canView, tab, scopedFilters]);

  const filterRow = (
    <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap', marginTop: 10 }}>
      <label>
        Period ID
        <input
          value={filters.periodId ?? ''}
          onChange={(e) => setFilters((s) => ({ ...s, periodId: e.target.value }))}
          style={{ display: 'block', marginTop: 4, height: 34, borderRadius: 10, border: '1px solid rgba(0,0,0,0.14)', padding: '0 10px' }}
        />
      </label>

      <label>
        Date From
        <input
          value={filters.dateFrom ?? ''}
          onChange={(e) => setFilters((s) => ({ ...s, dateFrom: e.target.value }))}
          placeholder="YYYY-MM-DD"
          style={{ display: 'block', marginTop: 4, height: 34, borderRadius: 10, border: '1px solid rgba(0,0,0,0.14)', padding: '0 10px' }}
        />
      </label>

      <label>
        Date To
        <input
          value={filters.dateTo ?? ''}
          onChange={(e) => setFilters((s) => ({ ...s, dateTo: e.target.value }))}
          placeholder="YYYY-MM-DD"
          style={{ display: 'block', marginTop: 4, height: 34, borderRadius: 10, border: '1px solid rgba(0,0,0,0.14)', padding: '0 10px' }}
        />
      </label>

      {tab === 'overview' || tab === 'accounts' ? (
        <>
          <label>
            Legal Entity ID
            <input
              value={filters.legalEntityId ?? ''}
              onChange={(e) => setFilters((s) => ({ ...s, legalEntityId: e.target.value }))}
              style={{ display: 'block', marginTop: 4, height: 34, borderRadius: 10, border: '1px solid rgba(0,0,0,0.14)', padding: '0 10px' }}
            />
          </label>
          <label>
            Department ID
            <input
              value={filters.departmentId ?? ''}
              onChange={(e) => setFilters((s) => ({ ...s, departmentId: e.target.value }))}
              style={{ display: 'block', marginTop: 4, height: 34, borderRadius: 10, border: '1px solid rgba(0,0,0,0.14)', padding: '0 10px' }}
            />
          </label>
          <label>
            Project ID
            <input
              value={filters.projectId ?? ''}
              onChange={(e) => setFilters((s) => ({ ...s, projectId: e.target.value }))}
              style={{ display: 'block', marginTop: 4, height: 34, borderRadius: 10, border: '1px solid rgba(0,0,0,0.14)', padding: '0 10px' }}
            />
          </label>
          <label>
            Fund ID
            <input
              value={filters.fundId ?? ''}
              onChange={(e) => setFilters((s) => ({ ...s, fundId: e.target.value }))}
              style={{ display: 'block', marginTop: 4, height: 34, borderRadius: 10, border: '1px solid rgba(0,0,0,0.14)', padding: '0 10px' }}
            />
          </label>
        </>
      ) : null}

      <button onClick={refresh} disabled={loading} style={{ height: 34 }}>
        Refresh
      </button>
    </div>
  );

  const header = (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <h2>Risk Intelligence</h2>
      <Link to="/finance/gl/journals">Back to Journals</Link>
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
            You do not have permission to view Risk Intelligence.
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}

      <div style={{ marginTop: 12 }}>
        <Alert tone="info" title="Read-only">
          Risk indicators are informational and do not block journal workflows.
        </Alert>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
        <TabButton active={tab === 'overview'} label="Overview" onClick={() => setTab('overview')} />
        <TabButton active={tab === 'users'} label="By User" onClick={() => setTab('users')} />
        <TabButton active={tab === 'accounts'} label="By Account" onClick={() => setTab('accounts')} />
        <TabButton active={tab === 'organisation'} label="By Organisation" onClick={() => setTab('organisation')} />
        <TabButton active={tab === 'periods'} label="By Period" onClick={() => setTab('periods')} />
      </div>

      {filterRow}

      {loading ? (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', color: tokens.colors.text.muted }}>Loading…</div>
      ) : error ? (
        <div style={{ marginTop: 14 }}>
          <Alert tone="error" title="Error">
            {error}
          </Alert>
        </div>
      ) : null}

      {!loading && !error && tab === 'overview' ? (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
            <div style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 12, background: 'white' }}>
              <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>Journals scored</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{overview?.total ?? 0}</div>
            </div>
            <div style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 12, background: 'white' }}>
              <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>Average risk score</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{Math.round((overview?.avgRiskScore ?? 0) * 10) / 10}</div>
            </div>
            <div style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 12, background: 'white' }}>
              <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>High risk %</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{Math.round((overview?.highRiskPct ?? 0) * 10) / 10}%</div>
            </div>
            <div style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 12, background: 'white' }}>
              <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>Risk distribution</div>
              <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => navigate(journalBrowserQsFromCurrent({ riskLevel: 'LOW' }))}
                  style={{ fontSize: 12, background: 'transparent', border: 0, padding: 0, textDecoration: 'underline', cursor: 'pointer' }}
                >
                  LOW: {overview?.distribution?.LOW ?? 0}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(journalBrowserQsFromCurrent({ riskLevel: 'MEDIUM' }))}
                  style={{ fontSize: 12, background: 'transparent', border: 0, padding: 0, textDecoration: 'underline', cursor: 'pointer' }}
                >
                  MEDIUM: {overview?.distribution?.MEDIUM ?? 0}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(journalBrowserQsFromCurrent({ riskLevel: 'HIGH' }))}
                  style={{ fontSize: 12, background: 'transparent', border: 0, padding: 0, textDecoration: 'underline', cursor: 'pointer' }}
                >
                  HIGH: {overview?.distribution?.HIGH ?? 0}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && !error && tab === 'users' ? (
        <div style={{ marginTop: 14 }}>
          {users.length === 0 ? <div style={{ color: tokens.colors.text.muted }}>No results.</div> : null}
          {users.length > 0 ? (
            <DataTable>
              <DataTable.Head>
                <tr>
                  <DataTable.Th>User</DataTable.Th>
                  <DataTable.Th>Total</DataTable.Th>
                  <DataTable.Th>Avg Risk</DataTable.Th>
                  <DataTable.Th>LOW</DataTable.Th>
                  <DataTable.Th>MEDIUM</DataTable.Th>
                  <DataTable.Th>HIGH</DataTable.Th>
                  <DataTable.Th>Flags</DataTable.Th>
                </tr>
              </DataTable.Head>
              <DataTable.Body>
                {users.map((r, idx) => (
                  <DataTable.Row key={r.user.id} zebra index={idx}>
                    <DataTable.Td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => navigate(journalBrowserQsFromCurrent({ createdById: r.user.id }))}
                        style={{ background: 'transparent', border: 0, padding: 0, textDecoration: 'underline', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                      >
                        {r.user.name ?? r.user.email ?? r.user.id.slice(0, 8)}
                      </button>
                    </DataTable.Td>
                    <DataTable.Td>{r.totals.journals}</DataTable.Td>
                    <DataTable.Td>
                      <RiskBadge score={r.totals.avgRiskScore} />
                    </DataTable.Td>
                    <DataTable.Td>{r.totals.byBand.LOW}</DataTable.Td>
                    <DataTable.Td>{r.totals.byBand.MEDIUM}</DataTable.Td>
                    <DataTable.Td>{r.totals.byBand.HIGH}</DataTable.Td>
                    <DataTable.Td style={{ fontSize: 12, color: tokens.colors.text.muted }}>
                      late_posting: {r.flaggedCounts.late_posting}, reversal: {r.flaggedCounts.reversal}, high_value: {r.flaggedCounts.high_value}
                    </DataTable.Td>
                  </DataTable.Row>
                ))}
              </DataTable.Body>
            </DataTable>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && tab === 'accounts' ? (
        <div style={{ marginTop: 14 }}>
          {accounts.length === 0 ? <div style={{ color: tokens.colors.text.muted }}>No results.</div> : null}
          {accounts.length > 0 ? (
            <DataTable>
              <DataTable.Head>
                <tr>
                  <DataTable.Th>Account</DataTable.Th>
                  <DataTable.Th>Journals</DataTable.Th>
                  <DataTable.Th>Avg Risk</DataTable.Th>
                  <DataTable.Th>High Risk %</DataTable.Th>
                  <DataTable.Th>Top Flags</DataTable.Th>
                </tr>
              </DataTable.Head>
              <DataTable.Body>
                {accounts.map((r, idx) => (
                  <DataTable.Row key={r.account.id} zebra index={idx}>
                    <DataTable.Td style={{ maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => navigate(journalBrowserQsFromCurrent({ accountId: r.account.id }))}
                        style={{ background: 'transparent', border: 0, padding: 0, textDecoration: 'underline', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                      >
                        {r.account.code} — {r.account.name}
                      </button>
                    </DataTable.Td>
                    <DataTable.Td>{r.journalCount}</DataTable.Td>
                    <DataTable.Td>
                      <RiskBadge score={r.avgRiskScore} />
                    </DataTable.Td>
                    <DataTable.Td>{Math.round(r.highRiskPct * 10) / 10}%</DataTable.Td>
                    <DataTable.Td style={{ fontSize: 12, color: tokens.colors.text.muted }}>{(r.topRiskFlags ?? []).join(', ')}</DataTable.Td>
                  </DataTable.Row>
                ))}
              </DataTable.Body>
            </DataTable>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && tab === 'organisation' ? (
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          {(
            [
              { key: 'legalEntities', label: 'Legal Entities' },
              { key: 'departments', label: 'Departments' },
              { key: 'projects', label: 'Projects' },
              { key: 'funds', label: 'Funds' },
            ] as const
          ).map((sec) => {
            const rows = (organisation?.[sec.key] ?? []) as any[];
            return (
              <div key={sec.key}>
                <div style={{ fontWeight: 800 }}>{sec.label}</div>
                <div style={{ marginTop: 10 }}>
                  {rows.length === 0 ? <div style={{ color: tokens.colors.text.muted }}>No results.</div> : null}
                  {rows.length > 0 ? (
                    <DataTable>
                      <DataTable.Head>
                        <tr>
                          <DataTable.Th>Dimension</DataTable.Th>
                          <DataTable.Th>Journals</DataTable.Th>
                          <DataTable.Th>Avg Risk</DataTable.Th>
                          <DataTable.Th>High</DataTable.Th>
                        </tr>
                      </DataTable.Head>
                      <DataTable.Body>
                        {rows.map((r, idx) => (
                          <DataTable.Row key={r.dimension?.id ?? `${sec.key}-${idx}`} zebra index={idx}>
                            <DataTable.Td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  const key =
                                    sec.key === 'legalEntities'
                                      ? 'legalEntityId'
                                      : sec.key === 'departments'
                                        ? 'departmentId'
                                        : sec.key === 'projects'
                                          ? 'projectId'
                                          : 'fundId';
                                  const id = r.dimension?.id;
                                  if (!id) return;
                                  navigate(journalBrowserQsFromCurrent({ [key]: id } as any));
                                }}
                                style={{ background: 'transparent', border: 0, padding: 0, textDecoration: 'underline', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                              >
                                {r.dimension?.code ? `${r.dimension.code} — ` : ''}
                                {r.dimension?.name ?? r.dimension?.id?.slice?.(0, 8) ?? '—'}
                              </button>
                            </DataTable.Td>
                            <DataTable.Td>{r.journalCount}</DataTable.Td>
                            <DataTable.Td>
                              <RiskBadge score={r.avgRiskScore} />
                            </DataTable.Td>
                            <DataTable.Td>{r.highRiskCount}</DataTable.Td>
                          </DataTable.Row>
                        ))}
                      </DataTable.Body>
                    </DataTable>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {!loading && !error && tab === 'periods' ? (
        <div style={{ marginTop: 14 }}>
          {periods.length === 0 ? <div style={{ color: tokens.colors.text.muted }}>No results.</div> : null}
          {periods.length > 0 ? (
            <DataTable>
              <DataTable.Head>
                <tr>
                  <DataTable.Th>Period</DataTable.Th>
                  <DataTable.Th>Journals</DataTable.Th>
                  <DataTable.Th>Avg Risk</DataTable.Th>
                  <DataTable.Th>High</DataTable.Th>
                  <DataTable.Th>Reversals</DataTable.Th>
                  <DataTable.Th>Top Flags</DataTable.Th>
                </tr>
              </DataTable.Head>
              <DataTable.Body>
                {periods.map((r, idx) => (
                  <DataTable.Row key={r.period?.id ?? `null-${idx}`} zebra index={idx}>
                    <DataTable.Td>
                      {r.period?.id ? (
                        <button
                          type="button"
                          onClick={() => navigate(journalBrowserQsFromCurrent({ periodId: r.period?.id ?? '' }))}
                          style={{ background: 'transparent', border: 0, padding: 0, textDecoration: 'underline', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                        >
                          {r.period?.name ?? (r.period?.id ? r.period.id.slice(0, 8) : 'Unassigned')}
                        </button>
                      ) : (
                        'Unassigned'
                      )}
                    </DataTable.Td>
                    <DataTable.Td>{r.journalCount}</DataTable.Td>
                    <DataTable.Td>
                      <RiskBadge score={r.avgRiskScore} />
                    </DataTable.Td>
                    <DataTable.Td>{r.highRiskCount}</DataTable.Td>
                    <DataTable.Td>{r.reversalCount}</DataTable.Td>
                    <DataTable.Td style={{ fontSize: 12, color: tokens.colors.text.muted }}>{(r.topRiskFlags ?? []).join(', ')}</DataTable.Td>
                  </DataTable.Row>
                ))}
              </DataTable.Body>
            </DataTable>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
