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
  getProfitLossPresented,
  type PresentedReport,
  type PresentedReportResponse,
  type ReportExportFormat,
} from '../../services/reports';
import { listAllGlAccounts, listGlPeriods } from '../../services/gl';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonthIso() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function isReportEmpty(report: PresentedReport) {
  const hasAnyRows = report.sections.some((s) => s.rows.length > 0);
  const hasAnyTotals = report.totals.length > 0;
  return !hasAnyRows && !hasAnyTotals;
}

export function ProfitLossPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission(PERMISSIONS.REPORT.VIEW.PROFIT_LOSS);
  const canExport = hasPermission(PERMISSIONS.REPORT.EXPORT);
  const canGlView = hasPermission(PERMISSIONS.GL.VIEW);

  const [from, setFrom] = useState(firstDayOfMonthIso());
  const [to, setTo] = useState(todayIsoDate());
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
  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null);

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

  async function ensureAccountMap() {
    if (accountIdByCode) return accountIdByCode;
    const accounts = await listAllGlAccounts();
    const m = new Map<string, { id: string; name: string }>();
    for (const a of accounts) m.set(a.code, { id: a.id, name: a.name });
    setAccountIdByCode(m);
    return m;
  }

  function parseAccountCodeFromKey(key: string) {
    const parts = String(key ?? '').split(':');
    if (parts.length !== 2) return null;
    const code = parts[1];
    if (!code || code.toLowerCase().includes('total')) return null;
    return code;
  }

  const isEmpty = useMemo(() => !loading && data && isReportEmpty(data.report), [data, loading]);

  async function run() {
    if (!canView) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await getProfitLossPresented({ from, to, compare: compare === 'none' ? undefined : compare });
      setData(res);
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load Profit & Loss';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }

  async function doExport(format: ReportExportFormat) {
    if (!canView || !canExport) return;
    try {
      await downloadReportExport({
        type: 'pl',
        format,
        query: { from, to, compare: compare === 'none' ? undefined : compare },
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

    const colAmountPx = 140;
    const gridTemplateColumns = hasCompare
      ? `1fr ${colAmountPx}px ${colAmountPx}px`
      : `1fr ${colAmountPx}px`;

    const GridRow = (props: {
      rowKey: string;
      label: string;
      amountDisplay: string;
      compareAmountDisplay?: string;
      emphasized?: boolean;
      showLedger?: boolean;
    }) => {
      return (
        <div
          key={props.rowKey}
          onMouseEnter={() => setHoveredRowKey(props.rowKey)}
          onMouseLeave={() =>
            setHoveredRowKey((cur) => (cur === props.rowKey ? null : cur))
          }
          style={{
            display: 'grid',
            gridTemplateColumns,
            columnGap: 12,
            alignItems: 'center',
            padding: 8,
            borderBottom: props.emphasized ? undefined : '1px solid #eee',
            borderTop: props.emphasized ? '2px solid #ddd' : undefined,
            fontWeight: props.emphasized ? 700 : 400,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div>{props.label}</div>
              {props.showLedger && hoveredRowKey === props.rowKey ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!canGlView}
                  title={
                    canGlView
                      ? 'View ledger'
                      : 'Ledger access requires GL View permission.'
                  }
                  onClick={async (e) => {
                    e.preventDefault();
                    if (!canGlView) return;
                    const code = parseAccountCodeFromKey(props.rowKey);
                    if (!code) return;
                    const m = await ensureAccountMap();
                    const hit = m.get(code);
                    if (!hit) return;

                    setError(null);
                    setNotice(null);
                    const periodId = await resolveEligibleClosedPeriodIdForRange(
                      from,
                      to,
                    );
                    if (!periodId) {
                      setNotice(
                        'Ledger drill-down requires a fully CLOSED accounting period. Adjust your date range or close the period in Periods → Month-End Close.',
                      );
                      return;
                    }

                    setSelectedAccount({ id: hit.id, code, name: hit.name });
                    setLedgerPeriodId(periodId);
                    setDrawerOpen(true);
                  }}
                >
                  Ledger
                </Button>
              ) : null}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>{props.amountDisplay}</div>

          {hasCompare ? (
            <>
              <div style={{ textAlign: 'right' }}>
                {props.compareAmountDisplay ?? ''}
              </div>
            </>
          ) : null}
        </div>
      );
    };

    return (
      <div style={{ marginTop: 12, maxWidth: 920 }}>
        <div style={{ fontSize: 12, color: '#666' }}>
          Period: {report.period.from} → {report.period.to}
          {report.comparePeriod?.from && report.comparePeriod?.to ? (
            <>
              {' '}
              | Comparative: {report.comparePeriod.from} → {report.comparePeriod.to}
            </>
          ) : null}
        </div>

        {report.compareOmittedReason ? <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>Comparative hidden: {report.compareOmittedReason}</div> : null}

        <div style={{ marginTop: 12 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns,
              columnGap: 12,
              alignItems: 'center',
              padding: 8,
              borderBottom: '1px solid #ddd',
              fontWeight: 700,
            }}
          >
            <div>Line</div>
            <div style={{ textAlign: 'right' }}>Current</div>
            {hasCompare ? (
              <>
                <div style={{ textAlign: 'right' }}>Comparative</div>
              </>
            ) : null}
          </div>

          {report.sections.map((s) => (
            <div key={s.key}>
              {s.rows.length ? (
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
              ) : null}

              {s.rows.map((r) => (
                <GridRow
                  key={r.key}
                  rowKey={r.key}
                  label={r.label}
                  amountDisplay={r.amount.display}
                  compareAmountDisplay={r.compareAmount?.display}
                  emphasized={false}
                  showLedger={true}
                />
              ))}

              {s.subtotal ? (
                <GridRow
                  rowKey={s.subtotal.key}
                  label={s.subtotal.label}
                  amountDisplay={s.subtotal.amount.display}
                  compareAmountDisplay={s.subtotal.compareAmount?.display}
                  emphasized={true}
                  showLedger={false}
                />
              ) : null}
            </div>
          ))}

          {report.totals.map((t) => (
            <GridRow
              key={t.key}
              rowKey={t.key}
              label={t.label}
              amountDisplay={t.amount.display}
              compareAmountDisplay={t.compareAmount?.display}
              emphasized={true}
              showLedger={false}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Profit & Loss</h2>
        <Link to="/reports">Back</Link>
      </div>

      {!canView ? <div style={{ color: 'crimson' }}>You do not have permission to view Profit & Loss.</div> : null}

      <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'end' }}>
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
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
      {isEmpty ? <div style={{ marginTop: 12, color: '#666' }}>No data for selected period.</div> : null}

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
        sourceReport="PL"
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
