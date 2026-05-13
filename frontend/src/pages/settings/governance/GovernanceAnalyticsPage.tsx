import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../../auth/AuthContext';
import { PERMISSIONS } from '../../../auth/permission-catalog';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { DataTable } from '../../../components/DataTable';
import { Input } from '../../../components/Input';
import { SettingsPageHeader } from '../../../components/settings/SettingsPageHeader';
import { tokens } from '../../../designTokens';
import { getApiErrorMessage } from '../../../services/api';
import {
  drillGovernanceKpi,
  getGovernanceKpiSummaries,
  getGovernanceKpiTrend,
  listGovernanceKpis,
  type GovernanceKpiDefinition,
  type GovernanceKpiResult,
  type GovernanceKpiTrendBucket,
} from '../../../services/governanceAnalytics';

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatSeconds(value: number) {
  if (!Number.isFinite(value)) return '—';
  const s = Math.max(0, Math.round(value));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function severityColor(severity: string) {
  const s = String(severity ?? '').toUpperCase();
  if (s === 'CRITICAL') return '#B42318';
  if (s === 'HIGH') return '#B54708';
  if (s === 'MEDIUM') return '#175CD3';
  return '#027A48';
}

function isLatencyKpi(kpiCode: string) {
  return (
    kpiCode.includes('AVG_SECONDS') ||
    kpiCode.includes('LATENCY') ||
    kpiCode.includes('TURNAROUND') ||
    kpiCode.includes('RESOLUTION')
  );
}

function isRateKpi(kpiCode: string) {
  return kpiCode.includes('RATE') || kpiCode.includes('FREQUENCY') || kpiCode.includes('SUCCESS_RATE');
}

function formatKpiValue(def: GovernanceKpiDefinition, result: GovernanceKpiResult) {
  const v = Number(result.value ?? 0);
  if (isLatencyKpi(def.kpiCode)) return formatSeconds(v);
  if (isRateKpi(def.kpiCode)) return `${(v * 100).toFixed(2)}%`;
  return String(Math.round(v));
}

export function GovernanceAnalyticsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManage = hasPermission((PERMISSIONS as any).GOVERNANCE?.FINANCIAL?.MANAGE);

  const [definitions, setDefinitions] = useState<GovernanceKpiDefinition[]>([]);
  const [selected, setSelected] = useState<string>('');

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });

  const [bucket, setBucket] = useState<GovernanceKpiTrendBucket>('DAY');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [summaries, setSummaries] = useState<Array<{ definition: GovernanceKpiDefinition; result: GovernanceKpiResult }>>([]);
  const [trend, setTrend] = useState<any | null>(null);
  const [drill, setDrill] = useState<any | null>(null);

  const selectedDef = useMemo(() => {
    return definitions.find((d) => d.kpiCode === selected) ?? null;
  }, [definitions, selected]);

  async function loadRegistry() {
    const defs = await listGovernanceKpis();
    setDefinitions(Array.isArray(defs) ? defs : []);
    if (!selected && Array.isArray(defs) && defs.length > 0) {
      setSelected(defs[0].kpiCode);
    }
  }

  async function refreshSummaries() {
    setLoading(true);
    setError(null);
    try {
      const res = await getGovernanceKpiSummaries({
        from: new Date(`${from}T00:00:00.000Z`).toISOString(),
        to: new Date(`${to}T00:00:00.000Z`).toISOString(),
      });
      setSummaries(res.results ?? []);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load KPI summaries'));
    } finally {
      setLoading(false);
    }
  }

  async function refreshTrendAndDrill() {
    if (!selectedDef) return;
    setLoading(true);
    setError(null);
    setTrend(null);
    setDrill(null);
    try {
      const fromIso = new Date(`${from}T00:00:00.000Z`).toISOString();
      const toIso = new Date(`${to}T00:00:00.000Z`).toISOString();

      if (selectedDef.trendSupport) {
        const t = await getGovernanceKpiTrend({
          kpiCode: selectedDef.kpiCode,
          from: fromIso,
          to: toIso,
          bucket,
        });
        setTrend(t);
      }

      if (selectedDef.drillThroughSupported) {
        const d = await drillGovernanceKpi({
          kpiCode: selectedDef.kpiCode,
          from: fromIso,
          to: toIso,
          take: 100,
        });
        setDrill(d);
      }
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load KPI detail'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRegistry().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refreshSummaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  useEffect(() => {
    void refreshTrendAndDrill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, from, to, bucket]);

  const summaryMap = useMemo(() => {
    const m = new Map<string, { definition: GovernanceKpiDefinition; result: GovernanceKpiResult }>();
    for (const r of summaries ?? []) {
      m.set(r.definition.kpiCode, r);
    }
    return m;
  }, [summaries]);

  const headerActions = (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <Button size="sm" variant="ghost" onClick={() => navigate('/settings')}>
        Back
      </Button>
      <Button size="sm" variant="secondary" onClick={refreshSummaries} disabled={loading}>
        Refresh
      </Button>
      <Button size="sm" variant="secondary" onClick={refreshTrendAndDrill} disabled={loading}>
        Refresh Detail
      </Button>
      {canManage ? null : (
        <span style={{ fontSize: 12, color: tokens.colors.text.muted }}>View-only</span>
      )}
    </div>
  );

  return (
    <div>
      <SettingsPageHeader
        title="Governance Analytics"
        subtitle="Explainable, drillable governance intelligence foundation. KPI registry, trends, backlog aging, and traceable drill-through datasets."
        rightSlot={headerActions}
      />

      {error ? (
        <div style={{ marginTop: 14 }}>
          <Alert tone="error" title="Error">
            {error}
          </Alert>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 14, marginTop: 14 }}>
        <div style={{ gridColumn: 'span 12' }}>
          <Card title="Time Window" subtitle="All KPI computations are time-windowed and auditable.">
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
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Trend Bucket</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(['DAY', 'WEEK', 'MONTH'] as GovernanceKpiTrendBucket[]).map((b) => (
                    <Button
                      key={b}
                      size="sm"
                      variant={bucket === b ? 'accent' : 'secondary'}
                      onClick={() => setBucket(b)}
                    >
                      {b}
                    </Button>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Selected KPI</div>
                <div style={{ marginTop: 6 }}>
                  <select
                    value={selected}
                    onChange={(e) => setSelected(e.currentTarget.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: `1px solid ${tokens.colors.border.subtle}`,
                      background: '#fff',
                      fontSize: 13,
                    }}
                  >
                    {definitions.map((d) => (
                      <option key={d.kpiCode} value={d.kpiCode}>
                        {d.displayName} ({d.kpiCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div style={{ gridColumn: 'span 12' }}>
          <Card title="KPI Summary" subtitle="Registry-driven KPI set. Each KPI is defined centrally and computed consistently.">
            <DataTable>
              <DataTable.Head sticky>
                <DataTable.Row>
                  <DataTable.Th>Severity</DataTable.Th>
                  <DataTable.Th>KPI</DataTable.Th>
                  <DataTable.Th>Value</DataTable.Th>
                  <DataTable.Th>Numerator</DataTable.Th>
                  <DataTable.Th>Denominator</DataTable.Th>
                  <DataTable.Th align="right">Inspect</DataTable.Th>
                </DataTable.Row>
              </DataTable.Head>
              <DataTable.Body>
                {definitions.length === 0 ? (
                  <DataTable.Empty colSpan={6} title={loading ? 'Loading…' : 'No KPI definitions found.'} />
                ) : (
                  definitions.map((def, idx) => {
                    const row = summaryMap.get(def.kpiCode);
                    const result = row?.result;

                    return (
                      <DataTable.Row key={def.kpiCode} zebra index={idx}>
                        <DataTable.Td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: 12,
                              fontWeight: 900,
                              color: severityColor(def.severity),
                            }}
                          >
                            {String(def.severity).toUpperCase()}
                          </span>
                        </DataTable.Td>
                        <DataTable.Td>
                          <div style={{ fontWeight: 900, fontSize: 13 }}>{def.displayName}</div>
                          <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>{def.kpiCode}</div>
                        </DataTable.Td>
                        <DataTable.Td>
                          <div style={{ fontSize: 13, fontWeight: 900 }}>
                            {result ? formatKpiValue(def, result) : '—'}
                          </div>
                        </DataTable.Td>
                        <DataTable.Td>
                          <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>{result?.numerator ?? '—'}</div>
                        </DataTable.Td>
                        <DataTable.Td>
                          <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>{result?.denominator ?? '—'}</div>
                        </DataTable.Td>
                        <DataTable.Td align="right">
                          <Button size="sm" variant={selected === def.kpiCode ? 'accent' : 'secondary'} onClick={() => setSelected(def.kpiCode)}>
                            Inspect
                          </Button>
                        </DataTable.Td>
                      </DataTable.Row>
                    );
                  })
                )}
              </DataTable.Body>
            </DataTable>
          </Card>
        </div>

        <div style={{ gridColumn: 'span 12' }}>
          <Card
            title="Trend (Explainable Series)"
            subtitle="Trend points are produced by re-running the KPI computation per time bucket. Not a cached chart widget."
          >
            {!trend ? (
              <div style={{ fontSize: 13, color: tokens.colors.text.muted }}>
                {selectedDef?.trendSupport ? (loading ? 'Loading trend…' : 'No trend data loaded.') : 'Trend not supported for selected KPI.'}
              </div>
            ) : (
              <DataTable>
                <DataTable.Head sticky>
                  <DataTable.Row>
                    <DataTable.Th>Bucket Start</DataTable.Th>
                    <DataTable.Th>Value</DataTable.Th>
                    <DataTable.Th>Numerator</DataTable.Th>
                    <DataTable.Th>Denominator</DataTable.Th>
                  </DataTable.Row>
                </DataTable.Head>
                <DataTable.Body>
                  {(trend.points ?? []).length === 0 ? (
                    <DataTable.Empty colSpan={4} title="No points" />
                  ) : (
                    (trend.points ?? []).map((p: any, idx: number) => (
                      <DataTable.Row key={String(p.ts)} zebra index={idx}>
                        <DataTable.Td>
                          <div style={{ fontSize: 12 }}>{formatDateTime(String(p.ts))}</div>
                        </DataTable.Td>
                        <DataTable.Td>
                          <div style={{ fontSize: 13, fontWeight: 900 }}>
                            {selectedDef ? formatKpiValue(selectedDef, { kpiCode: selectedDef.kpiCode, value: p.value } as any) : String(p.value)}
                          </div>
                        </DataTable.Td>
                        <DataTable.Td>
                          <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>{p.numerator ?? '—'}</div>
                        </DataTable.Td>
                        <DataTable.Td>
                          <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>{p.denominator ?? '—'}</div>
                        </DataTable.Td>
                      </DataTable.Row>
                    ))
                  )}
                </DataTable.Body>
              </DataTable>
            )}
          </Card>
        </div>

        <div style={{ gridColumn: 'span 12' }}>
          <Card
            title="Drill-through"
            subtitle="Traceability layer: explains the KPI by listing the governed entities behind the value."
          >
            {!drill ? (
              <div style={{ fontSize: 13, color: tokens.colors.text.muted }}>
                {selectedDef?.drillThroughSupported ? (loading ? 'Loading drill-through…' : 'No drill-through data loaded.') : 'Drill-through not supported for selected KPI.'}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Target: {drill.target}</div>
                <div style={{ marginTop: 12 }}>
                  <pre
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      border: `1px solid ${tokens.colors.border.subtle}`,
                      background: tokens.colors.surface.subtle,
                      overflowX: 'auto',
                      fontSize: 12,
                      lineHeight: '18px',
                    }}
                  >
                    {JSON.stringify({ count: drill.count }, null, 2)}
                  </pre>
                </div>
                <div style={{ marginTop: 12 }}>
                  <DataTable>
                    <DataTable.Head sticky>
                      <DataTable.Row>
                        <DataTable.Th>ID</DataTable.Th>
                        <DataTable.Th>Status</DataTable.Th>
                        <DataTable.Th>Created/Submitted</DataTable.Th>
                        <DataTable.Th>Link</DataTable.Th>
                      </DataTable.Row>
                    </DataTable.Head>
                    <DataTable.Body>
                      {(drill.rows ?? []).length === 0 ? (
                        <DataTable.Empty colSpan={4} title="No rows" />
                      ) : (
                        (drill.rows ?? []).map((r: any, idx: number) => {
                          const id = String(r.id ?? '');
                          const status = String(r.status ?? r.executionStatus ?? r.scheduleStatus ?? '—');
                          const when = String(r.submittedAt ?? r.createdAt ?? r.startedAt ?? '');

                          return (
                            <DataTable.Row key={id || String(idx)} zebra index={idx}>
                              <DataTable.Td>
                                <div style={{ fontSize: 12, fontWeight: 800 }}>{id || '—'}</div>
                              </DataTable.Td>
                              <DataTable.Td>
                                <div style={{ fontSize: 12 }}>{status}</div>
                              </DataTable.Td>
                              <DataTable.Td>
                                <div style={{ fontSize: 12 }}>{when ? formatDateTime(when) : '—'}</div>
                              </DataTable.Td>
                              <DataTable.Td>
                                {drill.target === 'OVERRIDE_SESSIONS' ? (
                                  <Button size="sm" variant="secondary" onClick={() => navigate('/settings/governance/override-sessions')}>
                                    Open
                                  </Button>
                                ) : drill.target === 'AUTOMATION_EXECUTION_SESSIONS' ? (
                                  <Button size="sm" variant="secondary" onClick={() => navigate('/settings/governance/automation')}>
                                    Open
                                  </Button>
                                ) : drill.target === 'AUTOMATION_SCHEDULES' ? (
                                  <Button size="sm" variant="secondary" onClick={() => navigate('/settings/governance/automation')}>
                                    Open
                                  </Button>
                                ) : (
                                  <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>—</div>
                                )}
                              </DataTable.Td>
                            </DataTable.Row>
                          );
                        })
                      )}
                    </DataTable.Body>
                  </DataTable>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
