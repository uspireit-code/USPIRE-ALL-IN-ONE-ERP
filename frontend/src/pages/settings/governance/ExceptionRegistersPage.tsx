import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { DataTable } from '../../../components/DataTable';
import { EmptyState } from '../../../components/EmptyState';
import { Input } from '../../../components/Input';
import { NoticeCard } from '../../../components/NoticeCard';
import { SettingsPageHeader } from '../../../components/settings/SettingsPageHeader';
import { tokens } from '../../../designTokens';
import { getApiErrorMessage } from '../../../services/api';
import {
  listGovernanceEvidenceRegister,
  listGovernanceExceptionRegister,
  listGovernanceOverrideSessionsRegister,
  type GovernanceEvidenceRegisterRow,
  type GovernanceExceptionRegisterRow,
  type GovernanceOverrideSessionRegisterRow,
} from '../../../services/governanceRegisters';

type TabKey = 'EXCEPTIONS' | 'OVERRIDES' | 'EVIDENCE';

function formatDateTime(value: string | null | undefined) {
  const v = String(value ?? '').trim();
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

function toIsoDayStart(yyyyMmDd: string) {
  const v = String(yyyyMmDd ?? '').trim();
  if (!v) return '';
  return new Date(`${v}T00:00:00.000Z`).toISOString();
}

function toIsoDayEnd(yyyyMmDd: string) {
  const v = String(yyyyMmDd ?? '').trim();
  if (!v) return '';
  return new Date(`${v}T23:59:59.999Z`).toISOString();
}

function buildDrillUrl(params: { entityType?: string | null; entityId?: string | null }) {
  const t = String(params.entityType ?? '').trim();
  const id = String(params.entityId ?? '').trim();
  if (!t || !id) return null;

  if (t === 'JOURNAL_ENTRY') return `/finance/gl/journals/${encodeURIComponent(id)}`;
  if (t === 'GOVERNANCE_OVERRIDE_SESSION') return `/settings/governance/override-sessions`;
  return null;
}

export function ExceptionRegistersPage() {
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabKey>('EXCEPTIONS');

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const [query, setQuery] = useState('');
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [exceptions, setExceptions] = useState<GovernanceExceptionRegisterRow[]>([]);
  const [overrideRows, setOverrideRows] = useState<GovernanceOverrideSessionRegisterRow[]>([]);
  const [evidenceRows, setEvidenceRows] = useState<GovernanceEvidenceRegisterRow[]>([]);

  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);

  const fromIso = useMemo(() => toIsoDayStart(from), [from]);
  const toIso = useMemo(() => toIsoDayEnd(to), [to]);

  async function refresh(nextOffset?: number) {
    setLoading(true);
    setError(null);

    const effectiveOffset = typeof nextOffset === 'number' ? nextOffset : offset;

    try {
      if (tab === 'EXCEPTIONS') {
        const res = await listGovernanceExceptionRegister({
          from: fromIso || undefined,
          to: toIso || undefined,
          category: query.trim() || undefined,
          entityType: entityType.trim() || undefined,
          entityId: entityId.trim() || undefined,
          offset: effectiveOffset,
          limit,
        });
        setTotal(res.total ?? 0);
        setExceptions(Array.isArray(res.rows) ? res.rows : []);
        setOverrideRows([]);
        setEvidenceRows([]);
      }

      if (tab === 'OVERRIDES') {
        const res = await listGovernanceOverrideSessionsRegister({
          from: fromIso || undefined,
          to: toIso || undefined,
          status: query.trim() || undefined,
          overrideCode: entityType.trim() || undefined,
          requestedById: entityId.trim() || undefined,
          offset: effectiveOffset,
          limit,
        });
        setTotal(res.total ?? 0);
        setOverrideRows(Array.isArray(res.rows) ? res.rows : []);
        setExceptions([]);
        setEvidenceRows([]);
      }

      if (tab === 'EVIDENCE') {
        const res = await listGovernanceEvidenceRegister({
          from: fromIso || undefined,
          to: toIso || undefined,
          entityType: entityType.trim() || undefined,
          entityId: entityId.trim() || undefined,
          evidenceCategory: query.trim() || undefined,
          offset: effectiveOffset,
          limit,
        });
        setTotal(res.total ?? 0);
        setEvidenceRows(Array.isArray(res.rows) ? res.rows : []);
        setExceptions([]);
        setOverrideRows([]);
      }

      setOffset(effectiveOffset);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load governance registers'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setOffset(0);
    void refresh(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    setOffset(0);
    void refresh(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, limit]);

  const headerActions = (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <Button size="sm" variant="ghost" onClick={() => navigate('/settings')}>
        Back
      </Button>
      <Button size="sm" variant="secondary" onClick={() => refresh()} disabled={loading}>
        Refresh
      </Button>
    </div>
  );

  const tabs = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Button size="sm" variant={tab === 'EXCEPTIONS' ? 'accent' : 'secondary'} onClick={() => setTab('EXCEPTIONS')}>
        Exceptions
      </Button>
      <Button size="sm" variant={tab === 'OVERRIDES' ? 'accent' : 'secondary'} onClick={() => setTab('OVERRIDES')}>
        Override Sessions
      </Button>
      <Button size="sm" variant={tab === 'EVIDENCE' ? 'accent' : 'secondary'} onClick={() => setTab('EVIDENCE')}>
        Evidence
      </Button>
    </div>
  );

  const pager = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>
        Total: <span style={{ color: tokens.colors.text.primary, fontWeight: 700 }}>{total}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => refresh(Math.max(0, offset - limit))}
          disabled={loading || offset <= 0}
        >
          Prev
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => refresh(offset + limit)}
          disabled={loading || offset + limit >= total}
        >
          Next
        </Button>
        <div style={{ width: 120 }}>
          <Input
            value={String(limit)}
            onChange={(e) => {
              const v = Number(e.currentTarget.value);
              if (!Number.isFinite(v) || v < 1) return;
              setLimit(Math.min(200, Math.max(1, Math.round(v))));
            }}
            placeholder="Limit"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <SettingsPageHeader
        title="Exception Registers"
        subtitle="Operational governance registers for blocked actions, overrides, and evidence. Filterable, auditable, and drillable."
        rightSlot={headerActions}
      />

      <div style={{ marginTop: 14 }}>{tabs}</div>

      {error ? (
        <div style={{ marginTop: 14 }}>
          <NoticeCard kind="system" title="Unable to load governance registers">
            {error}
          </NoticeCard>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 14, marginTop: 14 }}>
        <div style={{ gridColumn: 'span 12' }}>
          <Card
            title="Filters"
            subtitle={
              tab === 'EXCEPTIONS'
                ? 'Category maps to backend register category (e.g. SOD, LIFECYCLE, IMMUTABILITY, OVERRIDE, EVIDENCE, AUTOMATION).'
                : tab === 'OVERRIDES'
                  ? 'Query = status, Override Code = overrideCode, Requested By = requestedById.'
                  : 'Query = evidenceCategory.'
            }
            actions={
              <Button size="sm" variant="secondary" onClick={() => refresh(0)} disabled={loading}>
                Apply
              </Button>
            }
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
              <div style={{ gridColumn: 'span 3' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>From (UTC)</div>
                <div style={{ marginTop: 6 }}>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.currentTarget.value)} />
                </div>
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>To (UTC)</div>
                <div style={{ marginTop: 6 }}>
                  <Input type="date" value={to} onChange={(e) => setTo(e.currentTarget.value)} />
                </div>
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Query</div>
                <div style={{ marginTop: 6 }}>
                  <Input value={query} onChange={(e) => setQuery(e.currentTarget.value)} placeholder={tab === 'EXCEPTIONS' ? 'Category' : tab === 'OVERRIDES' ? 'Status' : 'Evidence category'} />
                </div>
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>
                  {tab === 'OVERRIDES' ? 'Override Code' : 'Entity Type'}
                </div>
                <div style={{ marginTop: 6 }}>
                  <Input value={entityType} onChange={(e) => setEntityType(e.currentTarget.value)} placeholder={tab === 'OVERRIDES' ? 'overrideCode' : 'JOURNAL_ENTRY'} />
                </div>
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>
                  {tab === 'OVERRIDES' ? 'Requested By' : 'Entity Id'}
                </div>
                <div style={{ marginTop: 6 }}>
                  <Input value={entityId} onChange={(e) => setEntityId(e.currentTarget.value)} placeholder={tab === 'OVERRIDES' ? 'requestedById' : 'entityId'} />
                </div>
              </div>
              <div style={{ gridColumn: 'span 9' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Pagination</div>
                <div style={{ marginTop: 6 }}>{pager}</div>
              </div>
            </div>
          </Card>
        </div>

        <div style={{ gridColumn: 'span 12' }}>
          <Card title="Register" subtitle={loading ? 'Loading…' : undefined}>
            <DataTable>
              <DataTable.Head sticky>
                <DataTable.Row>
                  {tab === 'EXCEPTIONS' ? (
                    <>
                      <DataTable.Th>When</DataTable.Th>
                      <DataTable.Th>Event</DataTable.Th>
                      <DataTable.Th>Outcome</DataTable.Th>
                      <DataTable.Th>User</DataTable.Th>
                      <DataTable.Th>Entity</DataTable.Th>
                      <DataTable.Th>Reason</DataTable.Th>
                    </>
                  ) : null}

                  {tab === 'OVERRIDES' ? (
                    <>
                      <DataTable.Th>When</DataTable.Th>
                      <DataTable.Th>Status</DataTable.Th>
                      <DataTable.Th>Override Code</DataTable.Th>
                      <DataTable.Th>Entry Point</DataTable.Th>
                      <DataTable.Th>Entity</DataTable.Th>
                    </>
                  ) : null}

                  {tab === 'EVIDENCE' ? (
                    <>
                      <DataTable.Th>When</DataTable.Th>
                      <DataTable.Th>File</DataTable.Th>
                      <DataTable.Th>Entity</DataTable.Th>
                      <DataTable.Th>Category</DataTable.Th>
                      <DataTable.Th>Governance</DataTable.Th>
                      <DataTable.Th>Uploaded By</DataTable.Th>
                    </>
                  ) : null}
                </DataTable.Row>
              </DataTable.Head>

              <DataTable.Body>
                {tab === 'EXCEPTIONS' && exceptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '20px 12px' }}>
                      <EmptyState
                        title="No exception events for the selected period"
                        description="Try expanding the date range or removing filters (Category / Entity) to view more governance events."
                        primaryAction={{
                          label: 'Refresh',
                          onClick: () => refresh(0),
                          disabled: loading,
                        }}
                      />
                    </td>
                  </tr>
                ) : null}
                {tab === 'OVERRIDES' && overrideRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '20px 12px' }}>
                      <EmptyState
                        title="No override sessions for the selected period"
                        description="Try adjusting the date range or clearing the status / override code filters."
                        primaryAction={{
                          label: 'Refresh',
                          onClick: () => refresh(0),
                          disabled: loading,
                        }}
                      />
                    </td>
                  </tr>
                ) : null}
                {tab === 'EVIDENCE' && evidenceRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '20px 12px' }}>
                      <EmptyState
                        title="No evidence files for the selected period"
                        description="Evidence appears here when uploaded against a transaction or governance action. Adjust filters or expand the date range to see more."
                        primaryAction={{
                          label: 'Refresh',
                          onClick: () => refresh(0),
                          disabled: loading,
                        }}
                      />
                    </td>
                  </tr>
                ) : null}

                {tab === 'EXCEPTIONS'
                  ? (exceptions ?? []).map((r, idx) => {
                      const drill = buildDrillUrl({ entityType: r.entityType, entityId: r.entityId });
                      return (
                        <DataTable.Row
                          key={r.id}
                          zebra
                          index={idx}
                          hoverable
                          onClick={() => {
                            if (!drill) return;
                            navigate(drill);
                          }}
                          style={drill ? { cursor: 'pointer' } : undefined}
                        >
                          <DataTable.Td>{formatDateTime(r.createdAt)}</DataTable.Td>
                          <DataTable.Td>{r.eventType}</DataTable.Td>
                          <DataTable.Td>{r.outcome}</DataTable.Td>
                          <DataTable.Td>{r.user?.email ?? '—'}</DataTable.Td>
                          <DataTable.Td>
                            <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>{r.entityType}</div>
                            <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 12 }}>{r.entityId}</div>
                          </DataTable.Td>
                          <DataTable.Td>
                            <div style={{ maxWidth: 520, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {r.reason ?? '—'}
                            </div>
                          </DataTable.Td>
                        </DataTable.Row>
                      );
                    })
                  : null}

                {tab === 'OVERRIDES'
                  ? (overrideRows ?? []).map((r, idx) => {
                      const drill = buildDrillUrl({ entityType: (r as any).entityType, entityId: (r as any).entityId });
                      return (
                        <DataTable.Row
                          key={String(r.id ?? idx)}
                          zebra
                          index={idx}
                          hoverable
                          onClick={() => {
                            if (!drill) return;
                            navigate(drill);
                          }}
                          style={drill ? { cursor: 'pointer' } : undefined}
                        >
                          <DataTable.Td>{formatDateTime((r as any).createdAt)}</DataTable.Td>
                          <DataTable.Td>{String((r as any).status ?? '—')}</DataTable.Td>
                          <DataTable.Td>{String((r as any).overrideCode ?? '—')}</DataTable.Td>
                          <DataTable.Td>{String((r as any).entryPoint ?? '—')}</DataTable.Td>
                          <DataTable.Td>
                            <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>{String((r as any).entityType ?? '—')}</div>
                            <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 12 }}>{String((r as any).entityId ?? '—')}</div>
                          </DataTable.Td>
                        </DataTable.Row>
                      );
                    })
                  : null}

                {tab === 'EVIDENCE'
                  ? (evidenceRows ?? []).map((r, idx) => {
                      const drill = buildDrillUrl({ entityType: r.entityType, entityId: r.entityId });
                      return (
                        <DataTable.Row
                          key={r.id}
                          zebra
                          index={idx}
                          hoverable
                          onClick={() => {
                            if (!drill) return;
                            navigate(drill);
                          }}
                          style={drill ? { cursor: 'pointer' } : undefined}
                        >
                          <DataTable.Td>{formatDateTime(r.createdAt)}</DataTable.Td>
                          <DataTable.Td>
                            <div style={{ fontWeight: 700 }}>{r.fileName}</div>
                            <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>{r.mimeType}</div>
                          </DataTable.Td>
                          <DataTable.Td>
                            <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>{r.entityType}</div>
                            <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 12 }}>{r.entityId}</div>
                          </DataTable.Td>
                          <DataTable.Td>{r.evidenceCategory ?? '—'}</DataTable.Td>
                          <DataTable.Td>
                            <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>{r.governanceDomain ?? '—'}</div>
                            <div style={{ fontSize: 12 }}>{r.governanceActionType ?? '—'}</div>
                          </DataTable.Td>
                          <DataTable.Td>{r.uploadedBy?.email ?? '—'}</DataTable.Td>
                        </DataTable.Row>
                      );
                    })
                  : null}
              </DataTable.Body>
            </DataTable>
          </Card>
        </div>
      </div>
    </div>
  );
}
