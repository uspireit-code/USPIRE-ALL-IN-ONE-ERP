import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { ApiError } from '../services/api';
import { listAllGlAccounts, listGlPeriods, type AccountingPeriod, type GlAccountLookup } from '../services/gl';
import {
  capitalizeFaAsset,
  createFaAsset,
  createFaCategory,
  disposeFaAsset,
  listFaAssets,
  listFaCategories,
  listFaDepreciationRuns,
  runFaDepreciation,
} from '../services/fa';

export function FixedAssetsPage() {
  const { hasPermission } = useAuth();

  const canManageCategories = hasPermission('FA_CATEGORY_MANAGE');
  const canCreateAsset = hasPermission('FA_ASSET_CREATE');
  const canCapitalize = hasPermission('FA_ASSET_CAPITALIZE') && hasPermission('FINANCE_GL_POST');
  const canRunDep = hasPermission('FA_DEPRECIATION_RUN') && hasPermission('FINANCE_GL_POST');
  const canDispose = hasPermission('FA_DISPOSE') && hasPermission('FINANCE_GL_POST');

  const canView = canManageCategories || canCreateAsset || canCapitalize || canRunDep || canDispose;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const [accounts, setAccounts] = useState<GlAccountLookup[]>([]);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);

  const [newCat, setNewCat] = useState({
    code: '',
    name: '',
    defaultUsefulLifeMonths: '60',
    defaultResidualRate: '',
    assetAccountId: '',
    accumDepAccountId: '',
    depExpenseAccountId: '',
  });

  const [newAsset, setNewAsset] = useState({
    categoryId: '',
    name: '',
    description: '',
    acquisitionDate: '',
    cost: '',
    residualValue: '0',
    usefulLifeMonths: '60',
  });

  const [periodId, setPeriodId] = useState('');

  const errBody = (error as ApiError | any)?.body;

  async function load() {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const [a, p, c, as, r] = await Promise.all([
        listAllGlAccounts(),
        listGlPeriods().catch(() => []),
        listFaCategories().catch(() => []),
        listFaAssets().catch(() => []),
        listFaDepreciationRuns().catch(() => []),
      ]);
      setAccounts(a);
      setPeriods(p);
      setCategories(c);
      setAssets(as);
      setRuns(r);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accountLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts) m.set(a.id, `${a.code} - ${a.name} (${a.type})`);
    return m;
  }, [accounts]);

  if (!canView) {
    return <div>You do not have permission to view Fixed Assets.</div>;
  }

  async function onCreateCategory() {
    if (!canManageCategories) return;
    setError(null);
    try {
      await createFaCategory({
        code: newCat.code,
        name: newCat.name,
        defaultMethod: 'STRAIGHT_LINE',
        defaultUsefulLifeMonths: Number(newCat.defaultUsefulLifeMonths || 0) || 60,
        defaultResidualRate: newCat.defaultResidualRate || undefined,
        assetAccountId: newCat.assetAccountId,
        accumDepAccountId: newCat.accumDepAccountId,
        depExpenseAccountId: newCat.depExpenseAccountId,
      });
      setNewCat({
        code: '',
        name: '',
        defaultUsefulLifeMonths: '60',
        defaultResidualRate: '',
        assetAccountId: '',
        accumDepAccountId: '',
        depExpenseAccountId: '',
      });
      await load();
    } catch (e) {
      setError(e);
    }
  }

  async function onCreateAsset() {
    if (!canCreateAsset) return;
    setError(null);
    try {
      await createFaAsset({
        categoryId: newAsset.categoryId,
        name: newAsset.name,
        description: newAsset.description || undefined,
        acquisitionDate: newAsset.acquisitionDate,
        cost: newAsset.cost,
        residualValue: newAsset.residualValue,
        usefulLifeMonths: Number(newAsset.usefulLifeMonths || 0) || 60,
        method: 'STRAIGHT_LINE',
      });
      setNewAsset({ categoryId: '', name: '', description: '', acquisitionDate: '', cost: '', residualValue: '0', usefulLifeMonths: '60' });
      await load();
    } catch (e) {
      setError(e);
    }
  }

  async function onRunDepreciation() {
    if (!canRunDep) return;
    setError(null);
    try {
      await runFaDepreciation(periodId);
      await load();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <div>
      <h2>Fixed Assets</h2>

      <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Reload'}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 12, padding: 12, border: '1px solid #f3b2b2', background: '#fff0f0' }}>
          <div style={{ fontWeight: 700 }}>Error</div>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(errBody ?? error, null, 2)}</pre>
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <h3>Categories</h3>

        {canManageCategories ? (
          <div style={{ padding: 12, border: '1px solid #ddd', marginTop: 8 }}>
            <div style={{ fontWeight: 700 }}>Create category</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <input placeholder="Code" value={newCat.code} onChange={(e) => setNewCat((p) => ({ ...p, code: e.target.value }))} />
              <input placeholder="Name" value={newCat.name} onChange={(e) => setNewCat((p) => ({ ...p, name: e.target.value }))} />
              <input
                placeholder="Useful life months"
                value={newCat.defaultUsefulLifeMonths}
                onChange={(e) => setNewCat((p) => ({ ...p, defaultUsefulLifeMonths: e.target.value }))}
              />
              <input
                placeholder="Residual rate (optional, e.g. 0.1)"
                value={newCat.defaultResidualRate}
                onChange={(e) => setNewCat((p) => ({ ...p, defaultResidualRate: e.target.value }))}
              />

              <select value={newCat.assetAccountId} onChange={(e) => setNewCat((p) => ({ ...p, assetAccountId: e.target.value }))}>
                <option value="">Select Asset account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name} ({a.type})
                  </option>
                ))}
              </select>

              <select value={newCat.accumDepAccountId} onChange={(e) => setNewCat((p) => ({ ...p, accumDepAccountId: e.target.value }))}>
                <option value="">Select Accumulated Depreciation account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name} ({a.type})
                  </option>
                ))}
              </select>

              <select value={newCat.depExpenseAccountId} onChange={(e) => setNewCat((p) => ({ ...p, depExpenseAccountId: e.target.value }))}>
                <option value="">Select Depreciation Expense account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name} ({a.type})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 8 }}>
              <button onClick={onCreateCategory}>
                Create category
              </button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#666' }}>You do not have permission to manage categories.</div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Code</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Name</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Default accounts</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{c.code}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{c.name}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                  <div>Asset: {accountLabelById.get(c.assetAccountId) ?? c.assetAccountId}</div>
                  <div>Accum Dep: {accountLabelById.get(c.accumDepAccountId) ?? c.accumDepAccountId}</div>
                  <div>Dep Exp: {accountLabelById.get(c.depExpenseAccountId) ?? c.depExpenseAccountId}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3>Assets</h3>

        {canCreateAsset ? (
          <div style={{ padding: 12, border: '1px solid #ddd', marginTop: 8 }}>
            <div style={{ fontWeight: 700 }}>Create asset (DRAFT)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <select value={newAsset.categoryId} onChange={(e) => setNewAsset((p) => ({ ...p, categoryId: e.target.value }))}>
                <option value="">Select category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
              <input placeholder="Name" value={newAsset.name} onChange={(e) => setNewAsset((p) => ({ ...p, name: e.target.value }))} />
              <input
                placeholder="Description (optional)"
                value={newAsset.description}
                onChange={(e) => setNewAsset((p) => ({ ...p, description: e.target.value }))}
              />
              <input type="date" value={newAsset.acquisitionDate} onChange={(e) => setNewAsset((p) => ({ ...p, acquisitionDate: e.target.value }))} />
              <input placeholder="Cost" value={newAsset.cost} onChange={(e) => setNewAsset((p) => ({ ...p, cost: e.target.value }))} />
              <input placeholder="Residual" value={newAsset.residualValue} onChange={(e) => setNewAsset((p) => ({ ...p, residualValue: e.target.value }))} />
              <input
                placeholder="Useful life months"
                value={newAsset.usefulLifeMonths}
                onChange={(e) => setNewAsset((p) => ({ ...p, usefulLifeMonths: e.target.value }))}
              />
            </div>
            <div style={{ marginTop: 8 }}>
              <button onClick={onCreateAsset}>Create asset</button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#666' }}>You do not have permission to create assets.</div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Name</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Cost</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <AssetRow
                key={a.id}
                asset={a}
                accounts={accounts}
                canCapitalize={canCapitalize}
                canDispose={canDispose}
                onCapitalize={async (params) => {
                  await capitalizeFaAsset(a.id, params);
                  await load();
                }}
                onDispose={async (params) => {
                  await disposeFaAsset(a.id, params);
                  await load();
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3>Depreciation</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} style={{ width: 520 }}>
            <option value="">Select OPEN period…</option>
            {periods
              .filter((p) => p.status === 'OPEN')
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({String(p.startDate).slice(0, 10)} – {String(p.endDate).slice(0, 10)})
                </option>
              ))}
          </select>
          <button onClick={onRunDepreciation} disabled={!canRunDep || !periodId}>
            Run depreciation for period
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Run date</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Period</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Journal</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Lines</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{String(r.runDate ?? '')}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{String(r.periodId ?? '')}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{String(r.journalEntryId ?? '')}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>{Array.isArray(r.lines) ? r.lines.length : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AssetRow(props: {
  asset: any;
  accounts: GlAccountLookup[];
  canCapitalize: boolean;
  canDispose: boolean;
  onCapitalize: (params: {
    capitalizationDate: string;
    assetAccountId: string;
    accumDepAccountId: string;
    depExpenseAccountId: string;
    clearingAccountId: string;
  }) => Promise<void>;
  onDispose: (params: {
    disposalDate: string;
    proceeds: string;
    proceedsAccountId: string;
    gainLossAccountId: string;
  }) => Promise<void>;
}) {
  const a = props.asset;

  const [cap, setCap] = useState({
    capitalizationDate: '',
    assetAccountId: a.category?.assetAccountId ?? '',
    accumDepAccountId: a.category?.accumDepAccountId ?? '',
    depExpenseAccountId: a.category?.depExpenseAccountId ?? '',
    clearingAccountId: '',
  });

  const [disp, setDisp] = useState({
    disposalDate: '',
    proceeds: '',
    proceedsAccountId: '',
    gainLossAccountId: '',
  });

  return (
    <tr>
      <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{a.name}</td>
      <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{a.status}</td>
      <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>{String(a.cost)}</td>
      <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
        {a.status === 'DRAFT' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, alignItems: 'center' }}>
            <input type="date" value={cap.capitalizationDate} onChange={(e) => setCap((p) => ({ ...p, capitalizationDate: e.target.value }))} />
            <select value={cap.assetAccountId} onChange={(e) => setCap((p) => ({ ...p, assetAccountId: e.target.value }))}>
              <option value="">Asset acct…</option>
              {props.accounts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} - {x.name}
                </option>
              ))}
            </select>
            <select value={cap.clearingAccountId} onChange={(e) => setCap((p) => ({ ...p, clearingAccountId: e.target.value }))}>
              <option value="">Clearing acct…</option>
              {props.accounts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} - {x.name}
                </option>
              ))}
            </select>
            <button
              disabled={!props.canCapitalize || !cap.capitalizationDate || !cap.assetAccountId || !cap.accumDepAccountId || !cap.depExpenseAccountId || !cap.clearingAccountId}
              onClick={() => props.onCapitalize(cap)}
            >
              Capitalize
            </button>
          </div>
        ) : null}

        {a.status === 'CAPITALIZED' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 6, alignItems: 'center', marginTop: 6 }}>
            <input type="date" value={disp.disposalDate} onChange={(e) => setDisp((p) => ({ ...p, disposalDate: e.target.value }))} />
            <input placeholder="Proceeds" value={disp.proceeds} onChange={(e) => setDisp((p) => ({ ...p, proceeds: e.target.value }))} />
            <select value={disp.proceedsAccountId} onChange={(e) => setDisp((p) => ({ ...p, proceedsAccountId: e.target.value }))}>
              <option value="">Proceeds acct…</option>
              {props.accounts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} - {x.name}
                </option>
              ))}
            </select>
            <select value={disp.gainLossAccountId} onChange={(e) => setDisp((p) => ({ ...p, gainLossAccountId: e.target.value }))}>
              <option value="">Gain/Loss acct…</option>
              {props.accounts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} - {x.name}
                </option>
              ))}
            </select>
            <button disabled={!props.canDispose || !disp.disposalDate || !disp.proceeds || !disp.proceedsAccountId || !disp.gainLossAccountId} onClick={() => props.onDispose(disp)}>
              Dispose
            </button>
          </div>
        ) : null}

        <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
          Category: {a.category?.code ?? a.categoryId}
        </div>
      </td>
    </tr>
  );
}
