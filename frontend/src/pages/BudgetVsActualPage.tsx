import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PERMISSIONS } from '../auth/permission-catalog';
import {
  getBudgetVsActualPaged,
  type BudgetVsActualPagedResponse,
  type BudgetVsActualPagedRow,
  type BudgetVsActualVarianceStatus,
} from '../services/budgetVsActual';
import { getApiErrorMessage } from '../services/api';
import { listAllGlAccounts, listGlPeriods, type AccountingPeriod, type GlAccountLookup } from '../services/gl';

type SortBy =
  | 'accountCode'
  | 'accountName'
  | 'periodName'
  | 'budgetAmount'
  | 'actualAmount'
  | 'varianceAmount'
  | 'variancePercent'
  | 'varianceStatus';

function statusBadgeStyle(status: BudgetVsActualVarianceStatus) {
  const base: CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    lineHeight: '16px',
  };
  if (status === 'OK') return { ...base, background: '#e7f7ee', color: '#166534', border: '1px solid #bbf7d0' };
  if (status === 'WARN') return { ...base, background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' };
  return { ...base, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' };
}

function parseNumber(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function BudgetVsActualPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission(PERMISSIONS.BUDGET.FINANCE_VIEW);
  const navigate = useNavigate();

  const [fiscalYear, setFiscalYear] = useState<number>(() => new Date().getFullYear());
  const [periodId, setPeriodId] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');

  const [sortBy, setSortBy] = useState<SortBy>('accountCode');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BudgetVsActualPagedResponse | null>(null);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [accounts, setAccounts] = useState<GlAccountLookup[]>([]);

  const fiscalYearValid = useMemo(() => {
    const fy = parseNumber(fiscalYear);
    return fy !== null && fy >= 1900 && fy <= 2200;
  }, [fiscalYear]);

  const periodOptions = useMemo(() => {
    return [...periods].sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  }, [periods]);

  const accountOptions = useMemo(() => {
    return [...accounts].sort((a, b) => String(a.code ?? '').localeCompare(String(b.code ?? '')));
  }, [accounts]);

  const total = data?.total ?? 0;
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  async function loadLookups() {
    if (!canView) return;
    try {
      const [p, a] = await Promise.all([listGlPeriods(), listAllGlAccounts()]);
      setPeriods(p);
      setAccounts(a);
    } catch {
      // ignore lookup failures; page can still work with ids
    }
  }

  async function refresh() {
    if (!fiscalYearValid) {
      setError('Fiscal year is required');
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const resp = await getBudgetVsActualPaged({
        fiscalYear,
        periodId: periodId.trim() ? periodId.trim() : undefined,
        accountId: accountId.trim() ? accountId.trim() : undefined,
        limit,
        offset,
        sortBy,
        sortDir,
      });
      setData(resp);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to load budget vs actual'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  useEffect(() => {
    if (!canView) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, fiscalYear, periodId, accountId, limit, offset, sortBy, sortDir]);

  if (!canView) {
    return <div>You do not have access to Budget vs Actual.</div>;
  }

  const rows: BudgetVsActualPagedRow[] = data?.rows ?? [];

  function toggleSort(next: SortBy) {
    if (sortBy === next) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortBy(next);
    setSortDir('asc');
  }

  function onRowClick(r: BudgetVsActualPagedRow) {
    const qs = new URLSearchParams();
    qs.set('status', 'POSTED');
    qs.set('accountId', r.accountId);
    qs.set('periodId', r.periodId);
    qs.set('drilldown', '1');
    navigate(`/finance/gl/journals?${qs.toString()}`);
  }

  return (
    <div>
      <h2>Budget vs Actual</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 12, alignItems: 'end' }}>
        <label>
          Fiscal Year (required)
          <input
            type="number"
            value={fiscalYear}
            onChange={(e) => {
              setOffset(0);
              setFiscalYear(Number(e.target.value));
            }}
            style={{ display: 'block', marginTop: 4, width: '100%' }}
          />
        </label>

        <label>
          Period (optional)
          <select
            value={periodId}
            onChange={(e) => {
              setOffset(0);
              setPeriodId(e.target.value);
            }}
            style={{ display: 'block', marginTop: 4, width: '100%' }}
          >
            <option value="">All periods</option>
            {periodOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Account (optional)
          <select
            value={accountId}
            onChange={(e) => {
              setOffset(0);
              setAccountId(e.target.value);
            }}
            style={{ display: 'block', marginTop: 4, width: '100%' }}
          >
            <option value="">All accounts</option>
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Page size
          <select
            value={String(limit)}
            onChange={(e) => {
              setOffset(0);
              setLimit(Number(e.target.value));
            }}
            style={{ display: 'block', marginTop: 4, width: '100%' }}
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
        </label>
      </div>

      {data ? (
        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
          ACTIVE budget: {data.budgetId} (rev {data.revision.revisionNo})
          {data.cutoverDate ? ` | Cutover: ${data.cutoverDate}` : ''}
        </div>
      ) : null}

      {error ? <div style={{ marginTop: 12, color: 'crimson' }}>{error}</div> : null}
      {loading ? <div style={{ marginTop: 12 }}>Loading…</div> : null}

      {!data ? null : (
        <div style={{ overflowX: 'auto', marginTop: 12, border: '1px solid #eee' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1100 }}>
            <thead>
              <tr>
                <th
                  style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8, cursor: 'pointer' }}
                  onClick={() => toggleSort('accountCode')}
                >
                  Account Code
                </th>
                <th
                  style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8, cursor: 'pointer' }}
                  onClick={() => toggleSort('accountName')}
                >
                  Account Name
                </th>
                <th
                  style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8, cursor: 'pointer' }}
                  onClick={() => toggleSort('periodName')}
                >
                  Period
                </th>
                <th
                  style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8, cursor: 'pointer' }}
                  onClick={() => toggleSort('budgetAmount')}
                >
                  Budget
                </th>
                <th
                  style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8, cursor: 'pointer' }}
                  onClick={() => toggleSort('actualAmount')}
                >
                  Actual
                </th>
                <th
                  style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8, cursor: 'pointer' }}
                  onClick={() => toggleSort('varianceAmount')}
                >
                  Variance
                </th>
                <th
                  style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8, cursor: 'pointer' }}
                  onClick={() => toggleSort('variancePercent')}
                >
                  Variance %
                </th>
                <th
                  style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8, cursor: 'pointer' }}
                  onClick={() => toggleSort('varianceStatus')}
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.accountId}:${r.periodId}`}
                  onClick={() => onRowClick(r)}
                  style={{ cursor: 'pointer' }}
                  title="Click to open Journal Register (POSTED)"
                >
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8, whiteSpace: 'nowrap' }}>{r.accountCode}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{r.accountName}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8, whiteSpace: 'nowrap' }}>{r.periodName}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8, textAlign: 'right' }}>{r.budgetAmount.toFixed(2)}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8, textAlign: 'right' }}>{r.actualAmount.toFixed(2)}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8, textAlign: 'right' }}>{r.varianceAmount.toFixed(2)}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8, textAlign: 'right' }}>
                    {r.variancePercent === null ? '' : `${r.variancePercent.toFixed(2)}%`}
                  </td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>
                    <span style={statusBadgeStyle(r.varianceStatus)}>{r.varianceStatus}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: '#666' }}>
          Showing {total === 0 ? 0 : offset + 1}–{Math.min(offset + limit, total)} of {total}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={!hasPrev || loading}>
            Prev
          </button>
          <button onClick={() => setOffset(offset + limit)} disabled={!hasNext || loading}>
            Next
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
        This report is read-only. Actuals are derived from POSTED journals. No totals are stored.
      </div>
    </div>
  );
}
