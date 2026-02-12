export type ApiError = {
  status: number;
  body: any;
};

export function getApiErrorMessage(e: unknown, fallback = 'Request failed') {
  const err = e as Partial<ApiError> & { message?: string };

  if (typeof err?.message === 'string' && err.message.trim()) {
    return err.message;
  }

  const status = typeof err?.status === 'number' ? err.status : undefined;
  const body = (err as any)?.body;

  const bodyMessage =
    typeof body === 'string'
      ? body
      : typeof body?.message === 'string'
        ? body.message
        : typeof body?.error === 'string'
          ? body.error
          : typeof body?.reason === 'string'
            ? body.reason
            : body
              ? JSON.stringify(body)
              : '';

  if (bodyMessage) return bodyMessage;
  if (status) return fallback;
  if (bodyMessage) return bodyMessage;
  return fallback;
}

export type ApiConfig = {
  baseUrl: string;
};

function resolveApiBaseUrl() {
  const fromApiUrl = (import.meta.env.VITE_API_URL ?? '').toString().trim();
  const fromBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').toString().trim();
  const raw = fromApiUrl || fromBaseUrl || '/api';
  return raw.replace(/\/+$/, '');
}

export const API_BASE_URL = resolveApiBaseUrl();

const defaultConfig: ApiConfig = {
  baseUrl: API_BASE_URL,
};

const debugApi = (import.meta.env.VITE_DEBUG_API ?? '').toString().toLowerCase() === 'true';

function getStoredAuth() {
  const tenantId = (localStorage.getItem('tenantId') ?? '').trim();
  return { tenantId };
}

function clearStoredAuth() {
  try {
    localStorage.removeItem('tenantId');
    localStorage.removeItem('delegationId');
    localStorage.removeItem('actingAsUserId');
    localStorage.removeItem('actingAsUserName');
    localStorage.removeItem('realUserId');
  } catch {
    return;
  }
}

function redirectToLoginIfNeeded() {
  if (typeof window === 'undefined') return;
  const path = window.location?.pathname ?? '';
  if (path.startsWith('/login')) return;
  if (path.startsWith('/forgot-password')) return;
  if (path.startsWith('/reset-password')) return;
  if (path.startsWith('/force-password-reset')) return;
  const next = encodeURIComponent(window.location?.pathname ?? '/');
  window.location.assign(`/login?next=${next}`);
}

export async function apiFetch<T>(
  inputPath: string,
  init?: RequestInit,
  config: ApiConfig = defaultConfig,
): Promise<T> {
  const { tenantId } = getStoredAuth();

  const isAuthEndpoint = inputPath.startsWith('/auth/login') || inputPath.startsWith('/auth/refresh');

  const headers = new Headers(init?.headers ?? {});
  const hasExplicitContentType = headers.has('Content-Type');
  const isFormDataBody = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  if (!hasExplicitContentType && !isFormDataBody) {
    headers.set('Content-Type', 'application/json');
  }
  if (tenantId && !isAuthEndpoint) headers.set('x-tenant-id', tenantId);

  if (debugApi) {
    // eslint-disable-next-line no-console
    console.debug('[apiFetch]', {
      baseUrl: config.baseUrl,
      path: inputPath,
      method: init?.method ?? 'GET',
      isAuthEndpoint,
      hasTenantId: Boolean(tenantId),
      hasAuthorization: false,
    });
  }

  const res = await fetch(`${config.baseUrl}${inputPath}`, {
    ...init,
    headers,
    credentials: init?.credentials ?? 'include',
  });

  const text = await res.text();
  const body = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    if (res.status === 401) {
      clearStoredAuth();
      redirectToLoginIfNeeded();
    }
    const err: ApiError = { status: res.status, body };
    throw err;
  }

  return body as T;
}

export async function apiFetchRaw(
  inputPath: string,
  init?: RequestInit,
  config: ApiConfig = defaultConfig,
): Promise<Response> {
  const { tenantId } = getStoredAuth();

  const isAuthEndpoint = inputPath.startsWith('/auth/login') || inputPath.startsWith('/auth/refresh');

  const headers = new Headers(init?.headers ?? {});
  const isFormDataBody = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const hasBody = init?.body !== undefined && init?.body !== null;
  if (hasBody && !headers.has('Content-Type') && !isFormDataBody) {
    headers.set('Content-Type', 'application/json');
  }
  if (tenantId && !isAuthEndpoint) headers.set('x-tenant-id', tenantId);

  if (debugApi) {
    // eslint-disable-next-line no-console
    console.debug('[apiFetchRaw]', {
      baseUrl: config.baseUrl,
      path: inputPath,
      method: init?.method ?? 'GET',
      isAuthEndpoint,
      hasTenantId: Boolean(tenantId),
      hasAuthorization: false,
    });
  }

  const res = await fetch(`${config.baseUrl}${inputPath}`, {
    ...init,
    headers,
    credentials: init?.credentials ?? 'include',
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearStoredAuth();
      const text = await res.text();
      const body = text ? safeJsonParse(text) : null;
      redirectToLoginIfNeeded();
      const err: ApiError = { status: res.status, body };
      throw err;
    }
    const text = await res.text();
    const body = text ? safeJsonParse(text) : null;
    const err: ApiError = { status: res.status, body };
    throw err;
  }

  return res;
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function requestPasswordReset(email: string, tenantId?: string) {
  const payload: Record<string, unknown> = {
    email: (email ?? '').trim(),
    ...(tenantId && tenantId.trim() ? { tenantId: tenantId.trim() } : {}),
  };

  return apiFetch<{ message?: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
    credentials: 'omit',
  });
}

export async function pingSession() {
  return apiFetch<{ success: true }>('/auth/ping', {
    method: 'POST',
  });
}

export async function resetPassword(token: string, newPassword: string, confirmPassword: string) {
  const payload = {
    token: (token ?? '').trim(),
    newPassword,
    confirmPassword,
  };

  return apiFetch<{ message?: string; success?: boolean }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
    credentials: 'include',
  });
}

export async function changeExpiredPassword(payload: {
  emailOrUsername: string;
  tenantId?: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const body = {
    emailOrUsername: String(payload.emailOrUsername ?? '').trim(),
    ...(payload.tenantId && payload.tenantId.trim() ? { tenantId: payload.tenantId.trim() } : {}),
    newPassword: payload.newPassword,
    confirmPassword: payload.confirmPassword,
  };

  return apiFetch<{ ok: true }>('/auth/force-change-password', {
    method: 'POST',
    body: JSON.stringify(body),
    credentials: 'omit',
  });
}
