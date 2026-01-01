import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getApiErrorMessage } from '../../services/api';
import { getForecast, listForecasts, type ForecastListRow, type ForecastStatus } from '../../services/forecasts';

function StatusBadge(props: { status: string }) {
  const bg = props.status === 'APPROVED' ? '#e7f6ec' : '#f3f4f6';
  const color = props.status === 'APPROVED' ? '#166534' : '#374151';
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, background: bg, color, fontSize: 12, fontWeight: 700 }}>
      {props.status}
    </span>
  );
}

export function ForecastsListPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('forecast.view');
  const canCreate = hasPermission('forecast.create');
  const canEdit = hasPermission('forecast.edit');

  const [searchParams, setSearchParams] = useSearchParams();
  const initialYear = useMemo(() => {
    const q = searchParams.get('fiscalYear');
    const n = q ? Number(q) : NaN;
    return !Number.isNaN(n) ? n : new Date().getFullYear();
  }, [searchParams]);

  const [fiscalYear, setFiscalYear] = useState<number>(initialYear);
  const [statusFilter, setStatusFilter] = useState<ForecastStatus | 'ALL'>(() => (searchParams.get('status') as any) ?? 'APPROVED');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ForecastListRow[]>([]);
  const [activeVersionByForecastId, setActiveVersionByForecastId] = useState<Record<string, number>>({});

  async function refresh() {
    if (!canView) return;
    setLoading(true);
    setError(null);

    try {
      const list = await listForecasts({ fiscalYear });
      const filtered = statusFilter === 'ALL' ? list : list.filter((f) => f.status === statusFilter);
      setRows(filtered);

      const versionMap: Record<string, number> = {};
      await Promise.all(
        filtered.map(async (f) => {
          try {
            const detail = await getForecast(f.id);
            versionMap[f.id] = detail.latestVersion?.versionNumber ?? 0;
          } catch {
            versionMap[f.id] = 0;
          }
        }),
      );
      setActiveVersionByForecastId(versionMap);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to load forecasts'));
      setRows([]);
      setActiveVersionByForecastId({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) return;
    setSearchParams({ fiscalYear: String(fiscalYear), status: String(statusFilter) });
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, fiscalYear, statusFilter]);

  if (!canView) {
    return <div>You do not have access to Forecasts.</div>;
  }

  return (
    <div>
      <h2>Forecasts</h2>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        <label>
          Fiscal Year:{' '}
          <input
            type="number"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(Number(e.target.value))}
            style={{ width: 120 }}
          />
        </label>

        <label>
          Status:{' '}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="APPROVED">APPROVED</option>
            <option value="DRAFT">DRAFT</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="SUPERSEDED">SUPERSEDED</option>
            <option value="ALL">ALL</option>
          </select>
        </label>

        <button onClick={refresh} disabled={loading}>
          Refresh
        </button>

        {canCreate ? (
          <Link to="/forecasts/new" style={{ marginLeft: 'auto' }}>
            Create Forecast
          </Link>
        ) : null}
      </div>

      {error ? <div style={{ marginTop: 12, color: 'crimson' }}>{error}</div> : null}
      {loading ? <div style={{ marginTop: 12 }}>Loading…</div> : null}

      {!loading && rows.length === 0 ? (
        <div style={{ marginTop: 12, color: '#666' }}>
          No forecasts found for this fiscal year{statusFilter === 'ALL' ? '.' : ` with status ${statusFilter}.`}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {rows.map((f) => (
          <div key={f.id} style={{ border: '1px solid #ddd', padding: 10, borderRadius: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>
                  <Link to={`/forecasts/${f.id}`}>{f.name}</Link>
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                  Fiscal Year: {f.fiscalYear} | Active version: {activeVersionByForecastId[f.id] ?? 0}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StatusBadge status={f.status} />
                {canEdit && f.status === 'DRAFT' ? <Link to={`/forecasts/${f.id}/edit`}>Edit</Link> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
