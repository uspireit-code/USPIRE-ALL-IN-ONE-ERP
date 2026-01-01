import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Input } from '../../../components/Input';
import { useAuth } from '../../../auth/AuthContext';
import { getApiErrorMessage } from '../../../services/api';
import { createBudget } from '../../../services/budgets';
import { listAllGlAccounts, listGlPeriods, type AccountingPeriod, type GlAccountLookup } from '../../../services/gl';

type AccountRow = Pick<GlAccountLookup, 'id' | 'code' | 'name'>;
type PeriodRow = AccountingPeriod;

export function BudgetCreatePage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const canCreate = hasPermission('BUDGET_CREATE');
  const canView = hasPermission('BUDGET_VIEW');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fiscalYear, setFiscalYear] = useState<number>(() => new Date().getFullYear());
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);

  const [amounts, setAmounts] = useState<Record<string, Record<string, number>>>({});

  const periodsInYear = useMemo(() => {
    return periods.filter((p) => new Date(p.startDate).getFullYear() === fiscalYear);
  }, [periods, fiscalYear]);

  async function loadLookups() {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const [a, p] = await Promise.all([listAllGlAccounts(), listGlPeriods()]);
      setAccounts(a as any);
      setPeriods(p as any);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to load accounts/periods'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

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
      const res = await createBudget({ fiscalYear, lines });
      navigate(`/finance/budgets/${res.budget.id}`);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to create budget'));
    } finally {
      setLoading(false);
    }
  }

  if (!canView) {
    return <Alert tone="error" title="Access denied">You do not have permission to view budgets.</Alert>;
  }

  if (!canCreate) {
    return <Alert tone="error" title="Access denied">You do not have permission to create budgets.</Alert>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 850 }}>New Budget</div>
          <div style={{ marginTop: 6, fontSize: 13, color: 'rgba(11,12,30,0.62)' }}>
            Create a DRAFT budget by entering amounts by account and period.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="ghost" onClick={() => navigate('/finance/budgets')} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onCreateDraft} disabled={loading}>
            Create Draft
          </Button>
        </div>
      </div>

      {error ? <Alert tone="error" title="Error">{error}</Alert> : null}

      <Card title="Controls" subtitle="Select fiscal year.">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ width: 180 }}>
            <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)', fontWeight: 700 }}>Fiscal Year</div>
            <div style={{ marginTop: 6 }}>
              <Input type="number" value={String(fiscalYear)} onChange={(e) => setFiscalYear(Number(e.target.value))} />
            </div>
          </div>
          <Button onClick={loadLookups} disabled={loading} variant="secondary">
            Reload lookups
          </Button>
        </div>
      </Card>

      <Card title="Budget lines" subtitle="Enter amounts by period. Non-zero values will be saved.">
        <div style={{ overflowX: 'auto', border: '1px solid rgba(11,12,30,0.08)', borderRadius: 12 }}>
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
                          disabled={loading}
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
      </Card>
    </div>
  );
}
