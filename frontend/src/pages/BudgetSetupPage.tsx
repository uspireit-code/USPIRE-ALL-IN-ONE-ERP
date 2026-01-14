import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { PERMISSIONS } from '../auth/permission-catalog';
import { createBudget, listBudgets, approveBudget, type BudgetListRow } from '../services/budgets';
import { listGlAccounts, listGlPeriods, type AccountingPeriod, type GlAccountLookup } from '../services/gl';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { DataTable } from '../components/DataTable';
import { Input } from '../components/Input';

type AccountRow = Pick<GlAccountLookup, 'id' | 'code' | 'name'>;
type PeriodRow = AccountingPeriod;

export function BudgetSetupPage() {
  const { hasPermission } = useAuth();

  const canView = hasPermission(PERMISSIONS.BUDGET.VIEW);
  const canCreate = hasPermission(PERMISSIONS.BUDGET.CREATE);
  const canApprove = hasPermission(PERMISSIONS.BUDGET.APPROVE);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [budgets, setBudgets] = useState<BudgetListRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);

  const [fiscalYear, setFiscalYear] = useState<number>(() => new Date().getFullYear());

  const [amounts, setAmounts] = useState<Record<string, Record<string, number>>>({});

  const periodsInYear = useMemo(() => {
    return periods.filter((p) => new Date(p.startDate).getFullYear() === fiscalYear);
  }, [periods, fiscalYear]);

  async function refresh() {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const [b, a, p] = await Promise.all([listBudgets({ fiscalYear }), listGlAccounts(), listGlPeriods()]);
      setBudgets(b);
      setAccounts(a as any);
      setPeriods(p as any);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load budgets');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, fiscalYear]);

  if (!canView) {
    return <div>You do not have access to Budget Setup.</div>;
  }

  const activeBudget = budgets.find((b) => b.status === 'ACTIVE');

  async function onCreateDraft() {
    if (!canCreate) return;

    const lines: Array<{ accountId: string; periodId: string; amount: number }> = [];
    for (const acc of accounts) {
      for (const per of periodsInYear) {
        const amt = amounts[acc.id]?.[per.id] ?? 0;
        if (amt !== 0) {
          lines.push({ accountId: acc.id, periodId: per.id, amount: amt });
        }
      }
    }

    setLoading(true);
    setError(null);
    try {
      await createBudget({ fiscalYear, lines });
      setAmounts({});
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create budget');
    } finally {
      setLoading(false);
    }
  }

  async function onApprove(id: string) {
    if (!canApprove) return;
    setLoading(true);
    setError(null);
    try {
      await approveBudget(id);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to approve budget');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Budget Setup</h2>

      <Card title="Controls" subtitle="Select fiscal year and manage budgets." style={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ width: 180 }}>
            <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)', fontWeight: 700 }}>Fiscal Year</div>
            <div style={{ marginTop: 6 }}>
              <Input
                type="number"
                value={String(fiscalYear)}
                onChange={(e) => setFiscalYear(Number(e.target.value))}
              />
            </div>
          </div>
          <Button onClick={refresh} disabled={loading} variant="secondary">
            Refresh
          </Button>
        </div>
        {error ? (
          <div style={{ marginTop: 12 }}>
            <Alert tone="error" title="Budget setup error">{error}</Alert>
          </div>
        ) : null}
      </Card>

      <div style={{ marginTop: 16 }}>
        <Card
          title="Budgets"
          subtitle={loading ? 'Loading…' : budgets.length ? 'Review drafts and approvals.' : 'No budgets found for this fiscal year.'}
        >
          <div style={{ marginTop: 8 }}>
            <DataTable>
              <DataTable.Head sticky>
                <tr>
                  <DataTable.Th>Budget</DataTable.Th>
                  <DataTable.Th>Created</DataTable.Th>
                  <DataTable.Th>Approved</DataTable.Th>
                  <DataTable.Th align="right">Action</DataTable.Th>
                </tr>
              </DataTable.Head>
              <DataTable.Body>
                {budgets.length === 0 ? <DataTable.Empty colSpan={4} title="No budgets found for this fiscal year." /> : null}
                {budgets.map((b, idx) => {
                  const canApproveThis = canApprove && b.status === 'DRAFT' && !activeBudget;
                  return (
                    <DataTable.Row key={b.id} zebra index={idx}>
                      <DataTable.Td>
                        <div style={{ fontWeight: 750 }}>
                          {b.fiscalYear} — {b.status}
                        </div>
                      </DataTable.Td>
                      <DataTable.Td>
                        <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>{new Date(b.createdAt).toLocaleString()}</div>
                        <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>{b.createdBy.email}</div>
                      </DataTable.Td>
                      <DataTable.Td>
                        {b.approvedAt && b.approvedBy ? (
                          <>
                            <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>{new Date(b.approvedAt).toLocaleString()}</div>
                            <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>{b.approvedBy.email}</div>
                          </>
                        ) : (
                          <span style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>—</span>
                        )}
                      </DataTable.Td>
                      <DataTable.Td align="right">
                        {canApproveThis ? (
                          <Button onClick={() => onApprove(b.id)} disabled={loading} variant="accent" size="sm">
                            Approve
                          </Button>
                        ) : (
                          <span style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>—</span>
                        )}
                      </DataTable.Td>
                    </DataTable.Row>
                  );
                })}
              </DataTable.Body>
            </DataTable>
          </div>

          {activeBudget ? (
            <div style={{ marginTop: 12 }}>
              <Alert tone="info" title="Active budget present">An ACTIVE budget exists for this year. New approvals are blocked.</Alert>
            </div>
          ) : null}
        </Card>
      </div>

      <div style={{ marginTop: 20 }}>
        <Card title="Create Draft Budget" subtitle="Enter amounts by period. Numbers are right-aligned.">
          {!canCreate ? (
            <Alert tone="info" title="No permission">You do not have permission to create budgets.</Alert>
          ) : null}
          {activeBudget ? (
            <div style={{ marginTop: 12 }}>
              <Alert tone="warning" title="Active budget blocks drafts">Cannot create/approve budgets while an ACTIVE budget exists.</Alert>
            </div>
          ) : null}

          <div style={{ marginTop: 12, overflowX: 'auto', border: '1px solid rgba(11,12,30,0.08)', borderRadius: 12 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid rgba(11,12,30,0.10)', padding: 12, background: 'rgba(11,12,30,0.02)' }}>Account</th>
                  {periodsInYear.map((p) => (
                    <th key={p.id} style={{ textAlign: 'right', borderBottom: '1px solid rgba(11,12,30,0.10)', padding: 12, background: 'rgba(11,12,30,0.02)' }}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accounts.map((a, idx) => (
                  <tr key={a.id} style={{ background: idx % 2 ? 'rgba(11,12,30,0.02)' : 'transparent' }}>
                    <td style={{ borderBottom: '1px solid rgba(11,12,30,0.06)', padding: 12 }}>
                      {a.code} — {a.name}
                    </td>
                    {periodsInYear.map((p) => (
                      <td key={p.id} style={{ borderBottom: '1px solid rgba(11,12,30,0.06)', padding: 12, textAlign: 'right' }}>
                        <div style={{ width: 130, marginLeft: 'auto' }}>
                          <Input
                            type="number"
                            step="0.01"
                            disabled={!canCreate || Boolean(activeBudget) || loading}
                            value={String(amounts[a.id]?.[p.id] ?? 0)}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setAmounts((prev) => ({
                                ...prev,
                                [a.id]: {
                                  ...(prev[a.id] ?? {}),
                                  [p.id]: Number.isNaN(val) ? 0 : val,
                                },
                              }));
                            }}
                            style={{ textAlign: 'right' }}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={onCreateDraft} disabled={!canCreate || Boolean(activeBudget) || loading} variant="primary">
              Create Draft
            </Button>
          </div>
        </Card>

        <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>
          Budgets are control-first: no deletes, no editing ACTIVE budgets. Enforcement on posting is not enabled yet.
        </div>
      </div>
    </div>
  );
}
