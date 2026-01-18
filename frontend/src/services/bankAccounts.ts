import { apiFetch } from './api';

export type BankAccountStatus = 'ACTIVE' | 'INACTIVE';
export type BankAccountType = 'BANK' | 'CASH';

export type BankAccountGlAccount = {
  id: string;
  code: string;
  name: string;
  type: string;
};

export type BankCashAccount = {
  id: string;
  tenantId: string;
  name: string;
  type: BankAccountType;
  currency: string;
  status: BankAccountStatus;
  bankName: string;
  accountNumber: string | null;
  glAccountId: string;
  glAccount: BankAccountGlAccount | null;
  openingBalance: number;
  computedBalance: number;
  createdAt: string;
  updatedAt: string;
};

export async function listBankCashAccounts(): Promise<BankCashAccount[]> {
  return apiFetch<BankCashAccount[]>('/bank-accounts', { method: 'GET' });
}

export async function getBankCashAccount(id: string): Promise<BankCashAccount> {
  return apiFetch<BankCashAccount>(`/bank-accounts/${encodeURIComponent(id)}`, { method: 'GET' });
}

export async function createBankCashAccount(params: {
  name: string;
  type: BankAccountType;
  currency: string;
  glAccountId: string;
  bankName?: string;
  accountNumber?: string;
  openingBalance?: string;
}): Promise<BankCashAccount> {
  return apiFetch<BankCashAccount>('/bank-accounts', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateBankCashAccount(
  id: string,
  params: {
    name?: string;
    type?: BankAccountType;
    currency?: string;
    glAccountId?: string;
    bankName?: string;
    accountNumber?: string;
    openingBalance?: string;
  },
): Promise<BankCashAccount> {
  return apiFetch<BankCashAccount>(`/bank-accounts/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

export async function deactivateBankCashAccount(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/bank-accounts/${encodeURIComponent(id)}/deactivate`, {
    method: 'POST',
  });
}
