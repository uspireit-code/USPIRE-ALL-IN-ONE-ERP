import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import { PageLayout } from '../../components/PageLayout';
import type { Supplier, SupplierBankAccount, SupplierChangeLog, SupplierDocument } from '../../services/ap';
import {
  createSupplierBankAccount,
  deactivateSupplierBankAccount,
  deactivateSupplierDocument,
  downloadSupplierDocument,
  listSupplierBankAccounts,
  listSupplierChangeHistory,
  listSupplierDocuments,
  listSuppliers,
  setPrimarySupplierBankAccount,
  updateSupplierBankAccount,
  uploadSupplierDocument,
} from '../../services/ap';

type TabKey = 'OVERVIEW' | 'KYC' | 'BANK' | 'HISTORY';

export function SupplierDetailsPage() {
  const params = useParams();
  const supplierId = params.id ?? '';

  const { hasPermission } = useAuth();
  const canViewSupplier = hasPermission(PERMISSIONS.AP.SUPPLIER.VIEW);
  const canManageSupplier = hasPermission(PERMISSIONS.AP.SUPPLIER.CREATE);

  const [tab, setTab] = useState<TabKey>('OVERVIEW');

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loadingSupplier, setLoadingSupplier] = useState(true);
  const [supplierError, setSupplierError] = useState<string | null>(null);

  const [docs, setDocs] = useState<SupplierDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);

  const [banks, setBanks] = useState<SupplierBankAccount[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksError, setBanksError] = useState<string | null>(null);

  const [history, setHistory] = useState<SupplierChangeLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [docType, setDocType] = useState('TPIN');
  const [docNotes, setDocNotes] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docBusy, setDocBusy] = useState(false);

  const [bankForm, setBankForm] = useState<{
    mode: 'CREATE' | 'EDIT';
    editingId?: string;
    bankName: string;
    branchName: string;
    accountName: string;
    accountNumber: string;
    currency: string;
    swiftCode: string;
    notes: string;
    isPrimary: boolean;
  }>({
    mode: 'CREATE',
    bankName: '',
    branchName: '',
    accountName: '',
    accountNumber: '',
    currency: '',
    swiftCode: '',
    notes: '',
    isPrimary: false,
  });
  const [bankBusy, setBankBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!supplierId) {
      setSupplierError('Missing supplier id');
      setLoadingSupplier(false);
      return;
    }

    if (!canViewSupplier) {
      setSupplierError('Permission denied');
      setLoadingSupplier(false);
      return;
    }

    setLoadingSupplier(true);
    setSupplierError(null);

    listSuppliers()
      .then((rows) => {
        if (!mounted) return;
        const found = rows.find((s) => s.id === supplierId) ?? null;
        setSupplier(found);
        if (!found) setSupplierError('Supplier not found');
      })
      .catch((err: any) => {
        const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load supplier';
        if (!mounted) return;
        setSupplierError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingSupplier(false);
      });

    return () => {
      mounted = false;
    };
  }, [supplierId, canViewSupplier]);

  async function refreshDocs() {
    setDocsLoading(true);
    setDocsError(null);
    try {
      const rows = await listSupplierDocuments(supplierId);
      setDocs(rows);
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load documents';
      setDocsError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setDocsLoading(false);
    }
  }

  async function refreshBanks() {
    setBanksLoading(true);
    setBanksError(null);
    try {
      const rows = await listSupplierBankAccounts(supplierId);
      setBanks(rows);
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load bank accounts';
      setBanksError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setBanksLoading(false);
    }
  }

  async function refreshHistory() {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const rows = await listSupplierChangeHistory(supplierId);
      setHistory(rows);
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load change history';
      setHistoryError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (!supplierId) return;
    if (tab === 'KYC') refreshDocs();
    if (tab === 'BANK') refreshBanks();
    if (tab === 'HISTORY') refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId, tab]);

  async function onUploadDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!canManageSupplier) return;
    if (!docFile) {
      setDocsError('Please select a file');
      return;
    }

    setDocBusy(true);
    try {
      await uploadSupplierDocument(supplierId, { docType, notes: docNotes || undefined }, docFile);
      setDocFile(null);
      setDocNotes('');
      const input = document.getElementById('supplier-doc-file') as HTMLInputElement | null;
      if (input) input.value = '';
      await refreshDocs();
      await refreshHistory();
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to upload document';
      setDocsError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setDocBusy(false);
    }
  }

  async function onDeactivateDoc(docId: string) {
    if (!canManageSupplier) return;
    setDocsError(null);
    try {
      await deactivateSupplierDocument(supplierId, docId);
      await refreshDocs();
      await refreshHistory();
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to deactivate document';
      setDocsError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  }

  async function onDownloadDoc(docId: string, filename: string) {
    setDocsError(null);
    try {
      const blob = await downloadSupplierDocument(supplierId, docId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'document';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to download document';
      setDocsError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  }

  function resetBankForm() {
    setBankForm({
      mode: 'CREATE',
      bankName: '',
      branchName: '',
      accountName: '',
      accountNumber: '',
      currency: '',
      swiftCode: '',
      notes: '',
      isPrimary: false,
    });
  }

  async function onSubmitBank(e: React.FormEvent) {
    e.preventDefault();
    if (!canManageSupplier) return;

    setBankBusy(true);
    setBanksError(null);
    try {
      if (bankForm.mode === 'CREATE') {
        await createSupplierBankAccount(supplierId, {
          bankName: bankForm.bankName,
          branchName: bankForm.branchName || undefined,
          accountName: bankForm.accountName,
          accountNumber: bankForm.accountNumber,
          currency: bankForm.currency || undefined,
          swiftCode: bankForm.swiftCode || undefined,
          notes: bankForm.notes || undefined,
          isPrimary: bankForm.isPrimary,
        });
      } else {
        await updateSupplierBankAccount(supplierId, bankForm.editingId!, {
          bankName: bankForm.bankName || undefined,
          branchName: bankForm.branchName || undefined,
          accountName: bankForm.accountName || undefined,
          accountNumber: bankForm.accountNumber || undefined,
          currency: bankForm.currency || undefined,
          swiftCode: bankForm.swiftCode || undefined,
          notes: bankForm.notes || undefined,
          isPrimary: bankForm.isPrimary,
        });
      }

      resetBankForm();
      await refreshBanks();
      await refreshHistory();
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to save bank account';
      setBanksError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setBankBusy(false);
    }
  }

  async function onDeactivateBank(bankId: string) {
    if (!canManageSupplier) return;
    setBanksError(null);
    try {
      await deactivateSupplierBankAccount(supplierId, bankId);
      await refreshBanks();
      await refreshHistory();
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to deactivate bank account';
      setBanksError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  }

  async function onSetPrimary(bankId: string) {
    if (!canManageSupplier) return;
    setBanksError(null);
    try {
      await setPrimarySupplierBankAccount(supplierId, bankId);
      await refreshBanks();
      await refreshHistory();
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to set primary bank account';
      setBanksError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  }

  const header = useMemo(() => {
    if (loadingSupplier) return 'Supplier';
    if (!supplier) return 'Supplier';
    return `Supplier: ${supplier.name}`;
  }, [loadingSupplier, supplier]);

  const tabs = (
    <div style={{ display: 'flex', gap: 8 }}>
      {([
        ['OVERVIEW', 'Overview'],
        ['KYC', 'KYC Documents'],
        ['BANK', 'Bank Accounts'],
        ['HISTORY', 'Change History'],
      ] as Array<[TabKey, string]>).map(([k, label]) => (
        <button
          key={k}
          onClick={() => setTab(k)}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid #ddd',
            background: tab === k ? '#0B0C1E' : '#fff',
            color: tab === k ? '#fff' : '#0B0C1E',
            cursor: 'pointer',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const overview = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {supplierError ? <div style={{ color: 'crimson' }}>{supplierError}</div> : null}
      {!supplier ? null : (
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8, maxWidth: 720 }}>
          <div style={{ color: 'rgba(11,12,30,0.65)' }}>Name</div>
          <div>{supplier.name}</div>
          <div style={{ color: 'rgba(11,12,30,0.65)' }}>Tax Number</div>
          <div>{supplier.taxNumber ?? '-'}</div>
          <div style={{ color: 'rgba(11,12,30,0.65)' }}>Status</div>
          <div>{supplier.isActive ? 'ACTIVE' : 'INACTIVE'}</div>
        </div>
      )}
    </div>
  );

  const kyc = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!canManageSupplier ? <div style={{ color: 'rgba(11,12,30,0.65)' }}>You do not have permission to upload/deactivate documents.</div> : null}

      <form onSubmit={onUploadDoc} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 720 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            Doc Type
            <select value={docType} onChange={(e) => setDocType(e.target.value)} style={{ minWidth: 180 }}>
              <option value="TPIN">TPIN</option>
              <option value="NRC">NRC</option>
              <option value="PACRA">PACRA</option>
              <option value="CONTRACT">CONTRACT</option>
              <option value="OTHER">OTHER</option>
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 220 }}>
            Notes
            <input value={docNotes} onChange={(e) => setDocNotes(e.target.value)} placeholder="Optional" />
          </label>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          File
          <input
            id="supplier-doc-file"
            type="file"
            onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
            accept="application/pdf,image/*"
            disabled={!canManageSupplier}
          />
        </label>

        {docsError ? <div style={{ color: 'crimson', fontSize: 13 }}>{docsError}</div> : null}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={!canManageSupplier || docBusy}>
            {docBusy ? 'Uploading...' : 'Upload'}
          </button>
          <button type="button" onClick={refreshDocs} disabled={docsLoading}>
            Refresh
          </button>
        </div>
      </form>

      {docsLoading ? <div>Loading...</div> : null}
      {!docsLoading ? (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Type</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>File</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Uploaded</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{d.docType}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{d.filename}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{new Date(d.createdAt).toLocaleString()}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => onDownloadDoc(d.id, d.filename)}>
                      Download
                    </button>
                    {canManageSupplier ? (
                      <button type="button" onClick={() => onDeactivateDoc(d.id)}>
                        Deactivate
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {docs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 8, color: 'rgba(11,12,30,0.65)' }}>
                  No documents.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      ) : null}
    </div>
  );

  const bankAccounts = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!canManageSupplier ? <div style={{ color: 'rgba(11,12,30,0.65)' }}>You do not have permission to manage bank accounts.</div> : null}

      <form onSubmit={onSubmitBank} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 720 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220, flex: 1 }}>
            Bank Name
            <input value={bankForm.bankName} onChange={(e) => setBankForm((s) => ({ ...s, bankName: e.target.value }))} required />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220, flex: 1 }}>
            Branch Name
            <input value={bankForm.branchName} onChange={(e) => setBankForm((s) => ({ ...s, branchName: e.target.value }))} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220, flex: 1 }}>
            Account Name
            <input value={bankForm.accountName} onChange={(e) => setBankForm((s) => ({ ...s, accountName: e.target.value }))} required />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220, flex: 1 }}>
            Account Number
            <input value={bankForm.accountNumber} onChange={(e) => setBankForm((s) => ({ ...s, accountNumber: e.target.value }))} required />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
            Currency
            <input value={bankForm.currency} onChange={(e) => setBankForm((s) => ({ ...s, currency: e.target.value }))} placeholder="Optional" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220, flex: 1 }}>
            Swift Code
            <input value={bankForm.swiftCode} onChange={(e) => setBankForm((s) => ({ ...s, swiftCode: e.target.value }))} placeholder="Optional" />
          </label>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          Notes
          <input value={bankForm.notes} onChange={(e) => setBankForm((s) => ({ ...s, notes: e.target.value }))} placeholder="Optional" />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={bankForm.isPrimary} onChange={(e) => setBankForm((s) => ({ ...s, isPrimary: e.target.checked }))} />
          Primary
        </label>

        {banksError ? <div style={{ color: 'crimson', fontSize: 13 }}>{banksError}</div> : null}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="submit" disabled={!canManageSupplier || bankBusy}>
            {bankBusy ? 'Saving...' : bankForm.mode === 'CREATE' ? 'Add Bank Account' : 'Save Changes'}
          </button>
          {bankForm.mode === 'EDIT' ? (
            <button type="button" onClick={resetBankForm} disabled={bankBusy}>
              Cancel Edit
            </button>
          ) : null}
          <button type="button" onClick={refreshBanks} disabled={banksLoading}>
            Refresh
          </button>
        </div>
      </form>

      {banksLoading ? <div>Loading...</div> : null}
      {!banksLoading ? (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Primary</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Bank</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Account</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {banks.map((b) => (
              <tr key={b.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{b.isPrimary ? 'YES' : ''}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <div style={{ fontWeight: 600 }}>{b.bankName}</div>
                  <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.65)' }}>{b.branchName ?? ''}</div>
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <div>{b.accountName}</div>
                  <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.65)' }}>{b.accountNumber}</div>
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {canManageSupplier ? (
                      <button
                        type="button"
                        onClick={() =>
                          setBankForm({
                            mode: 'EDIT',
                            editingId: b.id,
                            bankName: b.bankName,
                            branchName: b.branchName ?? '',
                            accountName: b.accountName,
                            accountNumber: b.accountNumber,
                            currency: b.currency ?? '',
                            swiftCode: b.swiftCode ?? '',
                            notes: b.notes ?? '',
                            isPrimary: Boolean(b.isPrimary),
                          })
                        }
                      >
                        Edit
                      </button>
                    ) : null}
                    {canManageSupplier ? (
                      <button type="button" onClick={() => onSetPrimary(b.id)} disabled={b.isPrimary}>
                        Set Primary
                      </button>
                    ) : null}
                    {canManageSupplier ? (
                      <button type="button" onClick={() => onDeactivateBank(b.id)}>
                        Deactivate
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {banks.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 8, color: 'rgba(11,12,30,0.65)' }}>
                  No bank accounts.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      ) : null}
    </div>
  );

  const changeHistory = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {historyError ? <div style={{ color: 'crimson' }}>{historyError}</div> : null}
      {historyLoading ? <div>Loading...</div> : null}
      {!historyLoading ? (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>When</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Type</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Field</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Old</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>New</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Ref</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{new Date(h.createdAt).toLocaleString()}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{h.changeType}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{h.field ?? ''}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{h.oldValue ?? ''}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{h.newValue ?? ''}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{h.refId ?? ''}</td>
              </tr>
            ))}
            {history.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 8, color: 'rgba(11,12,30,0.65)' }}>
                  No history.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      ) : null}
    </div>
  );

  const body = useMemo(() => {
    if (loadingSupplier) return <div>Loading...</div>;
    if (tab === 'OVERVIEW') return overview;
    if (tab === 'KYC') return kyc;
    if (tab === 'BANK') return bankAccounts;
    return changeHistory;
  }, [bankAccounts, changeHistory, kyc, loadingSupplier, overview, tab]);

  return (
    <PageLayout
      title={header}
      description="Supplier master extension: KYC Documents, Bank Accounts, Change History"
      actions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link to="/ap/suppliers">Back to Suppliers</Link>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {tabs}
        {body}
      </div>
    </PageLayout>
  );
}
