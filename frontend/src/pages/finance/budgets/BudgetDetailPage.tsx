import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { DataTable } from '../../../components/DataTable';
import { useAuth } from '../../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import { getApiErrorMessage } from '../../../services/api';
import { approveBudget, getBudget, type BudgetDetailsResponse } from '../../../services/budgets';

function toNum(v: any) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function BudgetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const canView = hasPermission(PERMISSIONS.BUDGET.VIEW);
  const canApprove = hasPermission(PERMISSIONS.BUDGET.APPROVE);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BudgetDetailsResponse | null>(null);

  const budget = data?.budget ?? null;
  const status = budget?.status ?? null;

  const isDraft = status === 'DRAFT';
  const isActive = status === 'ACTIVE';

  const totals = useMemo(() => {
    const lines = data?.lines ?? [];
    const total = lines.reduce((s, l) => s + toNum(l.amount), 0);
    return { total };
  }, [data?.lines]);

  async function refresh() {
    if (!canView) return;
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await getBudget(id);
      setData(resp);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to load budget'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, id]);

  async function onApprove() {
    if (!id) return;
    if (!canApprove) return;
    setLoading(true);
    setError(null);
    try {
      await approveBudget(id);
      await refresh();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to approve budget'));
    } finally {
      setLoading(false);
    }
  }

  if (!canView) {
    return <Alert tone="error" title="Access denied">You do not have permission to view budgets.</Alert>;
  }

  if (!id) {
    return <Alert tone="error" title="Missing budget id">No budget id was provided.</Alert>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 850 }}>Budget</div>
          <div style={{ marginTop: 6, fontSize: 13, color: 'rgba(11,12,30,0.62)' }}>
            {budget ? `${budget.fiscalYear} — ${budget.status}` : 'Loading…'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="ghost" onClick={() => navigate('/finance/budgets')} disabled={loading}>
            Back to list
          </Button>
          {isDraft && canApprove ? (
            <Button variant="accent" onClick={onApprove} disabled={loading}>
              Approve (Activate)
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <Alert tone="error" title="Error">{error}</Alert> : null}

      {isActive ? (
        <Alert tone="info" title="Read-only">ACTIVE budgets are read-only.</Alert>
      ) : isDraft ? (
        <Alert tone="info" title="Draft">Draft budget lines can be created from the “New Budget” screen.</Alert>
      ) : null}

      <Card title="Budget lines" subtitle={loading ? 'Loading…' : `${data?.lines?.length ?? 0} lines`}>
        <DataTable>
          <DataTable.Head sticky>
            <tr>
              <DataTable.Th>Account</DataTable.Th>
              <DataTable.Th>Period</DataTable.Th>
              <DataTable.Th align="right">Amount</DataTable.Th>
            </tr>
          </DataTable.Head>
          <DataTable.Body>
            {(data?.lines?.length ?? 0) === 0 ? <DataTable.Empty colSpan={3} title="No budget lines." /> : null}
            {(data?.lines ?? []).map((l, idx) => (
              <DataTable.Row key={l.id} zebra index={idx}>
                <DataTable.Td>
                  <div style={{ fontWeight: 750 }}>{l.account.code}</div>
                  <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>{l.account.name}</div>
                </DataTable.Td>
                <DataTable.Td>{l.period.name}</DataTable.Td>
                <DataTable.Td align="right">{toNum(l.amount).toFixed(2)}</DataTable.Td>
              </DataTable.Row>
            ))}
          </DataTable.Body>
        </DataTable>

        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>
          Total: {totals.total.toFixed(2)}
        </div>
      </Card>

      <Card title="Revisions" subtitle="Audit trail of budget revisions.">
        <DataTable>
          <DataTable.Head sticky>
            <tr>
              <DataTable.Th>Revision</DataTable.Th>
              <DataTable.Th>Created</DataTable.Th>
            </tr>
          </DataTable.Head>
          <DataTable.Body>
            {(data?.revisions?.length ?? 0) === 0 ? <DataTable.Empty colSpan={2} title="No revisions found." /> : null}
            {(data?.revisions ?? []).map((r, idx) => (
              <DataTable.Row key={r.id} zebra index={idx}>
                <DataTable.Td>#{r.revisionNo}</DataTable.Td>
                <DataTable.Td>
                  <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>{new Date(r.createdAt).toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>{r.createdBy.email}</div>
                </DataTable.Td>
              </DataTable.Row>
            ))}
          </DataTable.Body>
        </DataTable>
      </Card>
    </div>
  );
}
