import { useEffect, useMemo, useState } from 'react';
import { Alert } from '../../components/Alert';
import { Card } from '../../components/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { tokens } from '../../designTokens';
import { getApiErrorMessage } from '../../services/api';
import { getCoaHealth, type CoaHealthResponse } from '../../services/coaHealth';

function clampScore(v: any): number {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function SummaryMetricCard(props: { label: string; value: number }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 750, color: tokens.colors.text.secondary }}>{props.label}</div>
      <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900, color: tokens.colors.text.primary }}>
        {props.value}
      </div>
    </Card>
  );
}

function IssuePanel(props: { title: string; count: number; tone: 'good' | 'warn' | 'bad' }) {
  const tone = props.tone;
  const badgeState = tone === 'good' ? 'ACTIVE' : tone === 'warn' ? 'DRAFT' : 'BLOCKED';
  const count = Math.max(0, Number(props.count ?? 0));
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontWeight: 800, color: tokens.colors.text.primary }}>{props.title}</div>
        <StatusBadge
          state={badgeState}
          label={tone === 'good' ? 'OK' : tone === 'warn' ? 'ATTENTION' : 'ACTION'}
        />
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div
          style={{
            fontSize: 30,
            fontWeight: 900,
            color: tokens.colors.text.primary,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }}
        >
          {count}
        </div>
        <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>items</div>
      </div>
    </Card>
  );
}

export function CoaHealthPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<CoaHealthResponse | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await getCoaHealth();
      setHealth(res);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to load COA health dashboard'));
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const summary = useMemo(() => {
    if (!health) return null;
    const counts = health.summary.statusCounts ?? {};
    return {
      totalAccounts: Number(health.summary.totalAccountCount ?? 0),
      activeAccounts: Number((counts as any).ACTIVE ?? 0),
      draftAccounts: Number((counts as any).DRAFT ?? 0),
      blockedAccounts: Number((counts as any).BLOCKED ?? 0),
      retiredAccounts: Number((counts as any).RETIRED ?? 0),
    };
  }, [health]);

  const issues = useMemo(() => {
    if (!health) return null;
    return {
      postingAccountsMissingIfrs: Number(health.completeness.postingAccountsMissingIfrsNodeCount ?? 0),
      duplicateCodeCount: Number(health.naming.duplicateCodeCount ?? 0),
      duplicateNameCount: Number(health.naming.duplicateNormalizedNameCount ?? 0),
      orphanAccounts: Number(health.structural.orphanAccountCount ?? 0),
      pendingApprovals: Number(health.governance.pendingApprovalRequestCount ?? 0),
      pendingStructureCRs: Number(health.governance.pendingStructureChangeRequestCount ?? 0),
      futureDatedChanges: Number(health.governance.futureDatedStructuralChangeCount ?? 0),
    };
  }, [health]);

  return (
    <div className="financePage" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 850, color: tokens.colors.text.primary }}>COA Health & Governance</div>
        </div>
        {health ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatusBadge
              state={health.structureFreeze.coaStructureFrozen ? 'BLOCKED' : 'ACTIVE'}
              label={health.structureFreeze.coaStructureFrozen ? 'STRUCTURE FROZEN' : 'STRUCTURE UNFROZEN'}
            />
          </div>
        ) : null}
      </div>

      {error ? (
        <Alert tone="error" title="Error">
          {error}
        </Alert>
      ) : null}

      {loading && !health ? <div style={{ color: tokens.colors.text.secondary }}>Loading…</div> : null}

      {!loading && !health && !error ? <div style={{ color: tokens.colors.text.secondary }}>No data.</div> : null}

      {health ? (
        <>
          <Card>
            <div>
              <div style={{ fontSize: 12, fontWeight: 750, color: tokens.colors.text.secondary }}>Health Score</div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 64,
                  fontWeight: 950,
                  letterSpacing: -1.2,
                  color: tokens.colors.text.primary,
                }}
              >
                {clampScore(health.healthScore)}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.secondary }}>/ 100</div>
            </div>
          </Card>

          {summary ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                gap: 12,
              }}
            >
              <SummaryMetricCard label="Total Accounts" value={summary.totalAccounts} />
              <SummaryMetricCard label="Active Accounts" value={summary.activeAccounts} />
              <SummaryMetricCard label="Draft Accounts" value={summary.draftAccounts} />
              <SummaryMetricCard label="Blocked Accounts" value={summary.blockedAccounts} />
              <SummaryMetricCard label="Retired Accounts" value={summary.retiredAccounts} />
            </div>
          ) : null}

          {issues ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              <IssuePanel
                title="Posting accounts missing IFRS"
                count={issues.postingAccountsMissingIfrs}
                tone={issues.postingAccountsMissingIfrs === 0 ? 'good' : 'bad'}
              />
              <IssuePanel
                title="Duplicate account codes"
                count={issues.duplicateCodeCount}
                tone={issues.duplicateCodeCount === 0 ? 'good' : 'bad'}
              />
              <IssuePanel
                title="Duplicate account names"
                count={issues.duplicateNameCount}
                tone={issues.duplicateNameCount === 0 ? 'good' : 'warn'}
              />
              <IssuePanel
                title="Orphan accounts"
                count={issues.orphanAccounts}
                tone={issues.orphanAccounts === 0 ? 'good' : 'bad'}
              />
              <IssuePanel
                title="Pending approvals"
                count={issues.pendingApprovals}
                tone={issues.pendingApprovals === 0 ? 'good' : 'warn'}
              />
              <IssuePanel
                title="Pending structure CRs"
                count={issues.pendingStructureCRs}
                tone={issues.pendingStructureCRs === 0 ? 'good' : 'warn'}
              />
              <IssuePanel
                title="Future-dated changes"
                count={issues.futureDatedChanges}
                tone={issues.futureDatedChanges === 0 ? 'good' : 'warn'}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
