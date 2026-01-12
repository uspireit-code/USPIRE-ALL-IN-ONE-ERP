import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PageLayout } from '../../components/PageLayout';
import type { ArReceipt } from '../../services/ar';
import { listReceipts, postReceipt } from '../../services/ar';
import { getApiErrorMessage } from '../../services/api';

function formatMoney(n: number) {
  return Number(n ?? 0).toFixed(2);
}

function StatusBadge(props: { status: 'DRAFT' | 'POSTED' | 'VOIDED' }) {
  const bg =
    props.status === 'POSTED'
      ? '#e6ffed'
      : props.status === 'VOIDED'
        ? '#ffecec'
        : '#fff7e6';
  const fg = props.status === 'POSTED' ? '#137333' : props.status === 'VOIDED' ? '#b00020' : '#7a4b00';
  return (
    <span style={{ padding: '2px 8px', borderRadius: 12, background: bg, color: fg, fontSize: 12, fontWeight: 600 }}>
      {props.status}
    </span>
  );
}

export function ReceiptsPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canView = hasPermission('RECEIPT_VIEW') || hasPermission('RECEIPT_POST');
  const canCreate = hasPermission('RECEIPT_CREATE');
  const canPost = hasPermission('RECEIPT_POST');

  const [rows, setRows] = useState<ArReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (!canView) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    listReceipts()
      .then((data) => {
        if (!mounted) return;
        setRows(data);
      })
      .catch((err: any) => {
        setError(getApiErrorMessage(err, 'Failed to load receipts'));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [canView]);

  async function onPost(id: string) {
    if (!canPost) {
      setError('You do not have permission to post receipts. Required: RECEIPT_POST.');
      return;
    }

    const ok = window.confirm('Post this receipt? This action is irreversible.');
    if (!ok) return;

    setError(null);
    setActingId(id);
    try {
      await postReceipt(id);
      const data = await listReceipts();
      setRows(data);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to post receipt'));
    } finally {
      setActingId(null);
    }
  }

  const content = useMemo(() => {
    if (!canView) return <div style={{ color: 'crimson' }}>You don’t have permission to view receipts. Required: RECEIPT_VIEW.</div>;
    if (loading) return <div>Loading...</div>;
    if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

    return (
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Receipt No</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Date</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Customer</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Amount</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                <Link to={`/ar/receipts/${r.id}`}>{r.receiptNumber}</Link>
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.receiptDate}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.customerName}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(r.totalAmount)}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                <StatusBadge status={r.status} />
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {r.status === 'DRAFT' && canPost ? (
                    <button type="button" disabled={actingId === r.id} onClick={() => onPost(r.id)}>
                      Post
                    </button>
                  ) : null}
                  <Link to={`/ar/receipts/${r.id}`}>Open</Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }, [actingId, canPost, canView, error, loading, rows]);

  return (
    <PageLayout
      title="Customer Receipts"
      actions={
        <button type="button" disabled={!canCreate} onClick={() => navigate('/ar/receipts/new')}>
          New Receipt
        </button>
      }
    >
      {content}
    </PageLayout>
  );
}
