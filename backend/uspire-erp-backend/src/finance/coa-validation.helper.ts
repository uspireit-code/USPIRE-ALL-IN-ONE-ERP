export function mapCoaMissingField(field: string): string {
  const key = String(field ?? '').trim();

  switch (key) {
    case 'parentAccountId':
      return 'Parent account is required.';
    case 'ifrsMappingCode':
      return 'IFRS mapping is required.';
    case 'fsMappingLevel1':
      return 'FS mapping level 1 is required.';
    case 'fsMappingLevel2':
      return 'FS mapping level 2 is required.';
    case 'isBudgetRelevant':
      return 'Budget relevance must be selected for this account.';
    case 'budgetControlMode':
      return 'Budget control mode must be selected for this account.';
    case 'isPostingAllowed':
      return 'Posting flag must be disabled for root category accounts.';
    default:
      return 'This field is required.';
  }
}
