import { apiFetch, apiFetchRaw } from './api';

export type OrganisationSettings = {
  id: string;
  organisationName: string;
  organisationShortName: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  updatedAt: string;
};

export type TenantSystemConfig = {
  id: string;
  name: string;
  organisationName: string;
  organisationShortName: string | null;
  legalName: string | null;
  defaultCurrency: string | null;
  country: string | null;
  timezone: string | null;
  financialYearStartMonth: number | null;
  dateFormat: string | null;
  numberFormat: string | null;
  defaultLandingPage: string | null;
  defaultDashboard: string | null;
  defaultLanguage: string | null;
  demoModeEnabled: boolean | null;
  defaultUserRoleCode: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  accentColor: string | null;
  secondaryAccentColor: string | null;
  updatedAt: string;
};

export type SettingsUser = {
  id: string;
  name: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE';
  roles: Array<{ id: string; name: string }>;
  createdAt: string;
};

export type SettingsRole = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
};

export type SoDConflict = {
  permissionA: string;
  permissionB: string;
};

export type RoleBadgeInfo = {
  canApprove: boolean;
  readOnly: boolean;
  admin: boolean;
};

export type RolePermissionItem = {
  label: string;
  explanation: string;
};

export type RolePermissionGroup = {
  module: string;
  items: RolePermissionItem[];
};

export type SettingsRoleOverview = {
  id: string;
  name: string;
  description: string | null;
  intendedUsers: string | null;
  badges: RoleBadgeInfo;
  permissions: RolePermissionGroup[];
  controlRules: string[];
};

export type SettingsRoleDetails = {
  id: string;
  name: string;
  description: string | null;
  intendedUsers: string | null;
  permissions: Array<{
    module: string;
    items: Array<RolePermissionItem & { allowed: boolean }>;
  }>;
  controlRules: string[];
};

export async function getOrganisationSettings() {
  return apiFetch<OrganisationSettings>('/settings/organisation', { method: 'GET' });
}

export async function updateOrganisationSettings(params: { organisationName: string; organisationShortName: string | null }) {
  return apiFetch<OrganisationSettings>('/settings/organisation', {
    method: 'PUT',
    body: JSON.stringify({
      organisationName: params.organisationName,
      organisationShortName: params.organisationShortName,
    }),
  });
}

export async function uploadOrganisationLogo(file: File) {
  const fd = new FormData();
  fd.append('file', file);
  return apiFetch<{ logoUrl: string }>('/settings/organisation/logo', {
    method: 'POST',
    body: fd,
  });
}

export async function fetchOrganisationLogoBlob() {
  const res = await apiFetchRaw('/settings/organisation/logo', { method: 'GET' });
  const blob = await res.blob();
  return blob;
}

export async function getSystemConfig() {
  return apiFetch<TenantSystemConfig>('/settings/system', { method: 'GET' });
}

export async function updateSystemConfig(params: Partial<Omit<TenantSystemConfig, 'id' | 'updatedAt' | 'logoUrl' | 'faviconUrl' | 'name'>>) {
  return apiFetch<TenantSystemConfig>('/settings/system', {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

export async function uploadSystemFavicon(file: File) {
  const fd = new FormData();
  fd.append('file', file);
  return apiFetch<{ faviconUrl: string }>('/settings/system/favicon', {
    method: 'POST',
    body: fd,
  });
}

export async function fetchSystemFaviconBlob() {
  const res = await apiFetchRaw('/settings/system/favicon', { method: 'GET' });
  const blob = await res.blob();
  return blob;
}

export async function listSettingsUsers() {
  return apiFetch<SettingsUser[]>('/settings/users', { method: 'GET' });
}

export async function listSettingsRoles() {
  return apiFetch<SettingsRole[]>('/settings/users/roles', { method: 'GET' });
}

export async function validateSettingsUserRoles(params: { roleIds: string[] }) {
  return apiFetch<{ valid: boolean; conflicts: SoDConflict[] }>('/settings/users/roles/validate', {
    method: 'POST',
    body: JSON.stringify({ roleIds: params.roleIds }),
  });
}

export async function createSettingsUser(params: { name: string; email: string; temporaryPassword?: string; roleIds?: string[] }) {
  return apiFetch<{
    id: string;
    name: string;
    email: string;
    status: 'ACTIVE' | 'INACTIVE';
    createdAt: string;
    temporaryPassword: string;
  }>('/settings/users', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateSettingsUserStatus(params: { id: string; isActive: boolean }) {
  return apiFetch<SettingsUser>(`/settings/users/${params.id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive: params.isActive }),
  });
}

export async function updateSettingsUserRoles(params: {
  userId: string;
  roleIds: string[];
}): Promise<{ userId: string; roles: Array<{ id: string; name: string }> }> {
  return apiFetch(`/settings/users/${params.userId}/roles`, {
    method: 'PATCH',
    body: JSON.stringify({ roleIds: params.roleIds }),
  });
}

export async function listSettingsRolesOverview(): Promise<SettingsRoleOverview[]> {
  return apiFetch('/settings/roles');
}

export async function getSettingsRoleDetails(roleId: string): Promise<SettingsRoleDetails> {
  return apiFetch(`/settings/roles/${roleId}`);
}
