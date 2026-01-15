import { apiFetch, apiFetchRaw } from './api';

export type Supplier = {
  id: string;
  name: string;
  taxNumber?: string | null;
  registrationNumber?: string | null;
  vatRegistered?: boolean | null;
  defaultPaymentTerms?: string | null;
  defaultCurrency?: string | null;
  withholdingProfile?: 'NONE' | 'STANDARD' | 'SPECIAL' | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
};

export type SupplierImportPreviewError = {
  rowNumber: number;
  field?: string;
  message: string;
};

export type SupplierImportPreviewRow = {
  rowNumber: number;
  name: string;
  taxNumber?: string;
  registrationNumber?: string;
  vatRegistered?: boolean;
  defaultPaymentTerms?: string;
  defaultCurrency?: string;
  withholdingProfile?: 'NONE' | 'STANDARD' | 'SPECIAL';
  email?: string;
  phone?: string;
  address?: string;
  isDuplicate: boolean;
  isValid: boolean;
};

export type SupplierImportPreviewResponse = {
  fileName: string;
  totalRows: number;
  errorCount: number;
  errors: SupplierImportPreviewError[];
  rows: SupplierImportPreviewRow[];
};

export type SupplierDocument = {
  id: string;
  tenantId: string;
  supplierId: string;
  docType: string;
  filename: string;
  mimeType: string;
  storageKey: string;
  fileSize?: number | null;
  notes?: string | null;
  createdById: string;
  createdAt: string;
  isActive: boolean;
};

export type SupplierBankAccount = {
  id: string;
  tenantId: string;
  supplierId: string;
  bankName: string;
  branchName?: string | null;
  accountName: string;
  accountNumber: string;
  currency?: string | null;
  swiftCode?: string | null;
  notes?: string | null;
  isPrimary: boolean;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedById?: string | null;
  updatedAt: string;
};

export type SupplierChangeLog = {
  id: string;
  tenantId: string;
  supplierId: string;
  changeType: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  refId?: string | null;
  actorUserId: string;
  createdAt: string;
};

export type AccountLookup = {
  id: string;
  code: string;
  name: string;
  type: string;
};

export type SupplierInvoiceLine = {
  id: string;
  accountId: string;
  description: string;
  amount: number;
};

export type SupplierInvoice = {
  id: string;
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED';
  createdAt: string;
  createdById: string;
  approvedById?: string | null;
  approvedAt?: string | null;
  postedById?: string | null;
  postedAt?: string | null;
  supplier: Supplier;
  lines: SupplierInvoiceLine[];
};

export async function listSuppliers() {
  return apiFetch<Supplier[]>('/ap/suppliers', { method: 'GET' });
}

export async function createSupplier(params: {
  name: string;
  taxNumber?: string;
  registrationNumber?: string;
  vatRegistered?: boolean;
  defaultPaymentTerms?: string;
  defaultCurrency?: string;
  withholdingProfile?: 'NONE' | 'STANDARD' | 'SPECIAL';
  email?: string;
  phone?: string;
  address?: string;
}) {
  return apiFetch<Supplier>('/ap/suppliers', {
    method: 'POST',
    body: JSON.stringify({
      name: params.name,
      taxNumber: params.taxNumber || undefined,
      registrationNumber: params.registrationNumber || undefined,
      vatRegistered: typeof params.vatRegistered === 'boolean' ? params.vatRegistered : undefined,
      defaultPaymentTerms: params.defaultPaymentTerms || undefined,
      defaultCurrency: params.defaultCurrency || undefined,
      withholdingProfile: params.withholdingProfile || undefined,
      email: params.email || undefined,
      phone: params.phone || undefined,
      address: params.address || undefined,
    }),
  });
}

export async function createBill(params: {
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  lines: Array<{ accountId: string; description: string; amount: number }>;
}) {
  return apiFetch<SupplierInvoice>('/ap/invoices', {
    method: 'POST',
    body: JSON.stringify({
      supplierId: params.supplierId,
      invoiceNumber: params.invoiceNumber,
      invoiceDate: params.invoiceDate,
      dueDate: params.dueDate,
      totalAmount: params.totalAmount,
      lines: params.lines,
    }),
  });
}

async function downloadBlob(path: string) {
  const res = await apiFetchRaw(path, { method: 'GET' });
  const blob = await res.blob();
  const contentDisposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(contentDisposition);
  const fileName = match?.[1] || 'download';
  return { blob, fileName };
}

export async function downloadSupplierImportTemplate() {
  return downloadBlob('/ap/suppliers/import/template.csv');
}

export async function previewSupplierImport(file: File) {
  const fd = new FormData();
  fd.append('file', file, file.name);
  return apiFetch<SupplierImportPreviewResponse>('/ap/suppliers/import/preview', {
    method: 'POST',
    body: fd,
  });
}

export async function commitSupplierImport(rows: SupplierImportPreviewRow[]) {
  return apiFetch<{ created: number; skippedDuplicates: number; skippedInvalid: number; received: number }>(
    '/ap/suppliers/import/commit',
    {
      method: 'POST',
      body: JSON.stringify({ rows }),
    },
  );
}

// Supplier documents
export async function listSupplierDocuments(supplierId: string) {
  return apiFetch<SupplierDocument[]>(`/ap/suppliers/${supplierId}/documents`, { method: 'GET' });
}

export async function uploadSupplierDocument(
  supplierId: string,
  payload: { docType: string; notes?: string },
  file: File,
) {
  const form = new FormData();
  form.append('file', file);
  form.append('docType', payload.docType);
  if (payload.notes) form.append('notes', payload.notes);

  const res = await apiFetchRaw(`/ap/suppliers/${supplierId}/documents`, {
    method: 'POST',
    body: form,
  });
  return (await res.json()) as SupplierDocument;
}

export async function deactivateSupplierDocument(supplierId: string, docId: string) {
  return apiFetch<{ ok: true }>(`/ap/suppliers/${supplierId}/documents/${docId}/deactivate`, {
    method: 'PATCH',
  });
}

export async function downloadSupplierDocument(supplierId: string, docId: string) {
  const res = await apiFetchRaw(`/ap/suppliers/${supplierId}/documents/${docId}/download`, { method: 'GET' });
  return res.blob();
}

// Supplier bank accounts
export async function listSupplierBankAccounts(supplierId: string) {
  return apiFetch<SupplierBankAccount[]>(`/ap/suppliers/${supplierId}/bank-accounts`, { method: 'GET' });
}

export async function createSupplierBankAccount(
  supplierId: string,
  payload: {
    bankName: string;
    branchName?: string;
    accountName: string;
    accountNumber: string;
    currency?: string;
    swiftCode?: string;
    notes?: string;
    isPrimary?: boolean;
  },
) {
  return apiFetch<SupplierBankAccount>(`/ap/suppliers/${supplierId}/bank-accounts`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateSupplierBankAccount(
  supplierId: string,
  bankId: string,
  payload: {
    bankName?: string;
    branchName?: string;
    accountName?: string;
    accountNumber?: string;
    currency?: string;
    swiftCode?: string;
    notes?: string;
    isPrimary?: boolean;
  },
) {
  return apiFetch<SupplierBankAccount>(`/ap/suppliers/${supplierId}/bank-accounts/${bankId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deactivateSupplierBankAccount(supplierId: string, bankId: string) {
  return apiFetch<{ ok: true }>(`/ap/suppliers/${supplierId}/bank-accounts/${bankId}/deactivate`, {
    method: 'PATCH',
  });
}

export async function setPrimarySupplierBankAccount(supplierId: string, bankId: string) {
  return apiFetch<{ ok: true }>(`/ap/suppliers/${supplierId}/bank-accounts/${bankId}/set-primary`, {
    method: 'PATCH',
  });
}

// Supplier change history
export async function listSupplierChangeHistory(supplierId: string) {
  return apiFetch<SupplierChangeLog[]>(`/ap/suppliers/${supplierId}/change-history`, { method: 'GET' });
}

export async function listEligibleAccounts() {
  return apiFetch<AccountLookup[]>('/ap/accounts', { method: 'GET' });
}

export async function listInvoices() {
  return apiFetch<SupplierInvoice[]>('/ap/invoices', { method: 'GET' });
}

export async function listBills() {
  return apiFetch<SupplierInvoice[]>('/ap/invoices', { method: 'GET' });
}

export async function createInvoice(params: {
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  lines: Array<{ accountId: string; description: string; amount: number }>;
}) {
  return apiFetch<SupplierInvoice>('/ap/invoices', {
    method: 'POST',
    body: JSON.stringify({
      supplierId: params.supplierId,
      invoiceNumber: params.invoiceNumber,
      invoiceDate: params.invoiceDate,
      dueDate: params.dueDate,
      totalAmount: params.totalAmount,
      lines: params.lines,
    }),
  });
}

export async function submitInvoice(id: string) {
  return apiFetch<SupplierInvoice>(`/ap/invoices/${id}/submit`, { method: 'POST' });
}

export async function submitBill(id: string) {
  return apiFetch<SupplierInvoice>(`/ap/invoices/${id}/submit`, { method: 'POST' });
}

export async function approveInvoice(id: string) {
  return apiFetch<SupplierInvoice>(`/ap/invoices/${id}/approve`, { method: 'POST' });
}

export async function approveBill(id: string) {
  return apiFetch<SupplierInvoice>(`/ap/invoices/${id}/approve`, { method: 'POST' });
}

export async function postInvoice(id: string, params?: { apControlAccountCode?: string }) {
  return apiFetch<any>(`/ap/invoices/${id}/post`, {
    method: 'POST',
    body: JSON.stringify({ apControlAccountCode: params?.apControlAccountCode || undefined }),
  });
}

export async function postBill(id: string, params?: { apControlAccountCode?: string }) {
  return apiFetch<any>(`/ap/invoices/${id}/post`, {
    method: 'POST',
    body: JSON.stringify({ apControlAccountCode: params?.apControlAccountCode || undefined }),
  });
}
