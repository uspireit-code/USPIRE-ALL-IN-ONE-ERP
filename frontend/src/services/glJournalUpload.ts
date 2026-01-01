import { apiFetch, apiFetchRaw } from './api';

export type JournalUploadError = {
  journalKey?: string;
  sheet?: 'Journals' | 'JournalLines' | 'CSV';
  rowNumber?: number;
  field?: string;
  message: string;
};

export type JournalUploadSuccessResponse = {
  fileName: string;
  journalsCreated: number;
  items: Array<{ journalKey: string; journalId: string }>;
};

export type JournalUploadFailureBody = {
  error: string;
  fileName: string;
  errorCount: number;
  errors: JournalUploadError[];
};

export async function uploadJournals(file: File) {
  const fd = new FormData();
  fd.append('file', file, file.name);
  return apiFetch<JournalUploadSuccessResponse>('/gl/journals/upload', {
    method: 'POST',
    body: fd,
  });
}

async function downloadBlob(path: string) {
  const res = await apiFetchRaw(path, { method: 'GET' });
  const blob = await res.blob();
  const contentDisposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(contentDisposition);
  const fileName = match?.[1] || 'download';
  return { blob, fileName };
}

export async function downloadJournalUploadCsvTemplate() {
  return downloadBlob('/gl/journals/upload/template.csv');
}

export async function downloadJournalUploadXlsxTemplate() {
  return downloadBlob('/gl/journals/upload/template.xlsx');
}
