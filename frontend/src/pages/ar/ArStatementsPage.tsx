import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import type { ApiError } from '../../services/api';
import { listCustomers, type Customer } from '../../services/ar';
import { getArStatement, type ArStatementResponse, type ArStatementTransaction } from '../../services/arStatements';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function money(n: number) {
  return Number(n ?? 0).toFixed(2);
}

type Mode = 'range' | 'asOf';

export function ArStatementsPage() {
  const { hasPermission } = useAuth();

  const canView =
    hasPermission(PERMISSIONS.AR.STATEMENT.VIEW) ||
    hasPermission(PERMISSIONS.FINANCE.VIEW_ALL) ||
    hasPermission(PERMISSIONS.SYSTEM.VIEW_ALL);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [mode, setMode] = useState<Mode>('range');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [asOfDate, setAsOfDate] = useState(todayIsoDate());

  const [data, setData] = useState<ArStatementResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const debugApi = (import.meta.env.VITE_DEBUG_API ?? '').toString().toLowerCase() === 'true';

  useEffect(() => {
    if (!canView) return;
    setCustomersLoading(true);
    void listCustomers({ page: 1, pageSize: 200, status: 'ACTIVE' })
      .then((resp) => setCustomers((resp as any)?.items ?? []))
      .catch(() => undefined)
      .finally(() => setCustomersLoading(false));
  }, [canView]);

  const clientValidationError = useMemo(() => {
    if (!canView) return '';
    if (!customerId.trim()) return 'Please select a customer.';

    if (mode === 'asOf') {
      if (!asOfDate.trim()) return 'Please choose an as-of date.';
      const d = new Date(asOfDate);
      if (Number.isNaN(d.getTime())) return 'As-of date is invalid.';
      const today = new Date();
      const todayIso = today.toISOString().slice(0, 10);
      if (asOfDate > todayIso) return 'As-of date cannot be in the future.';
      return '';
    }

    if (!fromDate.trim() || !toDate.trim()) {
      return 'Please choose a start and end date.';
    }
    const f = new Date(fromDate);
    const t = new Date(toDate);
    if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return 'Date range is invalid.';
    if (fromDate > toDate) return 'End date must be after start date.';

    return '';
  }, [asOfDate, canView, customerId, fromDate, mode, toDate]);

  async function run() {
    if (!canView) return;

    setError(null);

    const msg = clientValidationError;
    if (msg) {
      setError({ body: { message: msg } });
      return;
    }

    setLoading(true);
    try {
      const res = await getArStatement({
        customerId: customerId.trim(),
        ...(mode === 'asOf' ? { asOfDate } : { fromDate, toDate }),
      });
      setData(res);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  const errBody = (error as ApiError | any)?.body;
  const errMsg =
    typeof errBody?.message === 'string'
      ? errBody.message
      : typeof errBody === 'string'
        ? errBody
        : typeof errBody?.error === 'string'
          ? errBody.error
          : typeof errBody?.reason === 'string'
            ? errBody.reason
            : error
              ? 'Failed to load customer statement.'
              : '';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Customer Statements</h2>
        <Link to="/ar">Back</Link>
      </div>

      {!canView ? <div style={{ color: 'crimson' }}>You do not have permission to view customer statements.</div> : null}

      <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <label>
          Customer
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            disabled={!canView || customersLoading}
            style={{ minWidth: 280 }}
          >
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Mode
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} disabled={!canView}>
            <option value="range">Date range</option>
            <option value="asOf">As-of date</option>
          </select>
        </label>

        {mode === 'range' ? (
          <>
            <label>
              From
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>
          </>
        ) : (
          <label>
            As of
            <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
          </label>
        )}

        <button onClick={() => void run()} disabled={!canView || loading}>
          {loading ? 'Generating…' : 'Generate'}
        </button>
      </div>

      {errMsg ? <div style={{ color: 'crimson', marginTop: 12 }}>{errMsg}</div> : null}
      {debugApi && error ? (
        <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{JSON.stringify(errBody ?? error, null, 2)}</pre>
      ) : null}

      {data ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{data.customer.name}</div>
              <div style={{ color: '#666', fontSize: 12 }}>
                Period: {data.fromDate} → {data.toDate}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#666', fontSize: 12 }}>Opening balance</div>
              <div style={{ fontWeight: 700 }}>{money(data.openingBalance)}</div>
            </div>
          </div>

          <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Date</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Type</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Reference</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Debit</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Credit</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Running balance</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 10, color: '#666' }}>
                    No transactions in selected window.
                  </td>
                </tr>
              ) : (
                data.transactions.map((t: ArStatementTransaction, idx: number) => (
                  <tr key={`${t.type}-${t.reference}-${idx}`}>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{t.date}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{t.type}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{t.reference}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{t.debit ? money(t.debit) : ''}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{t.credit ? money(t.credit) : ''}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(t.runningBalance)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ padding: 8, borderTop: '2px solid #ddd', fontWeight: 700, textAlign: 'right' }}>
                  Closing balance
                </td>
                <td style={{ padding: 8, borderTop: '2px solid #ddd', fontWeight: 700, textAlign: 'right' }}>{money(data.closingBalance)}</td>
              </tr>
            </tfoot>
          </table>

          <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
            This is a read-only statement generated on demand. Each view is audited.
          </div>
        </div>
      ) : null}
    </div>
  );
}
