import { Component, type ErrorInfo, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { Alert } from '../../../components/Alert';
import { DataTable } from '../../../components/DataTable';
import { tokens } from '../../../designTokens';
import { getApiErrorMessage } from '../../../services/api';
import { listJournals, type JournalEntry, type JournalStatus } from '../../../services/gl';

function StatusBadge(props: { status: JournalStatus }) {
  const label = statusLabel(props.status);
  const bg =
    props.status === 'POSTED'
      ? '#e7f6ec'
      : props.status === 'REVIEWED'
        ? '#e0f2fe'
        : props.status === 'REJECTED'
          ? '#fee2e2'
        : props.status === 'SUBMITTED'
        ? '#fff7ed'
        : tokens.colors.surface.subtle;
  const color =
    props.status === 'POSTED'
      ? '#166534'
      : props.status === 'REVIEWED'
        ? '#075985'
        : props.status === 'REJECTED'
          ? '#991b1b'
        : props.status === 'SUBMITTED'
        ? '#9a3412'
        : tokens.colors.text.primary;

  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, background: bg, color, fontSize: 12, fontWeight: 750 }}>
      {label}
    </span>
  );
}

function statusLabel(s: JournalStatus) {
  if (s === 'DRAFT') return 'Draft';
  if (s === 'PARKED') return 'Submitted for Review';
  if (s === 'SUBMITTED') return 'Submitted for Review';
  if (s === 'REVIEWED') return 'Approved (Pending Posting)';
  if (s === 'REJECTED') return 'Rejected';
  if (s === 'POSTED') return 'Posted';
  return s;
}

function formatJournalLabel(j: Pick<JournalEntry, 'journalNumber' | 'id'>) {
  if (typeof j.journalNumber === 'number') return `J${String(j.journalNumber).padStart(6, '0')}`;
  return j.id.slice(0, 8);
}

class PageErrorBoundary extends Component<
  { children: React.ReactNode },
  { errorMessage: string | null }
> {
  state: { errorMessage: string | null } = { errorMessage: null };

  static getDerivedStateFromError(error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { errorMessage: msg || 'Unexpected error' };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('JournalsListPage render error', error, info);
  }

  render() {
    if (this.state.errorMessage) {
      return (
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h2>Journals</h2>
          </div>
          <div style={{ marginTop: 14 }}>
            <Alert tone="error" title="Error">
              {this.state.errorMessage}
            </Alert>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function JournalsListPage() {
  const { state, hasPermission } = useAuth();
  const authLoading = Boolean(state.isAuthenticated) && !state.me;
  const canView = hasPermission('FINANCE_GL_VIEW') || hasPermission('gl.journal.view');
  const canCreate = hasPermission('FINANCE_GL_CREATE') || hasPermission('gl.journal.create');

  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = useMemo(() => {
    const v = searchParams.get('status');
    return (v as JournalStatus | 'ALL') ?? 'ALL';
  }, [searchParams]);

  const [statusFilter, setStatusFilter] = useState<JournalStatus | 'ALL'>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<JournalEntry[]>([]);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const list = await listJournals({
        limit: 100,
        offset: 0,
        ...(statusFilter === 'ALL' ? {} : { status: statusFilter }),
      } as any);
      const items = Array.isArray((list as any)?.items) ? (list as any).items : [];
      setRows(items);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to load journals'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!canView) return;
    setSearchParams(statusFilter === 'ALL' ? {} : { status: statusFilter });
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canView, statusFilter]);

  const content = authLoading ? (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2>Journals</h2>
      </div>
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', color: tokens.colors.text.muted }}>
        Loading…
      </div>
    </div>
  ) : !canView ? (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2>Journals</h2>
      </div>
      <div style={{ marginTop: 14 }}>
        <Alert tone="error" title="Access Denied">
          You do not have permission to view Journals.
        </Alert>
      </div>
    </div>
  ) : (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2>Journals</h2>
        {canCreate ? (
          <Link to="/finance/gl/journals/new">New Journal</Link>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        <label>
          Status:{' '}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="ALL">ALL</option>
            <option value="DRAFT">{statusLabel('DRAFT')}</option>
            <option value="SUBMITTED">{statusLabel('SUBMITTED')}</option>
            <option value="REVIEWED">{statusLabel('REVIEWED')}</option>
            <option value="REJECTED">{statusLabel('REJECTED')}</option>
            <option value="POSTED">{statusLabel('POSTED')}</option>
          </select>
        </label>

        <button onClick={refresh} disabled={loading}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', color: tokens.colors.text.muted }}>
          Loading…
        </div>
      ) : error ? (
        <div style={{ marginTop: 14 }}>
          <Alert tone="error" title="Error">
            {error}
          </Alert>
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div style={{ marginTop: 12, color: tokens.colors.text.muted }}>No journals found.</div>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <DataTable style={{ marginTop: 12 }}>
          <DataTable.Head>
            <tr>
              <DataTable.Th>Journal</DataTable.Th>
              <DataTable.Th>Date</DataTable.Th>
              <DataTable.Th>Type</DataTable.Th>
              <DataTable.Th>Reference</DataTable.Th>
              <DataTable.Th>Description</DataTable.Th>
              <DataTable.Th>Status</DataTable.Th>
            </tr>
          </DataTable.Head>
          <DataTable.Body>
            {(rows ?? []).map((j, idx) => (
              <DataTable.Row key={j.id} zebra index={idx}>
                <DataTable.Td>
                  <Link to={`/finance/gl/journals/${j.id}`}>{formatJournalLabel(j)}</Link>
                </DataTable.Td>
                <DataTable.Td>{j.journalDate.slice(0, 10)}</DataTable.Td>
                <DataTable.Td>{j.journalType ?? 'STANDARD'}</DataTable.Td>
                <DataTable.Td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {j.reference ?? ''}
                </DataTable.Td>
                <DataTable.Td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {j.description ?? ''}
                </DataTable.Td>
                <DataTable.Td>
                  <StatusBadge status={j.status} />
                </DataTable.Td>
              </DataTable.Row>
            ))}
          </DataTable.Body>
        </DataTable>
      ) : null}
    </div>
  );

  return <PageErrorBoundary>{content}</PageErrorBoundary>;
}
