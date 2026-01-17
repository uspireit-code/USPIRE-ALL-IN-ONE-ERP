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

const defaultConfig: ApiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
};

const debugApi = (import.meta.env.VITE_DEBUG_API ?? '').toString().toLowerCase() === 'true';

function getStoredAuth() {
  const accessToken = localStorage.getItem('accessToken') ?? '';
  const tenantId = (localStorage.getItem('tenantId') ?? '').trim();
  return { accessToken, tenantId };
}

function clearStoredAuth() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

function redirectToLoginIfNeeded(reason: string) {
  if (typeof window === 'undefined') return;
  const path = window.location?.pathname ?? '';
  if (path.startsWith('/login')) return;
  const next = encodeURIComponent(window.location?.pathname ?? '/');
  window.location.assign(`/login?reason=${encodeURIComponent(reason)}&next=${next}`);
}

export async function apiFetch<T>(
  inputPath: string,
  init?: RequestInit,
  config: ApiConfig = defaultConfig,
): Promise<T> {
  const { accessToken, tenantId } = getStoredAuth();

  const isAuthEndpoint = inputPath.startsWith('/auth/login') || inputPath.startsWith('/auth/refresh');

  const headers = new Headers(init?.headers ?? {});
  const hasExplicitContentType = headers.has('Content-Type');
  const isFormDataBody = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  if (!hasExplicitContentType && !isFormDataBody) {
    headers.set('Content-Type', 'application/json');
  }
  if (tenantId && !isAuthEndpoint) headers.set('x-tenant-id', tenantId);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  if (debugApi) {
    // eslint-disable-next-line no-console
    console.debug('[apiFetch]', {
      baseUrl: config.baseUrl,
      path: inputPath,
      method: init?.method ?? 'GET',
      isAuthEndpoint,
      hasTenantId: Boolean(tenantId),
      hasAuthorization: Boolean(accessToken),
    });
  }

  const res = await fetch(`${config.baseUrl}${inputPath}`, {
    ...init,
    headers,
  });

  const text = await res.text();
  const body = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    if (res.status === 401) {
      clearStoredAuth();
      redirectToLoginIfNeeded('unauthorized');
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
  const { accessToken, tenantId } = getStoredAuth();

  const isAuthEndpoint = inputPath.startsWith('/auth/login') || inputPath.startsWith('/auth/refresh');

  const headers = new Headers(init?.headers ?? {});
  const isFormDataBody = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const hasBody = init?.body !== undefined && init?.body !== null;
  if (hasBody && !headers.has('Content-Type') && !isFormDataBody) {
    headers.set('Content-Type', 'application/json');
  }
  if (!accessToken && tenantId && !isAuthEndpoint) headers.set('x-tenant-id', tenantId);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  if (debugApi) {
    // eslint-disable-next-line no-console
    console.debug('[apiFetchRaw]', {
      baseUrl: config.baseUrl,
      path: inputPath,
      method: init?.method ?? 'GET',
      isAuthEndpoint,
      hasTenantId: Boolean(tenantId),
      hasAuthorization: Boolean(accessToken),
    });
  }

  const res = await fetch(`${config.baseUrl}${inputPath}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearStoredAuth();
      redirectToLoginIfNeeded('unauthorized');
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
