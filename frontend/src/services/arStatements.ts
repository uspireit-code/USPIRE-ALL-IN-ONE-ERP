import { apiFetch } from './api';

export type ArStatementTransactionType = 'INVOICE' | 'RECEIPT' | 'CREDIT_NOTE';

export type ArStatementTransaction = {
  date: string;
  type: ArStatementTransactionType;
  reference: string;
  debit: number;
  credit: number;
  runningBalance: number;
};

export type ArStatementResponse = {
  customer: { id: string; name: string };
  fromDate: string;
  toDate: string;
  openingBalance: number;
  transactions: ArStatementTransaction[];
  closingBalance: number;
};

export function getArStatement(params: {
  customerId: string;
  fromDate?: string;
  toDate?: string;
  asOfDate?: string;
}) {
  const qs = new URLSearchParams();
  qs.set('customerId', params.customerId);
  if (params.asOfDate) qs.set('asOfDate', params.asOfDate);
  if (params.fromDate) qs.set('fromDate', params.fromDate);
  if (params.toDate) qs.set('toDate', params.toDate);

  return apiFetch<ArStatementResponse>(`/ar/statements?${qs.toString()}`, { method: 'GET' });
}
