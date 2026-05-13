import { useEffect, useMemo, useState } from 'react';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { tokens } from '../designTokens';

type ActivityEvent = {
  id: string;
  at: string;
  action: string;
  actor: string;
  ip?: string;
  outcome: 'SUCCESS' | 'WARNING' | 'FAILURE';
  detail?: string;
};

function mockEvents(): ActivityEvent[] {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();

  return [
    {
      id: 'evt_1',
      at: iso(new Date(now.getTime() - 10 * 60 * 1000)),
      action: 'Login',
      actor: 'You',
      ip: '102.134.18.23',
      outcome: 'SUCCESS',
      detail: 'Signed in with password',
    },
    {
      id: 'evt_2',
      at: iso(new Date(now.getTime() - 2 * 60 * 60 * 1000)),
      action: 'Profile Updated',
      actor: 'You',
      outcome: 'SUCCESS',
      detail: 'Updated personal information',
    },
    {
      id: 'evt_3',
      at: iso(new Date(now.getTime() - 7 * 60 * 60 * 1000)),
      action: 'Password Change',
      actor: 'You',
      outcome: 'SUCCESS',
      detail: 'Password changed',
    },
    {
      id: 'evt_4',
      at: iso(new Date(now.getTime() - 30 * 60 * 60 * 1000)),
      action: 'Login',
      actor: 'You',
      ip: '41.77.11.9',
      outcome: 'WARNING',
      detail: 'New device detected',
    },
  ];
}

export function ActivityLogPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = mockEvents();
        if (!mounted) return;
        setEvents(data);
      } catch {
        if (!mounted) return;
        setError('Failed to load activity log');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const rows = useMemo(() => {
    return events
      .slice()
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .map((e) => ({
        ...e,
        atLocal: new Date(e.at).toLocaleString(),
      }));
  }, [events]);

  return (
    <div style={{ display: 'grid', gap: tokens.spacing.x3 }}>
      <PageHeader
        title="Activity Log"
        description="Review recent security and account events."
        actions={
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => {
              setEvents(mockEvents());
            }}
          >
            Refresh
          </Button>
        }
      />

      {error ? <Alert tone="error" title={error} /> : null}

      <Card title="Recent Activity" subtitle="Latest events for your user.">
        {loading ? (
          <div style={{ padding: 12, color: tokens.colors.text.secondary }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 12, color: tokens.colors.text.secondary }}>No recent activity.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Action</Th>
                  <Th>Outcome</Th>
                  <Th>IP</Th>
                  <Th>Detail</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td>{r.atLocal}</Td>
                    <Td>{r.action}</Td>
                    <Td>
                      <OutcomeBadge outcome={r.outcome} />
                    </Td>
                    <Td>{r.ip ?? '—'}</Td>
                    <Td>{r.detail ?? '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Th(props: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: 'left',
        fontSize: 12,
        fontWeight: 800,
        color: tokens.colors.text.secondary,
        padding: 12,
        borderBottom: `1px solid ${tokens.colors.border.subtle}`,
        whiteSpace: 'nowrap',
      }}
    >
      {props.children}
    </th>
  );
}

function Td(props: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: 12,
        borderBottom: `1px solid ${tokens.colors.border.subtle}`,
        fontSize: 13,
        color: tokens.colors.text.primary,
        verticalAlign: 'top',
      }}
    >
      {props.children}
    </td>
  );
}

function OutcomeBadge(props: { outcome: ActivityEvent['outcome'] }) {
  const styles: Record<ActivityEvent['outcome'], { bg: string; border: string; text: string }> = {
    SUCCESS: {
      bg: tokens.colors.status.successBg,
      border: tokens.colors.status.successBorder,
      text: 'rgba(5, 120, 84, 1)',
    },
    WARNING: {
      bg: tokens.colors.status.warningBg,
      border: tokens.colors.status.warningBorder,
      text: 'rgba(146, 64, 14, 1)',
    },
    FAILURE: {
      bg: tokens.colors.status.errorBg,
      border: tokens.colors.status.errorBorder,
      text: 'rgba(185, 28, 28, 1)',
    },
  };

  const s = styles[props.outcome];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 999,
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {props.outcome}
    </span>
  );
}
