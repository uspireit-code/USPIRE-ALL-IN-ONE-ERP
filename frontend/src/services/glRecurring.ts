import { apiFetch } from './api';

export type RecurringJournalFrequency = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export type RecurringJournalTemplateLine = {
  id?: string;
  templateId?: string;
  accountId: string;
  descriptionTemplate?: string | null;
  debitAmount: number;
  creditAmount: number;
  lineOrder: number;
};

export type RecurringJournalTemplate = {
  id: string;
  tenantId: string;
  name: string;
  journalType: 'STANDARD';
  referenceTemplate: string;
  descriptionTemplate?: string | null;
  frequency: RecurringJournalFrequency;
  startDate: string;
  endDate?: string | null;
  nextRunDate: string;
  isActive: boolean;
  createdById: string;
  createdAt: string;
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

export async function createRecurringTemplate(params: {
  name: string;
  journalType?: 'STANDARD';
  referenceTemplate: string;
  descriptionTemplate?: string;
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
