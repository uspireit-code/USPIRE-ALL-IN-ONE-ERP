import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../services/api';
import type {
  AuthMeResponse,
  AvailableDelegation,
  LoginResponse,
  LoginRequires2faResponse,
  LoginRequiresPasswordResetResponse,
  LoginRequiresTenantResponse,
} from './auth.types';

type AuthState = {
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  tenantId: string;
  me: null | AuthMeResponse;
  availableDelegations: AvailableDelegation[];
  delegation: {
    isDelegated: boolean;
    delegationId?: string;
    actingAsUserId?: string;
    actingAsUserName?: string;
    realUserId?: string;
  };
};

export type AuthContextValue = {
  state: AuthState;
  login: (params: { emailOrUsername: string; password: string; tenantId?: string; tenantName?: string }) => Promise<LoginResponse>;
  verify2fa: (params: { challengeId: string; otp: string }) => Promise<void>;
  activateDelegation: (params: { delegationId: string; actingAsUserName?: string }) => Promise<void>;
  clearDelegationChoice: () => void;
  logout: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getInitialState(): AuthState {
  const tenantId = localStorage.getItem('tenantId') ?? '';
  const delegationId = (localStorage.getItem('delegationId') ?? '').trim();
  const actingAsUserId = (localStorage.getItem('actingAsUserId') ?? '').trim();
  const actingAsUserName = (localStorage.getItem('actingAsUserName') ?? '').trim();
  const realUserId = (localStorage.getItem('realUserId') ?? '').trim();

  return {
    isAuthenticated: false,
    isBootstrapping: true,
    tenantId,
    me: null,
    availableDelegations: [],
    delegation: {
      isDelegated: Boolean(delegationId),
      delegationId: delegationId || undefined,
      actingAsUserId: actingAsUserId || undefined,
      actingAsUserName: actingAsUserName || undefined,
      realUserId: realUserId || undefined,
    },
  };
}

export function AuthProvider(props: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => getInitialState());

  const refreshMe = useCallback(async () => {
    const me = await apiFetch<AuthMeResponse>('/auth/me', { method: 'GET' });

    const resolvedTenantId = String(me?.tenant?.id ?? '').trim();
    if (resolvedTenantId) {
      try {
        localStorage.setItem('tenantId', resolvedTenantId);
        localStorage.setItem('lastTenantId', resolvedTenantId);
      } catch {
        // ignore
      }
    }

    const availableDelegations = Array.isArray((me as any)?.availableDelegations)
      ? (((me as any).availableDelegations ?? []) as AvailableDelegation[])
      : [];

    const delegationRaw = (me as any)?.delegation;
    const delegationId = typeof delegationRaw?.delegationId === 'string' ? delegationRaw.delegationId : '';
    const actingAsUserId = typeof delegationRaw?.actingAsUserId === 'string' ? delegationRaw.actingAsUserId : '';
    const realUserId = typeof delegationRaw?.realUserId === 'string' ? delegationRaw.realUserId : '';

    if (import.meta.env.DEV) {
      const perms = me?.permissions ?? [];
      const arPerms = perms
        .filter((p) =>
          /^(AR_)?(INVOICE|RECEIPT|RECEIPTS|CREDIT_NOTE|REFUND)_(VIEW|CREATE|EDIT_DRAFT|POST)/i.test(p ?? ''),
        )
        .sort();

      const apPerms = perms
        .filter((p) =>
          /^(AP_)?(SUPPLIER|INVOICE|PAYMENT_PROPOSAL)_(VIEW|CREATE|IMPORT|SUBMIT|APPROVE|POST)/i.test(
            p ?? '',
          ),
        )
        .sort();

      // TEMP DEBUG: prove what the UI received from /auth/me.
      // eslint-disable-next-line no-console
      console.log('[auth.me][frontend]', {
        email: me?.user?.email,
        tenantId: me?.tenant?.id,
        permissionCount: perms.length,
        arPermissionCount: arPerms.length,
        arPermissions: arPerms,
        apPermissionCount: apPerms.length,
        apPermissions: apPerms,
      });
    }

    setState((s) => ({
      ...s,
      me,
      tenantId: me?.tenant?.id ?? s.tenantId,
      isAuthenticated: true,
      availableDelegations,
      delegation: {
        ...s.delegation,
        isDelegated: Boolean(delegationId || s.delegation.delegationId),
        delegationId: (delegationId || s.delegation.delegationId) || undefined,
        actingAsUserId: (actingAsUserId || s.delegation.actingAsUserId) || undefined,
        realUserId: (realUserId || s.delegation.realUserId) || undefined,
      },
    }));
  }, [state.tenantId]);

  useEffect(() => {
    if (!state.isBootstrapping) return;

    refreshMe()
      .catch((e: any) => {
        const status = typeof e?.status === 'number' ? e.status : undefined;
        if (status === 401) {
          setState((s) => ({ ...s, me: null, isAuthenticated: false }));
        }
      })
      .finally(() => {
        setState((s) => ({ ...s, isBootstrapping: false }));
      });
  }, [refreshMe, state.isBootstrapping]);

  const login = useCallback(async (params: { tenantId?: string; tenantName?: string; emailOrUsername: string; password: string }) => {
    const tenantIdTrimmed = (params.tenantId ?? '').trim();
    const tenantNameTrimmed = (params.tenantName ?? '').trim();
    const idTrimmed = (params.emailOrUsername ?? '').trim();

    if (tenantIdTrimmed) {
      try {
        localStorage.setItem('lastTenantId', tenantIdTrimmed);
      } catch {
        // ignore
      }
    }

    const payload: Record<string, unknown> = {
      emailOrUsername: idTrimmed,
      password: params.password,
      ...(tenantIdTrimmed ? { tenantId: tenantIdTrimmed } : {}),
      ...(tenantNameTrimmed ? { tenantName: tenantNameTrimmed } : {}),
    };

    let resp: LoginResponse;
    try {
      resp = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (e: any) {
      const body = (e as any)?.body;
      if (body && (body as LoginRequiresTenantResponse).requiresTenant) {
        return body as LoginRequiresTenantResponse;
      }
      throw e;
    }

    if ((resp as LoginRequiresTenantResponse)?.requiresTenant) {
      return resp;
    }
    if ((resp as LoginRequires2faResponse)?.requires2fa) {
      return resp;
    }

    if ((resp as LoginRequiresPasswordResetResponse)?.requiresPasswordReset) {
      return resp;
    }

    const availableDelegations = Array.isArray((resp as any)?.availableDelegations)
      ? ((resp as any).availableDelegations as AvailableDelegation[])
      : [];

    setState((s) => ({
      ...s,
      availableDelegations,
    }));

    if (availableDelegations.length > 0) {
      localStorage.removeItem('delegationChoice');
      localStorage.removeItem('delegationId');
      localStorage.removeItem('actingAsUserId');
      localStorage.removeItem('actingAsUserName');
      localStorage.removeItem('realUserId');

      setState((s) => ({
        ...s,
        delegation: { isDelegated: false },
      }));

      return resp as any;
    }

    await refreshMe();
    return resp as any;
  }, [refreshMe]);

  const verify2fa = useCallback(async (params: { challengeId: string; otp: string }) => {
    const payload = {
      challengeId: (params.challengeId ?? '').trim(),
      otp: (params.otp ?? '').trim(),
    };

    await apiFetch<{ success: true }>('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    await refreshMe();
  }, [refreshMe]);

  const activateDelegation = useCallback(
    async (params: { delegationId: string; actingAsUserName?: string }) => {
      const delegationId = String(params.delegationId ?? '').trim();
      if (!delegationId) {
        throw new Error('delegationId is required');
      }

      const resp: any = await apiFetch('/auth/activate-delegation', {
        method: 'POST',
        body: JSON.stringify({ delegationId }),
      });

      const actingAsUserId = typeof resp?.delegation?.actingAsUserId === 'string' ? resp.delegation.actingAsUserId : undefined;
      const realUserId = typeof resp?.delegation?.realUserId === 'string' ? resp.delegation.realUserId : undefined;

      localStorage.setItem('delegationId', delegationId);
      if (actingAsUserId) localStorage.setItem('actingAsUserId', actingAsUserId);
      if (realUserId) localStorage.setItem('realUserId', realUserId);
      if (params.actingAsUserName) {
        localStorage.setItem('actingAsUserName', String(params.actingAsUserName));
      }

      setState((s) => ({
        ...s,
        availableDelegations: [],
        delegation: {
          ...s.delegation,
          isDelegated: true,
          delegationId,
          actingAsUserId: actingAsUserId ?? s.delegation.actingAsUserId,
          realUserId: realUserId ?? s.delegation.realUserId,
          actingAsUserName: params.actingAsUserName ?? s.delegation.actingAsUserName,
        },
      }));

      await refreshMe();
    },
    [refreshMe],
  );

  const clearDelegationChoice = useCallback(() => {
    localStorage.removeItem('delegationId');
    localStorage.removeItem('actingAsUserId');
    localStorage.removeItem('actingAsUserName');
    localStorage.removeItem('realUserId');

    setState((s) => ({
      ...s,
      availableDelegations: [],
      delegation: {
        isDelegated: false,
      },
    }));
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }

    localStorage.removeItem('tenantId');
    // Keep lastTenantId so public pages (login/forgot/reset) can still load tenant branding.
    localStorage.removeItem('delegationChoice');
    localStorage.removeItem('delegationId');
    localStorage.removeItem('actingAsUserId');
    localStorage.removeItem('actingAsUserName');
    localStorage.removeItem('realUserId');
    setState({
      isAuthenticated: false,
      isBootstrapping: false,
      tenantId: '',
      me: null,
      availableDelegations: [],
      delegation: { isDelegated: false },
    });
  }, []);

  const hasPermission = useCallback(
    (code: string) => {
      const target = (code ?? '').trim().toLowerCase();
      if (!target) return false;
      const perms = state.me?.permissions ?? [];
      return perms.some((p) => (p ?? '').trim().toLowerCase() === target);
    },
    [state.me?.permissions],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ state, login, verify2fa, activateDelegation, clearDelegationChoice, logout, hasPermission, refreshMe }),
    [activateDelegation, clearDelegationChoice, hasPermission, login, logout, refreshMe, state, verify2fa],
  );

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthContext missing');
  return ctx;
}
