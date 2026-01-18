import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../services/api';
import type { AuthMeResponse, LoginResponse } from './auth.types';

type AuthState = {
  isAuthenticated: boolean;
  tenantId: string;
  accessToken: string;
  refreshToken: string;
  me: null | AuthMeResponse;
};

type AuthContextValue = {
  state: AuthState;
  login: (params: { tenantId?: string; tenantName?: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
  hasPermission: (code: string) => boolean;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getInitialState(): AuthState {
  const accessToken = localStorage.getItem('accessToken') ?? '';
  const refreshToken = localStorage.getItem('refreshToken') ?? '';
  const tenantId = localStorage.getItem('tenantId') ?? '';

  return {
    isAuthenticated: Boolean(accessToken),
    tenantId,
    accessToken,
    refreshToken,
    me: null,
  };
}

export function AuthProvider(props: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => getInitialState());

  const refreshMe = useCallback(async () => {
    if (!state.accessToken) return;
    const me = await apiFetch<AuthMeResponse>('/auth/me', { method: 'GET' });

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
    }));
  }, [state.accessToken, state.tenantId]);

  useEffect(() => {
    if (state.isAuthenticated && !state.me) {
      refreshMe().catch((e: any) => {
        const status = typeof e?.status === 'number' ? e.status : undefined;
        if (status === 401) {
          setState((s) => ({ ...s, me: null, isAuthenticated: false, accessToken: '', refreshToken: '' }));
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      });
    }
  }, [refreshMe, state.isAuthenticated, state.me]);

  const login = useCallback(async (params: { tenantId?: string; tenantName?: string; email: string; password: string }) => {
    const tenantIdTrimmed = (params.tenantId ?? '').trim();
    const tenantNameTrimmed = (params.tenantName ?? '').trim();

    const payload: Record<string, unknown> = {
      email: params.email,
      password: params.password,
      ...(tenantIdTrimmed ? { tenantId: tenantIdTrimmed } : {}),
      ...(tenantNameTrimmed ? { tenantName: tenantNameTrimmed } : {}),
    };

    const resp = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (resp.tenant?.id) {
      localStorage.setItem('tenantId', resp.tenant.id);
    } else {
      localStorage.removeItem('tenantId');
    }

    localStorage.setItem('accessToken', resp.accessToken);
    localStorage.setItem('refreshToken', resp.refreshToken);

    setState({
      isAuthenticated: true,
      tenantId: resp.tenant?.id ?? '',
      accessToken: resp.accessToken,
      refreshToken: resp.refreshToken,
      me: null,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setState({
      isAuthenticated: false,
      tenantId: state.tenantId,
      accessToken: '',
      refreshToken: '',
      me: null,
    });
  }, [state.tenantId]);

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
    () => ({ state, login, logout, hasPermission, refreshMe }),
    [hasPermission, login, logout, refreshMe, state],
  );

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthContext missing');
  return ctx;
}
