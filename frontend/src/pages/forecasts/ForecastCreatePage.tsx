import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import { getApiErrorMessage } from '../../services/api';
import { createForecast } from '../../services/forecasts';

export function ForecastCreatePage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.FORECAST.CREATE);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [fiscalYear, setFiscalYear] = useState<number>(() => new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;

    setLoading(true);
    setError(null);

    try {
      const created = await createForecast({ name, fiscalYear, lines: [] });
      navigate(`/forecasts/${created.forecast.id}`, { replace: true });
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to create forecast'));
    } finally {
      setLoading(false);
    }
  }

  if (!canCreate) {
    return <div>You do not have access to create forecasts.</div>;
  }

  return (
    <div>
      <h2>Create Forecast</h2>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520 }}>
        <label>
          Forecast name
          <input value={name} onChange={(e) => setName(e.target.value)} required style={{ width: '100%' }} />
        </label>

        <label>
          Fiscal year
          <input
            type="number"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(Number(e.target.value))}
            required
            style={{ width: 140 }}
          />
        </label>

        {error ? <div style={{ color: 'crimson', fontSize: 13 }}>{error}</div> : null}

        <button type="submit" disabled={loading}>
          {loading ? 'Creating…' : 'Create'}
        </button>
      </form>

      <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
        After creation, you can edit the forecast lines while the forecast remains in DRAFT.
      </div>
    </div>
  );
}
