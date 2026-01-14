import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PERMISSIONS } from '../auth/permission-catalog';
import { PERMISSIONS as SECURITY_PERMISSIONS } from '@/security/permissionCatalog';
import { Card } from '../components/Card';

export function DashboardPage() {
  const { hasPermission } = useAuth();

  const NAVY = '#020445';

  const cardBaseShadow = '0 1px 2px rgba(11,12,30,0.06), 0 10px 24px rgba(11,12,30,0.08)';
  const cardHoverShadow = '0 2px 4px rgba(11,12,30,0.08), 0 16px 34px rgba(11,12,30,0.12)';

  const linkStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 10px',
    borderRadius: 10,
    textDecoration: 'none',
    color: 'rgba(2,4,69,0.86)',
    fontSize: 13,
    fontWeight: 650,
    lineHeight: '18px',
    border: '1px solid rgba(2,4,69,0.10)',
    background: 'rgba(255,255,255,1)',
    transition: 'transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease, color 220ms ease',
  };

  const glVisible =
    hasPermission(PERMISSIONS.GL.VIEW) ||
    hasPermission(PERMISSIONS.GL.CREATE) ||
    hasPermission(PERMISSIONS.GL.POST);
  const apVisible =
    hasPermission(PERMISSIONS.AP.INVOICE_VIEW) ||
    hasPermission(PERMISSIONS.AP.INVOICE_CREATE);
  const arVisible =
    hasPermission(PERMISSIONS.AR.INVOICE_VIEW) ||
    hasPermission(PERMISSIONS.AR.INVOICE_CREATE) ||
    hasPermission(PERMISSIONS.FINANCE.VIEW_ALL) ||
    hasPermission(PERMISSIONS.SYSTEM.VIEW_ALL);
  const paymentsVisible =
    hasPermission(PERMISSIONS.PAYMENT.VIEW) ||
    hasPermission(PERMISSIONS.PAYMENT.CREATE);
  const periodsVisible = hasPermission(PERMISSIONS.PERIOD.VIEW);

  const budgetsVisible =
    hasPermission(PERMISSIONS.BUDGET.VIEW) ||
    hasPermission(PERMISSIONS.BUDGET.CREATE) ||
    hasPermission(PERMISSIONS.BUDGET.APPROVE) ||
    hasPermission(PERMISSIONS.BUDGET.FINANCE_VIEW);
  const budgetVsActualVisible = hasPermission(PERMISSIONS.BUDGET.FINANCE_VIEW);
  const forecastsVisible = hasPermission(PERMISSIONS.FORECAST.VIEW);

  const fixedAssetsVisible =
    hasPermission(PERMISSIONS.FA.CATEGORY_MANAGE) ||
    hasPermission(PERMISSIONS.FA.ASSET_CREATE) ||
    hasPermission(PERMISSIONS.FA.ASSET_CAPITALIZE) ||
    hasPermission(PERMISSIONS.FA.DEPRECIATION_RUN) ||
    hasPermission(PERMISSIONS.FA.DISPOSE);

  const bankReconciliationVisible =
    hasPermission(SECURITY_PERMISSIONS.BANK.RECONCILIATION.VIEW) ||
    hasPermission(SECURITY_PERMISSIONS.BANK.RECONCILIATION.MATCH) ||
    hasPermission(SECURITY_PERMISSIONS.BANK.STATEMENT.IMPORT) ||
    hasPermission(PERMISSIONS.PAYMENT.CREATE);

  const reportsVisible =
    hasPermission(PERMISSIONS.REPORT.TB_VIEW) ||
    hasPermission(PERMISSIONS.REPORT.PL_VIEW_LEGACY) ||
    hasPermission(PERMISSIONS.REPORT.BS_VIEW_LEGACY) ||
    hasPermission(PERMISSIONS.REPORT.AP_AGING_VIEW) ||
    hasPermission(PERMISSIONS.REPORT.AR_AGING_VIEW) ||
    hasPermission(PERMISSIONS.TAX.REPORT_VIEW);

  const auditVisible = hasPermission(PERMISSIONS.AUDIT_VIEW);

  const sections: Array<{
    key: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    modules: Array<{ to: string; label: string; visible: boolean }>;
  }> = [
    {
      key: 'accounting',
      title: 'Accounting',
      description: 'Core finance operations and period management.',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
          <path d="M7 4v16" />
        </svg>
      ),
      modules: [
        { to: '/opening-balances', label: 'GL / Opening Balances', visible: glVisible },
        { to: '/ap', label: 'Accounts Payable', visible: apVisible },
        { to: '/ar', label: 'Accounts Receivable', visible: arVisible },
        { to: '/payments', label: 'Payments', visible: paymentsVisible },
        { to: '/periods', label: 'Periods', visible: periodsVisible },
      ],
    },
    {
      key: 'planning',
      title: 'Planning & Control',
      description: 'Budgets, forecasts, and variance oversight.',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="M7 14v4" />
          <path d="M12 10v8" />
          <path d="M17 6v12" />
        </svg>
      ),
      modules: [
        { to: '/budgets', label: 'Budgets', visible: budgetsVisible },
        { to: '/budgets/vs-actual', label: 'Budget vs Actual', visible: budgetVsActualVisible },
        { to: '/forecasts', label: 'Forecasts', visible: forecastsVisible },
      ],
    },
    {
      key: 'assets',
      title: 'Assets & Operations',
      description: 'Assets register and bank operations.',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l9 5-9 5-9-5 9-5z" />
          <path d="M3 8v8l9 5 9-5V8" />
        </svg>
      ),
      modules: [
        { to: '/fixed-assets', label: 'Fixed Assets', visible: fixedAssetsVisible },
        { to: '/bank-reconciliation', label: 'Bank Reconciliation', visible: bankReconciliationVisible },
      ],
    },
    {
      key: 'oversight',
      title: 'Oversight & Compliance',
      description: 'Reporting and audit readiness.',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12h6" />
          <path d="M9 16h6" />
          <path d="M10 2h4" />
          <path d="M12 2v4" />
          <path d="M7 6h10" />
          <path d="M6 6v16h12V6" />
        </svg>
      ),
      modules: [
        { to: '/reports', label: 'Reports', visible: reportsVisible },
        { to: '/audit', label: 'Audit', visible: auditVisible },
      ],
    },
  ];

  const visibleSections = sections
    .map((s) => ({ ...s, modules: s.modules.filter((m) => m.visible) }))
    .filter((s) => s.modules.length > 0);

  return (
    <div>
      <div
        style={{
          background: '#FFFFFF',
          padding: 32,
          borderRadius: 16,
          boxShadow: '0 1px 2px rgba(11,12,30,0.04)',
          border: '1px solid rgba(11,12,30,0.06)',
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 750, lineHeight: '32px', color: '#0B0C1E' }}>Dashboard</div>
        <div style={{ marginTop: 10, fontSize: 13, lineHeight: '18px', color: 'rgba(11,12,30,0.62)' }}>
          Quick access to your modules based on your assigned roles and permissions.
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          alignItems: 'stretch',
        }}
      >
        {visibleSections.map((section) => (
          <Card
            key={section.key}
            interactive
            baseShadow={cardBaseShadow}
            hoverShadow={cardHoverShadow}
            baseBorderColor="rgba(2,4,69,0.08)"
            hoverBorderColor={`rgba(237,186,53,0.45)`}
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              minHeight: 220,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(2,4,69,0.06)', color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {section.icon}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 750, color: NAVY, lineHeight: '22px' }}>{section.title}</div>
                  <div style={{ marginTop: 6, fontSize: 13, lineHeight: '18px', color: 'rgba(11,12,30,0.62)' }}>{section.description}</div>
                </div>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: 999, background: 'rgba(237,186,53,0.0)' }} />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 2 }}>
              {section.modules.map((m) => (
                <Link
                  key={m.to}
                  to={m.to}
                  style={linkStyle}
                  onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                    e.currentTarget.style.borderColor = `rgba(237,186,53,0.55)`;
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(11,12,30,0.06)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.color = NAVY;
                  }}
                  onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                    e.currentTarget.style.borderColor = 'rgba(2,4,69,0.10)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(0px)';
                    e.currentTarget.style.color = 'rgba(2,4,69,0.86)';
                  }}
                >
                  {m.label}
                </Link>
              ))}
            </div>

            <div style={{ marginTop: 'auto', height: 1, background: 'rgba(11,12,30,0.06)' }} />
            <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.52)' }}>Only modules you’re permitted to access are shown.</div>
          </Card>
        ))}
      </div>

      {visibleSections.length === 0 ? (
        <div style={{ marginTop: 16, padding: 16, fontSize: 13, color: 'rgba(11,12,30,0.62)' }}>
          No modules are available for your current permissions.
        </div>
      ) : null}

      <div style={{ marginTop: 18, fontSize: 12, color: 'rgba(11,12,30,0.58)' }}>Step 29B — Basic Dashboard (Option A) implemented and ready for verification.</div>
    </div>
  );
}
