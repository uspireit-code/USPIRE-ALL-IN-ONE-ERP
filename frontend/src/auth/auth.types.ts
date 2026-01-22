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
  tenant: AuthTenant;
  permissions: string[];
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string };
  tenant: { id: string; name: string };
};
