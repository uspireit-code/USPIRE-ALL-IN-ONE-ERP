import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PageLayout } from '../../components/PageLayout';
import { formatMoney } from '../../money';
import { getApiErrorMessage } from '../../services/api';
import { listRefunds, type RefundListItem } from '../../services/ar';

function StatusBadge(props: { status: string }) {
  const s = String(props.status ?? '').toUpperCase();
  const bg = s === 'POSTED' ? '#e6ffed' : s === 'VOID' ? '#ffecec' : s === 'APPROVED' ? '#e6f0ff' : '#fff7e6';
  const fg = s === 'POSTED' ? '#137333' : s === 'VOID' ? '#b00020' : s === 'APPROVED' ? '#1a4fb3' : '#7a4b00';
  return (
    <span style={{ padding: '2px 8px', borderRadius: 12, background: bg, color: fg, fontSize: 12, fontWeight: 600 }}>
      {s}
    </span>
  );
}

export function RefundsListPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canView = hasPermission('AR_REFUND_VIEW');
  const canCreate = hasPermission('AR_REFUND_CREATE');

  const [rows, setRows] = useState<RefundListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState('');
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const load = () => {
    if (!canView) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    listRefunds({
      status: (filterStatus as any) || undefined,
      customerId: filterCustomerId || undefined,
      dateFrom: filterFrom || undefined,
      dateTo: filterTo || undefined,
    })
      .then((res) => {
        if (!mounted) return;
        setRows(res.items ?? []);
      })
      .catch((e: any) => {
        setError(getApiErrorMessage(e, 'Failed to load refunds'));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  };

  useEffect(() => {
    return load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const content = useMemo(() => {
    if (!canView) return <div style={{ color: 'crimson' }}>Permission denied</div>;
    if (loading) return <div>Loading...</div>;
    if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

    return (
      <div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Status</div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              <option value="DRAFT">DRAFT</option>
              <option value="APPROVED">APPROVED</option>
              <option value="POSTED">POSTED</option>
              <option value="VOID">VOID</option>
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Customer ID</div>
            <input value={filterCustomerId} onChange={(e) => setFilterCustomerId(e.target.value)} placeholder="(optional)" />
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>From</div>
            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>To</div>
            <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          </div>

          <button type="button" onClick={() => load()}>
            Apply
          </button>
        </div>

        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Refund No</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Credit Note No</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Customer</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Date</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Amount</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Method</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Approved By</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Posted By</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <Link to={`/finance/ar/refunds/${r.id}`}>{r.refundNumber}</Link>
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.creditNoteNumber ?? r.creditNoteId}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.customerName ?? r.customerId}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.refundDate ?? '-'}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(Number(r.amount ?? 0))}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.paymentMethod}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <StatusBadge status={r.status} />
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.approvedById ?? '-'}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.postedById ?? '-'}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <Link to={`/finance/ar/refunds/${r.id}`}>Open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [canView, error, filterCustomerId, filterFrom, filterStatus, filterTo, loading, rows]);

  return (
    <PageLayout
      title="Refunds"
      actions={
        <button type="button" disabled={!canCreate} onClick={() => navigate('/finance/ar/refunds/new')}>
          New Refund
        </button>
      }
    >
      {content}
    </PageLayout>
  );
}
