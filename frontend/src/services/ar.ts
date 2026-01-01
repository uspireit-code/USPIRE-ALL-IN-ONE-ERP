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

export type ReceiptStatus = 'DRAFT' | 'POSTED' | 'VOIDED';

export type ReceiptPaymentMethod = 'CASH' | 'CARD' | 'EFT' | 'CHEQUE' | 'OTHER';

export type ReceiptLineInput = {
  invoiceId: string;
  appliedAmount: number;
};

export type ReceiptLine = ReceiptLineInput & {
  id: string;
  invoiceNumber: string;
};

export type ArReceipt = {
  id: string;
  receiptNumber: string;
  receiptDate: string;
  customerId: string;
  customerName: string;
  currency: string;
  totalAmount: number;
  paymentMethod: ReceiptPaymentMethod;
  paymentReference?: string | null;
  status: ReceiptStatus;
  createdAt: string;
  postedAt?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  lines?: ReceiptLine[];
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

export async function createReceipt(params: {
  customerId: string;
  receiptDate: string;
  currency: string;
  totalAmount: number;
  paymentMethod: ReceiptPaymentMethod;
  paymentReference?: string;
  lines?: ReceiptLineInput[];
}) {
  return apiFetch<ArReceipt>('/ar/receipts', {
    method: 'POST',
    body: JSON.stringify({
      customerId: params.customerId,
      receiptDate: params.receiptDate,
      currency: params.currency,
      totalAmount: params.totalAmount,
      paymentMethod: params.paymentMethod,
      paymentReference: params.paymentReference || undefined,
      lines: params.lines ?? [],
    }),
  });
}

export async function updateReceipt(id: string, params: {
  customerId?: string;
  receiptDate?: string;
  currency?: string;
  totalAmount?: number;
  paymentMethod?: ReceiptPaymentMethod;
  paymentReference?: string;
  lines?: ReceiptLineInput[];
}) {
  return apiFetch<ArReceipt>(`/ar/receipts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      customerId: params.customerId,
      receiptDate: params.receiptDate,
      currency: params.currency,
      totalAmount: params.totalAmount,
      paymentMethod: params.paymentMethod,
      paymentReference: params.paymentReference,
      lines: params.lines,
    }),
  });
}

export async function postReceipt(id: string) {
  return apiFetch<ArReceipt>(`/ar/receipts/${id}/post`, { method: 'POST' });
}

export async function voidReceipt(id: string, reason: string) {
  return apiFetch<ArReceipt>(`/ar/receipts/${id}/void`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
