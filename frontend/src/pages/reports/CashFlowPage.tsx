import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import {
  downloadReportExport,
  getCashFlowPresented,
  type PresentedReport,
  type PresentedReportResponse,
  type ReportExportFormat,
} from '../../services/reports';

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

const COL_AMOUNT_PX = 180;

function money(n: number) {
  const v = Number(n ?? 0);
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(v));
  return v < 0 ? `(${formatted})` : formatted;
}

export function CashFlowPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('FINANCE_CASHFLOW_VIEW');
  const canRun = hasPermission('FINANCE_REPORT_GENERATE');
  const canExport = hasPermission('FINANCE_REPORT_EXPORT');

  const [from, setFrom] = useState(firstDayOfMonthIso());
  const [to, setTo] = useState(todayIsoDate());
  const [compare, setCompare] = useState<'none' | 'prior_month' | 'prior_year'>('none');
  const [data, setData] = useState<PresentedReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = useMemo(() => !loading && data && isReportEmpty(data.report), [data, loading]);

  async function run() {
    if (!canView) return;
    setError(null);
    setLoading(true);
    try {
      const res = await getCashFlowPresented({ from, to, compare: compare === 'none' ? undefined : compare });
      setData(res);
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load Cash Flow';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }

  async function doExport(format: ReportExportFormat) {
    if (!canView || !canExport) return;
    try {
      await downloadReportExport({
        type: 'cf',
        format,
        query: { from, to, compare: compare === 'none' ? undefined : compare },
      });
      window.alert('Export started');
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Export failed';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  }

  function renderReport(report: PresentedReport) {
    return (
      <div style={{ marginTop: 12, maxWidth: 920 }}>
        <div style={{ fontSize: 12, color: '#666' }}>
          Range: {report.period.from} → {report.period.to}
          {report.comparePeriod?.from && report.comparePeriod?.to ? (
            <>
              {' '}
              | Comparative: {report.comparePeriod.from} → {report.comparePeriod.to}
            </>
          ) : null}
        </div>

        {report.compareOmittedReason ? <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>Comparative hidden: {report.compareOmittedReason}</div> : null}

        <div style={{ marginTop: 12 }}>
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

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `1fr ${COL_AMOUNT_PX}px`,
                  columnGap: 12,
                  alignItems: 'center',
                  padding: 8,
                  borderBottom: '1px solid #ddd',
                  fontWeight: 700,
                }}
              >
                <div>Description</div>
                <div style={{ textAlign: 'right' }}>Amount</div>
              </div>

              {s.rows.map((r) => (
                <div
                  key={r.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `1fr ${COL_AMOUNT_PX}px`,
                    columnGap: 12,
                    alignItems: 'center',
                    padding: 8,
                    borderBottom: '1px solid #eee',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <div>{r.label}</div>
                  <div style={{ textAlign: 'right' }}>{money(r.amount.value)}</div>
                </div>
              ))}

              {s.subtotal ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `1fr ${COL_AMOUNT_PX}px`,
                    columnGap: 12,
                    alignItems: 'center',
                    padding: 8,
                    borderTop: '2px solid #ddd',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <div>{s.subtotal.label}</div>
                  <div style={{ textAlign: 'right' }}>{money(s.subtotal.amount.value)}</div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Cash Flow (Indirect)</h2>
        <Link to="/reports">Back</Link>
      </div>

      {!canView ? <div style={{ color: 'crimson' }}>You do not have permission to view Cash Flow (requires FINANCE_CASHFLOW_VIEW).</div> : null}

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
        <button onClick={run} disabled={!canView || !canRun || loading}>
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

      {!canRun ? <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>Run disabled: missing FINANCE_REPORT_GENERATE permission.</div> : null}

      {!canExport ? <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>Export disabled: missing FINANCE_REPORT_EXPORT permission.</div> : null}

      {error ? <div style={{ color: 'crimson', marginTop: 12 }}>{error}</div> : null}
      {isEmpty ? <div style={{ marginTop: 12, color: '#666' }}>No data for selected period.</div> : null}

      {data ? renderReport(data.report) : null}
    </div>
  );
}
