import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

export type PostingEligibilityAccount = {
  id: string;
  status: string | null | undefined;
  isActive: boolean | null | undefined;
  isPostingAllowed: boolean | null | undefined;
  isPosting: boolean | null | undefined;
  isControlAccount?: boolean | null | undefined;
};

export type PostingEligibilityOptions = {
  allowControlAccount?: boolean;
  errorMode?: 'FORBIDDEN' | 'BAD_REQUEST';
};

function resolveLifecyclePostingBlockMessage(status: string): string | null {
  const s = String(status ?? '').trim().toUpperCase();
  if (s === 'ACTIVE') {
    return null;
  }
  if (s === 'DRAFT') {
    return 'Account is pending approval and cannot be posted.';
  }
  if (s === 'BLOCKED') {
    return 'Account is blocked and cannot be used for posting.';
  }
  if (s === 'RETIRED') {
    return 'Account is retired and cannot be used for posting.';
  }
  return 'Account is not ACTIVE and cannot be used for posting.';
}

function throwEligibilityError(message: string, errorMode: 'FORBIDDEN' | 'BAD_REQUEST'):
  never {
  if (errorMode === 'BAD_REQUEST') {
    throw new BadRequestException(message);
  }
  throw new ForbiddenException(message);
}

export function validateAccountPostingEligibility(
  account: PostingEligibilityAccount,
  options?: PostingEligibilityOptions,
) {
  const errorMode = options?.errorMode ?? 'FORBIDDEN';
  const allowControlAccount = options?.allowControlAccount ?? true;

  const lifecycle = String(account?.status ?? '').trim().toUpperCase();
  const lifecycleMsg = resolveLifecyclePostingBlockMessage(lifecycle);
  if (lifecycleMsg) {
    throwEligibilityError(lifecycleMsg, errorMode);
  }

  if (!account?.isActive) {
    throwEligibilityError('Account is inactive and cannot be posted.', errorMode);
  }

  if (!allowControlAccount && Boolean((account as any).isControlAccount)) {
    throwEligibilityError('Control accounts cannot be used for postings.', errorMode);
  }

  if (!account?.isPostingAllowed) {
    throwEligibilityError(
      'Account is not posting-allowed and cannot be posted.',
      errorMode,
    );
  }

  if (!account?.isPosting) {
    throwEligibilityError('Account is non-posting and cannot be posted.', errorMode);
  }
}
