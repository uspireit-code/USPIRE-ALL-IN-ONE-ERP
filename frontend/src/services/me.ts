import { apiFetch } from './api';

export type MyLegalEntityAccessItem = {
  legalEntityId: string;
  legalEntity: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  };
  accessLevel: string | null;
  canPost: boolean;
  canApprove: boolean;
  canOverride: boolean;
  expiresAt: string | null;
};

export type MyLegalEntityAccessResponse = {
  items: MyLegalEntityAccessItem[];
};

export async function getMyLegalEntityAccess() {
  return apiFetch<MyLegalEntityAccessResponse>('/me/legal-entity-access', { method: 'GET', cache: 'no-store' });
}
