export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  jobTitle?: string | null;
  timezone?: string | null;
  language?: string | null;
  avatarUrl?: string | null;
  roles: string[];
};

export type AuthTenant = {
  id: string;
  name: string;
};

export type AuthMeResponse = {
  user: AuthUser;
  actingUser?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    jobTitle?: string | null;
    timezone?: string | null;
    language?: string | null;
    avatarUrl?: string | null;
  } | null;
  tenant: AuthTenant;
  permissions: string[];
  availableDelegations?: AvailableDelegation[];
  delegation?: {
    delegationId: string;
    realUserId: string;
    actingAsUserId?: string;
  } | null;
};

export type AvailableDelegation = {
  id: string;
  scope: 'APPROVE' | 'POST' | 'BOTH';
  startsAt: string;
  expiresAt: string;
  actingAsUserId?: string;
  actingAsUserName?: string;
  actingAsUserJobTitle?: string;
  actingAsUserEmail?: string;
};

export type LoginSuccessResponse = {
  success: true;
  availableDelegations?: AvailableDelegation[];
};

export type LoginRequiresTenantResponse = {
  requiresTenant: true;
  message: string;
};

export type LoginRequires2faResponse = {
  requires2fa: true;
  challengeId: string;
  method: 'EMAIL' | 'AUTHENTICATOR' | 'SMS';
  maskedDestination?: string;
};

export type LoginRequiresPasswordResetResponse = {
  requiresPasswordReset: true;
  reason?: string;
  message?: string;
};

export type LoginResponse =
  | LoginSuccessResponse
  | LoginRequiresTenantResponse
  | LoginRequires2faResponse
  | LoginRequiresPasswordResetResponse;
