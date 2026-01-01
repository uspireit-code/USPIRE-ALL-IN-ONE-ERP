import { apiFetch, apiFetchRaw } from './api';

export type DisclosureNoteType =
  | 'PPE_MOVEMENT'
  | 'DEPRECIATION'
  | 'TAX_RECONCILIATION'
  | 'PROVISIONS'
  | 'CONTINGENCIES';

export type DisclosureNoteLine = {
  id: string;
  disclosureNoteId: string;
  rowKey: string;
  label: string;
  values: any;
  orderIndex: number;
};

export type DisclosureNoteResponse = {
  id: string;
  tenantId: string;
  accountingPeriodId: string;
  noteType: DisclosureNoteType;
  generatedAt: string;
  generatedById: string;
  metadata?: any;
  createdAt: string;
  lines: DisclosureNoteLine[];
};

export function generateDisclosureNote(params: {
  periodId: string;
  noteType: DisclosureNoteType;
}) {
  return apiFetch<DisclosureNoteResponse>('/reports/disclosure-notes/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function listDisclosureNotes(params: { periodId: string }) {
  return apiFetch<
    Array<{
      id: string;
      accountingPeriodId: string;
      noteType: DisclosureNoteType;
      generatedAt: string;
      generatedById: string;
      createdAt: string;
    }>
  >(`/reports/disclosure-notes?periodId=${encodeURIComponent(params.periodId)}`, { method: 'GET' });
}

export function getDisclosureNote(id: string) {
  return apiFetch<DisclosureNoteResponse>(`/reports/disclosure-notes/${encodeURIComponent(id)}`, { method: 'GET' });
}

export type IfrsDisclosureNoteCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export type IfrsDisclosureTable = {
  title: string;
  columns: Array<{ key: string; label: string; align?: 'left' | 'right' }>;
  rows: Array<Record<string, any>>;
};

export type IfrsStatementReference = {
  statement: 'BS' | 'PL' | 'CF' | 'SOCE';
  lineCode?: string;
  lineLabel?: string;
  amount?: number;
  asOf?: string;
  from?: string;
  to?: string;
};

export type IfrsDisclosureNoteDto = {
  noteCode: IfrsDisclosureNoteCode;
  title: string;
  narrative?: string;
  footnotes?: string[];
  tables: IfrsDisclosureTable[];
  statementReferences: IfrsStatementReference[];
};

export type IfrsDisclosureNotesIndexItem = {
  noteCode: IfrsDisclosureNoteCode;
  title: string;
};

export function listIfrsNotes() {
  return apiFetch<IfrsDisclosureNotesIndexItem[]>('/reports/disclosure-notes/ifrs', {
    method: 'GET',
  });
}

export function getIfrsNote(params: {
  periodId: string;
  noteCode: IfrsDisclosureNoteCode;
}) {
  return apiFetch<IfrsDisclosureNoteDto>(
    `/reports/disclosure-notes/ifrs/${encodeURIComponent(params.noteCode)}?periodId=${encodeURIComponent(params.periodId)}`,
    { method: 'GET' },
  );
}

export async function downloadIfrsNotePdf(params: {
  periodId: string;
  noteCode: IfrsDisclosureNoteCode;
}) {
  const res = await apiFetchRaw(
    `/reports/disclosure-notes/ifrs/${encodeURIComponent(params.noteCode)}/export?periodId=${encodeURIComponent(params.periodId)}`,
    { method: 'GET' },
  );

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cd = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^";]+)"?/i.exec(cd);
  a.download = match?.[1] ?? `ifrs_note_${params.noteCode}_${params.periodId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
