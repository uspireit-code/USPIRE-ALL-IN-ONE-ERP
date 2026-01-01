import { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { resolveBrandAssetUrl, useBrandColors, useBranding } from '../branding/BrandingContext';

export function Layout() {
  const location = useLocation();
  const brand = useBrandColors();
  const { effective } = useBranding();
  const Icon = (props: { children: React.ReactNode }) => {
    return (
      <span
        data-sidebar-icon
        style={{
          display: 'inline-flex',
          width: 18,
          height: 18,
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 18px',
        }}
        aria-hidden="true"
      >
        {props.children}
      </span>
    );
  };

  type NavLevel = 1 | 2 | 3;

  const SidebarToggle = (props: {
    label: string;
    icon: React.ReactNode;
    open: boolean;
    active: boolean;
    level: NavLevel;
    onToggle: () => void;
  }) => {
    return (
      <button
        type="button"
        style={actionStyle({ isActive: props.active, isOpen: props.open, level: props.level })}
        onClick={props.onToggle}
        onMouseEnter={(e) => {
          if (props.active) return;
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.06)';
          const iconEl = e.currentTarget.querySelector('[data-sidebar-icon]') as HTMLElement | null;
          if (iconEl) iconEl.style.opacity = '0.92';
        }}
        onMouseLeave={(e) => {
          if (props.active) return;
          (e.currentTarget as HTMLButtonElement).style.background = props.open ? 'rgba(255, 255, 255, 0.06)' : 'transparent';
          const iconEl = e.currentTarget.querySelector('[data-sidebar-icon]') as HTMLElement | null;
          if (iconEl) iconEl.style.opacity = '0.72';
        }}
      >
        <span data-sidebar-icon style={{ display: 'inline-flex', opacity: props.active ? 1 : 0.72 }} aria-hidden="true">
          <Icon>{props.icon}</Icon>
        </span>
        <span
          style={{
            color: 'inherit',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
            flex: '1 1 auto',
          }}
        >
          {props.label}
        </span>
        <Chevron open={props.open} />
      </button>
    );
  };

  type L1Key = 'finance' | 'settings' | null;
  const [openL1, setOpenL1] = useState<L1Key | null>(null);

  const [openFinanceL2, setOpenFinanceL2] = useState<{ gl: boolean; ar: boolean; ap: boolean; cash: boolean; budgets: boolean; reports: boolean }>({
    gl: false,
    ar: false,
    ap: false,
    cash: false,
    budgets: false,
    reports: false,
  });

  const path = location.pathname;

  const isFinanceActive = useMemo(() => {
    return (
      path.startsWith('/finance') ||
      path.startsWith('/periods') ||
      path.startsWith('/reports') ||
      path.startsWith('/audit')
    );
  }, [path]);

  const isSettingsActive = useMemo(() => {
    return path.startsWith('/settings');
  }, [path]);

  const financeActiveL2 = useMemo(() => {
    return {
      gl: path.startsWith('/finance/gl'),
      ar: path.startsWith('/finance/ar'),
      ap: path.startsWith('/finance/ap'),
      cash: path.startsWith('/finance/cash') || path.startsWith('/bank-reconciliation'),
      budgets: path.startsWith('/finance/budgets'),
      reports: path.startsWith('/reports'),
    };
  }, [path]);

  const Indent = (props: { level: 2 | 3; children: React.ReactNode }) => {
    const pad = props.level === 2 ? 12 : 28;
    return <div style={{ paddingLeft: pad }}>{props.children}</div>;
  };

  const Chevron = (props: { open: boolean }) => {
    return (
      <span
        aria-hidden="true"
        style={{
          marginLeft: 'auto',
          display: 'inline-flex',
          transition: 'transform 160ms ease',
          transform: props.open ? 'rotate(90deg)' : 'rotate(0deg)',
          opacity: 0.9,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </span>
    );
  };

  const FolderIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );

  const FileTextIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  );

  const UploadIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5-5 5 5" />
      <path d="M12 5v14" />
    </svg>
  );

  const RepeatIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );

  const ClipboardIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </svg>
  );

  const UsersIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );

  const ReceiptIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2H4Z" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M8 15h6" />
    </svg>
  );

  const BanknoteIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01" />
      <path d="M18 12h.01" />
    </svg>
  );

  const pageTitleByPath: Array<{ match: (path: string) => boolean; title: string }> = [
    { match: (p) => p === '/', title: 'Dashboard' },
    { match: (p) => p === '/dashboard', title: 'Management Dashboard' },
    { match: (p) => p.startsWith('/finance'), title: 'Finance & Accounting' },
    { match: (p) => p.startsWith('/ap'), title: 'Accounts Payable' },
    { match: (p) => p.startsWith('/ar'), title: 'Accounts Receivable' },
    { match: (p) => p.startsWith('/payments'), title: 'Payments' },
    { match: (p) => p.startsWith('/reports'), title: 'Reports' },
    { match: (p) => p.startsWith('/forecasts'), title: 'Forecasts' },
    { match: (p) => p.startsWith('/bank-reconciliation'), title: 'Bank Reconciliation' },
    { match: (p) => p.startsWith('/opening-balances'), title: 'GL / Opening Balances' },
    { match: (p) => p.startsWith('/fixed-assets'), title: 'Fixed Assets' },
    { match: (p) => p.startsWith('/periods'), title: 'Periods' },
    { match: (p) => p.startsWith('/audit'), title: 'Audit' },
    { match: (p) => p.startsWith('/settings'), title: 'Settings' },
  ];

  const pageTitle = pageTitleByPath.find((x) => x.match(location.pathname))?.title ?? (effective?.organisationShortName || effective?.organisationName || 'USPIRE ERP');
  const showTopBar = !location.pathname.startsWith('/login');

  const GridIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );

  const BookIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  );

  const CalculatorIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M8 6h8" />
      <path d="M8 10h.01" />
      <path d="M12 10h.01" />
      <path d="M16 10h.01" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
      <path d="M8 18h8" />
    </svg>
  );

  const BarChartIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 16v-6" />
      <path d="M12 16v-10" />
      <path d="M17 16v-4" />
    </svg>
  );

  const ShieldIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4Z" />
    </svg>
  );

  const SettingsIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.93 4.93l1.41 1.41" />
      <path d="M17.66 17.66l1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M4.93 19.07l1.41-1.41" />
      <path d="M17.66 6.34l1.41-1.41" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );

  const { state, logout, hasPermission } = useAuth();

  const COLORS = {
    navy: '#020445',
    gold: '#EDBA35',
    white: brand.white,
  };

  const TOPBAR_HEIGHT = 60;

  const SIDEBAR_WIDTH = 280;

  const showAudit = hasPermission('AUDIT_VIEW');
  const showGlCreate = hasPermission('FINANCE_GL_CREATE');
  const showGlView = hasPermission('FINANCE_GL_VIEW');
  const showGlReviewQueue = hasPermission('FINANCE_GL_APPROVE');
  const showGlPostQueue = hasPermission('FINANCE_GL_FINAL_POST');
  const showGlRecurring = hasPermission('FINANCE_GL_RECURRING_MANAGE') || hasPermission('FINANCE_GL_RECURRING_GENERATE');
  const showGlRiskIntelligence = showGlView;
  const showGlRegister = showGlView;
  const showGlDrafts = showGlCreate;
  const showCoa = hasPermission('FINANCE_COA_VIEW');
  const showPeriods =
    hasPermission('FINANCE_PERIOD_VIEW') ||
    hasPermission('FINANCE_PERIOD_CLOSE_APPROVE') ||
    hasPermission('FINANCE_PERIOD_REOPEN');

  const showBudgetSetup =
    hasPermission('BUDGET_VIEW') ||
    hasPermission('BUDGET_CREATE') ||
    hasPermission('BUDGET_APPROVE');

  const showBudgetVsActual = hasPermission('FINANCE_BUDGET_VIEW');

  const showFinanceBudgets = showBudgetSetup || showBudgetVsActual;
  const showForecasts = hasPermission('forecast.view');

  const showFixedAssets =
    hasPermission('FA_CATEGORY_MANAGE') ||
    hasPermission('FA_ASSET_CREATE') ||
    hasPermission('FA_ASSET_CAPITALIZE') ||
    hasPermission('FA_DEPRECIATION_RUN') ||
    hasPermission('FA_DISPOSE');

  const showBankReconciliation = hasPermission('BANK_RECONCILIATION_VIEW');

  const isAdmin = Boolean(state.me?.user?.roles?.includes('ADMIN'));

  const linkBaseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 10,
    textDecoration: 'none',
    color: COLORS.white,
    fontSize: 14,
    lineHeight: '20px',
    cursor: 'pointer',
    transition: 'background 200ms ease, color 200ms ease',
  };

  const metricsByLevel: Record<NavLevel, { fontSize: number; fontWeight: number; paddingY: number; radius: number; lineHeight: string }> = {
    1: { fontSize: 14, fontWeight: 600, paddingY: 11, radius: 10, lineHeight: '20px' },
    2: { fontSize: 13, fontWeight: 500, paddingY: 9, radius: 9, lineHeight: '18px' },
    3: { fontSize: 12, fontWeight: 400, paddingY: 7, radius: 8, lineHeight: '16px' },
  };

  const actionStyle = ({ isActive, isOpen, level }: { isActive: boolean; isOpen: boolean; level: NavLevel }): React.CSSProperties => {
    const m = metricsByLevel[level];
    return {
      ...linkBaseStyle,
      width: '100%',
      border: 0,
      background: isActive ? 'rgba(237, 186, 53, 0.10)' : isOpen ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
      borderLeft: isActive ? `3px solid ${COLORS.gold}` : '3px solid transparent',
      paddingLeft: isActive ? 11 : 14,
      fontWeight: m.fontWeight,
      color: COLORS.white,
      textAlign: 'left',
      fontSize: m.fontSize,
      lineHeight: m.lineHeight,
      paddingTop: m.paddingY,
      paddingBottom: m.paddingY,
      borderRadius: m.radius,
    };
  };

  const linkStyle = ({ isActive, level }: { isActive: boolean; level: NavLevel }): React.CSSProperties => {
    const m = metricsByLevel[level];
    return {
      ...linkBaseStyle,
      background: isActive ? 'rgba(237, 186, 53, 0.10)' : 'transparent',
      borderLeft: isActive ? `3px solid ${COLORS.gold}` : '3px solid transparent',
      paddingLeft: isActive ? 11 : 14,
      fontWeight: level === 3 ? (isActive ? 500 : m.fontWeight) : m.fontWeight,
      color: COLORS.white,
      fontSize: m.fontSize,
      lineHeight: m.lineHeight,
      paddingTop: m.paddingY,
      paddingBottom: m.paddingY,
      borderRadius: m.radius,
    };
  };

  const linkHoverStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.06)',
  };

  const Section = (props: { title?: string; children: React.ReactNode }) => {
    const title = String(props.title ?? '').trim();
    return (
      <div style={{ marginTop: title ? 18 : 0 }}>
        {title ? (
          <div
            style={{
              fontSize: 11,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.70)',
              padding: '0 14px',
            }}
          >
            {title}
          </div>
        ) : null}
        <div style={{ marginTop: title ? 10 : 0, display: 'flex', flexDirection: 'column', gap: 6 }}>{props.children}</div>
      </div>
    );
  };

  const SidebarLink = (props: {
    to: string;
    label: string;
    icon: React.ReactNode;
    end?: boolean;
    level: NavLevel;
    activeMatch?: (location: { pathname: string; search: string }) => boolean;
  }) => {
    return (
      <NavLink
        to={props.to}
        end={props.end}
        style={({ isActive }) => {
          const derivedActive = props.activeMatch ? props.activeMatch({ pathname: location.pathname, search: location.search }) : isActive;
          return linkStyle({ isActive: derivedActive, level: props.level });
        }}
        onMouseEnter={(e) => {
          if ((e.currentTarget as any)?.getAttribute('aria-current') === 'page') return;
          Object.assign(e.currentTarget.style, linkHoverStyle);
          const iconEl = e.currentTarget.querySelector('[data-sidebar-icon]') as HTMLElement | null;
          if (iconEl) iconEl.style.opacity = '0.92';
        }}
        onMouseLeave={(e) => {
          if ((e.currentTarget as any)?.getAttribute('aria-current') === 'page') return;
          e.currentTarget.style.background = 'transparent';
          const iconEl = e.currentTarget.querySelector('[data-sidebar-icon]') as HTMLElement | null;
          if (iconEl) iconEl.style.opacity = '0.72';
        }}
      >
        {({ isActive }) => {
          const derivedActive = props.activeMatch ? props.activeMatch({ pathname: location.pathname, search: location.search }) : isActive;
          return (
          <>
            <span data-sidebar-icon style={{ display: 'inline-flex', opacity: derivedActive ? 1 : 0.72 }} aria-hidden="true">
              <Icon>{props.icon}</Icon>
            </span>
            <span
              style={{
                color: 'inherit',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
                flex: '1 1 auto',
              }}
            >
              {props.label}
            </span>
          </>
          );
        }}
      </NavLink>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: COLORS.white }}>
      <div
        style={{
          width: SIDEBAR_WIDTH,
          padding: 16,
          background: COLORS.navy,
          color: COLORS.white,
          boxSizing: 'border-box',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.08)',
          position: 'fixed',
          top: 0,
          left: 0,
        }}
      >
        <div style={{ textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 8px' }}>
            {effective?.logoUrl ? (
              <img
                src={resolveBrandAssetUrl(effective.logoUrl) ?? ''}
                alt="Organisation logo"
                style={{ height: 22, width: 'auto', maxWidth: 120, objectFit: 'contain' }}
              />
            ) : null}
            <div style={{ fontWeight: 800, letterSpacing: 0.3, fontSize: 15 }}>
              {effective?.organisationShortName || effective?.organisationName || 'USPIRE ERP'}
            </div>
          </div>
          <div style={{ marginTop: 8, height: 1, background: 'rgba(255,255,255,0.10)' }} />
        </div>

        <nav style={{ marginTop: 14, flex: 1, overflowY: 'auto', paddingRight: 4 }}>
          <Section>
            <SidebarLink to="/" label="Dashboard" icon={<GridIcon />} end level={1} />

            <SidebarToggle
              label="Finance & Accounting"
              icon={<CalculatorIcon />}
              open={openL1 === 'finance'}
              active={isFinanceActive}
              level={1}
              onToggle={() => setOpenL1((v) => (v === 'finance' ? null : 'finance'))}
            />
            {openL1 === 'finance' ? (
              <Indent level={2}>
                {showCoa ? <SidebarLink to="/finance/coa" label="Chart of Accounts" icon={<BookIcon />} level={2} /> : null}

                <SidebarToggle
                  label="General Ledger"
                  icon={<FolderIcon />}
                  open={openFinanceL2.gl}
                  active={financeActiveL2.gl}
                  level={2}
                  onToggle={() => setOpenFinanceL2((s) => ({ ...s, gl: !s.gl }))}
                />
                {openFinanceL2.gl ? (
                  <Indent level={3}>
                    {showGlCreate ? <SidebarLink to="/finance/gl/journals/new" end label="New Journal" icon={<FileTextIcon />} level={3} /> : null}
                    {showGlCreate ? <SidebarLink to="/finance/gl/upload" end label="Journal Upload" icon={<UploadIcon />} level={3} /> : null}
                    {showGlDrafts ? (
                      <SidebarLink
                        to="/finance/gl/journals?workbench=1"
                        end
                        label="Draft Journals"
                        icon={<FileTextIcon />}
                        level={3}
                        activeMatch={(loc) => {
                          if (loc.pathname !== '/finance/gl/journals') return false;
                          const qs = new URLSearchParams(loc.search);
                          return qs.get('workbench') === '1';
                        }}
                      />
                    ) : null}
                    {showGlReviewQueue ? <SidebarLink to="/finance/gl/review" end label="Review Queue" icon={<ClipboardIcon />} level={3} /> : null}
                    {showGlPostQueue ? <SidebarLink to="/finance/gl/post" end label="Post Queue" icon={<ClipboardIcon />} level={3} /> : null}
                    {showGlRegister ? (
                      <SidebarLink
                        to="/finance/gl/journals"
                        end
                        label="Journal Register"
                        icon={<FileTextIcon />}
                        level={3}
                        activeMatch={(loc) => {
                          if (loc.pathname !== '/finance/gl/journals') return false;
                          const qs = new URLSearchParams(loc.search);
                          return qs.get('workbench') !== '1' && qs.get('drilldown') !== '1';
                        }}
                      />
                    ) : null}
                    {showGlRiskIntelligence ? <SidebarLink to="/finance/gl/risk" end label="Risk Intelligence" icon={<ShieldIcon />} level={3} /> : null}
                    {showGlRecurring ? <SidebarLink to="/finance/gl/recurring" end label="Recurring Journals" icon={<RepeatIcon />} level={3} /> : null}
                  </Indent>
                ) : null}

                <SidebarToggle
                  label="Accounts Receivable"
                  icon={<FolderIcon />}
                  open={openFinanceL2.ar}
                  active={financeActiveL2.ar}
                  level={2}
                  onToggle={() => setOpenFinanceL2((s) => ({ ...s, ar: !s.ar }))}
                />
                {openFinanceL2.ar ? (
                  <Indent level={3}>
                    <SidebarLink to="/finance/ar/customers" label="Customers" icon={<UsersIcon />} level={3} />
                    <SidebarLink to="/finance/ar/invoices" label="Invoices" icon={<ReceiptIcon />} level={3} />
                    <SidebarLink to="/finance/ar/receipts" label="Receipts" icon={<ReceiptIcon />} level={3} />
                    <SidebarLink to="/finance/ar/aging" label="AR Aging" icon={<BarChartIcon />} level={3} />
                    <SidebarLink to="/finance/ar/statements" label="Statements" icon={<FileTextIcon />} level={3} />
                  </Indent>
                ) : null}

                <SidebarToggle
                  label="Accounts Payable"
                  icon={<FolderIcon />}
                  open={openFinanceL2.ap}
                  active={financeActiveL2.ap}
                  level={2}
                  onToggle={() => setOpenFinanceL2((s) => ({ ...s, ap: !s.ap }))}
                />
                {openFinanceL2.ap ? (
                  <Indent level={3}>
                    <SidebarLink to="/finance/ap/suppliers" label="Suppliers" icon={<UsersIcon />} level={3} />
                    <SidebarLink to="/finance/ap/invoices" label="Bills / Invoices" icon={<ReceiptIcon />} level={3} />
                    <SidebarLink to="/finance/ap/aging" label="AP Aging" icon={<BarChartIcon />} level={3} />
                    <SidebarLink to="/finance/ap/payments/proposals" label="Payment Proposals" icon={<ClipboardIcon />} level={3} />
                  </Indent>
                ) : null}

                <SidebarToggle
                  label="Cash & Bank"
                  icon={<FolderIcon />}
                  open={openFinanceL2.cash}
                  active={financeActiveL2.cash}
                  level={2}
                  onToggle={() => setOpenFinanceL2((s) => ({ ...s, cash: !s.cash }))}
                />
                {openFinanceL2.cash ? (
                  <Indent level={3}>
                    <SidebarLink to="/finance/cash/banks" label="Bank Accounts" icon={<BanknoteIcon />} level={3} />
                    <SidebarLink to="/finance/cash/reconciliation" label="Bank Reconciliation" icon={<CalculatorIcon />} level={3} />
                    {showBankReconciliation ? <SidebarLink to="/bank-reconciliation" label="Bank Reconciliation" icon={<CalculatorIcon />} level={3} /> : null}
                  </Indent>
                ) : null}

                {showPeriods ? <SidebarLink to="/periods" label="Periods" icon={<FolderIcon />} level={2} /> : null}

                {showFinanceBudgets ? (
                  <>
                    <SidebarToggle
                      label="Budgets"
                      icon={<ClipboardIcon />}
                      open={openFinanceL2.budgets}
                      active={financeActiveL2.budgets}
                      level={2}
                      onToggle={() => setOpenFinanceL2((s) => ({ ...s, budgets: !s.budgets }))}
                    />
                    {openFinanceL2.budgets ? (
                      <Indent level={3}>
                        {showBudgetSetup ? (
                          <SidebarLink
                            to="/finance/budgets"
                            label="Budget Setup"
                            icon={<ClipboardIcon />}
                            level={3}
                            activeMatch={(loc) => {
                              return loc.pathname.startsWith('/finance/budgets') && !loc.pathname.startsWith('/finance/budgets/vs-actual');
                            }}
                          />
                        ) : null}

                        {showBudgetVsActual ? (
                          <SidebarLink
                            to="/finance/budgets/vs-actual"
                            label="Budget vs Actual"
                            icon={<BarChartIcon />}
                            level={3}
                            activeMatch={(loc) => loc.pathname.startsWith('/finance/budgets/vs-actual')}
                          />
                        ) : null}
                      </Indent>
                    ) : null}
                  </>
                ) : null}

                {showForecasts ? <SidebarLink to="/forecasts" label="Forecasts" icon={<BarChartIcon />} level={2} /> : null}

                {showFixedAssets ? <SidebarLink to="/fixed-assets" label="Fixed Assets" icon={<FolderIcon />} level={2} /> : null}

                <SidebarToggle
                  label="Reports"
                  icon={<FolderIcon />}
                  open={openFinanceL2.reports}
                  active={financeActiveL2.reports}
                  level={2}
                  onToggle={() => setOpenFinanceL2((s) => ({ ...s, reports: !s.reports }))}
                />
                {openFinanceL2.reports ? (
                  <Indent level={3}>
                    <SidebarLink to="/reports/trial-balance" label="Trial Balance" icon={<BarChartIcon />} level={3} />
                    <SidebarLink to="/reports/profit-and-loss" label="P&L" icon={<BarChartIcon />} level={3} />
                    <SidebarLink to="/reports/balance-sheet" label="Balance Sheet" icon={<BarChartIcon />} level={3} />
                    <SidebarLink to="/reports/cash-flow" label="Cash Flow" icon={<BarChartIcon />} level={3} />
                    <SidebarLink to="/reports/soce" label="SOCE" icon={<BarChartIcon />} level={3} />
                  </Indent>
                ) : null}

                <SidebarLink to="/reports/disclosure-notes" label="Disclosure Notes" icon={<FileTextIcon />} level={2} />
                {showAudit ? <SidebarLink to="/audit" label="Audit" icon={<ShieldIcon />} level={2} /> : null}
              </Indent>
            ) : null}

            <SidebarToggle
              label="Settings"
              icon={<SettingsIcon />}
              open={openL1 === 'settings'}
              active={isSettingsActive}
              level={1}
              onToggle={() => setOpenL1((v) => (v === 'settings' ? null : 'settings'))}
            />
            {openL1 === 'settings' ? (
              <Indent level={2}>{isAdmin ? <SidebarLink to="/settings" label="Settings" icon={<SettingsIcon />} level={2} /> : null}</Indent>
            ) : null}
          </Section>
        </nav>

        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.10)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.70)', padding: '0 8px' }}>
            Logged in as: {state.me?.user?.email ?? '—'}
          </div>
          <button
            onClick={logout}
            style={{
              marginTop: 10,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'transparent',
              color: COLORS.white,
              cursor: 'pointer',
              transition: 'background 200ms ease, border-color 200ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.24)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {showTopBar ? (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: SIDEBAR_WIDTH,
            right: 0,
            height: TOPBAR_HEIGHT,
            background: COLORS.navy,
            color: COLORS.white,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 18px',
            boxShadow: '0 8px 18px rgba(2,4,69,0.18)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontWeight: 750, fontSize: 15, letterSpacing: 0.2, whiteSpace: 'nowrap' }}>{pageTitle}</div>

          <div style={{ flex: '0 1 520px', padding: '0 18px' }}>
            <input
              placeholder="Search…"
              aria-label="Search"
              style={{
                width: '100%',
                height: 38,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.08)',
                color: COLORS.white,
                padding: '0 12px',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(237,186,53,0.60)';
                e.currentTarget.style.boxShadow = '0 0 0 4px rgba(237,186,53,0.18)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              aria-hidden
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.16)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M20 21a8 8 0 1 0-16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <div style={{ fontSize: 12, fontWeight: 650, whiteSpace: 'nowrap' }}>{state.me?.user?.email ?? '—'}</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>▼</div>
          </div>
        </div>
      ) : null}

      <div
        style={{
          flex: 1,
          marginLeft: SIDEBAR_WIDTH,
          height: '100vh',
          overflowY: 'auto',
          padding: 24,
          paddingTop: 24 + (showTopBar ? TOPBAR_HEIGHT : 0),
          boxSizing: 'border-box',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
