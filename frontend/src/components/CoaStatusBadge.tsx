import { tokens } from '../designTokens';
import type { CoaLifecycleStatus } from '../services/coa';

export function CoaStatusBadge(props: { status?: CoaLifecycleStatus | null }) {
  const s = (props.status ?? 'DRAFT') as CoaLifecycleStatus;

  const bg =
    s === 'ACTIVE'
      ? '#e7f6ec'
      : s === 'DRAFT'
        ? '#fff7ed'
        : s === 'BLOCKED'
          ? '#fee2e2'
          : '#f1f5f9';

  const color =
    s === 'ACTIVE'
      ? '#166534'
      : s === 'DRAFT'
        ? '#9a3412'
        : s === 'BLOCKED'
          ? '#991b1b'
          : tokens.colors.text.secondary;

  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 999,
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 750,
        letterSpacing: 0.2,
      }}
    >
      {s}
    </span>
  );
}
