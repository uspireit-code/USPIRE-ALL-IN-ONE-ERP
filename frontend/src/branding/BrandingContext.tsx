import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { TenantSystemConfig } from '../services/settings';
import { getSystemConfig } from '../services/settings';
import { getCurrentBranding } from '../services/branding';
import { API_BASE_URL } from '../services/api';
import { getPublicLoginBranding } from '../services/loginBranding';
import { useAuth } from '../auth/AuthContext';

type BrandingOverrides = Partial<Pick<TenantSystemConfig, 'organisationName' | 'organisationShortName' | 'logoUrl' | 'faviconUrl' | 'primaryColor' | 'secondaryColor' | 'accentColor' | 'secondaryAccentColor'>>;

type BrandingContextValue = {
  base: TenantSystemConfig | null;
  effective: TenantSystemConfig | null;
  loginPageTitle: string;
  loginPageBackgroundUrl: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setPreviewOverrides: (overrides: BrandingOverrides) => void;
  clearPreviewOverrides: () => void;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

function getApiBaseUrl() {
  return API_BASE_URL;
}

function getBackendOrigin(): string {
  const base = getApiBaseUrl();
  if (base.startsWith('http://') || base.startsWith('https://')) {
    try {
      return new URL(base).origin;
    } catch {
      return base.replace(/\/+$/, '');
    }
  }

  if (base.startsWith('/')) {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return '';
}

export function normalizeAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) {
    const origin = getBackendOrigin();
    return origin ? `${origin}${url}` : url;
  }
  const base = getApiBaseUrl();
  return `${base}${url}`;
}

export function resolveBrandAssetUrl(path: string | null | undefined): string | null {
  return normalizeAssetUrl(path);
}

function applyFavicon(url: string | null) {
  const href = url ? resolveBrandAssetUrl(url) : null;

  const head = document.head;
  const existing = head.querySelector('link[data-tenant-favicon="true"]') as HTMLLinkElement | null;
  const link = existing ?? (document.createElement('link') as HTMLLinkElement);
  link.setAttribute('rel', 'icon');
  link.setAttribute('data-tenant-favicon', 'true');
  link.setAttribute('href', href ?? '/favicon.ico');

  if (!existing) head.appendChild(link);
}

function brandingCacheKey(tenantId: string) {
  return `tenantBrandingCache:${tenantId}`;
}

function getStoredTenantIdForBranding(): string {
  const tenantId = String(localStorage.getItem('tenantId') ?? '').trim();
  if (tenantId) return tenantId;
  return String(localStorage.getItem('lastTenantId') ?? '').trim();
}

function resolveTenantIdForBranding(authTenantId: string): string {
  const tid = String(authTenantId ?? '').trim();
  if (tid) return tid;
  return getStoredTenantIdForBranding().trim() || 'default';
}

function isPublicAuthRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const path = String(window.location?.pathname ?? '');
  return (
    path.startsWith('/login') ||
    path.startsWith('/forgot-password') ||
    path.startsWith('/reset-password') ||
    path.startsWith('/force-password-reset')
  );
}

function tryLoadCachedBranding(tenantId: string): TenantSystemConfig | null {
  try {
    const raw = localStorage.getItem(brandingCacheKey(tenantId));
    if (!raw) return null;
    return JSON.parse(raw) as TenantSystemConfig;
  } catch {
    return null;
  }
}

function saveCachedBranding(tenantId: string, cfg: TenantSystemConfig) {
  try {
    localStorage.setItem(brandingCacheKey(tenantId), JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

export function BrandingProvider(props: { children: React.ReactNode }) {
  const auth = useAuth();
  const [base, setBase] = useState<TenantSystemConfig | null>(null);
  const [preview, setPreview] = useState<BrandingOverrides>({});
  const [loginPageTitle, setLoginPageTitle] = useState('Enterprise Resource Planning System');
  const [loginPageBackgroundUrl, setLoginPageBackgroundUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastLoadedTenantKey = useRef<string>('');

  const refresh = useCallback(async () => {
    const tenantId = resolveTenantIdForBranding(auth.state.tenantId);

    let resolvedPublicLogoUrl: string | null = null;

    try {
      const lb = await getPublicLoginBranding(tenantId);
      const t = String(lb?.loginPageTitle ?? '').trim();
      setLoginPageTitle(t || 'Enterprise Resource Planning System');
      setLoginPageBackgroundUrl(lb?.loginPageBackgroundUrl ?? null);
      resolvedPublicLogoUrl = lb?.logoUrl ?? null;
    } catch {
      setLoginPageTitle('Enterprise Resource Planning System');
      setLoginPageBackgroundUrl(null);
      resolvedPublicLogoUrl = null;
    }

    if (isPublicAuthRoute()) {
      setBase((prev) => {
        if (!tenantId || tenantId === 'default') {
          return prev?.id ? prev : null;
        }

        const next: TenantSystemConfig = {
          ...(prev ?? {
            id: tenantId,
            name: '',
            organisationName: '',
            organisationShortName: '',
            legalName: null,
            defaultCurrency: null,
            country: null,
            timezone: null,
            financialYearStartMonth: null,
            dateFormat: null,
            numberFormat: null,
            defaultLandingPage: null,
            defaultDashboard: null,
            defaultLanguage: null,
            demoModeEnabled: null,
            defaultUserRoleCode: null,
            logoUrl: null,
            faviconUrl: null,
            primaryColor: '#020445',
            secondaryColor: null,
            accentColor: null,
            secondaryAccentColor: null,
            updatedAt: new Date().toISOString(),
          }),
          id: tenantId,
          logoUrl: resolvedPublicLogoUrl,
        };

        return next;
      });
      lastLoadedTenantKey.current = tenantId;
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const cfg = await getSystemConfig();
      const normalized: TenantSystemConfig = {
        ...cfg,
        logoUrl:
          cfg.logoUrl && cfg.logoUrl.startsWith('/settings/organisation/logo')
            ? `/branding/logo?tenantId=${encodeURIComponent(tenantId)}`
            : cfg.logoUrl,
      };
      setBase(normalized);
      saveCachedBranding(tenantId, normalized);
      lastLoadedTenantKey.current = tenantId;
    } catch (e: any) {
      try {
        const publicBrand = await getCurrentBranding(tenantId);
        const mapped: TenantSystemConfig = {
          id: tenantId,
          name: '',
          organisationName: publicBrand.organisationName,
          organisationShortName: publicBrand.organisationShortName,
          legalName: null,
          defaultCurrency: null,
          country: null,
          timezone: null,
          financialYearStartMonth: null,
          dateFormat: null,
          numberFormat: null,
          defaultLandingPage: null,
          defaultDashboard: null,
          defaultLanguage: null,
          demoModeEnabled: null,
          defaultUserRoleCode: null,
          logoUrl: publicBrand.logoUrl,
          faviconUrl: null,
          primaryColor: publicBrand.primaryColor ?? '#020445',
          secondaryColor: null,
          accentColor: null,
          secondaryAccentColor: null,
          updatedAt: new Date().toISOString(),
        };
        setBase(mapped);
        saveCachedBranding(tenantId, mapped);
        lastLoadedTenantKey.current = tenantId;
      } catch {
        const cached = tryLoadCachedBranding(tenantId);
        setBase(cached);
      }

      setError(e?.message || 'Failed to load system configuration');
    } finally {
      setIsLoading(false);
    }
  }, [auth.state.tenantId]);

  useEffect(() => {
    const tick = async () => {
      const tenantId = resolveTenantIdForBranding(auth.state.tenantId);

      if (!tenantId) {
        if (base) setBase(null);
        return;
      }

      if (isPublicAuthRoute()) {
        if (lastLoadedTenantKey.current !== tenantId) {
          await refresh();
        }
        return;
      }

      if (lastLoadedTenantKey.current !== tenantId || !base) {
        await refresh();
      }
    };

    void tick();
  }, [auth.state.tenantId, base, refresh]);

  const setPreviewOverrides = useCallback((overrides: BrandingOverrides) => {
    setPreview((prev) => ({ ...prev, ...overrides }));
  }, []);

  const clearPreviewOverrides = useCallback(() => {
    setPreview({});
  }, []);

  const effective = useMemo(() => {
    if (!base) return null;
    return { ...base, ...preview };
  }, [base, preview]);

  useEffect(() => {
    applyFavicon(effective?.faviconUrl ?? null);
  }, [effective?.faviconUrl]);

  const value = useMemo<BrandingContextValue>(
    () => ({
      base,
      effective,
      loginPageTitle,
      loginPageBackgroundUrl,
      isLoading,
      error,
      refresh,
      setPreviewOverrides,
      clearPreviewOverrides,
    }),
    [
      base,
      clearPreviewOverrides,
      effective,
      error,
      isLoading,
      loginPageBackgroundUrl,
      loginPageTitle,
      refresh,
      setPreviewOverrides,
    ],
  );

  return <BrandingContext.Provider value={value}>{props.children}</BrandingContext.Provider>;
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('BrandingContext missing');
  return ctx;
}

export function useBrandColors() {
  const { effective } = useBranding();

  const navy = effective?.primaryColor || '#020445';
  const gold = effective?.accentColor || '#EDBA35';
  const white = '#FCFCFC';

  return {
    navy,
    gold,
    white,
    secondary: effective?.secondaryColor || null,
    secondaryAccent: effective?.secondaryAccentColor || null,
  };
}
