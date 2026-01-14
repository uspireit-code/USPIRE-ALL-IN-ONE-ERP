import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import {
  downloadReportExport,
  getSoceEngine,
  type ReportExportFormat,
  type SoceResponse,
} from '../../services/reports';

function currentYear() {
  return new Date().getFullYear();
}

export function SocePage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission(PERMISSIONS.REPORT.VIEW.SOCE);
  const canRun = hasPermission(PERMISSIONS.REPORT.GENERATE);
  const canExport = hasPermission(PERMISSIONS.REPORT.EXPORT);

  const [fiscalYear, setFiscalYear] = useState<number>(() => currentYear());
  const [compare, setCompare] = useState<'none' | 'prior_year'>('none');
  const [data, setData] = useState<null | { current: SoceResponse; compare?: SoceResponse }>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = useMemo(() => !loading && !error && data && !data.current, [data, loading, error]);

  function money(n: number) {
    const v = Number(n ?? 0);
    const formatted = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(v));
    return v < 0 ? `(${formatted})` : formatted;
  }

  async function run() {
    if (!canView) return;
    setError(null);
    setLoading(true);
    try {
      const current = await getSoceEngine({ fiscalYear });
      const compareRes = compare === 'prior_year' ? await getSoceEngine({ fiscalYear: fiscalYear - 1 }) : undefined;
      setData({ current, compare: compareRes });
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load SOCE';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }

  async function doExport(format: ReportExportFormat) {
    if (!canView || !canExport) return;
    try {
      await downloadReportExport({
        type: 'soce',
        format,
        query: { fiscalYear, compare: compare === 'none' ? undefined : 'prior_year' },
      });
      window.alert('Export started');
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Export failed';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  }

  function renderMatrix(current: SoceResponse, compareRes?: SoceResponse) {
    const showCompare = Boolean(compareRes);

    const rows = [
      {
        key: 'opening',
        label: 'Opening balance',
        get: (s: SoceResponse) => ({
          shareCapital: s.shareCapital.opening,
          retainedEarnings: s.retainedEarnings.opening,
          otherReserves: s.otherReserves.opening,
          totalEquity: s.totalEquity.opening,
        }),
        bold: true,
      },
      {
        key: 'profit',
        label: 'Profit for the period',
        get: (s: SoceResponse) => ({
          shareCapital: s.shareCapital.profitOrLoss,
          retainedEarnings: s.retainedEarnings.profitOrLoss,
          otherReserves: s.otherReserves.profitOrLoss,
          totalEquity: s.totalEquity.profitOrLoss,
        }),
        bold: false,
      },
      {
        key: 'other',
        label: 'Other equity movements',
        get: (s: SoceResponse) => ({
          shareCapital: s.shareCapital.otherMovements,
          retainedEarnings: s.retainedEarnings.otherMovements,
          otherReserves: s.otherReserves.otherMovements,
          totalEquity: s.totalEquity.otherMovements,
        }),
        bold: false,
      },
      {
        key: 'closing',
        label: 'Closing balance',
        get: (s: SoceResponse) => ({
          shareCapital: s.shareCapital.closing,
          retainedEarnings: s.retainedEarnings.closing,
          otherReserves: s.otherReserves.closing,
          totalEquity: s.totalEquity.closing,
        }),
        bold: true,
      },
    ] as const;

    const col = {
      line: { width: '40%' },
      num: { width: showCompare ? '15%' : '20%' },
    };

    const cellStyle = {
      padding: 8,
      borderBottom: '1px solid #eee',
      textAlign: 'right' as const,
      fontVariantNumeric: 'tabular-nums' as const,
    };

    return (
      <div style={{ marginTop: 12, maxWidth: 920 }}>
        <div style={{ fontSize: 12, color: '#666' }}>
          Period: {current.from} → {current.to}
          {showCompare ? (
            <>
              {' '}
              | Comparative: {compareRes?.from} → {compareRes?.to}
            </>
          ) : null}
        </div>

        <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8, width: col.line.width }}>
                Line
              </th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8, width: col.num.width, fontWeight: 700 }}>
                Share Capital
              </th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8, width: col.num.width, fontWeight: 700 }}>
                Retained Earnings
              </th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8, width: col.num.width, fontWeight: 700 }}>
                Other Reserves
              </th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8, width: col.num.width, fontWeight: 700 }}>
                Total Equity
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cur = r.get(current);
              return (
                <tr key={r.key}>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', fontWeight: r.bold ? 700 : 400 }}>
                    {r.label}
                  </td>
                  <td style={{ ...cellStyle, fontWeight: r.bold ? 700 : 400 }}>{money(cur.shareCapital)}</td>
                  <td style={{ ...cellStyle, fontWeight: r.bold ? 700 : 400 }}>{money(cur.retainedEarnings)}</td>
                  <td style={{ ...cellStyle, fontWeight: r.bold ? 700 : 400 }}>{money(cur.otherReserves)}</td>
                  <td style={{ ...cellStyle, fontWeight: 700 }}>{money(cur.totalEquity)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Statement of Changes in Equity (SOCE)</h2>
        <Link to="/reports">Back</Link>
      </div>

      {!canView ? (
        <div style={{ color: 'crimson' }}>You do not have permission to view SOCE (requires {PERMISSIONS.REPORT.VIEW.SOCE}).</div>
      ) : null}

      <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'end' }}>
        <label>
          Fiscal Year
          <input
            type="number"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(Number(e.target.value))}
            style={{ width: 120 }}
          />
        </label>
        <label>
          Comparison
          <select value={compare} onChange={(e) => setCompare(e.target.value as any)} style={{ width: 150 }}>
            <option value="none">None</option>
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

      {!canRun ? (
        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>Run disabled: missing {PERMISSIONS.REPORT.GENERATE} permission.</div>
      ) : null}

      {!canExport ? (
        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>Export disabled: missing {PERMISSIONS.REPORT.EXPORT} permission.</div>
      ) : null}

      {error ? <div style={{ color: 'crimson', marginTop: 12 }}>{error}</div> : null}
      {isEmpty ? <div style={{ marginTop: 12, color: '#666' }}>No data for selected period.</div> : null}

      {data ? renderMatrix(data.current, data.compare) : null}
    </div>
  );
}
