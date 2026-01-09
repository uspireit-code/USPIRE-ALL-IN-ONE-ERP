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
  requiresDepartment?: boolean;
  requiresProject?: boolean;
  requiresFund?: boolean;
};

export type CustomerInvoiceLine = {
  id: string;
  accountId: string;
  taxRateId?: string | null;
  departmentId?: string | null;
  projectId?: string | null;
  fundId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number | null;
  discountAmount?: number | null;
  discountTotal?: number | null;
  lineTotal: number;
};

export type CustomerInvoice = {
  id: string;
  customerId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  exchangeRate: number;
  invoiceCategoryId?: string | null;
  projectId?: string | null;
  fundId?: string | null;
  departmentId?: string | null;
  reference?: string | null;
  invoiceNote?: string | null;
  customerNameSnapshot?: string | null;
  customerEmailSnapshot?: string | null;
  customerBillingAddressSnapshot?: string | null;
  subtotal: number;
  taxAmount: number;
  isTaxable?: boolean;
  totalAmount: number;
  outstandingBalance?: number;
  status: 'DRAFT' | 'POSTED';
  createdAt: string;
  createdById: string;
  postedById?: string | null;
  postedAt?: string | null;
  customer: Customer;
  lines: CustomerInvoiceLine[];
};

export type InvoicesListResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: CustomerInvoice[];
};

export type InvoiceCategory = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  isSystemDefault?: boolean;
  revenueAccountId: string;
  requiresProject: boolean;
  requiresFund: boolean;
  requiresDepartment: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InvoicesImportPreviewRow = {
  rowNumber: number;
  invoiceRef: string;
  customerCode: string;
  invoiceDate: string;
  dueDate: string;
  revenueAccountCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number | string | null;
  discountAmount?: number | string | null;
  currency: string;
  errors: string[];
};

export type InvoicesImportPreviewResponse = {
  importId: string;
  totalRows: number;
  validCount: number;
  invalidCount: number;
  rows: InvoicesImportPreviewRow[];
};

export type InvoicesImportResponse = {
  totalRows: number;
  createdCount: number;
  failedCount: number;
  failedRows: Array<{ rowNumber: number; reason: string }>;
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

export type CreditNoteStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'VOID';

export type CreditNoteListItem = {
  id: string;
  creditNoteNumber: string;
  creditNoteDate?: string | null;
  customerId: string;
  customerName?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  currency: string;
  exchangeRate: number;
  subtotal: number;
  totalAmount: number;
  status: CreditNoteStatus;
  createdById?: string | null;
  approvedById?: string | null;
  postedById?: string | null;
  createdAt?: string | null;
  approvedAt?: string | null;
  postedAt?: string | null;
  voidedAt?: string | null;
};

export type CreditNotesListResponse = {
  items: CreditNoteListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type CreditNoteLine = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
  revenueAccountId: string;
  revenueAccountCode?: string | null;
  departmentId?: string | null;
  projectId?: string | null;
  fundId?: string | null;
};

export type CreditNote = {
  id: string;
  creditNoteNumber: string;
  creditNoteDate?: string | null;
  customerId: string;
  customerName?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  invoiceSummary?:
    | {
        invoiceId: string;
        invoiceNumber?: string | null;
        invoiceTotal: number;
        paid: number;
        credited: number;
        outstanding: number;
      }
    | null;
  memo?: string | null;
  currency: string;
  exchangeRate: number;
  subtotal: number;
  totalAmount: number;
  status: CreditNoteStatus;
  createdById?: string | null;
  createdAt?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  postedById?: string | null;
  postedAt?: string | null;
  voidedById?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  postedJournalId?: string | null;
  lines: CreditNoteLine[];
};

export type RefundStatus = 'DRAFT' | 'APPROVED' | 'POSTED' | 'VOID';
export type RefundPaymentMethod = 'BANK' | 'CASH';

export type RefundListItem = {
  id: string;
  refundNumber: string;
  refundDate?: string | null;
  customerId: string;
  customerName?: string | null;
  creditNoteId: string;
  creditNoteNumber?: string | null;
  amount: number;
  currency: string;
  exchangeRate: number;
  paymentMethod: RefundPaymentMethod;
  status: RefundStatus;
  approvedById?: string | null;
  postedById?: string | null;
  postedJournalId?: string | null;
};

export type RefundsListResponse = {
  items: RefundListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type Refund = {
  id: string;
  refundNumber: string;
  refundDate?: string | null;
  customerId: string;
  customerName?: string | null;
  creditNoteId: string;
  creditNoteNumber?: string | null;
  creditNoteDate?: string | null;
  creditNoteTotalAmount?: number;
  creditNoteCurrency?: string | null;
  invoiceId?: string | null;
  currency: string;
  exchangeRate: number;
  amount: number;
  paymentMethod: RefundPaymentMethod;
  bankAccountId?: string | null;
  status: RefundStatus;
  createdById?: string | null;
  createdAt?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  postedById?: string | null;
  postedAt?: string | null;
  voidedById?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  postedJournalId?: string | null;
};

export type CreditNoteRefundableResponse = {
  creditNote: {
    id: string;
    creditNoteNumber: string;
    creditNoteDate?: string | null;
    customerId: string;
    currency: string;
    totalAmount: number;
  };
  refunded: number;
  refundable: number;
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

export async function listInvoices(params?: {
  page?: number;
  pageSize?: number;
  status?: 'DRAFT' | 'POSTED';
  customerId?: string;
  search?: string;
}) {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  if (params?.status) q.set('status', String(params.status));
  if (params?.customerId) q.set('customerId', String(params.customerId));
  if (params?.search) q.set('search', String(params.search));

  const qs = q.toString();
  return apiFetch<InvoicesListResponse>(
    `/finance/ar/invoices${qs ? `?${qs}` : ''}`,
    { method: 'GET' },
  );
}

export async function getInvoiceById(id: string) {
  return apiFetch<CustomerInvoice>(`/finance/ar/invoices/${id}`, { method: 'GET' });
}

export async function createInvoice(params: {
  customerId: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  exchangeRate?: number;
  reference?: string;
  invoiceNote?: string;
  projectId?: string;
  fundId?: string;
  departmentId?: string;
  invoiceCategoryId?: string;
  lines: Array<{
    accountId: string;
    taxRateId?: string;
    departmentId?: string;
    projectId?: string;
    fundId?: string;
    description: string;
    quantity?: number;
    unitPrice: number;
    discountPercent?: number;
    discountAmount?: number;
  }>;
}) {
  return apiFetch<CustomerInvoice>('/finance/ar/invoices', {
    method: 'POST',
    body: JSON.stringify({
      customerId: params.customerId,
      invoiceDate: params.invoiceDate,
      dueDate: params.dueDate,
      currency: params.currency,
      exchangeRate: params.exchangeRate,
      reference: params.reference || undefined,
      invoiceNote: params.invoiceNote || undefined,
      projectId: params.projectId || undefined,
      fundId: params.fundId || undefined,
      departmentId: params.departmentId || undefined,
      invoiceCategoryId: params.invoiceCategoryId || undefined,
      lines: params.lines,
    }),
  });
}

export async function listInvoiceCategories() {
  const res = await apiFetch<{ items: InvoiceCategory[] }>('/finance/ar/invoice-categories', {
    method: 'GET',
  });
  return res?.items ?? [];
}

export async function getInvoiceCategoryById(id: string) {
  return apiFetch<InvoiceCategory>(`/finance/ar/invoice-categories/${id}`, {
    method: 'GET',
  });
}

export async function createInvoiceCategory(params: {
  code: string;
  name: string;
  isActive?: boolean;
  revenueAccountId: string;
  requiresProject?: boolean;
  requiresFund?: boolean;
  requiresDepartment?: boolean;
}) {
  return apiFetch<InvoiceCategory>('/finance/ar/invoice-categories', {
    method: 'POST',
    body: JSON.stringify({
      code: params.code,
      name: params.name,
      isActive: params.isActive,
      revenueAccountId: params.revenueAccountId,
      requiresProject: params.requiresProject,
      requiresFund: params.requiresFund,
      requiresDepartment: params.requiresDepartment,
    }),
  });
}

export async function updateInvoiceCategory(
  id: string,
  params: {
    code?: string;
    name?: string;
    revenueAccountId?: string;
    requiresProject?: boolean;
    requiresFund?: boolean;
    requiresDepartment?: boolean;
  },
) {
  return apiFetch<InvoiceCategory>(`/finance/ar/invoice-categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      code: params.code,
      name: params.name,
      revenueAccountId: params.revenueAccountId,
      requiresProject: params.requiresProject,
      requiresFund: params.requiresFund,
      requiresDepartment: params.requiresDepartment,
    }),
  });
}

export async function setInvoiceCategoryActive(id: string, isActive: boolean) {
  return apiFetch<InvoiceCategory>(`/finance/ar/invoice-categories/${id}/active`, {
    method: 'PUT',
    body: JSON.stringify({
      isActive,
    }),
  });
}

export async function downloadInvoiceExport(id: string, format: 'html' | 'pdf' = 'html') {
  const q = new URLSearchParams();
  q.set('format', format);
  return downloadBlob(`/finance/ar/invoices/${id}/export?${q.toString()}`);
}

export async function postInvoice(id: string) {
  return apiFetch<any>(`/finance/ar/invoices/${id}/post`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function previewInvoicesImport(file: File) {
  const fd = new FormData();
  fd.append('file', file, file.name);
  return apiFetch<InvoicesImportPreviewResponse>('/finance/ar/invoices/import/preview', {
    method: 'POST',
    body: fd,
  });
}

export async function importInvoices(file: File, params: { importId: string }) {
  const fd = new FormData();
  fd.append('file', file, file.name);
  fd.append('importId', params.importId);
  return apiFetch<InvoicesImportResponse>('/finance/ar/invoices/import', {
    method: 'POST',
    body: fd,
  });
}

export async function bulkPostInvoices(params: { invoiceIds: string[] }) {
  return apiFetch<{
    postedCount: number;
    failedCount: number;
    postedInvoiceIds: string[];
    failed: Array<{ invoiceId: string; reason: string }>;
  }>('/finance/ar/invoices/post/bulk', {
    method: 'POST',
    body: JSON.stringify({
      invoiceIds: params.invoiceIds,
    }),
  });
}

export async function downloadInvoicesImportCsvTemplate() {
  return downloadBlob('/finance/ar/invoices/import/template.csv');
}

export async function downloadInvoicesImportXlsxTemplate() {
  return downloadBlob('/finance/ar/invoices/import/template.xlsx');
}

export async function listReceipts() {
  return apiFetch<ArReceipt[]>('/ar/receipts', { method: 'GET' });
}

export async function listCreditNotes(params?: {
  page?: number;
  pageSize?: number;
  status?: CreditNoteStatus;
  customerId?: string;
  invoiceId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  if (params?.status) q.set('status', String(params.status));
  if (params?.customerId) q.set('customerId', String(params.customerId));
  if (params?.invoiceId) q.set('invoiceId', String(params.invoiceId));
  if (params?.search) q.set('search', String(params.search));
  if (params?.dateFrom) q.set('dateFrom', String(params.dateFrom));
  if (params?.dateTo) q.set('dateTo', String(params.dateTo));

  const qs = q.toString();
  return apiFetch<CreditNotesListResponse>(`/finance/ar/credit-notes${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

export async function getCreditNoteById(id: string) {
  return apiFetch<CreditNote>(`/finance/ar/credit-notes/${id}`, { method: 'GET' });
}

export async function createCreditNote(params: {
  creditNoteDate: string;
  customerId: string;
  invoiceId: string;
  memo?: string;
  currency: string;
  exchangeRate?: number;
  lines: Array<{
    description: string;
    quantity?: number;
    unitPrice: number;
    revenueAccountId: string;
  }>;
}) {
  return apiFetch<CreditNote>('/finance/ar/credit-notes', {
    method: 'POST',
    body: JSON.stringify({
      creditNoteDate: params.creditNoteDate,
      customerId: params.customerId,
      invoiceId: params.invoiceId,
      memo: params.memo || undefined,
      currency: params.currency,
      exchangeRate: params.exchangeRate ?? 1,
      lines: params.lines,
    }),
  });
}

export async function approveCreditNote(id: string, params?: { memo?: string }) {
  return apiFetch<CreditNote>(`/finance/ar/credit-notes/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ memo: params?.memo || undefined }),
  });
}

export async function submitCreditNote(id: string, params?: { memo?: string }) {
  return apiFetch<CreditNote>(`/finance/ar/credit-notes/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify({ memo: params?.memo || undefined }),
  });
}

export async function postCreditNote(id: string) {
  return apiFetch<CreditNote>(`/finance/ar/credit-notes/${id}/post`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function voidCreditNote(id: string, reason: string) {
  return apiFetch<CreditNote>(`/finance/ar/credit-notes/${id}/void`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function listRefunds(params?: {
  page?: number;
  pageSize?: number;
  status?: RefundStatus;
  customerId?: string;
  creditNoteId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  if (params?.status) q.set('status', String(params.status));
  if (params?.customerId) q.set('customerId', String(params.customerId));
  if (params?.creditNoteId) q.set('creditNoteId', String(params.creditNoteId));
  if (params?.dateFrom) q.set('dateFrom', String(params.dateFrom));
  if (params?.dateTo) q.set('dateTo', String(params.dateTo));

  const qs = q.toString();
  return apiFetch<RefundsListResponse>(`/finance/ar/refunds${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

export async function getRefundById(id: string) {
  return apiFetch<Refund>(`/finance/ar/refunds/${id}`, { method: 'GET' });
}

export async function getRefundableForCreditNote(creditNoteId: string) {
  return apiFetch<CreditNoteRefundableResponse>(`/finance/ar/refunds/credit-notes/${creditNoteId}/refundable`, {
    method: 'GET',
  });
}

export async function createRefund(params: {
  refundDate: string;
  customerId: string;
  creditNoteId: string;
  currency: string;
  exchangeRate?: number;
  amount: number;
  paymentMethod: RefundPaymentMethod;
  bankAccountId?: string;
}) {
  return apiFetch<Refund>('/finance/ar/refunds', {
    method: 'POST',
    body: JSON.stringify({
      refundDate: params.refundDate,
      customerId: params.customerId,
      creditNoteId: params.creditNoteId,
      currency: params.currency,
      exchangeRate: params.exchangeRate ?? 1,
      amount: params.amount,
      paymentMethod: params.paymentMethod,
      bankAccountId: params.bankAccountId || undefined,
    }),
  });
}

export async function approveRefund(id: string) {
  return apiFetch<Refund>(`/finance/ar/refunds/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function postRefund(id: string) {
  return apiFetch<Refund>(`/finance/ar/refunds/${id}/post`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function voidRefund(id: string, reason: string) {
  return apiFetch<Refund>(`/finance/ar/refunds/${id}/void`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
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

export async function downloadReceiptExport(id: string, format: 'html' | 'pdf' = 'html') {
  const q = new URLSearchParams();
  q.set('format', format);
  return downloadBlob(`/ar/receipts/${id}/export?${q.toString()}`);
}
