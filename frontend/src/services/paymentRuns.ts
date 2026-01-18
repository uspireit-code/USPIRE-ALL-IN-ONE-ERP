import { apiFetch } from './api';

export type PaymentRunStatus = 'EXECUTED';

export type PaymentRunUser = {
  id: string;
  email?: string;
  name?: string;
};

export type PaymentRunPeriod = {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  status?: string;
};

export type PaymentRunBankAccount = {
  id: string;
  name?: string;
  bankName?: string;
  accountNumber?: string;
  currency?: string;
};

export type PaymentRunInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
};

export type PaymentRunSupplier = {
  id: string;
  name: string;
};

export type PaymentRunLine = {
  id: string;
  tenantId: string;
  paymentRunId: string;
  paymentProposalLineId: string;
  supplierId: string;
  invoiceId: string;
  amountPaid: number;
  supplier?: PaymentRunSupplier;
  invoice?: PaymentRunInvoice;
  paymentProposalLine?: {
    id: string;
    proposalId: string;
    invoiceNumber: string;
    invoiceDate: string;
    originalAmount: number;
    outstandingAmount: number;
    proposedPayAmount: number;
    proposal?: { id: string; proposalNumber: string };
  };
};

export type PaymentRun = {
  id: string;
  tenantId: string;
  runNumber: string;
  executionDate: string;
  periodId: string;
  bankAccountId: string;
  totalAmount: number;
  status: PaymentRunStatus;
  executedByUserId: string;
  executedAt: string;
  createdAt: string;

  period?: PaymentRunPeriod;
  bankAccount?: PaymentRunBankAccount;
  executedBy?: PaymentRunUser;
  lines?: PaymentRunLine[];
};

export type EligiblePaymentProposalUser = {
  id: string;
  email?: string;
  name?: string;
};

export type EligiblePaymentProposalLine = {
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

export type EligiblePaymentProposal = {
  id: string;
  tenantId: string;
  proposalNumber: string;
  proposalDate: string;
  status: 'APPROVED';
  totalAmount: number;
  createdById: string;
  approvedById?: string | null;
  approvedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: EligiblePaymentProposalUser;
  approvedBy?: EligiblePaymentProposalUser | null;
  lines: EligiblePaymentProposalLine[];
};

export async function listEligiblePaymentProposalsForExecution(): Promise<EligiblePaymentProposal[]> {
  return apiFetch<EligiblePaymentProposal[]>('/ap/payment-proposals/eligible-for-execution');
}

export async function executePaymentRun(payload: {
  executionDate: string;
  periodId?: string;
  bankAccountId: string;
  paymentProposalIds: string[];
  reference?: string;
}): Promise<{ paymentRun: PaymentRun }> {
  return apiFetch<{ paymentRun: PaymentRun }>('/ap/payment-runs/execute', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listPaymentRuns(): Promise<PaymentRun[]> {
  return apiFetch<PaymentRun[]>('/ap/payment-runs');
}

export async function getPaymentRun(id: string): Promise<PaymentRun> {
  return apiFetch<PaymentRun>(`/ap/payment-runs/${encodeURIComponent(id)}`);
}
