import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import { PageLayout } from '../../components/PageLayout';
import { formatMoney } from '../../money';
import { getApiErrorMessage } from '../../services/api';
import { listCreditNotes, type CreditNoteListItem, type CreditNoteStatus } from '../../services/ar';

function StatusBadge(props: { status: CreditNoteStatus | string }) {
  const s = String(props.status ?? '').toUpperCase();
  const bg = s === 'POSTED' ? '#e6ffed' : s === 'VOID' ? '#ffecec' : s === 'APPROVED' ? '#e6f0ff' : '#fff7e6';
  const fg = s === 'POSTED' ? '#137333' : s === 'VOID' ? '#b00020' : s === 'APPROVED' ? '#1a4fb3' : '#7a4b00';
  return (
    <span style={{ padding: '2px 8px', borderRadius: 12, background: bg, color: fg, fontSize: 12, fontWeight: 600 }}>
      {s}
    </span>
  );
}

export function CreditNotesListPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canView =
    hasPermission(PERMISSIONS.AR.CREDIT_NOTE.VIEW) ||
    hasPermission(PERMISSIONS.AR.CREDIT_NOTE.CREATE);
  const canCreate = hasPermission(PERMISSIONS.AR.CREDIT_NOTE.CREATE);
  const canSubmit = hasPermission(PERMISSIONS.AR.CREDIT_NOTE.SUBMIT);
  const canApprove = hasPermission(PERMISSIONS.AR.CREDIT_NOTE.APPROVE);
  const canPost = hasPermission(PERMISSIONS.AR.CREDIT_NOTE.POST);
  const canVoid = hasPermission(PERMISSIONS.AR.CREDIT_NOTE.VOID);

  const [rows, setRows] = useState<CreditNoteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<CreditNoteStatus | ''>('');
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const load = () => {
    if (!canView) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    listCreditNotes({
      status: filterStatus || undefined,
      customerId: filterCustomerId || undefined,
      dateFrom: filterFrom || undefined,
      dateTo: filterTo || undefined,
    })
      .then((res) => {
        if (!mounted) return;
        setRows(res.items ?? []);
      })
      .catch((err: any) => {
        setError(getApiErrorMessage(err, 'Failed to load credit notes'));
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
    if (!canView) return <div style={{ color: 'crimson' }}>{`You don’t have permission to view credit notes. Required: ${PERMISSIONS.AR.CREDIT_NOTE.VIEW}.`}</div>;
    if (loading) return <div>Loading...</div>;
    if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

    return (
      <div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Status</div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as CreditNoteStatus | '')}>
              <option value="">All</option>
              <option value="DRAFT">DRAFT</option>
              <option value="SUBMITTED">SUBMITTED</option>
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
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Credit Note No</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Customer</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Original Invoice No</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Date</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Total</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Created By</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Approved By</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Posted By</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const canSubmitRow = canSubmit && r.status === 'DRAFT';
              const canApproveRow = canApprove && r.status === 'SUBMITTED';
              const canPostRow = canPost && r.status === 'APPROVED';
              const canVoidRow = canVoid && r.status === 'POSTED';

              return (
                <tr key={r.id}>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <Link to={`/finance/ar/credit-notes/${r.id}`}>{r.creditNoteNumber}</Link>
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.customerName ?? r.customerId ?? '-'}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.invoiceNumber ?? r.invoiceId ?? '-'}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.creditNoteDate ?? '-'}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(Number(r.totalAmount ?? 0))}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <StatusBadge status={r.status} />
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.createdById ?? '-'}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.approvedById ?? '-'}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.postedById ?? '-'}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Link to={`/finance/ar/credit-notes/${r.id}`}>View</Link>
                      {canSubmitRow ? <Link to={`/finance/ar/credit-notes/${r.id}`}>Submit</Link> : null}
                      {canApproveRow ? <Link to={`/finance/ar/credit-notes/${r.id}`}>Approve</Link> : null}
                      {canPostRow ? <Link to={`/finance/ar/credit-notes/${r.id}`}>Post</Link> : null}
                      {canVoidRow ? <Link to={`/finance/ar/credit-notes/${r.id}`}>Void</Link> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }, [canApprove, canPost, canSubmit, canView, canVoid, error, filterCustomerId, filterFrom, filterStatus, filterTo, loading, rows]);

  return (
    <PageLayout
      title="Credit Notes"
      actions={
        <button type="button" disabled={!canCreate} onClick={() => navigate('/finance/ar/credit-notes/new')}>
          New Credit Note
        </button>
      }
    >
      {content}
    </PageLayout>
  );
}
