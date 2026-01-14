import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { DataTable } from '../../../components/DataTable';
import { Input } from '../../../components/Input';
import { useAuth } from '../../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import { getApiErrorMessage } from '../../../services/api';
import { listBudgets, type BudgetListRow } from '../../../services/budgets';

export function BudgetsListPage() {
  const { hasPermission } = useAuth();

  const canView = hasPermission(PERMISSIONS.BUDGET.VIEW);
  const canCreate = hasPermission(PERMISSIONS.BUDGET.CREATE);

  const [fiscalYear, setFiscalYear] = useState<number>(() => new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<BudgetListRow[]>([]);

  const activeBudget = useMemo(() => rows.find((b) => b.status === 'ACTIVE') ?? null, [rows]);

  async function refresh() {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listBudgets({ fiscalYear });
      setRows(data);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to load budgets'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, fiscalYear]);

  if (!canView) {
    return <Alert tone="error" title="Access denied">You do not have permission to view budgets.</Alert>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 850 }}>Budgets</div>
          <div style={{ marginTop: 6, fontSize: 13, color: 'rgba(11,12,30,0.62)' }}>
            Create and review budgets by fiscal year.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ width: 160 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(11,12,30,0.62)' }}>Fiscal year</div>
            <div style={{ marginTop: 6 }}>
              <Input type="number" value={String(fiscalYear)} onChange={(e) => setFiscalYear(Number(e.target.value))} />
            </div>
          </div>
          <Button onClick={refresh} disabled={loading} variant="secondary">
            Refresh
          </Button>
          {canCreate ? (
            <Link to="/finance/budgets/new" style={{ textDecoration: 'none' }}>
              <Button disabled={loading}>New Budget</Button>
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 12 }}>
          <Alert tone="error" title="Error">{error}</Alert>
        </div>
      ) : null}

      {activeBudget ? (
        <div style={{ marginTop: 12 }}>
          <Alert tone="info" title="Active budget present">
            An ACTIVE budget exists for this year. You can still view budgets; creating additional budgets may be restricted by backend rules.
          </Alert>
        </div>
      ) : null}

      <div style={{ marginTop: 14 }}>
        <Card title="Budget list" subtitle={loading ? 'Loading…' : rows.length ? 'Budgets for selected fiscal year.' : 'No budgets found.'}>
          <DataTable>
            <DataTable.Head sticky>
              <tr>
                <DataTable.Th>Fiscal year</DataTable.Th>
                <DataTable.Th>Status</DataTable.Th>
                <DataTable.Th>Created</DataTable.Th>
                <DataTable.Th align="right">Actions</DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {rows.length === 0 ? <DataTable.Empty colSpan={4} title="No budgets found for this fiscal year." /> : null}
              {rows.map((b, idx) => (
                <DataTable.Row key={b.id} zebra index={idx}>
                  <DataTable.Td>{b.fiscalYear}</DataTable.Td>
                  <DataTable.Td>{b.status}</DataTable.Td>
                  <DataTable.Td>
                    <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>{new Date(b.createdAt).toLocaleString()}</div>
                    <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>{b.createdBy.email}</div>
                  </DataTable.Td>
                  <DataTable.Td align="right">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <Link to={`/finance/budgets/${b.id}`} style={{ textDecoration: 'none' }}>
                        <Button variant="secondary" size="sm">View</Button>
                      </Link>
                      <Link to={`/finance/budgets/${b.id}`} style={{ textDecoration: 'none' }}>
                        <Button variant="ghost" size="sm">{b.status === 'DRAFT' ? 'Edit' : 'Read-only'}</Button>
                      </Link>
                    </div>
                  </DataTable.Td>
                </DataTable.Row>
              ))}
            </DataTable.Body>
          </DataTable>
        </Card>
      </div>
    </div>
  );
}
