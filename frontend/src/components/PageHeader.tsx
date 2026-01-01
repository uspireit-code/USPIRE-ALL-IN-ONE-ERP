import type React from 'react';

export function PageHeader(props: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 600, lineHeight: '28px', color: '#0B0C1E' }}>{props.title}</div>
        {props.description ? (
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: '18px', color: 'rgba(11,12,30,0.65)' }}>{props.description}</div>
        ) : null}
      </div>
      {props.actions ? <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{props.actions}</div> : null}
    </div>
  );
}
