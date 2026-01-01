import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getVatSummary, type VatSummaryResponse } from '../../services/reports';

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

export function VatSummaryPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('TAX_REPORT_VIEW');

  const [from, setFrom] = useState(firstDayOfMonthIso());
  const [to, setTo] = useState(todayIsoDate());
  const [data, setData] = useState<VatSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = useMemo(() => !loading && data && data.totalInputVat === 0 && data.totalOutputVat === 0, [data, loading]);

  async function run() {
    if (!canView) return;
    setError(null);
    setLoading(true);
    try {
      const res = await getVatSummary({ from, to });
      setData(res);
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load VAT Summary';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>VAT Summary</h2>
        <Link to="/reports">Back</Link>
      </div>

      {!canView ? <div style={{ color: 'crimson' }}>You do not have permission to view VAT Summary.</div> : null}

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
      </div>

      {error ? <div style={{ color: 'crimson', marginTop: 12 }}>{error}</div> : null}
      {isEmpty ? <div style={{ marginTop: 12, color: '#666' }}>No VAT activity for selected period.</div> : null}

      {data ? (
        <div style={{ marginTop: 16 }}>
          <div>
            <b>Total Output VAT:</b> {money(data.totalOutputVat)}
          </div>
          <div style={{ marginTop: 8 }}>
            <b>Total Input VAT:</b> {money(data.totalInputVat)}
          </div>
          <div style={{ marginTop: 8 }}>
            <b>Net VAT ({data.netPosition}):</b> {money(data.netVat)}
          </div>

          <div style={{ marginTop: 16, fontSize: 12, color: '#666' }}>Calculated from POSTED invoices only, per backend rules.</div>
        </div>
      ) : null}
    </div>
  );
}
