import type React from 'react';
import { tokens } from '../designTokens';

export type NoticeTone = 'info' | 'success' | 'warning' | 'error';

export type NoticeKind =
  | 'validation'
  | 'governance'
  | 'permission'
  | 'system'
  | 'empty'
  | 'success'
  | 'info';

function toneFromKind(kind: NoticeKind): NoticeTone {
  if (kind === 'success') return 'success';
  if (kind === 'validation') return 'warning';
  if (kind === 'permission') return 'warning';
  if (kind === 'governance') return 'warning';
  if (kind === 'system') return 'error';
  if (kind === 'empty') return 'info';
  if (kind === 'info') return 'info';
  return 'info';
}

function defaultTitleFromKind(kind: NoticeKind) {
  if (kind === 'validation') return 'Review required';
  if (kind === 'governance') return 'Governance check';
  if (kind === 'permission') return 'Access restricted';
  if (kind === 'system') return 'System issue';
  if (kind === 'empty') return 'Nothing to show yet';
  if (kind === 'success') return 'Completed';
  if (kind === 'info') return 'Notice';
  return 'Notice';
}

export function NoticeCard(props: {
  kind?: NoticeKind;
  tone?: NoticeTone;
  title?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const tone = props.tone ?? toneFromKind(props.kind ?? 'info');
  const title = props.title ?? defaultTitleFromKind(props.kind ?? 'info');

  const toneStyles: Record<NoticeTone, { bg: string; border: string; accent: string; iconColor: string }> = {
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
      iconColor: 'rgba(16,185,129,0.72)',
    },
    warning: {
      bg: tokens.colors.status.warningBg,
      border: tokens.colors.status.warningBorder,
      accent: 'rgba(231,158,19,0.72)',
      iconColor: 'rgba(231,158,19,0.90)',
    },
    error: {
      bg: tokens.colors.status.errorBg,
      border: tokens.colors.status.errorBorder,
      accent: 'rgba(239,68,68,0.55)',
      iconColor: 'rgba(239,68,68,0.78)',
    },
  };

  const s = toneStyles[tone];

  const Icon = () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </svg>
  );

  return (
    <div
      style={{
        padding: tokens.spacing.x3,
        borderRadius: tokens.radius.lg,
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
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: s.accent }} aria-hidden="true" />
      <div style={{ flex: '0 0 auto', color: s.iconColor, marginTop: 2 }} aria-hidden="true">
        <Icon />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 850, color: tokens.colors.text.primary, letterSpacing: 0.2 }}>{title}</div>
        {props.children ? (
          <div style={{ marginTop: 8, color: tokens.colors.text.secondary, fontSize: 13, lineHeight: '18px' }}>
            {props.children}
          </div>
        ) : null}
        {props.actions ? <div style={{ marginTop: 14 }}>{props.actions}</div> : null}
      </div>
    </div>
  );
}
