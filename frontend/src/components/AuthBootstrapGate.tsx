import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { DelegationSelectorModal } from './DelegationSelectorModal';

export function AuthBootstrapGate(props: { children: React.ReactNode }) {
  const { state, logout, activateDelegation } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  const delegationChoice = (localStorage.getItem('delegationChoice') ?? '').trim();
  const hasAvailableDelegations = (state.availableDelegations ?? []).length > 0;
  const isDelegationActive = Boolean(state.delegation?.delegationId);
  const mustChooseDelegation =
    Boolean(state.isAuthenticated && state.me) &&
    hasAvailableDelegations &&
    !isDelegationActive &&
    delegationChoice !== 'self';

  useEffect(() => {
    if (!state.isAuthenticated) return;
    if (state.me) return;

    setTimedOut(false);
    const t = window.setTimeout(() => setTimedOut(true), 10_000);
    return () => window.clearTimeout(t);
  }, [state.isAuthenticated, state.me]);

  if (state.isBootstrapping) return <div>Loading...</div>;

  if (!state.isAuthenticated) return <Navigate to="/login" replace />;

  if (!state.me) {
    if (!timedOut) return <div>Loading...</div>;

    return (
      <div>
        <div style={{ fontWeight: 750, fontSize: 16 }}>Session could not load.</div>
        <div style={{ marginTop: 8, opacity: 0.85 }}>Please re-login.</div>
        <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => {
              void (async () => {
                await logout();
                window.location.href = '/login?reason=session';
              })();
            }}
            style={{
              border: '1px solid rgba(0,0,0,0.14)',
              borderRadius: 10,
              padding: '10px 14px',
              background: 'white',
              cursor: 'pointer',
              fontWeight: 650,
            }}
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }

  if (mustChooseDelegation) {
    return (
      <>
        <DelegationSelectorModal
          open
          delegations={(state.availableDelegations ?? []) as any}
          onContinueSelf={() => {
            localStorage.setItem('delegationChoice', 'self');
          }}
          onActivate={async (params) => {
            localStorage.removeItem('delegationChoice');
            await activateDelegation(params);
          }}
        />
        <div />
      </>
    );
  }

  return <>{props.children}</>;
}
