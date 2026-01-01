import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { Alert } from '../../../components/Alert';
import { DataTable } from '../../../components/DataTable';
import { tokens } from '../../../designTokens';
import { getApiErrorMessage } from '../../../services/api';
import { listRecurringTemplates, type RecurringJournalTemplate } from '../../../services/glRecurring.ts';

function formatDate(iso: string) {
  return iso ? iso.slice(0, 10) : '';
}

export function RecurringTemplatesPage() {
  const navigate = useNavigate();
  const { state, hasPermission } = useAuth();
  const authLoading = Boolean(state.isAuthenticated) && !state.me;

  const canManage = hasPermission('FINANCE_GL_RECURRING_MANAGE');
  const canGenerate = hasPermission('FINANCE_GL_RECURRING_GENERATE');
  const canAccess = canManage || canGenerate;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<RecurringJournalTemplate[]>([]);

  async function refresh() {
    if (!canAccess) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listRecurringTemplates();
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to load recurring templates'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canAccess]);

  const rows = useMemo(() => {
    return items.map((t) => ({
      ...t,
      statusLabel: t.isActive ? 'Active' : 'Inactive',
    }));
  }, [items]);

  if (authLoading) {
    return <div style={{ marginTop: 12, color: tokens.colors.text.muted }}>Loading…</div>;
  }

  if (!canAccess) {
    return (
      <div>
        <h2>Recurring Journals</h2>
        <div style={{ marginTop: 14 }}>
          <Alert tone="error" title="Access Denied">
            You do not have permission to access Recurring Journals.
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2>Recurring Journal Templates</h2>
          <div style={{ marginTop: 6, fontSize: 13, color: tokens.colors.text.muted }}>
            Define templates and generate journals without bypassing approval controls.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={refresh} disabled={loading}>
            Refresh
          </button>
          {canManage ? (
            <button onClick={() => navigate('/finance/gl/recurring/new')}>New Template</button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 14 }}>
          <Alert tone="error" title="Error">
            {error}
          </Alert>
        </div>
      ) : null}

      {loading ? (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', color: tokens.colors.text.muted }}>Loading…</div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div style={{ marginTop: 12, color: tokens.colors.text.muted }}>No templates yet.</div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <DataTable style={{ marginTop: 12 }}>
          <DataTable.Head>
            <tr>
              <DataTable.Th>Name</DataTable.Th>
              <DataTable.Th>Frequency</DataTable.Th>
              <DataTable.Th>Next Run Date</DataTable.Th>
              <DataTable.Th>Status</DataTable.Th>
              <DataTable.Th align="right">Actions</DataTable.Th>
            </tr>
          </DataTable.Head>
          <DataTable.Body>
            {rows.map((t, idx) => (
              <DataTable.Row key={t.id} zebra index={idx}>
                <DataTable.Td>
                  <div style={{ fontWeight: 750 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>{t.referenceTemplate}</div>
                </DataTable.Td>
                <DataTable.Td>{t.frequency}</DataTable.Td>
                <DataTable.Td>{formatDate(t.nextRunDate)}</DataTable.Td>
                <DataTable.Td>{t.isActive ? 'Active' : 'Inactive'}</DataTable.Td>
                <DataTable.Td align="right">
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button onClick={() => navigate(`/finance/gl/recurring/${t.id}`)} style={{ fontSize: 12 }}>
                      {canManage ? 'Edit' : 'View'}
                    </button>
                    {canGenerate ? (
                      <button
                        onClick={() => navigate(`/finance/gl/recurring/${t.id}/generate`)}
                        disabled={!t.isActive}
                        style={{ fontSize: 12, fontWeight: 750 }}
                      >
                        Generate
                      </button>
                    ) : null}
                  </div>
                </DataTable.Td>
              </DataTable.Row>
            ))}
          </DataTable.Body>
        </DataTable>
      ) : null}

      <div style={{ marginTop: 10 }}>
        <Link to="/finance/gl/journals">Back to Journals</Link>
      </div>
    </div>
  );
}
