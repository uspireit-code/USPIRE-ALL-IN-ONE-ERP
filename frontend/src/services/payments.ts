import { apiFetch } from './api';

export type BankAccount = {
  id: string;
  name: string;
  bankName: string;
  accountNumber: string | null;
  type?: 'BANK' | 'CASH';
  currency: string;
  status: 'ACTIVE' | 'INACTIVE';
};

export type PaymentAllocation = {
  id: string;
  sourceType: 'SUPPLIER_INVOICE' | 'CUSTOMER_INVOICE';
  sourceId: string;
  amount: number;
};

export type Payment = {
  id: string;
  type: 'SUPPLIER_PAYMENT' | 'CUSTOMER_RECEIPT';
  bankAccountId: string;
  amount: number;
  paymentDate: string;
  reference?: string | null;
  status: 'DRAFT' | 'APPROVED' | 'POSTED';
  createdAt: string;
  createdById: string;
  approvedById?: string | null;
  approvedAt?: string | null;
  postedById?: string | null;
  postedAt?: string | null;
  bankAccount: BankAccount;
  allocations: PaymentAllocation[];
};

export async function listBankAccounts() {
  return apiFetch<BankAccount[]>('/bank/accounts', { method: 'GET' });
}

export async function listPayments() {
  return apiFetch<Payment[]>('/payments', { method: 'GET' });
}

export async function createPayment(params: {
  type: 'SUPPLIER_PAYMENT' | 'CUSTOMER_RECEIPT';
  bankAccountId: string;
  amount: number;
  paymentDate: string;
  reference?: string;
  allocations: Array<{ sourceType: 'SUPPLIER_INVOICE' | 'CUSTOMER_INVOICE'; sourceId: string; amount: number }>;
}) {
  return apiFetch<Payment>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      type: params.type,
      bankAccountId: params.bankAccountId,
      amount: params.amount,
      paymentDate: params.paymentDate,
      reference: params.reference || undefined,
      allocations: params.allocations,
    }),
  });
}

export async function approvePayment(id: string) {
  return apiFetch<Payment>(`/payments/${id}/approve`, { method: 'POST' });
}

export async function postPayment(id: string, params?: { apControlAccountCode?: string }) {
  return apiFetch<any>(`/payments/${id}/post`, {
    method: 'POST',
    body: JSON.stringify({
      apControlAccountCode: params?.apControlAccountCode || undefined,
    }),
  });
}
