import type React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../Button';

export function SettingsPageHeader(props: {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/settings')}
          style={{ marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <ArrowLeft size={16} />
          Back to Settings
        </Button>

        <div style={{ fontSize: 22, fontWeight: 750, color: '#0B0C1E' }}>{props.title}</div>
        {props.subtitle ? (
          <div style={{ marginTop: 10, fontSize: 13, color: 'rgba(11,12,30,0.62)', lineHeight: '18px', maxWidth: 820 }}>
            {props.subtitle}
          </div>
        ) : null}
      </div>

      {props.rightSlot ? <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>{props.rightSlot}</div> : null}
    </div>
  );
}
