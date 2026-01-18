import { apiFetch, apiFetchRaw } from './api';

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

export async function exportSupplierStatement(params: {
  supplierId: string;
  fromDate: string;
  toDate: string;
  format: 'pdf' | 'excel';
}) {
  const qs = new URLSearchParams();
  qs.set('supplierId', params.supplierId);
  qs.set('fromDate', params.fromDate);
  qs.set('toDate', params.toDate);
  qs.set('format', params.format);

  const res = await apiFetchRaw(`/ap/supplier-statements/export?${qs.toString()}`, {
    method: 'GET',
  });

  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^";]+)"?/i.exec(cd);
  const fileName = match?.[1] || `supplier-statement.${params.format === 'excel' ? 'xlsx' : 'pdf'}`;
  return { blob, fileName };
}
