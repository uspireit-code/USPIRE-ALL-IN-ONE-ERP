import { apiFetch } from './api';

export type SupplierStatementLineType = 'INVOICE' | 'PAYMENT';

export type SupplierStatementLine = {
  date: string;
  type: SupplierStatementLineType;
  reference: string;
  debit: number;
  credit: number;
  runningBalance: number;
};

export type SupplierStatementResponse = {
  supplierId: string;
  supplierName: string;
  from: string;
  to: string;
  openingBalance: number;
  lines: SupplierStatementLine[];
  closingBalance: number;
};

export function getSupplierStatement(params: {
  supplierId: string;
  from: string;
  to: string;
}) {
  const qs = new URLSearchParams();
  qs.set('from', params.from);
  qs.set('to', params.to);

  return apiFetch<SupplierStatementResponse>(
    `/reports/supplier-statement/${encodeURIComponent(params.supplierId)}?${qs.toString()}`,
    { method: 'GET' },
  );
}
