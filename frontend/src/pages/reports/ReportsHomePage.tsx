import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import { PageLayout } from '../../components/PageLayout';

export function ReportsHomePage() {
  const { hasPermission } = useAuth();

  const items: Array<{ to: string; label: string; visible: boolean }> = [
    { to: '/reports/trial-balance', label: 'Trial Balance', visible: hasPermission(PERMISSIONS.REPORT.VIEW.TRIAL_BALANCE) },
    { to: '/reports/pnl', label: 'Profit & Loss', visible: hasPermission(PERMISSIONS.REPORT.VIEW.PROFIT_LOSS) },
    { to: '/reports/balance-sheet', label: 'Balance Sheet', visible: hasPermission(PERMISSIONS.REPORT.VIEW.BALANCE_SHEET) },
    { to: '/reports/soce', label: 'SOCE', visible: hasPermission(PERMISSIONS.REPORT.VIEW.SOCE) },
    { to: '/reports/cash-flow', label: 'Cash Flow (Indirect)', visible: hasPermission(PERMISSIONS.REPORT.VIEW.CASH_FLOW) },
    { to: '/reports/disclosure-notes', label: 'Disclosure Notes', visible: hasPermission(PERMISSIONS.DISCLOSURE.VIEW) },
    { to: '/reports/ap-aging', label: 'AP Aging', visible: hasPermission(PERMISSIONS.REPORT.VIEW.AP_AGING) },
    { to: '/reports/ar-aging', label: 'AR Aging', visible: hasPermission(PERMISSIONS.REPORT.VIEW.AR_AGING) },
    { to: '/reports/vat', label: 'VAT Summary', visible: hasPermission(PERMISSIONS.REPORT.VIEW.VAT_SUMMARY) },
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
