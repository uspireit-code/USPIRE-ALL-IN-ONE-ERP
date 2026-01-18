import { apiFetch } from './api';

export type EligibleApInvoice = {
  id: string;
  invoiceId?: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  invoiceTotal?: number;
  outstandingAmount: number;
  outstandingBalance?: number;
  reservedAmount: number;
  remainingProposableAmount: number;
  remainingProposable?: number;
};

export async function listEligibleApInvoicesForPaymentProposal(params?: {
  supplierId?: string;
  search?: string;
  limit?: number;
}): Promise<EligibleApInvoice[]> {
  const qs = new URLSearchParams();
  if (params?.supplierId) qs.set('supplierId', params.supplierId);
  if (params?.search) qs.set('search', params.search);
  if (typeof params?.limit === 'number') qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<EligibleApInvoice[]>(`/ap/payment-proposals/eligible-invoices${suffix}`);
}
