import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import type { SupplierInvoice } from '../../services/ap';
import {
  approveBill,
  listBills,
  listEligibleAccounts,
  listSuppliers,
  postBill,
  rejectBill,
  submitBill,
  updateDraftBill,
  type AccountLookup,
  type Supplier,
} from '../../services/ap';
import { getApiErrorMessage } from '../../services/api';
import { downloadBillPdf, triggerBrowserDownload } from '../../services/apExports';
import { Alert } from '../../components/Alert';

function formatMoney(n: unknown) {
  const value = typeof n === 'number' ? n : typeof n === 'string' ? Number(n) : NaN;
  if (!Number.isFinite(value)) return '-';
  return value.toFixed(2);
}

export function BillDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission, state } = useAuth();

  const canView = hasPermission(PERMISSIONS.AP.INVOICE_VIEW);
  const canCreate = hasPermission(PERMISSIONS.AP.INVOICE_CREATE);
  const canSubmit = hasPermission(PERMISSIONS.AP.INVOICE_SUBMIT);
  const canApprove = hasPermission(PERMISSIONS.AP.INVOICE_APPROVE);
  const canPost = hasPermission(PERMISSIONS.AP.INVOICE_POST);
  const canExport = hasPermission(PERMISSIONS.AP.INVOICE_EXPORT);
  const canReject = hasPermission(PERMISSIONS.AP.BILL_REJECT);

  const canConfigureApControlAccount =
    hasPermission(PERMISSIONS.FINANCE.CONFIG_UPDATE) ||
    hasPermission(PERMISSIONS.SYSTEM.CONFIG_UPDATE) ||
    hasPermission(PERMISSIONS.SYSTEM.VIEW_ALL);

  const [bill, setBill] = useState<SupplierInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const userId = state.me?.user?.id;
  const isCreator = Boolean(bill && userId && bill.createdById === userId);

  const [editing, setEditing] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<AccountLookup[]>([]);
  const [editSupplierId, setEditSupplierId] = useState('');
  const [editInvoiceDate, setEditInvoiceDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editLines, setEditLines] = useState<Array<{ id: string; accountId: string; description: string; amount: string }>>([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    listBills()
      .then((rows) => {
        if (!mounted) return;
        const found = rows.find((r) => r.id === id) ?? null;
        setBill(found);
        if (!found) setError('Bill not found');
      })
      .catch((err: any) => {
        const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load bill';
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  const allowed = useMemo(() => {
    const status = bill?.status;
    return {
      submit: Boolean(bill) && status === 'DRAFT' && canSubmit && isCreator,
      approve: Boolean(bill) && status === 'SUBMITTED' && canApprove && !isCreator,
      post: Boolean(bill) && status === 'APPROVED' && canPost,
      reject: Boolean(bill) && status === 'SUBMITTED' && canReject && !isCreator,
    };
  }, [bill, canApprove, canPost, canReject, canSubmit, isCreator]);

  const showRejectionBanner = Boolean(bill?.rejectedAt && bill?.rejectionReason);

  const canEditDraft = Boolean(bill && bill.status === 'DRAFT' && isCreator);

  useEffect(() => {
    if (!bill) return;
    setEditSupplierId(bill.supplierId);
    setEditInvoiceDate(bill.invoiceDate?.slice(0, 10) ?? '');
    setEditDueDate(bill.dueDate?.slice(0, 10) ?? '');
    setEditLines(
      (bill.lines ?? []).map((l) => ({
        id: l.id,
        accountId: l.accountId,
        description: l.description,
        amount: String(l.amount ?? ''),
      })),
    );
  }, [bill?.id]);

  useEffect(() => {
    if (!editing) return;
    if (!canEditDraft) return;
    let mounted = true;
    Promise.all([listSuppliers(), listEligibleAccounts()])
      .then(([sups, accs]) => {
        if (!mounted) return;
        setSuppliers(sups);
        setAccounts(accs);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [editing, canEditDraft]);

  function updateEditLine(id: string, patch: Partial<{ description: string; amount: string; accountId: string }>) {
    setEditLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  async function onSaveDraft() {
    if (!bill) return;
    if (!canEditDraft) return;
    setActionError(null);
    setActing(true);
    try {
      const mapped = editLines
        .map((l) => ({
          accountId: l.accountId,
          description: String(l.description ?? '').trim(),
          amount: Number(l.amount),
        }))
        .filter((l) => l.accountId && l.description && Number.isFinite(l.amount));

      const updated = await updateDraftBill(bill.id, {
        supplierId: editSupplierId,
        invoiceDate: editInvoiceDate,
        dueDate: editDueDate,
        totalAmount: mapped.reduce((s, l) => s + (Number(l.amount) || 0), 0),
        lines: mapped,
      });
      setBill(updated);
      setEditing(false);
    } catch (e: any) {
      setActionError(getApiErrorMessage(e, 'Save failed'));
    } finally {
      setActing(false);
    }
  }

  const showExportPdf = useMemo(() => {
    const status = String(bill?.status ?? '').toUpperCase();
    return canExport && (status === 'APPROVED' || status === 'POSTED');
  }, [bill?.status, canExport]);

  async function runAction(kind: 'submit' | 'approve' | 'post') {
    if (!bill) return;

    setActionError(null);
    setActing(true);
    try {
      if (kind === 'submit') {
        const updated = await submitBill(bill.id);
        setBill(updated);
      } else if (kind === 'approve') {
        const updated = await approveBill(bill.id);
        setBill(updated);
      } else {
        const result = await postBill(bill.id);
        if (result?.invoice) {
          setBill(result.invoice);
        } else {
          const refreshed = await listBills();
          setBill(refreshed.find((r) => r.id === bill.id) ?? bill);
        }
      }
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Action failed';
      setActionError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setActing(false);
    }
  }

  async function onExportPdf() {
    if (!id) return;
    if (!bill) return;
    const status = String(bill.status ?? '').toUpperCase();
    if (!canExport) return;
    if (status !== 'APPROVED' && status !== 'POSTED') return;

    setActionError(null);
    setActing(true);
    try {
      const out = await downloadBillPdf({ id });
      triggerBrowserDownload(out.blob, out.fileName);
    } catch (e: any) {
      setActionError(getApiErrorMessage(e, 'Export PDF failed'));
    } finally {
      setActing(false);
    }
  }

  if (!canView && !canCreate) return <div>You do not have permission to access this page.</div>;
  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;
  if (!bill) return <div style={{ color: 'crimson' }}>Bill not found</div>;

  async function onConfirmReject() {
    if (!bill) return;
    if (!allowed.reject) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setActionError('Rejection reason is required');
      return;
    }
    setActionError(null);
    setActing(true);
    try {
      await rejectBill(bill.id, { reason });
      navigate('/ap/bills?flash=reject-success');
    } catch (e: any) {
      setActionError(getApiErrorMessage(e, 'Reject failed'));
    } finally {
      setActing(false);
      setShowReject(false);
      setRejectReason('');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Bill {bill.invoiceNumber}</h2>
        <Link to="/ap/bills">Back to list</Link>
      </div>

      {showRejectionBanner ? (
        <div style={{ marginTop: 12 }}>
          <Alert tone="warning" title="This bill was rejected">
            <div>
              <div>
                <b>Reason:</b> {bill.rejectionReason}
              </div>
              <div style={{ marginTop: 4, fontSize: 12 }}>
                <b>Rejected At:</b> {String(bill.rejectedAt).slice(0, 19).replace('T', ' ')}
              </div>
            </div>
          </Alert>
        </div>
      ) : null}

      {showReject ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11,12,30,0.38)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 50,
          }}
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) setShowReject(false);
          }}
        >
          <div style={{ width: 520, maxWidth: '96vw', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 750, fontSize: 16 }}>Reject Bill</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
              Provide a reason. This will be visible to the originator.
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Reason</div>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)' }}
              />
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setShowReject(false)} disabled={acting}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void onConfirmReject()}
                disabled={acting || !rejectReason.trim()}
                style={{ background: '#b00020', color: 'white', border: 0, padding: '6px 10px' }}
              >
                {acting ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 12 }}>
        <div>
          <b>Supplier:</b>{' '}
          {editing && canEditDraft ? (
            <select value={editSupplierId} onChange={(e) => setEditSupplierId(e.target.value)}>
              <option value="">Select supplier…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            (bill.supplier?.name ?? '-')
          )}
        </div>
        <div>
          <b>Bill Date:</b>{' '}
          {editing && canEditDraft ? (
            <input type="date" value={editInvoiceDate} onChange={(e) => setEditInvoiceDate(e.target.value)} />
          ) : (
            bill.invoiceDate?.slice(0, 10)
          )}
        </div>
        <div>
          <b>Due Date:</b>{' '}
          {editing && canEditDraft ? (
            <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
          ) : (
            bill.dueDate?.slice(0, 10)
          )}
        </div>
        <div>
          <b>Status:</b> {bill.status}
        </div>
        <div>
          <b>Total:</b> {formatMoney(bill.totalAmount)}
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        {canEditDraft ? (
          editing ? (
            <>
              <button onClick={() => void onSaveDraft()} disabled={acting}>
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setEditSupplierId(bill.supplierId);
                  setEditInvoiceDate(bill.invoiceDate?.slice(0, 10) ?? '');
                  setEditDueDate(bill.dueDate?.slice(0, 10) ?? '');
                  setEditLines(
                    (bill.lines ?? []).map((l) => ({
                      id: l.id,
                      accountId: l.accountId,
                      description: l.description,
                      amount: String(l.amount ?? ''),
                    })),
                  );
                }}
                disabled={acting}
              >
                Cancel
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setEditing(true)} disabled={acting}>
              Edit
            </button>
          )
        ) : null}

        {canSubmit ? (
          <button onClick={() => runAction('submit')} disabled={!allowed.submit || acting}>
            Submit
          </button>
        ) : null}
        {canApprove ? (
          <button onClick={() => runAction('approve')} disabled={!allowed.approve || acting}>
            Approve
          </button>
        ) : null}
        {canPost ? (
          <button onClick={() => runAction('post')} disabled={!allowed.post || acting}>
            Post
          </button>
        ) : null}

        {canReject ? (
          <button
            onClick={() => setShowReject(true)}
            disabled={!allowed.reject || acting}
            style={{ background: '#b00020', color: 'white', border: 0, padding: '6px 10px' }}
          >
            Reject
          </button>
        ) : null}

        {showExportPdf ? (
          <button onClick={() => void onExportPdf()} disabled={acting}>
            Export PDF
          </button>
        ) : null}
      </div>

      {actionError ? (
        <div style={{ color: 'crimson', marginTop: 12 }}>
          <div>{actionError}</div>
          {canConfigureApControlAccount &&
          actionError.includes('AP control account is not configured') ? (
            <div style={{ marginTop: 6, fontSize: 12 }}>
              <Link to="/settings/finance/control-accounts">
                Go to Settings → Finance → Control Accounts
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600 }}>Lines</div>
        <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 8 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Description</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(editing && canEditDraft ? editLines : bill.lines).map((l: any) => (
              <tr key={l.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  {editing && canEditDraft ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        value={l.accountId}
                        onChange={(e) => updateEditLine(l.id, { accountId: e.target.value })}
                        style={{ width: 240 }}
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} - {a.name}
                          </option>
                        ))}
                      </select>
                      <input
                        value={l.description}
                        onChange={(e) => updateEditLine(l.id, { description: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </div>
                  ) : (
                    l.description
                  )}
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                  {editing && canEditDraft ? (
                    <input
                      value={l.amount}
                      onChange={(e) => updateEditLine(l.id, { amount: e.target.value })}
                      style={{ width: 120, textAlign: 'right' }}
                    />
                  ) : (
                    formatMoney(Number(l.amount))
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {bill.status === 'POSTED' ? (
          <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
            This bill is POSTED and cannot be edited.
          </div>
        ) : null}
      </div>
    </div>
  );
}
