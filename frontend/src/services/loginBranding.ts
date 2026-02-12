import { apiFetch } from './api';

export type PublicLoginBranding = {
  loginPageTitle: string;
  loginPageBackgroundUrl: string | null;
  logoUrl: string | null;
};

export async function getPublicLoginBranding(tenantId?: string) {
  const tid = String(tenantId ?? '').trim() || 'default';
  return apiFetch<PublicLoginBranding>(
    `/public/branding/login?tenantId=${encodeURIComponent(tid)}`,
    { method: 'GET' },
  );
}
