import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { ApiError } from '../services/api';
import {
  closePeriod,
  completePeriodChecklistItem,
  createPeriod,
  getPeriodChecklist,
  listPeriods,
  reopenPeriod,
  type AccountingPeriod,
  type AccountingPeriodChecklistResponse,
  type PeriodType,
} from '../services/periods';

export function PeriodsPage() {
  const { hasPermission, state } = useAuth();

  const canView =
    hasPermission('FINANCE_PERIOD_VIEW') ||
    hasPermission('FINANCE_GL_VIEW') ||
    hasPermission('FINANCE_PERIOD_REVIEW') ||
    hasPermission('FINANCE_PERIOD_CHECKLIST_VIEW');
  const canCreate = hasPermission('FINANCE_PERIOD_CREATE');
  const canClose = hasPermission('FINANCE_PERIOD_CLOSE');
  const canReopen = hasPermission('FINANCE_PERIOD_REOPEN') && Boolean(state.me?.user?.roles?.includes('ADMIN'));
  const canViewChecklist = hasPermission('FINANCE_PERIOD_CHECKLIST_VIEW');
  const canCompleteChecklist = hasPermission('FINANCE_PERIOD_CHECKLIST_COMPLETE');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState<{ code: string; type: PeriodType; startDate: string; endDate: string }>({
    code: '',
    type: 'NORMAL',
    startDate: '',
    endDate: '',
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<any>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsPeriodId, setDetailsPeriodId] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<any>(null);
  const [details, setDetails] = useState<AccountingPeriodChecklistResponse | null>(null);

  const debugApi = (import.meta.env.VITE_DEBUG_API ?? '').toString().toLowerCase() === 'true';
  const errBody = (error as ApiError | any)?.body;
  const errMsg =
    typeof errBody?.message === 'string'
      ? errBody.message
      : typeof errBody === 'string'
        ? errBody
        : typeof errBody?.error === 'string'
          ? errBody.error
          : typeof errBody?.reason === 'string'
            ? errBody.reason
            : '';

  async function load() {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const p = await listPeriods();
      setPeriods(p);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  async function submitCreate() {
    if (!canCreate) return;
    const trimmedCode = createDraft.code.trim();
    if (trimmedCode.length < 3) return;
    setCreateSubmitting(true);
    setCreateError(null);
    try {
      await createPeriod({
        code: trimmedCode,
        type: createDraft.type,
        startDate: createDraft.startDate,
        endDate: createDraft.endDate,
      });
      setShowCreate(false);
      setCreateDraft({ code: '', type: 'NORMAL', startDate: '', endDate: '' });
      await load();
    } catch (e) {
      setCreateError(e);
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function doClose(id: string) {
    if (!canClose) return;
    setActionBusyId(id);
    setError(null);
    try {
      await closePeriod(id);
      await load();
      if (detailsPeriodId === id) {
        await loadDetails(id);
      }
    } catch (e) {
      setError(e);
    } finally {
      setActionBusyId(null);
    }
  }

  async function loadDetails(id: string) {
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const resp = await getPeriodChecklist(id);
      setDetails(resp);
    } catch (e) {
      setDetailsError(e);
    } finally {
      setDetailsLoading(false);
    }
  }

  async function openDetails(id: string) {
    setDetailsOpen(true);
    setDetailsPeriodId(id);
    setDetails(null);
    await loadDetails(id);
  }

  async function markChecklistItemComplete(itemId: string) {
    if (!detailsPeriodId) return;
    if (!canCompleteChecklist) return;
    setDetailsError(null);
    try {
      await completePeriodChecklistItem({ periodId: detailsPeriodId, itemId });
      await loadDetails(detailsPeriodId);
    } catch (e) {
      setDetailsError(e);
    }
  }

  async function doReopen(id: string) {
    if (!canReopen) return;
    const reason = window.prompt('Reason for reopening this period?') ?? '';
    if (!reason.trim()) return;
    setActionBusyId(id);
    setError(null);
    try {
      await reopenPeriod(id, { reason: reason.trim() });
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setActionBusyId(null);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(() => {
    return [...periods].sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  }, [periods]);

  const StatusBadge = (props: { status: AccountingPeriod['status'] }) => {
    const bg =
      props.status === 'OPEN' ? '#e7f7ed' : props.status === 'SOFT_CLOSED' ? '#fff4e5' : '#f3f4f6';
    const border =
      props.status === 'OPEN' ? '#bfe5cc' : props.status === 'SOFT_CLOSED' ? '#ffd7a8' : '#e5e7eb';
    const color = props.status === 'OPEN' ? '#14532d' : props.status === 'SOFT_CLOSED' ? '#7c2d12' : '#374151';
    return (
      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, border: `1px solid ${border}`, background: bg, color, fontSize: 12 }}>
        {props.status}
      </span>
    );
  };

  if (!canView) {
    return <div>You do not have permission to view accounting periods.</div>;
  }

  const detailsErrBody = (detailsError as ApiError | any)?.body;
  const detailsErrMsg =
    typeof detailsErrBody?.message === 'string'
      ? detailsErrBody.message
      : typeof detailsErrBody === 'string'
        ? detailsErrBody
        : typeof detailsErrBody?.error === 'string'
          ? detailsErrBody.error
          : typeof detailsErrBody?.reason === 'string'
            ? detailsErrBody.reason
            : '';

  const requiredOutstanding = details?.summary?.requiredOutstanding ?? null;
  const requiredTotal = details?.summary?.requiredTotal ?? null;
  const requiredCompleted = details?.summary?.requiredCompleted ?? null;
  const checklistConfigured = typeof requiredTotal === 'number' ? requiredTotal > 0 : true;
  const readyToClose = Boolean(details?.summary?.readyToClose);
  const detailsIsOpen = details?.period?.status === 'OPEN';

  return (
    <div style={{ maxWidth: 900 }}>
      <h2>Accounting Periods</h2>

      <div style={{ marginTop: 12 }}>
        <button onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Reload'}
        </button>
        {canCreate ? (
          <button style={{ marginLeft: 8 }} onClick={() => setShowCreate(true)}>
            Create Period
          </button>
        ) : null}
      </div>

      {showCreate ? (
        <div style={{ marginTop: 12, padding: 12, border: '1px solid #ddd', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700 }}>Create Period</div>
            <button
              onClick={() => {
                if (createSubmitting) return;
                setShowCreate(false);
                setCreateError(null);
              }}
            >
              Close
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, marginTop: 10, maxWidth: 520 }}>
            <div style={{ fontSize: 12, color: '#444' }}>Code</div>
            <div>
              <input
                value={createDraft.code}
                onChange={(e) => setCreateDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. OB-2025 or JAN-2026"
              />
              <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
                Examples: OPENING = OB-2025. NORMAL = JAN-2026, FEB-2026.
              </div>
              {createDraft.code.trim().length > 0 && createDraft.code.trim().length < 3 ? (
                <div style={{ marginTop: 4, fontSize: 12, color: '#9a3412' }}>Code must be at least 3 characters.</div>
              ) : null}
            </div>

            <div style={{ fontSize: 12, color: '#444' }}>Type</div>
            <select
              value={createDraft.type}
              onChange={(e) => {
                const t = e.target.value as PeriodType;
                setCreateDraft((d) => {
                  const next = { ...d, type: t };
                  if (t === 'OPENING' && next.startDate) next.endDate = next.startDate;
                  return next;
                });
              }}
            >
              <option value="NORMAL">NORMAL</option>
              <option value="OPENING">OPENING</option>
            </select>

            <div style={{ fontSize: 12, color: '#444' }}>Start date</div>
            <input
              type="date"
              value={createDraft.startDate}
              onChange={(e) =>
                setCreateDraft((d) => {
                  const v = e.target.value;
                  const next = { ...d, startDate: v };
                  if (d.type === 'OPENING') next.endDate = v;
                  return next;
                })
              }
            />

            <div style={{ fontSize: 12, color: '#444' }}>End date</div>
            <input
              type="date"
              value={createDraft.endDate}
              disabled={createDraft.type === 'OPENING'}
              onChange={(e) => setCreateDraft((d) => ({ ...d, endDate: e.target.value }))}
            />
          </div>

          {createError ? (() => {
            const body = (createError as ApiError | any)?.body;
            const msg =
              typeof body?.message === 'string'
                ? body.message
                : typeof body === 'string'
                  ? body
                  : typeof body?.error === 'string'
                    ? body.error
                    : typeof body?.reason === 'string'
                      ? body.reason
                      : '';
            return (
              <div style={{ marginTop: 10, padding: 10, border: '1px solid #f3b2b2', background: '#fff0f0' }}>
                <div style={{ fontWeight: 700 }}>Could not create period</div>
                {msg ? <div style={{ marginTop: 6 }}>{msg}</div> : null}
                {debugApi ? <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{JSON.stringify(body ?? createError, null, 2)}</pre> : null}
              </div>
            );
          })() : null}

          <div style={{ marginTop: 10 }}>
            <button
              onClick={submitCreate}
              disabled={createSubmitting || createDraft.code.trim().length < 3}
              title={createDraft.code.trim().length < 3 ? 'Enter a code (min 3 characters)' : undefined}
            >
              {createSubmitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div style={{ marginTop: 12, padding: 12, border: '1px solid #f3b2b2', background: '#fff0f0' }}>
          <div style={{ fontWeight: 700 }}>Action failed</div>
          {errMsg ? <div style={{ marginTop: 6 }}>{errMsg}</div> : null}
          {debugApi ? <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{JSON.stringify(errBody ?? error, null, 2)}</pre> : null}
        </div>
      ) : null}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Code</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Type</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Start</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>End</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id}>
              <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{p.code ?? p.name}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{p.type}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{String(p.startDate).slice(0, 10)}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{String(p.endDate).slice(0, 10)}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                <StatusBadge status={p.status} />
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                <button onClick={() => void openDetails(p.id)} disabled={detailsOpen && detailsPeriodId === p.id && detailsLoading}>
                  Details
                </button>

                {p.status === 'OPEN' && canClose ? (
                  <button
                    style={{ marginLeft: 8 }}
                    disabled={
                      actionBusyId === p.id ||
                      !(
                        detailsPeriodId === p.id &&
                        details &&
                        details.period.status === 'OPEN' &&
                        readyToClose
                      )
                    }
                    onClick={() => void doClose(p.id)}
                    title={
                      !(detailsPeriodId === p.id && details)
                        ? 'Open Details to review and complete the period close checklist'
                        : detailsPeriodId === p.id && details && details.period.status === 'OPEN' && !readyToClose
                          ? 'Complete required checklist items before closing'
                          : undefined
                    }
                  >
                    {actionBusyId === p.id ? 'Closing…' : 'Close'}
                  </button>
                ) : null}

                {p.status === 'CLOSED' && canReopen ? (
                  <button style={{ marginLeft: 8 }} disabled={actionBusyId === p.id} onClick={() => void doReopen(p.id)}>
                    {actionBusyId === p.id ? 'Reopening…' : 'Reopen'}
                  </button>
                ) : null}

                {!canClose && !canReopen ? <span style={{ fontSize: 12, color: '#666' }}>View only</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {detailsOpen ? (
        <div style={{ marginTop: 14, padding: 12, border: '1px solid #ddd', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700 }}>Period Details</div>
            <button
              onClick={() => {
                if (detailsLoading) return;
                setDetailsOpen(false);
                setDetailsPeriodId(null);
                setDetails(null);
                setDetailsError(null);
              }}
            >
              Close
            </button>
          </div>

          {detailsLoading && !details ? <div style={{ marginTop: 10 }}>Loading…</div> : null}

          {!canViewChecklist ? (
            <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>
              You do not have permission to view the period close checklist.
            </div>
          ) : null}

          {!detailsLoading && details && canViewChecklist ? (
            <div style={{ marginTop: 10 }}>
              <div>
                <strong>Period:</strong> {details.period.name}
              </div>
              <div style={{ marginTop: 6 }}>
                <strong>Status:</strong> <StatusBadge status={details.period.status as any} />
              </div>
              <div style={{ marginTop: 6 }}>
                <strong>Close checklist:</strong>{' '}
                {typeof requiredCompleted === 'number' && typeof requiredTotal === 'number'
                  ? `${requiredCompleted}/${requiredTotal} required completed`
                  : `${details.items.filter((i) => i.completed).length}/${details.items.length} completed`}
              </div>

              {detailsIsOpen && !checklistConfigured ? (
                <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                  Checklist not configured. Please configure checklist before closing.
                </div>
              ) : null}

              {detailsIsOpen && checklistConfigured && !readyToClose ? (
                <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                  {typeof requiredCompleted === 'number' && typeof requiredTotal === 'number'
                    ? `Checklist incomplete: ${requiredCompleted} of ${requiredTotal} items completed.`
                    : 'Close is blocked until all required checklist items are completed.'}
                  {typeof requiredOutstanding === 'number' ? ` (${requiredOutstanding} outstanding)` : ''}
                </div>
              ) : null}
              {detailsIsOpen && readyToClose ? (
                <div style={{ marginTop: 8, fontSize: 12, color: '#14532d' }}>This period is ready to close.</div>
              ) : null}
              {!detailsIsOpen ? (
                <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>Checklist completion is locked because the period is not OPEN.</div>
              ) : null}
            </div>
          ) : null}

          {detailsError ? (
            <div style={{ marginTop: 12, padding: 12, border: '1px solid #f3b2b2', background: '#fff0f0' }}>
              <div style={{ fontWeight: 700 }}>Checklist error</div>
              {detailsErrMsg ? <div style={{ marginTop: 6 }}>{detailsErrMsg}</div> : null}
              {debugApi ? (
                <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(detailsErrBody ?? detailsError, null, 2)}
                </pre>
              ) : null}
            </div>
          ) : null}

          {details && details.items.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Item</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Required</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Completed</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Completed By</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Completed At</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {details.items.map((i) => {
                  const canMark = canCompleteChecklist && detailsIsOpen && !i.completed;
                  return (
                    <tr key={i.id}>
                      <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>
                        <div style={{ fontWeight: 600 }}>{i.label}</div>
                        <div style={{ opacity: 0.7, fontSize: 12 }}>{i.code}</div>
                      </td>
                      <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{i.required ? 'YES' : 'NO'}</td>
                      <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{i.completed ? 'YES' : 'NO'}</td>
                      <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{i.completedBy?.email ?? '-'}</td>
                      <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{i.completedAt ?? '-'}</td>
                      <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>
                        <button disabled={!canMark} onClick={() => void markChecklistItemComplete(i.id)}>
                          Mark complete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}

          {details && detailsIsOpen && !canCompleteChecklist ? (
            <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>
              You do not have permission to complete checklist items.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
