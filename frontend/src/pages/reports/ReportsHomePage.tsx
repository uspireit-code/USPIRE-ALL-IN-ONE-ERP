import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PageLayout } from '../../components/PageLayout';

export function ReportsHomePage() {
  const { hasPermission } = useAuth();

  const items: Array<{ to: string; label: string; visible: boolean }> = [
    { to: '/reports/trial-balance', label: 'Trial Balance', visible: hasPermission('FINANCE_TB_VIEW') },
    { to: '/reports/pnl', label: 'Profit & Loss', visible: hasPermission('report.view.pl') },
    { to: '/reports/balance-sheet', label: 'Balance Sheet', visible: hasPermission('report.view.bs') },
    { to: '/reports/soce', label: 'SOCE', visible: hasPermission('FINANCE_SOE_VIEW') },
    { to: '/reports/cash-flow', label: 'Cash Flow (Indirect)', visible: hasPermission('FINANCE_CASHFLOW_VIEW') },
    { to: '/reports/disclosure-notes', label: 'Disclosure Notes', visible: hasPermission('FINANCE_DISCLOSURE_VIEW') },
    { to: '/reports/ap-aging', label: 'AP Aging', visible: hasPermission('FINANCE_AP_AGING_VIEW') },
    { to: '/reports/ar-aging', label: 'AR Aging', visible: hasPermission('FINANCE_AR_AGING_VIEW') },
    { to: '/reports/vat', label: 'VAT Summary', visible: hasPermission('TAX_REPORT_VIEW') },
  ];

  const visibleItems = items.filter((i) => i.visible);

  return (
    <PageLayout title="Reports" description="Reports are read-only. Data is calculated by the backend.">
      {visibleItems.length === 0 ? <div style={{ color: 'rgba(11,12,30,0.65)' }}>You do not have access to any reports.</div> : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibleItems.map((i) => (
          <Link key={i.to} to={i.to}>
            {i.label}
          </Link>
        ))}
      </div>
    </PageLayout>
  );
}
