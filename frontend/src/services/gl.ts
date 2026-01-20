import { apiFetch } from './api';

export type InvalidJournalDateReason = 'CUTOVER_VIOLATION' | 'NO_PERIOD' | 'PERIOD_CLOSED';

export type InvalidJournalDateErrorBody = {
  code: 'INVALID_JOURNAL_DATE';
  reason: InvalidJournalDateReason;
  message: string;
};

export type JournalPostQueueItem = {
  id: string;
  journalNumber: number | null;
  journalDate: string;
  reference: string | null;
  description: string | null;
  journalType: string;
  riskScore?: number | null;
  totalDebit: number;
  totalCredit: number;
  createdAt: string;
  reviewedAt?: string | null;
  createdBy: null | { id: string; name: string | null; email: string };
  reviewedBy: null | { id: string; name: string | null; email: string };
  period: {
    id: string | null;
    name: string | null;
    startDate: string | null;
    endDate: string | null;
    label: string | null;
  };
};

export type JournalReviewQueueItem = {
  id: string;
  journalNumber: number | null;
  journalDate: string;
  reference: string | null;
  description: string | null;
  journalType: string;
  riskScore?: number | null;
  totalDebit: number;
  totalCredit: number;
  createdAt: string;
  submittedAt?: string | null;
  createdBy: null | { id: string; name: string | null; email: string };
  period: {
    id: string | null;
    name: string | null;
    startDate: string | null;
    endDate: string | null;
    label: string | null;
  };
};

export function getInvalidJournalDateMessage(body: unknown): string | null {
  const b = body as Partial<InvalidJournalDateErrorBody> | null | undefined;
  if (!b || b.code !== 'INVALID_JOURNAL_DATE') return null;
  if (b.reason === 'CUTOVER_VIOLATION') return 'Journal date is before system cutover. Select a later date.';
  if (b.reason === 'NO_PERIOD') return 'No accounting period exists for the selected date.';
  if (b.reason === 'PERIOD_CLOSED') return 'Selected accounting period is closed. Choose an open period.';
  return typeof b.message === 'string' && b.message.trim() ? b.message : 'Invalid journal date.';
}

export type GlAccountLookup = {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
  departmentRequirement?: 'REQUIRED' | 'OPTIONAL' | 'FORBIDDEN';
  requiresDepartment?: boolean;
  requiresProject?: boolean;
  requiresFund?: boolean;
};

export type ProjectLookup = {
  id: string;
  code: string;
  name: string;
  status?: 'ACTIVE' | 'CLOSED';
  isRestricted: boolean;
};

export type FundLookup = {
  id: string;
  code: string;
  name: string;
  projectId: string;
  status?: 'ACTIVE' | 'INACTIVE';
};

export type EntityLookup = {
  id: string;
  name: string;
  jurisdiction: string;
  baseCurrency: string;
};

export type LegalEntityLookup = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type DepartmentLookup = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type JournalLine = {
  id: string;
  journalEntryId: string;
  accountId: string;
  legalEntityId?: string | null;
  departmentId?: string | null;
  projectId?: string | null;
  fundId?: string | null;
  lineNumber?: number | null;
  description?: string | null;
  debit: number;
  credit: number;
};

export type JournalStatus = 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'REJECTED' | 'PARKED' | 'POSTED';
export type JournalBudgetStatus = 'OK' | 'WARN' | 'BLOCK';
export type JournalType = 'STANDARD' | 'ADJUSTING' | 'ACCRUAL' | 'REVERSING';

export type JournalEntry = {
  id: string;
  tenantId: string;
  journalNumber?: number | null;
  journalType?: JournalType | null;
  periodId?: string | null;
  reference?: string | null;
  description?: string | null;
  journalDate: string;
  status: JournalStatus;
  createdById: string;
  correctsJournalId?: string | null;
  riskScore?: number | null;
  riskFlags?: string[] | null;
  riskComputedAt?: string | null;
  budgetStatus?: JournalBudgetStatus | null;
  budgetFlags?: any[] | null;
  budgetCheckedAt?: string | null;
  budgetOverrideJustification?: string | null;
  reversalInitiatedById?: string | null;
  reversalInitiatedAt?: string | null;
  reversalPreparedById?: string | null;
  submittedById?: string | null;
  submittedAt?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  rejectedById?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  postedById?: string | null;
  returnedByPosterId?: string | null;
  returnedByPosterAt?: string | null;
  returnReason?: string | null;
  createdAt: string;
  postedAt?: string | null;
  reversalOfId?: string | null;
  reversalReason?: string | null;
  lines: JournalLine[];
};

export type LedgerRow = {
  journalEntryId: string;
  journalNumber: number | null;
  journalDate: string;
  reference: string | null;
  description: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
};

export type LedgerResponse = {
  account: {
    id: string;
    code: string;
    name: string;
    type: string;
    normalBalance: string;
  };
  period: {
    fromDate: string;
    toDate: string;
  };
  openingBalance: number;
  rows: LedgerRow[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type JournalDetailResponse = {
  id: string;
  tenantId: string;
  journalNumber: number | null;
  journalType: JournalType;
  reference: string | null;
  description: string | null;
  journalDate: string;
  status: JournalStatus;
  correctsJournalId?: string | null;
  riskScore?: number | null;
  riskFlags?: string[] | null;
  riskComputedAt?: string | null;
  budgetStatus?: JournalBudgetStatus | null;
  budgetFlags?: any[] | null;
  budgetCheckedAt?: string | null;
  budgetOverrideJustification?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  approvedAt?: string | null;
  postedAt: string | null;
  returnedByPosterAt?: string | null;
  returnReason?: string | null;
  reversalInitiatedAt?: string | null;
  reversalPreparedById?: string | null;
  reversalReason?: string | null;
  reversalOfId?: string | null;
  createdAt: string;
  createdBy: null | { id: string; email: string };
  reversalInitiatedBy?: null | { id: string; email: string };
  reversalPreparedBy?: null | { id: string; email: string };
  submittedBy?: null | { id: string; email: string };
  reviewedBy: null | { id: string; email: string };
  rejectedBy?: null | { id: string; email: string };
  approvedBy: null | { id: string; email: string };
  postedBy: null | { id: string; email: string };
  returnedByPoster?: null | { id: string; email: string };
  reversalOf?: null | { id: string; journalNumber: number | null; reference: string | null; status: JournalStatus };
  reversedBy?: Array<{ id: string; journalNumber: number | null; reference: string | null; status: JournalStatus }>;
  period: null | {
    id: string;
    name: string;
    status: 'OPEN' | 'CLOSED';
    startDate: string;
    endDate: string;
  };
  lines: Array<{
    id: string;
    journalEntryId: string;
    lineNumber: number | null;
    description: string | null;
    accountId: string;
    legalEntityId?: string | null;
    departmentId?: string | null;
    projectId?: string | null;
    fundId?: string | null;
    debit: number;
    credit: number;
    account: { id: string; code: string; name: string; type: string; normalBalance: string };
    legalEntity?: null | { id: string; code: string; name: string };
    department?: null | { id: string; code: string; name: string };
    project?: null | { id: string; code: string; name: string };
    fund?: null | { id: string; code: string; name: string };
  }>;
};

export async function listProjects(params?: { effectiveOn?: string }) {
  const qs = new URLSearchParams();
  if (typeof params?.effectiveOn === 'string' && params.effectiveOn.trim()) {
    qs.set('effectiveOn', params.effectiveOn.trim());
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<ProjectLookup[]>(`/gl/projects${suffix}`, { method: 'GET' });
}

export async function listFunds(params?: { effectiveOn?: string; projectId?: string }) {
  const qs = new URLSearchParams();
  if (typeof params?.effectiveOn === 'string' && params.effectiveOn.trim()) {
    qs.set('effectiveOn', params.effectiveOn.trim());
  }
  if (typeof params?.projectId === 'string' && params.projectId.trim()) {
    qs.set('projectId', params.projectId.trim());
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<FundLookup[]>(`/gl/funds${suffix}`, { method: 'GET' });
}

export async function listLegalEntities(params?: { effectiveOn?: string }) {
  const qs = new URLSearchParams();
  if (typeof params?.effectiveOn === 'string' && params.effectiveOn.trim()) {
    qs.set('effectiveOn', params.effectiveOn.trim());
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<LegalEntityLookup[]>(`/gl/legal-entities${suffix}`, { method: 'GET' });
}

export async function listEntities() {
  return apiFetch<EntityLookup[]>('/gl/entities', { method: 'GET' });
}

export async function listDepartments(params?: { effectiveOn?: string }) {
  const qs = new URLSearchParams();
  if (typeof params?.effectiveOn === 'string' && params.effectiveOn.trim()) {
    qs.set('effectiveOn', params.effectiveOn.trim());
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<DepartmentLookup[]>(`/gl/departments${suffix}`, { method: 'GET' });
}

export type ListJournalsResponse = {
  items: JournalEntry[];
  total: number;
  limit: number;
  offset: number;
};

export type JournalBrowserRow = {
  id: string;
  reference: string | null;
  journalDate: string;
  description: string | null;
  totalDebit: number;
  totalCredit: number;
  riskScore?: number | null;
  riskFlags?: string[] | null;
  budgetStatus?: JournalBudgetStatus | null;
  status: JournalStatus;
  createdBy: null | { id: string; name: string | null };
  reviewedBy: null | { id: string; name: string | null };
  postedBy: null | { id: string; name: string | null };
};

export type JournalBrowserListResponse = {
  items: JournalBrowserRow[];
  total: number;
  limit: number;
  offset: number;
};

export type JournalBrowserFilters = {
  limit?: number;
  offset?: number;
  status?: JournalStatus;
  budgetStatus?: JournalBudgetStatus;
  workbench?: boolean;
  drilldown?: boolean;
  periodId?: string;
  fromDate?: string;
  toDate?: string;
  accountId?: string;
  legalEntityId?: string;
  departmentId?: string;
  projectId?: string;
  fundId?: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  minRiskScore?: number;
  maxRiskScore?: number;
  createdById?: string;
  reviewedById?: string;
  postedById?: string;
};

export type OpeningBalancesResponse = {
  cutoverDate: string;
  openingPeriod: null | {
    id: string;
    status: 'OPEN' | 'CLOSED';
    name: string;
    startDate: string;
    endDate: string;
  };
  journal: JournalEntry | null;
  cutoverLocked: boolean;
};

export type AccountingPeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED';
};

export type AccountingPeriodChecklistItem = {
  id: string;
  code: string;
  label: string;
  completed: boolean;
  completedAt: string | null;
  completedBy: null | { id: string; email: string };
  createdAt: string;
};

export type AccountingPeriodChecklistResponse = {
  period: {
    id: string;
    name: string;
    status: 'OPEN' | 'CLOSED';
    startDate: string;
    endDate: string;
    closedAt: string | null;
    closedBy: null | { id: string; email: string };
  };
  items: AccountingPeriodChecklistItem[];
};

export async function listGlAccounts() {
  return apiFetch<GlAccountLookup[]>('/gl/accounts?balanceSheetOnly=true', { method: 'GET' });
}

export async function listAllGlAccounts() {
  return apiFetch<GlAccountLookup[]>('/gl/accounts', { method: 'GET' });
}

export async function listJournals(params?: { limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  if (typeof params?.limit === 'number') qs.set('limit', String(params.limit));
  if (typeof params?.offset === 'number') qs.set('offset', String(params.offset));
  if ((params as any)?.status) qs.set('status', String((params as any).status));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<ListJournalsResponse>(`/gl/journals${suffix}`, { method: 'GET' });
}

export async function listJournalBrowser(params?: JournalBrowserFilters) {
  const qs = new URLSearchParams();
  const put = (k: keyof JournalBrowserFilters) => {
    const v = params?.[k];
    if (typeof v === 'string' && v.trim()) qs.set(String(k), v.trim());
  };

  if (typeof params?.limit === 'number' && Number.isFinite(params.limit)) qs.set('limit', String(params.limit));
  if (typeof params?.offset === 'number' && Number.isFinite(params.offset)) qs.set('offset', String(params.offset));
  if (params?.status) qs.set('status', String(params.status));
  if (params?.budgetStatus) qs.set('budgetStatus', String(params.budgetStatus));
  if (params?.workbench) qs.set('workbench', '1');
  if (params?.drilldown) qs.set('drilldown', '1');

  put('periodId');
  put('fromDate');
  put('toDate');
  put('accountId');
  put('legalEntityId');
  put('departmentId');
  put('projectId');
  put('fundId');
  put('riskLevel');
  put('createdById');
  put('reviewedById');
  put('postedById');

  if (typeof params?.minRiskScore === 'number' && Number.isFinite(params.minRiskScore)) qs.set('minRiskScore', String(params.minRiskScore));
  if (typeof params?.maxRiskScore === 'number' && Number.isFinite(params.maxRiskScore)) qs.set('maxRiskScore', String(params.maxRiskScore));

  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<JournalBrowserListResponse>(`/gl/journals${suffix}`, { method: 'GET' });
}

export async function getJournal(id: string) {
  return apiFetch<JournalEntry>(`/gl/journals/${id}`, { method: 'GET' });
}

export async function getLedger(params: {
  accountId: string;
  accountingPeriodId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
  sourceReport?: 'TB' | 'PL' | 'BS' | 'LEDGER';
}) {
  const qs = new URLSearchParams();
  qs.set('accountId', params.accountId);
  if (params.accountingPeriodId) qs.set('accountingPeriodId', params.accountingPeriodId);

  if (typeof params.fromDate === 'string') qs.set('fromDate', params.fromDate);
  if (typeof params.toDate === 'string') qs.set('toDate', params.toDate);

  const rawLimit = Number.isFinite(params.limit) ? Math.trunc(Number(params.limit)) : 50;
  const limit = Math.max(1, Math.min(100, rawLimit));
  const offset = Number.isFinite(params.offset) ? Math.max(0, Math.trunc(Number(params.offset))) : 0;

  qs.set('limit', String(limit));
  qs.set('offset', String(offset));
  qs.set('sourceReport', params.sourceReport ?? 'LEDGER');
  return apiFetch<LedgerResponse>(`/gl/ledger?${qs.toString()}`, { method: 'GET' });
}

export async function getJournalDetail(id: string) {
  return apiFetch<JournalDetailResponse>(`/gl/journals/${id}/detail`, { method: 'GET' });
}

export async function createJournal(params: {
  journalDate: string;
  journalType?: JournalType;
  reference?: string;
  description?: string;
  correctsJournalId?: string;
  lines: Array<{ lineNumber?: number; accountId: string; legalEntityId?: string | null; departmentId?: string | null; projectId?: string | null; fundId?: string | null; description?: string; debit: number; credit: number }>;
}) {
  return apiFetch<JournalEntry>('/gl/journals', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateJournal(
  id: string,
  params: {
    journalDate: string;
    journalType?: JournalType;
    reference?: string;
    description?: string;
    budgetOverrideJustification?: string;
    lines: Array<{ lineNumber?: number; accountId: string; legalEntityId?: string | null; departmentId?: string | null; projectId?: string | null; fundId?: string | null; description?: string; debit: number; credit: number }>;
  },
) {
  return apiFetch<JournalEntry>(`/gl/journals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

export async function parkJournal(id: string) {
  return apiFetch<JournalEntry>(`/gl/journals/${id}/park`, { method: 'POST' });
}

export async function submitJournal(id: string) {
  return apiFetch<JournalEntry>(`/gl/journals/${id}/submit`, { method: 'POST' });
}

export async function reviewJournal(id: string) {
  return apiFetch<JournalEntry>(`/gl/journals/${id}/review`, { method: 'POST' });
}

export async function rejectJournal(id: string, reason: string) {
  return apiFetch<JournalEntry>(`/gl/journals/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function listReviewQueue() {
  return apiFetch<JournalReviewQueueItem[]>('/gl/journals/review-queue', { method: 'GET' });
}

export async function listPostQueue() {
  return apiFetch<JournalPostQueueItem[]>('/gl/journals/post-queue', { method: 'GET' });
}

export async function postJournal(id: string) {
  return apiFetch<JournalEntry>(`/gl/journals/${id}/post`, { method: 'POST' });
}

export async function returnJournalToReview(id: string, reason: string) {
  return apiFetch<JournalEntry>(`/gl/journals/${id}/return-to-review`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function reverseJournal(
  id: string,
  params?: {
    journalDate?: string;
    reason: string;
    reference?: string;
    description?: string;
  },
) {
  return apiFetch<JournalEntry>(`/gl/journals/${id}/reverse`, {
    method: 'POST',
    body: JSON.stringify(params ?? {}),
  });
}

export async function listGlPeriods() {
  return apiFetch<AccountingPeriod[]>('/gl/periods', { method: 'GET' });
}

export async function getAccountingPeriodChecklist(periodId: string) {
  return apiFetch<AccountingPeriodChecklistResponse>(`/gl/periods/${periodId}/checklist`, { method: 'GET' });
}

export async function completeAccountingPeriodChecklistItem(params: { periodId: string; itemId: string }) {
  return apiFetch<AccountingPeriodChecklistItem>(`/gl/periods/${params.periodId}/checklist/items/${params.itemId}/complete`, {
    method: 'POST',
  });
}

export async function closeAccountingPeriod(periodId: string) {
  return apiFetch<AccountingPeriod>(`/gl/periods/${periodId}/close`, { method: 'POST' });
}

export async function getOpeningBalances(cutoverDate: string) {
  return apiFetch<OpeningBalancesResponse>(`/gl/opening-balances?cutoverDate=${encodeURIComponent(cutoverDate)}`, { method: 'GET' });
}

export async function upsertOpeningBalances(params: {
  cutoverDate: string;
  lines: Array<{ accountId: string; debit: number; credit: number }>;
}) {
  return apiFetch<{ openingPeriod: any; journal: JournalEntry }>('/gl/opening-balances', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function postOpeningBalances(cutoverDate: string) {
  return apiFetch<{ journal: JournalEntry; openingPeriodClosed: boolean }>('/gl/opening-balances/post', {
    method: 'POST',
    body: JSON.stringify({ cutoverDate }),
  });
}

export type JournalRiskBand = 'LOW' | 'MEDIUM' | 'HIGH';

export type JournalRiskOverviewResponse = {
  total: number;
  avgRiskScore: number;
  highRiskPct: number;
  distribution: Record<JournalRiskBand, number>;
};

export type JournalRiskUsersRow = {
  user: { id: string; email: string | null; name: string | null };
  totals: {
    journals: number;
    avgRiskScore: number;
    byBand: Record<JournalRiskBand, number>;
  };
  flaggedCounts: {
    late_posting: number;
    reversal: number;
    override: number;
    high_value: number;
    unusual_account: number;
  };
};

export type JournalRiskAccountsRow = {
  account: { id: string; code: string; name: string };
  journalCount: number;
  avgRiskScore: number;
  highRiskPct: number;
  topRiskFlags: string[];
};

export type JournalRiskOrganisationRow = {
  dimension: { id: string; code: string | null; name: string | null };
  journalCount: number;
  avgRiskScore: number;
  highRiskCount: number;
};

export type JournalRiskOrganisationResponse = {
  legalEntities: JournalRiskOrganisationRow[];
  departments: JournalRiskOrganisationRow[];
  projects: JournalRiskOrganisationRow[];
  funds: JournalRiskOrganisationRow[];
};

export type JournalRiskPeriodsRow = {
  period: null | { id: string; name: string | null; startDate: string | null; endDate: string | null };
  journalCount: number;
  avgRiskScore: number;
  reversalCount: number;
  highRiskCount: number;
  topRiskFlags: string[];
};

export type GlRiskFilters = {
  periodId?: string;
  dateFrom?: string;
  dateTo?: string;
  legalEntityId?: string;
  departmentId?: string;
  projectId?: string;
  fundId?: string;
};

function buildRiskQueryString(filters?: GlRiskFilters) {
  const qs = new URLSearchParams();
  const put = (key: keyof GlRiskFilters) => {
    const v = filters?.[key];
    if (typeof v === 'string' && v.trim()) qs.set(String(key), v.trim());
  };
  put('periodId');
  put('dateFrom');
  put('dateTo');
  put('legalEntityId');
  put('departmentId');
  put('projectId');
  put('fundId');
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export async function getJournalRiskOverview(filters?: GlRiskFilters) {
  return apiFetch<JournalRiskOverviewResponse>(`/gl/risk/overview${buildRiskQueryString(filters)}`, { method: 'GET' });
}

export async function getJournalRiskUsers(filters?: Pick<GlRiskFilters, 'periodId' | 'dateFrom' | 'dateTo'>) {
  return apiFetch<JournalRiskUsersRow[]>(`/gl/risk/users${buildRiskQueryString(filters)}`, { method: 'GET' });
}

export async function getJournalRiskAccounts(filters?: GlRiskFilters) {
  return apiFetch<JournalRiskAccountsRow[]>(`/gl/risk/accounts${buildRiskQueryString(filters)}`, { method: 'GET' });
}

export async function getJournalRiskOrganisation(filters?: Pick<GlRiskFilters, 'periodId' | 'dateFrom' | 'dateTo'>) {
  return apiFetch<JournalRiskOrganisationResponse>(`/gl/risk/organisation${buildRiskQueryString(filters)}`, { method: 'GET' });
}

export async function getJournalRiskPeriods(filters?: Pick<GlRiskFilters, 'periodId' | 'dateFrom' | 'dateTo'>) {
  return apiFetch<JournalRiskPeriodsRow[]>(`/gl/risk/periods${buildRiskQueryString(filters)}`, { method: 'GET' });
}
