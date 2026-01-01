import { apiFetch } from './api';

export type JournalReviewQueueItem = {
  id: string;
  journalNumber: number | null;
  journalDate: string;
  reference: string | null;
  description: string | null;
  journalType: string;
  totalDebit: number;
  totalCredit: number;
  createdAt: string;
  createdBy: null | { id: string; name: string | null; email: string };
  period: {
    id: string | null;
    name: string | null;
    startDate: string | null;
    endDate: string | null;
    label: string | null;
  };
};

export async function listJournalReviewQueue() {
  return apiFetch<JournalReviewQueueItem[]>('/gl/journals/review-queue', { method: 'GET' });
}
