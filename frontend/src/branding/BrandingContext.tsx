import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { TenantSystemConfig } from '../services/settings';
import { getSystemConfig } from '../services/settings';
import { getCurrentBranding } from '../services/branding';

type BrandingOverrides = Partial<Pick<TenantSystemConfig, 'organisationName' | 'organisationShortName' | 'logoUrl' | 'faviconUrl' | 'primaryColor' | 'secondaryColor' | 'accentColor' | 'secondaryAccentColor'>>;

type BrandingContextValue = {
  base: TenantSystemConfig | null;
  effective: TenantSystemConfig | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setPreviewOverrides: (overrides: BrandingOverrides) => void;
  clearPreviewOverrides: () => void;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

function getApiBaseUrl() {
  return (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:3000';
}

export function resolveBrandAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('blob:') || path.startsWith('data:')) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = getApiBaseUrl();
  return `${base}${path}`;
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
  const [base, setBase] = useState<TenantSystemConfig | null>(null);
  const [preview, setPreview] = useState<BrandingOverrides>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastLoadedTenantKey = useRef<string>('');

  const refresh = useCallback(async () => {
    const tenantId = localStorage.getItem('tenantId') ?? '';
    const accessToken = localStorage.getItem('accessToken') ?? '';

    if (!tenantId || !accessToken) {
      if (!tenantId) {
        setBase(null);
        return;
      }

      if (!accessToken) {
        setIsLoading(true);
        setError(null);
        try {
          const publicBrand = await getCurrentBranding();
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
        } finally {
          setIsLoading(false);
        }
        return;
      }

      const cached = tryLoadCachedBranding(tenantId);
      setBase(cached);
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
      setError(e?.message || 'Failed to load system configuration');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const tick = async () => {
      const tenantId = localStorage.getItem('tenantId') ?? '';
      const accessToken = localStorage.getItem('accessToken') ?? '';

      if (!tenantId) {
        if (base) setBase(null);
        return;
      }

      if (!accessToken) {
        const cached = tryLoadCachedBranding(tenantId);
        if (cached) setBase(cached);
        return;
      }

      if (lastLoadedTenantKey.current !== tenantId || !base) {
        await refresh();
      }
    };

    void tick();
  }, [base, refresh]);

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
      isLoading,
      error,
      refresh,
      setPreviewOverrides,
      clearPreviewOverrides,
    }),
    [base, clearPreviewOverrides, effective, error, isLoading, refresh, setPreviewOverrides],
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
