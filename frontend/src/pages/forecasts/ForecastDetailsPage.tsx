import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getApiErrorMessage } from '../../services/api';
import {
  approveForecast,
  getForecast,
  getForecastActuals,
  getForecastVariance,
  submitForecast,
  type ForecastDetailsResponse,
  type ForecastVarianceResponse,
  type ForecastActualsResponse,
  type ForecastVarianceCell,
} from '../../services/forecasts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtMoney(n: number) {
  return n.toFixed(2);
}

function StatusBadge(props: { status: string }) {
  const bg = props.status === 'APPROVED' ? '#e7f6ec' : props.status === 'SUBMITTED' ? '#fff7ed' : '#f3f4f6';
  const color = props.status === 'APPROVED' ? '#166534' : props.status === 'SUBMITTED' ? '#9a3412' : '#374151';
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, background: bg, color, fontSize: 12, fontWeight: 700 }}>
      {props.status}
    </span>
  );
}

type Row = {
  accountId: string;
  accountCode: string;
  accountName: string;
  byMonth: Record<number, ForecastVarianceCell>;
  totals: { forecast: number; actual: number; variance: number };
};

export function ForecastDetailsPage() {
  const { forecastId } = useParams();
  const { state, hasPermission } = useAuth();
  const canView = hasPermission('forecast.view');
  const canSubmit = hasPermission('forecast.submit');
  const canApprove = hasPermission('forecast.approve');
  const canEdit = hasPermission('forecast.edit');

  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [forecast, setForecast] = useState<ForecastDetailsResponse | null>(null);
  const [actuals, setActuals] = useState<ForecastActualsResponse | null>(null);
  const [variance, setVariance] = useState<ForecastVarianceResponse | null>(null);

  const id = forecastId ?? '';

  const rows: Row[] = useMemo(() => {
    if (!forecast || !variance) return [];

    const lineByAccountId = new Map<string, { code: string; name: string }>();
    for (const l of forecast.lines) {
      lineByAccountId.set(l.accountId, { code: l.account.code, name: l.account.name });
    }

    const out: Row[] = [];

    for (const r of variance.rows) {
      const acc = lineByAccountId.get(r.accountId) ?? { code: r.accountId, name: '' };

      const byMonth: Record<number, ForecastVarianceCell> = {};
      let totalForecast = 0;
      let totalActual = 0;
      let totalVariance = 0;

      for (let m = 1; m <= 12; m++) {
        const c = (r.byMonth as any)[String(m)] as ForecastVarianceCell | undefined;
        const cell: ForecastVarianceCell = c ?? { forecastAmount: 0, actualAmount: 0, varianceAmount: 0, variancePercent: null };
        byMonth[m] = cell;
        totalForecast += cell.forecastAmount;
        if (cell.actualAmount !== null) {
          totalActual += cell.actualAmount;
        }
        if (cell.varianceAmount !== null) {
          totalVariance += cell.varianceAmount;
        }
      }

      out.push({
        accountId: r.accountId,
        accountCode: acc.code,
        accountName: acc.name,
        byMonth,
        totals: { forecast: totalForecast, actual: totalActual, variance: totalVariance },
      });
    }

    out.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    return out;
  }, [forecast, variance]);

  const totalsByMonth = useMemo(() => {
    const byMonth: Record<number, { forecast: number; actual: number; variance: number; hasFuture: boolean }> = {};
    for (let m = 1; m <= 12; m++) {
      byMonth[m] = { forecast: 0, actual: 0, variance: 0, hasFuture: false };
    }

    for (const r of rows) {
      for (let m = 1; m <= 12; m++) {
        const c = r.byMonth[m];
        byMonth[m].forecast += c.forecastAmount;
        if (c.actualAmount === null) {
          byMonth[m].hasFuture = true;
        } else {
          byMonth[m].actual += c.actualAmount;
        }
        if (c.varianceAmount !== null) {
          byMonth[m].variance += c.varianceAmount;
        }
      }
    }

    return byMonth;
  }, [rows]);

  async function refresh() {
    if (!canView) return;
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const f = await getForecast(id);
      setForecast(f);

      if (f.forecast.status === 'APPROVED') {
        const [a, v] = await Promise.all([getForecastActuals(id), getForecastVariance(id)]);
        setActuals(a);
        setVariance(v);
      } else {
        setActuals(null);
        setVariance(null);
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to load forecast'));
      setForecast(null);
      setActuals(null);
      setVariance(null);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit() {
    if (!forecast) return;
    if (!canSubmit) return;
    if (forecast.forecast.status !== 'DRAFT') return;

    setActing(true);
    setError(null);
    try {
      await submitForecast(forecast.forecast.id);
      await refresh();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to submit forecast'));
    } finally {
      setActing(false);
    }
  }

  async function onApprove() {
    if (!forecast) return;
    if (!canApprove) return;
    if (forecast.forecast.status !== 'SUBMITTED') return;

    setActing(true);
    setError(null);
    try {
      await approveForecast(forecast.forecast.id);
      await refresh();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to approve forecast'));
    } finally {
      setActing(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, id]);

  if (!canView) {
    return <div>You do not have access to Forecasts.</div>;
  }

  if (!id) {
    return <div>Missing forecast id.</div>;
  }

  const status = forecast?.forecast.status;
  const isDraft = status === 'DRAFT';
  const isSubmitted = status === 'SUBMITTED';
  const isApproved = status === 'APPROVED';
  const isSuperseded = status === 'SUPERSEDED';

  const isMaker = forecast ? forecast.forecast.createdBy.id === (state.me?.user.id ?? '') : false;
  const showSubmit = Boolean(forecast) && canSubmit && isDraft;
  const showApprove = Boolean(forecast) && canApprove && isSubmitted && !isMaker;

  return (
    <div>
      <h2>Forecast</h2>

      {forecast ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: '#666' }}>
            {forecast.forecast.name} | Fiscal Year: {forecast.forecast.fiscalYear}
          </div>
          <StatusBadge status={forecast.forecast.status} />

          {canEdit && isDraft ? <Link to={`/forecasts/${forecast.forecast.id}/edit`}>Edit</Link> : null}

          {showSubmit ? (
            <button onClick={onSubmit} disabled={loading || acting}>
              Submit for Approval
            </button>
          ) : null}

          {isSubmitted && canApprove && isMaker ? <div style={{ fontSize: 12, color: '#666' }}>Creator cannot approve.</div> : null}

          {showApprove ? (
            <button onClick={onApprove} disabled={loading || acting}>
              Approve Forecast
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <div style={{ marginTop: 12, color: 'crimson' }}>{error}</div> : null}
      {loading ? <div style={{ marginTop: 12 }}>Loading…</div> : null}

      {forecast && !isApproved ? (
        <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
          {isDraft ? 'Draft forecast: editable until submitted.' : null}
          {isSubmitted ? 'Submitted forecast: awaiting approval.' : null}
          {isSuperseded ? 'Superseded forecast: read-only.' : null}
        </div>
      ) : null}

      {forecast && isApproved ? (
        <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>
          Version: {forecast.latestVersion?.versionNumber ?? '—'}
        </div>
      ) : null}

      {!isApproved || !variance || !forecast ? null : (
        <div style={{ overflowX: 'auto', marginTop: 12, border: '1px solid #eee' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1600 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Account</th>
                {MONTHS.map((m) => (
                  <th key={m} style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>
                    {m}
                  </th>
                ))}
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.accountId}>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>
                    {r.accountCode} — {r.accountName}
                  </td>
                  {MONTHS.map((_, idx) => {
                    const month = idx + 1;
                    const c = r.byMonth[month];
                    return (
                      <td key={month} style={{ borderBottom: '1px solid #f0f0f0', padding: 8, textAlign: 'right', fontSize: 12 }}>
                        <div>F: {fmtMoney(c.forecastAmount)}</div>
                        <div>A: {c.actualAmount === null ? '—' : fmtMoney(c.actualAmount)}</div>
                        <div>V: {c.actualAmount === null ? '' : fmtMoney(c.varianceAmount ?? 0)}</div>
                        <div>{c.actualAmount === null || c.variancePercent === null ? '' : `${c.variancePercent.toFixed(2)}%`}</div>
                      </td>
                    );
                  })}
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8, textAlign: 'right', fontSize: 12 }}>
                    <div>F: {fmtMoney(r.totals.forecast)}</div>
                    <div>A: {fmtMoney(r.totals.actual)}</div>
                    <div>V: {fmtMoney(r.totals.variance)}</div>
                  </td>
                </tr>
              ))}

              <tr>
                <td style={{ borderTop: '2px solid #ddd', padding: 8, fontWeight: 700 }}>TOTAL</td>
                {MONTHS.map((_, idx) => {
                  const month = idx + 1;
                  const t = totalsByMonth[month];
                  return (
                    <td key={month} style={{ borderTop: '2px solid #ddd', padding: 8, textAlign: 'right', fontWeight: 700, fontSize: 12 }}>
                      <div>F: {fmtMoney(t.forecast)}</div>
                      <div>A: {t.hasFuture ? '—' : fmtMoney(t.actual)}</div>
                      <div>V: {t.hasFuture ? '' : fmtMoney(t.variance)}</div>
                    </td>
                  );
                })}
                <td style={{ borderTop: '2px solid #ddd', padding: 8, textAlign: 'right', fontWeight: 700, fontSize: 12 }}>
                  <div>F: {fmtMoney(Object.values(totalsByMonth).reduce((s, x) => s + x.forecast, 0))}</div>
                  <div>A: {fmtMoney(Object.values(totalsByMonth).reduce((s, x) => s + x.actual, 0))}</div>
                  <div>V: {fmtMoney(Object.values(totalsByMonth).reduce((s, x) => s + x.variance, 0))}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {actuals && variance ? (
        <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
          Read-only view. Actuals are derived from POSTED journals. Future months show “—”.
        </div>
      ) : null}
    </div>
  );
}
