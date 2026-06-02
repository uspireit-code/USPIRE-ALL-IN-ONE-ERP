import type React from 'react';
import { tokens } from '../designTokens';
import { Button } from './Button';

export function EmptyState(props: {
  title: string;
  description?: string;
  primaryAction?: { label: string; onClick: () => void; disabled?: boolean };
  secondaryAction?: { label: string; onClick: () => void; disabled?: boolean };
  tone?: 'neutral' | 'info';
  style?: React.CSSProperties;
}) {
  const tone = props.tone ?? 'neutral';

  const bg = tone === 'info' ? tokens.colors.status.infoBg : tokens.colors.surface.subtle;
  const border = tone === 'info' ? tokens.colors.status.infoBorder : tokens.colors.border.subtle;

  return (
    <div
      style={{
        padding: tokens.spacing.x4,
        borderRadius: tokens.radius.lg,
        background: bg,
        border: `1px dashed ${border}`,
        boxSizing: 'border-box',
        display: 'grid',
        gap: 10,
        ...props.style,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 850, color: tokens.colors.text.primary }}>{props.title}</div>
      {props.description ? (
        <div style={{ fontSize: 13, lineHeight: '18px', color: tokens.colors.text.secondary, maxWidth: 760 }}>
          {props.description}
        </div>
      ) : null}

      {props.primaryAction || props.secondaryAction ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
          {props.primaryAction ? (
            <Button
              variant="primary"
              disabled={props.primaryAction.disabled}
              onClick={() => props.primaryAction?.onClick()}
            >
              {props.primaryAction.label}
            </Button>
          ) : null}
          {props.secondaryAction ? (
            <Button
              variant="secondary"
              disabled={props.secondaryAction.disabled}
              onClick={() => props.secondaryAction?.onClick()}
            >
              {props.secondaryAction.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
