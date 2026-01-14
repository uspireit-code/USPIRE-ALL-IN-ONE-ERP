import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PERMISSIONS } from '../auth/permission-catalog';
import { getApiErrorMessage } from '../services/api';
import { getDashboardKpis, getDashboardTrends, type DashboardKpisResponse, type DashboardTrendsResponse } from '../services/dashboard';
import { Card } from '../components/Card';
import { KpiTile } from '../components/KpiTile';
import { Alert } from '../components/Alert';
import { tokens } from '../designTokens';

function formatAmount(n: number | null) {
  if (n === null) return 'N/A';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(n: number | null) {
  if (n === null) return 'N/A';
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

type LineChartProps = {
  title: string;
  points: Array<{ x: number; y: number | null }>;
  color: string;
};

function LineChart(props: LineChartProps) {
  const width = 560;
  const height = 160;
  const padding = 24;

  const COLORS = {
    white: '#FCFCFC',
    navy: '#0B0C1E',
  };

  const defined = props.points.filter((p) => typeof p.y === 'number') as Array<{ x: number; y: number }>;
  const minY = defined.length ? Math.min(...defined.map((p) => p.y)) : 0;
  const maxY = defined.length ? Math.max(...defined.map((p) => p.y)) : 0;
  const spanY = maxY - minY || 1;

  const minX = Math.min(...props.points.map((p) => p.x));
  const maxX = Math.max(...props.points.map((p) => p.x));
  const spanX = maxX - minX || 1;

  const scaleX = (x: number) => padding + ((x - minX) / spanX) * (width - padding * 2);
  const scaleY = (y: number) => height - padding - ((y - minY) / spanY) * (height - padding * 2);

  const path = defined
    .map((p, idx) => {
      const x = scaleX(p.x);
      const y = scaleY(p.y);
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <Card title={props.title} subtitle="Posted-only, month-by-month (future months omitted as null).">
      <svg width={width} height={height} style={{ display: 'block', background: COLORS.white, borderRadius: 10 }}>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke={tokens.colors.border.subtle} />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke={tokens.colors.border.subtle} />
        {path ? <path d={path} fill="none" stroke={props.color} strokeWidth={2.5} /> : null}
      </svg>
      <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>
        Posted-only, month-by-month (future months omitted as null).
      </div>
    </Card>
  );
}

export function ManagementDashboardPage() {
  const { hasPermission } = useAuth();

  if (!hasPermission(PERMISSIONS.DASHBOARD.VIEW)) {
    return <Navigate to="/" replace />;
  }

  const [kpis, setKpis] = useState<DashboardKpisResponse | null>(null);
  const [trends, setTrends] = useState<DashboardTrendsResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all([getDashboardKpis(), getDashboardTrends()])
      .then(([k, t]) => {
        if (cancelled) return;
        setKpis(k);
        setTrends(t);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(getApiErrorMessage(e, 'Failed to load dashboard'));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const trendSeries = useMemo(() => {
    const data = trends?.byMonth ?? [];
    return {
      revenue: data.map((p) => ({ x: p.month, y: p.revenue })),
      expenses: data.map((p) => ({ x: p.month, y: p.expenses })),
      profit: data.map((p) => ({ x: p.month, y: p.profit })),
    };
  }, [trends?.byMonth]);

  return (
    <div>
      {loading ? (
        <div style={{ marginTop: 16 }}>
          <Alert tone="info" title="Loading dashboard">Fetching KPIs and trends…</Alert>
        </div>
      ) : null}
      {error ? (
        <div style={{ marginTop: 16 }}>
          <Alert tone="error" title="Failed to load dashboard">{error}</Alert>
        </div>
      ) : null}

      {kpis ? (
        <div
          style={{
            marginTop: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          <KpiTile
            label="Revenue"
            value={formatAmount(kpis.kpis.revenue.ytd)}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 17l7-7 4 4 7-7" />
                <path d="M14 7h7v7" />
              </svg>
            }
            backgroundColor="#438105"
            secondary={
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'rgba(255,255,255,0.75)' }}>
                <span>YTD</span>
                <span>{formatAmount(kpis.kpis.revenue.ytd)}</span>
              </div>
            }
            footer={
              <Link
                to={`/reports/pnl`}
                style={{
                  color: '#FFFFFF',
                  fontWeight: 750,
                  textDecoration: 'none',
                  borderBottom: '1px solid transparent',
                  paddingBottom: 2,
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.75)';
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.borderBottomColor = 'transparent';
                }}
              >
                Drill-through: P&L
              </Link>
            }
          />

          <KpiTile
            label="Net Profit"
            value={formatAmount(kpis.kpis.netProfit.ytd)}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="M7 16v-6" />
                <path d="M12 16v-10" />
                <path d="M17 16v-4" />
              </svg>
            }
            backgroundColor="#DA6F05"
            secondary={
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, color: 'rgba(255,255,255,0.75)' }}>
                <div>
                  <div style={{ fontSize: 12 }}>YTD</div>
                  <div style={{ fontWeight: 800, color: '#FFFFFF' }}>{formatAmount(kpis.kpis.netProfit.ytd)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12 }}>MTD</div>
                  <div style={{ fontWeight: 800, color: '#FFFFFF' }}>{formatAmount(kpis.kpis.netProfit.mtd)}</div>
                </div>
              </div>
            }
            footer={
              <Link
                to={`/reports/pnl`}
                style={{
                  color: '#FFFFFF',
                  fontWeight: 750,
                  textDecoration: 'none',
                  borderBottom: '1px solid transparent',
                  paddingBottom: 2,
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.75)';
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.borderBottomColor = 'transparent';
                }}
              >
                Drill-through: P&L
              </Link>
            }
          />

          <KpiTile
            label="Cash (Cash Equivalents)"
            value={formatAmount(kpis.kpis.cashBalance)}
            backgroundColor="#7C00BA"
            footer={
              <Link
                to={`/reports/balance-sheet`}
                style={{
                  color: '#FFFFFF',
                  fontWeight: 750,
                  textDecoration: 'none',
                  borderBottom: '1px solid transparent',
                  paddingBottom: 2,
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.75)';
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.borderBottomColor = 'transparent';
                }}
              >
                Drill-through: Balance Sheet
              </Link>
            }
          />

          <KpiTile
            label="AR Balance"
            value={formatAmount(kpis.kpis.arBalance)}
            backgroundColor="#001FBA"
            footer={
              <Link
                to={`/reports/ar-aging`}
                style={{
                  color: '#FFFFFF',
                  fontWeight: 750,
                  textDecoration: 'none',
                  borderBottom: '1px solid transparent',
                  paddingBottom: 2,
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.75)';
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.borderBottomColor = 'transparent';
                }}
              >
                Drill-through: AR Aging
              </Link>
            }
          />

          <KpiTile
            label="AP Balance"
            value={formatAmount(kpis.kpis.apBalance)}
            backgroundColor="#F80404"
            footer={
              <Link
                to={`/reports/ap-aging`}
                style={{
                  color: '#FFFFFF',
                  fontWeight: 750,
                  textDecoration: 'none',
                  borderBottom: '1px solid transparent',
                  paddingBottom: 2,
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.75)';
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.borderBottomColor = 'transparent';
                }}
              >
                Drill-through: AP Aging
              </Link>
            }
          />

          <KpiTile
            label="Budget vs Actual"
            value={formatAmount(kpis.kpis.budgetVsActualYtd.actualTotalYtd)}
            backgroundColor="#BA005D"
            secondary={
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ color: 'rgba(255,255,255,0.75)' }}>
                  <div style={{ fontSize: 12 }}>Budget</div>
                  <div style={{ fontWeight: 800, color: '#FFFFFF' }}>{formatAmount(kpis.kpis.budgetVsActualYtd.budgetTotalYtd)}</div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.75)' }}>
                  <div style={{ fontSize: 12 }}>Variance</div>
                  <div style={{ fontWeight: 800, color: '#FFFFFF' }}>{formatAmount(kpis.kpis.budgetVsActualYtd.varianceAmountYtd)}</div>
                </div>
              </div>
            }
            footer={
              <Link
                to={`/budgets/vs-actual`}
                style={{
                  color: '#FFFFFF',
                  fontWeight: 750,
                  textDecoration: 'none',
                  borderBottom: '1px solid transparent',
                  paddingBottom: 2,
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.75)';
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.borderBottomColor = 'transparent';
                }}
              >
                Drill-through: Budget vs Actual
              </Link>
            }
          />

          <KpiTile
            label="Forecast vs Actual"
            value={formatAmount(kpis.kpis.forecastVsActualYtd.actualTotalYtd)}
            backgroundColor="#048D5F"
            style={{ gridColumn: '1 / -1' }}
            secondary={
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                <div style={{ color: 'rgba(255,255,255,0.75)' }}>
                  <div style={{ fontSize: 12 }}>Forecast</div>
                  <div style={{ fontWeight: 800, color: '#FFFFFF' }}>{formatAmount(kpis.kpis.forecastVsActualYtd.forecastTotalYtd)}</div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.75)' }}>
                  <div style={{ fontSize: 12 }}>Actual</div>
                  <div style={{ fontWeight: 800, color: '#FFFFFF' }}>{formatAmount(kpis.kpis.forecastVsActualYtd.actualTotalYtd)}</div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.75)' }}>
                  <div style={{ fontSize: 12 }}>Variance</div>
                  <div style={{ fontWeight: 800, color: '#FFFFFF' }}>{formatAmount(kpis.kpis.forecastVsActualYtd.varianceAmountYtd)}</div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.75)' }}>
                  <div style={{ fontSize: 12 }}>Variance %</div>
                  <div style={{ fontWeight: 800, color: '#FFFFFF' }}>{formatPct(kpis.kpis.forecastVsActualYtd.variancePercentYtd)}</div>
                </div>
              </div>
            }
            footer={
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link
                  to={`/reports/pnl`}
                  style={{
                    color: '#FFFFFF',
                    fontWeight: 750,
                    textDecoration: 'none',
                    borderBottom: '1px solid transparent',
                    paddingBottom: 2,
                  }}
                  onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                    e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.75)';
                  }}
                  onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                    e.currentTarget.style.borderBottomColor = 'transparent';
                  }}
                >
                  Drill-through: P&L
                </Link>
                {kpis.kpis.forecastVsActualYtd.forecastId ? (
                  <Link
                    to={`/forecasts/${kpis.kpis.forecastVsActualYtd.forecastId}`}
                    style={{
                      color: '#FFFFFF',
                      fontWeight: 750,
                      textDecoration: 'none',
                      borderBottom: '1px solid transparent',
                      paddingBottom: 2,
                    }}
                    onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                      e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.75)';
                    }}
                    onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                      e.currentTarget.style.borderBottomColor = 'transparent';
                    }}
                  >
                    Drill-through: Forecast
                  </Link>
                ) : null}
              </div>
            }
          />
        </div>
      ) : null}

      {trends ? (
        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
          <LineChart title="Revenue Trend" points={trendSeries.revenue} color="rgba(16,185,129,0.92)" />
          <LineChart title="Expenses Trend" points={trendSeries.expenses} color="rgba(245,158,11,0.92)" />
          <LineChart title="Profit Trend" points={trendSeries.profit} color="rgba(2,4,69,0.88)" />
        </div>
      ) : null}

      <div style={{ marginTop: 16, fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>
        Controls: posted-only actuals; budgets use ACTIVE budget; forecasts use APPROVED forecast; tenant isolation and RBAC enforced.
      </div>
    </div>
  );
}
