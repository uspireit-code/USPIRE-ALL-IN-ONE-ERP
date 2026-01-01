import { apiFetch } from './api';

export type BankStatementListItem = {
  id: string;
  bankAccountId: string;
  statementDate: string;
  openingBalance: number;
  closingBalance: number;
  createdAt: string;
};

export type BankStatementLine = {
  id: string;
  transactionDate: string;
  description: string;
  amount: number;
  reference?: string | null;
  isReconciled: boolean;
};

export type BankStatementDetail = {
  id: string;
  bankAccountId: string;
  statementDate: string;
  openingBalance: number;
  closingBalance: number;
  createdAt: string;
  lines: BankStatementLine[];
};

export type ReconciliationStatus = {
  bankAccountId: string;
  totalStatementLines: number;
  reconciledCount: number;
  unreconciledCount: number;
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
  return apiFetch<BankStatementListItem[]>(`/bank/statements?bankAccountId=${encodeURIComponent(bankAccountId)}`, { method: 'GET' });
}

export function getStatement(statementId: string) {
  return apiFetch<BankStatementDetail>(`/bank/statements/${encodeURIComponent(statementId)}`, { method: 'GET' });
}

export function createStatement(params: { bankAccountId: string; statementDate: string; openingBalance: number; closingBalance: number }) {
  return apiFetch<any>('/bank/statements', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function addStatementLine(params: {
  statementId: string;
  transactionDate: string;
  description: string;
  amount: number;
  reference?: string;
}) {
  return apiFetch<any>(`/bank/statements/${encodeURIComponent(params.statementId)}/lines`, {
    method: 'POST',
    body: JSON.stringify({
      lines: [
        {
          transactionDate: params.transactionDate,
          description: params.description,
          amount: params.amount,
          reference: params.reference || undefined,
        },
      ],
    }),
  });
}

export function getReconciliationStatus(bankAccountId: string) {
  return apiFetch<ReconciliationStatus>(`/bank/reconciliation/status?bankAccountId=${encodeURIComponent(bankAccountId)}`, { method: 'GET' });
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
