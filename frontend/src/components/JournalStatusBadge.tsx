import { tokens } from '../designTokens';
import type { JournalStatus } from '../services/gl';

export function JournalStatusBadge(props: { status: JournalStatus }) {
  const bg =
    props.status === 'POSTED'
      ? '#e7f6ec'
      : props.status === 'REVIEWED'
        ? '#e0f2fe'
        : props.status === 'SUBMITTED'
          ? '#fff7ed'
          : tokens.colors.surface.subtle;

  const color =
    props.status === 'POSTED'
      ? '#166534'
      : props.status === 'REVIEWED'
        ? '#075985'
        : props.status === 'SUBMITTED'
          ? '#9a3412'
          : tokens.colors.text.primary;

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
      {props.status}
    </span>
  );
}
