import { apiFetch } from './api';

export type RecurringJournalFrequency = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export type RecurringTemplateStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SUSPENDED'
  | 'ARCHIVED';

export type RecurringJournalTemplateLine = {
  id?: string;
  templateId?: string;
  accountId: string;
  descriptionTemplate?: string | null;
  debitAmount: number;
  creditAmount: number;
  lineOrder: number;
};

type ActorUser = {
  id: string;
  name: string | null;
  email: string;
};

export type RecurringJournalTemplate = {
  id: string;
  tenantId: string;
  name: string;
  journalType: 'STANDARD';
  referenceTemplate: string;
  descriptionTemplate?: string | null;
  intent?: string | null;
  intentNotes?: string | null;
  intentReference?: string | null;
  frequency: RecurringJournalFrequency;
  startDate: string;
  endDate?: string | null;
  nextRunDate: string;
  isActive: boolean;
  status?: RecurringTemplateStatus;
  submittedById?: string | null;
  submittedAt?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  suspendedById?: string | null;
  suspendedAt?: string | null;
  archivedById?: string | null;
  archivedAt?: string | null;
  statusReason?: string | null;
  createdById: string;
  createdAt: string;
  createdBy?: ActorUser | null;
  submittedBy?: ActorUser | null;
  approvedBy?: ActorUser | null;
  lines: RecurringJournalTemplateLine[];
};

export type RecurringJournalHistoryItem = {
  id: string;
  runDate: string;
  createdAt: string;
  generatedBy: null | { id: string; name: string | null; email: string };
  generatedJournal: {
    id: string;
    journalNumber: number | null;
    journalDate: string;
    status: 'DRAFT' | 'PARKED' | 'POSTED';
    reference: string | null;
    description: string | null;
  };
};

export async function listRecurringTemplates() {
  return apiFetch<RecurringJournalTemplate[]>('/gl/recurring-templates', { method: 'GET' });
}

export async function listApprovedRecurringTemplates() {
  return apiFetch<RecurringJournalTemplate[]>('/gl/recurring-templates/approved', { method: 'GET' });
}

export async function createRecurringTemplate(params: {
  name: string;
  journalType?: 'STANDARD';
  referenceTemplate: string;
  descriptionTemplate?: string;
  intent: string;
  intentNotes?: string;
  intentReference?: string;
  frequency: RecurringJournalFrequency;
  startDate: string;
  endDate?: string;
  nextRunDate: string;
  isActive?: boolean;
  lines: Array<{
    accountId: string;
    descriptionTemplate?: string;
    debitAmount: number;
    creditAmount: number;
    lineOrder: number;
  }>;
}) {
  return apiFetch<RecurringJournalTemplate>('/gl/recurring-templates', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateRecurringTemplate(
  id: string,
  params: Partial<{
    name: string;
    journalType: 'STANDARD';
    referenceTemplate: string;
    descriptionTemplate: string;
    intent: string;
    intentNotes: string;
    intentReference: string;
    frequency: RecurringJournalFrequency;
    startDate: string;
    endDate: string | null;
    nextRunDate: string;
    isActive: boolean;
    lines: Array<{
      accountId: string;
      descriptionTemplate?: string;
      debitAmount: number;
      creditAmount: number;
      lineOrder: number;
    }>;
  }>,
) {
  return apiFetch<RecurringJournalTemplate>(`/gl/recurring-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

export async function generateRecurringTemplate(id: string, params?: { runDate?: string }) {
  return apiFetch<{ id: string }>(`/gl/recurring-templates/${id}/generate`, {
    method: 'POST',
    body: JSON.stringify(params ?? {}),
  });
}

export async function getRecurringTemplateHistory(id: string) {
  return apiFetch<RecurringJournalHistoryItem[]>(`/gl/recurring-templates/${id}/history`, {
    method: 'GET',
  });
}

export async function submitRecurringTemplate(id: string, params?: { reason?: string }) {
  return apiFetch<RecurringJournalTemplate>(`/gl/recurring-templates/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify(params ?? {}),
  });
}

export async function approveRecurringTemplate(id: string, params?: { reason?: string }) {
  return apiFetch<RecurringJournalTemplate>(`/gl/recurring-templates/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify(params ?? {}),
  });
}

export async function suspendRecurringTemplate(id: string, params?: { reason?: string }) {
  return apiFetch<RecurringJournalTemplate>(`/gl/recurring-templates/${id}/suspend`, {
    method: 'POST',
    body: JSON.stringify(params ?? {}),
  });
}

export async function archiveRecurringTemplate(id: string, params?: { reason?: string }) {
  return apiFetch<RecurringJournalTemplate>(`/gl/recurring-templates/${id}/archive`, {
    method: 'POST',
    body: JSON.stringify(params ?? {}),
  });
}

export async function reactivateRecurringTemplate(id: string, params?: { reason?: string }) {
  return apiFetch<RecurringJournalTemplate>(`/gl/recurring-templates/${id}/reactivate`, {
    method: 'POST',
    body: JSON.stringify(params ?? {}),
  });
}
