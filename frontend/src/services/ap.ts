import { apiFetch } from './api';

export type Supplier = {
  id: string;
  name: string;
  taxNumber?: string | null;
  isActive: boolean;
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

export async function createSupplier(params: { name: string; taxNumber?: string }) {
  return apiFetch<Supplier>('/ap/suppliers', {
    method: 'POST',
    body: JSON.stringify({ name: params.name, taxNumber: params.taxNumber || undefined }),
  });
}

export async function listEligibleAccounts() {
  return apiFetch<AccountLookup[]>('/ap/accounts', { method: 'GET' });
}

export async function listInvoices() {
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

export async function approveInvoice(id: string) {
  return apiFetch<SupplierInvoice>(`/ap/invoices/${id}/approve`, { method: 'POST' });
}

export async function postInvoice(id: string, params?: { apControlAccountCode?: string }) {
  return apiFetch<any>(`/ap/invoices/${id}/post`, {
    method: 'POST',
    body: JSON.stringify({ apControlAccountCode: params?.apControlAccountCode || undefined }),
  });
}
