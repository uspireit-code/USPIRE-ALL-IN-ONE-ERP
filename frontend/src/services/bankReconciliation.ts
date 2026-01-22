import { apiFetch } from './api';

export type BankStatementListItem = {
  id: string;
  bankAccountId: string;
  statementStartDate: string;
  statementEndDate: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'RECONCILED' | 'LOCKED';
  openingBalance: number;
  closingBalance: number;
  createdAt: string;
};

export type BankStatementLine = {
  id: string;
  txnDate: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  matched: boolean;
  matchedJournalLineId?: string | null;
  classification?: string;
  adjustmentJournalId?: string | null;
};

export type BankStatementDetail = {
  id: string;
  bankAccountId: string;
  statementStartDate: string;
  statementEndDate: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'RECONCILED' | 'LOCKED';
  openingBalance: number;
  closingBalance: number;
  createdAt: string;
  lines: BankStatementLine[];
};

export type BankReconciliationPreview = {
  bankClosingBalance: number;
  systemBankBalanceAsAtEndDate: number;
  outstandingPaymentsTotal: number;
  depositsInTransitTotal: number;
  matchedCount: number;
  unmatchedStatementLinesCount: number;
  differencePreview: number;
};

export type BankReconciliationFinalSummary = {
  bankClosingBalance: number;
  systemBankBalance: number;
  outstandingPaymentsTotal: number;
  depositsInTransitTotal: number;
  adjustedBankBalance: number;
  adjustedGLBalance: number;
  difference: number;
  reconciledAt: string | null;
  reconciledBy: { id: string; name: string; email: string } | null;
  lockedAt: string | null;
  lockedBy: { id: string; name: string; email: string } | null;
};

export type UnmatchedPayment = {
  id: string;
  type: 'SUPPLIER_PAYMENT' | 'CUSTOMER_RECEIPT';
  bankAccountId: string;
  amount: number;
  paymentDate: string;
  reference?: string | null;
};

export type UnmatchedStatementLine = {
  id: string;
  transactionDate: string;
  description: string;
  amount: number;
  reference?: string | null;
  bankStatement: {
    id: string;
    bankAccountId: string;
    statementDate: string;
  };
};

export type UnmatchedResponse = {
  unreconciledPayments: UnmatchedPayment[];
  unreconciledStatementLines: UnmatchedStatementLine[];
};

export function getStatements(bankAccountId: string) {
  return apiFetch<BankStatementListItem[]>(
    `/bank-recon/statements?bankAccountId=${encodeURIComponent(bankAccountId)}`,
    { method: 'GET' },
  );
}

export function getStatement(statementId: string) {
  return apiFetch<BankStatementDetail>(`/bank-recon/statements/${encodeURIComponent(statementId)}`, { method: 'GET' });
}

export function createStatement(params: {
  bankAccountId: string;
  statementStartDate: string;
  statementEndDate: string;
  openingBalance: number;
  closingBalance: number;
}) {
  return apiFetch<any>('/bank-recon/statements', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function addStatementLine(params: {
  statementId: string;
  txnDate: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
}) {
  return apiFetch<any>(`/bank-recon/statements/${encodeURIComponent(params.statementId)}/lines`, {
    method: 'POST',
    body: JSON.stringify({
      lines: [
        {
          txnDate: params.txnDate,
          description: params.description,
          debitAmount: params.debitAmount,
          creditAmount: params.creditAmount,
        },
      ],
    }),
  });
}

export function getStatementPreview(statementId: string) {
  return apiFetch<BankReconciliationPreview>(
    `/bank-recon/statements/${encodeURIComponent(statementId)}/preview`,
    { method: 'GET' },
  );
}

export function reconcileStatement(statementId: string) {
  return apiFetch<any>(`/bank-recon/statements/${encodeURIComponent(statementId)}/reconcile`, {
    method: 'POST',
  });
}

export function getFinalSummary(statementId: string) {
  return apiFetch<BankReconciliationFinalSummary>(
    `/bank-recon/statements/${encodeURIComponent(statementId)}/final-summary`,
    { method: 'GET' },
  );
}

export function listStatementLines(statementId: string, params?: { matched?: boolean }) {
  const q = typeof params?.matched === 'boolean' ? `?matched=${params.matched ? 'true' : 'false'}` : '';
  return apiFetch<BankStatementLine[]>(`/bank-recon/statements/${encodeURIComponent(statementId)}/lines${q}`, {
    method: 'GET',
  });
}

export function createAdjustment(params: {
  lineId: string;
  glAccountId: string;
  postingDate: string;
  memo?: string;
}) {
  return apiFetch<any>(`/bank-recon/lines/${encodeURIComponent(params.lineId)}/create-adjustment`, {
    method: 'POST',
    body: JSON.stringify({
      glAccountId: params.glAccountId,
      postingDate: params.postingDate,
      memo: params.memo,
    }),
  });
}

export function getUnmatchedItems() {
  return apiFetch<UnmatchedResponse>('/bank/reconciliation/unmatched', { method: 'GET' });
}

export function matchPayment(params: { statementLineId: string; paymentId: string }) {
  return apiFetch<any>('/bank/reconciliation/match', {
    method: 'POST',
    body: JSON.stringify({ statementLineId: params.statementLineId, paymentId: params.paymentId }),
  });
}
