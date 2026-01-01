import type React from 'react';
import { tokens } from '../designTokens';

export function Alert(props: {
  tone?: 'info' | 'success' | 'warning' | 'error';
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const tone = props.tone ?? 'info';

  const toneStyles: Record<string, { bg: string; border: string; accent: string; iconColor: string }> = {
    info: {
      bg: tokens.colors.status.infoBg,
      border: tokens.colors.status.infoBorder,
      accent: tokens.colors.border.strong,
      iconColor: tokens.colors.text.secondary,
    },
    success: {
      bg: tokens.colors.status.successBg,
      border: tokens.colors.status.successBorder,
      accent: 'rgba(16,185,129,0.55)',
      iconColor: 'rgba(16,185,129,0.70)',
    },
    warning: {
      bg: tokens.colors.status.warningBg,
      border: tokens.colors.status.warningBorder,
      accent: 'rgba(237,186,53,0.70)',
      iconColor: 'rgba(237,186,53,0.85)',
    },
    error: {
      bg: tokens.colors.status.errorBg,
      border: tokens.colors.status.errorBorder,
      accent: 'rgba(239,68,68,0.55)',
      iconColor: 'rgba(239,68,68,0.72)',
    },
  };

  const s = toneStyles[tone];

  const Icon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </svg>
  );

  return (
    <div
      style={{
        padding: tokens.spacing.x2,
        borderRadius: tokens.radius.md,
        background: s.bg,
        border: `1px solid ${s.border}`,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        ...props.style,
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: s.accent }} aria-hidden="true" />
      <div style={{ flex: '0 0 auto', color: s.iconColor, marginTop: 2 }} aria-hidden="true">
        <Icon />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 750, color: tokens.colors.text.primary }}>{props.title}</div>
        {props.children ? <div style={{ marginTop: 6, color: tokens.colors.text.secondary, fontSize: 13, lineHeight: '18px' }}>{props.children}</div> : null}
        {props.actions ? <div style={{ marginTop: 12 }}>{props.actions}</div> : null}
      </div>
    </div>
  );
}
