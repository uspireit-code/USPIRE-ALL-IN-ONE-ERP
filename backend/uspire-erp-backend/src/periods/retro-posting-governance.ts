import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import type { PostingGovernanceContext } from './period-posting-governance';

export type RetroPostingDecision =
  | { allowed: true; retro: boolean; daysBack: number }
  | { allowed: false; retro: boolean; daysBack: number; reason: string };

function readGovernanceReason(req: Request): string {
  return String(req.header('x-governance-reason') ?? '').trim();
}

function readReason(params: {
  req?: Request;
  context?: PostingGovernanceContext;
}): string {
  const reason = String(params.context?.governanceReason ?? '').trim();
  if (reason) return reason;
  return params.req ? readGovernanceReason(params.req) : '';
}

function getEscalation(params: {
  req?: Request;
  context?: PostingGovernanceContext;
}): unknown {
  if (params.context?.getEscalation) return params.context.getEscalation();
  if (params.req) return (params.req as any).governanceEscalation;
  return undefined;
}

function setEscalation(params: {
  req?: Request;
  context?: PostingGovernanceContext;
  escalation: any;
}) {
  if (params.context?.setEscalation) {
    params.context.setEscalation(params.escalation);
    return;
  }
  if (params.req) {
    (params.req as any).governanceEscalation = params.escalation;
  }
}

function startOfDayUtc(d: Date): Date {
  return new Date(d.toISOString().slice(0, 10));
}

function daysBetweenUtc(a: Date, b: Date): number {
  const ms = startOfDayUtc(a).getTime() - startOfDayUtc(b).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function evaluateRetroPosting(params: {
  postingDate: Date;
  now: Date;
  toleranceDays: number;
}): RetroPostingDecision {
  const daysBack = daysBetweenUtc(params.now, params.postingDate);
  const retro = daysBack > 0;

  if (!retro) return { allowed: true, retro: false, daysBack: 0 };

  if (daysBack <= Math.max(0, params.toleranceDays)) {
    return { allowed: true, retro: true, daysBack };
  }

  return {
    allowed: false,
    retro: true,
    daysBack,
    reason: `Retro posting exceeds tolerance (${daysBack} days back; tolerance ${params.toleranceDays} days)`,
  };
}

export function assertRetroPostingWithinToleranceOrEscalated(params: {
  req?: Request;
  context?: PostingGovernanceContext;
  postingDate: Date;
  now?: Date;
  toleranceDays: number;
  escalationType?: string;
}) {
  const now = params.now ?? new Date();
  const decision = evaluateRetroPosting({
    postingDate: params.postingDate,
    now,
    toleranceDays: params.toleranceDays,
  });

  if (decision.allowed) return decision;

  const reason = readReason({ req: params.req, context: params.context });
  if (!reason || reason.length < 3) {
    throw new ForbiddenException({
      error: 'Posting blocked by retro posting control',
      code: 'RETRO_POSTING_OVERRIDE_REQUIRED',
      overrideCode: 'RETRO_POSTING_OVERRIDE',
      entryPoint: 'GL_JOURNAL_POST',
      reason:
        'Governance reason is required for retro posting. Provide x-governance-reason header.',
    });
  }

  if (params.req) {
    const sessionId = String(params.req.header('x-override-session-id-retro') ?? '').trim();
    if (!sessionId) {
      throw new ForbiddenException({
        error: 'Posting blocked by retro posting control',
        code: 'RETRO_POSTING_OVERRIDE_REQUIRED',
        overrideCode: 'RETRO_POSTING_OVERRIDE',
        entryPoint: 'GL_JOURNAL_POST',
        reason:
          'Override session is required for retro posting. Provide x-override-session-id-retro header.',
      });
    }
    (params.req as any).governanceOverrideSessionIdRetro = sessionId;
  }

  // Conservative behavior: if no escalation sink is available, do not allow override.
  const existing = getEscalation({ req: params.req, context: params.context });
  if (!existing && !params.req && !params.context?.setEscalation) {
    throw new ForbiddenException({
      error: 'Posting blocked by retro posting control',
      code: 'RETRO_POSTING_OVERRIDE_REQUIRED',
      overrideCode: 'RETRO_POSTING_OVERRIDE',
      entryPoint: 'GL_JOURNAL_POST',
      reason: decision.reason,
    });
  }

  if (!existing) {
    setEscalation({
      req: params.req,
      context: params.context,
      escalation: {
        type: params.escalationType ?? 'RETRO_POSTING_OVERRIDE',
        reason,
        details: {
          postingDate: params.postingDate,
          now,
          toleranceDays: params.toleranceDays,
          daysBack: decision.daysBack,
        },
      },
    });
  }

  return { allowed: true, retro: true, daysBack: decision.daysBack } as const;
}

export async function loadTenantRetroPostToleranceDays(params: {
  prisma: any;
  tenantId: string;
}): Promise<number> {
  const controls = await (params.prisma.tenant as any).findUnique({
    where: { id: params.tenantId },
    select: { retroPostToleranceDays: true },
  });

  return Math.max(
    0,
    Math.floor(Number((controls as any)?.retroPostToleranceDays ?? 0)),
  );
}
