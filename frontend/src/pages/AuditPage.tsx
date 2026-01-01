import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { PageLayout } from '../components/PageLayout';
import type { ApiError } from '../services/api';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { DataTable } from '../components/DataTable';
import {
  listAuditEvents,
  type AuditEntityType,
  type AuditEventRow,
  type AuditEventType,
  type AuditEventsResponse,
} from '../services/audit';

export function AuditPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('AUDIT_VIEW');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [data, setData] = useState<AuditEventsResponse | null>(null);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [eventType, setEventType] = useState<'' | AuditEventType>('');
  const [entityType, setEntityType] = useState<'' | AuditEntityType>('');
  const [userId, setUserId] = useState('');

  const errBody = (error as ApiError | any)?.body;

  const rows = useMemo<AuditEventRow[]>(() => data?.rows ?? [], [data?.rows]);

  async function load(params?: { offset?: number }) {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await listAuditEvents({
        from: from || undefined,
        to: to || undefined,
        eventType: eventType || undefined,
        entityType: entityType || undefined,
        userId: userId || undefined,
        offset: params?.offset ?? data?.offset ?? 0,
        limit: data?.limit ?? 100,
      });
      setData(resp);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load({ offset: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!canView) {
    return <div>You do not have permission to view audit events.</div>;
  }

  return (
    <PageLayout title="Audit Trail" description="Read-only. Audit data is append-only.">
      <Card title="Filters" subtitle="Narrow down audit events." style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />

          <select value={eventType} onChange={(e) => setEventType((e.target.value || '') as any)}>
            <option value="">All event types</option>
            <option value="JOURNAL_POST">Journal post</option>
            <option value="PERIOD_CHECKLIST_COMPLETE">Period checklist complete</option>
            <option value="PERIOD_CLOSE">Period close</option>
            <option value="SOD_VIOLATION">SoD violation</option>
            <option value="AP_POST">AP post</option>
            <option value="AR_POST">AR post</option>
            <option value="FA_CAPITALIZE">FA capitalize</option>
            <option value="FA_DEPRECIATION_RUN">FA depreciation run</option>
            <option value="FA_DISPOSE">FA dispose</option>
            <option value="BANK_RECONCILIATION_MATCH">Bank reconciliation match</option>
          </select>

          <select value={entityType} onChange={(e) => setEntityType((e.target.value || '') as any)}>
            <option value="">All entity types</option>
            <option value="JOURNAL_ENTRY">Journal entry</option>
            <option value="ACCOUNTING_PERIOD">Accounting period</option>
            <option value="ACCOUNTING_PERIOD_CHECKLIST_ITEM">Period checklist item</option>
            <option value="SUPPLIER_INVOICE">Supplier invoice</option>
            <option value="CUSTOMER_INVOICE">Customer invoice</option>
            <option value="FIXED_ASSET">Fixed asset</option>
            <option value="FIXED_ASSET_DEPRECIATION_RUN">FA depreciation run</option>
            <option value="BANK_RECONCILIATION_MATCH">Bank reconciliation match</option>
            <option value="USER">User</option>
          </select>

          <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID (optional)" />
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button onClick={() => load({ offset: 0 })} disabled={loading} variant="primary">
            {loading ? 'Loading…' : 'Apply filters'}
          </Button>
          <Button
            onClick={() => {
              setFrom('');
              setTo('');
              setEventType('');
              setEntityType('');
              setUserId('');
              setData(null);
              void load({ offset: 0 });
            }}
            disabled={loading}
            variant="secondary"
          >
            Clear
          </Button>
        </div>
      </Card>

      {error ? (
        <div style={{ marginTop: 16 }}>
          <Alert tone="error" title="Failed to load audit events">
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(errBody ?? error, null, 2)}</pre>
          </Alert>
        </div>
      ) : null}

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>
          Showing {rows.length} of {data?.total ?? 0}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            variant="secondary"
            size="sm"
            disabled={!data || (data?.offset ?? 0) <= 0 || loading}
            onClick={() => load({ offset: Math.max(0, (data?.offset ?? 0) - (data?.limit ?? 100)) })}
          >
            Prev
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!data || loading || (data ? data.offset + data.limit >= data.total : true)}
            onClick={() => load({ offset: (data?.offset ?? 0) + (data?.limit ?? 100) })}
          >
            Next
          </Button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <DataTable>
          <DataTable.Head sticky>
            <tr>
              <DataTable.Th>Time</DataTable.Th>
              <DataTable.Th>Outcome</DataTable.Th>
              <DataTable.Th>Event</DataTable.Th>
              <DataTable.Th>Entity</DataTable.Th>
              <DataTable.Th>Action</DataTable.Th>
              <DataTable.Th>User</DataTable.Th>
              <DataTable.Th>Reason</DataTable.Th>
            </tr>
          </DataTable.Head>
          <DataTable.Body>
            {rows.map((r, idx) => (
              <DataTable.Row key={r.id} zebra index={idx}>
                <DataTable.Td>{String(r.createdAt)}</DataTable.Td>
                <DataTable.Td>{r.outcome}</DataTable.Td>
                <DataTable.Td>{r.eventType}</DataTable.Td>
                <DataTable.Td>
                  <div style={{ fontWeight: 700 }}>{r.entityType}</div>
                  <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>{r.entityId}</div>
                </DataTable.Td>
                <DataTable.Td>
                  <div>{r.action}</div>
                  {r.permissionUsed ? <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>perm: {r.permissionUsed}</div> : null}
                </DataTable.Td>
                <DataTable.Td>{r.user?.email ?? r.user?.id ?? '-'}</DataTable.Td>
                <DataTable.Td>{r.reason ?? '-'}</DataTable.Td>
              </DataTable.Row>
            ))}
          </DataTable.Body>
        </DataTable>
      </div>
    </PageLayout>
  );
}
