import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import {
  downloadTrialBalanceExport,
  getTrialBalance,
  type TrialBalanceResponse,
} from '../../services/reports';
import { listGlPeriods } from '../../services/gl';
import { JournalDetailModal } from '../../components/JournalDetailModal';
import { LedgerDrilldownDrawer } from '../../components/LedgerDrilldownDrawer';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { DataTable } from '../../components/DataTable';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonthIso() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function money(n: number) {
  return Number(n).toFixed(2);
}

export function TrialBalancePage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('FINANCE_TB_VIEW');
  const canGlView = hasPermission('FINANCE_GL_VIEW');
  const canExport = hasPermission('FINANCE_REPORT_EXPORT');

  const [from, setFrom] = useState(firstDayOfMonthIso());
  const [to, setTo] = useState(todayIsoDate());
  const [data, setData] = useState<TrialBalanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<null | { id: string; code: string; name: string }>(null);
  const [ledgerPeriodId, setLedgerPeriodId] = useState<string | null>(null);
  const [journalId, setJournalId] = useState<string | null>(null);
  const [hoveredAccountId, setHoveredAccountId] = useState<string | null>(null);

  async function resolveEligibleClosedPeriodIdForRange(fromDate: string, toDate: string) {
    const fromIso = String(fromDate ?? '').slice(0, 10);
    const toIso = String(toDate ?? '').slice(0, 10);
    const periods = await listGlPeriods();
    const hit =
      periods.find((p) => {
        if (p.status !== 'CLOSED') return false;
        const start = String(p.startDate ?? '').slice(0, 10);
        const end = String(p.endDate ?? '').slice(0, 10);
        return start && end && start <= fromIso && toIso <= end;
      }) ?? null;
    return hit?.id ?? null;
  }

  async function doExport(format: 'pdf' | 'xlsx') {
    if (!canView || !canExport) return;
    try {
      await downloadTrialBalanceExport({ format, from, to });
      window.alert('Export started');
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Export failed';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  }

  const rows = data?.rows ?? [];
  const totals = data?.totals;

  const isEmpty = useMemo(() => !loading && data && rows.length === 0, [data, loading, rows.length]);

  async function run() {
    if (!canView) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await getTrialBalance({ from, to });
      setData(res);
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load trial balance';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Trial Balance</h2>
        <Link to="/reports">Back</Link>
      </div>

      {!canView ? <div style={{ color: 'crimson' }}>You do not have permission to view Trial Balance.</div> : null}

      <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'end' }}>
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button onClick={run} disabled={!canView || loading}>
          {loading ? 'Loading...' : 'Run'}
        </button>

        <label>
          Export
          <select
            onChange={(e) => {
              const f = e.target.value as 'pdf' | 'xlsx';
              if (!f) return;
              void doExport(f);
              e.currentTarget.selectedIndex = 0;
            }}
            disabled={!canView || !canExport}
            style={{ width: 150 }}
          >
            <option value="">Select…</option>
            <option value="pdf">PDF</option>
            <option value="xlsx">XLSX</option>
          </select>
        </label>
      </div>

      {!canExport ? <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>Export disabled: missing FINANCE_REPORT_EXPORT permission.</div> : null}

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
      {isEmpty ? <div style={{ marginTop: 12, color: '#666' }}>No data for selected period.</div> : null}

      {data ? (
        <>
          <DataTable style={{ marginTop: 12 }}>
            <DataTable.Head sticky>
              <tr>
                <DataTable.Th>Code</DataTable.Th>
                <DataTable.Th>Account</DataTable.Th>
                <DataTable.Th align="right">Debit</DataTable.Th>
                <DataTable.Th align="right">Credit</DataTable.Th>
                <DataTable.Th align="right">Net</DataTable.Th>
                <DataTable.Th align="right" style={{ width: 140 }}>Actions</DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {rows.map((r, idx) => (
                <DataTable.Row
                  key={r.accountId}
                  zebra
                  index={idx}
                  onMouseEnter={() => setHoveredAccountId(r.accountId)}
                  onMouseLeave={() => setHoveredAccountId((cur) => (cur === r.accountId ? null : cur))}
                >
                  <DataTable.Td>{r.accountCode}</DataTable.Td>
                  <DataTable.Td>{r.accountName}</DataTable.Td>
                  <DataTable.Td align="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {money(r.totalDebit)}
                  </DataTable.Td>
                  <DataTable.Td align="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {money(r.totalCredit)}
                  </DataTable.Td>
                  <DataTable.Td align="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {money(r.net)}
                  </DataTable.Td>
                  <DataTable.Td align="right">
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      {hoveredAccountId === r.accountId ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!canGlView}
                          title={
                            canGlView
                              ? 'View posted ledger activity'
                              : 'Ledger access requires GL View permission.'
                          }
                          onClick={() => {
                            if (!canGlView) return;
                            void (async () => {
                              setError(null);
                              setNotice(null);
                              const periodId = await resolveEligibleClosedPeriodIdForRange(from, to);
                              if (!periodId) {
                                setNotice(
                                  'Ledger drill-down requires a fully CLOSED accounting period. Adjust your date range or close the period in Periods → Month-End Close.',
                                );
                                return;
                              }
                              setSelectedAccount({ id: r.accountId, code: r.accountCode, name: r.accountName });
                              setLedgerPeriodId(periodId);
                              setDrawerOpen(true);
                            })();
                          }}
                        >
                          View ledger
                        </Button>
                      ) : null}
                    </div>
                  </DataTable.Td>
                </DataTable.Row>
              ))}
            </DataTable.Body>
            {totals ? (
              <DataTable.Foot>
                <tr>
                  <DataTable.Td>{''}</DataTable.Td>
                  <DataTable.Td style={{ fontWeight: 750 }}>Totals</DataTable.Td>
                  <DataTable.Td align="right" style={{ fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>
                    {money(totals.totalDebit)}
                  </DataTable.Td>
                  <DataTable.Td align="right" style={{ fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>
                    {money(totals.totalCredit)}
                  </DataTable.Td>
                  <DataTable.Td align="right" style={{ fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>
                    {money(totals.net)}
                  </DataTable.Td>
                  <DataTable.Td>{''}</DataTable.Td>
                </tr>
              </DataTable.Foot>
            ) : null}
          </DataTable>

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
            sourceReport="TB"
          />

          <JournalDetailModal
            open={Boolean(journalId)}
            journalId={journalId}
            onBack={() => setJournalId(null)}
            drilledFromAccountId={selectedAccount?.id ?? null}
          />
        </>
      ) : null}
    </div>
  );
}
