import { tokens } from '../designTokens';

export function ComingSoonPage(props: { title: string; description: string }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 750, color: tokens.colors.text.primary }}>{props.title}</div>
        <div
          style={{
            padding: '6px 10px',
            borderRadius: 999,
            background: tokens.colors.surface.subtle,
            border: `1px solid ${tokens.colors.border.subtle}`,
            fontSize: 12,
            fontWeight: 750,
            color: tokens.colors.text.secondary,
            whiteSpace: 'nowrap',
          }}
        >
          Not yet implemented
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 13, color: tokens.colors.text.secondary, lineHeight: '18px', maxWidth: 880 }}>
        {props.description}
      </div>
    </div>
  );
}
