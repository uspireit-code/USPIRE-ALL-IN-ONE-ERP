import { apiFetch } from './api';

export type Customer = {
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

export type CustomerInvoiceLine = {
  id: string;
  accountId: string;
  description: string;
  amount: number;
};

export type CustomerInvoice = {
  id: string;
  customerId: string;
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
  customer: Customer;
  lines: CustomerInvoiceLine[];
};

export type ArReceipt = {
  id: string;
  receiptNo: string;
  date: string;
  customer: string;
  amount: number;
  status: string;
};

export async function listCustomers() {
  return apiFetch<Customer[]>('/ar/customers', { method: 'GET' });
}

export async function createCustomer(params: { name: string; taxNumber?: string }) {
  return apiFetch<Customer>('/ar/customers', {
    method: 'POST',
    body: JSON.stringify({ name: params.name, taxNumber: params.taxNumber || undefined }),
  });
}

export async function listEligibleAccounts() {
  return apiFetch<AccountLookup[]>('/ar/accounts', { method: 'GET' });
}

export async function listInvoices() {
  return apiFetch<CustomerInvoice[]>('/ar/invoices', { method: 'GET' });
}

export async function createInvoice(params: {
  customerId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  lines: Array<{ accountId: string; description: string; amount: number }>;
}) {
  return apiFetch<CustomerInvoice>('/ar/invoices', {
    method: 'POST',
    body: JSON.stringify({
      customerId: params.customerId,
      invoiceNumber: params.invoiceNumber,
      invoiceDate: params.invoiceDate,
      dueDate: params.dueDate,
      totalAmount: params.totalAmount,
      lines: params.lines,
    }),
  });
}

export async function submitInvoice(id: string) {
  return apiFetch<CustomerInvoice>(`/ar/invoices/${id}/submit`, { method: 'POST' });
}

export async function approveInvoice(id: string) {
  return apiFetch<CustomerInvoice>(`/ar/invoices/${id}/approve`, { method: 'POST' });
}

export async function postInvoice(id: string, params?: { arControlAccountCode?: string }) {
  return apiFetch<any>(`/ar/invoices/${id}/post`, {
    method: 'POST',
    body: JSON.stringify({ arControlAccountCode: params?.arControlAccountCode || undefined }),
  });
}

export async function listReceipts() {
  return apiFetch<ArReceipt[]>('/ar/receipts', { method: 'GET' });
}

export async function getReceiptById(id: string) {
  return apiFetch<ArReceipt>(`/ar/receipts/${id}`, { method: 'GET' });
}
