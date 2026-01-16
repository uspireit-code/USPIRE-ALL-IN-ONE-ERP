import React from 'react';

type CrashBoundaryState = {
  hasError: boolean;
  error?: unknown;
  componentStack?: string;
};

export class CrashBoundary extends React.Component<{ children: React.ReactNode }, CrashBoundaryState> {
  state: CrashBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown): CrashBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[CrashBoundary]', { error, componentStack: info.componentStack });
    }

    this.setState({ componentStack: info.componentStack ?? undefined });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const message =
      typeof (this.state.error as any)?.message === 'string'
        ? ((this.state.error as any).message as string)
        : typeof this.state.error === 'string'
          ? this.state.error
          : '';

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          boxSizing: 'border-box',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div style={{ maxWidth: 640, width: '100%' }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Something went wrong.</div>
          <div style={{ marginTop: 10, opacity: 0.85 }}>Reload or contact admin.</div>
          {import.meta.env.DEV ? (
            <div style={{ marginTop: 14, fontSize: 12, opacity: 0.9, whiteSpace: 'pre-wrap' }}>
              {message ? `Error: ${message}\n\n` : null}
              {this.state.componentStack ? `Component stack:\n${this.state.componentStack}` : null}
            </div>
          ) : null}
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: '1px solid rgba(0,0,0,0.14)',
                borderRadius: 10,
                padding: '10px 14px',
                background: 'white',
                cursor: 'pointer',
                fontWeight: 650,
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
