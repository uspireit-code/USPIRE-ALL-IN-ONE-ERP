import { useMemo, useState } from 'react';
import { Button } from './Button';
import { tokens } from '../designTokens';

export type AvailableDelegation = {
  id: string;
  scope: 'APPROVE' | 'POST' | 'BOTH';
  startsAt: string;
  expiresAt: string;
  actingAsUserId?: string;
  actingAsUserName?: string;
  actingAsUserJobTitle?: string;
  actingAsUserEmail?: string;
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

export function DelegationSelectorModal(props: {
  open: boolean;
  delegations: AvailableDelegation[];
  onContinueSelf: () => void;
  onActivate: (params: { delegationId: string; actingAsUserName?: string }) => Promise<void>;
}) {
  const [mode, setMode] = useState<'SELF' | 'DELEGATED' | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => props.delegations.find((d) => String(d.id) === String(selectedId)) ?? null,
    [props.delegations, selectedId],
  );

  if (!props.open) return null;

  async function handleActivate() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      await props.onActivate({ delegationId: selected.id, actingAsUserName: selected.actingAsUserName });
    } catch {
      setError('Delegation could not be activated. Please contact your System Administrator.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center' }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 520,
          margin: 16,
          background: tokens.colors.white,
          borderRadius: 14,
          border: `1px solid ${tokens.colors.border.subtle}`,
          boxShadow: '0 18px 60px rgba(0,0,0,0.28)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${tokens.colors.border.subtle}` }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: tokens.colors.text.primary }}>Select Login Mode</div>
          <div style={{ marginTop: 6, fontSize: 12.5, color: tokens.colors.text.secondary, lineHeight: 1.45 }}>
            Delegated actions are fully audited.
          </div>
        </div>

        <div style={{ padding: 18, display: 'grid', gap: 12 }}>
          {error ? (
            <div
              role="alert"
              style={{
                border: '1px solid rgba(183, 28, 28, 0.35)',
                background: 'rgba(183, 28, 28, 0.06)',
                borderRadius: 10,
                padding: '10px 12px',
                fontSize: 12.5,
                color: tokens.colors.text.primary,
                lineHeight: 1.45,
              }}
            >
              {error}
            </div>
          ) : null}

          <div style={{ display: 'grid', gap: 10 }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <input
                type="radio"
                checked={mode === 'SELF'}
                onChange={() => setMode('SELF')}
                style={{ marginTop: 3 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 850, color: tokens.colors.text.primary }}>Continue as Self</div>
                <div style={{ marginTop: 3, fontSize: 12.5, color: tokens.colors.text.secondary }}>
                  Use your own permissions.
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <input
                type="radio"
                checked={mode === 'DELEGATED'}
                onChange={() => setMode('DELEGATED')}
                style={{ marginTop: 3 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 850, color: tokens.colors.text.primary }}>Act as Delegated User</div>
                <div style={{ marginTop: 3, fontSize: 12.5, color: tokens.colors.text.secondary }}>
                  Select a delegation assignment.
                </div>

                {mode === 'DELEGATED' ? (
                  <div style={{ marginTop: 10 }}>
                    <select
                      value={selectedId}
                      onChange={(e) => setSelectedId(e.target.value)}
                      style={{
                        width: '100%',
                        height: 38,
                        borderRadius: 12,
                        border: `1px solid ${tokens.colors.border.subtle}`,
                        background: tokens.colors.white,
                        color: tokens.colors.text.primary,
                        padding: '0 12px',
                        outline: 'none',
                        fontSize: 13,
                      }}
                    >
                      <option value="">Select delegation…</option>
                      {props.delegations.map((d) => {
                        const title = d.actingAsUserJobTitle || d.actingAsUserName || d.actingAsUserEmail || 'Delegated user';
                        return (
                          <option key={d.id} value={d.id}>
                            {`${title} (${d.scope}) — Expires ${formatDate(d.expiresAt)}`}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                ) : null}
              </div>
            </label>
          </div>
        </div>

        <div
          style={{
            padding: 18,
            borderTop: `1px solid ${tokens.colors.border.subtle}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => {
              setError(null);
              setMode('SELF');
              props.onContinueSelf();
            }}
          >
            Continue as Self
          </Button>
          <Button
            type="button"
            variant="accent"
            disabled={loading || mode !== 'DELEGATED' || !selectedId}
            onClick={handleActivate}
          >
            {loading ? 'Activating…' : 'Activate Delegation'}
          </Button>
        </div>
      </div>
    </div>
  );
}
