import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { useAuth } from './auth/AuthContext';
import { can, canAny } from './auth/permissions';
import { PERMISSIONS } from './auth/permission-catalog';
import { BrandingProvider } from './branding/BrandingContext';
import { Layout } from './components/Layout';
import { AccessDeniedPage } from './pages/AccessDeniedPage';
import { DashboardPage } from './pages/DashboardPage';
import { ManagementDashboardPage } from './pages/ManagementDashboardPage';
import { LoginPage } from './pages/LoginPage';
import { ApHomePage } from './pages/ap/ApHomePage';
import { BillDetailsPage } from './pages/ap/BillDetailsPage';
import { BillsListPage } from './pages/ap/BillsListPage';
import { CreateBillPage } from './pages/ap/CreateBillPage';
import { CreateInvoicePage } from './pages/ap/CreateInvoicePage';
import { CreateSupplierPage } from './pages/ap/CreateSupplierPage';
import { ImportSuppliersPage } from './pages/ap/ImportSuppliersPage';
import { InvoiceDetailsPage } from './pages/ap/InvoiceDetailsPage';
import { InvoicesListPage } from './pages/ap/InvoicesListPage';
import { SupplierDetailsPage } from './pages/ap/SupplierDetailsPage';
import { SuppliersListPage } from './pages/ap/SuppliersListPage';
import { ArHomePage } from './pages/ar/ArHomePage';
import { CreateCustomerPage } from './pages/ar/CreateCustomerPage';
import { CustomerDetailsPage } from './pages/ar/CustomerDetailsPage';
import { EditCustomerPage } from './pages/ar/EditCustomerPage';
import { CreateInvoicePage as CreateArInvoicePage } from './pages/ar/CreateInvoicePage';
import { CreateReceiptPage } from './pages/ar/CreateReceiptPage';
import { CustomersListPage } from './pages/ar/CustomersListPage';
import { InvoiceDetailsPage as ArInvoiceDetailsPage } from './pages/ar/InvoiceDetailsPage';
import { InvoicesListPage as ArInvoicesListPage } from './pages/ar/InvoicesListPage';
import { ReceiptDetailsPage } from './pages/ar/ReceiptDetailsPage';
import { ReceiptsPage } from './pages/ar/ReceiptsPage';
import { ApPaymentDetailsPage } from './pages/payments/ApPaymentDetailsPage';
import { ApPaymentsListPage } from './pages/payments/ApPaymentsListPage';
import { ArReceiptDetailsPage } from './pages/payments/ArReceiptDetailsPage';
import { ArReceiptsListPage } from './pages/payments/ArReceiptsListPage';
import { BankAccountsListPage } from './pages/payments/BankAccountsListPage';
import { CreateApPaymentPage } from './pages/payments/CreateApPaymentPage';
import { CreateArReceiptPage } from './pages/payments/CreateArReceiptPage';
import { PaymentsHomePage } from './pages/payments/PaymentsHomePage';
import { ApAgingPage } from './pages/reports/ApAgingPage';
import { ArAgingPage } from './pages/reports/ArAgingPage';
import { BalanceSheetPage } from './pages/reports/BalanceSheetPage';
import { CashFlowPage } from './pages/reports/CashFlowPage';
import { ProfitLossPage } from './pages/reports/ProfitLossPage';
import { DisclosureNotesPage } from './pages/reports/DisclosureNotesPage';
import { ReportsHomePage } from './pages/reports/ReportsHomePage';
import { SocePage } from './pages/reports/SocePage';
import { TrialBalancePage } from './pages/reports/TrialBalancePage';
import { VatSummaryPage } from './pages/reports/VatSummaryPage';
import { BankReconciliationHomePage } from './pages/bankReconciliation/BankReconciliationHomePage';
import { BankStatementDetailsPage } from './pages/bankReconciliation/BankStatementDetailsPage';
import { BankStatementsListPage } from './pages/bankReconciliation/BankStatementsListPage';
import { CreateBankStatementPage } from './pages/bankReconciliation/CreateBankStatementPage';
import { MatchBankReconciliationPage } from './pages/bankReconciliation/MatchBankReconciliationPage';
import { OpeningBalancesPage } from './pages/OpeningBalancesPage';
import { PeriodCloseWorkflowPage } from './pages/PeriodCloseWorkflowPage';
import { PeriodsPage } from './pages/PeriodsPage';
import { FixedAssetsPage } from './pages/FixedAssetsPage';
import { AuditPage } from './pages/AuditPage';
import { BudgetSetupPage } from './pages/BudgetSetupPage';
import { BudgetVsActualPage } from './pages/BudgetVsActualPage';
import {
  CashPositionPage,
  FinanceApPaymentProposalsPage,
  FinanceTaxCompliancePage,
  PettyCashPage,
} from './pages/finance/FinancePlaceholders';
import { ChartOfAccountsPage } from './pages/finance/ChartOfAccountsPage';
import { JournalEntryPage } from './pages/finance/gl/JournalEntryPage';
import { JournalUploadPage } from './pages/finance/gl/JournalUploadPage';
import { JournalBrowserPage } from './pages/finance/gl/JournalBrowserPage';
import { RiskIntelligencePage } from './pages/finance/gl/RiskIntelligencePage';
import { RecurringGeneratePage } from './pages/finance/gl/RecurringGeneratePage';
import { RecurringTemplateEditorPage } from './pages/finance/gl/RecurringTemplateEditorPage';
import { RecurringTemplatesPage } from './pages/finance/gl/RecurringTemplatesPage';
import { ReviewQueuePage } from './pages/finance/gl/ReviewQueuePage';
import { PostQueuePage } from './pages/finance/gl/PostQueuePage';
import { ForecastCreatePage } from './pages/forecasts/ForecastCreatePage';
import { ForecastDetailsPage } from './pages/forecasts/ForecastDetailsPage';
import { ForecastEditPage } from './pages/forecasts/ForecastEditPage';
import { ForecastsListPage } from './pages/forecasts/ForecastsListPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { SettingsOrganisationPage } from './pages/settings/SettingsOrganisationPage';
import { SettingsUsersPage } from './pages/settings/SettingsUsersPage';
import { SettingsRolesPage } from './pages/settings/SettingsRolesPage';
import { SettingsSystemPage } from './pages/settings/SettingsSystemPage';
import { SettingsMasterDataPage } from './pages/settings/SettingsMasterDataPage';
import { SettingsDepartmentsPage } from './pages/settings/SettingsDepartmentsPage';
import { SettingsProjectsPage } from './pages/settings/SettingsProjectsPage';
import { SettingsFundsPage } from './pages/settings/SettingsFundsPage';
import { SettingsInvoiceCategoriesPage } from './pages/settings/SettingsInvoiceCategoriesPage';
import { SettingsTaxRatesPage } from './pages/settings/SettingsTaxRatesPage';
import { SettingsTaxConfigurationPage } from './pages/settings/SettingsTaxConfigurationPage';

import { CreditNotesListPage } from './pages/ar/CreditNotesListPage';
import { CreditNoteCreatePage } from './pages/ar/CreditNoteCreatePage';
import { CreditNoteDetailsPage } from './pages/ar/CreditNoteDetailsPage';

import { RefundsListPage } from './pages/ar/RefundsListPage';
import { RefundCreatePage } from './pages/ar/RefundCreatePage';
import { RefundDetailsPage } from './pages/ar/RefundDetailsPage';
import { ArAgingPage as ArAgingReportPage } from './pages/ar/ArAgingPage';
import { ArStatementsPage } from './pages/ar/ArStatementsPage';
import { ArRemindersManualTriggerPage } from './pages/ar/ArRemindersManualTriggerPage';
import { ArRemindersRulesPage } from './pages/ar/ArRemindersRulesPage';
import { ArRemindersTemplatesPage } from './pages/ar/ArRemindersTemplatesPage';

function SettingsVisibleRoute(props: { children: React.ReactNode }) {
  const { state } = useAuth();
  const has = canAny(state.me, [
    PERMISSIONS.SYSTEM.VIEW_ALL,
    PERMISSIONS.SYSTEM.CONFIG_VIEW,
    PERMISSIONS.SYSTEM.SYS_SETTINGS_VIEW,
    PERMISSIONS.FINANCE.CONFIG_VIEW,
    PERMISSIONS.USER.VIEW,
    PERMISSIONS.ROLE.VIEW,
  ]);
  if (!has)
    return (
      <AccessDeniedPage
        requiredAnyPermissions={[
          PERMISSIONS.SYSTEM.CONFIG_VIEW,
          PERMISSIONS.FINANCE.CONFIG_VIEW,
          PERMISSIONS.USER.VIEW,
          PERMISSIONS.ROLE.VIEW,
          PERMISSIONS.SYSTEM.VIEW_ALL,
        ]}
      />
    );
  return <>{props.children}</>;
}

function PermissionOnlyRoute(props: { permission: string; children: React.ReactNode }) {
  const { state } = useAuth();
  if (state.isAuthenticated && !state.me) return <div>Loading...</div>;
  const has = can(state.me, props.permission);
  if (!has) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[route.guard][deny][only]', {
        path: window.location.pathname,
        requiredPermission: props.permission,
        userEmail: state.me?.user?.email,
        permissions: state.me?.permissions ?? [],
      });
    }
    return <AccessDeniedPage requiredPermission={props.permission} />;
  }
  return <>{props.children}</>;
}

function PermissionAnyRoute(props: { permissions: string[]; children: React.ReactNode }) {
  const { state } = useAuth();
  if (state.isAuthenticated && !state.me) return <div>Loading...</div>;
  const has = canAny(state.me, props.permissions);
  if (!has) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[route.guard][deny][any]', {
        path: window.location.pathname,
        requiredAnyPermissions: props.permissions,
        userEmail: state.me?.user?.email,
        permissions: state.me?.permissions ?? [],
      });
    }
    return <AccessDeniedPage requiredAnyPermissions={props.permissions} />;
  }
  return <>{props.children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrandingProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/"
              element={
                <Layout />
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="dashboard" element={<ManagementDashboardPage />} />
              <Route path="ap" element={<ApHomePage />} />
              <Route path="ap/suppliers" element={<SuppliersListPage />} />
              <Route path="ap/suppliers/import" element={<ImportSuppliersPage />} />
              <Route path="ap/suppliers/:id" element={<SupplierDetailsPage />} />
              <Route path="ap/suppliers/new" element={<CreateSupplierPage />} />
              <Route
                path="ap/bills"
                element={
                  <PermissionAnyRoute permissions={[PERMISSIONS.AP.INVOICE_VIEW, PERMISSIONS.AP.INVOICE_CREATE]}>
                    <BillsListPage />
                  </PermissionAnyRoute>
                }
              />
              <Route
                path="ap/bills/new"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.AP.INVOICE_CREATE}>
                    <CreateBillPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="ap/bills/:id"
                element={
                  <PermissionAnyRoute permissions={[PERMISSIONS.AP.INVOICE_VIEW, PERMISSIONS.AP.INVOICE_CREATE]}>
                    <BillDetailsPage />
                  </PermissionAnyRoute>
                }
              />
              <Route
                path="ap/invoices"
                element={
                  <PermissionAnyRoute permissions={[PERMISSIONS.AP.INVOICE_VIEW, PERMISSIONS.AP.INVOICE_CREATE]}>
                    <InvoicesListPage />
                  </PermissionAnyRoute>
                }
              />
              <Route
                path="ap/invoices/new"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.AP.INVOICE_CREATE}>
                    <CreateInvoicePage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="ap/invoices/:id"
                element={
                  <PermissionAnyRoute permissions={[PERMISSIONS.AP.INVOICE_VIEW, PERMISSIONS.AP.INVOICE_CREATE]}>
                    <InvoiceDetailsPage />
                  </PermissionAnyRoute>
                }
              />
              <Route path="ar" element={<ArHomePage />} />
              <Route path="ar/customers" element={<CustomersListPage />} />
              <Route path="ar/customers/new" element={<CreateCustomerPage />} />
              <Route
                path="ar/invoices"
                element={
                  <PermissionAnyRoute permissions={[PERMISSIONS.AR.INVOICE_VIEW, PERMISSIONS.AR.INVOICE_CREATE]}>
                    <ArInvoicesListPage />
                  </PermissionAnyRoute>
                }
              />
              <Route
                path="ar/invoices/new"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.AR.INVOICE_CREATE}>
                    <CreateArInvoicePage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="ar/invoices/:id"
                element={
                  <PermissionAnyRoute permissions={[PERMISSIONS.AR.INVOICE_VIEW, PERMISSIONS.AR.INVOICE_CREATE]}>
                    <ArInvoiceDetailsPage />
                  </PermissionAnyRoute>
                }
              />
              <Route
                path="ar/receipts"
                element={
                  <PermissionAnyRoute
                    permissions={[
                      PERMISSIONS.AR.RECEIPT_VIEW,
                      PERMISSIONS.AR.RECEIPT_POST,
                      PERMISSIONS.AR.RECEIPT_CREATE,
                    ]}
                  >
                    <ReceiptsPage />
                  </PermissionAnyRoute>
                }
              />
              <Route
                path="ar/receipts/new"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.AR.RECEIPT_CREATE}>
                    <CreateReceiptPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="ar/receipts/:id"
                element={
                  <PermissionAnyRoute
                    permissions={[
                      PERMISSIONS.AR.RECEIPT_VIEW,
                      PERMISSIONS.AR.RECEIPT_POST,
                      PERMISSIONS.AR.RECEIPT_CREATE,
                    ]}
                  >
                    <ReceiptDetailsPage />
                  </PermissionAnyRoute>
                }
              />
              <Route
                path="ar/aging"
                element={
                  <PermissionAnyRoute
                    permissions={[
                      PERMISSIONS.AR_AGING.VIEW,
                      PERMISSIONS.FINANCE.VIEW_ALL,
                      PERMISSIONS.SYSTEM.VIEW_ALL,
                    ]}
                  >
                    <ArAgingReportPage />
                  </PermissionAnyRoute>
                }
              />

              <Route
                path="ar/statements"
                element={
                  <PermissionAnyRoute
                    permissions={[
                      PERMISSIONS.AR_STATEMENT.VIEW,
                      PERMISSIONS.FINANCE.VIEW_ALL,
                      PERMISSIONS.SYSTEM.VIEW_ALL,
                    ]}
                  >
                    <ArStatementsPage />
                  </PermissionAnyRoute>
                }
              />

              <Route
                path="ar/reminders"
                element={
                  <PermissionAnyRoute
                    permissions={[
                      PERMISSIONS.AR_REMINDER.VIEW,
                      PERMISSIONS.FINANCE.VIEW_ALL,
                      PERMISSIONS.SYSTEM.VIEW_ALL,
                    ]}
                  >
                    <ArRemindersManualTriggerPage />
                  </PermissionAnyRoute>
                }
              />

              <Route
                path="ar/reminders/rules"
                element={
                  <PermissionAnyRoute
                    permissions={[
                      PERMISSIONS.AR_REMINDER.VIEW,
                      PERMISSIONS.FINANCE.VIEW_ALL,
                      PERMISSIONS.SYSTEM.VIEW_ALL,
                    ]}
                  >
                    <ArRemindersRulesPage />
                  </PermissionAnyRoute>
                }
              />

              <Route
                path="ar/reminders/templates"
                element={
                  <PermissionAnyRoute
                    permissions={[
                      PERMISSIONS.AR_REMINDER.VIEW,
                      PERMISSIONS.FINANCE.VIEW_ALL,
                      PERMISSIONS.SYSTEM.VIEW_ALL,
                    ]}
                  >
                    <ArRemindersTemplatesPage />
                  </PermissionAnyRoute>
                }
              />

              <Route
                path="ar/credit-notes"
                element={
                  <PermissionAnyRoute
                    permissions={[
                      PERMISSIONS.AR.CREDIT_NOTE_VIEW,
                      PERMISSIONS.AR.CREDIT_NOTE_CREATE,
                      PERMISSIONS.FINANCE.VIEW_ALL,
                      PERMISSIONS.SYSTEM.VIEW_ALL,
                    ]}
                  >
                    <CreditNotesListPage />
                  </PermissionAnyRoute>
                }
              />
              <Route
                path="ar/credit-notes/new"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.AR.CREDIT_NOTE_CREATE}>
                    <CreditNoteCreatePage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="ar/credit-notes/:id"
                element={
                  <PermissionAnyRoute
                    permissions={[
                      PERMISSIONS.AR.CREDIT_NOTE_VIEW,
                      PERMISSIONS.AR.CREDIT_NOTE_CREATE,
                      PERMISSIONS.FINANCE.VIEW_ALL,
                      PERMISSIONS.SYSTEM.VIEW_ALL,
                    ]}
                  >
                    <CreditNoteDetailsPage />
                  </PermissionAnyRoute>
                }
              />

              <Route
                path="ar/refunds"
                element={
                  <PermissionAnyRoute
                    permissions={[
                      PERMISSIONS.AR.REFUND_VIEW,
                      PERMISSIONS.AR.REFUND_CREATE,
                      PERMISSIONS.FINANCE.VIEW_ALL,
                      PERMISSIONS.SYSTEM.VIEW_ALL,
                    ]}
                  >
                    <RefundsListPage />
                  </PermissionAnyRoute>
                }
              />
              <Route
                path="ar/refunds/new"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.AR.REFUND_CREATE}>
                    <RefundCreatePage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="ar/refunds/:id"
                element={
                  <PermissionAnyRoute
                    permissions={[
                      PERMISSIONS.AR.REFUND_VIEW,
                      PERMISSIONS.AR.REFUND_CREATE,
                      PERMISSIONS.FINANCE.VIEW_ALL,
                      PERMISSIONS.SYSTEM.VIEW_ALL,
                    ]}
                  >
                    <RefundDetailsPage />
                  </PermissionAnyRoute>
                }
              />
              <Route path="payments" element={<PaymentsHomePage />} />
              <Route path="payments/bank-accounts" element={<BankAccountsListPage />} />
              <Route path="payments/ap" element={<ApPaymentsListPage />} />
              <Route path="payments/ap/new" element={<CreateApPaymentPage />} />
              <Route path="payments/ap/:id" element={<ApPaymentDetailsPage />} />
              <Route path="payments/ar" element={<ArReceiptsListPage />} />
              <Route path="payments/ar/new" element={<CreateArReceiptPage />} />
              <Route path="payments/ar/:id" element={<ArReceiptDetailsPage />} />
              <Route path="reports" element={<ReportsHomePage />} />
              <Route path="reports/trial-balance" element={<TrialBalancePage />} />
              <Route path="reports/pnl" element={<ProfitLossPage />} />
              <Route path="reports/profit-and-loss" element={<ProfitLossPage />} />
              <Route path="reports/balance-sheet" element={<BalanceSheetPage />} />
              <Route path="reports/soce" element={<SocePage />} />
              <Route path="reports/cash-flow" element={<CashFlowPage />} />
              <Route path="reports/disclosure-notes" element={<DisclosureNotesPage />} />
              <Route path="reports/ap-aging" element={<ApAgingPage />} />
              <Route path="reports/ar-aging" element={<ArAgingPage />} />
              <Route path="reports/vat" element={<VatSummaryPage />} />
              <Route path="opening-balances" element={<OpeningBalancesPage />} />
              <Route path="fixed-assets" element={<FixedAssetsPage />} />
              <Route path="periods" element={<PeriodsPage />} />
              <Route path="periods/:id/close" element={<PeriodCloseWorkflowPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route
                path="budgets"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.BUDGET.VIEW}>
                    <BudgetSetupPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="budgets/vs-actual"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.BUDGET.FINANCE_VIEW}>
                    <BudgetVsActualPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="budget-vs-actual"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.BUDGET.FINANCE_VIEW}>
                    <BudgetVsActualPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <SettingsVisibleRoute>
                    <SettingsPage />
                  </SettingsVisibleRoute>
                }
              />
              <Route
                path="settings/organisation"
                element={
                  <PermissionAnyRoute permissions={[PERMISSIONS.SYSTEM.CONFIG_VIEW, PERMISSIONS.SYSTEM.VIEW_ALL]}>
                    <SettingsOrganisationPage />
                  </PermissionAnyRoute>
                }
              />
              <Route
                path="settings/users"
                element={
                  <PermissionAnyRoute permissions={[PERMISSIONS.USER.VIEW, PERMISSIONS.SYSTEM.VIEW_ALL]}>
                    <SettingsUsersPage />
                  </PermissionAnyRoute>
                }
              />
              <Route
                path="settings/roles"
                element={
                  <PermissionAnyRoute permissions={[PERMISSIONS.ROLE.VIEW, PERMISSIONS.SYSTEM.VIEW_ALL]}>
                    <SettingsRolesPage />
                  </PermissionAnyRoute>
                }
              />
              <Route
                path="settings/system"
                element={
                  <PermissionAnyRoute
                    permissions={[
                      PERMISSIONS.SYSTEM.CONFIG_VIEW,
                      PERMISSIONS.FINANCE.CONFIG_VIEW,
                      PERMISSIONS.SYSTEM.SYS_SETTINGS_VIEW,
                      PERMISSIONS.SYSTEM.VIEW_ALL,
                    ]}
                  >
                    <SettingsSystemPage />
                  </PermissionAnyRoute>
                }
              />
              <Route
                path="settings/tax-rates"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.TAX.RATE_VIEW}>
                    <SettingsTaxRatesPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="settings/tax-configuration"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.TAX.RATE_VIEW}>
                    <SettingsTaxConfigurationPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="settings/master-data"
                element={
                  <PermissionAnyRoute
                    permissions={[
                      PERMISSIONS.MASTER_DATA.DEPARTMENT.VIEW,
                      PERMISSIONS.MASTER_DATA.PROJECT.VIEW,
                      PERMISSIONS.MASTER_DATA.FUND.VIEW,
                      PERMISSIONS.AR.INVOICE_CATEGORY_VIEW,
                    ]}
                  >
                    <SettingsMasterDataPage />
                  </PermissionAnyRoute>
                }
              />
              <Route
                path="settings/master-data/departments"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.MASTER_DATA.DEPARTMENT.VIEW}>
                    <SettingsDepartmentsPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="settings/master-data/projects"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.MASTER_DATA.PROJECT.VIEW}>
                    <SettingsProjectsPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="settings/master-data/funds"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.MASTER_DATA.FUND.VIEW}>
                    <SettingsFundsPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="settings/master-data/invoice-categories"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.AR.INVOICE_CATEGORY_VIEW}>
                    <SettingsInvoiceCategoriesPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route path="forecasts" element={<ForecastsListPage />} />
              <Route path="forecasts/new" element={<ForecastCreatePage />} />
              <Route path="forecasts/:forecastId" element={<ForecastDetailsPage />} />
              <Route path="forecasts/:forecastId/edit" element={<ForecastEditPage />} />
              <Route
                path="finance/coa"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.COA.VIEW}>
                    <ChartOfAccountsPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route path="finance/gl/journals" element={<JournalBrowserPage />} />
              <Route path="finance/gl/journals/new" element={<JournalEntryPage />} />
              <Route path="finance/gl/journals/:id" element={<JournalEntryPage />} />
              <Route path="finance/gl/upload" element={<JournalUploadPage />} />
              <Route
                path="finance/gl/risk"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.GL.VIEW}>
                    <RiskIntelligencePage />
                  </PermissionOnlyRoute>
                }
              />
              <Route path="finance/gl/recurring" element={<RecurringTemplatesPage />} />
              <Route path="finance/gl/recurring/new" element={<RecurringTemplateEditorPage />} />
              <Route path="finance/gl/recurring/:id" element={<RecurringTemplateEditorPage />} />
              <Route path="finance/gl/recurring/:id/generate" element={<RecurringGeneratePage />} />
              <Route
                path="finance/gl/review"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.GL.APPROVE}>
                    <ReviewQueuePage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="finance/gl/post"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.GL.FINAL_POST}>
                    <PostQueuePage />
                  </PermissionOnlyRoute>
                }
              />
              <Route path="finance/ar/customers" element={<CustomersListPage />} />
              <Route path="finance/ar/customers/new" element={<CreateCustomerPage />} />
              <Route path="finance/ar/customers/:id" element={<CustomerDetailsPage />} />
              <Route path="finance/ar/customers/:id/edit" element={<EditCustomerPage />} />
              <Route
                path="finance/ar/invoices"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.AR.INVOICE_VIEW}>
                    <ArInvoicesListPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="finance/ar/invoices/new"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.AR.INVOICE_CREATE}>
                    <CreateArInvoicePage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="finance/ar/invoices/:id"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.AR.INVOICE_VIEW}>
                    <ArInvoiceDetailsPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="finance/ar/receipts"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.AR.RECEIPT_VIEW}>
                    <ReceiptsPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="finance/ar/receipts/new"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.AR.RECEIPT_CREATE}>
                    <CreateReceiptPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="finance/ar/receipts/:id"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.AR.RECEIPT_VIEW}>
                    <ReceiptDetailsPage />
                  </PermissionOnlyRoute>
                }
              />

              <Route
                path="finance/ar/credit-notes"
                element={
                  <PermissionAnyRoute
                    permissions={[
                      PERMISSIONS.AR.CREDIT_NOTE_VIEW,
                      PERMISSIONS.AR.CREDIT_NOTE_CREATE,
                      PERMISSIONS.AR.CREDIT_NOTE_POST,
                    ]}
                  >
                    <CreditNotesListPage />
                  </PermissionAnyRoute>
                }
              />
              <Route
                path="finance/ar/credit-notes/new"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.AR.CREDIT_NOTE_CREATE}>
                    <CreditNoteCreatePage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="finance/ar/credit-notes/:id"
                element={
                  <PermissionAnyRoute
                    permissions={[
                      PERMISSIONS.AR.CREDIT_NOTE_VIEW,
                      PERMISSIONS.AR.CREDIT_NOTE_POST,
                    ]}
                  >
                    <CreditNoteDetailsPage />
                  </PermissionAnyRoute>
                }
              />

              <Route
                path="finance/ar/refunds"
                element={
                  <PermissionAnyRoute
                    permissions={[
                      PERMISSIONS.AR.REFUND_VIEW,
                      PERMISSIONS.AR.REFUND_CREATE,
                      PERMISSIONS.AR.REFUND_POST,
                    ]}
                  >
                    <RefundsListPage />
                  </PermissionAnyRoute>
                }
              />
              <Route
                path="finance/ar/refunds/new"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.AR.REFUND_CREATE}>
                    <RefundCreatePage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="finance/ar/refunds/:id"
                element={
                  <PermissionAnyRoute
                    permissions={[PERMISSIONS.AR.REFUND_VIEW, PERMISSIONS.AR.REFUND_POST]}
                  >
                    <RefundDetailsPage />
                  </PermissionAnyRoute>
                }
              />
              {/* AR Aging now lives at /ar/aging under Accounts Receivable and is permission-gated */}
              <Route path="finance/ap/suppliers" element={<SuppliersListPage />} />
              <Route path="finance/ap/invoices" element={<InvoicesListPage />} />
              <Route
                path="finance/ap/bills"
                element={
                  <PermissionAnyRoute permissions={[PERMISSIONS.AP.INVOICE_VIEW, PERMISSIONS.AP.INVOICE_CREATE]}>
                    <BillsListPage />
                  </PermissionAnyRoute>
                }
              />
              <Route path="finance/ap/aging" element={<ApAgingPage />} />
              <Route path="finance/ap/payments/proposals" element={<FinanceApPaymentProposalsPage />} />
              <Route path="finance/cash/position" element={<CashPositionPage />} />
              <Route path="finance/cash/banks" element={<BankAccountsListPage />} />
              <Route path="finance/cash/reconciliation" element={<BankReconciliationHomePage />} />
              <Route path="finance/cash/petty" element={<PettyCashPage />} />
              <Route path="finance/tax" element={<FinanceTaxCompliancePage />} />
              <Route
                path="finance/budgets"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.BUDGET.VIEW}>
                    <BudgetSetupPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="finance/budgets/vs-actual"
                element={
                  <PermissionOnlyRoute permission={PERMISSIONS.BUDGET.FINANCE_VIEW}>
                    <BudgetVsActualPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route path="bank-reconciliation" element={<BankReconciliationHomePage />} />
              <Route path="bank-reconciliation/statements" element={<BankStatementsListPage />} />
              <Route path="bank-reconciliation/statements/new" element={<CreateBankStatementPage />} />
              <Route path="bank-reconciliation/statements/:id" element={<BankStatementDetailsPage />} />
              <Route path="bank-reconciliation/match" element={<MatchBankReconciliationPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </BrandingProvider>
    </AuthProvider>
  );
}
