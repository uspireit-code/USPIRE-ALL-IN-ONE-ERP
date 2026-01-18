import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { PERMISSIONS } from '../../../auth/permission-catalog';
import { getApiErrorMessage, type ApiError } from '../../../services/api';
import { Alert } from '../../../components/Alert';
import {
  listPaymentProposals,
  type PaymentProposal,
  type PaymentProposalStatus,
} from '../../../services/paymentProposals';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function money(n: number) {
  return Number(n ?? 0).toFixed(2);
}

export function PaymentProposalsListPage() {
  const { state } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const canView = useMemo(() => {
    return (state.me?.permissions ?? []).includes(PERMISSIONS.AP.PAYMENT_PROPOSAL_VIEW);
  }, [state.me]);

  const canCreate = useMemo(() => {
    return (state.me?.permissions ?? []).includes(PERMISSIONS.AP.PAYMENT_PROPOSAL_CREATE);
  }, [state.me]);

  const [status, setStatus] = useState<PaymentProposalStatus | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(todayIsoDate());

  const [rows, setRows] = useState<PaymentProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const flash = searchParams.get('flash');

  useEffect(() => {
    if (!canView) return;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  async function run() {
    if (!canView) return;
    setLoading(true);
    setError('');
    try {
      const res = await listPaymentProposals({
        status: status || undefined,
        fromDate: fromDate.trim() || undefined,
        toDate: toDate.trim() || undefined,
      });
      setRows(Array.isArray(res) ? res : []);
    } catch (e) {
      setRows([]);
      setError(getApiErrorMessage(e as ApiError, 'Failed to load payment proposals'));
    } finally {
      setLoading(false);
    }
  }

  if (!canView) {
    return (
      <div style={{ padding: 18 }}>
        <h2 style={{ margin: 0 }}>Payment Proposals</h2>
        <div style={{ marginTop: 10, color: '#b00020' }}>Access denied.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>Payment Proposals</h2>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
            Prepare controlled payment proposal packs from posted AP invoices.
          </div>
        </div>
        {canCreate ? (
          <Link
            to="/finance/ap/payment-proposals/new"
            style={{
              height: 36,
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0 14px',
              borderRadius: 8,
              background: '#020445',
              color: 'white',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Create Proposal
          </Link>
        ) : null}
      </div>

      {flash === 'reject-success' ? (
        <div style={{ marginTop: 12 }}>
          <Alert
            tone="success"
            title="Rejected successfully and returned to previous stage."
            actions={
              <button
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete('flash');
                  setSearchParams(next);
                }}
              >
                Dismiss
              </button>
            }
          />
        </div>
      ) : null}

      <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Status</div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)' }}
          >
            <option value="">All</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>From</div>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)' }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>To</div>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)' }}
          />
        </div>

        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          style={{ height: 36, padding: '0 14px', borderRadius: 8, border: 0, background: '#020445', color: 'white' }}
        >
          {loading ? 'Loading…' : 'Apply'}
        </button>
      </div>

      {error ? <div style={{ marginTop: 12, color: '#b00020' }}>{error}</div> : null}

      <div style={{ marginTop: 14, overflowX: 'auto', background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ background: 'rgba(2,4,69,0.05)' }}>
              <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Proposal #</th>
              <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Date</th>
              <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Status</th>
              <th style={{ textAlign: 'right', padding: 12, fontSize: 12 }}>Total</th>
              <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Created By</th>
              <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Approved By</th>
              <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Approved At</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 14, opacity: 0.75 }}>
                  {loading ? 'Loading…' : 'No proposals found.'}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                  <td style={{ padding: 12 }}>
                    <Link to={`/finance/ap/payment-proposals/${r.id}`} style={{ color: '#1a4fd8', textDecoration: 'none' }}>
                      {r.proposalNumber}
                    </Link>
                  </td>
                  <td style={{ padding: 12 }}>{String(r.proposalDate).slice(0, 10)}</td>
                  <td style={{ padding: 12 }}>{r.status}</td>
                  <td style={{ padding: 12, textAlign: 'right' }}>{money(r.totalAmount)}</td>
                  <td style={{ padding: 12 }}>{r.createdBy?.name || r.createdBy?.email || r.createdById}</td>
                  <td style={{ padding: 12 }}>{r.approvedBy?.name || r.approvedBy?.email || (r.approvedById ?? '')}</td>
                  <td style={{ padding: 12 }}>{r.approvedAt ? String(r.approvedAt).slice(0, 19).replace('T', ' ') : ''}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
