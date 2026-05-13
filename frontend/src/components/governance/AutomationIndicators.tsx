import { tokens } from '../../designTokens';

export function AutomationIndicatorPill(props: { label: string; tone: 'neutral' | 'warning' | 'danger' | 'info' }) {
  const tone = props.tone;
  const styleByTone: Record<string, { bg: string; border: string }> = {
    neutral: { bg: tokens.colors.surface.subtle, border: tokens.colors.border.subtle },
    info: { bg: tokens.colors.status.infoBg, border: tokens.colors.status.infoBorder },
    warning: { bg: tokens.colors.status.warningBg, border: tokens.colors.status.warningBorder },
    danger: { bg: tokens.colors.status.errorBg, border: tokens.colors.status.errorBorder },
  };
  const s = styleByTone[tone];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 750,
        border: `1px solid ${s.border}`,
        background: s.bg,
        color: tokens.colors.text.primary,
        whiteSpace: 'nowrap',
      }}
    >
      {props.label}
    </span>
  );
}

export function AutomationIndicators(props: {
  hasOverride: boolean;
  hasEvidence: boolean;
  hasEscalation: boolean;
  isSuspended: boolean;
}) {
  const pills: Array<{ key: string; label: string; tone: 'neutral' | 'warning' | 'danger' | 'info' }> = [];

  if (props.isSuspended) pills.push({ key: 'suspended', label: 'Suspended', tone: 'danger' });
  if (props.hasEscalation) pills.push({ key: 'escalation', label: 'Escalation', tone: 'warning' });
  if (props.hasOverride) pills.push({ key: 'override', label: 'Override-linked', tone: 'info' });
  if (props.hasEvidence) pills.push({ key: 'evidence', label: 'Evidence-linked', tone: 'neutral' });

  if (pills.length === 0) {
    return <span style={{ fontSize: 12, color: tokens.colors.text.muted }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {pills.map((p) => (
        <AutomationIndicatorPill key={p.key} label={p.label} tone={p.tone} />
      ))}
    </div>
  );
}
