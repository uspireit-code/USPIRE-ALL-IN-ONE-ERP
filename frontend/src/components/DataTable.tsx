import type React from 'react';
import { tokens } from '../designTokens';

export function DataTable(props: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ width: '100%', overflowX: 'auto', ...props.style }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, borderRadius: tokens.radius.md, overflow: 'hidden' }}>{props.children}</table>
    </div>
  );
}

DataTable.Head = function DataTableHead(props: { children: React.ReactNode; sticky?: boolean }) {
  return (
    <thead
      style={
        props.sticky
          ? {
              position: 'sticky',
              top: 0,
              zIndex: 1,
            }
          : undefined
      }
    >
      {props.children}
    </thead>
  );
};

DataTable.Body = function DataTableBody(props: { children: React.ReactNode }) {
  return <tbody>{props.children}</tbody>;
};

DataTable.Foot = function DataTableFoot(props: { children: React.ReactNode }) {
  return <tfoot>{props.children}</tfoot>;
};

DataTable.Row = function DataTableRow(props: {
  children: React.ReactNode;
  zebra?: boolean;
  index?: number;
  hoverable?: boolean;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLTableRowElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLTableRowElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLTableRowElement>;
}) {
  const zebraBg = props.zebra && typeof props.index === 'number' && props.index % 2 === 1 ? tokens.colors.surface.subtle : 'transparent';
  const hoverBg = tokens.colors.surface.goldHover;
  const hoverable = props.hoverable ?? true;
  return (
    <tr
      style={{ background: zebraBg, transition: `background-color ${tokens.transition.normal}`, ...props.style }}
      onClick={props.onClick}
      onMouseEnter={(e) => {
        if (!hoverable) return;
        e.currentTarget.style.backgroundColor = hoverBg;
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (!hoverable) return;
        e.currentTarget.style.backgroundColor = zebraBg;
        props.onMouseLeave?.(e);
      }}
    >
      {props.children}
    </tr>
  );
};

DataTable.Th = function DataTableTh(props: { children: React.ReactNode; align?: 'left' | 'right' | 'center'; style?: React.CSSProperties }) {
  return (
    <th
      style={{
        textAlign: props.align ?? 'left',
        padding: `${tokens.spacing.x2 - 2}px ${tokens.spacing.x2 - 2}px`,
        fontSize: 12,
        fontWeight: 750,
        letterSpacing: 0.2,
        color: tokens.colors.text.primary,
        borderBottom: `1px solid ${tokens.colors.border.subtle}`,
        background: tokens.colors.surface.subtle,
        whiteSpace: 'nowrap',
        ...props.style,
      }}
    >
      {props.children}
    </th>
  );
};

DataTable.Td = function DataTableTd(props: { children: React.ReactNode; align?: 'left' | 'right' | 'center'; style?: React.CSSProperties }) {
  return (
    <td
      style={{
        textAlign: props.align ?? 'left',
        padding: `${tokens.spacing.x2 - 2}px ${tokens.spacing.x2 - 2}px`,
        borderBottom: `1px solid ${tokens.colors.border.subtle}`,
        verticalAlign: 'middle',
        color: tokens.colors.text.primary,
        ...props.style,
      }}
    >
      {props.children}
    </td>
  );
};

DataTable.Empty = function DataTableEmpty(props: { colSpan: number; title: string; action?: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={props.colSpan} style={{ padding: '20px 12px' }}>
        <div style={{ padding: tokens.spacing.x2, borderRadius: tokens.radius.md, background: tokens.colors.surface.subtle, border: `1px solid ${tokens.colors.border.subtle}` }}>
          <div style={{ fontWeight: 750, color: tokens.colors.text.primary }}>{props.title}</div>
          {props.action ? <div style={{ marginTop: 8 }}>{props.action}</div> : null}
        </div>
      </td>
    </tr>
  );
};
