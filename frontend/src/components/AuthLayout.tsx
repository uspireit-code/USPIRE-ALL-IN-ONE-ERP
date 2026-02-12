import { useEffect, useState } from 'react';
import { resolveBrandAssetUrl, useBranding } from '../branding/BrandingContext';
import { tokens } from '../designTokens';

export function AuthLayout(props: { children: React.ReactNode }) {
  const { effective, loginPageTitle, loginPageBackgroundUrl } = useBranding();
  const [logoOk, setLogoOk] = useState(true);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const update = () => setIsCompact(window.innerWidth < 920);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const bgUrl = resolveBrandAssetUrl(loginPageBackgroundUrl);

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center"
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isCompact ? 18 : 26,
        backgroundColor: '#0a0354',
        backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,
        backgroundRepeat: bgUrl ? 'no-repeat' : undefined,
        backgroundSize: bgUrl ? 'cover' : undefined,
        backgroundPosition: 'center',
        position: 'relative',
      }}
    >
      {!bgUrl ? (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: effective?.logoUrl && logoOk ? `url(${resolveBrandAssetUrl(effective.logoUrl) ?? ''})` : 'none',
            backgroundRepeat: 'repeat',
            backgroundSize: 120,
            opacity: 0.06,
            pointerEvents: 'none',
          }}
        />
      ) : null}

      <div
        style={{
          width: '100%',
          maxWidth: 620,
          borderRadius: 10,
          overflow: 'hidden',
          border: 'none',
          boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
          background: tokens.colors.white,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            background: '#020445',
            color: tokens.colors.white,
            padding: isCompact ? '20px 22px' : '22px 26px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            {effective?.logoUrl && logoOk ? (
              <div
                style={{
                  width: isCompact ? 116 : 128,
                  height: isCompact ? 116 : 128,
                  borderRadius: 999,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                }}
              >
                <img
                  src={resolveBrandAssetUrl(effective.logoUrl) ?? ''}
                  alt="Organisation logo"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    transform: 'scale(1.10)',
                    border: 'none',
                    background: 'transparent',
                    display: 'block',
                  }}
                  onError={() => setLogoOk(false)}
                />
              </div>
            ) : (
              <div
                aria-label="Organisation logo placeholder"
                style={{
                  width: isCompact ? 116 : 128,
                  height: isCompact ? 116 : 128,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.10)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  letterSpacing: 0.6,
                  color: 'rgba(255,255,255,0.88)',
                  userSelect: 'none',
                }}
              >
                U
              </div>
            )}

            <div
              style={{
                fontSize: isCompact ? 20 : 28,
                fontWeight: 900,
                letterSpacing: 0.8,
                lineHeight: 1.25,
                maxWidth: 540,
                marginTop: 0,
              }}
            >
              {String(loginPageTitle ?? '').trim() || 'Enterprise Resource Planning System'}
            </div>
          </div>
        </div>

        <div style={{ padding: isCompact ? 24 : 28, background: tokens.colors.white }}>{props.children}</div>
      </div>

      <div
        style={{
          marginTop: 16,
          color: 'rgba(255,255,255,0.90)',
          fontSize: 12,
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        © 2026 Uspire Professional Services Limited. All rights reserved.
      </div>
    </div>
  );
}
