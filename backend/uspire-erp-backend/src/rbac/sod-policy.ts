export interface SoDCheckContext {
  action: string;
  actorUserId: string;
  entityType: string;
  entityId: string;
  createdById?: string;
  approvedById?: string;
  postedById?: string;
  submittedById?: string;
  reviewedById?: string;
  reversalInitiatedById?: string;
  checklistCompletedByIds?: string[];
  allowSelfPosting?: boolean;
}

export function evaluateSoD(ctx: SoDCheckContext): {
  allowed: boolean;
  reason?: string;
  ruleCode?: string;
} {
  const actor = String(ctx.actorUserId ?? '');
  const createdBy = ctx.createdById ? String(ctx.createdById) : undefined;
  const approvedBy = ctx.approvedById ? String(ctx.approvedById) : undefined;
  const postedBy = ctx.postedById ? String(ctx.postedById) : undefined;
  const submittedBy = ctx.submittedById ? String(ctx.submittedById) : undefined;
  const reviewedBy = ctx.reviewedById ? String(ctx.reviewedById) : undefined;
  const reversalInitiatedBy = ctx.reversalInitiatedById
    ? String(ctx.reversalInitiatedById)
    : undefined;
  const action = String(ctx.action ?? '').trim();

  if (!actor) {
    return { allowed: false, reason: 'Missing actorUserId', ruleCode: 'SOD_CONTEXT_MISSING' };
  }

  if (action === 'APPROVE') {
    if (createdBy && actor === createdBy) {
      return {
        allowed: false,
        reason: 'Creator cannot approve',
        ruleCode: 'SOD_MAKER_CANNOT_APPROVE',
      };
    }
  }

  if (action === 'POST') {
    if (createdBy && actor === createdBy) {
      return {
        allowed: false,
        reason: 'Creator cannot post',
        ruleCode: 'SOD_MAKER_CANNOT_POST',
      };
    }

    if (approvedBy && actor === approvedBy) {
      return {
        allowed: false,
        reason: 'Approver cannot post',
        ruleCode: 'SOD_APPROVER_CANNOT_POST',
      };
    }
  }

  if (action === 'VOID') {
    if (postedBy && actor === postedBy) {
      return {
        allowed: false,
        reason: 'Poster cannot void',
        ruleCode: 'SOD_POSTER_CANNOT_VOID',
      };
    }
  }

  if (action === 'AR_RECEIPT_POST') {
    if (ctx.allowSelfPosting === false && createdBy && actor === createdBy) {
      return {
        allowed: false,
        reason: 'Posting blocked: you cannot post a receipt you prepared',
        ruleCode: 'SOD_AR_RECEIPT_SELF_POST_DISABLED',
      };
    }
  }

  if (action === 'PERIOD_CLOSE_APPROVE') {
    const completedByIds = Array.isArray(ctx.checklistCompletedByIds)
      ? ctx.checklistCompletedByIds.map((x) => String(x))
      : [];
    if (completedByIds.includes(actor)) {
      return {
        allowed: false,
        reason: 'User who completed checklist items cannot close the accounting period',
        ruleCode: 'SOD_PERIOD_CLOSE_CHECKLIST_CONFLICT',
      };
    }
  }

  if (action === 'GL_JOURNAL_REVIEW') {
    if (
      (createdBy && actor === createdBy) ||
      (submittedBy && actor === submittedBy) ||
      (reversalInitiatedBy && actor === reversalInitiatedBy)
    ) {
      return {
        allowed: false,
        reason:
          'You cannot review a journal you prepared, submitted, or initiated for reversal.',
        ruleCode: 'SOD_GL_REVIEW_CONFLICT',
      };
    }
  }

  if (action === 'GL_JOURNAL_REJECT') {
    if (
      (createdBy && actor === createdBy) ||
      (submittedBy && actor === submittedBy) ||
      (reversalInitiatedBy && actor === reversalInitiatedBy)
    ) {
      return {
        allowed: false,
        reason:
          'You cannot reject a journal you prepared, submitted, or initiated for reversal.',
        ruleCode: 'SOD_GL_REJECT_CONFLICT',
      };
    }
  }

  if (action === 'GL_JOURNAL_POST') {
    if (reversalInitiatedBy && actor === reversalInitiatedBy) {
      return {
        allowed: false,
        reason: 'Posting blocked by Segregation of Duties (SoD)',
        ruleCode: 'SOD_GL_POST_REVERSAL_INITIATOR_CONFLICT',
      };
    }
    if (createdBy && actor === createdBy) {
      return {
        allowed: false,
        reason: 'Posting blocked by Segregation of Duties (SoD)',
        ruleCode: 'SOD_GL_POST_CREATED_BY_CONFLICT',
      };
    }
    if (reviewedBy && actor === reviewedBy) {
      return {
        allowed: false,
        reason: 'Posting blocked by Segregation of Duties (SoD)',
        ruleCode: 'SOD_GL_POST_REVIEWED_BY_CONFLICT',
      };
    }
  }

  if (action === 'GL_JOURNAL_RETURN_TO_REVIEW') {
    if (createdBy && actor === createdBy) {
      return {
        allowed: false,
        reason: 'Posting blocked by Segregation of Duties (SoD)',
        ruleCode: 'SOD_GL_RETURN_TO_REVIEW_CREATED_BY_CONFLICT',
      };
    }
    if (reviewedBy && actor === reviewedBy) {
      return {
        allowed: false,
        reason: 'Posting blocked by Segregation of Duties (SoD)',
        ruleCode: 'SOD_GL_RETURN_TO_REVIEW_REVIEWED_BY_CONFLICT',
      };
    }
  }

  if (action === 'GL_JOURNAL_REVERSE') {
    if (createdBy && actor === createdBy) {
      return {
        allowed: false,
        reason: 'You cannot reverse a journal you prepared.',
        ruleCode: 'SOD_GL_REVERSE_CREATED_BY_CONFLICT',
      };
    }
  }

  if (action === 'PERIOD_CORRECT_POSTED') {
    if (createdBy && actor === createdBy) {
      return {
        allowed: false,
        reason: 'Period creator cannot correct a period that has posted journals',
        ruleCode: 'SOD_PERIOD_CREATOR_CORRECT_POSTED',
      };
    }
  }

  return { allowed: true };
}
