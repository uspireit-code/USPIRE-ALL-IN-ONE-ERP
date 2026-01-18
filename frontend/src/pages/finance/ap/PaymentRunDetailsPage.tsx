import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { PERMISSIONS } from '../../../auth/permission-catalog';
import { Alert } from '../../../components/Alert';
import { getApiErrorMessage, type ApiError } from '../../../services/api';
import { getPaymentRun, type PaymentRun } from '../../../services/paymentRuns';

function money(n: number) {
  return Number(n ?? 0).toFixed(2);
}

export function PaymentRunDetailsPage() {
  const { id } = useParams();
  const { state } = useAuth();

  const canView = useMemo(() => {
    return (state.me?.permissions ?? []).includes(PERMISSIONS.AP.PAYMENT_RUN_VIEW);
  }, [state.me]);

  const [row, setRow] = useState<PaymentRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!canView) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, id]);

  async function load() {
    const runId = String(id ?? '').trim();
    if (!runId) return;
    setLoading(true);
    setError('');
    try {
      const res = await getPaymentRun(runId);
      setRow(res);
    } catch (e) {
      setRow(null);
      setError(getApiErrorMessage(e as ApiError, 'Failed to load payment run'));
    } finally {
      setLoading(false);
    }
  }

  if (!canView) {
    return (
      <div style={{ padding: 18 }}>
        <h2 style={{ margin: 0 }}>Payment Run</h2>
        <div style={{ marginTop: 10, color: '#b00020' }}>Access denied.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>Payment Run</h2>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
            Read-only payment run details.
          </div>
        </div>
        <Link to="/finance/ap/payment-runs">Back to list</Link>
      </div>

      <div style={{ marginTop: 14 }}>
        {error ? (
          <Alert tone="error" title="Failed to load">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>{error}</div>
              <button
                onClick={() => void load()}
                style={{ height: 34, padding: '0 12px', borderRadius: 8, border: '1px solid #ccc', background: 'white' }}
              >
                Retry
              </button>
            </div>
          </Alert>
        ) : null}

        {loading ? <div>Loading...</div> : null}

        {!loading && !error && !row ? (
          <Alert tone="error" title="Not found">
            Payment run not found.
          </Alert>
        ) : null}

        {!loading && !error && row ? (
          <>
            <div style={{ marginTop: 12, padding: 12, border: '1px solid #e5e5e5', borderRadius: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                <div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Run Number</div>
                  <div style={{ fontWeight: 700 }}>{row.runNumber}</div>
                </div>
                <div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Status</div>
                  <div style={{ fontWeight: 700 }}>{row.status}</div>
                </div>
                <div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Execution Date</div>
                  <div>{String(row.executionDate ?? '').slice(0, 10) || '-'}</div>
                </div>
                <div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Accounting Period</div>
                  <div>{row.period?.name ?? row.periodId}</div>
                </div>
                <div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Bank / Cash Account</div>
                  <div>{row.bankAccount?.name ?? row.bankAccountId}</div>
                </div>
                <div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Total Amount</div>
                  <div>{money(Number(row.totalAmount ?? 0))}</div>
                </div>
                <div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Executed By</div>
                  <div>{row.executedBy?.name ?? row.executedBy?.email ?? row.executedByUserId}</div>
                </div>
                <div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Executed At</div>
                  <div>{String(row.executedAt ?? '').replace('T', ' ').slice(0, 19) || '-'}</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <h3 style={{ margin: 0 }}>Line Items</h3>
              <div style={{ marginTop: 10, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e5e5' }}>
                      <th style={{ padding: '10px 8px' }}>Supplier</th>
                      <th style={{ padding: '10px 8px' }}>Invoice Number</th>
                      <th style={{ padding: '10px 8px' }}>Invoice Date</th>
                      <th style={{ padding: '10px 8px' }}>Original Invoice Amount</th>
                      <th style={{ padding: '10px 8px' }}>Amount Paid (this run)</th>
                      <th style={{ padding: '10px 8px' }}>Remaining Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(row.lines ?? []).map((l) => {
                      const supplierName = l.supplier?.name ?? (l as any)?.paymentProposalLine?.supplierName ?? l.supplierId;
                      const invoiceNumber = l.invoice?.invoiceNumber ?? (l as any)?.paymentProposalLine?.invoiceNumber ?? l.invoiceId;
                      const invoiceDate =
                        (l.invoice?.invoiceDate ?? (l as any)?.paymentProposalLine?.invoiceDate ?? '').toString().slice(0, 10) ||
                        '-';
                      const originalAmount = Number(
                        l.invoice?.totalAmount ??
                          (l as any)?.paymentProposalLine?.originalAmount ??
                          (l as any)?.paymentProposalLine?.outstandingAmount ??
                          0,
                      );

                      const outstandingBefore = Number((l as any)?.paymentProposalLine?.outstandingAmount ?? NaN);
                      const amountPaid = Number(l.amountPaid ?? 0);

                      const remaining = Number.isFinite(outstandingBefore)
                        ? Number(outstandingBefore - amountPaid)
                        : NaN;

                      return (
                        <tr key={l.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '10px 8px' }}>{supplierName}</td>
                          <td style={{ padding: '10px 8px' }}>{invoiceNumber}</td>
                          <td style={{ padding: '10px 8px' }}>{invoiceDate}</td>
                          <td style={{ padding: '10px 8px' }}>{money(originalAmount)}</td>
                          <td style={{ padding: '10px 8px' }}>{money(amountPaid)}</td>
                          <td style={{ padding: '10px 8px' }}>
                            {Number.isFinite(remaining) ? money(remaining) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Accounting Impact: backend does not expose accounts/journal details in this endpoint response.
                Hide this section until it is available. */}
          </>
        ) : null}
      </div>
    </div>
  );
}
