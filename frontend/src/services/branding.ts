import { apiFetch } from './api';

export type PublicBranding = {
  organisationName: string;
  organisationShortName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
};

export async function getCurrentBranding() {
  return apiFetch<PublicBranding>('/branding/current', { method: 'GET' });
}
