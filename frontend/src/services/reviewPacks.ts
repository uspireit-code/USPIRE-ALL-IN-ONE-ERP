import { apiFetch } from './api';

export type ReviewPackRow = {
  id: string;
  tenantId: string;
  periodId: string;
  generatedById: string;
  storageKey: string;
  zipSize: number;
  zipSha256Hash: string;
  manifestSha256: string;
  createdAt: string;
  generatedBy?: { id: string; email: string };
};

export async function listReviewPacks(periodId: string) {
  return apiFetch<ReviewPackRow[]>(`/gl/periods/${periodId}/review-packs`, { method: 'GET' });
}

export async function generateReviewPack(periodId: string) {
  return apiFetch<ReviewPackRow>(`/gl/periods/${periodId}/review-packs`, { method: 'POST' });
}

export async function downloadReviewPack(periodId: string, packId: string) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
  const accessToken = localStorage.getItem('accessToken') ?? '';
  const tenantId = localStorage.getItem('tenantId') ?? '';

  const headers = new Headers();
  if (tenantId) headers.set('x-tenant-id', tenantId);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const res = await fetch(`${baseUrl}/gl/periods/${periodId}/review-packs/${packId}/download`, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw { status: res.status, body: text };
  }

  const blob = await res.blob();
  const contentDisposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(contentDisposition);
  const fileName = match?.[1] || `review-pack_${periodId}_${packId}.zip`;
  return { blob, fileName };
}
