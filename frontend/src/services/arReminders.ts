import { apiFetch } from './api';

export type ArReminderTriggerType = 'BEFORE_DUE' | 'ON_DUE' | 'AFTER_DUE';
export type ArReminderLevel = 'NORMAL' | 'ESCALATED' | 'FINAL';
export type ArReminderTriggerMode = 'AUTO' | 'MANUAL';

export type ArReminderRule = {
  id: string;
  tenantId: string;
  name: string;
  triggerType: ArReminderTriggerType;
  daysOffset: number;
  active: boolean;
  escalationLevel: ArReminderLevel;
  createdById: string;
  createdAt: string;
};

export type ArReminderTemplate = {
  id: string;
  tenantId: string;
  level: ArReminderLevel;
  subject: string;
  body: string;
  active: boolean;
  lastUpdatedById: string;
  lastUpdatedAt: string;
};

export function listReminderRules() {
  return apiFetch<ArReminderRule[]>('/ar/reminders/rules', { method: 'GET' });
}

export function upsertReminderRule(body: {
  id?: string;
  name: string;
  triggerType: ArReminderTriggerType;
  daysOffset: number;
  active: boolean;
  escalationLevel: ArReminderLevel;
}) {
  return apiFetch<ArReminderRule>('/ar/reminders/rules', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function listReminderTemplates() {
  return apiFetch<ArReminderTemplate[]>('/ar/reminders/templates', { method: 'GET' });
}

export function upsertReminderTemplate(body: {
  id?: string;
  level: ArReminderLevel;
  subject: string;
  body: string;
  active: boolean;
}) {
  return apiFetch<ArReminderTemplate>('/ar/reminders/templates', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function sendReminder(body: { invoiceId: string; triggerMode?: ArReminderTriggerMode; reminderRuleId?: string }) {
  return apiFetch<{
    logId: string;
    invoiceId: string;
    customerId: string;
    reminderLevel: ArReminderLevel;
    triggerMode: ArReminderTriggerMode;
    subject: string;
    body: string;
    customerEmail: string | null;
  }>('/ar/reminders/send', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
