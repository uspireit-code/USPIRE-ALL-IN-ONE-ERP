import { tokens } from '../../designTokens';

export type AutomationSeverity = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | string;

function normalizeSeverity(s: AutomationSeverity): string {
  return String(s ?? '').trim().toUpperCase();
}

export function AutomationSeverityBadge(props: { severity: AutomationSeverity }) {
  const severity = normalizeSeverity(props.severity);

  const styleBySeverity: Record<string, { bg: string; border: string; text: string }> = {
    LOW: {
      bg: 'rgba(16,185,129,0.10)',
      border: 'rgba(16,185,129,0.28)',
      text: tokens.colors.text.primary,
    },
    MODERATE: {
      bg: tokens.colors.status.warningBg,
      border: tokens.colors.status.warningBorder,
      text: tokens.colors.text.primary,
    },
    HIGH: {
      bg: 'rgba(239,68,68,0.10)',
      border: 'rgba(239,68,68,0.28)',
      text: tokens.colors.text.primary,
    },
    CRITICAL: {
      bg: 'rgba(239,68,68,0.16)',
      border: 'rgba(239,68,68,0.46)',
      text: tokens.colors.text.primary,
    },
  };

  const s = styleBySeverity[severity] ?? {
    bg: tokens.colors.surface.subtle,
    border: tokens.colors.border.subtle,
    text: tokens.colors.text.primary,
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: severity === 'CRITICAL' ? 900 : 800,
        letterSpacing: 0.4,
        border: `1px solid ${s.border}`,
        background: s.bg,
        color: s.text,
        whiteSpace: 'nowrap',
      }}
      title={severity}
    >
      {severity}
    </span>
  );
}
