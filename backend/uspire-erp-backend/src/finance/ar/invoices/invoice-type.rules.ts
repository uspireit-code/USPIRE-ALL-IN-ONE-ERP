export type InvoiceType =
  | 'TRAINING'
  | 'CONSULTING'
  | 'SYSTEMS'
  | 'PUBLISHING'
  | 'DONATION'
  | 'OTHER';

export const INVOICE_TYPE_REVENUE_ACCOUNT_CODE: Record<
  Exclude<InvoiceType, 'OTHER'>,
  string
> = {
  TRAINING: '40160',
  CONSULTING: '40120',
  SYSTEMS: '40180',
  PUBLISHING: '40200',
  DONATION: '70140',
};

export function requiresProjectForInvoiceType(type: InvoiceType): boolean {
  return type === 'TRAINING' || type === 'CONSULTING' || type === 'SYSTEMS';
}

export const AR_INVOICE_RULES_ERROR = {
  invoiceTypeRequired: 'Invoice type is required before posting.',
  projectRequired: 'Project is required for this invoice type before posting.',
  revenueAccountInvalid:
    'Revenue account for invoice type is not configured or is invalid. Please check Chart of Accounts.',
};
