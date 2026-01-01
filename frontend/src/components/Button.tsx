import type React from 'react';
import { tokens } from '../designTokens';

export function Button(props: {
  variant?: 'primary' | 'secondary' | 'accent' | 'destructive' | 'ghost';
  size?: 'sm' | 'md';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const variant = props.variant ?? 'secondary';
  const size = props.size ?? 'md';

  const padding = size === 'sm' ? '8px 12px' : '10px 14px';
  const fontSize = size === 'sm' ? 13 : 14;

  const base: React.CSSProperties = {
    borderRadius: tokens.radius.sm,
    padding,
    fontSize,
    fontWeight: 650,
    fontFamily: 'inherit',
    cursor: props.disabled ? 'not-allowed' : 'pointer',
    transition: `transform ${tokens.transition.normal}, box-shadow ${tokens.transition.normal}, background-color ${tokens.transition.normal}, border-color ${tokens.transition.normal}, color ${tokens.transition.normal}, opacity ${tokens.transition.normal}`,
    boxShadow: 'none',
    outline: 'none',
    opacity: props.disabled ? 0.55 : 1,
  };

  const styleByVariant: Record<string, React.CSSProperties> = {
    primary: {
      background: tokens.colors.navy,
      color: tokens.colors.text.inverse,
      border: `1px solid ${tokens.colors.border.subtle}`,
    },
    secondary: {
      background: tokens.colors.white,
      color: tokens.colors.text.primary,
      border: `1px solid ${tokens.colors.border.default}`,
    },
    accent: {
      background: tokens.colors.gold,
      color: tokens.colors.navy,
      border: `1px solid rgba(237,186,53,0.40)`,
    },
    destructive: {
      background: 'rgba(239,68,68,0.10)',
      color: tokens.colors.text.primary,
      border: `1px solid rgba(239,68,68,0.22)`,
    },
    ghost: {
      background: 'transparent',
      color: tokens.colors.text.primary,
      border: '1px solid transparent',
    },
  };

  const hoverByVariant: Record<string, React.CSSProperties> = {
    primary: {
      background: 'rgba(11,12,30,0.92)',
      boxShadow: tokens.shadow.buttonHover,
      transform: 'translateY(-1px)',
    },
    secondary: {
      background: tokens.colors.surface.subtle,
      border: `1px solid ${tokens.colors.border.strong}`,
      boxShadow: tokens.shadow.buttonHover,
      transform: 'translateY(-1px)',
    },
    accent: {
      background: 'rgba(237,186,53,0.92)',
      boxShadow: tokens.shadow.buttonHover,
      transform: 'translateY(-1px)',
    },
    destructive: {
      background: 'rgba(239,68,68,0.14)',
      boxShadow: tokens.shadow.buttonHover,
      transform: 'translateY(-1px)',
    },
    ghost: {
      background: tokens.colors.surface.hover,
    },
  };

  return (
    <button
      type={props.type ?? 'button'}
      disabled={props.disabled}
      onClick={props.onClick}
      title={props.title}
      style={{
        ...base,
        ...styleByVariant[variant],
        ...props.style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = tokens.focusRing.ring;
        e.currentTarget.style.borderColor = tokens.focusRing.borderColor;
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = (styleByVariant[variant]?.border as string) || 'transparent';
      }}
      onMouseEnter={(e) => {
        if (props.disabled) return;
        Object.assign(e.currentTarget.style, hoverByVariant[variant]);
      }}
      onMouseLeave={(e) => {
        if (props.disabled) return;
        Object.assign(e.currentTarget.style, styleByVariant[variant]);
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0px)';
      }}
    >
      {props.children}
    </button>
  );
}
