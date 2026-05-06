import { BadRequestException, ForbiddenException } from '@nestjs/common';

export type SegmentCompletenessAccount = {
  id: string;
  requiresDepartment?: boolean | null;
  requiresProject?: boolean | null;
  requiresFund?: boolean | null;
};

export type SegmentCompletenessJournalLine = {
  accountId: string;
  lineNumber?: number | null;
  departmentId?: string | null;
  projectId?: string | null;
  fundId?: string | null;
};

export type SegmentCompletenessOptions = {
  errorMode?: 'FORBIDDEN' | 'BAD_REQUEST';
  module?: string;
  transactionType?: string;
};

function throwSegmentError(
  message: string,
  errorMode: 'FORBIDDEN' | 'BAD_REQUEST',
): never {
  if (errorMode === 'BAD_REQUEST') {
    throw new BadRequestException(message);
  }
  throw new ForbiddenException(message);
}

export function validateSegmentCompleteness(
  account: SegmentCompletenessAccount,
  journalLine: SegmentCompletenessJournalLine,
  options?: SegmentCompletenessOptions,
) {
  const errorMode = options?.errorMode ?? 'BAD_REQUEST';

  const missing: string[] = [];

  const requiresDepartment = Boolean((account as any)?.requiresDepartment);
  const requiresProject = Boolean((account as any)?.requiresProject);
  const requiresFund = Boolean((account as any)?.requiresFund);

  const departmentId = journalLine?.departmentId ?? null;
  const projectId = journalLine?.projectId ?? null;
  const fundId = journalLine?.fundId ?? null;

  if (fundId && !projectId) {
    throwSegmentError(
      `Project must be selected before Fund (accountId=${String(account?.id)}, line=${String(journalLine?.lineNumber ?? '')})`,
      errorMode,
    );
  }

  if (requiresDepartment && !departmentId) missing.push('Department');
  if (requiresProject && !projectId) missing.push('Project');
  if (requiresFund && !fundId) missing.push('Fund');

  if (missing.length > 0) {
    const linePart =
      journalLine?.lineNumber !== null && journalLine?.lineNumber !== undefined
        ? `Line ${journalLine.lineNumber}: `
        : '';

    throwSegmentError(
      `${linePart}Missing required segment(s): ${missing.join(', ')} (accountId=${String(
        account?.id,
      )})`,
      errorMode,
    );
  }
}
