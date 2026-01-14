import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import { getApiErrorMessage } from '../../services/api';
import { listAllGlAccounts, type GlAccountLookup } from '../../services/gl';
import { getForecast, updateForecastLines, type ForecastDetailsResponse } from '../../services/forecasts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type AccountRow = Pick<GlAccountLookup, 'id' | 'code' | 'name'>;

export function ForecastEditPage() {
  const { forecastId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const canEdit = hasPermission(PERMISSIONS.FORECAST.EDIT);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [forecast, setForecast] = useState<ForecastDetailsResponse | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);

  const id = forecastId ?? '';

  const [amounts, setAmounts] = useState<Record<string, Record<number, number>>>({});

  const isDraft = forecast?.forecast.status === 'DRAFT';

  const linesCount = useMemo(() => {
    let c = 0;
    for (const accId of Object.keys(amounts)) {
      for (let m = 1; m <= 12; m++) {
        const v = amounts[accId]?.[m] ?? 0;
        if (v !== 0) c++;
      }
    }
    return c;
  }, [amounts]);

  async function refresh() {
    if (!canEdit) return;
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const [f, a] = await Promise.all([getForecast(id), listAllGlAccounts()]);
      setForecast(f);
      setAccounts(a as any);

      const next: Record<string, Record<number, number>> = {};
      for (const acc of a) {
        next[acc.id] = {};
        for (let m = 1; m <= 12; m++) next[acc.id][m] = 0;
      }
      for (const l of f.lines) {
        const amt = Number(l.amount);
        if (!next[l.accountId]) next[l.accountId] = {};
        next[l.accountId][l.month] = Number.isNaN(amt) ? 0 : amt;
      }
      setAmounts(next);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to load forecast'));
      setForecast(null);
      setAccounts([]);
      setAmounts({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, id]);

  async function onSave() {
    if (!canEdit) return;
    if (!id) return;
    if (!isDraft) return;

    const lines: Array<{ accountId: string; month: number; amount: number }> = [];
    for (const acc of accounts) {
      for (let m = 1; m <= 12; m++) {
        const v = amounts[acc.id]?.[m] ?? 0;
        if (v !== 0) {
          lines.push({ accountId: acc.id, month: m, amount: v });
        }
      }
    }

    if (lines.length === 0) {
      setError('Forecast must contain at least one non-zero line');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateForecastLines(id, { lines });
      await refresh();
      navigate(`/forecasts/${id}`, { replace: true });
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to save forecast'));
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return <div>You do not have access to edit forecasts.</div>;
  }

  if (forecast && forecast.forecast.status !== 'DRAFT') {
    return <div>Only DRAFT forecasts can be edited.</div>;
  }

  return (
    <div>
      <h2>Edit Forecast</h2>

      {forecast ? (
        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
          {forecast.forecast.name} | Fiscal Year: {forecast.forecast.fiscalYear} | Status: {forecast.forecast.status}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10 }}>
        <button onClick={refresh} disabled={loading || saving}>
          Refresh
        </button>
        <button onClick={onSave} disabled={!isDraft || loading || saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <div style={{ fontSize: 12, color: '#666' }}>Non-zero lines: {linesCount}</div>
      </div>

      {error ? <div style={{ marginTop: 12, color: 'crimson' }}>{error}</div> : null}
      {loading ? <div style={{ marginTop: 12 }}>Loading…</div> : null}

      {!loading && accounts.length === 0 ? <div style={{ marginTop: 12, color: '#666' }}>No accounts found.</div> : null}

      <div style={{ overflowX: 'auto', marginTop: 12, border: '1px solid #eee' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1500 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Account</th>
              {MONTHS.map((m) => (
                <th key={m} style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>
                  {a.code} — {a.name}
                </td>
                {MONTHS.map((_, idx) => {
                  const month = idx + 1;
                  const val = amounts[a.id]?.[month] ?? 0;
                  return (
                    <td key={month} style={{ borderBottom: '1px solid #f0f0f0', padding: 8, textAlign: 'right' }}>
                      <input
                        type="number"
                        step="0.01"
                        disabled={!isDraft || saving || loading}
                        value={val}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setAmounts((prev) => ({
                            ...prev,
                            [a.id]: {
                              ...(prev[a.id] ?? {}),
                              [month]: Number.isNaN(n) ? 0 : n,
                            },
                          }));
                        }}
                        style={{ width: 110, textAlign: 'right' }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
        Draft forecasts are editable. Approved and superseded forecasts are read-only.
      </div>
    </div>
  );
}
