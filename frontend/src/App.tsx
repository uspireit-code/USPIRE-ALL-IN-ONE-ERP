import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { useAuth } from './auth/AuthContext';
import { BrandingProvider } from './branding/BrandingContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AccessDeniedPage } from './pages/AccessDeniedPage';
import { DashboardPage } from './pages/DashboardPage';
import { ManagementDashboardPage } from './pages/ManagementDashboardPage';
import { LoginPage } from './pages/LoginPage';
import { ApHomePage } from './pages/ap/ApHomePage';
import { CreateInvoicePage } from './pages/ap/CreateInvoicePage';
import { CreateSupplierPage } from './pages/ap/CreateSupplierPage';
import { InvoiceDetailsPage } from './pages/ap/InvoiceDetailsPage';
import { InvoicesListPage } from './pages/ap/InvoicesListPage';
import { SuppliersListPage } from './pages/ap/SuppliersListPage';
import { ArHomePage } from './pages/ar/ArHomePage';
import { CreateCustomerPage } from './pages/ar/CreateCustomerPage';
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
  FinanceArStatementsPage,
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

function AdminOnlyRoute(props: { children: React.ReactNode }) {
  const { state } = useAuth();
  const isAdmin = Boolean(state.me?.user?.roles?.includes('ADMIN'));
  if (!isAdmin) return <AccessDeniedPage />;
  return <>{props.children}</>;
}

function PermissionOnlyRoute(props: { permission: string; children: React.ReactNode }) {
  const { state } = useAuth();
  const perms = (state.me?.permissions ?? []) as string[];
  const has = perms.includes(props.permission);
  if (!has) return <AccessDeniedPage />;
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
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="dashboard" element={<ManagementDashboardPage />} />
              <Route path="ap" element={<ApHomePage />} />
              <Route path="ap/suppliers" element={<SuppliersListPage />} />
              <Route path="ap/suppliers/new" element={<CreateSupplierPage />} />
              <Route path="ap/invoices" element={<InvoicesListPage />} />
              <Route path="ap/invoices/new" element={<CreateInvoicePage />} />
              <Route path="ap/invoices/:id" element={<InvoiceDetailsPage />} />
              <Route path="ar" element={<ArHomePage />} />
              <Route path="ar/customers" element={<CustomersListPage />} />
              <Route path="ar/customers/new" element={<CreateCustomerPage />} />
              <Route path="ar/invoices" element={<ArInvoicesListPage />} />
              <Route path="ar/invoices/new" element={<CreateArInvoicePage />} />
              <Route path="ar/invoices/:id" element={<ArInvoiceDetailsPage />} />
              <Route path="ar/receipts" element={<ReceiptsPage />} />
              <Route path="ar/receipts/new" element={<CreateReceiptPage />} />
              <Route path="ar/receipts/:id" element={<ReceiptDetailsPage />} />
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
                  <PermissionOnlyRoute permission="BUDGET_VIEW">
                    <BudgetSetupPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="budgets/vs-actual"
                element={
                  <PermissionOnlyRoute permission="FINANCE_BUDGET_VIEW">
                    <BudgetVsActualPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="budget-vs-actual"
                element={
                  <PermissionOnlyRoute permission="FINANCE_BUDGET_VIEW">
                    <BudgetVsActualPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <AdminOnlyRoute>
                    <SettingsPage />
                  </AdminOnlyRoute>
                }
              />
              <Route
                path="settings/organisation"
                element={
                  <AdminOnlyRoute>
                    <SettingsOrganisationPage />
                  </AdminOnlyRoute>
                }
              />
              <Route
                path="settings/users"
                element={
                  <AdminOnlyRoute>
                    <SettingsUsersPage />
                  </AdminOnlyRoute>
                }
              />
              <Route
                path="settings/roles"
                element={
                  <AdminOnlyRoute>
                    <SettingsRolesPage />
                  </AdminOnlyRoute>
                }
              />
              <Route
                path="settings/system"
                element={
                  <AdminOnlyRoute>
                    <SettingsSystemPage />
                  </AdminOnlyRoute>
                }
              />
              <Route path="forecasts" element={<ForecastsListPage />} />
              <Route path="forecasts/new" element={<ForecastCreatePage />} />
              <Route path="forecasts/:forecastId" element={<ForecastDetailsPage />} />
              <Route path="forecasts/:forecastId/edit" element={<ForecastEditPage />} />
              <Route
                path="finance/coa"
                element={
                  <PermissionOnlyRoute permission="FINANCE_COA_VIEW">
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
                  <PermissionOnlyRoute permission="FINANCE_GL_VIEW">
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
                  <PermissionOnlyRoute permission="FINANCE_GL_APPROVE">
                    <ReviewQueuePage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="finance/gl/post"
                element={
                  <PermissionOnlyRoute permission="FINANCE_GL_FINAL_POST">
                    <PostQueuePage />
                  </PermissionOnlyRoute>
                }
              />
              <Route path="finance/ar/customers" element={<CustomersListPage />} />
              <Route path="finance/ar/invoices" element={<ArInvoicesListPage />} />
              <Route path="finance/ar/receipts" element={<ReceiptsPage />} />
              <Route path="finance/ar/receipts/new" element={<CreateReceiptPage />} />
              <Route path="finance/ar/receipts/:id" element={<ReceiptDetailsPage />} />
              <Route path="finance/ar/aging" element={<ArAgingPage />} />
              <Route path="finance/ar/statements" element={<FinanceArStatementsPage />} />
              <Route path="finance/ap/suppliers" element={<SuppliersListPage />} />
              <Route path="finance/ap/invoices" element={<InvoicesListPage />} />
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
                  <PermissionOnlyRoute permission="BUDGET_VIEW">
                    <BudgetSetupPage />
                  </PermissionOnlyRoute>
                }
              />
              <Route
                path="finance/budgets/vs-actual"
                element={
                  <PermissionOnlyRoute permission="FINANCE_BUDGET_VIEW">
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
