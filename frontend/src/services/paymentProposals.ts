import { apiFetch } from './api';

export type PaymentProposalStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED';

export type PaymentProposalUser = {
  id: string;
  email?: string;
  name?: string;
};

export type PaymentProposalLine = {
  id: string;
  tenantId: string;
  proposalId: string;
  supplierId: string;
  supplierName: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  originalAmount: number;
  outstandingAmount: number;
  proposedPayAmount: number;
  createdAt: string;
};

export type PaymentProposal = {
  id: string;
  tenantId: string;
  proposalNumber: string;
  proposalDate: string;
  status: PaymentProposalStatus;
  totalAmount: number;
  createdById: string;
  approvedById?: string | null;
  approvedAt?: string | null;
  rejectedByUserId?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: PaymentProposalUser;
  approvedBy?: PaymentProposalUser | null;
  rejectedBy?: PaymentProposalUser | null;
  lines?: PaymentProposalLine[];
};

export async function listPaymentProposals(params?: {
  status?: PaymentProposalStatus;
  fromDate?: string;
  toDate?: string;
}): Promise<PaymentProposal[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.fromDate) qs.set('fromDate', params.fromDate);
  if (params?.toDate) qs.set('toDate', params.toDate);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<PaymentProposal[]>(`/ap/payment-proposals${suffix}`);
}

export async function getPaymentProposal(id: string): Promise<PaymentProposal> {
  return apiFetch<PaymentProposal>(`/ap/payment-proposals/${encodeURIComponent(id)}`);
}

export async function createPaymentProposal(payload: {
  proposalDate?: string;
  notes?: string;
  lines: Array<{ invoiceId: string; proposedPayAmount: number }>;
}): Promise<PaymentProposal> {
  return apiFetch<PaymentProposal>('/ap/payment-proposals', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateDraftPaymentProposal(
  id: string,
  payload: {
    proposalDate?: string;
    notes?: string;
    lines: Array<{ invoiceId: string; proposedPayAmount: number }>;
  },
) {
  return apiFetch<PaymentProposal>(`/ap/payment-proposals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function submitPaymentProposal(id: string): Promise<PaymentProposal> {
  return apiFetch<PaymentProposal>(`/ap/payment-proposals/${encodeURIComponent(id)}/submit`, {
    method: 'POST',
  });
}

export async function approvePaymentProposal(id: string): Promise<PaymentProposal> {
  return apiFetch<PaymentProposal>(`/ap/payment-proposals/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
  });
}

export async function rejectPaymentProposal(id: string, payload: { reason: string }): Promise<PaymentProposal> {
  return apiFetch<PaymentProposal>(`/ap/payment-proposals/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
