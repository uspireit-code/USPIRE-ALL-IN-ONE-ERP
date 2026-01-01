import type React from 'react';
import { tokens } from '../designTokens';

export function Card(props: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  interactive?: boolean;
  style?: React.CSSProperties;
  baseShadow?: string;
  hoverShadow?: string;
  baseBorderColor?: string;
  hoverBorderColor?: string;
  baseFilter?: string;
  hoverFilter?: string;
}) {
  const baseShadow = props.baseShadow ?? tokens.shadow.card;
  const hoverShadow = props.hoverShadow ?? tokens.shadow.cardHover;
  const baseBorderColor = props.baseBorderColor ?? tokens.colors.border.subtle;
  const hoverBorderColor = props.hoverBorderColor ?? tokens.colors.border.strong;
  const baseFilter = props.baseFilter ?? 'none';
  const hoverFilter = props.hoverFilter ?? baseFilter;

  return (
    <div
      style={{
        background: tokens.colors.white,
        borderRadius: tokens.radius.lg,
        border: `1px solid ${baseBorderColor}`,
        boxShadow: baseShadow,
        filter: baseFilter,
        padding: tokens.spacing.x3,
        boxSizing: 'border-box',
        transition: `transform ${tokens.transition.normal}, box-shadow ${tokens.transition.normal}, border-color ${tokens.transition.normal}`,
        ...props.style,
      }}
      onMouseEnter={(e) => {
        if (!props.interactive) return;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = hoverShadow;
        e.currentTarget.style.borderColor = hoverBorderColor;
        e.currentTarget.style.filter = hoverFilter;
      }}
      onMouseLeave={(e) => {
        if (!props.interactive) return;
        e.currentTarget.style.transform = 'translateY(0px)';
        e.currentTarget.style.boxShadow = baseShadow;
        e.currentTarget.style.borderColor = baseBorderColor;
        e.currentTarget.style.filter = baseFilter;
      }}
    >
      {props.title || props.subtitle || props.actions ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
          <div>
            {props.title ? <div style={{ fontWeight: 750, color: tokens.colors.text.primary }}>{props.title}</div> : null}
            {props.subtitle ? <div style={{ marginTop: 6, fontSize: 13, color: tokens.colors.text.secondary }}>{props.subtitle}</div> : null}
          </div>
          {props.actions ? <div style={{ flex: '0 0 auto' }}>{props.actions}</div> : null}
        </div>
      ) : null}
      {props.children}
    </div>
  );
}
