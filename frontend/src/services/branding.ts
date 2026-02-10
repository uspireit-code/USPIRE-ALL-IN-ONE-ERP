import { apiFetch } from './api';

export type PublicBranding = {
  organisationName: string;
  organisationShortName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
};

export async function getCurrentBranding(tenantId?: string) {
  const tid = String(tenantId ?? '').trim();
  const suffix = tid ? `?tenantId=${encodeURIComponent(tid)}` : '';
  return apiFetch<PublicBranding>(`/branding/current${suffix}`, { method: 'GET' });
}
