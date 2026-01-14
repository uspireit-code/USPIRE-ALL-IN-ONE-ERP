import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import { JournalDetailModal } from '../../components/JournalDetailModal';
import { LedgerDrilldownDrawer } from '../../components/LedgerDrilldownDrawer';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import {
  downloadReportExport,
  getBalanceSheetPresented,
  type PresentedReport,
  type PresentedReportResponse,
  type ReportExportFormat,
} from '../../services/reports';
import { listAllGlAccounts, listGlPeriods } from '../../services/gl';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

const COL_AMOUNT_PX = 180;

function money(n: number) {
  const v = Number(n ?? 0);
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(v));
  return v < 0 ? `(${formatted})` : formatted;
}

function isReportEmpty(report: PresentedReport) {
  const hasAnyRows = report.sections.some((s) => s.rows.length > 0);
  const hasAnyTotals = report.totals.length > 0;
  return !hasAnyRows && !hasAnyTotals;
}

export function BalanceSheetPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission(PERMISSIONS.REPORT.VIEW.BALANCE_SHEET);
  const canExport = hasPermission(PERMISSIONS.REPORT.EXPORT);
  const canGlView = hasPermission(PERMISSIONS.GL.VIEW);

  const [asOf, setAsOf] = useState(todayIsoDate());
  const [compare, setCompare] = useState<'none' | 'prior_month' | 'prior_year'>('none');
  const [data, setData] = useState<PresentedReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<null | { id: string; code: string; name: string }>(null);
  const [ledgerPeriodId, setLedgerPeriodId] = useState<string | null>(null);
  const [journalId, setJournalId] = useState<string | null>(null);
  const [accountIdByCode, setAccountIdByCode] = useState<null | Map<string, { id: string; name: string }>>(null);
  const [periods, setPeriods] = useState<null | Array<{ id: string; name: string; startDate: string; endDate: string; status: 'OPEN' | 'CLOSED' }>>(null);
  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null);

  async function ensureAccountMap() {
    if (accountIdByCode) return accountIdByCode;
    const accounts = await listAllGlAccounts();
    const m = new Map<string, { id: string; name: string }>();
    for (const a of accounts) m.set(a.code, { id: a.id, name: a.name });
    setAccountIdByCode(m);
    return m;
  }

  async function ensurePeriods() {
    if (periods) return periods;
    const res = await listGlPeriods();
    setPeriods(res);
    return res;
  }

  function parseAccountCodeFromKey(key: string) {
    const parts = String(key ?? '').split(':');
    if (parts.length !== 2) return null;
    const code = parts[1];
    if (!code || code.toLowerCase().includes('total')) return null;
    return code;
  }

  function findPeriodForDate(periodList: Array<{ startDate: string; endDate: string }>, isoDate: string) {
    const d = String(isoDate ?? '').slice(0, 10);
    if (!d) return null;
    return (
      periodList.find((p) => {
        const start = String(p.startDate ?? '').slice(0, 10);
        const end = String(p.endDate ?? '').slice(0, 10);
        return start && end && start <= d && d <= end;
      }) ?? null
    );
  }

  const isEmpty = useMemo(() => !loading && data && isReportEmpty(data.report), [data, loading]);

  async function run() {
    if (!canView) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await getBalanceSheetPresented({ asOf, compare: compare === 'none' ? undefined : compare });
      setData(res);
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load Balance Sheet';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }

  async function doExport(format: ReportExportFormat) {
    if (!canView || !canExport) return;
    try {
      await downloadReportExport({
        type: 'bs',
        format,
        query: { asOf, compare: compare === 'none' ? undefined : compare },
      });
      window.alert('Export started');
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Export failed';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setNotice(null);
    }
  }

  function renderReport(report: PresentedReport) {
    const hasCompare = report.sections.some((s) => s.rows.some((r) => !!r.compareAmount) || !!s.subtotal?.compareAmount) || report.totals.some((t) => !!t.compareAmount);

    const colTemplate = hasCompare
      ? `minmax(0, 1fr) minmax(${COL_AMOUNT_PX}px, 28%) minmax(${COL_AMOUNT_PX}px, 28%)`
      : `minmax(0, 1fr) minmax(${COL_AMOUNT_PX}px, 28%)`;

    const headerTemplate = colTemplate;

    return (
      <div style={{ marginTop: 12, maxWidth: 920 }}>
        <div style={{ fontSize: 12, color: '#666' }}>
          As at: {report.period.asOf}
          {report.comparePeriod?.asOf ? (
            <>
              {' '}
              | Comparative: {report.comparePeriod.asOf}
            </>
          ) : null}
        </div>

        {report.compareOmittedReason ? <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>Comparative hidden: {report.compareOmittedReason}</div> : null}

        <div style={{ marginTop: 12 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: headerTemplate,
              columnGap: 12,
              alignItems: 'center',
              padding: 8,
              borderBottom: '1px solid #ddd',
              fontWeight: 700,
            }}
          >
            <div>Description</div>
            <div style={{ textAlign: 'right' }}>Amount</div>
            {hasCompare ? <div style={{ textAlign: 'right' }}>Comparative</div> : null}
          </div>

          {report.sections.map((s) => (
            <div key={s.key}>
              <div
                style={{
                  padding: 8,
                  background: '#fafafa',
                  borderTop: '1px solid #eee',
                  fontWeight: 700,
                }}
              >
                {s.label}
              </div>

              {s.rows.map((r) => (
                <div
                  key={r.key}
                  onMouseEnter={() => setHoveredRowKey(r.key)}
                  onMouseLeave={() =>
                    setHoveredRowKey((cur) => (cur === r.key ? null : cur))
                  }
                  style={{
                    display: 'grid',
                    gridTemplateColumns: colTemplate,
                    columnGap: 12,
                    alignItems: 'center',
                    padding: 8,
                    borderBottom: '1px solid #eee',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
                    <div>{r.label}</div>
                    {hoveredRowKey === r.key ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!canGlView}
                        title={
                          canGlView
                            ? 'View ledger (FY-to-date)'
                            : 'Ledger access requires GL View permission.'
                        }
                        onClick={async (e) => {
                          e.preventDefault();
                          if (!canGlView) return;
                          const code = parseAccountCodeFromKey(r.key);
                          if (!code) return;
                          const m = await ensureAccountMap();
                          const hit = m.get(code);
                          if (!hit) return;

                          setError(null);
                          setNotice(null);

                          const ps = await ensurePeriods();
                          const p = findPeriodForDate(ps, asOf);
                          if (!p) {
                            setNotice(
                              'Ledger drill-down requires a fully CLOSED accounting period. Adjust your date range or close the period in Periods → Month-End Close.',
                            );
                            return;
                          }

                          if ((p as any).status !== 'CLOSED') {
                            setNotice(
                              'Ledger drill-down requires a fully CLOSED accounting period. Adjust your date range or close the period in Periods → Month-End Close.',
                            );
                            return;
                          }

                          setSelectedAccount({ id: hit.id, code, name: hit.name });
                          setLedgerPeriodId((p as any).id);
                          setDrawerOpen(true);
                        }}
                      >
                        Ledger
                      </Button>
                    ) : null}
                  </div>
                  <div style={{ textAlign: 'right' }}>{money(r.amount.value)}</div>
                  {hasCompare ? (
                    <div style={{ textAlign: 'right' }}>
                      {money(r.compareAmount?.value ?? 0)}
                    </div>
                  ) : null}
                </div>
              ))}

              {s.subtotal ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: colTemplate,
                    columnGap: 12,
                    alignItems: 'center',
                    padding: 8,
                    borderTop: '1px solid #ddd',
                    background: '#fcfcfc',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <div>{s.subtotal.label}</div>
                  <div style={{ textAlign: 'right' }}>{money(s.subtotal.amount.value)}</div>
                  {hasCompare ? (
                    <div style={{ textAlign: 'right' }}>
                      {money(s.subtotal.compareAmount?.value ?? 0)}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {report.totals.length ? (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '3px solid #111' }}>
            <div style={{ fontWeight: 700 }}>Totals</div>
            <div style={{ marginTop: 8 }}>
              {report.totals.map((t) => (
                <div
                  key={t.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: colTemplate,
                    columnGap: 12,
                    alignItems: 'center',
                    marginTop: 6,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <div>{t.label}</div>
                  <div style={{ textAlign: 'right' }}>{money(t.amount.value)}</div>
                  {hasCompare ? (
                    <div style={{ textAlign: 'right' }}>
                      {money(t.compareAmount?.value ?? 0)}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Balance Sheet</h2>
        <Link to="/reports">Back</Link>
      </div>

      {!canView ? <div style={{ color: 'crimson' }}>You do not have permission to view Balance Sheet.</div> : null}

      <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'end' }}>
        <label>
          As at
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </label>
        <label>
          Comparison
          <select value={compare} onChange={(e) => setCompare(e.target.value as any)} style={{ width: 150 }}>
            <option value="none">None</option>
            <option value="prior_month">Prior month</option>
            <option value="prior_year">Prior year</option>
          </select>
        </label>
        <button onClick={run} disabled={!canView || loading}>
          {loading ? 'Loading...' : 'Run'}
        </button>

        <label>
          Export
          <select
            onChange={(e) => {
              const f = e.target.value as ReportExportFormat;
              if (!f) return;
              void doExport(f);
              e.currentTarget.selectedIndex = 0;
            }}
            disabled={!canView || !canExport}
            style={{ width: 150 }}
          >
            <option value="">Select…</option>
            <option value="pdf">PDF</option>
            <option value="csv">CSV</option>
            <option value="xlsx">XLSX</option>
          </select>
        </label>
      </div>

      {!canExport ? (
        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>Export disabled: missing {PERMISSIONS.REPORT.EXPORT} permission.</div>
      ) : null}

      {error ? (
        <Alert tone="error" title="Request failed" style={{ marginTop: 12 }}>
          {error}
        </Alert>
      ) : null}

      {!error && notice ? (
        <Alert tone="info" title="Ledger drill-down" style={{ marginTop: 12 }}>
          {notice}
        </Alert>
      ) : null}
      {isEmpty ? <div style={{ marginTop: 12, color: '#666' }}>No data for selected date.</div> : null}

      {data ? renderReport(data.report) : null}

      <LedgerDrilldownDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setJournalId(null);
          setLedgerPeriodId(null);
        }}
        account={selectedAccount}
        range={ledgerPeriodId ? { mode: 'period', accountingPeriodId: ledgerPeriodId } : null}
        canViewJournal={canGlView}
        onViewJournal={(id) => setJournalId(id)}
        sourceReport="BS"
      />

      <JournalDetailModal
        open={Boolean(journalId)}
        journalId={journalId}
        onBack={() => setJournalId(null)}
        drilledFromAccountId={selectedAccount?.id ?? null}
      />
    </div>
  );
}
