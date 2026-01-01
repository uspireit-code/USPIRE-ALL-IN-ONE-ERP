import type React from 'react';
import { Card } from './Card';
import { tokens } from '../designTokens';

export function KpiTile(props: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  secondary?: React.ReactNode;
  emphasizeValue?: boolean;
  footer?: React.ReactNode;
  accentColor?: string;
  backgroundColor?: string;
  onDark?: boolean;
  borderColor?: string;
  hoverGlowColor?: string;
  style?: React.CSSProperties;
}) {
  const titleColor = 'rgba(255,255,255,0.70)';
  const valueColor = '#FFFFFF';
  const metaColor = 'rgba(255,255,255,0.75)';
  const decorativeIconColor = 'rgba(255,255,255,0.30)';
  const baseShadow = `0 1px 2px rgba(11,12,30,0.10), 0 14px 30px rgba(11,12,30,0.14)`;
  const hoverShadow = `0 2px 4px rgba(11,12,30,0.12), 0 18px 40px rgba(11,12,30,0.20)`;
  const background = props.backgroundColor ?? tokens.colors.white;

  return (
    <Card
      interactive
      baseShadow={baseShadow}
      hoverShadow={hoverShadow}
      baseBorderColor="transparent"
      hoverBorderColor="transparent"
      baseFilter="none"
      hoverFilter="brightness(1.04)"
      style={{
        minHeight: 176,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRadius: tokens.radius.md,
        padding: 32,
        background,
        ...props.style,
      }}
    >
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 12, color: titleColor, fontWeight: 650, letterSpacing: 0.7, textTransform: 'uppercase' }}>{props.label}</div>

        {props.icon ? (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              color: decorativeIconColor,
              display: 'inline-flex',
              pointerEvents: 'none',
            }}
          >
            {props.icon}
          </div>
        ) : null}

        <div
          style={{
            marginTop: 12,
            fontSize: 34,
            lineHeight: '40px',
            fontWeight: 850,
            letterSpacing: -0.3,
            color: valueColor,
          }}
        >
          {props.value}
        </div>

        {props.secondary ? <div style={{ marginTop: 16, fontSize: 12, color: metaColor }}>{props.secondary}</div> : null}
      </div>

      {props.footer ? <div style={{ marginTop: 20, fontSize: 12, color: valueColor }}>{props.footer}</div> : null}
    </Card>
  );
}
