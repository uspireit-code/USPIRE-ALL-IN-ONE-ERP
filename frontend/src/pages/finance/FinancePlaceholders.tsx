import { ComingSoonPage } from '../ComingSoonPage';

export function GlJournalsPage() {
  return (
    <ComingSoonPage
      title="Journals"
      description="Create, review, and post general ledger journals. This area will support draft journals, maker-checker controls, and posting/audit traceability."
    />
  );
}

export function GlRecurringJournalsPage() {
  return (
    <ComingSoonPage
      title="Recurring Journals"
      description="Define recurring journal templates (monthly accruals, allocations, etc.). This will include schedules, approvals, and posting history."
    />
  );
}

export function GlReviewQueuePage() {
  return (
    <ComingSoonPage
      title="Review Queue"
      description="Work queue for journals awaiting review/approval. This will surface control checks, required evidence, and approval actions."
    />
  );
}

export function FinanceArStatementsPage() {
  return (
    <ComingSoonPage
      title="AR Statements"
      description="Generate customer statements for selected periods. This will include statement templates, delivery options, and audit logging."
    />
  );
}

export function FinanceApPaymentProposalsPage() {
  return (
    <ComingSoonPage
      title="Payment Proposals"
      description="Prepare payment proposals from approved AP invoices, with prioritisation rules, approval workflows, and controlled payment execution."
    />
  );
}

export function CashPositionPage() {
  return (
    <ComingSoonPage
      title="Cash Position"
      description="View current and projected cash position across bank accounts. This will include inflows/outflows, ageing, and forecast overlays."
    />
  );
}

export function PettyCashPage() {
  return (
    <ComingSoonPage
      title="Petty Cash"
      description="Manage petty cash float, reimbursements, and supporting evidence. This will include controls and reconciliation to the general ledger."
    />
  );
}

export function FinanceTaxCompliancePage() {
  return (
    <ComingSoonPage
      title="Tax & Compliance"
      description="Tax configuration and compliance reporting for the tenant. This will include tax codes, VAT settings, and statutory reporting support."
    />
  );
}

export function DisclosureNotesPage() {
  return (
    <ComingSoonPage
      title="Disclosure Notes"
      description="Financial statement disclosure notes and supporting schedules. This will include structured note templates and references to underlying balances."
    />
  );
}
