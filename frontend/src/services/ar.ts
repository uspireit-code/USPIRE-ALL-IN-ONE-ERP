import { apiFetch, apiFetchRaw } from './api';

export type Customer = {
  id: string;
  customerCode?: string | null;
  name: string;
  taxNumber?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  billingAddress?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
};

export type CustomersListResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: Customer[];
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

export type ReceiptAllocationLine = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate?: string | null;
  invoiceTotalAmount?: number | null;
  currency?: string | null;
  appliedAmount: number;
  createdAt?: string | null;
};

export type ReceiptAllocationsResponse = {
  receiptId: string;
  lines: ReceiptAllocationLine[];
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
  glJournalId?: string | null;
  createdAt: string;
  postedAt?: string | null;
  postedById?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  lines?: ReceiptLine[];
};

export async function listCustomers(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}) {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  if (params?.search) q.set('search', String(params.search));
  if (params?.status) q.set('status', String(params.status));

  const qs = q.toString();
  return apiFetch<CustomersListResponse>(
    `/finance/ar/customers${qs ? `?${qs}` : ''}`,
    { method: 'GET' },
  );
}

export async function createCustomer(params: {
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  customerCode?: string;
  contactPerson?: string;
  email: string;
  phone?: string;
  billingAddress?: string;
  taxNumber?: string;
}) {
  return apiFetch<Customer>('/finance/ar/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: params.name,
      status: params.status,
      customerCode: params.customerCode || undefined,
      contactPerson: params.contactPerson || undefined,
      email: params.email,
      phone: params.phone || undefined,
      billingAddress: params.billingAddress || undefined,
      taxNumber: params.taxNumber || undefined,
    }),
  });
}

export async function getCustomerById(id: string) {
  return apiFetch<Customer>(`/finance/ar/customers/${id}`, { method: 'GET' });
}

export async function updateCustomer(
  id: string,
  params: {
    name: string;
    status: 'ACTIVE' | 'INACTIVE';
    contactPerson?: string;
    email: string;
    phone?: string;
    billingAddress?: string;
  },
) {
  return apiFetch<Customer>(`/finance/ar/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: params.name,
      status: params.status,
      contactPerson: params.contactPerson || undefined,
      email: params.email,
      phone: params.phone || undefined,
      billingAddress: params.billingAddress || undefined,
    }),
  });
}

export type CustomersImportPreviewRow = {
  rowNumber: number;
  customerCode?: string;
  name: string;
  email: string;
  contactPerson?: string;
  phone?: string;
  billingAddress?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  errors: string[];
};

export type CustomersImportPreviewResponse = {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  rows: CustomersImportPreviewRow[];
};

export type CustomersImportResponse = {
  totalRows: number;
  importedCount: number;
  failedCount: number;
  failedRows: Array<{ rowNumber: number; reason: string }>;
};

export async function previewCustomersImport(file: File) {
  const fd = new FormData();
  fd.append('file', file, file.name);
  return apiFetch<CustomersImportPreviewResponse>('/finance/ar/customers/import/preview', {
    method: 'POST',
    body: fd,
  });
}

export async function importCustomers(file: File) {
  const fd = new FormData();
  fd.append('file', file, file.name);
  return apiFetch<CustomersImportResponse>('/finance/ar/customers/import', {
    method: 'POST',
    body: fd,
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

export async function downloadCustomersImportCsvTemplate() {
  return downloadBlob('/finance/ar/customers/import/template.csv');
}

export async function downloadCustomersImportXlsxTemplate() {
  return downloadBlob('/finance/ar/customers/import/template.xlsx');
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

export async function getReceiptAllocations(id: string) {
  return apiFetch<ReceiptAllocationsResponse>(`/ar/receipts/${id}/allocations`, { method: 'GET' });
}

export async function setReceiptAllocations(id: string, params: { lines?: ReceiptLineInput[] }) {
  return apiFetch<ReceiptAllocationsResponse>(`/ar/receipts/${id}/allocations`, {
    method: 'PUT',
    body: JSON.stringify({ lines: params.lines ?? [] }),
  });
}

export async function voidReceipt(id: string, reason: string) {
  return apiFetch<ArReceipt>(`/ar/receipts/${id}/void`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
