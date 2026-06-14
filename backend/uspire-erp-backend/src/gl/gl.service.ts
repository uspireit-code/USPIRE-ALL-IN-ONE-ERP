import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AuditEntityType,
  AuditEventType,
  JournalReviewMode,
  Prisma,
  type JournalType,
} from '@prisma/client';
import type { Request } from 'express';
import {
  sortBy,
  sumBy,
  uniq,
  uniqBy,
} from 'lodash';
import {
  buildOverlapPeriodFieldError,
  validateMonthlyPeriodDates,
  throwPeriodValidation,
} from '../periods/period-validation';
import * as ExcelJS from 'exceljs';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { CoaReclassificationResolverService } from '../reports/coa-reclassification-resolver.service';
import { writeAuditEventWithPrisma } from '../audit/audit-writer';
import {
  buildGovernanceAuditMetadata,
  maybeBuildGovernanceOverrideAuditMetadata,
} from '../governance/governance-enforcement';
import { assertOverrideGovernance } from '../governance/override-governance-engine';
import { getOverridePolicy } from '../governance/override-governance-registry';
import { GovernanceOverrideSessionService } from '../governance/governance-override-session.service';
import { GovernanceAutomationExecutionSessionService } from '../governance/governance-automation-execution-session.service';
import { GovernanceAutomationScheduleService } from '../governance/governance-automation-schedule.service';
import { assertEvidenceGovernance } from '../governance/evidence-governance-engine';
import { assertIntercompanyGovernance } from '../governance/intercompany-governance-engine';
import { validateSegmentCompleteness } from '../finance/common/segment-completeness';
import { PeriodStatus } from '../periods/period-semantics';
import {
  requireOwnership,
  requirePermission,
} from '../rbac/finance-authz.helpers';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { assertPeriodAllowsPosting } from '../periods/period-posting-governance';
import {
  assertRetroPostingWithinToleranceOrEscalated,
  loadTenantRetroPostToleranceDays,
} from '../periods/retro-posting-governance';
import { getEffectiveActorContext } from '../auth/actor-context';
import { SoDService } from '../sod/sod.service';
import { withGlLifecycleBypass } from '../internal/request-context.store';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { CreateAccountingPeriodDto } from './dto/create-accounting-period.dto';
import { CreateJournalDto } from './dto/create-journal.dto';
import { CreateRecurringTemplateDto } from './dto/create-recurring-template.dto';
import { ExecuteRecurringAutomationDto } from './dto/execute-recurring-automation.dto';
import { ExecuteReversalAutomationDto } from './dto/execute-reversal-automation.dto';
import { GenerateRecurringTemplateDto } from './dto/generate-recurring-template.dto';
import { OpeningBalancesQueryDto } from './dto/opening-balances-query.dto';
import { ReturnToReviewDto } from './dto/return-to-review.dto';
import { ReverseJournalDto } from './dto/reverse-journal.dto';
import { TrialBalanceQueryDto } from './dto/trial-balance-query.dto';
import { UpdateJournalDto } from './dto/update-journal.dto';
import { UpdateRecurringTemplateDto } from './dto/update-recurring-template.dto';
import { UpsertOpeningBalancesJournalDto } from './dto/upsert-opening-balances-journal.dto';
import { VoidJournalDto } from './dto/void-journal.dto';
import {
  assertJournalTypePolicy,
  buildJournalTypePolicyContextFromEntry,
  resolveJournalPolicyType,
} from './journal-type-policy-engine';
import { getJournalTypePolicy } from './journal-type-registry';
import { assertCombinationGovernance } from './combination-governance-engine';

type RecurringTemplateStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SUSPENDED'
  | 'ARCHIVED';

export enum DepartmentRequirement {
  REQUIRED = 'REQUIRED',
  OPTIONAL = 'OPTIONAL',
  FORBIDDEN = 'FORBIDDEN',
}

type GlScopedProps = {
  effectiveTo?: Date | null;
  isActive?: boolean;
  type?: string | null;
  isControlAccount?: boolean | null;
};

type JournalRiskStage = 'SUBMIT' | 'REVIEW' | 'POST';

type JournalRiskResult = {
  score: number;
  flags: string[];
};

type JournalBudgetStage = 'SUBMIT' | 'REVIEW' | 'POST';

type JournalBudgetLineImpact = {
  lineId: string;
  lineNumber: number | null;
  accountId: string;
  accountCode: string | null;
  lineAmount: number;
  legalEntityId: string | null;
  departmentId: string | null;
  projectId: string | null;
  fundId: string | null;
  matchedBudgetLine: {
    id: string;
    amount: number;
    matchType: 'EXACT' | 'FALLBACK';
  } | null;
  budgetedAmount: number | null;
  availableAmount: number | null;
  variance: number | null;
  status: 'OK' | 'WARN' | 'BLOCK';
  flags: string[];
};

type JournalBudgetImpactResult = {
  budgetStatus: 'OK' | 'WARN' | 'BLOCK';
  budgetFlags: any[];
  lineImpacts: JournalBudgetLineImpact[];
};

@Injectable()
export class GlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly coaReclass: CoaReclassificationResolverService,
    private readonly sod: SoDService,
    private readonly overrideSessions: GovernanceOverrideSessionService,
    private readonly automationExecutions: GovernanceAutomationExecutionSessionService,
    private readonly automationSchedules: GovernanceAutomationScheduleService,
  ) {}

  async executeRecurringAutomation(
    req: Request,
    templateId: string,
    dto: ExecuteRecurringAutomationDto,
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const runDateRaw = String(dto?.runDate ?? '').trim();
    if (!runDateRaw) {
      throw new BadRequestException('runDate is required');
    }
    const runDate = new Date(runDateRaw);
    if (Number.isNaN(runDate.getTime())) {
      throw new BadRequestException('Invalid runDate');
    }

    const evidenceRefs = Array.isArray(dto?.evidenceRefs) ? dto.evidenceRefs : [];
    const overrideSessionId = String(dto?.overrideSessionId ?? '').trim() || null;
    const scheduleId = String((dto as any)?.scheduleId ?? '').trim() || null;

    const scheduleRow = scheduleId
      ? await this.automationSchedules.getSchedule({ tenantId: tenant.id, scheduleId })
      : null;

    if (scheduleId) {
      await this.automationSchedules.markAttempt({
        tenantId: tenant.id,
        scheduleId,
        now: new Date(),
      });
    }

    const execution = await this.automationExecutions.startExecution({
      tenantId: tenant.id,
      automationCode: 'RECURRING_JOURNAL_AUTOMATION',
      scheduleId,
      actorType: 'USER',
      actorUserId: user.id,
      permissionUsed: PERMISSIONS.GL.RECURRING_GENERATE,
      req,
      journalType: 'STANDARD',
      evidenceRefs: evidenceRefs.map((e) => ({
        id: String(e.id),
        evidenceCategory: (e as any)?.evidenceCategory ?? null,
        fileName: (e as any)?.fileName ?? null,
      })),
      overrideSessionId,
      overrideCodesUsed: overrideSessionId ? ['GL_POST_OVERRIDE'] : [],
      lastExecutionAt: scheduleRow ? (scheduleRow as any).lastRunAt : null,
      isSuspended: scheduleRow ? String((scheduleRow as any).scheduleStatus) === 'SUSPENDED' : false,
    });

    try {
      // Ensure downstream governance validators have a reason available for audit metadata
      const governanceReason = String(dto?.governanceReason ?? '').trim();
      if (governanceReason) {
        (req as any).headers = (req as any).headers ?? {};
        (req as any).headers['x-governance-reason'] = governanceReason;
      }

      // Generate DRAFT journal (no posting) using existing generation pipeline.
      const created = await this.generateJournalFromRecurringTemplate(req, templateId, {
        runDate: runDate.toISOString(),
      });

      // Attach automation linkage metadata onto the journal for traceability.
      await (this.prisma.journalEntry as any).update({
        where: { id: created.id },
        data: {
          sourceType: 'AUTOMATION',
          sourceId: execution.id,
        },
        select: { id: true },
      });

      if (dto?.autoSubmitForReview) {
        // Still governed; moves DRAFT->SUBMITTED via existing lifecycle.
        await this.submitJournal(req, created.id);
      }

      await this.automationExecutions.completeExecution({
        tenantId: tenant.id,
        executionId: execution.id,
        completedById: user.id,
        req,
        permissionUsed: PERMISSIONS.GL.RECURRING_GENERATE,
        executionResult: {
          generatedJournalId: created.id,
          autoSubmitForReview: Boolean(dto?.autoSubmitForReview),
        },
      });

      if (scheduleId) {
        const nextRunAt = this.automationSchedules.computeNextRunAt({
          schedule: scheduleRow,
          automationCode: 'RECURRING_JOURNAL_AUTOMATION',
          now: runDate,
        });
        await this.automationSchedules.markSuccess({
          tenantId: tenant.id,
          scheduleId,
          nextRunAt,
        });
      }

      return {
        execution,
        generatedJournal: created,
      };
    } catch (e: any) {
      if (scheduleId) {
        await this.automationSchedules.markFailure({
          tenantId: tenant.id,
          scheduleId,
          failureReason: String(e?.message ?? 'Recurring automation failed'),
          automationCode: 'RECURRING_JOURNAL_AUTOMATION',
        });
      }
      await this.automationExecutions.failExecution({
        tenantId: tenant.id,
        executionId: execution.id,
        failedById: user.id,
        req,
        permissionUsed: PERMISSIONS.GL.RECURRING_GENERATE,
        failureReason: String(e?.message ?? 'Recurring automation failed'),
        executionResult: {
          error: e?.message ?? null,
        },
      });
      throw e;
    }
  }

  async executeReversalAutomation(
    req: Request,
    originalJournalId: string,
    dto: ExecuteReversalAutomationDto,
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const evidenceRefs = Array.isArray(dto?.evidenceRefs) ? dto.evidenceRefs : [];
    const overrideSessionId = String(dto?.overrideSessionId ?? '').trim() || null;
    const scheduleId = String((dto as any)?.scheduleId ?? '').trim() || null;

    const scheduleRow = scheduleId
      ? await this.automationSchedules.getSchedule({ tenantId: tenant.id, scheduleId })
      : null;

    if (scheduleId) {
      await this.automationSchedules.markAttempt({
        tenantId: tenant.id,
        scheduleId,
        now: new Date(),
      });
    }

    const execution = await this.automationExecutions.startExecution({
      tenantId: tenant.id,
      automationCode: 'REVERSAL_AUTOMATION',
      scheduleId,
      actorType: 'USER',
      actorUserId: user.id,
      permissionUsed: PERMISSIONS.GL.FINAL_POST,
      req,
      journalType: 'REVERSING',
      evidenceRefs: evidenceRefs.map((e) => ({
        id: String(e.id),
        evidenceCategory: (e as any)?.evidenceCategory ?? null,
        fileName: (e as any)?.fileName ?? null,
      })),
      overrideSessionId,
      overrideCodesUsed: overrideSessionId ? ['PERIOD_SOFT_CLOSE_OVERRIDE', 'RETRO_POSTING_OVERRIDE'] : [],
      lastExecutionAt: scheduleRow ? (scheduleRow as any).lastRunAt : null,
      isSuspended: scheduleRow ? String((scheduleRow as any).scheduleStatus) === 'SUSPENDED' : false,
    });

    try {
      const governanceReason = String(dto?.governanceReason ?? '').trim();
      if (governanceReason) {
        (req as any).headers = (req as any).headers ?? {};
        (req as any).headers['x-governance-reason'] = governanceReason;
      }

      const created = await this.reversePostedJournal(req, originalJournalId, {
        journalDate: dto.journalDate,
        reason: dto.reason,
        reference: dto.reference,
        description: dto.description,
      });

      await (this.prisma.journalEntry as any).update({
        where: { id: created.id },
        data: {
          sourceType: 'AUTOMATION',
          sourceId: execution.id,
        },
        select: { id: true },
      });

      if (dto?.autoSubmitForReview) {
        await this.submitJournal(req, created.id);
      }

      await this.automationExecutions.completeExecution({
        tenantId: tenant.id,
        executionId: execution.id,
        completedById: user.id,
        req,
        permissionUsed: PERMISSIONS.GL.FINAL_POST,
        executionResult: {
          reversalJournalId: created.id,
          reversalOfId: originalJournalId,
          autoSubmitForReview: Boolean(dto?.autoSubmitForReview),
        },
      });

      if (scheduleId) {
        const runAt = dto?.journalDate ? new Date(String(dto.journalDate)) : new Date();
        const nextRunAt = this.automationSchedules.computeNextRunAt({
          schedule: scheduleRow,
          automationCode: 'REVERSAL_AUTOMATION',
          now: Number.isNaN(runAt.getTime()) ? new Date() : runAt,
        });
        await this.automationSchedules.markSuccess({
          tenantId: tenant.id,
          scheduleId,
          nextRunAt,
        });
      }

      return {
        execution,
        reversalJournal: created,
      };
    } catch (e: any) {
      if (scheduleId) {
        await this.automationSchedules.markFailure({
          tenantId: tenant.id,
          scheduleId,
          failureReason: String(e?.message ?? 'Reversal automation failed'),
          automationCode: 'REVERSAL_AUTOMATION',
        });
      }
      await this.automationExecutions.failExecution({
        tenantId: tenant.id,
        executionId: execution.id,
        failedById: user.id,
        req,
        permissionUsed: PERMISSIONS.GL.FINAL_POST,
        failureReason: String(e?.message ?? 'Reversal automation failed'),
        executionResult: {
          error: e?.message ?? null,
        },
      });
      throw e;
    }
  }

  private async loadActorRoleCodes(params: {
    tenantId: string;
    actorUserId: string;
  }): Promise<string[]> {
    const rows = await (this.prisma as any).userRole.findMany({
      where: {
        userId: params.actorUserId,
        role: { tenantId: params.tenantId },
      },
      select: {
        role: { select: { code: true } },
      },
    });

    return Array.isArray(rows)
      ? rows
          .map((r: any) => String(r?.role?.code ?? '').trim())
          .filter(Boolean)
      : [];
  }

  private async assertJournalSoD(params: {
    req: Request;
    authz: any;
    actionType:
      | 'REVIEW'
      | 'REJECT'
      | 'POST'
      | 'RETURN_TO_REVIEW'
      | 'REVERSE'
      | 'VOID';
    soDAction:
      | 'GL_JOURNAL_REVIEW'
      | 'GL_JOURNAL_REJECT'
      | 'GL_JOURNAL_POST'
      | 'GL_JOURNAL_RETURN_TO_REVIEW'
      | 'GL_JOURNAL_REVERSE'
      | 'GL_JOURNAL_VOID';
    entry: {
      id: string;
      createdById?: string | null;
      submittedById?: string | null;
      reviewedById?: string | null;
      reversalInitiatedById?: string | null;
    };
    permissionUsed: string;
  }) {
    await this.sod.assertNoLifecycleConflict({
      req: params.req,
      tenantId: params.authz.tenantId,
      realUserId: params.authz.realUserId,
      actingAsUserId: (params.authz.actorUserId ?? params.authz.realUserId) === params.authz.realUserId
        ? undefined
        : params.authz.actorUserId,
      delegationId: params.authz.delegationId,
      actionType: params.actionType,
      soDAction: params.soDAction,
      entityType: AuditEntityType.JOURNAL_ENTRY,
      entityId: params.entry.id,
      createdByUserId: params.entry.createdById ?? undefined,
      submittedByUserId: params.entry.submittedById ?? undefined,
      reviewedByUserId: params.entry.reviewedById ?? undefined,
      reversalInitiatedByUserId: params.entry.reversalInitiatedById ?? undefined,
      permissionUsed: params.permissionUsed,
    });
  }

  private async assertCoaStructureNotFrozen(params: {
    tenantId: string;
    userId?: string;
    permissionUsed: string;
    action: string;
    reason?: Record<string, any>;
  }) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: params.tenantId },
      select: { coaStructureFrozen: true } as any,
    });

    const frozen = Boolean((t as any)?.coaStructureFrozen);
    if (!frozen) return;

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: params.tenantId,
          eventType: 'COA_STRUCTURE_CHANGE_BLOCKED' as any,
          entityType: 'TENANT' as any,
          entityId: params.tenantId,
          action: params.action,
          outcome: 'BLOCKED' as any,
          reason: params.reason ? JSON.stringify(params.reason) : undefined,
          userId: params.userId,
          permissionUsed: params.permissionUsed as any,
        } as any,
      })
      .catch(() => undefined);

    throw new ForbiddenException(
      'COA structure is frozen. Submit a controlled change request to modify structure.',
    );
  }

  private resolveLifecyclePostingBlockMessage(status: string): string | null {
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

  private assertAccountLifecycleAllowsPosting(params: {
    accountId: string;
    status: string | null | undefined;
  }) {
    const s = String(params.status ?? '').trim().toUpperCase();
    if (s === 'ACTIVE') return;
    const msg = this.resolveLifecyclePostingBlockMessage(s);
    if (msg) throw new ForbiddenException(msg);
  }

  private assertAccountFlagsAllowPosting(account: {
    id: string;
    isActive: boolean;
    isPostingAllowed: boolean;
    isPosting?: boolean | null;
    isControlAccount?: boolean | null;
  }) {
    if (!account.isActive) {
      throw new ForbiddenException('Account is inactive and cannot be posted.');
    }
    if ((account as any).isControlAccount) {
      throw new ForbiddenException('Control accounts cannot be used for postings.');
    }
    if (!account.isPostingAllowed) {
      throw new ForbiddenException('Account is not posting-allowed and cannot be posted.');
    }
    if (!(account as any).isPosting) {
      throw new ForbiddenException('Account is non-posting and cannot be posted.');
    }
  }

  private parseOptionalYmd(s: string | undefined): Date | null {
    const v = (s ?? '').trim();
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  private isActiveFromRecurringTemplateStatus(status: RecurringTemplateStatus): boolean {
    return status === 'APPROVED';
  }

  private assertRecurringTemplateStatusTransition(params: {
    from: RecurringTemplateStatus;
    to: RecurringTemplateStatus;
  }) {
    const { from, to } = params;

    if (from === 'ARCHIVED') {
      throw new BadRequestException('Archived templates cannot be transitioned');
    }

    const allowed: Record<RecurringTemplateStatus, RecurringTemplateStatus[]> = {
      DRAFT: ['PENDING_APPROVAL'],
      PENDING_APPROVAL: ['APPROVED'],
      APPROVED: ['SUSPENDED', 'ARCHIVED'],
      SUSPENDED: ['APPROVED', 'ARCHIVED'],
      ARCHIVED: [],
    };

    if (!allowed[from]?.includes(to)) {
      throw new BadRequestException(`Invalid template status transition: ${from} → ${to}`);
    }
  }

  private assertJournalIntentRules(params: {
    intent: string;
    periodType?: string | null;
    correctsJournalId?: string | null;
    reversalOfId?: string | null;
    attachments?: Array<{ id: string }>;
    mode:
      | 'CREATE_DRAFT'
      | 'UPDATE_DRAFT'
      | 'UPLOAD'
      | 'RECURRING_TEMPLATE'
      | 'REVERSE'
      | 'SYSTEM'
      | 'SUBMIT'
      | 'POST';
  }) {
    const intent = String(params.intent ?? '').trim().toUpperCase();
    if (!intent) {
      throw new BadRequestException('Journal intent is required');
    }

    if (intent === 'REVERSAL') {
      if (!params.reversalOfId) {
        throw new BadRequestException(
          'REVERSAL intent requires reversalOfId (use the reversal workflow)',
        );
      }
    }

    if (intent === 'CORRECTION') {
      if (!params.correctsJournalId) {
        throw new BadRequestException(
          'CORRECTION intent requires correctsJournalId',
        );
      }
    }

    if (intent === 'OPENING_BALANCE') {
      if (String(params.periodType ?? '').toUpperCase() !== 'OPENING') {
        throw new BadRequestException(
          'OPENING_BALANCE intent is only allowed in an OPENING accounting period',
        );
      }
    }

    if (intent === 'AUDIT_ADJUSTMENT') {
      if (params.mode === 'SUBMIT' || params.mode === 'POST' || params.mode === 'UPLOAD') {
        const count = (params.attachments ?? []).length;
        if (count <= 0) {
          throw new BadRequestException(
            'AUDIT_ADJUSTMENT intent requires evidence attachment(s)',
          );
        }
      }
    }

    if (intent === 'SYSTEM_GENERATED') {
      if (params.mode !== 'SYSTEM') {
        throw new BadRequestException(
          'SYSTEM_GENERATED intent is reserved for system-created journals',
        );
      }
    }
  }

  private riskBandFromScore(score: number) {
    if (score >= 40) return 'HIGH' as const;
    if (score >= 20) return 'MEDIUM' as const;
    return 'LOW' as const;
  }

  private toNum(v: any) {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private round2(n: number) {
    return Math.round(n * 100) / 100;
  }

  private startOfUtcDay(d: Date) {
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }

  private addUtcDays(d: Date, days: number) {
    const dd = new Date(d.getTime());
    dd.setUTCDate(dd.getUTCDate() + days);
    return dd;
  }

  private async resolveOpenPeriodForDate(params: {
    req: Request;
    tenantId: string;
    journalDate: Date;
    permissionUsed: string;
  }) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: params.tenantId,
        startDate: { lte: params.journalDate },
        endDate: { gte: params.journalDate },
      },
      select: {
        id: true,
        status: true,
        name: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!period) {
      throw new BadRequestException({
        code: 'INVALID_JOURNAL_DATE',
        reason: 'NO_PERIOD',
        message: 'No accounting period exists for the selected date.',
      });
    }

    try {
      assertPeriodAllowsPosting({
        req: params.req,
        period,
        permissionUsed: params.permissionUsed,
      });
    } catch {
      throw new BadRequestException({
        code: 'INVALID_JOURNAL_DATE',
        reason: 'PERIOD_CLOSED',
        message: 'Selected accounting period is closed. Choose an open period.',
      });
    }

    return period;
  }

  private async computeJournalBudgetImpact(params: {
    req: Request;
    tenantId: string;
    entry: {
      id: string;
      journalDate: Date;
      createdById: string;
      budgetOverrideJustification?: string | null;
    };
    lines: Array<{
      id: string;
      lineNumber: number | null;
      accountId: string;
      debit: any;
      credit: any;
      legalEntityId: string | null;
      departmentId: string | null;
      projectId: string | null;
      fundId: string | null;
    }>;
    stage: JournalBudgetStage;
    computedAt: Date;
    permissionUsed: string;
  }): Promise<JournalBudgetImpactResult> {
    const period = await this.resolveOpenPeriodForDate({
      req: params.req,
      tenantId: params.tenantId,
      journalDate: params.entry.journalDate,
      permissionUsed: params.permissionUsed,
    });

    const fiscalYear = new Date(period.startDate).getUTCFullYear();

    const activeBudget = await this.prisma.budget.findFirst({
      where: {
        tenantId: params.tenantId,
        fiscalYear,
        status: 'ACTIVE',
      },
      orderBy: { approvedAt: 'desc' },
      select: { id: true },
    });

    const revision = activeBudget
      ? await this.prisma.budgetRevision.findFirst({
          where: { tenantId: params.tenantId, budgetId: activeBudget.id },
          orderBy: { revisionNo: 'desc' },
          select: { id: true },
        })
      : null;

    const accountIds = [
      ...new Set(params.lines.map((l) => l.accountId).filter(Boolean)),
    ] as string[];
    const accounts = await this.prisma.account.findMany({
      where: { tenantId: params.tenantId, id: { in: accountIds } },
      select: {
        id: true,
        code: true,
        isBudgetRelevant: true,
        budgetControlMode: true,
      } as any,
    });
    const accountById = new Map(accounts.map((a: any) => [a.id, a] as const));

    const budgetLines = revision
      ? await this.prisma.budgetLine.findMany({
          where: {
            tenantId: params.tenantId,
            revisionId: revision.id,
            periodId: period.id,
            accountId: { in: accountIds },
          },
          select: {
            id: true,
            accountId: true,
            periodId: true,
            legalEntityId: true,
            departmentId: true,
            projectId: true,
            fundId: true,
            amount: true,
          },
        })
      : [];

    const byKey = new Map<string, any>();
    for (const bl of budgetLines as any[]) {
      const k = `${bl.accountId}:${bl.periodId}:${bl.legalEntityId ?? ''}:${bl.departmentId ?? ''}:${bl.projectId ?? ''}:${bl.fundId ?? ''}`;
      byKey.set(k, bl);
    }

    const lineImpacts: JournalBudgetLineImpact[] = [];

    for (const l of params.lines) {
      const account = accountById.get(l.accountId);
      const lineAmount = Math.max(this.toNum(l.debit), this.toNum(l.credit));

      const flags: string[] = [];
      let status: 'OK' | 'WARN' | 'BLOCK' = 'OK';
      let matchedBudgetLine: JournalBudgetLineImpact['matchedBudgetLine'] =
        null;
      let budgetedAmount: number | null = null;
      let availableAmount: number | null = null;
      let variance: number | null = null;

      const isBudgetRelevant = Boolean(account?.isBudgetRelevant);

      if (!isBudgetRelevant) {
        lineImpacts.push({
          lineId: l.id,
          lineNumber: l.lineNumber ?? null,
          accountId: l.accountId,
          accountCode: account?.code ?? null,
          lineAmount,
          legalEntityId: l.legalEntityId,
          departmentId: l.departmentId,
          projectId: l.projectId,
          fundId: l.fundId,
          matchedBudgetLine: null,
          budgetedAmount: null,
          availableAmount: null,
          variance: null,
          status: 'OK',
          flags: [],
        });
        continue;
      }

      const kExact = `${l.accountId}:${period.id}:${l.legalEntityId ?? ''}:${l.departmentId ?? ''}:${l.projectId ?? ''}:${l.fundId ?? ''}`;
      const kFallback = `${l.accountId}:${period.id}::::`;

      const blExact = byKey.get(kExact);
      const blFallback = byKey.get(kFallback);
      const bl = blExact ?? blFallback;

      if (!bl) {
        status = 'WARN';
        flags.push('NO_BUDGET_LINE_FOUND');
      } else {
        const blAmount = this.toNum(bl.amount);
        matchedBudgetLine = {
          id: bl.id,
          amount: blAmount,
          matchType: blExact ? 'EXACT' : 'FALLBACK',
        };
        budgetedAmount = blAmount;
        availableAmount = blAmount;
        variance = this.round2(lineAmount - availableAmount);

        if (availableAmount !== null && lineAmount > availableAmount) {
          flags.push('BUDGET_EXCEEDED');
          const mode = String(account?.budgetControlMode ?? 'WARN').trim().toUpperCase();
          if (mode === 'NONE') {
            status = 'OK';
          } else {
            status = mode === 'BLOCK' ? 'BLOCK' : 'WARN';
          }
        }
      }

      lineImpacts.push({
        lineId: l.id,
        lineNumber: l.lineNumber ?? null,
        accountId: l.accountId,
        accountCode: account?.code ?? null,
        lineAmount,
        legalEntityId: l.legalEntityId,
        departmentId: l.departmentId,
        projectId: l.projectId,
        fundId: l.fundId,
        matchedBudgetLine,
        budgetedAmount,
        availableAmount,
        variance,
        status,
        flags,
      });
    }

    const budgetStatus: 'OK' | 'WARN' | 'BLOCK' = lineImpacts.some(
      (l) => l.status === 'BLOCK',
    )
      ? 'BLOCK'
      : lineImpacts.some((l) => l.status === 'WARN')
        ? 'WARN'
        : 'OK';

    const budgetFlags = lineImpacts
      .filter((l) => l.status !== 'OK' || (l.flags ?? []).length)
      .map((l) => ({
        type: 'LINE',
        lineId: l.lineId,
        lineNumber: l.lineNumber,
        accountId: l.accountId,
        accountCode: l.accountCode,
        amount: l.lineAmount,
        legalEntityId: l.legalEntityId,
        departmentId: l.departmentId,
        projectId: l.projectId,
        fundId: l.fundId,
        status: l.status,
        flags: l.flags,
        budgetedAmount: l.budgetedAmount,
        availableAmount: l.availableAmount,
        variance: l.variance,
        matchedBudgetLine: l.matchedBudgetLine,
      }));

    return { budgetStatus, budgetFlags, lineImpacts };
  }

  private async persistJournalBudgetImpact(params: {
    tenantId: string;
    journalId: string;
    computedAt: Date;
    budgetStatus: 'OK' | 'WARN' | 'BLOCK';
    budgetFlags: any[];
  }) {
    await this.prisma.journalEntry
      .update({
        where: { id: params.journalId },
        data: {
          budgetStatus: params.budgetStatus as any,
          budgetFlags: params.budgetFlags as any,
          budgetCheckedAt: params.computedAt,
        } as any,
        select: { id: true },
      })
      .catch(() => undefined);
  }

  private async auditJournalBudgetEvaluated(params: {
    tenantId: string;
    journalId: string;
    userId: string;
    permissionUsed: string;
    stage: JournalBudgetStage;
    computedAt: Date;
    budgetStatus: 'OK' | 'WARN' | 'BLOCK';
    budgetFlags: any[];
  }) {
    await writeAuditEventWithPrisma(
      {
        tenantId: params.tenantId,
        eventType: AuditEventType.GL_JOURNAL_BUDGET_EVALUATED,
        entityType: AuditEntityType.JOURNAL_ENTRY,
        entityId: params.journalId,
        actorUserId: params.userId,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: params.permissionUsed,
        permissionUsed: params.permissionUsed,
        metadata: {
          journalId: params.journalId,
          budgetStatus: params.budgetStatus,
          budgetFlags: params.budgetFlags,
          computedAt: params.computedAt.toISOString(),
          lifecycleStage: params.stage,
        },
      },
      this.prisma,
    );
  }

  private async getBudgetRepeatWarnUplift(params: {
    tenantId: string;
    createdById: string;
    excludeJournalId: string;
    now: Date;
  }) {
    const from = this.startOfUtcDay(this.addUtcDays(params.now, -30));

    const priorWarnCount = await this.prisma.journalEntry.count({
      where: {
        tenantId: params.tenantId,
        createdById: params.createdById,
        id: { not: params.excludeJournalId },
        budgetStatus: 'WARN' as any,
        budgetCheckedAt: { gte: from },
      } as any,
    });

    const points = Math.min(priorWarnCount * 5, 20);
    return {
      priorWarnCount,
      points,
    };
  }

  private buildJournalRiskWhereSql(params: {
    tenantId: string;
    periodId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: Prisma.Sql[] = [
      Prisma.sql`je."tenantId" = ${params.tenantId}`,
    ];

    const from = this.parseOptionalYmd(params.dateFrom);
    const to = this.parseOptionalYmd(params.dateTo);
    if (from) where.push(Prisma.sql`je."journalDate" >= ${from}`);
    if (to) where.push(Prisma.sql`je."journalDate" <= ${to}`);

    const periodId = (params.periodId ?? '').trim();
    if (periodId) where.push(Prisma.sql`je."periodId" = ${periodId}`);

    // Only include journals that have been scored.
    where.push(Prisma.sql`je."riskScore" IS NOT NULL`);

    return Prisma.join(where, ' AND ');
  }

  private buildLineDimensionWhereSql(params: {
    legalEntityId?: string;
    departmentId?: string;
    projectId?: string;
    fundId?: string;
  }) {
    const where: Prisma.Sql[] = [];
    const legalEntityId = (params.legalEntityId ?? '').trim();
    const departmentId = (params.departmentId ?? '').trim();
    const projectId = (params.projectId ?? '').trim();
    const fundId = (params.fundId ?? '').trim();

    if (legalEntityId)
      where.push(Prisma.sql`jl."legalEntityId" = ${legalEntityId}`);
    if (departmentId)
      where.push(Prisma.sql`jl."departmentId" = ${departmentId}`);
    if (projectId) where.push(Prisma.sql`jl."projectId" = ${projectId}`);
    if (fundId) where.push(Prisma.sql`jl."fundId" = ${fundId}`);

    return where.length
      ? Prisma.sql` AND ${Prisma.join(where, ' AND ')}`
      : Prisma.sql``;
  }

  async getJournalRiskOverview(
    req: Request,
    filters: {
      periodId?: string;
      dateFrom?: string;
      dateTo?: string;
      legalEntityId?: string;
      departmentId?: string;
      projectId?: string;
      fundId?: string;
    },
  ) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, 'FINANCE_GL_VIEW');

    const whereJe = this.buildJournalRiskWhereSql({
      tenantId: authz.tenantId,
      periodId: filters.periodId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });
    const lineDimWhere = this.buildLineDimensionWhereSql(filters);

    const rows = await this.prisma.$queryRaw<
      Array<{
        total: number;
        avgRisk: number | null;
        lowCount: number;
        medCount: number;
        highCount: number;
      }>
    >(Prisma.sql`
      WITH scoped AS (
        SELECT je.id, je."riskScore"
        FROM "JournalEntry" je
        WHERE ${whereJe}
        AND (
          ${Prisma.sql`${
            filters.legalEntityId ||
            filters.departmentId ||
            filters.projectId ||
            filters.fundId
              ? Prisma.sql`
            EXISTS (
              SELECT 1
              FROM "JournalLine" jl
              WHERE jl."journalEntryId" = je.id
              ${lineDimWhere}
            )
          `
              : Prisma.sql`TRUE`
          }`}
        )
      )
      SELECT
        COUNT(*)::int AS "total",
        AVG(scoped."riskScore")::float AS "avgRisk",
        SUM(CASE WHEN scoped."riskScore" < 20 THEN 1 ELSE 0 END)::int AS "lowCount",
        SUM(CASE WHEN scoped."riskScore" >= 20 AND scoped."riskScore" < 40 THEN 1 ELSE 0 END)::int AS "medCount",
        SUM(CASE WHEN scoped."riskScore" >= 40 THEN 1 ELSE 0 END)::int AS "highCount"
      FROM scoped;
    `);

    const r = rows?.[0] ?? {
      total: 0,
      avgRisk: null,
      lowCount: 0,
      medCount: 0,
      highCount: 0,
    };

    const total = Number(r.total ?? 0);
    const highCount = Number(r.highCount ?? 0);
    const highPct = total > 0 ? Math.round((highCount / total) * 1000) / 10 : 0;

    return {
      total,
      avgRiskScore: r.avgRisk === null ? 0 : Number(r.avgRisk),
      highRiskPct: highPct,
      distribution: {
        LOW: Number(r.lowCount ?? 0),
        MEDIUM: Number(r.medCount ?? 0),
        HIGH: Number(r.highCount ?? 0),
      },
    };
  }

  async getJournalRiskUsers(
    req: Request,
    filters: {
      periodId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, 'FINANCE_GL_VIEW');

    const whereJe = this.buildJournalRiskWhereSql({
      tenantId: authz.tenantId,
      periodId: filters.periodId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });

    const rows = await this.prisma.$queryRaw<
      Array<{
        userId: string;
        userEmail: string | null;
        userName: string | null;
        total: number;
        avgRisk: number | null;
        lowCount: number;
        medCount: number;
        highCount: number;
        latePostingCount: number;
        reversalCount: number;
        overrideCount: number;
        highValueCount: number;
        unusualAccountCount: number;
      }>
    >(Prisma.sql`
      SELECT
        u.id AS "userId",
        u.email AS "userEmail",
        u.name AS "userName",
        COUNT(je.id)::int AS "total",
        AVG(je."riskScore")::float AS "avgRisk",
        SUM(CASE WHEN je."riskScore" < 20 THEN 1 ELSE 0 END)::int AS "lowCount",
        SUM(CASE WHEN je."riskScore" >= 20 AND je."riskScore" < 40 THEN 1 ELSE 0 END)::int AS "medCount",
        SUM(CASE WHEN je."riskScore" >= 40 THEN 1 ELSE 0 END)::int AS "highCount",
        SUM(CASE WHEN je."riskFlags" @> '["LATE_POSTING"]'::jsonb THEN 1 ELSE 0 END)::int AS "latePostingCount",
        SUM(CASE WHEN je."riskFlags" @> '["REVERSAL"]'::jsonb THEN 1 ELSE 0 END)::int AS "reversalCount",
        SUM(CASE WHEN je."riskFlags" @> '["OVERRIDE_USED"]'::jsonb THEN 1 ELSE 0 END)::int AS "overrideCount",
        SUM(CASE WHEN je."riskFlags" @> '["HIGH_VALUE"]'::jsonb THEN 1 ELSE 0 END)::int AS "highValueCount",
        SUM(CASE WHEN je."riskFlags" @> '["SENSITIVE_ACCOUNT"]'::jsonb THEN 1 ELSE 0 END)::int AS "unusualAccountCount"
      FROM "JournalEntry" je
      JOIN "User" u ON u.id = je."submittedById"
      WHERE ${whereJe}
      GROUP BY u.id, u.email, u.name
      ORDER BY "highCount" DESC, "avgRisk" DESC NULLS LAST, "total" DESC;
    `);

    return rows.map((r) => {
      const total = Number(r.total ?? 0);
      return {
        user: {
          id: r.userId,
          email: r.userEmail,
          name: r.userName,
        },
        totals: {
          journals: total,
          avgRiskScore: r.avgRisk === null ? 0 : Number(r.avgRisk),
          byBand: {
            LOW: Number(r.lowCount ?? 0),
            MEDIUM: Number(r.medCount ?? 0),
            HIGH: Number(r.highCount ?? 0),
          },
        },
        flaggedCounts: {
          late_posting: Number(r.latePostingCount ?? 0),
          reversal: Number(r.reversalCount ?? 0),
          override: Number(r.overrideCount ?? 0),
          high_value: Number(r.highValueCount ?? 0),
          unusual_account: Number(r.unusualAccountCount ?? 0),
        },
      };
    });
  }

  async getJournalRiskAccounts(
    req: Request,
    filters: {
      periodId?: string;
      dateFrom?: string;
      dateTo?: string;
      legalEntityId?: string;
      departmentId?: string;
      projectId?: string;
      fundId?: string;
    },
  ) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, 'FINANCE_GL_VIEW');

    const whereJe = this.buildJournalRiskWhereSql({
      tenantId: authz.tenantId,
      periodId: filters.periodId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });
    const lineDimWhere = this.buildLineDimensionWhereSql(filters);

    const rows = await this.prisma.$queryRaw<
      Array<{
        accountId: string;
        accountCode: string;
        accountName: string;
        journalCount: number;
        avgRisk: number | null;
        highRiskPct: number | null;
        topFlags: any;
      }>
    >(Prisma.sql`
      WITH scoped_lines AS (
        SELECT DISTINCT
          jl."journalEntryId" AS "journalEntryId",
          jl."accountId" AS "accountId"
        FROM "JournalLine" jl
        JOIN "JournalEntry" je ON je.id = jl."journalEntryId"
        WHERE ${whereJe}
        ${lineDimWhere}
      ),
      base AS (
        SELECT
          sl."accountId",
          je."riskScore"::int AS "riskScore",
          je."riskFlags" AS "riskFlags"
        FROM scoped_lines sl
        JOIN "JournalEntry" je ON je.id = sl."journalEntryId"
      ),
      flag_counts AS (
        SELECT
          b."accountId" AS "accountId",
          f.flag AS flag,
          COUNT(*)::int AS cnt
        FROM base b
        LEFT JOIN LATERAL jsonb_array_elements_text(COALESCE(b."riskFlags", '[]'::jsonb)) AS f(flag) ON TRUE
        GROUP BY b."accountId", f.flag
      ),
      flag_ranked AS (
        SELECT
          fc.accountId,
          jsonb_agg(fc.flag ORDER BY fc.cnt DESC, fc.flag ASC) FILTER (WHERE fc.flag IS NOT NULL) AS flags
        FROM flag_counts fc
        GROUP BY fc.accountId
      )
      SELECT
        a.id AS "accountId",
        a.code AS "accountCode",
        a.name AS "accountName",
        COUNT(*)::int AS "journalCount",
        AVG(b."riskScore")::float AS "avgRisk",
        (SUM(CASE WHEN b."riskScore" >= 40 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0)::float) * 100.0 AS "highRiskPct",
        COALESCE(fr.flags, '[]'::jsonb) AS "topFlags"
      FROM base b
      JOIN "Account" a ON a.id = b."accountId"
      LEFT JOIN flag_ranked fr ON fr.accountId = a.id
      WHERE a."tenantId" = ${authz.tenantId}
      GROUP BY a.id, a.code, a.name, fr.flags
      ORDER BY "avgRisk" DESC NULLS LAST, "journalCount" DESC, a.code ASC
      LIMIT 250;
    `);

    return rows.map((r) => {
      const flags = Array.isArray(r.topFlags)
        ? r.topFlags
        : (r.topFlags?.flags ?? r.topFlags);
      const topFlags = Array.isArray(flags)
        ? flags.slice(0, 5).map(String)
        : [];
      return {
        account: {
          id: r.accountId,
          code: r.accountCode,
          name: r.accountName,
        },
        journalCount: Number(r.journalCount ?? 0),
        avgRiskScore: r.avgRisk === null ? 0 : Number(r.avgRisk),
        highRiskPct:
          r.highRiskPct === null
            ? 0
            : Math.round(Number(r.highRiskPct) * 10) / 10,
        topRiskFlags: topFlags,
      };
    });
  }

  async getJournalRiskOrganisation(
    req: Request,
    filters: {
      periodId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, 'FINANCE_GL_VIEW');

    const whereJe = this.buildJournalRiskWhereSql({
      tenantId: authz.tenantId,
      periodId: filters.periodId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });

    const [legalEntities, departments, projects, funds] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          id: string;
          code: string | null;
          name: string | null;
          journalCount: number;
          avgRisk: number | null;
          highCount: number;
        }>
      >(Prisma.sql`
        WITH d AS (
          SELECT DISTINCT jl."journalEntryId" AS "journalEntryId", jl."legalEntityId" AS dimId
          FROM "JournalLine" jl
          JOIN "JournalEntry" je ON je.id = jl."journalEntryId"
          WHERE ${whereJe} AND jl."legalEntityId" IS NOT NULL
        )
        SELECT
          le.id,
          le.code,
          le.name,
          COUNT(*)::int AS "journalCount",
          AVG(je."riskScore")::float AS "avgRisk",
          SUM(CASE WHEN je."riskScore" >= 40 THEN 1 ELSE 0 END)::int AS "highCount"
        FROM d
        JOIN "JournalEntry" je ON je.id = d."journalEntryId"
        JOIN "LegalEntity" le ON le.id = d.dimId
        WHERE le."tenantId" = ${authz.tenantId}
        GROUP BY le.id, le.code, le.name
        ORDER BY "avgRisk" DESC NULLS LAST, "journalCount" DESC
        LIMIT 250;
      `),
      this.prisma.$queryRaw<
        Array<{
          id: string;
          code: string | null;
          name: string | null;
          journalCount: number;
          avgRisk: number | null;
          highCount: number;
        }>
      >(Prisma.sql`
        WITH d AS (
          SELECT DISTINCT jl."journalEntryId" AS "journalEntryId", jl."departmentId" AS dimId
          FROM "JournalLine" jl
          JOIN "JournalEntry" je ON je.id = jl."journalEntryId"
          WHERE ${whereJe} AND jl."departmentId" IS NOT NULL
        )
        SELECT
          dep.id,
          dep.code,
          dep.name,
          COUNT(*)::int AS "journalCount",
          AVG(je."riskScore")::float AS "avgRisk",
          SUM(CASE WHEN je."riskScore" >= 40 THEN 1 ELSE 0 END)::int AS "highCount"
        FROM d
        JOIN "JournalEntry" je ON je.id = d."journalEntryId"
        JOIN "Department" dep ON dep.id = d.dimId
        WHERE dep."tenantId" = ${authz.tenantId}
        GROUP BY dep.id, dep.code, dep.name
        ORDER BY "avgRisk" DESC NULLS LAST, "journalCount" DESC
        LIMIT 250;
      `),
      this.prisma.$queryRaw<
        Array<{
          id: string;
          code: string | null;
          name: string | null;
          journalCount: number;
          avgRisk: number | null;
          highCount: number;
        }>
      >(Prisma.sql`
        WITH d AS (
          SELECT DISTINCT jl."journalEntryId" AS "journalEntryId", jl."projectId" AS dimId
          FROM "JournalLine" jl
          JOIN "JournalEntry" je ON je.id = jl."journalEntryId"
          WHERE ${whereJe} AND jl."projectId" IS NOT NULL
        )
        SELECT
          p.id,
          p.code,
          p.name,
          COUNT(*)::int AS "journalCount",
          AVG(je."riskScore")::float AS "avgRisk",
          SUM(CASE WHEN je."riskScore" >= 40 THEN 1 ELSE 0 END)::int AS "highCount"
        FROM d
        JOIN "JournalEntry" je ON je.id = d."journalEntryId"
        JOIN "Project" p ON p.id = d.dimId
        WHERE p."tenantId" = ${authz.tenantId}
        GROUP BY p.id, p.code, p.name
        ORDER BY "avgRisk" DESC NULLS LAST, "journalCount" DESC
        LIMIT 250;
      `),
      this.prisma.$queryRaw<
        Array<{
          id: string;
          code: string | null;
          name: string | null;
          journalCount: number;
          avgRisk: number | null;
          highCount: number;
        }>
      >(Prisma.sql`
        WITH d AS (
          SELECT DISTINCT jl."journalEntryId" AS "journalEntryId", jl."fundId" AS dimId
          FROM "JournalLine" jl
          JOIN "JournalEntry" je ON je.id = jl."journalEntryId"
          WHERE ${whereJe} AND jl."fundId" IS NOT NULL
        )
        SELECT
          f.id,
          f.code,
          f.name,
          COUNT(*)::int AS "journalCount",
          AVG(je."riskScore")::float AS "avgRisk",
          SUM(CASE WHEN je."riskScore" >= 40 THEN 1 ELSE 0 END)::int AS "highCount"
        FROM d
        JOIN "JournalEntry" je ON je.id = d."journalEntryId"
        JOIN "Fund" f ON f.id = d.dimId
        WHERE f."tenantId" = ${authz.tenantId}
        GROUP BY f.id, f.code, f.name
        ORDER BY "avgRisk" DESC NULLS LAST, "journalCount" DESC
        LIMIT 250;
      `),
    ]);

    const mapRows = (
      rows: Array<{
        id: string;
        code: any;
        name: any;
        journalCount: any;
        avgRisk: any;
        highCount: any;
      }>,
    ) =>
      rows.map((r) => ({
        dimension: { id: r.id, code: r.code ?? null, name: r.name ?? null },
        journalCount: Number(r.journalCount ?? 0),
        avgRiskScore: r.avgRisk === null ? 0 : Number(r.avgRisk),
        highRiskCount: Number(r.highCount ?? 0),
      }));

    return {
      legalEntities: mapRows(legalEntities),
      departments: mapRows(departments),
      projects: mapRows(projects),
      funds: mapRows(funds),
    };
  }

  async getJournalRiskPeriods(
    req: Request,
    filters: {
      periodId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, 'FINANCE_GL_VIEW');

    const whereJe = this.buildJournalRiskWhereSql({
      tenantId: authz.tenantId,
      periodId: filters.periodId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });

    const rows = await this.prisma.$queryRaw<
      Array<{
        periodId: string | null;
        periodName: string | null;
        startDate: Date | null;
        endDate: Date | null;
        journalCount: number;
        avgRisk: number | null;
        highCount: number;
        reversalCount: number;
        topFlags: any;
      }>
    >(Prisma.sql`
      WITH base AS (
        SELECT
          je.id,
          je."periodId",
          je."riskScore"::int AS "riskScore",
          je."riskFlags" AS "riskFlags",
          CASE WHEN (je."journalType" = 'REVERSING' OR je."reversalOfId" IS NOT NULL) THEN 1 ELSE 0 END AS is_reversal
        FROM "JournalEntry" je
        WHERE ${whereJe}
      ),
      flag_counts AS (
        SELECT
          b."periodId" AS "periodId",
          f.flag AS flag,
          COUNT(*)::int AS cnt
        FROM base b
        LEFT JOIN LATERAL jsonb_array_elements_text(COALESCE(b."riskFlags", '[]'::jsonb)) AS f(flag) ON TRUE
        GROUP BY b."periodId", f.flag
      ),
      flag_ranked AS (
        SELECT
          fc."periodId" AS "periodId",
          jsonb_agg(fc.flag ORDER BY fc.cnt DESC, fc.flag ASC) FILTER (WHERE fc.flag IS NOT NULL) AS flags
        FROM flag_counts fc
        GROUP BY fc."periodId"
      )
      SELECT
        p.id AS "periodId",
        p.name AS "periodName",
        p."startDate" AS "startDate",
        p."endDate" AS "endDate",
        COUNT(b.id)::int AS "journalCount",
        AVG(b."riskScore")::float AS "avgRisk",
        SUM(CASE WHEN b."riskScore" >= 40 THEN 1 ELSE 0 END)::int AS "highCount",
        SUM(b.is_reversal)::int AS "reversalCount",
        COALESCE(fr.flags, '[]'::jsonb) AS "topFlags"
      FROM base b
      LEFT JOIN "AccountingPeriod" p ON p.id = b."periodId"
      LEFT JOIN flag_ranked fr ON fr."periodId" = b."periodId"
      WHERE (p."tenantId" = ${authz.tenantId} OR b."periodId" IS NULL)
      GROUP BY p.id, p.name, p."startDate", p."endDate", fr.flags
      ORDER BY p."startDate" DESC NULLS LAST, "journalCount" DESC
      LIMIT 60;
    `);

    return rows.map((r) => {
      const flags = Array.isArray(r.topFlags)
        ? r.topFlags
        : (r.topFlags?.flags ?? r.topFlags);
      const topFlags = Array.isArray(flags)
        ? flags.slice(0, 5).map(String)
        : [];
      return {
        period: r.periodId
          ? {
              id: r.periodId,
              name: r.periodName,
              startDate: r.startDate ? r.startDate.toISOString() : null,
              endDate: r.endDate ? r.endDate.toISOString() : null,
            }
          : null,
        journalCount: Number(r.journalCount ?? 0),
        avgRiskScore: r.avgRisk === null ? 0 : Number(r.avgRisk),
        reversalCount: Number(r.reversalCount ?? 0),
        highRiskCount: Number(r.highCount ?? 0),
        topRiskFlags: topFlags,
      };
    });
  }

  private readonly JOURNAL_RISK_HIGH_VALUE_THRESHOLD = 100000;
  private readonly JOURNAL_RISK_MANUAL_JOURNAL_POINTS = 10;
  private readonly JOURNAL_RISK_HIGH_VALUE_POINTS = 15;
  private readonly JOURNAL_RISK_BACKDATED_POINTS = 10;
  private readonly JOURNAL_RISK_LATE_POSTING_POINTS = 10;
  private readonly JOURNAL_RISK_REVERSAL_POINTS = 20;
  private readonly JOURNAL_RISK_CORRECTING_POINTS = 15;
  private readonly JOURNAL_RISK_SENSITIVE_ACCOUNT_POINTS = 15;
  private readonly JOURNAL_RISK_OVERRIDE_USED_POINTS = 20;

  private readonly JOURNAL_RISK_SENSITIVE_ACCOUNT_CODES = new Set([
    'RETAINED_EARNINGS',
    '3000',
    'SUSPENSE',
    'TAX',
  ]);

  private computeJournalRisk(params: {
    journal: {
      id: string;
      journalType: string | null;
      journalDate: Date;
      createdAt: Date;
      correctsJournalId?: string | null;
      reversalOfId?: string | null;
      reference?: string | null;
      returnReason?: string | null;
    };
    lines: Array<{
      debit: any;
      credit: any;
      account?: { code?: string | null } | null;
    }>;
    stage: JournalRiskStage;
    computedAt: Date;
    postingPeriod?: { endDate: Date } | null;
    budget?: {
      budgetStatus?: 'OK' | 'WARN' | 'BLOCK' | null;
      warnRepeatUpliftPoints?: number;
    };
  }): JournalRiskResult {
    const flags: string[] = [];
    let score = 0;

    const totalAbs = params.lines.reduce(
      (sum, l) => sum + Math.max(this.toNum(l.debit), this.toNum(l.credit)),
      0,
    );

    const isReversal =
      params.journal.journalType === 'REVERSING' ||
      Boolean(params.journal.reversalOfId);
    const isCorrecting = Boolean(params.journal.correctsJournalId);

    // Manual journal: treat as non-system-generated journal (i.e., not reversal).
    // Bulk uploads are still user-created and remain in scope for scoring.
    if (!isReversal) {
      flags.push('MANUAL_JOURNAL');
      score += this.JOURNAL_RISK_MANUAL_JOURNAL_POINTS;
    }

    if (isReversal) {
      flags.push('REVERSAL');
      score += this.JOURNAL_RISK_REVERSAL_POINTS;
    }

    if (isCorrecting) {
      flags.push('CORRECTING');
      score += this.JOURNAL_RISK_CORRECTING_POINTS;
    }

    if (totalAbs >= this.JOURNAL_RISK_HIGH_VALUE_THRESHOLD) {
      flags.push('HIGH_VALUE');
      score += this.JOURNAL_RISK_HIGH_VALUE_POINTS;
    }

    const createdYmd = params.journal.createdAt.toISOString().slice(0, 10);
    const journalYmd = params.journal.journalDate.toISOString().slice(0, 10);
    if (journalYmd < createdYmd) {
      flags.push('BACKDATED');
      score += this.JOURNAL_RISK_BACKDATED_POINTS;
    }

    if (params.stage === 'POST' && params.postingPeriod?.endDate) {
      const endYmd = params.postingPeriod.endDate.toISOString().slice(0, 10);
      const postYmd = params.computedAt.toISOString().slice(0, 10);
      if (postYmd > endYmd) {
        flags.push('LATE_POSTING');
        score += this.JOURNAL_RISK_LATE_POSTING_POINTS;
      }
    }

    const sensitiveUsed = params.lines.some((l) => {
      const code = (l.account?.code ?? '').trim();
      return code ? this.JOURNAL_RISK_SENSITIVE_ACCOUNT_CODES.has(code) : false;
    });
    if (sensitiveUsed) {
      flags.push('SENSITIVE_ACCOUNT');
      score += this.JOURNAL_RISK_SENSITIVE_ACCOUNT_POINTS;
    }

    // Placeholder: no override pathways exist in current GL workflow without blocking.
    // This flag will remain unused until Phase 5B introduces explicit override paths.
    const overrideUsed = false;
    if (overrideUsed) {
      flags.push('OVERRIDE_USED');
      score += this.JOURNAL_RISK_OVERRIDE_USED_POINTS;
    }

    if ((params.budget?.budgetStatus ?? null) === 'WARN') {
      flags.push('BUDGET_EXCEPTION');
      score += 15;

      const repeat =
        typeof params.budget?.warnRepeatUpliftPoints === 'number' &&
        Number.isFinite(params.budget?.warnRepeatUpliftPoints)
          ? Math.max(0, params.budget.warnRepeatUpliftPoints)
          : 0;
      if (repeat > 0) {
        flags.push('BUDGET_REPEAT_EXCEPTION');
        score += repeat;
      }
    }

    return { score, flags };
  }

  private async persistJournalRisk(params: {
    tenantId: string;
    journalId: string;
    computedAt: Date;
    score: number;
    flags: string[];
    stage: JournalRiskStage;
    userId: string;
    permissionUsed: string;
  }) {
    await this.prisma.journalEntry
      .update({
        where: { id: params.journalId },
        data: {
          riskScore: params.score,
          riskFlags: params.flags as any,
          riskComputedAt: params.computedAt,
        } as any,
        select: { id: true },
      })
      .catch(() => undefined);

    await writeAuditEventWithPrisma(
      {
        tenantId: params.tenantId,
        eventType: AuditEventType.GL_JOURNAL_RISK_COMPUTED,
        entityType: AuditEntityType.JOURNAL_ENTRY,
        entityId: params.journalId,
        actorUserId: params.userId,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: params.permissionUsed,
        permissionUsed: params.permissionUsed,
        metadata: {
          journalId: params.journalId,
          riskScore: params.score,
          riskFlags: params.flags,
          computedAt: params.computedAt.toISOString(),
          lifecycleStage: params.stage,
        },
      },
      this.prisma,
    );
  }

  private getDepartmentRequirement(account: {
    type: string | null | undefined;
    isControlAccount?: boolean | null;
    requiresDepartment?: boolean | null;
  }): DepartmentRequirement {
    if (Boolean((account as any).requiresDepartment)) {
      return DepartmentRequirement.REQUIRED;
    }
    if (account.isControlAccount) return DepartmentRequirement.FORBIDDEN;
    return DepartmentRequirement.OPTIONAL;
  }

  private getDepartmentRequirementMessage(params: {
    requirement: DepartmentRequirement;
    accountType: string | null | undefined;
  }) {
    if (params.requirement === DepartmentRequirement.FORBIDDEN) {
      return 'Department must not be provided for this account.';
    }
    if (params.requirement === DepartmentRequirement.OPTIONAL) {
      return 'Department is optional for this account.';
    }
    return 'Department is required for this account.';
  }

  async listLegalEntities(req: Request, params?: { effectiveOn?: string }) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const effectiveOn = params?.effectiveOn
      ? new Date(params.effectiveOn)
      : new Date();
    if (Number.isNaN(effectiveOn.getTime())) {
      throw new BadRequestException('Invalid effectiveOn date');
    }

    const debugLookupsEnabled =
      (process.env.DEBUG_GL_LOOKUPS ?? '').toString().toLowerCase() === 'true' &&
      (process.env.NODE_ENV ?? '').toString().toLowerCase() !== 'production';

    const whereClause: Prisma.LegalEntityWhereInput = {
      tenantId: tenant.id,
      isActive: true,
      effectiveFrom: { lte: effectiveOn },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveOn } }],
    };

    if (debugLookupsEnabled) {
      // eslint-disable-next-line no-console
      console.debug('[GL][legal-entities][filters]', {
        tenantId: tenant.id,
        effectiveOn: effectiveOn.toISOString(),
        userId: (req as any)?.user?.id ?? null,
        whereClause,
      });
    }

    const results = await this.prisma.legalEntity.findMany({
      where: whereClause,
      orderBy: [{ code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    });

    if (debugLookupsEnabled) {
      // eslint-disable-next-line no-console
      console.debug('[GL][legal-entities][rawResults]', {
        count: Array.isArray(results) ? results.length : null,
        sample: Array.isArray(results) ? results[0] ?? null : results,
      });
    }

    return results;
  }

  async listEntities(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    return this.prisma.entity.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        jurisdiction: true,
        baseCurrency: true,
      },
    });
  }

  async listDepartments(req: Request, params?: { effectiveOn?: string }) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const effectiveOn = params?.effectiveOn
      ? new Date(params.effectiveOn)
      : new Date();
    if (Number.isNaN(effectiveOn.getTime())) {
      throw new BadRequestException('Invalid effectiveOn date');
    }

    return (this.prisma.department as any).findMany({
      where: {
        tenantId: tenant.id,
        status: 'ACTIVE',
        isActive: true,
        effectiveFrom: { lte: effectiveOn },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveOn } }],
      } as any,
      orderBy: [{ code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        isActive: true,
        effectiveFrom: true,
        effectiveTo: true,
      } as any,
    });
  }

  private async getUserAuthz(req: Request): Promise<{
    tenantId: string;
    id: string;
    realUserId: string;
    actorUserId: string;
    delegationId?: string;
    permissionCodes: Set<string>;
  }> {
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const actorCtx = getEffectiveActorContext(req);
    const permissionUserId = actorCtx.actingAsUserId ?? actorCtx.realUserId;

    const jwtPermissionCodes = Array.isArray((user as any)?.permissions)
      ? ((user as any).permissions as string[])
      : [];

    const permissionCodes = new Set<string>();

    if (jwtPermissionCodes.length > 0) {
      for (const p of jwtPermissionCodes) permissionCodes.add(String(p));
      return {
        tenantId: tenant.id,
        id: permissionUserId,
        realUserId: actorCtx.realUserId,
        actorUserId: actorCtx.actingAsUserId ?? actorCtx.realUserId,
        delegationId: actorCtx.delegationId,
        permissionCodes,
      };
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId: permissionUserId,
        role: { tenantId: tenant.id },
      },
      select: {
        role: {
          select: {
            rolePermissions: {
              select: {
                permission: { select: { code: true } },
              },
            },
          },
        },
      },
    });

    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissionCodes.add(rp.permission.code);
      }
    }

    return {
      tenantId: tenant.id,
      id: permissionUserId,
      realUserId: actorCtx.realUserId,
      actorUserId: actorCtx.actingAsUserId ?? actorCtx.realUserId,
      delegationId: actorCtx.delegationId,
      permissionCodes,
    };
  }

  private async loadActorLegalEntityAccess(params: {
    tenantId: string;
    actorUserId: string;
  }): Promise<
    Array<{
      legalEntityId: string;
      accessLevel?: string | null;
      canPost?: boolean | null;
      canApprove?: boolean | null;
      canOverride?: boolean | null;
      expiresAt?: Date | string | null;
    }>
  > {
    const rows = await (this.prisma as any).userLegalEntityAccess.findMany({
      where: {
        tenantId: params.tenantId,
        userId: params.actorUserId,
      },
      select: {
        legalEntityId: true,
        accessLevel: true,
        canPost: true,
        canApprove: true,
        canOverride: true,
        expiresAt: true,
      },
    });

    return Array.isArray(rows) ? rows : [];
  }

  private formatRecurringPlaceholders(template: string, runDate: Date): string {
    const month = runDate.toLocaleDateString('en-US', { month: 'long' });
    const year = runDate.getUTCFullYear().toString();
    return (template || '')
      .replaceAll('{MONTH}', month)
      .replaceAll('{YEAR}', year);
  }

  private computeNextRunDate(params: {
    frequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    runDate: Date;
  }): Date {
    const monthsToAdd =
      params.frequency === 'MONTHLY'
        ? 1
        : params.frequency === 'QUARTERLY'
          ? 3
          : 12;

    const d = new Date(params.runDate);
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + monthsToAdd);
    const maxDay = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(day, maxDay));
    return d;
  }

  async createRecurringTemplate(req: Request, dto: CreateRecurringTemplateDto) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    if ((dto.journalType ?? 'STANDARD') !== 'STANDARD') {
      throw new BadRequestException(
        'Recurring templates support journalType STANDARD only',
      );
    }

    const xorErrors = dto.lines.filter(
      (l) => (l.debitAmount > 0 ? 1 : 0) + (l.creditAmount > 0 ? 1 : 0) !== 1,
    );
    if (xorErrors.length > 0) {
      throw new BadRequestException(
        'Each recurring template line must have either a debitAmount or a creditAmount (not both)',
      );
    }

    this.assertBalanced(
      dto.lines.map((l) => ({ debit: l.debitAmount, credit: l.creditAmount })),
    );

    this.assertJournalIntentRules({
      intent: (dto as any).intent,
      mode: 'RECURRING_TEMPLATE',
    });

    const now = new Date();
    const initialStatus: RecurringTemplateStatus = 'DRAFT';

    const created = await this.prisma.recurringJournalTemplate.create({
      data: {
        tenantId: tenant.id,
        name: dto.name,
        journalType: 'STANDARD',
        intent: (dto as any).intent as any,
        intentNotes: (dto as any).intentNotes ?? null,
        intentReference: (dto as any).intentReference ?? null,
        referenceTemplate: dto.referenceTemplate,
        descriptionTemplate: dto.descriptionTemplate,
        frequency: dto.frequency,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        nextRunDate: new Date(dto.nextRunDate),
        status: initialStatus,
        isActive: this.isActiveFromRecurringTemplateStatus(initialStatus),
        approvedById: null,
        approvedAt: null,
        suspendedById: null,
        suspendedAt: null,
        createdById: user.id,
        lines: {
          create: dto.lines
            .slice()
            .sort((a, b) => a.lineOrder - b.lineOrder)
            .map((l) => ({
              accountId: l.accountId,
              descriptionTemplate: l.descriptionTemplate,
              debitAmount: new Prisma.Decimal(l.debitAmount),
              creditAmount: new Prisma.Decimal(l.creditAmount),
              lineOrder: l.lineOrder,
            })),
        },
      } as any,
      include: { lines: true },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.RECURRING_TEMPLATE_CREATE,
        entityType: AuditEntityType.RECURRING_JOURNAL_TEMPLATE,
        entityId: created.id,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_GL_RECURRING_MANAGE',
        permissionUsed: PERMISSIONS.GL.RECURRING_MANAGE,
        lifecycleType: 'CREATE',
        metadata: {
          recurringTemplateId: created.id,
        },
      },
      this.prisma,
    );

    return created;
  }

  async submitRecurringTemplateForApproval(
    req: Request,
    id: string,
    params?: { reason?: string },
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const existing = await (this.prisma.recurringJournalTemplate.findFirst as any)({
      where: { id, tenantId: tenant.id },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException('Recurring template not found');

    const from = (existing as any).status as RecurringTemplateStatus;
    this.assertRecurringTemplateStatusTransition({ from, to: 'PENDING_APPROVAL' });

    const now = new Date();
    const updated = await (this.prisma.recurringJournalTemplate.update as any)({
      where: { id: existing.id },
      data: {
        status: 'PENDING_APPROVAL',
        isActive: false,
        submittedById: user.id,
        submittedAt: now,
        statusReason: params?.reason ? String(params.reason).trim() : null,
      },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType:
          ((AuditEventType as any).RECURRING_TEMPLATE_SUBMITTED as any) ??
          ('RECURRING_TEMPLATE_SUBMITTED' as any),
        entityType: AuditEntityType.RECURRING_JOURNAL_TEMPLATE,
        entityId: existing.id,
        actorUserId: user.id,
        timestamp: now,
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_GL_RECURRING_MANAGE',
        permissionUsed: PERMISSIONS.GL.RECURRING_MANAGE,
        lifecycleType: 'SUBMIT',
        reason: params?.reason ? String(params.reason) : undefined,
        metadata: {
          recurringTemplateId: existing.id,
          fromStatus: from,
          toStatus: 'PENDING_APPROVAL',
        },
      },
      this.prisma,
    );

    return updated;
  }

  async approveRecurringTemplate(
    req: Request,
    id: string,
    params?: { reason?: string },
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const existing = await (this.prisma.recurringJournalTemplate.findFirst as any)({
      where: { id, tenantId: tenant.id },
      select: { id: true, status: true, createdById: true },
    });
    if (!existing) throw new NotFoundException('Recurring template not found');

    if ((existing as any).createdById === user.id) {
      throw new ForbiddenException(
        'Segregation of duties: you cannot approve a template that you created.',
      );
    }

    const from = (existing as any).status as RecurringTemplateStatus;
    this.assertRecurringTemplateStatusTransition({ from, to: 'APPROVED' });

    const now = new Date();
    const updated = await (this.prisma.recurringJournalTemplate.update as any)({
      where: { id: existing.id },
      data: {
        status: 'APPROVED',
        isActive: true,
        approvedById: user.id,
        approvedAt: now,
        statusReason: params?.reason ? String(params.reason).trim() : null,
      },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType:
          ((AuditEventType as any).RECURRING_TEMPLATE_APPROVED as any) ??
          ('RECURRING_TEMPLATE_APPROVED' as any),
        entityType: AuditEntityType.RECURRING_JOURNAL_TEMPLATE,
        entityId: existing.id,
        actorUserId: user.id,
        timestamp: now,
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_GL_APPROVE',
        permissionUsed: PERMISSIONS.GL.APPROVE,
        lifecycleType: 'APPROVE',
        reason: params?.reason ? String(params.reason) : undefined,
        metadata: {
          recurringTemplateId: existing.id,
          fromStatus: from,
          toStatus: 'APPROVED',
        },
      },
      this.prisma,
    );

    return updated;
  }

  async suspendRecurringTemplate(
    req: Request,
    id: string,
    params?: { reason?: string },
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const existing = await this.prisma.recurringJournalTemplate.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException('Recurring template not found');

    const from = (existing as any).status as RecurringTemplateStatus;
    this.assertRecurringTemplateStatusTransition({ from, to: 'SUSPENDED' });

    const now = new Date();
    const updated = await (this.prisma.recurringJournalTemplate.update as any)({
      where: { id: existing.id },
      data: {
        status: 'SUSPENDED',
        isActive: false,
        suspendedById: user.id,
        suspendedAt: now,
        statusReason: params?.reason ? String(params.reason).trim() : null,
      },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType:
          ((AuditEventType as any).RECURRING_TEMPLATE_SUSPENDED as any) ??
          ('RECURRING_TEMPLATE_SUSPENDED' as any),
        entityType: AuditEntityType.RECURRING_JOURNAL_TEMPLATE,
        entityId: existing.id,
        actorUserId: user.id,
        timestamp: now,
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_GL_APPROVE',
        permissionUsed: PERMISSIONS.GL.APPROVE,
        lifecycleType: 'UPDATE',
        reason: params?.reason ? String(params.reason) : undefined,
        metadata: {
          recurringTemplateId: existing.id,
          fromStatus: from,
          toStatus: 'SUSPENDED',
        },
      },
      this.prisma,
    );

    return updated;
  }

  async archiveRecurringTemplate(
    req: Request,
    id: string,
    params?: { reason?: string },
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const existing = await this.prisma.recurringJournalTemplate.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException('Recurring template not found');

    const from = (existing as any).status as RecurringTemplateStatus;
    this.assertRecurringTemplateStatusTransition({ from, to: 'ARCHIVED' });

    const now = new Date();
    const updated = await (this.prisma.recurringJournalTemplate.update as any)({
      where: { id: existing.id },
      data: {
        status: 'ARCHIVED',
        isActive: false,
        archivedById: user.id,
        archivedAt: now,
        statusReason: params?.reason ? String(params.reason).trim() : null,
      },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType:
          ((AuditEventType as any).RECURRING_TEMPLATE_ARCHIVED as any) ??
          ('RECURRING_TEMPLATE_ARCHIVED' as any),
        entityType: AuditEntityType.RECURRING_JOURNAL_TEMPLATE,
        entityId: existing.id,
        actorUserId: user.id,
        timestamp: now,
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_GL_APPROVE',
        permissionUsed: PERMISSIONS.GL.APPROVE,
        lifecycleType: 'UPDATE',
        reason: params?.reason ? String(params.reason) : undefined,
        metadata: {
          recurringTemplateId: existing.id,
          fromStatus: from,
          toStatus: 'ARCHIVED',
        },
      },
      this.prisma,
    );

    return updated;
  }

  async reactivateRecurringTemplate(
    req: Request,
    id: string,
    params?: { reason?: string },
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const existing = await this.prisma.recurringJournalTemplate.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException('Recurring template not found');

    const from = (existing as any).status as RecurringTemplateStatus;
    this.assertRecurringTemplateStatusTransition({ from, to: 'APPROVED' });

    const now = new Date();
    const updated = await this.prisma.recurringJournalTemplate.update({
      where: { id: existing.id },
      data: {
        status: 'APPROVED',
        isActive: true,
        approvedById: user.id,
        approvedAt: now,
        statusReason: params?.reason ? String(params.reason).trim() : null,
      },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType:
          ((AuditEventType as any).RECURRING_TEMPLATE_REACTIVATED as any) ??
          ('RECURRING_TEMPLATE_REACTIVATED' as any),
        entityType: AuditEntityType.RECURRING_JOURNAL_TEMPLATE,
        entityId: existing.id,
        actorUserId: user.id,
        timestamp: now,
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_GL_APPROVE',
        permissionUsed: PERMISSIONS.GL.APPROVE,
        lifecycleType: 'UPDATE',
        reason: params?.reason ? String(params.reason) : undefined,
        metadata: {
          recurringTemplateId: existing.id,
          fromStatus: from,
          toStatus: 'APPROVED',
        },
      },
      this.prisma,
    );

    return updated;
  }

  async uploadJournals(
    req: Request,
    file?: any,
    opts?: { batchId?: string },
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const batchId = String(opts?.batchId ?? '').trim() || randomUUID();

    const batchEvidenceLinks = await (this.prisma as any).auditEvidenceLink.findMany({
      where: {
        tenantId: tenant.id,
        entityType: 'JOURNAL_UPLOAD_BATCH',
        entityId: batchId,
      },
      select: {
        evidenceId: true,
        evidence: {
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            size: true,
            evidenceCategory: true,
          },
        },
      },
    });
    const batchAttachments = (batchEvidenceLinks ?? []).map((l: any) => l.evidence);

    if (!file) throw new BadRequestException('Missing file');
    if (!file.originalname) throw new BadRequestException('Missing file name');
    if (!file.buffer) throw new BadRequestException('Missing file buffer');

    const fileName = String(file.originalname);
    const lower = fileName.toLowerCase();
    const isXlsx = lower.endsWith('.xlsx');
    const isCsv = lower.endsWith('.csv');

    if (!isXlsx && !isCsv) {
      throw new BadRequestException(
        'Unsupported file type. Please upload .xlsx or .csv',
      );
    }

    type UploadJournal = {
      journalKey: string;
      journalDate: Date;
      journalType: JournalType;
      intent: string;
      intentNotes?: string;
      intentReference?: string;
      reference?: string;
      description?: string;
    };

    type UploadLine = {
      journalKey: string;
      rowNumber: number;
      lineNumber?: number;
      accountCode: string;
      legalEntityCode?: string;
      departmentCode?: string;
      projectCode?: string;
      fundCode?: string;
      debit: number;
      credit: number;
      lineDescription?: string;
    };

    type UploadError = {
      journalKey?: string;
      sheet?: 'Journals' | 'JournalLines' | 'CSV';
      rowNumber?: number;
      field?: string;
      message: string;
    };

    const errors: UploadError[] = [];

    const allowedJournalTypes = new Set<JournalType>([
      'STANDARD',
      'ADJUSTING',
      'ACCRUAL',
      'REVERSING',
    ]);

    const allowedIntents = new Set<string>([
      'OPERATIONAL',
      'ACCRUAL',
      'ADJUSTMENT',
      'CORRECTION',
      'REVERSAL',
      'RECLASSIFICATION',
      'OPENING_BALANCE',
      'CLOSING',
      'TAX',
      'INTERCOMPANY',
      'AUDIT_ADJUSTMENT',
      'SYSTEM_GENERATED',
    ]);

    const journalsByKey = new Map<string, UploadJournal>();
    const linesByKey = new Map<string, UploadLine[]>();
    const periodTypeByKey = new Map<string, string | null>();

    const toNum = (v: any): number => {
      if (v === null || v === undefined || v === '') return 0;
      const n = typeof v === 'number' ? v : Number(String(v).trim());
      return Number.isFinite(n) ? n : NaN;
    };

    const normalizeKey = (v: any) => String(v ?? '').trim();

    const normalizeHeader = (v: any) =>
      String(v ?? '')
        .trim()
        .toLowerCase();

    const parseCsvRows = (buf: Buffer): Array<Record<string, string>> => {
      const text = buf.toString('utf8');
      const lines = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .filter((l) => l.trim().length > 0);
      if (lines.length === 0) return [];

      const parseLine = (line: string): string[] => {
        const out: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
              cur += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
            continue;
          }
          if (ch === ',' && !inQuotes) {
            out.push(cur);
            cur = '';
            continue;
          }
          cur += ch;
        }
        out.push(cur);
        return out.map((s) => s.trim());
      };

      const headers = parseLine(lines[0]).map((h) => normalizeHeader(h));
      const rows: Array<Record<string, string>> = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseLine(lines[i]);
        const row: Record<string, string> = {};
        for (let j = 0; j < headers.length; j++) {
          row[headers[j]] = cols[j] ?? '';
        }
        rows.push(row);
      }
      return rows;
    };

    const readXlsxSheetRows = async (buf: Buffer, sheetName: string) => {
      const wb = new ExcelJS.Workbook();
      await (wb.xlsx as any).load(buf as any);
      const ws = wb.worksheets.find(
        (s) => s.name.trim().toLowerCase() === sheetName.toLowerCase(),
      );
      if (!ws) {
        return { headers: [], rows: [] as Array<Record<string, any>> };
      }

      const headerRow = ws.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const v = normalizeHeader(cell.value as any);
        headers[colNumber - 1] = v;
      });

      const rows: Array<Record<string, any>> = [];
      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const obj: Record<string, any> = {};
        headers.forEach((h, idx) => {
          const cell = row.getCell(idx + 1);
          const raw = (cell.value as any)?.text ?? cell.value;
          obj[h] = raw;
        });
        const hasAny = Object.values(obj).some(
          (v) => String(v ?? '').trim() !== '',
        );
        if (hasAny) rows.push({ __rowNumber: r, ...obj });
      }
      return { headers, rows };
    };

    try {
      if (isXlsx) {
        const journalsSheet = await readXlsxSheetRows(file.buffer, 'Journals');
        const linesSheet = await readXlsxSheetRows(file.buffer, 'JournalLines');

        if (journalsSheet.rows.length === 0) {
          errors.push({
            sheet: 'Journals',
            message: 'Journals sheet is missing or empty',
          });
        }
        if (linesSheet.rows.length === 0) {
          errors.push({
            sheet: 'JournalLines',
            message: 'JournalLines sheet is missing or empty',
          });
        }

        for (const r of journalsSheet.rows) {
          const rowNumber = Number(r.__rowNumber) || 0;
          const journalKey = normalizeKey(
            r['journalkey'] ?? r['journal_key'] ?? r['key'],
          );
          if (!journalKey) {
            errors.push({
              sheet: 'Journals',
              rowNumber,
              field: 'journalKey',
              message: 'journalKey is required',
            });
            continue;
          }
          const journalType = String(
            r['journaltype'] ?? r['journal_type'] ?? 'STANDARD',
          ).trim();
          const normalizedJournalType = journalType.toUpperCase();
          if (normalizedJournalType && !allowedJournalTypes.has(normalizedJournalType as any)) {
            errors.push({
              sheet: 'Journals',
              rowNumber,
              journalKey,
              field: 'journalType',
              message: `Invalid journalType: ${journalType}`,
            });
          }

          const jdRaw = r['journaldate'] ?? r['journal_date'];
          const jd =
            jdRaw instanceof Date
              ? jdRaw
              : new Date(String(jdRaw ?? '').trim());
          if (!jdRaw || Number.isNaN(jd.getTime())) {
            errors.push({
              sheet: 'Journals',
              rowNumber,
              journalKey,
              field: 'journalDate',
              message: 'journalDate is required and must be a valid date',
            });
            continue;
          }

          const intentRaw = String(
            r['intent'] ?? r['journalintent'] ?? r['journal_intent'] ?? '',
          ).trim();
          const intent = intentRaw.toUpperCase();
          if (!intent) {
            errors.push({
              sheet: 'Journals',
              rowNumber,
              journalKey,
              field: 'intent',
              message: 'intent is required',
            });
          } else if (!allowedIntents.has(intent)) {
            errors.push({
              sheet: 'Journals',
              rowNumber,
              journalKey,
              field: 'intent',
              message: `Invalid intent: ${intentRaw}`,
            });
          }

          journalsByKey.set(journalKey, {
            journalKey,
            journalDate: jd,
            journalType: (allowedJournalTypes.has(normalizedJournalType as any)
              ? (normalizedJournalType as any)
              : 'STANDARD') as JournalType,
            intent,
            intentNotes:
              String(r['intentnotes'] ?? r['intent_notes'] ?? '').trim() ||
              undefined,
            intentReference:
              String(
                r['intentreference'] ?? r['intent_reference'] ?? '',
              ).trim() || undefined,
            reference: String(r['reference'] ?? '').trim() || undefined,
            description: String(r['description'] ?? '').trim() || undefined,
          });
        }

        for (const r of linesSheet.rows) {
          const rowNumber = Number(r.__rowNumber) || 0;
          const journalKey = normalizeKey(
            r['journalkey'] ?? r['journal_key'] ?? r['key'],
          );
          if (!journalKey) {
            errors.push({
              sheet: 'JournalLines',
              rowNumber,
              field: 'journalKey',
              message: 'journalKey is required',
            });
            continue;
          }
          const accountCode = String(
            r['accountcode'] ?? r['account_code'] ?? '',
          ).trim();
          if (!accountCode) {
            errors.push({
              sheet: 'JournalLines',
              rowNumber,
              journalKey,
              field: 'accountCode',
              message: 'accountCode is required',
            });
          }

          const legalEntityCode = String(
            r['legalentitycode'] ?? r['legal_entity_code'] ?? '',
          ).trim();
          if (!legalEntityCode) {
            errors.push({
              sheet: 'JournalLines',
              rowNumber,
              journalKey,
              field: 'legalEntityCode',
              message: 'legalEntityCode is required',
            });
          }

          const departmentCode = String(
            r['departmentcode'] ??
              r['department_code'] ??
              r['costcentrecode'] ??
              r['cost_centre_code'] ??
              '',
          ).trim();

          const projectCode = String(
            r['projectcode'] ?? r['project_code'] ?? '',
          ).trim();
          const fundCode = String(r['fundcode'] ?? r['fund_code'] ?? '').trim();

          const debit = toNum(r['debit']);
          const credit = toNum(r['credit']);
          if (Number.isNaN(debit) || Number.isNaN(credit)) {
            errors.push({
              sheet: 'JournalLines',
              rowNumber,
              journalKey,
              field: 'debit/credit',
              message: 'debit and credit must be numeric',
            });
          }

          const lineNumberRaw = r['linenumber'] ?? r['line_number'];
          const lineNumber =
            lineNumberRaw === undefined ||
            lineNumberRaw === null ||
            String(lineNumberRaw).trim() === ''
              ? undefined
              : Number(lineNumberRaw);

          const line: UploadLine = {
            journalKey,
            rowNumber,
            lineNumber: Number.isFinite(lineNumber as any)
              ? (lineNumber as number)
              : undefined,
            accountCode,
            legalEntityCode: legalEntityCode || undefined,
            departmentCode: departmentCode || undefined,
            projectCode: projectCode || undefined,
            fundCode: fundCode || undefined,
            debit: Number.isFinite(debit) ? debit : 0,
            credit: Number.isFinite(credit) ? credit : 0,
            lineDescription:
              String(
                r['linedescription'] ?? r['line_description'] ?? '',
              ).trim() || undefined,
          };
          const arr = linesByKey.get(journalKey) ?? [];
          arr.push(line);
          linesByKey.set(journalKey, arr);
        }
      }

      if (isCsv) {
        const rows = parseCsvRows(file.buffer);
        if (rows.length === 0) {
          errors.push({ sheet: 'CSV', message: 'CSV file is empty' });
        }

        // CSV format: each row is a line and repeats journal header fields.
        // Required columns: journalKey, journalDate, journalType, reference, description, lineNumber, accountCode, debit, credit, lineDescription
        for (let i = 0; i < rows.length; i++) {
          const rowNumber = i + 2;
          const r = rows[i];
          const journalKey = normalizeKey(
            r['journalkey'] ?? r['journal_key'] ?? r['key'],
          );
          if (!journalKey) {
            errors.push({
              sheet: 'CSV',
              rowNumber,
              field: 'journalKey',
              message: 'journalKey is required',
            });
            continue;
          }

          const jdRaw = r['journaldate'] ?? r['journal_date'];
          const jd = new Date(String(jdRaw ?? '').trim());
          if (!jdRaw || Number.isNaN(jd.getTime())) {
            errors.push({
              sheet: 'CSV',
              rowNumber,
              journalKey,
              field: 'journalDate',
              message: 'journalDate is required and must be a valid date',
            });
          }

          const jt = String(
            r['journaltype'] ?? r['journal_type'] ?? 'STANDARD',
          ).trim();
          const normalizedJournalType = jt.toUpperCase();
          if (normalizedJournalType && !allowedJournalTypes.has(normalizedJournalType as any)) {
            errors.push({
              sheet: 'CSV',
              rowNumber,
              journalKey,
              field: 'journalType',
              message: `Invalid journalType: ${jt}`,
            });
          }

          const intentRaw = String(
            r['intent'] ?? r['journalintent'] ?? r['journal_intent'] ?? '',
          ).trim();
          const intent = intentRaw.toUpperCase();
          if (!intent) {
            errors.push({
              sheet: 'CSV',
              rowNumber,
              journalKey,
              field: 'intent',
              message: 'intent is required',
            });
          } else if (!allowedIntents.has(intent)) {
            errors.push({
              sheet: 'CSV',
              rowNumber,
              journalKey,
              field: 'intent',
              message: `Invalid intent: ${intentRaw}`,
            });
          }

          if (
            !journalsByKey.has(journalKey) &&
            jdRaw &&
            !Number.isNaN(jd.getTime())
          ) {
            journalsByKey.set(journalKey, {
              journalKey,
              journalDate: jd,
              journalType: (allowedJournalTypes.has(normalizedJournalType as any)
                ? (normalizedJournalType as any)
                : 'STANDARD') as JournalType,
              intent,
              intentNotes:
                String(r['intentnotes'] ?? r['intent_notes'] ?? '').trim() ||
                undefined,
              intentReference:
                String(
                  r['intentreference'] ?? r['intent_reference'] ?? '',
                ).trim() || undefined,
              reference: String(r['reference'] ?? '').trim() || undefined,
              description: String(r['description'] ?? '').trim() || undefined,
            });
          }

          const accountCode = String(
            r['accountcode'] ?? r['account_code'] ?? '',
          ).trim();
          if (!accountCode) {
            errors.push({
              sheet: 'CSV',
              rowNumber,
              journalKey,
              field: 'accountCode',
              message: 'accountCode is required',
            });
          }

          const legalEntityCode = String(
            r['legalentitycode'] ?? r['legal_entity_code'] ?? '',
          ).trim();
          if (!legalEntityCode) {
            errors.push({
              sheet: 'CSV',
              rowNumber,
              journalKey,
              field: 'legalEntityCode',
              message: 'legalEntityCode is required',
            });
          }

          const departmentCode = String(
            r['departmentcode'] ??
              r['department_code'] ??
              r['costcentrecode'] ??
              r['cost_centre_code'] ??
              '',
          ).trim();

          const projectCode = String(
            r['projectcode'] ?? r['project_code'] ?? '',
          ).trim();
          const fundCode = String(r['fundcode'] ?? r['fund_code'] ?? '').trim();

          const debit = toNum(r['debit']);
          const credit = toNum(r['credit']);
          if (Number.isNaN(debit) || Number.isNaN(credit)) {
            errors.push({
              sheet: 'CSV',
              rowNumber,
              journalKey,
              field: 'debit/credit',
              message: 'debit and credit must be numeric',
            });
          }

          const lineNumberRaw = r['linenumber'] ?? r['line_number'];
          const lineNumber = lineNumberRaw ? Number(lineNumberRaw) : undefined;

          const line: UploadLine = {
            journalKey,
            rowNumber,
            lineNumber: Number.isFinite(lineNumber as any)
              ? (lineNumber as number)
              : undefined,
            accountCode,
            legalEntityCode: legalEntityCode || undefined,
            departmentCode: departmentCode || undefined,
            projectCode: projectCode || undefined,
            fundCode: fundCode || undefined,
            debit: Number.isFinite(debit) ? debit : 0,
            credit: Number.isFinite(credit) ? credit : 0,
            lineDescription:
              String(
                r['linedescription'] ?? r['line_description'] ?? '',
              ).trim() || undefined,
          };
          const arr = linesByKey.get(journalKey) ?? [];
          arr.push(line);
          linesByKey.set(journalKey, arr);
        }
      }
    } catch (e: any) {
      errors.push({
        message: `Failed to parse file: ${e?.message ?? String(e)}`,
      });
    }

    // Validate grouping integrity
    for (const [key] of linesByKey) {
      if (!journalsByKey.has(key)) {
        errors.push({
          journalKey: key,
          sheet: isXlsx ? 'JournalLines' : 'CSV',
          message: 'journalKey exists in lines but not in Journals',
        });
      }
    }

    // Validate each journal
    const keys = [...journalsByKey.keys()];
    if (keys.length === 0) {
      errors.push({ message: 'No journals found in upload' });
    }

    // Preload accounts by code
    const allAccountCodes = [
      ...new Set(
        [...linesByKey.values()]
          .flat()
          .map((l) => l.accountCode)
          .filter(Boolean),
      ),
    ];
    const accounts = (await this.prisma.account.findMany({
      where: { tenantId: tenant.id, code: { in: allAccountCodes } },
      select: {
        id: true,
        code: true,
        type: true,
        status: true,
        isActive: true,
        isPostingAllowed: true,
        isPosting: true,
        isControlAccount: true,
        isCashEquivalent: true,
        isIntercompanyAccount: true,
        intercompanyEnabled: true,
        intercompanyRole: true,
        requiresDepartment: true,
        requiresProject: true,
        requiresFund: true,
      } as any,
    })) as any[];
    const accountByCode = new Map<string, any>(accounts.map((a) => [a.code, a] as const));

    const allLegalEntityCodes = [
      ...new Set(
        [...linesByKey.values()]
          .flat()
          .map((l) => l.legalEntityCode)
          .filter(Boolean),
      ),
    ] as string[];
    const legalEntities = await this.prisma.legalEntity.findMany({
      where: { tenantId: tenant.id, code: { in: allLegalEntityCodes } },
      select: {
        id: true,
        code: true,
        isActive: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    });
    const legalEntityByCode = new Map(
      legalEntities.map((e) => [e.code, e] as const),
    );

    const allDepartmentCodes = [
      ...new Set(
        [...linesByKey.values()]
          .flat()
          .map((l) => l.departmentCode)
          .filter(Boolean),
      ),
    ] as string[];
    const departments = await this.prisma.department.findMany({
      where: { tenantId: tenant.id, code: { in: allDepartmentCodes } },
      select: {
        id: true,
        code: true,
        isActive: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    });
    const departmentByCode = new Map(
      departments.map((d) => [d.code, d] as const),
    );

    const allProjectCodes = [
      ...new Set(
        [...linesByKey.values()]
          .flat()
          .map((l) => l.projectCode)
          .filter(Boolean),
      ),
    ] as string[];
    const projects = await this.prisma.project.findMany({
      where: { tenantId: tenant.id, code: { in: allProjectCodes } },
      select: {
        id: true,
        code: true,
        isActive: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    });
    const projectByCode = new Map(projects.map((p) => [p.code, p] as const));

    const allFundCodes = [
      ...new Set(
        [...linesByKey.values()]
          .flat()
          .map((l) => l.fundCode)
          .filter(Boolean),
      ),
    ] as string[];
    const funds = await this.prisma.fund.findMany({
      where: { tenantId: tenant.id, code: { in: allFundCodes } },
      select: {
        id: true,
        code: true,
        projectId: true,
        isActive: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    });
    const fundByCode = new Map(funds.map((f) => [f.code, f] as const));

    const cutover = await this.getCutoverDateIfLocked({ tenantId: tenant.id });
    const retroPostToleranceDays = await loadTenantRetroPostToleranceDays({
      prisma: this.prisma,
      tenantId: tenant.id,
    });

    for (const key of keys) {
      const j = journalsByKey.get(key)!;
      const lines = (linesByKey.get(key) ?? [])
        .slice()
        .sort((a, b) => (a.lineNumber ?? 0) - (b.lineNumber ?? 0));

      const hasPrePolicyErrors = errors.some((e) => e.journalKey === key);
      if (lines.length < 2) {
        errors.push({
          journalKey: key,
          message: 'Journal must have at least 2 lines',
        });
        continue;
      }

      if (cutover && j.journalDate < cutover) {
        errors.push({
          journalKey: key,
          message: `Journal date is before cutover lock (${cutover.toISOString().slice(0, 10)})`,
        });
      }

      const period = await this.prisma.accountingPeriod.findFirst({
        where: {
          tenantId: tenant.id,
          startDate: { lte: j.journalDate },
          endDate: { gte: j.journalDate },
        },
        select: { id: true, status: true, name: true, type: true, startDate: true, endDate: true },
      });

      const currentOperationalPeriod = await this.prisma.accountingPeriod.findFirst({
        where: {
          tenantId: tenant.id,
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
        },
        select: { id: true, status: true, name: true, startDate: true, endDate: true },
      });

      periodTypeByKey.set(key, (period as any)?.type ?? null);

      const periodStatus = String((period as any)?.status ?? '').toUpperCase();
      const periodAllowsNormalPosting = periodStatus === 'OPEN' || periodStatus === 'ACTIVE';
      const retroPostingDecision = !period
        ? { retroPosting: true, reason: 'NO_ACCOUNTING_PERIOD' }
        : periodAllowsNormalPosting
          ? { retroPosting: false, reason: 'JOURNAL_DATE_IN_OPEN_ACCOUNTING_PERIOD' }
          : { retroPosting: true, reason: `ACCOUNTING_PERIOD_${periodStatus || 'UNKNOWN'}` };

      // eslint-disable-next-line no-console
      console.info('[GL][retroPosting]', {
        journalDate: j.journalDate.toISOString().slice(0, 10),
        resolvedPeriod: period
          ? {
              id: period.id,
              name: period.name,
              startDate: period.startDate.toISOString().slice(0, 10),
              endDate: period.endDate.toISOString().slice(0, 10),
            }
          : null,
        periodStatus: periodStatus || null,
        currentOperationalPeriod: currentOperationalPeriod
          ? {
              id: currentOperationalPeriod.id,
              name: currentOperationalPeriod.name,
              status: currentOperationalPeriod.status,
              startDate: currentOperationalPeriod.startDate.toISOString().slice(0, 10),
              endDate: currentOperationalPeriod.endDate.toISOString().slice(0, 10),
            }
          : null,
        retroPostingDecision,
        reason: retroPostingDecision.reason,
      });

      if (!period) {
        errors.push({
          journalKey: key,
          message: 'No accounting period exists for journalDate',
        });
      } else {
        try {
          assertPeriodAllowsPosting({
            req,
            period,
            permissionUsed: PERMISSIONS.GL.CREATE,
          });
        } catch {
          errors.push({
            journalKey: key,
            message: `Accounting period is not OPEN: ${period.name}`,
          });
        }
      }

      if (period && !periodAllowsNormalPosting) {
        try {
          assertRetroPostingWithinToleranceOrEscalated({
            req,
            postingDate: j.journalDate,
            toleranceDays: retroPostToleranceDays,
            escalationType: 'RETRO_POSTING_OVERRIDE',
          });
        } catch (e: any) {
          errors.push({
            journalKey: key,
            message:
              typeof e?.response?.message === 'string'
                ? e.response.message
                : typeof e?.message === 'string'
                  ? e.message
                  : 'Retro posting is not allowed',
          });
        }
      }

      const hasAnyDebit = lines.some((l) => (l.debit ?? 0) > 0);
      const hasAnyCredit = lines.some((l) => (l.credit ?? 0) > 0);
      if (!hasAnyDebit || !hasAnyCredit) {
        errors.push({
          journalKey: key,
          message:
            'Journal must contain at least one debit line and one credit line',
        });
      }

      const xorErrors = lines.filter(
        (l) =>
          ((l.debit ?? 0) > 0 ? 1 : 0) + ((l.credit ?? 0) > 0 ? 1 : 0) !== 1,
      );
      if (xorErrors.length > 0) {
        for (const l of xorErrors) {
          errors.push({
            journalKey: key,
            sheet: isXlsx ? 'JournalLines' : 'CSV',
            rowNumber: l.rowNumber,
            field: 'debit/credit',
            message: 'Debit XOR Credit rule violated',
          });
        }
      }

      try {
        this.assertBalanced(
          lines.map((l) => ({ debit: l.debit, credit: l.credit })),
        );
      } catch (e: any) {
        const totalDebit =
          Math.round(lines.reduce((sum, l) => sum + (l.debit ?? 0), 0) * 100) /
          100;
        const totalCredit =
          Math.round(lines.reduce((sum, l) => sum + (l.credit ?? 0), 0) * 100) /
          100;
        const msg =
          typeof e?.message === 'string'
            ? e.message
            : typeof e?.response?.error === 'string'
              ? e.response.error
              : 'Journal is not balanced';
        errors.push({
          journalKey: key,
          field: 'totals',
          message: `${msg} (totalDebit=${totalDebit}, totalCredit=${totalCredit})`,
        });
      }

      for (const l of lines) {
        const acc = accountByCode.get(l.accountCode);
        if (!acc) {
          errors.push({
            journalKey: key,
            sheet: isXlsx ? 'JournalLines' : 'CSV',
            rowNumber: l.rowNumber,
            field: 'accountCode',
            message: `Invalid account code: ${l.accountCode}`,
          });
          continue;
        }

        const lifecycleMsg = this.resolveLifecyclePostingBlockMessage(String((acc as any).status ?? ''));
        if (lifecycleMsg) {
          errors.push({
            journalKey: key,
            sheet: isXlsx ? 'JournalLines' : 'CSV',
            rowNumber: l.rowNumber,
            field: 'accountCode',
            message: lifecycleMsg,
          });
        }

        if (!acc.isActive) {
          errors.push({
            journalKey: key,
            sheet: isXlsx ? 'JournalLines' : 'CSV',
            rowNumber: l.rowNumber,
            field: 'accountCode',
            message: `Account is inactive: ${l.accountCode}`,
          });
        }
        if (!acc.isPostingAllowed) {
          errors.push({
            journalKey: key,
            sheet: isXlsx ? 'JournalLines' : 'CSV',
            rowNumber: l.rowNumber,
            field: 'accountCode',
            message: `Account is non-posting and cannot be used in journals: ${l.accountCode}`,
          });
        }

        if ((acc as any).isControlAccount) {
          errors.push({
            journalKey: key,
            sheet: isXlsx ? 'JournalLines' : 'CSV',
            rowNumber: l.rowNumber,
            field: 'accountCode',
            message: `Account is a control account and cannot be used in journals: ${l.accountCode}`,
          });
        }

        if (!l.legalEntityCode) {
          errors.push({
            journalKey: key,
            sheet: isXlsx ? 'JournalLines' : 'CSV',
            rowNumber: l.rowNumber,
            field: 'legalEntityCode',
            message: 'legalEntityCode is required',
          });
        } else {
          const le = legalEntityByCode.get(l.legalEntityCode);
          if (!le) {
            errors.push({
              journalKey: key,
              sheet: isXlsx ? 'JournalLines' : 'CSV',
              rowNumber: l.rowNumber,
              field: 'legalEntityCode',
              message: `Invalid legalEntityCode: ${l.legalEntityCode}`,
            });
          } else {
            const effectiveTo = (le as GlScopedProps).effectiveTo ?? null;
            const effective =
              le.effectiveFrom <= j.journalDate &&
              (effectiveTo === null || effectiveTo >= j.journalDate);
            if (!(le as GlScopedProps).isActive) {
              errors.push({
                journalKey: key,
                sheet: isXlsx ? 'JournalLines' : 'CSV',
                rowNumber: l.rowNumber,
                field: 'legalEntityCode',
                message: `Legal Entity is inactive: ${l.legalEntityCode}`,
              });
            }
            if (!effective) {
              errors.push({
                journalKey: key,
                sheet: isXlsx ? 'JournalLines' : 'CSV',
                rowNumber: l.rowNumber,
                field: 'legalEntityCode',
                message: `Legal Entity is not effective for journalDate: ${l.legalEntityCode}`,
              });
            }
          }
        }

        const departmentRequirement = this.getDepartmentRequirement(acc);
        if (!l.departmentCode) {
          if (departmentRequirement === DepartmentRequirement.REQUIRED) {
            errors.push({
              journalKey: key,
              sheet: isXlsx ? 'JournalLines' : 'CSV',
              rowNumber: l.rowNumber,
              field: 'departmentCode',
              message: this.getDepartmentRequirementMessage({
                requirement: departmentRequirement,
                accountType: (acc as GlScopedProps).type,
              }),
            });
          }
        } else {
          if (departmentRequirement === DepartmentRequirement.FORBIDDEN) {
            errors.push({
              journalKey: key,
              sheet: isXlsx ? 'JournalLines' : 'CSV',
              rowNumber: l.rowNumber,
              field: 'departmentCode',
              message: this.getDepartmentRequirementMessage({
                requirement: departmentRequirement,
                accountType: (acc as GlScopedProps).type,
              }),
            });
          }

          const d = departmentByCode.get(l.departmentCode);
          if (!d) {
            errors.push({
              journalKey: key,
              sheet: isXlsx ? 'JournalLines' : 'CSV',
              rowNumber: l.rowNumber,
              field: 'departmentCode',
              message: `Invalid departmentCode: ${l.departmentCode}`,
            });
          } else {
            const effective =
              d.effectiveFrom <= j.journalDate &&
              ((d as GlScopedProps).effectiveTo === null ||
                (d as GlScopedProps).effectiveTo! >= j.journalDate);
            if (!(d as GlScopedProps).isActive) {
              errors.push({
                journalKey: key,
                sheet: isXlsx ? 'JournalLines' : 'CSV',
                rowNumber: l.rowNumber,
                field: 'departmentCode',
                message: `Department is inactive: ${l.departmentCode}`,
              });
            }
            if (!effective) {
              errors.push({
                journalKey: key,
                sheet: isXlsx ? 'JournalLines' : 'CSV',
                rowNumber: l.rowNumber,
                field: 'departmentCode',
                message: `Department is not effective for journalDate: ${l.departmentCode}`,
              });
            }
          }
        }

        // Project/fund are optional unless other account-level controls require them.
        // Backward compatible: missing columns become undefined.
        if (l.fundCode && !l.projectCode) {
          errors.push({
            journalKey: key,
            sheet: isXlsx ? 'JournalLines' : 'CSV',
            rowNumber: l.rowNumber,
            field: 'fundCode',
            message: 'fundCode requires projectCode',
          });
        }

        let projectId: string | null = null;
        if (l.projectCode) {
          const p = projectByCode.get(l.projectCode);
          if (!p) {
            errors.push({
              journalKey: key,
              sheet: isXlsx ? 'JournalLines' : 'CSV',
              rowNumber: l.rowNumber,
              field: 'projectCode',
              message: `Invalid projectCode: ${l.projectCode}`,
            });
          } else {
            const effective =
              p.effectiveFrom <= j.journalDate &&
              ((p as GlScopedProps).effectiveTo === null ||
                (p as GlScopedProps).effectiveTo! >= j.journalDate);
            if (!(p as GlScopedProps).isActive) {
              errors.push({
                journalKey: key,
                sheet: isXlsx ? 'JournalLines' : 'CSV',
                rowNumber: l.rowNumber,
                field: 'projectCode',
                message: `Project is inactive: ${l.projectCode}`,
              });
            }
            if (!effective) {
              errors.push({
                journalKey: key,
                sheet: isXlsx ? 'JournalLines' : 'CSV',
                rowNumber: l.rowNumber,
                field: 'projectCode',
                message: `Project is not effective for journalDate: ${l.projectCode}`,
              });
            }
            projectId = p.id;
          }
        }

        if (l.fundCode) {
          const f = fundByCode.get(l.fundCode);
          if (!f) {
            errors.push({
              journalKey: key,
              sheet: isXlsx ? 'JournalLines' : 'CSV',
              rowNumber: l.rowNumber,
              field: 'fundCode',
              message: `Invalid fundCode: ${l.fundCode}`,
            });
          } else {
            const effective =
              f.effectiveFrom <= j.journalDate &&
              ((f as GlScopedProps).effectiveTo === null ||
                (f as GlScopedProps).effectiveTo! >= j.journalDate);
            if (!(f as GlScopedProps).isActive) {
              errors.push({
                journalKey: key,
                sheet: isXlsx ? 'JournalLines' : 'CSV',
                rowNumber: l.rowNumber,
                field: 'fundCode',
                message: `Fund is inactive: ${l.fundCode}`,
              });
            }
            if (!effective) {
              errors.push({
                journalKey: key,
                sheet: isXlsx ? 'JournalLines' : 'CSV',
                rowNumber: l.rowNumber,
                field: 'fundCode',
                message: `Fund is not effective for journalDate: ${l.fundCode}`,
              });
            }
            if (projectId && f.projectId !== projectId) {
              errors.push({
                journalKey: key,
                sheet: isXlsx ? 'JournalLines' : 'CSV',
                rowNumber: l.rowNumber,
                field: 'fundCode',
                message: `fundCode does not belong to projectCode (fundCode=${l.fundCode}, projectCode=${l.projectCode})`,
              });
            }
          }
        }
      }

      if (period && !hasPrePolicyErrors) {
        try {
          assertJournalTypePolicy({
            req,
            tenantId: tenant.id,
            actorUserId: user.id,
            permissionUsed: PERMISSIONS.GL.CREATE,
            mode: 'UPLOAD',
            journalDate: j.journalDate,
            prismaJournalType: j.journalType,
            periodType: (period as any)?.type ?? null,
            reversalOfId: null,
            reference: j.reference ?? null,
            description: j.description ?? null,
            sourceType: null,
            sourceId: null,
            lines: lines.map((l) => ({
              accountId: accountByCode.get(l.accountCode)?.id ?? 'UNKNOWN_ACCOUNT',
              legalEntityId: l.legalEntityCode
                ? (legalEntityByCode.get(l.legalEntityCode)?.id ?? null)
                : null,
              departmentId: l.departmentCode
                ? (departmentByCode.get(l.departmentCode)?.id ?? null)
                : null,
              projectId: l.projectCode
                ? (projectByCode.get(l.projectCode)?.id ?? null)
                : null,
              fundId: l.fundCode ? (fundByCode.get(l.fundCode)?.id ?? null) : null,
            })),
          });
          assertCombinationGovernance({
            req,
            tenantId: tenant.id,
            actorUserId: user.id,
            permissionUsed: PERMISSIONS.GL.CREATE,
            mode: 'UPLOAD',
            module: 'GL',
            journalDate: j.journalDate,
            prismaJournalType: j.journalType as any,
            periodType: (period as any)?.type ?? null,
            reversalOfId: null,
            reference: j.reference ?? null,
            description: j.description ?? null,
            sourceType: null,
            sourceId: null,
            lines: lines.map((l) => {
              const acc = accountByCode.get(l.accountCode);
              return {
                lineNumber: l.lineNumber ?? null,
                accountId: acc?.id ?? 'UNKNOWN_ACCOUNT',
                accountCode: acc?.code ?? null,
                accountType: (acc as any)?.type ?? null,
                isControlAccount: Boolean((acc as any)?.isControlAccount),
                isCashEquivalent: Boolean((acc as any)?.isCashEquivalent),
                requiresDepartment: Boolean((acc as any)?.requiresDepartment),
                requiresProject: Boolean((acc as any)?.requiresProject),
                requiresFund: Boolean((acc as any)?.requiresFund),
                debit: Number(l.debit ?? 0),
                credit: Number(l.credit ?? 0),
                legalEntityId: l.legalEntityCode
                  ? (legalEntityByCode.get(l.legalEntityCode)?.id ?? null)
                  : null,
                departmentId: l.departmentCode
                  ? (departmentByCode.get(l.departmentCode)?.id ?? null)
                  : null,
                projectId: l.projectCode
                  ? (projectByCode.get(l.projectCode)?.id ?? null)
                  : null,
                fundId: l.fundCode
                  ? (fundByCode.get(l.fundCode)?.id ?? null)
                  : null,
              };
            }),
          });

          const policyType = resolveJournalPolicyType({
            prismaJournalType: j.journalType,
            periodType: (period as any)?.type ?? null,
            reversalOfId: null,
            reference: j.reference ?? null,
            sourceType: null,
          });
          const intercompanyActions = new Set<string>();
          if (policyType === 'INTERCOMPANY_JOURNAL') {
            intercompanyActions.add('INTERCOMPANY_BALANCE_VIOLATION');
          }

          const actorLegalEntityAccess = await this.loadActorLegalEntityAccess({
            tenantId: tenant.id,
            actorUserId: user.id,
          });

          assertIntercompanyGovernance({
            req,
            tenantId: tenant.id,
            actorUserId: user.id,
            permissionUsed: PERMISSIONS.GL.CREATE,
            mode: 'UPLOAD',
            entityType: 'JOURNAL_UPLOAD_BATCH',
            entityId: `${batchId}:${key}`,
            journalType: String(j.journalType ?? ''),
            reference: j.reference ?? null,
            governanceActions: Array.from(intercompanyActions) as any,
            escalation: (req as any)?.governanceEscalation ?? null,
            justificationText:
              String(req.header('x-governance-reason') ?? '').trim() || null,
            actorLegalEntityAccess,
            lines: lines.map((l) => {
              const acc = accountByCode.get(l.accountCode);
              return {
                lineNumber: l.lineNumber ?? null,
                legalEntityId: l.legalEntityCode
                  ? (legalEntityByCode.get(l.legalEntityCode)?.id ?? null)
                  : null,
                debit: Number(l.debit ?? 0),
                credit: Number(l.credit ?? 0),
                account: {
                  accountId: acc?.id ?? 'UNKNOWN_ACCOUNT',
                  accountCode: acc?.code ?? null,
                  isIntercompanyAccount: (acc as any)?.isIntercompanyAccount ?? null,
                  intercompanyEnabled: (acc as any)?.intercompanyEnabled ?? null,
                  intercompanyRole: (acc as any)?.intercompanyRole ?? null,
                },
              };
            }),
          });
        } catch (e: any) {
          const msg =
            typeof e?.response?.message === 'string'
              ? e.response.message
              : typeof e?.message === 'string'
                ? e.message
                : 'Journal type policy violation';
          errors.push({
            journalKey: key,
            field: 'journalType',
            message: msg,
          });
        }
      }
    }

    if (errors.length > 0) {
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.JOURNAL_UPLOAD_FAILED,
          entityType: 'JOURNAL_UPLOAD_BATCH' as any,
          entityId: batchId,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'FAILED' as any,
          action: 'FINANCE_GL_CREATE',
          permissionUsed: PERMISSIONS.GL.CREATE,
          reason: `Upload rejected (${fileName}). Errors: ${errors.length}`,
          metadata: {
            batchId,
            fileName,
            errorCount: errors.length,
          },
        },
        this.prisma,
      );

      throw new BadRequestException({
        error: 'Upload rejected',
        fileName,
        errorCount: errors.length,
        errors,
      });
    }

    const governanceActions = new Set<string>();
    const escalation = (req as any)?.governanceEscalation as
      | { type?: string; reason?: string }
      | undefined;
    if (escalation?.type === 'RETRO_POSTING_OVERRIDE') governanceActions.add('RETRO_POSTING_OVERRIDE');
    if (escalation?.type === 'PERIOD_SOFT_CLOSE_POST_OVERRIDE') governanceActions.add('PERIOD_SOFT_CLOSE_POST_OVERRIDE');

    for (const key of keys) {
      const j = journalsByKey.get(key)!;
      const policyType = resolveJournalPolicyType({
        prismaJournalType: j.journalType,
        periodType: periodTypeByKey.get(key) ?? null,
        reversalOfId: null,
        reference: j.reference ?? null,
        sourceType: null,
      });
      const policy = getJournalTypePolicy(policyType);
      if (policy.requiredEvidence?.required) governanceActions.add('JOURNAL_TYPE_EVIDENCE_REQUIRED');
      if (policyType === 'INTERCOMPANY_JOURNAL') governanceActions.add('INTERCOMPANY_BALANCE_VIOLATION');
    }

    try {
      assertEvidenceGovernance({
        req,
        tenantId: tenant.id,
        actorUserId: user.id,
        permissionUsed: PERMISSIONS.GL.CREATE,
        mode: 'UPLOAD',
        entityType: 'JOURNAL_UPLOAD_BATCH',
        entityId: batchId,
        journalType: null,
        governanceActions: Array.from(governanceActions) as any,
        escalation: escalation ?? null,
        justificationText:
          String(req.header('x-governance-reason') ?? '').trim() || null,
        attachments: batchAttachments,
      });
    } catch (e: any) {
      const msg =
        typeof e?.response?.message === 'string'
          ? e.response.message
          : typeof e?.message === 'string'
            ? e.message
            : 'Evidence governance violation';
      errors.push({
        sheet: isXlsx ? 'Journals' : 'CSV',
        message: msg,
      });
    }

    if (errors.length > 0) {
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.JOURNAL_UPLOAD_FAILED,
          entityType: 'JOURNAL_UPLOAD_BATCH' as any,
          entityId: batchId,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'FAILED' as any,
          action: 'FINANCE_GL_CREATE',
          permissionUsed: PERMISSIONS.GL.CREATE,
          reason: `Upload rejected (${fileName}). Evidence governance violation(s): ${errors.length}`,
          metadata: {
            batchId,
            fileName,
            errorCount: errors.length,
          },
        },
        this.prisma,
      );

      throw new BadRequestException({
        error: 'Upload rejected',
        fileName,
        errorCount: errors.length,
        errors,
      });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const out: Array<{ journalKey: string; journalId: string }> = [];
      for (const key of keys) {
        const j = journalsByKey.get(key)!;
        const lines = (linesByKey.get(key) ?? [])
          .slice()
          .sort((a, b) => (a.lineNumber ?? 0) - (b.lineNumber ?? 0));

        const createdJournal = await tx.journalEntry.create({
          data: {
            tenantId: tenant.id,
            journalDate: j.journalDate,
            journalType: j.journalType,
            intent: String(j.intent ?? '').trim().toUpperCase() as any,
            intentNotes: j.intentNotes ?? null,
            intentReference: j.intentReference ?? null,
            reference: j.reference,
            description: j.description,
            createdById: user.id,
            lines: {
              create: lines
                .slice()
                .sort((a, b) => (a.lineNumber ?? 0) - (b.lineNumber ?? 0))
                .map((l) => ({
                  accountId: accountByCode.get(l.accountCode)!.id,
                  lineNumber: l.lineNumber,
                  description: l.lineDescription,
                  legalEntityId: legalEntityByCode.get(l.legalEntityCode!)!.id,
                  departmentId: l.departmentCode
                    ? departmentByCode.get(l.departmentCode)!.id
                    : null,
                  projectId: l.projectCode
                    ? (projectByCode.get(l.projectCode)?.id ?? null)
                    : null,
                  fundId: l.fundCode
                    ? (fundByCode.get(l.fundCode)?.id ?? null)
                    : null,
                  debit: l.debit,
                  credit: l.credit,
                })),
            },
          },
          select: { id: true },
        });

        if ((batchEvidenceLinks ?? []).length > 0) {
          await (tx as any).auditEvidenceLink.createMany({
            data: (batchEvidenceLinks ?? []).map((l: any) => ({
              tenantId: tenant.id,
              evidenceId: l.evidenceId,
              entityType: 'JOURNAL_ENTRY',
              entityId: createdJournal.id,
            })),
            skipDuplicates: true,
          });
        }

        out.push({ journalKey: key, journalId: createdJournal.id });
      }
      return out;
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.JOURNAL_UPLOAD,
        entityType: 'JOURNAL_UPLOAD_BATCH' as any,
        entityId: batchId,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_GL_CREATE',
        permissionUsed: PERMISSIONS.GL.CREATE,
        reason: `Uploaded journals (${fileName}). Journals created: ${created.length}`,
        metadata: {
          batchId,
          fileName,
          journalsCreated: created.length,
          intents: Array.from(
            new Set(
              keys.map((k) =>
                String((journalsByKey.get(k) as any)?.intent ?? '')
                  .trim()
                  .toUpperCase(),
              ),
            ),
          ),
        },
      },
      this.prisma,
    );

    return {
      batchId,
      fileName,
      journalsCreated: created.length,
      items: created,
    };
  }

  async getJournalUploadCsvTemplate(
    req: Request,
  ): Promise<{ fileName: string; body: string }> {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const headers = [
      'journalKey',
      'journalDate',
      'journalType',
      'intent',
      'intentNotes',
      'intentReference',
      'reference',
      'description',
      'lineNumber',
      'accountCode',
      'legalEntityCode',
      'departmentCode',
      'projectCode',
      'fundCode',
      'debit',
      'credit',
      'lineDescription',
    ];

    const sample = [
      [
        'J1',
        new Date().toISOString().slice(0, 10),
        'STANDARD',
        'Bulk upload test',
        'Example journal upload',
        '1',
        '1000',
        'LE-001',
        'D-001',
        'P-001',
        'F-001',
        '100.00',
        '0.00',
        'Debit line',
      ],
      [
        'J1',
        new Date().toISOString().slice(0, 10),
        'STANDARD',
        'Bulk upload test',
        'Example journal upload',
        '2',
        '2000',
        'LE-001',
        'D-001',
        'P-001',
        'F-001',
        '0.00',
        '100.00',
        'Credit line',
      ],
    ];

    const escape = (v: any) => {
      const s = String(v ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replaceAll('"', '""')}"`;
      }
      return s;
    };

    const body =
      [headers.join(','), ...sample.map((r) => r.map(escape).join(','))].join(
        '\n',
      ) + '\n';
    return { fileName: 'journal_upload_template.csv', body };
  }

  async getJournalUploadXlsxTemplate(
    req: Request,
  ): Promise<{ fileName: string; body: Buffer }> {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const wb = new ExcelJS.Workbook();

    const wsJ = wb.addWorksheet('Journals');
    wsJ.addRow([
      'journalKey',
      'journalDate',
      'journalType',
      'intent',
      'intentNotes',
      'intentReference',
      'reference',
      'description',
    ]);
    wsJ.addRow([
      'J1',
      '2024-01-31',
      'STANDARD',
      'OPERATIONAL',
      'Monthly adjustment',
      'REF-001',
      'REF-001',
      'Example journal header',
    ]);
    wsJ.getRow(1).font = { bold: true };
    wsJ.columns.forEach((c) => (c.width = 22));

    const wsL = wb.addWorksheet('JournalLines');
    wsL.addRow([
      'journalKey',
      'lineNumber',
      'accountCode',
      'legalEntityCode',
      'departmentCode',
      'projectCode',
      'fundCode',
      'debit',
      'credit',
      'lineDescription',
    ]);
    wsL.addRow([
      'J1',
      1,
      '1000',
      'LE-001',
      'D-001',
      'P-001',
      'F-001',
      100.0,
      0.0,
      'Debit line',
    ]);
    wsL.addRow([
      'J1',
      2,
      '2000',
      'LE-001',
      'D-001',
      'P-001',
      'F-001',
      0.0,
      100.0,
      'Credit line',
    ]);
    wsL.getRow(1).font = { bold: true };
    wsL.columns.forEach((c) => (c.width = 18));

    const buf = await wb.xlsx.writeBuffer();
    return {
      fileName: 'journal_upload_template.xlsx',
      body: Buffer.from(buf as any),
    };
  }

  async listRecurringTemplates(req: Request) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    return (this.prisma.recurringJournalTemplate.findMany as any)({
      where: { tenantId: tenant.id },
      orderBy: { name: 'asc' },
      include: {
        lines: { orderBy: { lineOrder: 'asc' } },
        createdBy: { select: { id: true, name: true, email: true } },
        submittedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async listApprovedRecurringTemplates(req: Request) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    return (this.prisma.recurringJournalTemplate.findMany as any)({
      where: {
        tenantId: tenant.id,
        OR: [{ status: 'APPROVED' }, { status: null, isActive: true }],
      },
      orderBy: { name: 'asc' },
      include: {
        lines: { orderBy: { lineOrder: 'asc' } },
        createdBy: { select: { id: true, name: true, email: true } },
        submittedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async updateRecurringTemplate(
    req: Request,
    id: string,
    dto: UpdateRecurringTemplateDto,
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const existing = await this.prisma.recurringJournalTemplate.findFirst({
      where: { id, tenantId: tenant.id },
      include: { lines: true },
    });
    if (!existing) {
      throw new NotFoundException('Recurring template not found');
    }

    const existingStatus: RecurringTemplateStatus =
      ((existing as any).status as RecurringTemplateStatus) ??
      ((existing as any).isActive ? 'APPROVED' : 'SUSPENDED');
    if (existingStatus !== 'DRAFT') {
      throw new ForbiddenException(
        'Only DRAFT recurring templates can be edited. Submit for approval to proceed.',
      );
    }

    if (dto.journalType && dto.journalType !== 'STANDARD') {
      throw new BadRequestException(
        'Recurring templates support journalType STANDARD only',
      );
    }

    const linesToValidate =
      dto.lines ??
      existing.lines.map((l) => ({
        accountId: l.accountId,
        descriptionTemplate: l.descriptionTemplate ?? undefined,
        debitAmount: Number(l.debitAmount),
        creditAmount: Number(l.creditAmount),
        lineOrder: l.lineOrder,
      }));

    const xorErrors = linesToValidate.filter(
      (l) => (l.debitAmount > 0 ? 1 : 0) + (l.creditAmount > 0 ? 1 : 0) !== 1,
    );
    if (xorErrors.length > 0) {
      throw new BadRequestException(
        'Each recurring template line must have either a debitAmount or a creditAmount (not both)',
      );
    }

    this.assertBalanced(
      linesToValidate.map((l) => ({
        debit: l.debitAmount,
        credit: l.creditAmount,
      })),
    );

    const nextIntent = String((dto as any).intent ?? (existing as any).intent ?? '').trim();
    this.assertJournalIntentRules({
      intent: nextIntent,
      mode: 'RECURRING_TEMPLATE',
    });

    const now = new Date();
    const nextStatus: RecurringTemplateStatus = 'DRAFT';

    const updated = await this.prisma.recurringJournalTemplate.update({
      where: { id: existing.id },
      data: {
        name: dto.name ?? existing.name,
        journalType: 'STANDARD',
        intent: ((dto as any).intent ?? (existing as any).intent) as any,
        intentNotes: (dto as any).intentNotes ?? (existing as any).intentNotes ?? null,
        intentReference:
          (dto as any).intentReference ?? (existing as any).intentReference ?? null,
        referenceTemplate: dto.referenceTemplate ?? existing.referenceTemplate,
        descriptionTemplate:
          dto.descriptionTemplate !== undefined
            ? dto.descriptionTemplate
            : existing.descriptionTemplate,
        frequency: dto.frequency ?? existing.frequency,
        startDate: dto.startDate ? new Date(dto.startDate) : existing.startDate,
        endDate:
          dto.endDate !== undefined
            ? dto.endDate
              ? new Date(dto.endDate)
              : null
            : existing.endDate,
        nextRunDate: dto.nextRunDate
          ? new Date(dto.nextRunDate)
          : existing.nextRunDate,
        status: nextStatus,
        isActive: this.isActiveFromRecurringTemplateStatus(nextStatus),
        approvedById: (existing as any).approvedById ?? null,
        approvedAt: (existing as any).approvedAt ?? null,
        suspendedById: (existing as any).suspendedById ?? null,
        suspendedAt: (existing as any).suspendedAt ?? null,
        lines: dto.lines
          ? {
              deleteMany: { templateId: existing.id },
              create: dto.lines
                .slice()
                .sort((a, b) => a.lineOrder - b.lineOrder)
                .map((l) => ({
                  accountId: l.accountId,
                  descriptionTemplate: l.descriptionTemplate,
                  debitAmount: new Prisma.Decimal(l.debitAmount),
                  creditAmount: new Prisma.Decimal(l.creditAmount),
                  lineOrder: l.lineOrder,
                })),
            }
          : undefined,
      },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.RECURRING_TEMPLATE_UPDATE,
        entityType: AuditEntityType.RECURRING_JOURNAL_TEMPLATE,
        entityId: existing.id,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_GL_RECURRING_MANAGE',
        permissionUsed: PERMISSIONS.GL.RECURRING_MANAGE,
        lifecycleType: 'UPDATE',
        metadata: {
          recurringTemplateId: existing.id,
        },
      },
      this.prisma,
    );

    return updated;
  }

  async generateJournalFromRecurringTemplate(
    req: Request,
    id: string,
    dto: GenerateRecurringTemplateDto,
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const template = await this.prisma.recurringJournalTemplate.findFirst({
      where: { id, tenantId: tenant.id },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });
    if (!template) {
      throw new NotFoundException('Recurring template not found');
    }

    const status = String((template as any).status ?? '').trim() as RecurringTemplateStatus;
    if (status !== 'APPROVED') {
      throw new ForbiddenException({
        error: 'Recurring template is not approved for generation',
        status,
      });
    }

    if (!dto.runDate) {
      throw new BadRequestException('Missing runDate');
    }

    const runDate = new Date(dto.runDate);
    if (Number.isNaN(runDate.getTime())) {
      throw new BadRequestException('Invalid runDate');
    }

    const period = await (this.prisma.accountingPeriod as any).findFirst({
      where: {
        tenantId: tenant.id,
        startDate: { lte: runDate },
        endDate: { gte: runDate },
      },
      select: { id: true, status: true, name: true, type: true },
    });
    if (!period) {
      throw new BadRequestException('No accounting period exists for runDate');
    }
    try {
      assertPeriodAllowsPosting({
        req,
        period,
        permissionUsed: PERMISSIONS.GL.RECURRING_GENERATE,
      });
    } catch {
      throw new ForbiddenException({
        error: 'Generation blocked by accounting period control',
        reason: `Accounting period is not OPEN: ${period.name}`,
      });
    }

    const reference = this.formatRecurringPlaceholders(
      template.referenceTemplate,
      runDate,
    );
    const description = template.descriptionTemplate
      ? this.formatRecurringPlaceholders(template.descriptionTemplate, runDate)
      : undefined;

    const accountIds = [...new Set(template.lines.map((l) => l.accountId).filter(Boolean))] as string[];
    const accounts = (await this.prisma.account.findMany({
      where: { tenantId: tenant.id, id: { in: accountIds } },
      select: {
        id: true,
        code: true,
        type: true,
        isControlAccount: true,
        isCashEquivalent: true,
        isIntercompanyAccount: true,
        intercompanyEnabled: true,
        intercompanyRole: true,
        requiresDepartment: true,
        requiresProject: true,
        requiresFund: true,
      } as any,
    })) as any[];
    const accountById = new Map<string, any>(accounts.map((a) => [a.id, a] as const));

    assertJournalTypePolicy({
      req,
      tenantId: tenant.id,
      actorUserId: user.id,
      permissionUsed: PERMISSIONS.GL.RECURRING_GENERATE,
      mode: 'POST',
      journalDate: runDate,
      prismaJournalType: 'STANDARD',
      periodType: (period as any)?.type ?? null,
      reversalOfId: null,
      reference: reference ?? null,
      description: description ?? null,
      sourceType: null,
      sourceId: null,
      lines: template.lines.map((l) => ({
        accountId: l.accountId,
        legalEntityId: null,
        departmentId: null,
        projectId: null,
        fundId: null,
      })),
    });

    assertCombinationGovernance({
      req,
      tenantId: tenant.id,
      actorUserId: user.id,
      permissionUsed: PERMISSIONS.GL.RECURRING_GENERATE,
      mode: 'POST',
      module: 'GL',
      journalDate: runDate,
      prismaJournalType: 'STANDARD',
      periodType: (period as any)?.type ?? null,
      reversalOfId: null,
      reference: reference ?? null,
      description: description ?? null,
      sourceType: null,
      sourceId: null,
      lines: template.lines.map((l) => {
        const acc = accountById.get(l.accountId);
        return {
          lineNumber: l.lineOrder ?? null,
          accountId: l.accountId,
          accountCode: acc?.code ?? null,
          accountType: (acc as any)?.type ?? null,
          isControlAccount: Boolean((acc as any)?.isControlAccount),
          isCashEquivalent: Boolean((acc as any)?.isCashEquivalent),
          requiresDepartment: Boolean((acc as any)?.requiresDepartment),
          requiresProject: Boolean((acc as any)?.requiresProject),
          requiresFund: Boolean((acc as any)?.requiresFund),
          debit: Number((l as any).debitAmount ?? 0),
          credit: Number((l as any).creditAmount ?? 0),
          legalEntityId: null,
          departmentId: null,
          projectId: null,
          fundId: null,
        };
      }),
    });

    assertIntercompanyGovernance({
      req,
      tenantId: tenant.id,
      actorUserId: user.id,
      permissionUsed: PERMISSIONS.GL.RECURRING_GENERATE,
      mode: 'POST',
      entityType: 'RECURRING_JOURNAL_TEMPLATE',
      entityId: template.id,
      journalType: 'STANDARD',
      reference: reference ?? null,
      governanceActions: [],
      escalation: (req as any)?.governanceEscalation ?? null,
      justificationText:
        String(req.header('x-governance-reason') ?? '').trim() || null,
      actorLegalEntityAccess: await this.loadActorLegalEntityAccess({
        tenantId: tenant.id,
        actorUserId: user.id,
      }),
      lines: template.lines.map((l) => {
        const acc = accountById.get(l.accountId);
        return {
          lineNumber: l.lineOrder ?? null,
          legalEntityId: null,
          debit: Number((l as any).debitAmount ?? 0),
          credit: Number((l as any).creditAmount ?? 0),
          account: {
            accountId: l.accountId,
            accountCode: (acc as any)?.code ?? null,
            isIntercompanyAccount: (acc as any)?.isIntercompanyAccount ?? null,
            intercompanyEnabled: (acc as any)?.intercompanyEnabled ?? null,
            intercompanyRole: (acc as any)?.intercompanyRole ?? null,
          },
        };
      }),
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const journal = await tx.journalEntry.create({
        data: {
          tenantId: tenant.id,
          journalDate: runDate,
          journalType: 'STANDARD',
          intent: (template as any).intent as any,
          intentNotes: (template as any).intentNotes ?? null,
          intentReference: (template as any).intentReference ?? null,
          reference,
          description,
          createdById: user.id,
          status: 'DRAFT',
          lines: {
            create: template.lines.map((l) => ({
              accountId: l.accountId,
              lineNumber: l.lineOrder,
              description: l.descriptionTemplate
                ? this.formatRecurringPlaceholders(
                    l.descriptionTemplate,
                    runDate,
                  )
                : undefined,
              debit: l.debitAmount,
              credit: l.creditAmount,
            })),
          },
        },
        include: { lines: true },
      });

      await tx.recurringJournalGeneration.create({
        data: {
          tenantId: tenant.id,
          templateId: template.id,
          generatedJournalId: journal.id,
          runDate,
          generatedById: user.id,
        },
      });

      const nextRunDate = this.computeNextRunDate({
        frequency: template.frequency,
        runDate,
      });

      const shouldDeactivate = Boolean(
        template.endDate && nextRunDate > template.endDate,
      );
      await tx.recurringJournalTemplate.update({
        where: { id: template.id },
        data: {
          nextRunDate,
          status: shouldDeactivate ? 'SUSPENDED' : (template as any).status,
          isActive: shouldDeactivate ? false : true,
          suspendedAt: shouldDeactivate ? new Date() : (template as any).suspendedAt ?? null,
        },
        select: { id: true },
      });

      return journal;
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.RECURRING_JOURNAL_GENERATED,
        entityType: AuditEntityType.RECURRING_JOURNAL_TEMPLATE,
        entityId: template.id,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_GL_RECURRING_GENERATE',
        permissionUsed: PERMISSIONS.GL.RECURRING_GENERATE,
        lifecycleType: 'GENERATE',
        reason: `Generated journal ${created.id}`,
        metadata: {
          templateId: template.id,
          generatedJournalId: created.id,
        },
      },
      this.prisma,
    );

    return created;
  }

  async getRecurringTemplateHistory(req: Request, id: string) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    const template = await this.prisma.recurringJournalTemplate.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true },
    });
    if (!template) {
      throw new NotFoundException('Recurring template not found');
    }

    return this.prisma.recurringJournalGeneration.findMany({
      where: { tenantId: tenant.id, templateId: template.id },
      orderBy: { runDate: 'desc' },
      select: {
        id: true,
        runDate: true,
        createdAt: true,
        generatedBy: { select: { id: true, name: true, email: true } },
        generatedJournal: {
          select: {
            id: true,
            journalNumber: true,
            journalDate: true,
            status: true,
            reference: true,
            description: true,
          },
        },
      },
    });
  }

  async listJournalReviewQueue(req: Request) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const items = await (this.prisma.journalEntry as any).findMany({
      where: {
        tenantId: tenant.id,
        status: 'SUBMITTED',
        createdById: { not: user.id },
      },
      orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        journalNumber: true,
        journalDate: true,
        reference: true,
        description: true,
        journalType: true,
        riskScore: true,
        createdAt: true,
        submittedAt: true,
        createdBy: { select: { id: true, name: true, email: true } },
        period: {
          select: { id: true, name: true, startDate: true, endDate: true },
        },
        lines: { select: { debit: true, credit: true } },
      },
    });

    const round2 = (n: number) => Math.round(n * 100) / 100;

    return items.map((j) => {
      const toNum = (v: any) => {
        if (v === null || v === undefined) return 0;
        if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
        // Prisma Decimal / other numeric-like values
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };

      const totalDebit = round2(
        j.lines.reduce((sum, l) => sum + toNum(l.debit), 0),
      );
      const totalCredit = round2(
        j.lines.reduce((sum, l) => sum + toNum(l.credit), 0),
      );

      const periodLabel = j.period?.name
        ? j.period.name
        : j.journalDate
          ? new Date(j.journalDate).toLocaleDateString(undefined, {
              month: 'short',
              year: 'numeric',
            })
          : null;

      return {
        id: j.id,
        journalNumber: j.journalNumber,
        journalDate: j.journalDate,
        reference: j.reference,
        description: j.description,
        journalType: j.journalType,
        riskScore: j.riskScore ?? 0,
        totalDebit,
        totalCredit,
        createdAt: j.createdAt,
        createdBy: j.createdBy,
        period: j.period
          ? {
              id: j.period.id,
              name: j.period.name,
              startDate: j.period.startDate,
              endDate: j.period.endDate,
              label: periodLabel,
            }
          : {
              id: null,
              name: null,
              startDate: null,
              endDate: null,
              label: periodLabel,
            },
      };
    });
  }

  async listJournalPostQueue(req: Request) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const items = await (this.prisma.journalEntry as any).findMany({
      where: {
        tenantId: tenant.id,
        status: 'REVIEWED',
      },
      orderBy: [{ reviewedAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        journalNumber: true,
        journalDate: true,
        reference: true,
        description: true,
        journalType: true,
        riskScore: true,
        createdAt: true,
        reviewedAt: true,
        createdBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
        period: {
          select: { id: true, name: true, startDate: true, endDate: true },
        },
        lines: { select: { debit: true, credit: true } },
      },
    });

    const round2 = (n: number) => Math.round(n * 100) / 100;

    return items.map((j) => {
      const toNum = (v: any) => {
        if (v === null || v === undefined) return 0;
        if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };

      const totalDebit = round2(
        j.lines.reduce((sum, l) => sum + toNum(l.debit), 0),
      );
      const totalCredit = round2(
        j.lines.reduce((sum, l) => sum + toNum(l.credit), 0),
      );

      const periodLabel = j.period?.name
        ? j.period.name
        : j.journalDate
          ? new Date(j.journalDate).toLocaleDateString(undefined, {
              month: 'short',
              year: 'numeric',
            })
          : null;

      return {
        id: j.id,
        journalNumber: j.journalNumber,
        journalDate: j.journalDate,
        reference: j.reference,
        description: j.description,
        journalType: j.journalType,
        riskScore: j.riskScore ?? 0,
        totalDebit,
        totalCredit,
        createdAt: j.createdAt,
        reviewedAt: j.reviewedAt,
        createdBy: j.createdBy,
        reviewedBy: j.reviewedBy,
        period: j.period
          ? {
              id: j.period.id,
              name: j.period.name,
              startDate: j.period.startDate,
              endDate: j.period.endDate,
              label: periodLabel,
            }
          : {
              id: null,
              name: null,
              startDate: null,
              endDate: null,
              label: periodLabel,
            },
      };
    });
  }

  private readonly OPENING_PERIOD_NAME = 'Opening Balances';
  private readonly OPENING_REF_PREFIX = 'OPENING_BALANCES:';
  private readonly OPENING_DESC_PREFIX = 'Opening balances as at ';

  private readonly DEFAULT_PERIOD_CLOSE_CHECKLIST_ITEMS = [
    { code: 'AP_REVIEWED', name: 'AP reviewed' },
    { code: 'AR_REVIEWED', name: 'AR reviewed' },
    { code: 'BANK_RECONCILED', name: 'Bank reconciled' },
    { code: 'FA_DEPRECIATION_RUN', name: 'FA depreciation run' },
    { code: 'VAT_REVIEWED', name: 'VAT reviewed' },
    { code: 'TRIAL_BALANCE_REVIEWED', name: 'Trial balance reviewed' },
  ] as const;

  private async ensureAccountingPeriodChecklistSeeded(params: {
    tenantId: string;
    periodId: string;
  }) {
    const existingCount = await (this.prisma.accountingPeriodChecklist as any).count({
      where: {
        tenantId: params.tenantId,
        periodId: params.periodId,
      },
    });

    if (existingCount > 0) return;

    await (this.prisma.accountingPeriodChecklist as any).createMany({
      data: this.DEFAULT_ACCOUNTING_PERIOD_CHECKLIST_ITEMS.map((i) => ({
        tenantId: params.tenantId,
        periodId: params.periodId,
        checklistCode: i.checklistCode,
        checklistName: i.checklistName,
        required: i.required,
      })),
      skipDuplicates: true,
    });
  }

  private readonly DEFAULT_ACCOUNTING_PERIOD_CHECKLIST_ITEMS = [
    {
      checklistCode: 'BANK_RECONCILIATION',
      checklistName: 'Bank reconciliations completed and reviewed',
      required: true,
    },
    {
      checklistCode: 'AP_RECONCILIATION',
      checklistName: 'AP subledger reconciled to GL',
      required: true,
    },
    {
      checklistCode: 'AR_RECONCILIATION',
      checklistName: 'AR subledger reconciled to GL',
      required: true,
    },
    {
      checklistCode: 'GL_REVIEW',
      checklistName:
        'General ledger review completed (journals, accruals, reclasses)',
      required: true,
    },
    {
      checklistCode: 'REPORTING_PACKAGE',
      checklistName: 'Financial statements generated and reviewed',
      required: true,
    },
  ] as const;

  private readonly JOURNAL_NUMBER_SEQUENCE_NAME = 'JOURNAL_ENTRY';

  private computeFiscalYearLabel(params: { financialYearStartMonth: number; date: Date }) {
    const m = params.date.getUTCMonth() + 1;
    const y = params.date.getUTCFullYear();
    return m >= params.financialYearStartMonth ? y : y - 1;
  }

  private buildJournalSequenceName(params: {
    scope: 'TENANT_GLOBAL' | 'LEGAL_ENTITY' | 'FISCAL_YEAR' | 'LEGAL_ENTITY_FISCAL_YEAR';
    tenantId: string;
    legalEntityId?: string | null;
    fiscalYearLabel?: number | null;
  }) {
    if (params.scope === 'TENANT_GLOBAL') return this.JOURNAL_NUMBER_SEQUENCE_NAME;

    if (params.scope === 'LEGAL_ENTITY') {
      const le = String(params.legalEntityId ?? '').trim();
      if (!le) throw new BadRequestException('Cannot assign legal-entity-scoped journal number (missing legalEntityId)');
      return `${this.JOURNAL_NUMBER_SEQUENCE_NAME}|LE:${le}`;
    }

    if (params.scope === 'FISCAL_YEAR') {
      const fy = params.fiscalYearLabel;
      if (!fy) throw new BadRequestException('Cannot assign fiscal-year-scoped journal number (missing fiscal year)');
      return `${this.JOURNAL_NUMBER_SEQUENCE_NAME}|FY:${fy}`;
    }

    const le = String(params.legalEntityId ?? '').trim();
    if (!le) throw new BadRequestException('Cannot assign scoped journal number (missing legalEntityId)');
    const fy = params.fiscalYearLabel;
    if (!fy) throw new BadRequestException('Cannot assign scoped journal number (missing fiscal year)');
    return `${this.JOURNAL_NUMBER_SEQUENCE_NAME}|LE:${le}|FY:${fy}`;
  }

  private async ensureMinimalBalanceSheetCoaForTenant(tenantId: string) {
    await this.assertCoaStructureNotFrozen({
      tenantId,
      permissionUsed: PERMISSIONS.GL.VIEW,
      action: 'GL_ENSURE_MINIMAL_BALANCE_SHEET_COA',
      reason: { action: 'GL_ENSURE_MINIMAL_BALANCE_SHEET_COA' },
    });

    const existingCount = await this.prisma.account.count({
      where: { tenantId },
    });
    if (existingCount > 0) return;

    await this.prisma.account.createMany({
      data: [
        {
          tenantId,
          code: '1000',
          name: 'Cash / Bank',
          type: 'ASSET',
          isActive: true,
        },
        {
          tenantId,
          code: '2000',
          name: 'Accounts Payable Control',
          type: 'LIABILITY',
          isActive: true,
        },
        {
          tenantId,
          code: '3000',
          name: 'Retained Earnings',
          type: 'EQUITY',
          isActive: true,
        },
      ],
      skipDuplicates: true,
    });
  }

  async createAccount(req: Request, dto: CreateAccountDto) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    const user = req.user;

    const t = await this.prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { coaFrozen: true, coaStructureFrozen: true } as any,
    });
    if (t?.coaFrozen) {
      throw new ForbiddenException('Chart of Accounts is frozen');
    }

    await this.assertCoaStructureNotFrozen({
      tenantId: tenant.id,
      userId: user?.id,
      permissionUsed: PERMISSIONS.GL.CREATE,
      action: 'GL_ACCOUNT_CREATE',
      reason: {
        action: 'GL_ACCOUNT_CREATE',
        code: dto.code ?? null,
        name: dto.name ?? null,
        type: dto.type ?? null,
      },
    });

    return this.prisma.account.create({
      data: {
        tenantId: tenant.id,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async listAccounts(req: Request, options?: { balanceSheetOnly?: boolean }) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    await this.ensureMinimalBalanceSheetCoaForTenant(tenant.id);

    const balanceSheetOnly = Boolean(options?.balanceSheetOnly);

    return this.prisma.account
      .findMany({
        where: {
          tenantId: tenant.id,
          status: 'ACTIVE' as any,
          ...(balanceSheetOnly
            ? { type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] } }
            : {}),
        },
        orderBy: { code: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          isActive: true,
          isControlAccount: true,
          requiresDepartment: true,
          requiresProject: true,
          requiresFund: true,
        },
      })
      .then((rows) =>
        rows.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          type: a.type,
          isActive: a.isActive,
          requiresDepartment: (a as any).requiresDepartment,
          requiresProject: a.requiresProject,
          requiresFund: a.requiresFund,
          departmentRequirement: this.getDepartmentRequirement(a),
        })),
      );
  }

  async createAccountingPeriod(req: Request, dto: CreateAccountingPeriodDto) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    if (!user) {
      throw new BadRequestException('Missing user context');
    }

    const code = String(dto.code ?? '').trim();
    if (!code) {
      throw new BadRequestException('Please enter a period code (e.g. JAN-2026).');
    }

    const type = dto.type;
    if (type !== 'OPENING' && type !== 'NORMAL') {
      throw new BadRequestException('Please select a valid period type.');
    }

    const { start: startDate, end: endDate } = validateMonthlyPeriodDates({
      type,
      startIso: dto.startDate,
      endIso: dto.endDate,
      startField: 'startDate',
      endField: 'endDate',
    });

    const existingCode = await (this.prisma.accountingPeriod as any).findFirst({
      where: { tenantId: tenant.id, code },
      select: { id: true },
    });

    if (existingCode) {
      throw new BadRequestException(
        'An accounting period with this code already exists. Please use a different code.',
      );
    }

    // Opening period rules
    if (type === 'OPENING') {
      const existingOpening = await (this.prisma.accountingPeriod as any).findFirst({
        where: { tenantId: tenant.id, type: 'OPENING' },
        select: { id: true, code: true },
      });
      if (existingOpening) {
        throw new BadRequestException(
          'Only one Opening Balance period is allowed per organisation.',
        );
      }

      const earliestExisting = await (this.prisma.accountingPeriod as any).findFirst({
        where: { tenantId: tenant.id },
        orderBy: [{ startDate: 'asc' }],
        select: { id: true, startDate: true, endDate: true, code: true },
      });
      if (earliestExisting && earliestExisting.startDate < startDate) {
        throw new BadRequestException(
          'Opening Balance period must be the first accounting period.',
        );
      }
    }

    // If an OPENING period exists, it must be the first chronologically.
    // Therefore, NORMAL periods cannot be earlier than the OPENING period date.
    const opening = await (this.prisma.accountingPeriod as any).findFirst({
      where: { tenantId: tenant.id, type: 'OPENING' },
      select: { id: true, startDate: true, endDate: true, code: true },
    });
    if (type === 'NORMAL' && !opening) {
      throw new BadRequestException(
        'You must create an Opening Balance period before creating normal accounting periods.',
      );
    }
    if (opening && startDate < opening.startDate) {
      throw new BadRequestException(
        'You must create an Opening Balance period before creating normal accounting periods.',
      );
    }

    const overlap = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: tenant.id,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true, code: true, name: true, startDate: true, endDate: true },
    });

    if (overlap) {
      throwPeriodValidation([
        buildOverlapPeriodFieldError({
          field: 'startDate',
          overlap: {
            code: (overlap as any).code ?? null,
            name: (overlap as any).name ?? null,
            startDate: overlap.startDate,
            endDate: overlap.endDate,
          },
        }),
      ]);
    }

    return this.prisma.$transaction(async (tx) => {
      const period = await (tx.accountingPeriod as any).create({
        data: {
          tenantId: tenant.id,
          code,
          type,
          name: String(dto.name ?? '').trim() || code,
          startDate,
          endDate,
          createdById: user.id,
        },
      });

      const checklist = await tx.periodCloseChecklist.create({
        data: {
          tenantId: tenant.id,
          periodId: period.id,
        },
      });

      await tx.periodCloseChecklistItem.createMany({
        data: this.DEFAULT_PERIOD_CLOSE_CHECKLIST_ITEMS.map((i) => ({
          tenantId: tenant.id,
          checklistId: checklist.id,
          code: i.code,
          name: i.name,
          status: 'PENDING',
        })),
        skipDuplicates: true,
      });

      await (tx.accountingPeriodChecklist as any).createMany({
        data: this.DEFAULT_ACCOUNTING_PERIOD_CHECKLIST_ITEMS.map((i) => ({
          tenantId: tenant.id,
          periodId: period.id,
          checklistCode: i.checklistCode,
          checklistName: i.checklistName,
          required: i.required,
        })),
        skipDuplicates: true,
      });

      return period;
    });
  }

  async getAccountingPeriodChecklist(req: Request, periodId: string) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: periodId, tenantId: tenant.id },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        closedAt: true,
        closedBy: { select: { id: true, email: true } },
      },
    });

    if (!period) throw new NotFoundException('Accounting period not found');

    await this.ensureAccountingPeriodChecklistSeeded({
      tenantId: tenant.id,
      periodId: period.id,
    });

    const items = await (this.prisma.accountingPeriodChecklist as any).findMany({
      where: { tenantId: tenant.id, periodId: period.id },
      orderBy: [{ required: 'desc' }, { completed: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        checklistCode: true,
        checklistName: true,
        required: true,
        completed: true,
        completedAt: true,
        completedBy: { select: { id: true, email: true } },
        createdAt: true,
      },
    });

    const requiredItems = items.filter((i: any) => Boolean(i.required));
    const incompleteRequired = requiredItems.filter((i: any) => !i.completed);
    const readyToClose =
      requiredItems.length > 0 && incompleteRequired.length === 0;

    return {
      period,
      items: items.map((i: any) => ({
        id: i.id,
        code: i.checklistCode,
        label: i.checklistName,
        required: Boolean(i.required),
        completed: Boolean(i.completed),
        completedAt: i.completedAt,
        completedBy: i.completedBy,
        createdAt: i.createdAt,
      })),
      summary: {
        requiredTotal: requiredItems.length,
        requiredCompleted: requiredItems.length - incompleteRequired.length,
        requiredOutstanding: incompleteRequired.length,
        readyToClose,
      },
    };
  }

  async completeAccountingPeriodChecklistItem(
    req: Request,
    params: { periodId: string; itemId: string },
  ) {
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: params.periodId, tenantId: tenant.id },
      select: { id: true, status: true, name: true },
    });

    if (!period) throw new NotFoundException('Accounting period not found');

    try {
      assertPeriodAllowsPosting({
        req,
        period,
        permissionUsed: PERMISSIONS.PERIOD.CHECKLIST_COMPLETE,
      });
    } catch {
      await this.prisma.accountingPeriodCloseLog.create({
        data: {
          tenantId: tenant.id,
          periodId: period.id,
          userId: user.id,
          action: 'CHECKLIST_ITEM_COMPLETE',
          outcome: 'DENIED',
          message: `Accounting period is not OPEN: ${period.name}`,
          itemId: params.itemId,
        },
      });

      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.PERIOD_CHECKLIST_COMPLETE,
          entityType: AuditEntityType.ACCOUNTING_PERIOD,
          entityId: period.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'FINANCE_PERIOD_CHECKLIST_COMPLETE',
          permissionUsed: PERMISSIONS.PERIOD.CHECKLIST_COMPLETE,
          reason: `Accounting period is not OPEN: ${period.name}`,
          metadata: {
            periodId: period.id,
            periodName: period.name,
            periodStatus: period.status,
            itemId: params.itemId,
          },
        },
        this.prisma,
      );

      throw new ForbiddenException({
        error: 'Checklist completion blocked by accounting period control',
        reason: `Accounting period is not OPEN: ${period.name}`,
      });
    }

    const item = await (this.prisma.accountingPeriodChecklist as any).findFirst({
      where: {
        id: params.itemId,
        tenantId: tenant.id,
        periodId: period.id,
      },
      select: { id: true, completed: true },
    });

    if (!item) {
      await this.prisma.accountingPeriodCloseLog.create({
        data: {
          tenantId: tenant.id,
          periodId: period.id,
          userId: user.id,
          action: 'CHECKLIST_ITEM_COMPLETE',
          outcome: 'NOT_FOUND',
          message: 'Checklist item not found',
          itemId: params.itemId,
        },
      });

      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.PERIOD_CHECKLIST_COMPLETE,
          entityType: AuditEntityType.ACCOUNTING_PERIOD_CHECKLIST_ITEM,
          entityId: params.itemId,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'FAILED' as any,
          action: 'FINANCE_PERIOD_CHECKLIST_COMPLETE',
          permissionUsed: PERMISSIONS.PERIOD.CHECKLIST_COMPLETE,
          reason: 'Checklist item not found',
          metadata: {
            periodId: period.id,
            itemId: params.itemId,
          },
        },
        this.prisma,
      );

      throw new NotFoundException('Checklist item not found');
    }
    if (item.completed) {
      await this.prisma.accountingPeriodCloseLog.create({
        data: {
          tenantId: tenant.id,
          periodId: period.id,
          userId: user.id,
          action: 'CHECKLIST_ITEM_COMPLETE',
          outcome: 'NOOP',
          message: 'Checklist item is already completed',
          itemId: item.id,
        },
      });

      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.PERIOD_CHECKLIST_COMPLETE,
          entityType: AuditEntityType.ACCOUNTING_PERIOD_CHECKLIST_ITEM,
          entityId: item.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'FAILED' as any,
          action: 'FINANCE_PERIOD_CHECKLIST_COMPLETE',
          permissionUsed: PERMISSIONS.PERIOD.CHECKLIST_COMPLETE,
          reason: 'Checklist item is already completed',
          metadata: {
            periodId: period.id,
            itemId: item.id,
          },
        },
        this.prisma,
      );

      throw new BadRequestException('Checklist item is already completed');
    }

    const updated = await (this.prisma.accountingPeriodChecklist as any).update({
      where: { id: item.id },
      data: {
        completed: true,
        completedById: user.id,
        completedAt: new Date(),
      },
      select: {
        id: true,
        checklistCode: true,
        checklistName: true,
        required: true,
        completed: true,
        completedAt: true,
        completedBy: { select: { id: true, email: true } },
        createdAt: true,
      },
    });

    await this.prisma.accountingPeriodCloseLog.create({
      data: {
        tenantId: tenant.id,
        periodId: period.id,
        userId: user.id,
        action: 'CHECKLIST_ITEM_COMPLETE',
        outcome: 'SUCCESS',
        itemId: updated.id,
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.PERIOD_CHECKLIST_COMPLETE,
        entityType: AuditEntityType.ACCOUNTING_PERIOD_CHECKLIST_ITEM,
        entityId: updated.id,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_PERIOD_CHECKLIST_COMPLETE',
        permissionUsed: PERMISSIONS.PERIOD.CHECKLIST_COMPLETE,
        metadata: {
          periodId: period.id,
          itemId: updated.id,
        },
      },
      this.prisma,
    );

    return {
      id: updated.id,
      code: updated.checklistCode,
      label: updated.checklistName,
      required: Boolean(updated.required),
      completed: Boolean(updated.completed),
      completedAt: updated.completedAt,
      completedBy: updated.completedBy,
      createdAt: updated.createdAt,
    };
  }

  async listAccountingPeriods(req: Request) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    return this.prisma.accountingPeriod.findMany({
      where: { tenantId: tenant.id },
      orderBy: { startDate: 'asc' },
    });
  }

  async listProjects(req: Request, params?: { effectiveOn?: string }) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const effectiveOn = params?.effectiveOn
      ? new Date(params.effectiveOn)
      : new Date();
    if (Number.isNaN(effectiveOn.getTime())) {
      throw new BadRequestException('effectiveOn must be a valid date');
    }

    return (this.prisma.project as any).findMany({
      where: {
        tenantId: tenant.id,
        status: 'ACTIVE',
        isActive: true,
        effectiveFrom: { lte: effectiveOn },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveOn } }],
      } as any,
      select: { id: true, code: true, name: true, status: true, isRestricted: true } as any,
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
    });
  }

  async listFunds(
    req: Request,
    params?: { effectiveOn?: string; projectId?: string },
  ) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const effectiveOn = params?.effectiveOn
      ? new Date(params.effectiveOn)
      : new Date();
    if (Number.isNaN(effectiveOn.getTime())) {
      throw new BadRequestException('effectiveOn must be a valid date');
    }

    const projectId = params?.projectId
      ? String(params.projectId).trim()
      : undefined;
    if (params?.projectId && !projectId) {
      throw new BadRequestException('projectId must not be empty');
    }

    return (this.prisma.fund as any).findMany({
      where: {
        tenantId: tenant.id,
        ...(projectId ? { projectId } : {}),
        status: 'ACTIVE',
        isActive: true,
        effectiveFrom: { lte: effectiveOn },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveOn } }],
      } as any,
      select: { id: true, code: true, name: true, projectId: true, status: true } as any,
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
    });
  }

  async closeAccountingPeriod(req: Request, id: string) {
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, status: true },
    });

    if (!period) {
      throw new NotFoundException('Accounting period not found');
    }

    if (period.status === 'CLOSED' || (period.status as any) === 'HARD_CLOSED') {
      throw new BadRequestException('Accounting period is already closed');
    }

    const periodStart = (
      await this.prisma.accountingPeriod.findUnique({
        where: { id },
        select: { startDate: true },
      })
    )?.startDate;

    const laterPeriods = await (this.prisma.accountingPeriod as any).findMany({
      where: {
        tenantId: tenant.id,
        ...(periodStart ? { startDate: { gt: periodStart } } : {}),
      },
      select: { id: true, status: true },
    });

    const isClosedStatus = (status: any): boolean => {
      return status === 'CLOSED' || status === 'HARD_CLOSED' || status === 'ARCHIVED';
    };

    const laterNotClosed = (laterPeriods ?? []).some((p: any) => !isClosedStatus(p.status));
    if (laterNotClosed) {
      throw new BadRequestException(
        'You must close later accounting periods before closing this one.',
      );
    }

    const journalCounts = await this.prisma.journalEntry.groupBy({
      by: ['status'],
      where: { tenantId: tenant.id, periodId: period.id },
      _count: { _all: true },
    });

    const countByStatus = new Map<string, number>(
      journalCounts.map((g) => [g.status, g._count._all] as const),
    );
    const draftCount = countByStatus.get('DRAFT') ?? 0;
    const parkedCount = countByStatus.get('PARKED') ?? 0;

    if (draftCount > 0 || parkedCount > 0) {
      const reason = `Unposted journals exist in the period (draft=${draftCount}, parked=${parkedCount})`;

      await this.prisma.accountingPeriodCloseLog.create({
        data: {
          tenantId: tenant.id,
          periodId: period.id,
          userId: user.id,
          action: 'PERIOD_CLOSE',
          outcome: 'DENIED',
          message: reason,
        },
      });

      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.PERIOD_CLOSE,
          entityType: AuditEntityType.ACCOUNTING_PERIOD,
          entityId: period.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'FINANCE_PERIOD_CLOSE_APPROVE',
          permissionUsed: PERMISSIONS.PERIOD.CLOSE_APPROVE,
          reason,
          metadata: {
            periodId: period.id,
            draftCount,
            parkedCount,
          },
        },
        this.prisma,
      );

      throw new ForbiddenException({
        error: 'Period close blocked by journal control',
        reason,
        draftCount,
        parkedCount,
      });
    }

    await this.ensureAccountingPeriodChecklistSeeded({
      tenantId: tenant.id,
      periodId: period.id,
    });

    const items = await (this.prisma.accountingPeriodChecklist as any).findMany({
      where: { tenantId: tenant.id, periodId: period.id },
      select: { id: true, required: true, completed: true, completedById: true },
    });

    const requiredItems = items.filter((i: any) => Boolean(i.required));
    if (requiredItems.length === 0) {
      const reason = 'Period checklist has not been configured.';

      await this.prisma.accountingPeriodCloseLog.create({
        data: {
          tenantId: tenant.id,
          periodId: period.id,
          userId: user.id,
          action: 'PERIOD_CLOSE',
          outcome: 'DENIED',
          message: reason,
        },
      });

      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.PERIOD_CLOSE,
          entityType: AuditEntityType.ACCOUNTING_PERIOD,
          entityId: period.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'FINANCE_PERIOD_CLOSE',
          permissionUsed: PERMISSIONS.PERIOD.CLOSE,
          reason,
          metadata: {
            periodId: period.id,
          },
        },
        this.prisma,
      );

      throw new ForbiddenException(reason);
    }

    const incompleteRequired = requiredItems.filter((i: any) => !i.completed);
    if (incompleteRequired.length > 0) {
      const reason = `Checklist incomplete (${requiredItems.length - incompleteRequired.length}/${requiredItems.length} completed).`;
      await this.prisma.accountingPeriodCloseLog.create({
        data: {
          tenantId: tenant.id,
          periodId: period.id,
          userId: user.id,
          action: 'PERIOD_CLOSE',
          outcome: 'DENIED',
          message: reason,
        },
      });

      await this.prisma.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'PERIOD_CLOSE',
            entityType: 'ACCOUNTING_PERIOD',
            entityId: period.id,
            action: 'FINANCE_PERIOD_CLOSE',
            outcome: 'BLOCKED',
            reason,
            userId: user.id,
            permissionUsed: PERMISSIONS.PERIOD.CLOSE,
          },
        })
        .catch(() => undefined);

      throw new ForbiddenException(reason);
    }

    const completedByThisUser = items.some((i) => i.completedById === user.id);
    void completedByThisUser;

    const closed = await this.prisma.accountingPeriod.update({
      where: { id },
      data: {
        status: 'HARD_CLOSED',
        closedById: user.id,
        closedAt: new Date(),
      },
    });

    await this.prisma.accountingPeriodCloseLog.create({
      data: {
        tenantId: tenant.id,
        periodId: period.id,
        userId: user.id,
        action: 'PERIOD_CLOSE',
        outcome: 'SUCCESS',
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.PERIOD_CLOSE,
        entityType: AuditEntityType.ACCOUNTING_PERIOD,
        entityId: period.id,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_PERIOD_CLOSE_APPROVE',
        permissionUsed: PERMISSIONS.PERIOD.CLOSE_APPROVE,
        metadata: {
          periodId: period.id,
        },
      },
      this.prisma,
    );

    this.cache.clearTenant(tenant.id);

    return closed;
  }

  async getAccountingPeriodSummary(req: Request, id: string) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true,
        type: true,
      },
    });
    if (!period) {
      throw new NotFoundException('Accounting period not found');
    }

    const grouped = await this.prisma.journalEntry.groupBy({
      by: ['status'],
      where: { tenantId: tenant.id, periodId: period.id },
      _count: { _all: true },
    });

    const countByStatus = {
      DRAFT: 0,
      PARKED: 0,
      POSTED: 0,
    } as Record<'DRAFT' | 'PARKED' | 'POSTED', number>;

    for (const g of grouped) {
      if (
        g.status === 'DRAFT' ||
        g.status === 'PARKED' ||
        g.status === 'POSTED'
      ) {
        countByStatus[g.status] = g._count._all;
      }
    }

    const postedTotals = await this.prisma.journalLine.aggregate({
      where: {
        journalEntry: {
          tenantId: tenant.id,
          periodId: period.id,
          status: 'POSTED',
        },
      },
      _sum: { debit: true, credit: true },
    });

    return {
      period,
      journals: {
        countsByStatus: countByStatus,
        totals: {
          totalDebit: Number(postedTotals._sum.debit ?? 0),
          totalCredit: Number(postedTotals._sum.credit ?? 0),
        },
      },
    };
  }

  async reopenAccountingPeriod(
    req: Request,
    id: string,
    dto: { reason?: string },
  ) {
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, status: true, closedAt: true },
    });
    if (!period) {
      throw new NotFoundException('Accounting period not found');
    }

    if (period.status !== 'CLOSED' && (period.status as any) !== 'HARD_CLOSED') {
      throw new BadRequestException('Accounting period is not closed');
    }

    const periodStart = (
      await this.prisma.accountingPeriod.findUnique({
        where: { id: period.id },
        select: { startDate: true },
      })
    )?.startDate;

    const laterPeriods = await (this.prisma.accountingPeriod as any).findMany({
      where: {
        tenantId: tenant.id,
        ...(periodStart ? { startDate: { gt: periodStart } } : {}),
      },
      select: { id: true, status: true },
    });

    const isClosedStatus = (status: any): boolean => {
      return status === 'CLOSED' || status === 'HARD_CLOSED' || status === 'ARCHIVED';
    };

    const laterClosed = (laterPeriods ?? []).some((p: any) => isClosedStatus(p.status));
    if (laterClosed) {
      const reason = 'Cannot reopen a period while a later period is CLOSED';

      await this.prisma.accountingPeriodCloseLog.create({
        data: {
          tenantId: tenant.id,
          periodId: period.id,
          userId: user.id,
          action: 'PERIOD_REOPEN',
          outcome: 'DENIED',
          message: reason,
        },
      });

      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.PERIOD_REOPEN,
          entityType: AuditEntityType.ACCOUNTING_PERIOD,
          entityId: period.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'FINANCE_PERIOD_REOPEN',
          permissionUsed: PERMISSIONS.PERIOD.REOPEN,
          reason,
          metadata: {
            periodId: period.id,
          },
        },
        this.prisma,
      );

      throw new ForbiddenException({
        error: 'Reopen blocked by period control',
        reason,
      });
    }

    const reopenReason = String(dto?.reason ?? '').trim();
    if (!reopenReason) {
      throw new BadRequestException('reason is required');
    }

    const updated = await this.prisma.accountingPeriod.update({
      where: { id: period.id },
      data: {
        status: 'OPEN',
        closedAt: null,
        closedById: null,
      },
    });

    await this.prisma.accountingPeriodCloseLog.create({
      data: {
        tenantId: tenant.id,
        periodId: period.id,
        userId: user.id,
        action: 'PERIOD_REOPEN',
        outcome: 'SUCCESS',
        message: reopenReason,
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.PERIOD_REOPEN,
        entityType: AuditEntityType.ACCOUNTING_PERIOD,
        entityId: period.id,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_PERIOD_REOPEN',
        permissionUsed: PERMISSIONS.PERIOD.REOPEN,
        reason: reopenReason,
        metadata: {
          periodId: period.id,
        },
      },
      this.prisma,
    );

    this.cache.clearTenant(tenant.id);

    return updated;
  }

  async trialBalance(req: Request, dto: TrialBalanceQueryDto) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    if (dto.entityId) {
      throw new BadRequestException(
        'entityId filtering is not supported yet (journals are not entity-scoped)',
      );
    }

    let from = new Date(dto.from);
    const to = new Date(dto.to);

    if (from > to) {
      throw new BadRequestException('from must be less than or equal to to');
    }

    const cutover = await this.getCutoverDateIfLocked({ tenantId: tenant.id });
    if (cutover && to < cutover) {
      return {
        from: dto.from,
        to: dto.to,
        totals: { totalDebit: 0, totalCredit: 0, net: 0 },
        rows: [],
      };
    }

    if (cutover && from < cutover) {
      from = cutover;
    }

    const grouped = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: {
          tenantId: tenant.id,
          status: 'POSTED',
          journalDate: {
            gte: from,
            lte: to,
          },
        },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });

    const accountIds = grouped.map((g) => g.accountId);

    const accounts = await this.prisma.account.findMany({
      where: {
        tenantId: tenant.id,
        id: { in: accountIds },
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        normalBalance: true,
      },
    });

    const accountMap = new Map(accounts.map((a) => [a.id, a] as const));

    const asOfDate = dto.asOfDate ?? dto.to;
    const resolved = await this.coaReclass.resolveAccountsAsOfDateBulk({
      tenantId: tenant.id,
      accountIds,
      asOfDate,
    });

    const rows = grouped
      .map((g) => {
        const a = accountMap.get(g.accountId);
        const r = resolved.get(g.accountId) ?? null;
        const totalDebit = Number(g._sum.debit ?? 0);
        const totalCredit = Number(g._sum.credit ?? 0);

        const baseRow: any = {
          accountId: g.accountId,
          accountCode: a?.code ?? 'UNKNOWN',
          accountName: a?.name ?? 'Unknown account',
          accountType: a?.type ?? 'UNKNOWN',
          normalBalance: a?.normalBalance ?? 'DEBIT',
          totalDebit,
          totalCredit,
          net: totalDebit - totalCredit,
        };

        if (dto.includeReclassificationEvidence) {
          baseRow.reclassificationEvidence = {
            asOfDate,
            appliedReclassificationId: r?.appliedReclassificationId ?? null,
            appliedEffectiveStartDate: r?.appliedEffectiveStartDate ?? null,
            resolvedParentAccountId: r?.resolvedParentAccountId ?? null,
            resolvedIfrsMappingCode: r?.resolvedIfrsMappingCode ?? null,
            resolvedFsMappingLevel1: r?.resolvedFsMappingLevel1 ?? null,
            resolvedFsMappingLevel2: r?.resolvedFsMappingLevel2 ?? null,
          };
        }

        return baseRow;
      })
      .sort((x, y) => x.accountCode.localeCompare(y.accountCode));

    const round2 = (n: number) => Math.round(n * 100) / 100;

    return {
      from:
        cutover && new Date(dto.from) < cutover
          ? cutover.toISOString().slice(0, 10)
          : dto.from,
      to: dto.to,
      totals: {
        totalDebit: round2(rows.reduce((sum, r) => sum + r.totalDebit, 0)),
        totalCredit: round2(rows.reduce((sum, r) => sum + r.totalCredit, 0)),
        net: round2(rows.reduce((sum, r) => sum + r.net, 0)),
      },
      rows,
    };
  }

  async ledger(req: Request, dto: LedgerQueryDto) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const limit = dto.limit ?? 50;
    const offset = dto.offset ?? 0;
    if (limit < 1 || limit > 100)
      throw new BadRequestException('limit must be between 1 and 100');
    if (offset < 0) throw new BadRequestException('offset must be >= 0');
    if (offset > 5000) throw new BadRequestException('offset too large');

    const hasPeriod = Boolean(dto.accountingPeriodId);
    const hasDates = Boolean(dto.fromDate || dto.toDate);

    if (hasPeriod && hasDates) {
      throw new BadRequestException(
        'accountingPeriodId is mutually exclusive with fromDate/toDate',
      );
    }

    let from: Date;
    let to: Date;
    let reportSource: 'LEDGER' | 'TB' | 'FS' = 'LEDGER';
    const sourceReport = dto.sourceReport ?? 'LEDGER';

    if (dto.accountingPeriodId) {
      const p = await this.prisma.accountingPeriod.findFirst({
        where: { id: dto.accountingPeriodId, tenantId: tenant.id },
        select: { id: true, startDate: true, endDate: true },
      });
      if (!p) throw new NotFoundException('Accounting period not found');
      from = new Date(p.startDate.getTime());
      to = new Date(p.endDate.getTime());
      reportSource = 'LEDGER';
    } else {
      if (!dto.fromDate || !dto.toDate)
        throw new BadRequestException('fromDate and toDate are required');
      from = new Date(dto.fromDate);
      to = new Date(dto.toDate);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()))
        throw new BadRequestException('Invalid date');
      if (from > to)
        throw new BadRequestException('fromDate must be <= toDate');
    }

    const cutover = await this.getCutoverDateIfLocked({ tenantId: tenant.id });
    if (cutover && to < cutover) {
      const account = await this.prisma.account.findFirst({
        where: { id: dto.accountId, tenantId: tenant.id },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          normalBalance: true,
        },
      });
      if (!account) throw new NotFoundException('Account not found');

      if (offset === 0) {
        await writeAuditEventWithPrisma(
          {
            tenantId: tenant.id,
            eventType: AuditEventType.REPORT_VIEW,
            entityType: AuditEntityType.ACCOUNT,
            entityId: dto.accountId,
            actorUserId: user.id,
            timestamp: new Date(),
            outcome: 'SUCCESS' as any,
            action: 'LEDGER_VIEW',
            permissionUsed: PERMISSIONS.GL.VIEW,
            metadata: {
              reportSource,
              sourceReport,
              account: {
                id: account.id,
                code: account.code,
                name: account.name,
              },
              dateRange: {
                fromDate: dto.fromDate ?? from.toISOString().slice(0, 10),
                toDate: dto.toDate ?? to.toISOString().slice(0, 10),
              },
              cutover: cutover.toISOString().slice(0, 10),
              pagination: { offset, limit },
            },
          },
          this.prisma,
        );
      }

      return {
        account,
        period: {
          fromDate: dto.fromDate ?? from.toISOString().slice(0, 10),
          toDate: dto.toDate ?? to.toISOString().slice(0, 10),
        },
        openingBalance: 0,
        rows: [],
        total: 0,
        limit,
        offset,
        hasMore: false,
      };
    }

    if (cutover && from < cutover) {
      from = cutover;
    }

    const account = await this.prisma.account.findFirst({
      where: { id: dto.accountId, tenantId: tenant.id },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        normalBalance: true,
      },
    });
    if (!account) throw new NotFoundException('Account not found');

    const openingAgg = await this.prisma.journalLine.aggregate({
      where: {
        accountId: dto.accountId,
        journalEntry: {
          tenantId: tenant.id,
          status: 'POSTED',
          journalDate: {
            lt: from,
          },
        },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });

    const openingDebit = Number(openingAgg._sum.debit ?? 0);
    const openingCredit = Number(openingAgg._sum.credit ?? 0);
    const openingBalance = openingDebit - openingCredit;

    const total = await this.prisma.journalLine.count({
      where: {
        accountId: dto.accountId,
        journalEntry: {
          tenantId: tenant.id,
          status: 'POSTED',
          journalDate: {
            gte: from,
            lte: to,
          },
        },
      },
    });

    const fetchCount = Math.min(offset + limit, 5100);
    const linesWindow = await this.prisma.journalLine.findMany({
      where: {
        accountId: dto.accountId,
        journalEntry: {
          tenantId: tenant.id,
          status: 'POSTED',
          journalDate: {
            gte: from,
            lte: to,
          },
        },
      },
      orderBy: [
        { journalEntry: { journalDate: 'asc' } },
        { journalEntryId: 'asc' },
        { lineNumber: 'asc' },
        { id: 'asc' },
      ],
      take: fetchCount,
      select: {
        id: true,
        journalEntryId: true,
        debit: true,
        credit: true,
        lineNumber: true,
        journalEntry: {
          select: {
            id: true,
            journalNumber: true,
            journalDate: true,
            reference: true,
            description: true,
          },
        },
      },
    });

    let runningBalance = openingBalance;
    const windowWithBalance = linesWindow.map((l) => {
      const debit = Number(l.debit ?? 0);
      const credit = Number(l.credit ?? 0);
      runningBalance += debit - credit;
      return {
        id: l.id,
        journalEntryId: l.journalEntryId,
        debit,
        credit,
        lineNumber: l.lineNumber,
        journalEntry: l.journalEntry,
        runningBalance,
      };
    });

    const windowPage = windowWithBalance.slice(offset, offset + limit);

    const rows = windowPage.map((l) => {
      return {
        journalEntryId: l.journalEntryId,
        journalNumber: l.journalEntry.journalNumber,
        journalDate: l.journalEntry.journalDate,
        reference: l.journalEntry.reference,
        description: l.journalEntry.description,
        debit: l.debit,
        credit: l.credit,
        runningBalance: l.runningBalance,
      };
    });

    if (offset === 0) {
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.REPORT_VIEW,
          entityType: AuditEntityType.ACCOUNT,
          entityId: dto.accountId,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'SUCCESS' as any,
          action: 'LEDGER_VIEW',
          permissionUsed: PERMISSIONS.GL.VIEW,
          metadata: {
            reportSource,
            sourceReport,
            account: {
              id: account.id,
              code: account.code,
              name: account.name,
            },
            dateRange: {
              fromDate: from.toISOString().slice(0, 10),
              toDate: to.toISOString().slice(0, 10),
            },
            pagination: { offset, limit },
          },
        },
        this.prisma,
      );
    }

    return {
      account,
      period: {
        fromDate: from.toISOString().slice(0, 10),
        toDate: to.toISOString().slice(0, 10),
      },
      openingBalance,
      rows,
      total,
      limit,
      offset,
      hasMore: offset + rows.length < total,
    };
  }

  async getJournalDetail(req: Request, id: string) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        tenantId: true,
        journalNumber: true,
        journalType: true,
        reference: true,
        description: true,
        journalDate: true,
        status: true,
        createdById: true,
        correctsJournalId: true,
        riskScore: true,
        riskFlags: true,
        riskComputedAt: true,
        budgetStatus: true,
        budgetFlags: true,
        budgetCheckedAt: true,
        budgetOverrideJustification: true,
        reversalInitiatedById: true,
        reversalInitiatedAt: true,
        reversalPreparedById: true,
        submittedById: true,
        submittedAt: true,
        reviewedById: true,
        reviewedAt: true,
        rejectedById: true,
        rejectedAt: true,
        rejectionReason: true,
        approvedById: true,
        approvedAt: true,
        postedById: true,
        postedAt: true,
        returnedByPosterId: true,
        returnedByPosterAt: true,
        returnReason: true,
        reversalOfId: true,
        reversalReason: true,
        periodId: true,
        createdAt: true,
        createdBy: { select: { id: true, email: true } },
        reversalInitiatedBy: { select: { id: true, email: true } },
        reversalPreparedBy: { select: { id: true, email: true } },
        submittedBy: { select: { id: true, email: true } },
        reviewedBy: { select: { id: true, email: true } },
        rejectedBy: { select: { id: true, email: true } },
        approvedBy: { select: { id: true, email: true } },
        postedBy: { select: { id: true, email: true } },
        returnedByPoster: { select: { id: true, email: true } },
        reversalOf: {
          select: {
            id: true,
            journalNumber: true,
            reference: true,
            status: true,
          },
        },
        reversedBy: {
          select: {
            id: true,
            journalNumber: true,
            reference: true,
            status: true,
          },
        },
        period: {
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
        lines: {
          orderBy: [{ lineNumber: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            journalEntryId: true,
            lineNumber: true,
            description: true,
            accountId: true,
            legalEntityId: true,
            departmentId: true,
            projectId: true,
            fundId: true,
            debit: true,
            credit: true,
            account: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
                normalBalance: true,
              },
            },
            legalEntity: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            department: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            project: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            fund: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    } as any);

    if (!entry) throw new NotFoundException('Journal entry not found');

    let reviewedActedBy: null | { id: string; email: string } = null;
    if (entry.reviewedById) {
      try {
        const reviewAudit = await (this.prisma.auditEvent as any).findFirst({
          where: {
            tenantId: tenant.id,
            entityId: entry.id,
            eventType: AuditEventType.GL_JOURNAL_REVIEWED,
            outcome: 'SUCCESS',
          },
          orderBy: { timestamp: 'desc' },
          select: { metadata: true },
        });

        const realUserId = String((reviewAudit as any)?.metadata?.realUserId ?? '').trim();
        const actorUserId = String((reviewAudit as any)?.metadata?.actorUserId ?? '').trim();
        if (realUserId && actorUserId && realUserId !== actorUserId) {
          const realUser = await this.prisma.user.findFirst({
            where: { id: realUserId, tenantId: tenant.id },
            select: { id: true, email: true },
          });
          if (realUser) {
            reviewedActedBy = { id: realUser.id, email: realUser.email };
          }
        }
      } catch {
        // Best-effort enrichment only; never fail the endpoint.
      }
    }

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.REPORT_VIEW,
        entityType: AuditEntityType.JOURNAL_ENTRY,
        entityId: entry.id,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'JOURNAL_VIEW_DETAIL',
        permissionUsed: PERMISSIONS.GL.VIEW,
        metadata: {
          reportSource: 'LEDGER',
          journalEntryId: entry.id,
        },
      },
      this.prisma,
    );

    return { ...(entry as any), reviewedActedBy };
  }

  async returnJournalToReview(
    req: Request,
    id: string,
    dto: ReturnToReviewDto,
  ) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, 'FINANCE_GL_FINAL_POST');

    const reason = (dto?.reason ?? '').trim();
    if (!reason || reason.length < 3) {
      throw new BadRequestException('Return reason is required');
    }

    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, tenantId: authz.tenantId },
      select: {
        id: true,
        status: true,
        createdById: true,
        reviewedById: true,
        reviewedAt: true,
      },
    });

    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    if (entry.status !== 'REVIEWED') {
      throw new BadRequestException(
        `Journal entry cannot be returned from status: ${entry.status}`,
      );
    }

    await this.assertJournalSoD({
      req,
      authz,
      actionType: 'RETURN_TO_REVIEW',
      soDAction: 'GL_JOURNAL_RETURN_TO_REVIEW',
      entry: {
        id: entry.id,
        createdById: entry.createdById,
        submittedById: null,
        reviewedById: entry.reviewedById ?? null,
        reversalInitiatedById: null,
      },
      permissionUsed: PERMISSIONS.GL.FINAL_POST,
    });

    const now = new Date();
    const previousReviewerId = entry.reviewedById ?? null;

    const updated = await this.prisma.journalEntry.update({
      where: { id: entry.id },
      data: {
        status: 'SUBMITTED',
        reviewedById: null,
        reviewedAt: null,
        returnedByPosterId: authz.actorUserId,
        returnedByPosterAt: now,
        returnReason: reason,
      },
      include: { lines: true },
    } as any);

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.GL_JOURNAL_RETURNED_BY_POSTER,
        entityType: AuditEntityType.JOURNAL_ENTRY,
        entityId: entry.id,
        actorUserId: authz.actorUserId,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_GL_FINAL_POST',
        permissionUsed: PERMISSIONS.GL.FINAL_POST,
        lifecycleType: 'RETURN_TO_REVIEW',
        metadata: {
          journalId: entry.id,
          returnedByPosterId: authz.actorUserId,
          previousReviewerId,
          reason,
          timestamp: now.toISOString(),
          realUserId: authz.realUserId,
          actorUserId: authz.actorUserId,
          delegationId: authz.delegationId ?? null,
        },
      },
      this.prisma,
    );

    this.cache.clearTenant(authz.tenantId);

    return updated;
  }

  async createDraftJournal(req: Request, dto: CreateJournalDto) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, 'FINANCE_GL_CREATE');

    const activeLegalEntityId = String((req as any)?.legalEntity?.id ?? '').trim();
    if (!activeLegalEntityId) {
      throw new BadRequestException('Missing active legal entity context');
    }

    const escalationAllowed = Boolean((req as any)?.governanceEscalation?.type);
    if (!escalationAllowed) {
      const mismatched = (dto.lines ?? [])
        .map((l, idx) => ({ idx, legalEntityId: String((l as any)?.legalEntityId ?? '').trim() }))
        .filter((x) => x.legalEntityId && x.legalEntityId !== activeLegalEntityId)
        .map((x) => x.idx);
      if (mismatched.length > 0) {
        throw new BadRequestException({
          error: 'CROSS_ENTITY_LINES_BLOCKED',
          message:
            'Journal lines must belong to your active legal entity. Switch legal entity context to transact in a different legal entity.',
          activeLegalEntityId,
          mismatchedLineIndexes: mismatched,
        });
      }
    }

    const normalizedDto: CreateJournalDto = {
      ...(dto as any),
      lines: (dto.lines ?? []).map((l) => ({
        ...(l as any),
        legalEntityId: (l as any).legalEntityId ?? activeLegalEntityId,
      })),
    } as any;

    this.assertLinesBasicValid(normalizedDto.lines);

    const journalDate = new Date(dto.journalDate);
    if (Number.isNaN(journalDate.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_JOURNAL_DATE',
        reason: 'NO_PERIOD',
        message: 'No accounting period exists for the selected date.',
      });
    }

    const cutover = await this.getCutoverDateIfLocked({
      tenantId: authz.tenantId,
    });
    if (cutover && journalDate < cutover) {
      throw new BadRequestException({
        code: 'INVALID_JOURNAL_DATE',
        reason: 'CUTOVER_VIOLATION',
        message: 'Journal date is before system cutover. Select a later date.',
      });
    }

    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: authz.tenantId,
        startDate: { lte: journalDate },
        endDate: { gte: journalDate },
      },
      select: { id: true, status: true, type: true },
    });

    if (!period) {
      throw new BadRequestException({
        code: 'INVALID_JOURNAL_DATE',
        reason: 'NO_PERIOD',
        message: 'No accounting period exists for the selected date.',
      });
    }

    try {
      assertPeriodAllowsPosting({
        req,
        period,
        permissionUsed: PERMISSIONS.GL.CREATE,
      });
    } catch {
      throw new BadRequestException({
        code: 'INVALID_JOURNAL_DATE',
        reason: 'PERIOD_CLOSED',
        message: 'Selected accounting period is closed. Choose an open period.',
      });
    }

    const accounts = (await this.prisma.account.findMany({
      where: {
        tenantId: authz.tenantId,
        id: { in: normalizedDto.lines.map((l) => l.accountId) },
      },
      select: {
        id: true,
        code: true,
        type: true,
        status: true,
        isActive: true,
        isPostingAllowed: true,
        isPosting: true,
        isControlAccount: true,
        isCashEquivalent: true,
        isIntercompanyAccount: true,
        intercompanyEnabled: true,
        intercompanyRole: true,
        requiresDepartment: true,
        requiresProject: true,
        requiresFund: true,
      } as any,
    })) as any[];

    const accountMap = new Map<string, any>(accounts.map((a) => [a.id, a] as const));

    for (const line of normalizedDto.lines) {
      const account = accountMap.get(line.accountId);
      if (!account) {
        throw new BadRequestException(`Account not found: ${line.accountId}`);
      }

      this.assertAccountLifecycleAllowsPosting({
        accountId: line.accountId,
        status: (account as any).status,
      });

      this.assertAccountFlagsAllowPosting({
        id: String((account as any).id),
        isActive: Boolean((account as any).isActive),
        isPostingAllowed: Boolean((account as any).isPostingAllowed),
        isPosting: Boolean((account as any).isPosting),
        isControlAccount: Boolean((account as any).isControlAccount),
      });
    }

    assertJournalTypePolicy({
      req,
      tenantId: authz.tenantId,
      actorUserId: authz.realUserId,
      permissionUsed: PERMISSIONS.GL.CREATE,
      mode: 'CREATE_DRAFT',
      journalDate,
      prismaJournalType: (dto.journalType ?? 'STANDARD') as any,
      periodType: (period as any)?.type ?? null,
      reversalOfId: null,
      reference: dto.reference ?? null,
      description: dto.description ?? null,
      sourceType: null,
      sourceId: null,
      lines: normalizedDto.lines.map((l) => ({
        accountId: l.accountId,
        legalEntityId: l.legalEntityId ?? null,
        departmentId: l.departmentId ?? null,
        projectId: (l as any).projectId ?? null,
        fundId: (l as any).fundId ?? null,
      })),
    });

    assertCombinationGovernance({
      req,
      tenantId: authz.tenantId,
      actorUserId: authz.realUserId,
      permissionUsed: PERMISSIONS.GL.CREATE,
      mode: 'CREATE_DRAFT',
      module: 'GL',
      journalDate,
      prismaJournalType: (dto.journalType ?? 'STANDARD') as any,
      periodType: (period as any)?.type ?? null,
      reversalOfId: null,
      reference: dto.reference ?? null,
      description: dto.description ?? null,
      sourceType: null,
      sourceId: null,
      lines: normalizedDto.lines.map((l) => {
        const acc = accountMap.get(l.accountId);
        return {
          lineNumber: l.lineNumber ?? null,
          accountId: l.accountId,
          accountCode: (acc as any)?.code ?? null,
          accountType: (acc as any)?.type ?? null,
          isControlAccount: Boolean((acc as any)?.isControlAccount),
          isCashEquivalent: Boolean((acc as any)?.isCashEquivalent),
          requiresDepartment: Boolean((acc as any)?.requiresDepartment),
          requiresProject: Boolean((acc as any)?.requiresProject),
          requiresFund: Boolean((acc as any)?.requiresFund),
          debit: Number(l.debit ?? 0),
          credit: Number(l.credit ?? 0),
          legalEntityId: l.legalEntityId ?? null,
          departmentId: l.departmentId ?? null,
          projectId: (l as any).projectId ?? null,
          fundId: (l as any).fundId ?? null,
        };
      }),
    });

    const createDraftPolicyType = resolveJournalPolicyType({
      prismaJournalType: (dto.journalType ?? 'STANDARD') as any,
      periodType: (period as any)?.type ?? null,
      reversalOfId: null,
      reference: dto.reference ?? null,
      sourceType: null,
    });
    const createDraftGovernanceActions = new Set<string>();
    if (createDraftPolicyType === 'INTERCOMPANY_JOURNAL') {
      createDraftGovernanceActions.add('INTERCOMPANY_BALANCE_VIOLATION');
    }

    const actorLegalEntityAccess = await this.loadActorLegalEntityAccess({
      tenantId: authz.tenantId,
      actorUserId: authz.realUserId,
    });

    assertIntercompanyGovernance({
      req,
      tenantId: authz.tenantId,
      actorUserId: authz.realUserId,
      permissionUsed: PERMISSIONS.GL.CREATE,
      mode: 'CREATE_DRAFT',
      entityType: 'JOURNAL_ENTRY',
      entityId: 'NEW_JOURNAL_DRAFT',
      journalType: String(dto.journalType ?? 'STANDARD'),
      reference: dto.reference ?? null,
      governanceActions: Array.from(createDraftGovernanceActions) as any,
      escalation: (req as any)?.governanceEscalation ?? null,
      justificationText:
        String(req.header('x-governance-reason') ?? '').trim() || null,
      actorLegalEntityAccess,
      lines: normalizedDto.lines.map((l) => {
        const acc = accountMap.get(l.accountId);
        return {
          lineNumber: l.lineNumber ?? null,
          legalEntityId: l.legalEntityId ?? null,
          debit: Number(l.debit ?? 0),
          credit: Number(l.credit ?? 0),
          account: {
            accountId: l.accountId,
            accountCode: (acc as any)?.code ?? null,
            isIntercompanyAccount: (acc as any)?.isIntercompanyAccount ?? null,
            intercompanyEnabled: (acc as any)?.intercompanyEnabled ?? null,
            intercompanyRole: (acc as any)?.intercompanyRole ?? null,
          },
        };
      }),
    });

    let created: any;
    try {
      created = await this.prisma.journalEntry.create({
        data: {
          tenantId: authz.tenantId,
          journalDate,
          journalType: dto.journalType ?? 'STANDARD',
          intent: (dto as any).intent as any,
          intentNotes: (dto as any).intentNotes ?? null,
          intentReference: (dto as any).intentReference ?? null,
          reference: dto.reference,
          description: dto.description,
          correctsJournalId: dto.correctsJournalId ?? null,
          createdById: authz.realUserId,
          lines: {
            create: normalizedDto.lines.map((l) => ({
              accountId: l.accountId,
              lineNumber: l.lineNumber,
              description: l.description,
              legalEntityId: l.legalEntityId ?? null,
              departmentId: l.departmentId ?? null,
              projectId: (l as any).projectId as string | null | undefined,
              fundId: (l as any).fundId as string | null | undefined,
              debit: l.debit,
              credit: l.credit,
            })),
          },
        },
        include: { lines: true },
      });
    } catch (err: any) {
      const lineContext = (normalizedDto.lines ?? []).map((l) => ({
        lineNumber: (l as any)?.lineNumber ?? null,
        accountId: String((l as any)?.accountId ?? ''),
        legalEntityId: (l as any)?.legalEntityId ?? null,
        departmentId: (l as any)?.departmentId ?? null,
        projectId: (l as any)?.projectId ?? null,
        fundId: (l as any)?.fundId ?? null,
      }));

      // eslint-disable-next-line no-console
      console.error('[GL][createDraftJournal][prismaCreateFailed]', {
        tenantId: authz.tenantId,
        actorUserId: authz.realUserId,
        activeLegalEntityId,
        journalDate: journalDate?.toISOString?.() ?? null,
        prismaCode: String(err?.code ?? ''),
        prismaMeta: (err as any)?.meta ?? null,
        message: String(err?.message ?? ''),
        lines: lineContext,
      });

      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2003') {
          throw new BadRequestException({
            code: 'INVALID_REFERENCE',
            message:
              'One or more journal lines reference a record that does not exist (e.g., account/department/project/fund/legal entity).',
            prisma: { code: err.code, meta: (err as any)?.meta ?? null },
          });
        }

        if (err.code === 'P2025') {
          throw new BadRequestException({
            code: 'RECORD_NOT_FOUND',
            message: 'A referenced record was not found while creating the journal.',
            prisma: { code: err.code, meta: (err as any)?.meta ?? null },
          });
        }
      }

      throw err;
    }

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.JOURNAL_CREATE,
        entityType: AuditEntityType.JOURNAL_ENTRY,
        entityId: created.id,
        actorUserId: authz.realUserId,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_GL_CREATE',
        permissionUsed: PERMISSIONS.GL.CREATE,
        lifecycleType: 'CREATE',
        metadata: {
          journalId: created.id,
          journalType: (created as any).journalType ?? null,
          realUserId: authz.realUserId,
          actorUserId: authz.actorUserId,
          delegationId: authz.delegationId ?? null,
        },
      },
      this.prisma,
    );

    return created;
  }

  async getJournal(req: Request, id: string) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, tenantId: tenant.id },
      include: { lines: true },
    });

    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    return entry;
  }

  async updateDraftJournal(req: Request, id: string, dto: UpdateJournalDto) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, 'FINANCE_GL_CREATE');

    const activeLegalEntityId = String((req as any)?.legalEntity?.id ?? '').trim();
    if (!activeLegalEntityId) {
      throw new BadRequestException('Missing active legal entity context');
    }

    const escalationAllowed = Boolean((req as any)?.governanceEscalation?.type);
    if (!escalationAllowed) {
      const mismatched = (dto.lines ?? [])
        .map((l, idx) => ({ idx, legalEntityId: String((l as any)?.legalEntityId ?? '').trim() }))
        .filter((x) => x.legalEntityId && x.legalEntityId !== activeLegalEntityId)
        .map((x) => x.idx);

      if (mismatched.length > 0) {
        throw new BadRequestException({
          error: 'CROSS_ENTITY_LINES_BLOCKED',
          message:
            'Journal lines must belong to your active legal entity. Switch legal entity context to transact in a different legal entity.',
          activeLegalEntityId,
          mismatchedLineIndexes: mismatched,
        });
      }
    }

    const normalizedDto: UpdateJournalDto = {
      ...(dto as any),
      lines: (dto.lines ?? []).map((l) => ({
        ...(l as any),
        legalEntityId: (l as any).legalEntityId ?? activeLegalEntityId,
      })),
    } as any;

    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, tenantId: authz.tenantId },
      include: { lines: true },
    });
    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    if (entry.status !== 'DRAFT' && entry.status !== 'REJECTED') {
      throw new ForbiddenException(
        'Only DRAFT or REJECTED journals can be edited',
      );
    }

    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: authz.tenantId,
        startDate: { lte: new Date(dto.journalDate) },
        endDate: { gte: new Date(dto.journalDate) },
      },
      select: { id: true, status: true, type: true },
    });

    if (!period) {
      throw new BadRequestException({
        code: 'INVALID_JOURNAL_DATE',
        reason: 'NO_PERIOD',
        message: 'No accounting period exists for the selected date.',
      });
    }

    const nextIntent = String((dto as any).intent ?? (entry as any).intent ?? '').trim();
    this.assertJournalIntentRules({
      intent: nextIntent,
      periodType: (period as any)?.type ?? null,
      correctsJournalId: (entry as any).correctsJournalId ?? null,
      reversalOfId: (entry as any).reversalOfId ?? null,
      mode: 'UPDATE_DRAFT',
    });

    const isReversal =
      entry.journalType === 'REVERSING' && !!(entry as any).reversalOfId;
    if (isReversal) {
      requireOwnership({ createdById: entry.createdById, userId: authz.realUserId });
    } else {
      requireOwnership({ createdById: entry.createdById, userId: authz.realUserId });
    }

    if (isReversal) {
      const now = new Date();
      const proposedDate = new Date(dto.journalDate);
      if (Number.isNaN(proposedDate.getTime())) {
        throw new BadRequestException('Invalid journalDate');
      }

      const cutover = await this.getCutoverDateIfLocked({
        tenantId: authz.tenantId,
      });
      if (cutover && proposedDate < cutover) {
        throw new BadRequestException(
          'Journal date is before system cutover. Select a later date.',
        );
      }

      const reversalPeriod = await (this.prisma.accountingPeriod as any).findFirst({
        where: {
          tenantId: authz.tenantId,
          startDate: { lte: proposedDate },
          endDate: { gte: proposedDate },
        },
        select: { id: true, status: true, name: true, type: true },
      });
      if (!reversalPeriod) {
        throw new BadRequestException(
          'Journal date is not within an open accounting period. Please choose a date in an open period.',
        );
      }
      assertPeriodAllowsPosting({
        req,
        period: reversalPeriod,
        permissionUsed: PERMISSIONS.GL.CREATE,
      });

      if (reversalPeriod.type === 'OPENING') {
        await this.assertOpeningBalanceAccountsAllowed({
          tenantId: authz.tenantId,
          lines: entry.lines.map((l) => ({
            accountId: l.accountId,
            debit: Number(l.debit),
            credit: Number(l.credit),
          })),
        });
      }

      // Reversal drafts are system-generated: allow header description + journal date only.
      const updated = await this.prisma.journalEntry.update({
        where: { id: entry.id },
        data: {
          journalDate: proposedDate,
          description: dto.description,
          ...(entry.status === 'REJECTED'
            ? {
                rejectedById: null,
                rejectedAt: null,
                rejectionReason: null,
              }
            : {}),
        },
        include: { lines: true },
      });

      await writeAuditEventWithPrisma(
        {
          tenantId: authz.tenantId,
          eventType: AuditEventType.JOURNAL_UPDATE,
          entityType: AuditEntityType.JOURNAL_ENTRY,
          entityId: updated.id,
          actorUserId: authz.id,
          timestamp: new Date(),
          outcome: 'SUCCESS' as any,
          action: 'FINANCE_GL_CREATE',
          permissionUsed: PERMISSIONS.GL.CREATE,
          lifecycleType: 'UPDATE',
          metadata: {
            mode: 'REVERSAL_HEADER_ONLY',
            journalDate: proposedDate.toISOString(),
            updatedAt: now.toISOString(),
          },
        },
        this.prisma,
      );

      return updated;
    }

    const proposedDate = dto.journalDate
      ? new Date(dto.journalDate)
      : new Date(entry.journalDate);
    if (Number.isNaN(proposedDate.getTime())) {
      throw new BadRequestException('Invalid journalDate');
    }

    const cutover = await this.getCutoverDateIfLocked({
      tenantId: authz.tenantId,
    });
    if (cutover && proposedDate < cutover) {
      throw new BadRequestException(
        'Journal date is before system cutover. Select a later date.',
      );
    }

    const proposedPeriod = await (this.prisma.accountingPeriod as any).findFirst({
      where: {
        tenantId: authz.tenantId,
        startDate: { lte: proposedDate },
        endDate: { gte: proposedDate },
      },
      select: { id: true, status: true, name: true, type: true },
    });
    if (!proposedPeriod) {
      throw new BadRequestException(
        'Journal date is not within an open accounting period. Please choose a date in an open period.',
      );
    }
    assertPeriodAllowsPosting({
      req,
      period: proposedPeriod,
      permissionUsed: PERMISSIONS.GL.CREATE,
    });

    if (proposedPeriod.type === 'OPENING') {
      await this.assertOpeningBalanceAccountsAllowed({
        tenantId: authz.tenantId,
        lines: normalizedDto.lines.map((l) => ({
          accountId: l.accountId,
          debit: Number(l.debit),
          credit: Number(l.credit),
        })),
      });
    }

    this.assertLinesBasicValid(normalizedDto.lines);

    const accounts = (await this.prisma.account.findMany({
      where: {
        tenantId: authz.tenantId,
        id: { in: normalizedDto.lines.map((l) => l.accountId) },
      },
      select: {
        id: true,
        code: true,
        type: true,
        status: true,
        isActive: true,
        isPostingAllowed: true,
        isPosting: true,
        isControlAccount: true,
        isCashEquivalent: true,
        isIntercompanyAccount: true,
        intercompanyEnabled: true,
        intercompanyRole: true,
        requiresDepartment: true,
        requiresProject: true,
        requiresFund: true,
      } as any,
    })) as any[];
    const accountMap = new Map<string, any>(accounts.map((a) => [a.id, a] as const));

    for (const line of normalizedDto.lines) {
      const account = accountMap.get(line.accountId);
      if (!account) {
        throw new BadRequestException(`Account not found: ${line.accountId}`);
      }

      this.assertAccountLifecycleAllowsPosting({
        accountId: line.accountId,
        status: (account as any).status,
      });

      this.assertAccountFlagsAllowPosting({
        id: String((account as any).id),
        isActive: Boolean((account as any).isActive),
        isPostingAllowed: Boolean((account as any).isPostingAllowed),
        isPosting: Boolean((account as any).isPosting),
        isControlAccount: Boolean((account as any).isControlAccount),
      });
    }

    assertJournalTypePolicy({
      req,
      tenantId: authz.tenantId,
      actorUserId: authz.realUserId,
      permissionUsed: PERMISSIONS.GL.CREATE,
      mode: 'UPDATE_DRAFT',
      journalDate: proposedDate,
      prismaJournalType: (dto.journalType ?? entry.journalType) as any,
      periodType: (proposedPeriod as any)?.type ?? null,
      reversalOfId: (entry as any).reversalOfId ?? null,
      reference: (dto.reference ?? entry.reference ?? null) as any,
      description: (dto.description ?? entry.description ?? null) as any,
      sourceType: (entry as any).sourceType ?? null,
      sourceId: (entry as any).sourceId ?? null,
      lines: normalizedDto.lines.map((l) => ({
        accountId: l.accountId,
        legalEntityId: l.legalEntityId ?? null,
        departmentId: l.departmentId ?? null,
        projectId: (l as any).projectId ?? null,
        fundId: (l as any).fundId ?? null,
      })),
    });

    assertCombinationGovernance({
      req,
      tenantId: authz.tenantId,
      actorUserId: authz.realUserId,
      permissionUsed: PERMISSIONS.GL.CREATE,
      mode: 'UPDATE_DRAFT',
      module: 'GL',
      journalDate: proposedDate,
      prismaJournalType: (dto.journalType ?? entry.journalType) as any,
      periodType: (proposedPeriod as any)?.type ?? null,
      reversalOfId: (entry as any).reversalOfId ?? null,
      reference: (dto.reference ?? entry.reference ?? null) as any,
      description: (dto.description ?? entry.description ?? null) as any,
      sourceType: (entry as any).sourceType ?? null,
      sourceId: (entry as any).sourceId ?? null,
      lines: normalizedDto.lines.map((l) => {
        const acc = accountMap.get(l.accountId);
        return {
          lineNumber: l.lineNumber ?? null,
          accountId: l.accountId,
          accountCode: (acc as any)?.code ?? null,
          accountType: (acc as any)?.type ?? null,
          isControlAccount: Boolean((acc as any)?.isControlAccount),
          isCashEquivalent: Boolean((acc as any)?.isCashEquivalent),
          requiresDepartment: Boolean((acc as any)?.requiresDepartment),
          requiresProject: Boolean((acc as any)?.requiresProject),
          requiresFund: Boolean((acc as any)?.requiresFund),
          debit: Number(l.debit ?? 0),
          credit: Number(l.credit ?? 0),
          legalEntityId: l.legalEntityId ?? null,
          departmentId: l.departmentId ?? null,
          projectId: (l as any).projectId ?? null,
          fundId: (l as any).fundId ?? null,
        };
      }),
    });

    const updateDraftPolicyType = resolveJournalPolicyType({
      prismaJournalType: (dto.journalType ?? entry.journalType) as any,
      periodType: (proposedPeriod as any)?.type ?? null,
      reversalOfId: (entry as any).reversalOfId ?? null,
      reference: (dto.reference ?? entry.reference ?? null) as any,
      sourceType: (entry as any).sourceType ?? null,
    });
    const updateDraftGovernanceActions = new Set<string>();
    if (updateDraftPolicyType === 'INTERCOMPANY_JOURNAL') {
      updateDraftGovernanceActions.add('INTERCOMPANY_BALANCE_VIOLATION');
    }

    const actorLegalEntityAccess = await this.loadActorLegalEntityAccess({
      tenantId: authz.tenantId,
      actorUserId: authz.realUserId,
    });

    assertIntercompanyGovernance({
      req,
      tenantId: authz.tenantId,
      actorUserId: authz.realUserId,
      permissionUsed: PERMISSIONS.GL.CREATE,
      mode: 'UPDATE_DRAFT',
      entityType: 'JOURNAL_ENTRY',
      entityId: entry.id,
      journalType: String(dto.journalType ?? entry.journalType ?? 'STANDARD'),
      reference: (dto.reference ?? entry.reference ?? null) as any,
      governanceActions: Array.from(updateDraftGovernanceActions) as any,
      escalation: (req as any)?.governanceEscalation ?? null,
      justificationText:
        String(req.header('x-governance-reason') ?? '').trim() || null,
      actorLegalEntityAccess,
      lines: normalizedDto.lines.map((l) => {
        const acc = accountMap.get(l.accountId);
        return {
          lineNumber: l.lineNumber ?? null,
          legalEntityId: l.legalEntityId ?? null,
          debit: Number(l.debit ?? 0),
          credit: Number(l.credit ?? 0),
          account: {
            accountId: l.accountId,
            accountCode: (acc as any)?.code ?? null,
            isIntercompanyAccount: (acc as any)?.isIntercompanyAccount ?? null,
            intercompanyEnabled: (acc as any)?.intercompanyEnabled ?? null,
            intercompanyRole: (acc as any)?.intercompanyRole ?? null,
          },
        };
      }),
    });

    const updated = await this.prisma.journalEntry.update({
      where: { id: entry.id },
      data: {
        journalDate: proposedDate,
        journalType: (dto.journalType ?? entry.journalType) as any,
        intent: ((dto as any).intent ?? (entry as any).intent) as any,
        intentNotes: (dto as any).intentNotes ?? (entry as any).intentNotes ?? null,
        intentReference:
          (dto as any).intentReference ?? (entry as any).intentReference ?? null,
        reference: dto.reference ?? entry.reference,
        description: dto.description ?? entry.description,
        ...((dto as any).correctsJournalId !== undefined
          ? {
              correctsJournalId: (dto as any).correctsJournalId,
              rejectionReason: null,
            }
          : {}),
        lines: {
          deleteMany: { journalEntryId: entry.id },
          create: normalizedDto.lines.map((l) => ({
            accountId: l.accountId,
            lineNumber: l.lineNumber,
            description: l.description,
            legalEntityId: l.legalEntityId ?? null,
            departmentId: l.departmentId ?? null,
            projectId: l.projectId ?? null,
            fundId: l.fundId ?? null,
            debit: l.debit,
            credit: l.credit,
          })),
        },
      },
      include: { lines: true },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.JOURNAL_UPDATE,
        entityType: AuditEntityType.JOURNAL_ENTRY,
        entityId: updated.id,
        actorUserId: authz.realUserId,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_GL_CREATE',
        permissionUsed: PERMISSIONS.GL.CREATE,
        lifecycleType: 'UPDATE',
        metadata: {
          journalId: updated.id,
        },
      },
      this.prisma,
    );

    return updated;
  }

  async parkJournal(req: Request, id: string) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, 'FINANCE_GL_CREATE');

    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, tenantId: authz.tenantId },
      include: { lines: true },
    });
    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    if (entry.status !== 'DRAFT') {
      throw new ForbiddenException('Only DRAFT journals can be parked');
    }

    requireOwnership({ createdById: entry.createdById, userId: authz.id });

    const linesForValidation = entry.lines.map((l) => ({
      debit: Number(l.debit),
      credit: Number(l.credit),
    }));

    this.assertLinesBasicValid(linesForValidation);
    this.assertBalanced(linesForValidation);

    const parked = await this.prisma.journalEntry.update({
      where: { id: entry.id },
      data: { status: 'PARKED' },
      include: { lines: true },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.JOURNAL_PARK,
        entityType: AuditEntityType.JOURNAL_ENTRY,
        entityId: parked.id,
        actorUserId: authz.realUserId,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_GL_CREATE',
        permissionUsed: PERMISSIONS.GL.CREATE,
        lifecycleType: 'PARK',
        metadata: {
          journalId: parked.id,
          realUserId: authz.realUserId,
          actorUserId: authz.actorUserId,
          delegationId: authz.delegationId ?? null,
        },
      },
      this.prisma,
    );

    return parked;
  }

  async voidJournal(req: Request, id: string, dto: VoidJournalDto) {
    const authz = await this.getUserAuthz(req);

    const reason = String(dto?.reason ?? '').trim();
    if (!reason) {
      throw new BadRequestException('Void reason is required');
    }
    const reference = String(dto?.reference ?? '').trim() || null;

    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, tenantId: authz.tenantId },
      include: { lines: true },
    });
    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    if (entry.status === 'POSTED') {
      throw new BadRequestException('POSTED journals cannot be voided');
    }
    if (String(entry.status) === 'VOIDED') {
      throw new BadRequestException('Journal entry is already voided');
    }

    const allowed =
      entry.status === 'DRAFT' ||
      entry.status === 'PARKED' ||
      entry.status === 'SUBMITTED' ||
      entry.status === 'REVIEWED' ||
      entry.status === 'REJECTED';
    if (!allowed) {
      throw new BadRequestException(
        `Journal entry cannot be voided from status: ${entry.status}`,
      );
    }

    const permissionUsed =
      entry.status === 'REVIEWED'
        ? PERMISSIONS.GL.JOURNAL_VOID_REVIEWED
        : PERMISSIONS.GL.JOURNAL_VOID;
    requirePermission(authz, permissionUsed);

    await this.assertJournalSoD({
      req,
      authz,
      actionType: 'VOID',
      soDAction: 'GL_JOURNAL_VOID',
      entry: {
        id: entry.id,
        createdById: entry.createdById,
        submittedById: (entry as any).submittedById ?? null,
        reviewedById: (entry as any).reviewedById ?? null,
        reversalInitiatedById: (entry as any).reversalInitiatedById ?? null,
      },
      permissionUsed,
    });

    const now = new Date();
    const updated = await this.prisma.journalEntry.update({
      where: { id: entry.id },
      data: {
        status: 'VOIDED',
        voidedAt: now,
        voidedById: authz.actorUserId,
        voidReason: reason,
        voidReference: reference,
      } as any,
      include: { lines: true },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.JOURNAL_UPDATE,
        entityType: AuditEntityType.JOURNAL_ENTRY,
        entityId: updated.id,
        actorUserId: authz.actorUserId,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'GL_JOURNAL_VOIDED',
        permissionUsed,
        lifecycleType: 'VOID',
        reason,
        metadata: {
          governance: buildGovernanceAuditMetadata({
            actionType: 'GL_JOURNAL_VOID',
            permissionUsed,
            actorUserId: authz.actorUserId,
            tenantId: authz.tenantId,
            req,
            changedKeys: ['status', 'voidedAt', 'voidedById', 'voidReason', 'voidReference'],
            before: {
              status: entry.status,
              voidedAt: (entry as any).voidedAt ?? null,
              voidedById: (entry as any).voidedById ?? null,
              voidReason: (entry as any).voidReason ?? null,
              voidReference: (entry as any).voidReference ?? null,
            },
            after: {
              status: 'VOIDED',
              voidedAt: now.toISOString(),
              voidedById: authz.actorUserId,
              voidReason: reason,
              voidReference: reference,
            },
            escalation: (req as any)?.governanceEscalation ?? null,
          }),
          journalId: updated.id,
          voidedAt: now.toISOString(),
          voidedById: authz.actorUserId,
          voidReason: reason,
          voidReference: reference,
          realUserId: authz.realUserId,
          actorUserId: authz.actorUserId,
          delegationId: authz.delegationId ?? null,
        },
      },
      this.prisma,
    );

    return updated;
  }

  async submitJournal(req: Request, id: string) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, 'FINANCE_GL_CREATE');

    const activeLegalEntityId = String((req as any)?.legalEntity?.id ?? '').trim();
    if (!activeLegalEntityId) {
      throw new BadRequestException('Missing active legal entity context');
    }

    const escalationAllowed = Boolean((req as any)?.governanceEscalation?.type);

    let entry = await this.prisma.journalEntry.findFirst({
      where: { id, tenantId: authz.tenantId },
      include: { lines: true },
    });
    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    if (entry.status !== 'DRAFT' && entry.status !== 'REJECTED') {
      throw new BadRequestException(
        `Journal entry cannot be submitted from status: ${entry.status}`,
      );
    }

    if (entry.createdById !== authz.realUserId) {
      throw new ForbiddenException({
        error: 'Submission blocked',
        message: 'Only the journal creator can submit this journal.',
        createdById: entry.createdById,
        currentUserId: authz.realUserId,
      });
    }

    if (!escalationAllowed) {
      const mismatchedLineIds = (entry.lines ?? [])
        .filter((l) => l.legalEntityId && String(l.legalEntityId) !== activeLegalEntityId)
        .map((l) => String(l.id));

      if (mismatchedLineIds.length > 0) {
        throw new BadRequestException({
          error: 'CROSS_ENTITY_LINES_BLOCKED',
          message:
            'Journal lines must belong to your active legal entity. Switch legal entity context to transact in a different legal entity.',
          activeLegalEntityId,
          mismatchedLineIds,
        });
      }
    }

    const needsDefault = (entry.lines ?? []).some((l) => !l.legalEntityId);
    if (needsDefault) {
      await this.prisma.journalLine.updateMany({
        where: {
          journalEntryId: entry.id,
          tenantId: authz.tenantId,
          legalEntityId: null,
        } as any,
        data: {
          legalEntityId: activeLegalEntityId,
        } as any,
      });

      const refreshed = await this.prisma.journalEntry.findFirst({
        where: { id, tenantId: authz.tenantId },
        include: { lines: true },
      });
      if (!refreshed) {
        throw new NotFoundException('Journal entry not found');
      }
      entry = refreshed;
    }

    const evidenceLinks = await (this.prisma as any).auditEvidenceLink.findMany({
      where: {
        tenantId: authz.tenantId,
        entityType: 'JOURNAL_ENTRY',
        entityId: entry.id,
      },
      select: { evidenceId: true },
    });

    const journalDate = new Date(entry.journalDate);
    if (Number.isNaN(journalDate.getTime())) {
      throw new BadRequestException('Invalid journalDate');
    }

    const cutover = await this.getCutoverDateIfLocked({
      tenantId: authz.tenantId,
    });
    if (cutover && journalDate < cutover) {
      throw new BadRequestException(
        'Journal date is before system cutover. Select a later date.',
      );
    }

    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: authz.tenantId,
        startDate: { lte: journalDate },
        endDate: { gte: journalDate },
      },
      select: { id: true, status: true, name: true, type: true },
    });
    if (!period) {
      throw new BadRequestException(
        'Journal date is not within an open accounting period. Please choose a date in an open period.',
      );
    }
    assertPeriodAllowsPosting({
      req,
      period,
      permissionUsed: PERMISSIONS.GL.POST,
    });

    this.assertJournalIntentRules({
      intent: String((entry as any).intent ?? '').trim(),
      periodType: (period as any)?.type ?? null,
      correctsJournalId: (entry as any).correctsJournalId ?? null,
      reversalOfId: (entry as any).reversalOfId ?? null,
      attachments: (evidenceLinks ?? []).map((l: any) => ({ id: String(l.evidenceId) })),
      mode: 'SUBMIT',
    });

    const linesForValidation = entry.lines.map((l) => ({
      debit: Number(l.debit),
      credit: Number(l.credit),
    }));
    this.assertLinesBasicValid(linesForValidation);
    this.assertBalanced(linesForValidation);

    type SubmitLineError = {
      lineId: string;
      lineNumber: number | null;
      field:
        | 'legalEntityId'
        | 'departmentId'
        | 'projectId'
        | 'fundId'
        | 'accountId';
      message: string;
    };

    const submitErrors: SubmitLineError[] = [];

    const accountIds = [
      ...new Set(entry.lines.map((l) => l.accountId).filter(Boolean)),
    ] as string[];
    const accounts = await this.prisma.account.findMany({
      where: {
        tenantId: authz.tenantId,
        id: { in: accountIds },
      },
      select: {
        id: true,
        code: true,
        type: true,
        isControlAccount: true,
        requiresProject: true,
        requiresFund: true,
      },
    });
    const accountById = new Map(accounts.map((a) => [a.id, a] as const));

    const legalEntityIds = [
      ...new Set(entry.lines.map((l) => l.legalEntityId).filter(Boolean)),
    ] as string[];
    const departmentIds = [
      ...new Set(entry.lines.map((l) => l.departmentId).filter(Boolean)),
    ] as string[];
    const projectIds = [
      ...new Set(entry.lines.map((l) => (l as any).projectId).filter(Boolean)),
    ] as string[];
    const fundIds = [
      ...new Set(entry.lines.map((l) => (l as any).fundId).filter(Boolean)),
    ] as string[];

    const [legalEntities, departments, projects, funds] = await Promise.all([
      this.prisma.legalEntity.findMany({
        where: { tenantId: authz.tenantId, id: { in: legalEntityIds } },
        select: {
          id: true,
          isActive: true,
          effectiveFrom: true,
          effectiveTo: true,
        },
      }),
      this.prisma.department.findMany({
        where: { tenantId: authz.tenantId, id: { in: departmentIds } },
        select: {
          id: true,
          isActive: true,
          status: true,
          effectiveFrom: true,
          effectiveTo: true,
        },
      }),
      this.prisma.project.findMany({
        where: { tenantId: authz.tenantId, id: { in: projectIds } },
        select: {
          id: true,
          isActive: true,
          status: true,
          isRestricted: true,
          effectiveFrom: true,
          effectiveTo: true,
        },
      }),
      this.prisma.fund.findMany({
        where: { tenantId: authz.tenantId, id: { in: fundIds } },
        select: {
          id: true,
          projectId: true,
          isActive: true,
          status: true,
          effectiveFrom: true,
          effectiveTo: true,
        },
      }),
    ]);

    const legalEntityById = new Map(
      legalEntities.map((e) => [e.id, e] as const),
    );
    const departmentById = new Map(departments.map((d) => [d.id, d] as const));
    const projectById = new Map(projects.map((p) => [p.id, p] as const));
    const fundById = new Map(funds.map((f) => [f.id, f] as const));

    for (const l of entry.lines) {
      const account = accountById.get(l.accountId);
      const accountType = account?.type;

      if (!l.legalEntityId) {
        submitErrors.push({
          lineId: l.id,
          lineNumber: l.lineNumber ?? null,
          field: 'legalEntityId',
          message: 'Legal Entity is required',
        });
      } else {
        const le = legalEntityById.get(l.legalEntityId);
        if (!le) {
          submitErrors.push({
            lineId: l.id,
            lineNumber: l.lineNumber ?? null,
            field: 'legalEntityId',
            message: 'Legal Entity is invalid for this tenant',
          });
        } else {
          const effective =
            le.effectiveFrom <= journalDate &&
            ((le as GlScopedProps).effectiveTo === null ||
              (le as GlScopedProps).effectiveTo! >= journalDate);
          if (!(le as GlScopedProps).isActive) {
            submitErrors.push({
              lineId: l.id,
              lineNumber: l.lineNumber ?? null,
              field: 'legalEntityId',
              message: 'Legal Entity is inactive',
            });
          }
          if (!effective) {
            submitErrors.push({
              lineId: l.id,
              lineNumber: l.lineNumber ?? null,
              field: 'legalEntityId',
              message: 'Legal Entity is not effective for journal date',
            });
          }
        }
      }

      const departmentRequirement = account
        ? this.getDepartmentRequirement(account)
        : DepartmentRequirement.REQUIRED;

      if (!l.departmentId) {
        if (departmentRequirement === DepartmentRequirement.REQUIRED) {
          submitErrors.push({
            lineId: l.id,
            lineNumber: l.lineNumber ?? null,
            field: 'departmentId',
            message: this.getDepartmentRequirementMessage({
              requirement: departmentRequirement,
              accountType,
            }),
          });
        }
      } else {
        if (departmentRequirement === DepartmentRequirement.FORBIDDEN) {
          submitErrors.push({
            lineId: l.id,
            lineNumber: l.lineNumber ?? null,
            field: 'departmentId',
            message: this.getDepartmentRequirementMessage({
              requirement: departmentRequirement,
              accountType,
            }),
          });
        }

        const d = departmentById.get(l.departmentId);
        if (!d) {
          submitErrors.push({
            lineId: l.id,
            lineNumber: l.lineNumber ?? null,
            field: 'departmentId',
            message: 'Department is invalid for this tenant',
          });
        } else {
          const effective =
            d.effectiveFrom <= journalDate &&
            ((d as GlScopedProps).effectiveTo === null ||
              (d as GlScopedProps).effectiveTo! >= journalDate);
          if ((d as any).status && (d as any).status !== 'ACTIVE') {
            submitErrors.push({
              lineId: l.id,
              lineNumber: l.lineNumber ?? null,
              field: 'departmentId',
              message: 'Department is inactive',
            });
          }
          if (!(d as GlScopedProps).isActive) {
            submitErrors.push({
              lineId: l.id,
              lineNumber: l.lineNumber ?? null,
              field: 'departmentId',
              message: 'Department is inactive',
            });
          }
          if (!effective) {
            submitErrors.push({
              lineId: l.id,
              lineNumber: l.lineNumber ?? null,
              field: 'departmentId',
              message: 'Department is not effective for journal date',
            });
          }
        }
      }

      const projectId = (l as any).projectId as string | null | undefined;
      const fundId = (l as any).fundId as string | null | undefined;

      const selectedProject = projectId
        ? projectById.get(projectId)
        : undefined;
      const isRestrictedProject = Boolean(selectedProject?.isRestricted);

      const fundRequired =
        Boolean(account?.requiresFund) || isRestrictedProject;
      const projectRequired = Boolean(account?.requiresProject) || fundRequired;

      if (fundId && !projectId) {
        submitErrors.push({
          lineId: l.id,
          lineNumber: l.lineNumber ?? null,
          field: 'projectId',
          message: 'Project must be selected before Fund',
        });
      }

      if (!projectId && projectRequired) {
        submitErrors.push({
          lineId: l.id,
          lineNumber: l.lineNumber ?? null,
          field: 'projectId',
          message: 'Project is required',
        });
      }

      if (!fundId && fundRequired) {
        submitErrors.push({
          lineId: l.id,
          lineNumber: l.lineNumber ?? null,
          field: 'fundId',
          message: isRestrictedProject
            ? 'Fund is required because the selected Project is restricted'
            : 'Fund is required',
        });
      }

      if (projectId) {
        const p = projectById.get(projectId);
        if (!p) {
          submitErrors.push({
            lineId: l.id,
            lineNumber: l.lineNumber ?? null,
            field: 'projectId',
            message: 'Project is invalid for this tenant',
          });
        } else {
          const effective =
            p.effectiveFrom <= journalDate &&
            ((p as GlScopedProps).effectiveTo === null ||
              (p as GlScopedProps).effectiveTo! >= journalDate);
          if ((p as any).status === 'CLOSED') {
            submitErrors.push({
              lineId: l.id,
              lineNumber: l.lineNumber ?? null,
              field: 'projectId',
              message: 'Project is closed',
            });
          }
          if (!(p as GlScopedProps).isActive) {
            submitErrors.push({
              lineId: l.id,
              lineNumber: l.lineNumber ?? null,
              field: 'projectId',
              message: 'Project is inactive',
            });
          }
          if (!effective) {
            submitErrors.push({
              lineId: l.id,
              lineNumber: l.lineNumber ?? null,
              field: 'projectId',
              message: 'Project is not effective for journal date',
            });
          }
        }
      }

      if (fundId) {
        const f = fundById.get(fundId);
        if (!f) {
          submitErrors.push({
            lineId: l.id,
            lineNumber: l.lineNumber ?? null,
            field: 'fundId',
            message: 'Fund is invalid for this tenant',
          });
        } else {
          const effective =
            f.effectiveFrom <= journalDate &&
            ((f as GlScopedProps).effectiveTo === null ||
              (f as GlScopedProps).effectiveTo! >= journalDate);
          if ((f as any).status && (f as any).status !== 'ACTIVE') {
            submitErrors.push({
              lineId: l.id,
              lineNumber: l.lineNumber ?? null,
              field: 'fundId',
              message: 'Fund is inactive',
            });
          }
          if (!(f as GlScopedProps).isActive) {
            submitErrors.push({
              lineId: l.id,
              lineNumber: l.lineNumber ?? null,
              field: 'fundId',
              message: 'Fund is inactive',
            });
          }
          if (!effective) {
            submitErrors.push({
              lineId: l.id,
              lineNumber: l.lineNumber ?? null,
              field: 'fundId',
              message: 'Fund is not effective for journal date',
            });
          }

          if (projectId && f.projectId && f.projectId !== projectId) {
            submitErrors.push({
              lineId: l.id,
              lineNumber: l.lineNumber ?? null,
              field: 'fundId',
              message: 'Fund does not belong to selected Project',
            });
          }
        }
      }
    }

    if (submitErrors.length > 0) {
      throw new BadRequestException({
        error: 'Submission blocked',
        message: 'Some journal lines are missing required dimensions.',
        errors: submitErrors,
      });
    }

    const now = new Date();

    const budgetImpact = await this.computeJournalBudgetImpact({
      req,
      tenantId: authz.tenantId,
      entry: {
        id: entry.id,
        journalDate: new Date(entry.journalDate),
        createdById: entry.createdById,
        budgetOverrideJustification:
          (entry as any).budgetOverrideJustification ?? null,
      },
      lines: (entry.lines ?? []).map((l) => ({
        id: l.id,
        lineNumber: (l as any).lineNumber ?? null,
        accountId: (l as any).accountId,
        debit: (l as any).debit,
        credit: (l as any).credit,
        legalEntityId: (l as any).legalEntityId ?? null,
        departmentId: (l as any).departmentId ?? null,
        projectId: (l as any).projectId ?? null,
        fundId: (l as any).fundId ?? null,
      })),
      stage: 'SUBMIT',
      computedAt: now,
      permissionUsed: PERMISSIONS.GL.CREATE,
    });

    await this.persistJournalBudgetImpact({
      tenantId: authz.tenantId,
      journalId: entry.id,
      computedAt: now,
      budgetStatus: budgetImpact.budgetStatus,
      budgetFlags: budgetImpact.budgetFlags,
    });

    await this.auditJournalBudgetEvaluated({
      tenantId: authz.tenantId,
      journalId: entry.id,
      userId: authz.realUserId,
      permissionUsed: PERMISSIONS.GL.CREATE,
      stage: 'SUBMIT',
      computedAt: now,
      budgetStatus: budgetImpact.budgetStatus,
      budgetFlags: budgetImpact.budgetFlags,
    });

    if (budgetImpact.budgetStatus === 'BLOCK') {
      throw new ConflictException({
        code: 'BUDGET_BLOCKED',
        stage: 'SUBMIT',
        message: 'Journal exceeds available budget for one or more lines.',
        budgetFlags: budgetImpact.budgetFlags,
      });
    }

    if (budgetImpact.budgetStatus === 'WARN') {
      const justification = String(
        (entry as any).budgetOverrideJustification ?? '',
      ).trim();
      if (!justification) {
        throw new BadRequestException({
          code: 'BUDGET_JUSTIFICATION_REQUIRED',
          stage: 'SUBMIT',
          message:
            'Budget exception justification is required to submit this journal.',
        });
      }
    }
    const submitted = await this.prisma.journalEntry.update({
      where: { id: entry.id },
      data: {
        status: 'SUBMITTED',
        submittedById: authz.realUserId,
        submittedAt: now,
        reviewedById: null,
        reviewedAt: null,
        rejectedById: null,
        rejectedAt: null,
        rejectionReason: null,
      },
      include: { lines: true },
    });

    const submitAccounts = await this.prisma.account.findMany({
      where: {
        tenantId: authz.tenantId,
        id: { in: [...new Set(submitted.lines.map((l) => l.accountId))] },
      },
      select: { id: true, code: true },
    });
    const submitAccountCodeById = new Map(
      submitAccounts.map((a) => [a.id, a.code] as const),
    );

    const submitRisk = this.computeJournalRisk({
      journal: {
        id: submitted.id,
        journalType: (submitted as any).journalType ?? null,
        journalDate: new Date(submitted.journalDate),
        createdAt: new Date(submitted.createdAt),
        correctsJournalId: (submitted as any).correctsJournalId ?? null,
        reversalOfId: (submitted as any).reversalOfId ?? null,
        reference: (submitted as any).reference ?? null,
        returnReason: (submitted as any).returnReason ?? null,
      },
      lines: (submitted.lines ?? []).map((l) => ({
        debit: (l as any).debit,
        credit: (l as any).credit,
        account: { code: submitAccountCodeById.get(l.accountId) ?? null },
      })),
      stage: 'SUBMIT',
      computedAt: now,
      postingPeriod: null,
      budget:
        budgetImpact.budgetStatus === 'WARN'
          ? {
              budgetStatus: 'WARN',
              warnRepeatUpliftPoints: (
                await this.getBudgetRepeatWarnUplift({
                  tenantId: authz.tenantId,
                  createdById: entry.createdById,
                  excludeJournalId: entry.id,
                  now,
                })
              ).points,
            }
          : { budgetStatus: budgetImpact.budgetStatus },
    });

    await this.persistJournalRisk({
      tenantId: authz.tenantId,
      journalId: submitted.id,
      computedAt: now,
      score: submitRisk.score,
      flags: submitRisk.flags,
      stage: 'SUBMIT',
      userId: authz.realUserId,
      permissionUsed: PERMISSIONS.GL.CREATE,
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.GL_JOURNAL_SUBMITTED,
        entityType: AuditEntityType.JOURNAL_ENTRY,
        entityId: submitted.id,
        actorUserId: authz.realUserId,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_GL_CREATE',
        permissionUsed: PERMISSIONS.GL.CREATE,
        lifecycleType: 'SUBMIT',
        metadata: {
          journalId: submitted.id,
          realUserId: authz.realUserId,
          actorUserId: authz.actorUserId,
          delegationId: authz.delegationId ?? null,
        },
      },
      this.prisma,
    );

    return submitted;
  }

  async reviewJournal(req: Request, id: string) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, 'FINANCE_GL_APPROVE');

    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, tenantId: authz.tenantId },
      include: { lines: true },
    });
    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    if (entry.status !== 'SUBMITTED') {
      throw new BadRequestException(
        `Journal entry cannot be reviewed from status: ${entry.status}`,
      );
    }

    await this.assertJournalSoD({
      req,
      authz,
      actionType: 'REVIEW',
      soDAction: 'GL_JOURNAL_REVIEW',
      entry: {
        id: entry.id,
        createdById: entry.createdById,
        submittedById: (entry as any).submittedById ?? null,
        reviewedById: (entry as any).reviewedById ?? null,
        reversalInitiatedById: (entry as any).reversalInitiatedById ?? null,
      },
      permissionUsed: PERMISSIONS.GL.APPROVE,
    });

    if (!entry.submittedById || !entry.submittedAt) {
      throw new BadRequestException({
        error: 'Corrupted workflow state',
        message:
          'Submitted journal is missing submission metadata (submittedById/submittedAt).',
      });
    }

    if (entry.reviewedById || entry.reviewedAt) {
      throw new BadRequestException({
        error: 'Corrupted workflow state',
        message:
          'Submitted journal has review metadata already set (reviewedById/reviewedAt).',
      });
    }

    const reversalInitiatorId =
      entry.journalType === 'REVERSING'
        ? ((entry as any).reversalInitiatedById ?? null)
        : null;

    void reversalInitiatorId;

    const journalDate = new Date(entry.journalDate);
    if (Number.isNaN(journalDate.getTime())) {
      throw new BadRequestException('Invalid journalDate');
    }
    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: authz.tenantId,
        startDate: { lte: journalDate },
        endDate: { gte: journalDate },
      },
      select: { id: true, status: true },
    });
    if (!period) {
      throw new BadRequestException(
        'Journal date is not within an open accounting period. Please choose a date in an open period.',
      );
    }
    assertPeriodAllowsPosting({
      req,
      period,
      permissionUsed: PERMISSIONS.GL.APPROVE,
    });

    const now = new Date();

    const budgetImpact = await this.computeJournalBudgetImpact({
      req,
      tenantId: authz.tenantId,
      entry: {
        id: entry.id,
        journalDate,
        createdById: entry.createdById,
        budgetOverrideJustification:
          (entry as any).budgetOverrideJustification ?? null,
      },
      lines: (entry.lines ?? []).map((l) => ({
        id: l.id,
        lineNumber: (l as any).lineNumber ?? null,
        accountId: (l as any).accountId,
        debit: (l as any).debit,
        credit: (l as any).credit,
        legalEntityId: (l as any).legalEntityId ?? null,
        departmentId: (l as any).departmentId ?? null,
        projectId: (l as any).projectId ?? null,
        fundId: (l as any).fundId ?? null,
      })),
      stage: 'REVIEW',
      computedAt: now,
      permissionUsed: PERMISSIONS.GL.APPROVE,
    });

    await this.persistJournalBudgetImpact({
      tenantId: authz.tenantId,
      journalId: entry.id,
      computedAt: now,
      budgetStatus: budgetImpact.budgetStatus,
      budgetFlags: budgetImpact.budgetFlags,
    });

    await this.auditJournalBudgetEvaluated({
      tenantId: authz.tenantId,
      journalId: entry.id,
      userId: authz.actorUserId,
      permissionUsed: PERMISSIONS.GL.APPROVE,
      stage: 'REVIEW',
      computedAt: now,
      budgetStatus: budgetImpact.budgetStatus,
      budgetFlags: budgetImpact.budgetFlags,
    });

    if (budgetImpact.budgetStatus === 'BLOCK') {
      throw new ConflictException({
        code: 'BUDGET_BLOCKED',
        stage: 'REVIEW',
        message: 'Journal exceeds available budget for one or more lines.',
        budgetFlags: budgetImpact.budgetFlags,
      });
    }

    if (budgetImpact.budgetStatus === 'WARN') {
      const justification = String(
        (entry as any).budgetOverrideJustification ?? '',
      ).trim();
      if (!justification) {
        throw new BadRequestException({
          code: 'BUDGET_JUSTIFICATION_REQUIRED',
          stage: 'REVIEW',
          message:
            'Budget exception justification is required to review this journal.',
        });
      }
    }
    const reviewed = await withGlLifecycleBypass(() =>
      this.prisma.journalEntry.update({
        where: { id: entry.id },
        data: {
          status: 'REVIEWED',
          reviewedById: authz.actorUserId,
          reviewedAt: now,
          reviewMode: JournalReviewMode.MANUAL_REVIEW,
        },
        include: { lines: true },
      }),
    );

    const reviewAccounts = await this.prisma.account.findMany({
      where: {
        tenantId: authz.tenantId,
        id: { in: [...new Set(reviewed.lines.map((l) => l.accountId))] },
      },
      select: { id: true, code: true },
    });
    const reviewAccountCodeById = new Map(
      reviewAccounts.map((a) => [a.id, a.code] as const),
    );

    const reviewRisk = this.computeJournalRisk({
      journal: {
        id: reviewed.id,
        journalType: (reviewed as any).journalType ?? null,
        journalDate: new Date(reviewed.journalDate),
        createdAt: new Date(reviewed.createdAt),
        correctsJournalId: (reviewed as any).correctsJournalId ?? null,
        reversalOfId: (reviewed as any).reversalOfId ?? null,
        reference: (reviewed as any).reference ?? null,
        returnReason: (reviewed as any).returnReason ?? null,
      },
      lines: (reviewed.lines ?? []).map((l) => ({
        debit: (l as any).debit,
        credit: (l as any).credit,
        account: { code: reviewAccountCodeById.get(l.accountId) ?? null },
      })),
      stage: 'REVIEW',
      computedAt: now,
      postingPeriod: null,
      budget:
        budgetImpact.budgetStatus === 'WARN'
          ? {
              budgetStatus: 'WARN',
              warnRepeatUpliftPoints: (
                await this.getBudgetRepeatWarnUplift({
                  tenantId: authz.tenantId,
                  createdById: entry.createdById,
                  excludeJournalId: entry.id,
                  now,
                })
              ).points,
            }
          : { budgetStatus: budgetImpact.budgetStatus },
    });

    await this.persistJournalRisk({
      tenantId: authz.tenantId,
      journalId: reviewed.id,
      computedAt: now,
      score: reviewRisk.score,
      flags: reviewRisk.flags,
      stage: 'REVIEW',
      userId: authz.actorUserId,
      permissionUsed: PERMISSIONS.GL.APPROVE,
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.GL_JOURNAL_REVIEWED,
        entityType: AuditEntityType.JOURNAL_ENTRY,
        entityId: reviewed.id,
        actorUserId: authz.actorUserId,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_GL_APPROVE',
        permissionUsed: PERMISSIONS.GL.APPROVE,
        lifecycleType: 'REVIEW',
        metadata: {
          journalId: reviewed.id,
          realUserId: authz.realUserId,
          actorUserId: authz.actorUserId,
          delegationId: authz.delegationId ?? null,
        },
      },
      this.prisma,
    );

    if (reviewed.journalType === 'REVERSING') {
      await writeAuditEventWithPrisma(
        {
          tenantId: authz.tenantId,
          eventType: AuditEventType.GL_JOURNAL_REVERSAL_APPROVED,
          entityType: AuditEntityType.JOURNAL_ENTRY,
          entityId: reviewed.id,
          actorUserId: authz.actorUserId,
          timestamp: new Date(),
          outcome: 'SUCCESS' as any,
          action: 'FINANCE_GL_APPROVE',
          permissionUsed: PERMISSIONS.GL.APPROVE,
          lifecycleType: 'REVIEW',
          metadata: {
            reversalJournalId: reviewed.id,
            reversalOfId: (reviewed as any).reversalOfId ?? null,
            reviewedById: authz.actorUserId,
            reviewedAt: now.toISOString(),
            realUserId: authz.realUserId,
            actorUserId: authz.actorUserId,
            delegationId: authz.delegationId ?? null,
          },
        },
        this.prisma,
      );
    }

    return reviewed;
  }

  async rejectJournal(req: Request, id: string, dto: { reason?: string }) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, 'FINANCE_GL_APPROVE');

    const reason = (dto?.reason ?? '').trim();
    if (!reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, tenantId: authz.tenantId },
      include: { lines: true },
    });
    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    if (entry.status !== 'SUBMITTED') {
      throw new BadRequestException(
        `Journal entry cannot be rejected from status: ${entry.status}`,
      );
    }

    await this.assertJournalSoD({
      req,
      authz,
      actionType: 'REJECT',
      soDAction: 'GL_JOURNAL_REJECT',
      entry: {
        id: entry.id,
        createdById: entry.createdById,
        submittedById: (entry as any).submittedById ?? null,
        reviewedById: (entry as any).reviewedById ?? null,
        reversalInitiatedById: (entry as any).reversalInitiatedById ?? null,
      },
      permissionUsed: PERMISSIONS.GL.APPROVE,
    });

    if (!entry.submittedById || !entry.submittedAt) {
      throw new BadRequestException({
        error: 'Corrupted workflow state',
        message:
          'Submitted journal is missing submission metadata (submittedById/submittedAt).',
      });
    }

    const reversalInitiatorId =
      entry.journalType === 'REVERSING'
        ? ((entry as any).reversalInitiatedById ?? null)
        : null;

    void reversalInitiatorId;

    const now = new Date();
    const updated = await this.prisma.journalEntry.update({
      where: { id: entry.id },
      data: {
        status: 'REJECTED',
        rejectedById: authz.actorUserId,
        rejectedAt: now,
        rejectionReason: reason,
        reviewedById: null,
        reviewedAt: null,
      },
      include: { lines: true },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.GL_JOURNAL_REJECTED,
        entityType: AuditEntityType.JOURNAL_ENTRY,
        entityId: updated.id,
        actorUserId: authz.actorUserId,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_GL_APPROVE',
        permissionUsed: PERMISSIONS.GL.APPROVE,
        lifecycleType: 'REJECT',
        reason,
        metadata: {
          journalId: updated.id,
          realUserId: authz.realUserId,
          actorUserId: authz.actorUserId,
          delegationId: authz.delegationId ?? null,
        },
      },
      this.prisma,
    );
    return updated;
  }

  async reversePostedJournal(req: Request, id: string, dto: ReverseJournalDto) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, 'FINANCE_GL_FINAL_POST');

    const original = await this.prisma.journalEntry.findFirst({
      where: { id, tenantId: authz.tenantId },
      include: {
        lines: true,
        reversedBy: { select: { id: true, status: true } },
      },
    });
    if (!original) {
      throw new NotFoundException('Journal entry not found');
    }
    if (original.status !== 'POSTED') {
      throw new BadRequestException('Only POSTED journals can be reversed');
    }

    await this.assertJournalSoD({
      req,
      authz,
      actionType: 'REVERSE',
      soDAction: 'GL_JOURNAL_REVERSE',
      entry: {
        id: original.id,
        createdById: original.createdById,
        submittedById: (original as any).submittedById ?? null,
        reviewedById: (original as any).reviewedById ?? null,
        reversalInitiatedById: (original as any).reversalInitiatedById ?? null,
      },
      permissionUsed: PERMISSIONS.GL.FINAL_POST,
    });

    const existingReversal =
      (original as any).reversedBy?.find(
        (j: any) => j && j.status !== 'REJECTED',
      ) ?? null;
    if (existingReversal) {
      throw new BadRequestException(
        'This journal already has a reversal journal.',
      );
    }

    const suggestedDate = dto.journalDate
      ? new Date(dto.journalDate)
      : new Date(original.journalDate);
    if (Number.isNaN(suggestedDate.getTime())) {
      throw new BadRequestException('Invalid journalDate');
    }

    const cutover = await this.getCutoverDateIfLocked({
      tenantId: authz.tenantId,
    });
    if (cutover && suggestedDate < cutover) {
      throw new ForbiddenException({
        error: 'Reversal blocked by cutover lock',
        reason: `Reversal dated before cutover is not allowed (cutover: ${cutover.toISOString().slice(0, 10)})`,
      });
    }

    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: authz.tenantId,
        startDate: { lte: suggestedDate },
        endDate: { gte: suggestedDate },
      },
      select: {
        id: true,
        status: true,
        name: true,
        startDate: true,
        endDate: true,
      },
    });

    let reversalDate = suggestedDate;
    const resolveNextAllowedPostingPeriodStartDate = async (
      fromDate: Date,
    ): Promise<Date | null> => {
      const candidates = await this.prisma.accountingPeriod.findMany({
        where: {
          tenantId: authz.tenantId,
          endDate: { gte: fromDate },
        },
        orderBy: { startDate: 'asc' },
        select: {
          id: true,
          status: true,
          name: true,
          startDate: true,
        },
      });

      for (const p of candidates) {
        if (p.startDate < fromDate) continue;
        try {
          assertPeriodAllowsPosting({
            req,
            period: p,
            permissionUsed: PERMISSIONS.GL.FINAL_POST,
          });
          return p.startDate;
        } catch {
          // keep scanning
        }
      }

      return null;
    };
    if (!period) {
      const nextAllowed = await resolveNextAllowedPostingPeriodStartDate(
        suggestedDate,
      );
      if (!nextAllowed) {
        throw new ForbiddenException({
          error: 'Reversal blocked by accounting period control',
          reason:
            'No accounting period allows posting for the reversal date or after it',
        });
      }
      reversalDate = nextAllowed;
    } else {
      try {
        assertPeriodAllowsPosting({
          req,
          period,
          permissionUsed: PERMISSIONS.GL.FINAL_POST,
        });
      } catch {
        const nextAllowed = await resolveNextAllowedPostingPeriodStartDate(
          suggestedDate,
        );
        if (!nextAllowed) {
          throw new ForbiddenException({
            error: 'Reversal blocked by accounting period control',
            reason:
              'No accounting period allows posting for the reversal date or after it',
          });
        }
        reversalDate = nextAllowed;
      }
    }

    const effectivePeriod = await (this.prisma.accountingPeriod as any).findFirst({
      where: {
        tenantId: authz.tenantId,
        startDate: { lte: reversalDate },
        endDate: { gte: reversalDate },
      },
      select: { id: true, status: true, name: true, type: true },
    });
    if (!effectivePeriod) {
      throw new BadRequestException(
        'Journal date is not within an open accounting period. Please choose a date in an open period.',
      );
    }
    try {
      assertPeriodAllowsPosting({
        req,
        period: effectivePeriod,
        permissionUsed: PERMISSIONS.GL.FINAL_POST,
      });
    } catch {
      const nextAllowed = await resolveNextAllowedPostingPeriodStartDate(
        reversalDate,
      );
      if (!nextAllowed) {
        throw new BadRequestException(
          'Journal date is not within an open accounting period. Please choose a date in an open period.',
        );
      }
      reversalDate = nextAllowed;
    }

    if ((effectivePeriod as GlScopedProps).type === 'OPENING') {
      await this.assertOpeningBalanceAccountsAllowed({
        tenantId: authz.tenantId,
        lines: original.lines.map((l) => ({
          accountId: l.accountId,
          debit: Number(l.debit),
          credit: Number(l.credit),
        })),
      });
    }

    const accountIds = [
      ...new Set(original.lines.map((l) => l.accountId).filter(Boolean)),
    ] as string[];
    const projectIds = [
      ...new Set(
        original.lines.map((l) => (l as any).projectId).filter(Boolean),
      ),
    ] as string[];

    const [accounts, projects] = await Promise.all([
      (this.prisma.account.findMany({
        where: { tenantId: authz.tenantId, id: { in: accountIds } },
        select: {
          id: true,
          code: true,
          type: true,
          isControlAccount: true,
          isCashEquivalent: true,
          isIntercompanyAccount: true,
          intercompanyEnabled: true,
          intercompanyRole: true,
          requiresDepartment: true,
          requiresProject: true,
          requiresFund: true,
        } as any,
      }) as any) as Promise<any[]>,
      projectIds.length
        ? this.prisma.project.findMany({
            where: { tenantId: authz.tenantId, id: { in: projectIds } },
            select: { id: true, isRestricted: true },
          })
        : Promise.resolve([]),
    ]);
    const accountById = new Map<string, any>((accounts as any[]).map((a) => [a.id, a] as const));
    const projectById = new Map(
      (projects as any[]).map((p) => [p.id, p] as const),
    );

    const reversalLines = original.lines.map((l) => {
      const legalEntityId = (l as any).legalEntityId ?? null;
      const departmentId = (l as any).departmentId ?? null;
      const projectId = (l as any).projectId ?? null;
      const fundId = (l as any).fundId ?? null;

      const account = accountById.get(l.accountId);
      const departmentRequirement = account
        ? this.getDepartmentRequirement(account)
        : DepartmentRequirement.REQUIRED;

      const selectedProject = projectId
        ? projectById.get(projectId)
        : undefined;
      const isRestrictedProject = Boolean(selectedProject?.isRestricted);

      const legalEntityRequired = true;
      const fundRequired =
        Boolean(account?.requiresFund) || isRestrictedProject;
      const projectRequired = Boolean(account?.requiresProject) || fundRequired;

      const missingRequiredDimension =
        (legalEntityRequired && !legalEntityId) ||
        (departmentRequirement === DepartmentRequirement.REQUIRED &&
          !departmentId) ||
        (projectRequired && !projectId) ||
        (fundRequired && !fundId);

      if (missingRequiredDimension) {
        throw new ConflictException({
          code: 'LEGACY_JOURNAL_MISSING_DIMENSIONS',
          message:
            'This journal was posted before dimension enforcement. It cannot be reversed automatically. A correcting journal is required.',
        });
      }

      return {
        accountId: l.accountId,
        lineNumber: l.lineNumber ?? undefined,
        description: l.description ?? undefined,
        legalEntityId,
        departmentId,
        projectId,
        fundId,
        debit: Number(l.credit),
        credit: Number(l.debit),
      };
    });

    this.assertBalanced(
      reversalLines.map((l) => ({
        debit: Number(l.debit),
        credit: Number(l.credit),
      })),
    );

    assertJournalTypePolicy({
      req,
      tenantId: authz.tenantId,
      actorUserId: authz.realUserId,
      permissionUsed: PERMISSIONS.GL.FINAL_POST,
      mode: 'REVERSE',
      journalDate: reversalDate,
      prismaJournalType: 'REVERSING',
      periodType: (effectivePeriod as any)?.type ?? null,
      reversalOfId: original.id,
      reference:
        dto.reference ??
        (original.journalNumber
          ? `REVERSAL_OF:${original.journalNumber}`
          : `REVERSAL_OF:${original.id}`),
      description:
        dto.description ??
        (original.description
          ? `Reversal: ${original.description}`
          : 'Reversal journal'),
      sourceType: null,
      sourceId: null,
      lines: reversalLines.map((l) => ({
        accountId: String((l as any).accountId),
        legalEntityId: (l as any).legalEntityId ?? null,
        departmentId: (l as any).departmentId ?? null,
        projectId: (l as any).projectId ?? null,
        fundId: (l as any).fundId ?? null,
      })),
    });

    assertCombinationGovernance({
      req,
      tenantId: authz.tenantId,
      actorUserId: authz.realUserId,
      permissionUsed: PERMISSIONS.GL.FINAL_POST,
      mode: 'REVERSE',
      module: 'GL',
      journalDate: reversalDate,
      prismaJournalType: 'REVERSING',
      periodType: (effectivePeriod as any)?.type ?? null,
      reversalOfId: original.id,
      reference:
        dto.reference ??
        (original.journalNumber
          ? `REVERSAL_OF:${original.journalNumber}`
          : `REVERSAL_OF:${original.id}`),
      description:
        dto.description ??
        (original.description
          ? `Reversal: ${original.description}`
          : 'Reversal journal'),
      sourceType: null,
      sourceId: null,
      lines: reversalLines.map((l) => {
        const accountId = String((l as any).accountId);
        const acc = accountById.get(accountId);
        return {
          lineNumber: (l as any).lineNumber ?? null,
          accountId,
          accountCode: (acc as any)?.code ?? null,
          accountType: (acc as any)?.type ?? null,
          isControlAccount: Boolean((acc as any)?.isControlAccount),
          isCashEquivalent: Boolean((acc as any)?.isCashEquivalent),
          requiresDepartment: Boolean((acc as any)?.requiresDepartment),
          requiresProject: Boolean((acc as any)?.requiresProject),
          requiresFund: Boolean((acc as any)?.requiresFund),
          debit: Number((l as any).debit ?? 0),
          credit: Number((l as any).credit ?? 0),
          legalEntityId: (l as any).legalEntityId ?? null,
          departmentId: (l as any).departmentId ?? null,
          projectId: (l as any).projectId ?? null,
          fundId: (l as any).fundId ?? null,
        };
      }),
    });

    const reversalIntercompanyActions = new Set<string>();
    const anyIntercompanyAccount = reversalLines.some((l: any) => {
      const acc = accountById.get(String(l.accountId));
      return Boolean((acc as any)?.intercompanyEnabled) && Boolean((acc as any)?.isIntercompanyAccount);
    });
    if (anyIntercompanyAccount) reversalIntercompanyActions.add('INTERCOMPANY_BALANCE_VIOLATION');

    assertIntercompanyGovernance({
      req,
      tenantId: authz.tenantId,
      actorUserId: authz.realUserId,
      permissionUsed: PERMISSIONS.GL.FINAL_POST,
      mode: 'REVERSE',
      entityType: 'JOURNAL_ENTRY',
      entityId: original.id,
      journalType: 'REVERSING',
      reference:
        dto.reference ??
        (original.journalNumber
          ? `REVERSAL_OF:${original.journalNumber}`
          : `REVERSAL_OF:${original.id}`),
      governanceActions: Array.from(reversalIntercompanyActions) as any,
      escalation: (req as any)?.governanceEscalation ?? null,
      justificationText:
        String(req.header('x-governance-reason') ?? '').trim() || null,
      actorLegalEntityAccess: await this.loadActorLegalEntityAccess({
        tenantId: authz.tenantId,
        actorUserId: authz.realUserId,
      }),
      lines: reversalLines.map((l: any) => {
        const accountId = String(l.accountId);
        const acc = accountById.get(accountId);
        return {
          lineNumber: l.lineNumber ?? null,
          legalEntityId: l.legalEntityId ?? null,
          debit: Number(l.debit ?? 0),
          credit: Number(l.credit ?? 0),
          account: {
            accountId,
            accountCode: (acc as any)?.code ?? null,
            isIntercompanyAccount: (acc as any)?.isIntercompanyAccount ?? null,
            intercompanyEnabled: (acc as any)?.intercompanyEnabled ?? null,
            intercompanyRole: (acc as any)?.intercompanyRole ?? null,
          },
        };
      }),
    });

    const reason = (dto?.reason ?? '').trim();
    if (!reason) {
      throw new BadRequestException('Reversal reason is required');
    }

    const now = new Date();

    const created = await this.prisma.journalEntry.create({
      data: {
        tenantId: authz.tenantId,
        journalDate: reversalDate,
        journalType: 'REVERSING',
        intent: 'REVERSAL' as any,
        intentNotes: String((dto as any)?.reason ?? '').trim() || null,
        intentReference: original.journalNumber ? String(original.journalNumber) : original.id,
        reference:
          dto.reference ??
          (original.journalNumber
            ? `REVERSAL_OF:${original.journalNumber}`
            : `REVERSAL_OF:${original.id}`),
        description:
          dto.description ??
          (original.description
            ? `Reversal: ${original.description}`
            : 'Reversal journal'),
        // Ownership: reversal draft is owned by the original preparer; controller remains the initiator.
        createdById: original.createdById,
        reversalInitiatedById: authz.id,
        reversalInitiatedAt: now,
        reversalOfId: original.id,
        reversalReason: reason,
        lines: { create: reversalLines },
      },
      include: { lines: true },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.GL_JOURNAL_REVERSAL_ASSIGNED,
        entityType: AuditEntityType.JOURNAL_ENTRY,
        entityId: created.id,
        actorUserId: authz.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_GL_FINAL_POST',
        permissionUsed: PERMISSIONS.GL.FINAL_POST,
        lifecycleType: 'ASSIGN_REVERSAL',
        metadata: {
          originalJournalId: original.id,
          initiatedById: authz.id,
          preparedById: original.createdById,
          assignedAt: now.toISOString(),
        },
      },
      this.prisma,
    );

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.GL_JOURNAL_REVERSED,
        entityType: AuditEntityType.JOURNAL_ENTRY,
        entityId: created.id,
        actorUserId: authz.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_GL_FINAL_POST',
        permissionUsed: PERMISSIONS.GL.FINAL_POST,
        lifecycleType: 'REVERSE',
        reason,
        metadata: {
          originalJournalId: original.id,
          reversalJournalId: created.id,
        },
      },
      this.prisma,
    );

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.GL_JOURNAL_REVERSAL_INITIATED,
        entityType: AuditEntityType.JOURNAL_ENTRY,
        entityId: created.id,
        actorUserId: authz.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_GL_FINAL_POST',
        permissionUsed: PERMISSIONS.GL.FINAL_POST,
        lifecycleType: 'INITIATE_REVERSAL',
        metadata: {
          reversalJournalId: created.id,
          reversalOfId: original.id,
          reversalReason: reason,
          reversalInitiatedById: authz.id,
          reversalInitiatedAt: now.toISOString(),
          reversalDate: reversalDate.toISOString(),
        },
      },
      this.prisma,
    );

    return created;
  }

  async postJournal(req: Request, id: string) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, 'FINANCE_GL_FINAL_POST');

    return this.postJournalCore({
      prisma: this.prisma,
      req,
      authz,
      id,
    });
  }

  async postJournalOverride(
    req: Request,
    id: string,
    dto: { overrideSessionId?: string },
  ) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, PERMISSIONS.GL.OVERRIDE_POST);

    const overrideSessionId = String(dto?.overrideSessionId ?? '').trim();
    if (!overrideSessionId) {
      throw new BadRequestException('overrideSessionId is required');
    }

    const session = await this.overrideSessions.assertActiveApproved({
      tenantId: authz.tenantId,
      sessionId: overrideSessionId,
    });

    if (String((session as any).overrideCode ?? '') !== 'GL_POST_OVERRIDE') {
      throw new BadRequestException('Override session is not valid for GL override posting');
    }

    const sessionReason = String((session as any).reason ?? '').trim();
    const sessionJustification = String((session as any).justification ?? '').trim();
    if (sessionReason.length < 3) {
      throw new BadRequestException('Override session is missing a reason');
    }
    if (sessionJustification.length < 3) {
      throw new BadRequestException('Override session is missing a justification');
    }

    const escalationType = String((session as any).escalationType ?? '').trim();
    const escalationReason = String((session as any).escalationReason ?? '').trim();
    const overrideEscalation = escalationType
      ? { type: escalationType, reason: escalationReason || sessionReason }
      : { type: 'MODULE_OVERRIDE', reason: sessionReason };

    if (!(req as any).governanceEscalation) {
      (req as any).governanceEscalation = overrideEscalation;
    }

    return this.postJournalCore({
      prisma: this.prisma,
      req,
      authz,
      id,
      override: {
        reason: sessionReason,
        justification: sessionJustification,
        overrideSessionId,
        escalation: overrideEscalation,
        permissionUsed: PERMISSIONS.GL.OVERRIDE_POST,
      },
    });
  }

  async postJournalInTx(params: {
    tx: any;
    req: Request;
    id: string;
  }) {
    const authz = await this.getUserAuthz(params.req);
    requirePermission(authz, 'FINANCE_GL_FINAL_POST');

    return this.postJournalCore({
      prisma: params.tx,
      req: params.req,
      authz,
      id: params.id,
    });
  }

  private async postJournalCore(params: {
    prisma: any;
    req: Request;
    authz: any;
    id: string;
    override?: {
      reason: string;
      justification?: string;
      overrideSessionId?: string;
      escalation?: { type?: string; reason?: string };
      permissionUsed: string;
    };
  }) {
    const { prisma, req, authz, id } = params;

    const entry = await prisma.journalEntry.findFirst({
      where: {
        id,
        tenantId: authz.tenantId,
      },
      include: { lines: true },
    });

    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    if (entry.status === 'POSTED') {
      throw new BadRequestException('Journal entry is already posted');
    }

    if (entry.status !== 'REVIEWED') {
      throw new BadRequestException(
        `Journal entry cannot be posted from status: ${entry.status}`,
      );
    }

    const evidenceLinks = await (prisma as any).auditEvidenceLink.findMany({
      where: {
        tenantId: authz.tenantId,
        entityType: 'JOURNAL_ENTRY',
        entityId: entry.id,
      },
      select: {
        evidence: {
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            size: true,
            evidenceCategory: true,
          },
        },
      },
    });
    const attachments = (evidenceLinks ?? []).map((l: any) => l.evidence);

    const escalation = (req as any)?.governanceEscalation as
      | { type?: string; reason?: string }
      | undefined;

    const policyType = resolveJournalPolicyType({
      prismaJournalType: entry.journalType,
      periodType: null,
      reversalOfId: (entry as any).reversalOfId ?? null,
      reference: (entry as any).reference ?? null,
      sourceType: (entry as any).sourceType ?? null,
    });
    const policy = getJournalTypePolicy(policyType);

    const governanceActions = new Set<string>();
    if (params.override) governanceActions.add('GL_JOURNAL_OVERRIDE_POST');
    if (escalation?.type === 'RETRO_POSTING_OVERRIDE') governanceActions.add('RETRO_POSTING_OVERRIDE');
    if (escalation?.type === 'PERIOD_SOFT_CLOSE_POST_OVERRIDE') governanceActions.add('PERIOD_SOFT_CLOSE_POST_OVERRIDE');
    if (policy.requiredEvidence?.required) governanceActions.add('JOURNAL_TYPE_EVIDENCE_REQUIRED');
    if (policyType === 'INTERCOMPANY_JOURNAL') governanceActions.add('INTERCOMPANY_BALANCE_VIOLATION');

    if (params.override?.overrideSessionId) {
      const session = await this.overrideSessions.assertActiveApproved({
        tenantId: authz.tenantId,
        sessionId: params.override.overrideSessionId,
      });

      assertOverrideGovernance({
        req,
        tenantId: authz.tenantId,
        actorUserId: authz.actorUserId,
        permissionUsed: params.override.permissionUsed,
        entryPoint: 'GL_JOURNAL_POST_OVERRIDE',
        overrideCode: 'GL_POST_OVERRIDE',
        reason: params.override.reason,
        justificationText: params.override.justification ?? null,
        escalation: escalation ?? null,
        attachments: (attachments ?? []).map((a: any) => ({
          id: String(a.id),
          evidenceCategory: (a as any).evidenceCategory ?? null,
          fileName: (a as any).fileName ?? null,
        })),
        actorRoleCodes: await this.loadActorRoleCodes({
          tenantId: authz.tenantId,
          actorUserId: authz.actorUserId,
        }),
        approval: {
          status: String((session as any).status) === 'APPROVED' ? 'APPROVED' : 'PENDING',
          approvedById: (session as any).approvedById ?? null,
          approvedAt: (session as any).approvedAt ?? null,
        },
        overrideSession: {
          id: (session as any).id,
          overrideCode: 'GL_POST_OVERRIDE',
          tenantId: authz.tenantId,
          actorUserId: authz.actorUserId,
          governanceDomain: 'FINANCIAL_GOVERNANCE',
          severity: 'CRITICAL',
          reason: String((session as any).reason ?? ''),
          justification: String((session as any).justification ?? ''),
          status: String((session as any).status) as any,
          createdAt: (session as any).createdAt,
          expiresAt: (session as any).expiresAt,
          escalation: escalation ?? null,
          approval: {
            status: String((session as any).status) === 'APPROVED' ? 'APPROVED' : 'PENDING',
            approvedById: (session as any).approvedById ?? null,
            approvedAt: (session as any).approvedAt ?? null,
          },
          evidence: null,
        },
      });
    }

    assertEvidenceGovernance({
      req,
      tenantId: authz.tenantId,
      actorUserId: authz.actorUserId,
      permissionUsed: params.override?.permissionUsed ?? PERMISSIONS.GL.FINAL_POST,
      mode: params.override ? 'JOURNAL_POST_OVERRIDE' : 'JOURNAL_POST',
      entityType: 'JOURNAL_ENTRY',
      entityId: entry.id,
      journalType: String(entry.journalType ?? ''),
      governanceActions: Array.from(governanceActions) as any,
      escalation: escalation ?? null,
      justificationText: params.override?.justification ?? params.override?.reason ?? null,
      attachments,
    });

    const icAccountIds = [
      ...new Set((entry.lines ?? []).map((l: any) => l.accountId).filter(Boolean)),
    ] as string[];
    const icAccounts: any[] = icAccountIds.length
      ? await prisma.account.findMany({
          where: { tenantId: authz.tenantId, id: { in: icAccountIds } },
          select: {
            id: true,
            code: true,
            isIntercompanyAccount: true,
            intercompanyEnabled: true,
            intercompanyRole: true,
          },
        })
      : [];
    const icAccountById = new Map<string, any>(
      (icAccounts ?? []).map((a: any) => [a.id, a] as const),
    );

    assertIntercompanyGovernance({
      req,
      tenantId: authz.tenantId,
      actorUserId: authz.actorUserId,
      permissionUsed: params.override?.permissionUsed ?? PERMISSIONS.GL.FINAL_POST,
      mode: 'POST',
      entityType: 'JOURNAL_ENTRY',
      entityId: entry.id,
      journalType: String(entry.journalType ?? ''),
      reference: (entry as any).reference ?? null,
      governanceActions: Array.from(governanceActions) as any,
      escalation: escalation ?? null,
      justificationText: params.override?.reason ?? null,
      actorLegalEntityAccess: await this.loadActorLegalEntityAccess({
        tenantId: authz.tenantId,
        actorUserId: authz.actorUserId,
      }),
      lines: (entry.lines ?? []).map((l: any) => {
        const acc = icAccountById.get(l.accountId);
        return {
          lineNumber: l.lineNumber ?? null,
          legalEntityId: l.legalEntityId ?? null,
          debit: Number(l.debit ?? 0),
          credit: Number(l.credit ?? 0),
          account: {
            accountId: l.accountId,
            accountCode: (acc as any)?.code ?? null,
            isIntercompanyAccount: (acc as any)?.isIntercompanyAccount ?? null,
            intercompanyEnabled: (acc as any)?.intercompanyEnabled ?? null,
            intercompanyRole: (acc as any)?.intercompanyRole ?? null,
          },
        };
      }),
    });

    const isReversal =
      entry.journalType === 'REVERSING' && !!(entry as any).reversalOfId;
    const reversalInitiatorId = isReversal
      ? ((entry as any).reversalInitiatedById ?? entry.createdById ?? null)
      : null;

    try {
      await this.assertJournalSoD({
        req,
        authz,
        actionType: 'POST',
        soDAction: 'GL_JOURNAL_POST',
        entry: {
          id: entry.id,
          createdById: entry.createdById,
          submittedById: (entry as any).submittedById ?? null,
          reviewedById: (entry as any).reviewedById ?? null,
          reversalInitiatedById: reversalInitiatorId,
        },
        permissionUsed: PERMISSIONS.GL.FINAL_POST,
      });
    } catch (e: any) {
      if (!params.override) throw e;

      await writeAuditEventWithPrisma(
        {
          tenantId: authz.tenantId,
          eventType: AuditEventType.GL_JOURNAL_OVERRIDE_POSTED,
          entityType: AuditEntityType.JOURNAL_ENTRY,
          entityId: entry.id,
          actorUserId: authz.actorUserId,
          timestamp: new Date(),
          outcome: 'SUCCESS' as any,
          action: 'FINANCE_GL_FINAL_POST',
          permissionUsed: params.override.permissionUsed,
          lifecycleType: 'POST_OVERRIDE',
          reason: params.override.reason,
          metadata: {
            governance: buildGovernanceAuditMetadata({
              actionType: 'GL_JOURNAL_OVERRIDE_POST',
              permissionUsed: params.override.permissionUsed,
              actorUserId: authz.actorUserId,
              tenantId: authz.tenantId,
              req,
              changedKeys: ['status'],
              before: { status: entry.status },
              after: { status: 'POSTED' },
              escalation: (req as any)?.governanceEscalation ?? {
                type: 'MODULE_OVERRIDE',
                reason: params.override.reason,
              },
            }),
            journalId: entry.id,
            overrideSessionId: params.override.overrideSessionId ?? null,
            overrideReason: params.override.reason,
            realUserId: authz.realUserId,
            actorUserId: authz.actorUserId,
            delegationId: authz.delegationId ?? null,
          },
        },
        this.prisma,
      );
    }


    this.assertBalanced(
      entry.lines.map((l) => ({
        debit: Number(l.debit),
        credit: Number(l.credit),
      })),
    );

    const period = await (prisma.accountingPeriod as any).findFirst({
      where: {
        tenantId: authz.tenantId,
        startDate: { lte: entry.journalDate },
        endDate: { gte: entry.journalDate },
      },
      select: { id: true, status: true, name: true, endDate: true, type: true },
    });

    if (!period) {
      await writeAuditEventWithPrisma(
        {
          tenantId: authz.tenantId,
          eventType: AuditEventType.GL_JOURNAL_POST_BLOCKED,
          entityType: AuditEntityType.JOURNAL_ENTRY,
          entityId: entry.id,
          actorUserId: authz.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'FINANCE_GL_FINAL_POST',
          permissionUsed: PERMISSIONS.GL.FINAL_POST,
          lifecycleType: 'POST',
          reason: 'No accounting period exists for the journal date',
          metadata: {
            journalId: entry.id,
            periodId: null,
            periodName: null,
            periodStatus: null,
          },
        },
        prisma,
      );

      throw new ForbiddenException({
        error: 'Posting blocked by accounting period control',
        reason: 'No accounting period exists for the journal date',
      });
    }

    try {
      assertPeriodAllowsPosting({
        req: params.req,
        period,
        permissionUsed: PERMISSIONS.GL.FINAL_POST,
      });
    } catch {
      await writeAuditEventWithPrisma(
        {
          tenantId: authz.tenantId,
          eventType: AuditEventType.GL_JOURNAL_POST_BLOCKED,
          entityType: AuditEntityType.JOURNAL_ENTRY,
          entityId: entry.id,
          actorUserId: authz.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'FINANCE_GL_FINAL_POST',
          permissionUsed: PERMISSIONS.GL.FINAL_POST,
          lifecycleType: 'POST',
          reason: `Accounting period is not OPEN: ${period.name}`,
          metadata: {
            journalId: entry.id,
            periodId: (period as any)?.id ?? null,
            periodName: (period as any)?.name ?? null,
            periodStatus: (period as any)?.status ?? null,
          },
        },
        prisma,
      );

      throw new ForbiddenException({
        error: 'Posting blocked by accounting period control',
        reason: `Accounting period is not OPEN: ${period.name}`,
      });
    }

    const tenantControls = await (prisma.tenant as any).findUnique({
      where: { id: authz.tenantId },
      select: { retroPostToleranceDays: true },
    });
    const retroPostToleranceDays = Math.max(
      0,
      Math.floor(Number((tenantControls as any)?.retroPostToleranceDays ?? 0)),
    );

  const periodStatus = String((period as any)?.status ?? '').toUpperCase();

const periodAllowsNormalPosting =
  periodStatus === 'OPEN' || periodStatus === 'ACTIVE';

if (period && !periodAllowsNormalPosting) {
  assertRetroPostingWithinToleranceOrEscalated({
    req: params.req,
    postingDate: new Date(entry.journalDate),
    toleranceDays: retroPostToleranceDays,
    escalationType: 'RETRO_POSTING_OVERRIDE',
  });
}

    const entryPoint = params.override
      ? ('GL_JOURNAL_POST_OVERRIDE' as const)
      : ('GL_JOURNAL_POST' as const);

    const periodOverrideSessionId = String(
      (params.req as any)?.governanceOverrideSessionIdPeriod ?? '',
    ).trim();
    if (periodOverrideSessionId) {
      const policy = getOverridePolicy('PERIOD_SOFT_CLOSE_OVERRIDE');
      const session = await this.overrideSessions.assertActiveApproved({
        tenantId: authz.tenantId,
        sessionId: periodOverrideSessionId,
      });

      if (String((session as any).overrideCode ?? '') !== 'PERIOD_SOFT_CLOSE_OVERRIDE') {
        throw new BadRequestException(
          'Override session is not valid for SOFT_CLOSED period posting',
        );
      }

      const reason = String((params.req.header('x-governance-reason') ?? '') as any).trim();

      assertOverrideGovernance({
        req,
        tenantId: authz.tenantId,
        actorUserId: authz.actorUserId,
        permissionUsed: PERMISSIONS.GL.FINAL_POST,
        entryPoint,
        overrideCode: 'PERIOD_SOFT_CLOSE_OVERRIDE',
        reason,
        justificationText: reason,
        escalation: (params.req as any)?.governanceEscalation ?? null,
        attachments: (attachments ?? []).map((a: any) => ({
          id: String(a.id),
          evidenceCategory: (a as any).evidenceCategory ?? null,
          fileName: (a as any).fileName ?? null,
        })),
        actorRoleCodes: await this.loadActorRoleCodes({
          tenantId: authz.tenantId,
          actorUserId: authz.actorUserId,
        }),
        approval: {
          status: 'APPROVED',
          approvedById: (session as any).approvedById ?? null,
          approvedAt: (session as any).approvedAt ?? null,
        },
        overrideSession: {
          id: (session as any).id,
          overrideCode: 'PERIOD_SOFT_CLOSE_OVERRIDE',
          tenantId: authz.tenantId,
          actorUserId: authz.actorUserId,
          governanceDomain: policy.governanceDomain,
          severity: policy.severity,
          reason: String((session as any).reason ?? ''),
          justification: String((session as any).justification ?? ''),
          status: String((session as any).status) as any,
          createdAt: (session as any).createdAt,
          expiresAt: (session as any).expiresAt,
          escalation: (params.req as any)?.governanceEscalation ?? null,
          approval: {
            status: 'APPROVED',
            approvedById: (session as any).approvedById ?? null,
            approvedAt: (session as any).approvedAt ?? null,
          },
          evidence: null,
        },
      });
    }

    const retroOverrideSessionId = String(
      (params.req as any)?.governanceOverrideSessionIdRetro ?? '',
    ).trim();
    if (retroOverrideSessionId) {
      const policy = getOverridePolicy('RETRO_POSTING_OVERRIDE');
      const session = await this.overrideSessions.assertActiveApproved({
        tenantId: authz.tenantId,
        sessionId: retroOverrideSessionId,
      });

      if (String((session as any).overrideCode ?? '') !== 'RETRO_POSTING_OVERRIDE') {
        throw new BadRequestException('Override session is not valid for retro posting');
      }

      const reason = String((params.req.header('x-governance-reason') ?? '') as any).trim();

      assertOverrideGovernance({
        req,
        tenantId: authz.tenantId,
        actorUserId: authz.actorUserId,
        permissionUsed: PERMISSIONS.GL.FINAL_POST,
        entryPoint,
        overrideCode: 'RETRO_POSTING_OVERRIDE',
        reason,
        justificationText: reason,
        escalation: (params.req as any)?.governanceEscalation ?? null,
        attachments: (attachments ?? []).map((a: any) => ({
          id: String(a.id),
          evidenceCategory: (a as any).evidenceCategory ?? null,
          fileName: (a as any).fileName ?? null,
        })),
        actorRoleCodes: await this.loadActorRoleCodes({
          tenantId: authz.tenantId,
          actorUserId: authz.actorUserId,
        }),
        approval: {
          status: 'APPROVED',
          approvedById: (session as any).approvedById ?? null,
          approvedAt: (session as any).approvedAt ?? null,
        },
        overrideSession: {
          id: (session as any).id,
          overrideCode: 'RETRO_POSTING_OVERRIDE',
          tenantId: authz.tenantId,
          actorUserId: authz.actorUserId,
          governanceDomain: policy.governanceDomain,
          severity: policy.severity,
          reason: String((session as any).reason ?? ''),
          justification: String((session as any).justification ?? ''),
          status: String((session as any).status) as any,
          createdAt: (session as any).createdAt,
          expiresAt: (session as any).expiresAt,
          escalation: (params.req as any)?.governanceEscalation ?? null,
          approval: {
            status: 'APPROVED',
            approvedById: (session as any).approvedById ?? null,
            approvedAt: (session as any).approvedAt ?? null,
          },
          evidence: null,
        },
      });
    }

    if (period.type === 'OPENING') {
      await this.assertOpeningBalanceAccountsAllowed({
        tenantId: authz.tenantId,
        lines: entry.lines.map((l) => ({
          accountId: l.accountId,
          debit: Number(l.debit),
          credit: Number(l.credit),
        })),
      });
    }

    const cutover = await this.getCutoverDateIfLocked({
      tenantId: authz.tenantId,
    });
    if (cutover && entry.journalDate < cutover) {
      const cutoverReason = `Posting dated before cutover is not allowed (cutover: ${cutover.toISOString().slice(0, 10)})`;

      await writeAuditEventWithPrisma(
        {
          tenantId: authz.tenantId,
          eventType: AuditEventType.GL_JOURNAL_POST_BLOCKED,
          entityType: AuditEntityType.JOURNAL_ENTRY,
          entityId: entry.id,
          actorUserId: authz.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'FINANCE_GL_FINAL_POST',
          permissionUsed: PERMISSIONS.GL.FINAL_POST,
          lifecycleType: 'POST',
          reason: cutoverReason,
          metadata: {
            journalId: entry.id,
            cutoverDate: cutover.toISOString().slice(0, 10),
          },
        },
        prisma,
      );

      throw new ForbiddenException({
        error: 'Posting blocked by cutover lock',
        reason: cutoverReason,
      });
    }

    if (period.type === 'OPENING') {
      await this.assertOpeningBalanceAccountsAllowed({
        tenantId: authz.tenantId,
        lines: entry.lines.map((l) => ({
          accountId: l.accountId,
          debit: Number(l.debit),
          credit: Number(l.credit),
        })),
      });
    }

    const accountIds = [
      ...new Set((entry.lines ?? []).map((l) => String((l as any).accountId))),
    ] as string[];
    const accounts: any[] = await prisma.account.findMany({
      where: {
        tenantId: authz.tenantId,
        id: { in: accountIds },
      },
      select: {
        id: true,
        status: true,
        isActive: true,
        isPostingAllowed: true,
        isPosting: true,
        isControlAccount: true,
        requiresDepartment: true,
        requiresProject: true,
        requiresFund: true,
      } as any,
    });
    const byId = new Map<string, any>(accounts.map((a) => [a.id, a] as const));
    for (const accountId of accountIds) {
      const a = byId.get(accountId);
      if (!a) {
        throw new BadRequestException(`Account not found: ${accountId}`);
      }

      const lifecycleMsg = this.resolveLifecyclePostingBlockMessage(
        String(a.status ?? ''),
      );

      if (lifecycleMsg) {
        await writeAuditEventWithPrisma(
          {
            tenantId: authz.tenantId,
            eventType: AuditEventType.GL_JOURNAL_POST_BLOCKED,
            entityType: AuditEntityType.JOURNAL_ENTRY,
            entityId: entry.id,
            actorUserId: authz.id,
            timestamp: new Date(),
            outcome: 'BLOCKED' as any,
            action: 'FINANCE_GL_FINAL_POST',
            permissionUsed: PERMISSIONS.GL.FINAL_POST,
            lifecycleType: 'POST',
            reason: lifecycleMsg,
            metadata: {
              journalId: entry.id,
              accountId,
              accountStatus: String(a.status ?? null),
            },
          },
          prisma,
        );

        throw new ForbiddenException(lifecycleMsg);
      }

      this.assertAccountFlagsAllowPosting({
        id: String(accountId),
        isActive: Boolean((a as any).isActive),
        isPostingAllowed: Boolean((a as any).isPostingAllowed),
        isPosting: Boolean((a as any).isPosting),
        isControlAccount: Boolean((a as any).isControlAccount),
      });
    }

    for (const l of entry.lines) {
      const a = byId.get(l.accountId);
      if (!a) {
        throw new BadRequestException(`Account not found: ${l.accountId}`);
      }
      validateSegmentCompleteness(
        a as any,
        {
          accountId: String((l as any).accountId),
          lineNumber: (l as any).lineNumber ?? null,
          departmentId: (l as any).departmentId ?? null,
          projectId: (l as any).projectId ?? null,
          fundId: (l as any).fundId ?? null,
        },
        { errorMode: 'BAD_REQUEST', module: 'GL', transactionType: 'POST_JOURNAL' },
      );
    }

    const now = new Date();

    const budgetImpact = await this.computeJournalBudgetImpact({
      req: params.req,
      tenantId: authz.tenantId,
      entry: {
        id: entry.id,
        journalDate: new Date(entry.journalDate),
        createdById: entry.createdById,
        budgetOverrideJustification:
          (entry as any).budgetOverrideJustification ?? null,
      },
      lines: (entry.lines ?? []).map((l) => ({
        id: l.id,
        lineNumber: (l as any).lineNumber ?? null,
        accountId: (l as any).accountId,
        debit: (l as any).debit,
        credit: (l as any).credit,
        legalEntityId: (l as any).legalEntityId ?? null,
        departmentId: (l as any).departmentId ?? null,
        projectId: (l as any).projectId ?? null,
        fundId: (l as any).fundId ?? null,
      })),
      stage: 'POST',
      computedAt: now,
      permissionUsed: PERMISSIONS.GL.FINAL_POST,
    });

    await this.persistJournalBudgetImpact({
      tenantId: authz.tenantId,
      journalId: entry.id,
      computedAt: now,
      budgetStatus: budgetImpact.budgetStatus,
      budgetFlags: budgetImpact.budgetFlags,
    });

    await this.auditJournalBudgetEvaluated({
      tenantId: authz.tenantId,
      journalId: entry.id,
      userId: authz.id,
      permissionUsed: PERMISSIONS.GL.FINAL_POST,
      stage: 'POST',
      computedAt: now,
      budgetStatus: budgetImpact.budgetStatus,
      budgetFlags: budgetImpact.budgetFlags,
    });

    if (budgetImpact.budgetStatus === 'BLOCK') {
      throw new ConflictException({
        code: 'BUDGET_BLOCKED',
        stage: 'POST',
        message:
          'Posting blocked: one or more journal lines exceed available budget.',
        budgetFlags: budgetImpact.budgetFlags,
      });
    }

    const accountsForRisk = await prisma.account.findMany({
      where: {
        tenantId: authz.tenantId,
        id: { in: [...new Set(entry.lines.map((l) => l.accountId))] },
      },
      select: { id: true, code: true },
    });
    const accountCodeById = new Map(
      accountsForRisk.map((a) => [a.id, a.code] as const),
    );

    const postRisk = this.computeJournalRisk({
      journal: {
        id: entry.id,
        journalType: (entry as any).journalType ?? null,
        journalDate: new Date(entry.journalDate),
        createdAt: new Date(entry.createdAt),
        correctsJournalId: (entry as any).correctsJournalId ?? null,
        reversalOfId: (entry as any).reversalOfId ?? null,
        reference: (entry as any).reference ?? null,
        returnReason: (entry as any).returnReason ?? null,
      },
      lines: (entry.lines ?? []).map((l) => ({
        debit: (l as any).debit,
        credit: (l as any).credit,
        account: { code: accountCodeById.get(l.accountId) ?? null },
      })),
      stage: 'POST',
      computedAt: now,
      postingPeriod: period ? { endDate: period.endDate } : null,
      budget:
        budgetImpact.budgetStatus === 'WARN'
          ? {
              budgetStatus: 'WARN',
              warnRepeatUpliftPoints: (
                await this.getBudgetRepeatWarnUplift({
                  tenantId: authz.tenantId,
                  createdById: entry.createdById,
                  excludeJournalId: entry.id,
                  now,
                })
              ).points,
            }
          : { budgetStatus: budgetImpact.budgetStatus },
    });

    const runAsTransaction = async (fn: (tx: any) => Promise<any>) => {
      if (typeof prisma?.$transaction === 'function') {
        return prisma.$transaction(fn);
      }
      return fn(prisma);
    };

    const updated = await runAsTransaction(async (tx) => {
      const cfg = await (tx.tenantJournalNumberingConfig as any).findUnique({
        where: { tenantId: authz.tenantId },
        select: { scope: true },
      });

      const tenantRow = await (tx.tenant as any).findUnique({
        where: { id: authz.tenantId },
        select: { financialYearStartMonth: true },
      });

      const scope = String(cfg?.scope ?? 'TENANT_GLOBAL') as
        | 'TENANT_GLOBAL'
        | 'LEGAL_ENTITY'
        | 'FISCAL_YEAR'
        | 'LEGAL_ENTITY_FISCAL_YEAR';

      const distinctLegalEntities = new Set<string>(
        (entry.lines ?? [])
          .map((l: any) => String(l.legalEntityId ?? '').trim())
          .filter(Boolean),
      );
      const legalEntityId =
        distinctLegalEntities.size === 1 ? Array.from(distinctLegalEntities)[0] : null;
      if ((scope === 'LEGAL_ENTITY' || scope === 'LEGAL_ENTITY_FISCAL_YEAR') && distinctLegalEntities.size !== 1) {
        throw new BadRequestException('Journal has multiple legal entities; cannot use legal-entity journal numbering scope');
      }

      const fyStartMonth =
        typeof tenantRow?.financialYearStartMonth === 'number' && tenantRow.financialYearStartMonth >= 1 && tenantRow.financialYearStartMonth <= 12
          ? tenantRow.financialYearStartMonth
          : 1;
      const fiscalYearLabel = this.computeFiscalYearLabel({
        financialYearStartMonth: fyStartMonth,
        date: period?.startDate ? new Date(period.startDate) : new Date(entry.journalDate),
      });

      const sequenceName = this.buildJournalSequenceName({
        scope,
        tenantId: authz.tenantId,
        legalEntityId,
        fiscalYearLabel,
      });

      const counter = await (tx.tenantSequenceCounter as any).upsert({
        where: {
          tenantId_name: {
            tenantId: authz.tenantId,
            name: sequenceName,
          },
        },
        create: {
          tenantId: authz.tenantId,
          name: sequenceName,
          value: 0,
        },
        update: {},
        select: { id: true },
      });

      const bumped = await (tx.tenantSequenceCounter as any).update({
        where: { id: counter.id },
        data: { value: { increment: 1 } },
        select: { value: true },
      });

      return await withGlLifecycleBypass(() =>
        (tx.journalEntry as any).update({
          where: { id: entry.id },
          data: {
            status: 'POSTED',
            postedById: authz.id,
            postedAt: now,
            periodId: period.id,
            journalNumber: bumped.value,
            riskScore: postRisk.score,
            riskFlags: postRisk.flags as any,
            riskComputedAt: now,
          },
          include: { lines: true },
        })
      );
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.GL_JOURNAL_RISK_COMPUTED,
        entityType: AuditEntityType.JOURNAL_ENTRY,
        entityId: entry.id,
        actorUserId: authz.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_GL_FINAL_POST',
        permissionUsed: PERMISSIONS.GL.FINAL_POST,
        metadata: {
          journalId: entry.id,
          riskScore: postRisk.score,
          riskFlags: postRisk.flags,
          computedAt: now.toISOString(),
          lifecycleStage: 'POST',
        },
      },
      prisma,
    );

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.GL_JOURNAL_POSTED,
        entityType: AuditEntityType.JOURNAL_ENTRY,
        entityId: entry.id,
        actorUserId: authz.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_GL_FINAL_POST',
        permissionUsed: PERMISSIONS.GL.FINAL_POST,
        lifecycleType: 'POST',
        metadata: {
          journalId: entry.id,
          postedById: authz.id,
          postedAt: now.toISOString(),
          periodId: period.id,
        },
      },
      this.prisma,
    );

    if (params.override?.overrideSessionId) {
      await this.overrideSessions.markExecuted({
        tenantId: authz.tenantId,
        sessionId: params.override.overrideSessionId,
        executedById: authz.actorUserId,
        req,
        permissionUsed: params.override.permissionUsed,
      });
    }

    const sessionIdPeriod = String(
      (params.req as any)?.governanceOverrideSessionIdPeriod ?? '',
    ).trim();
    if (sessionIdPeriod) {
      await this.overrideSessions.markExecuted({
        tenantId: authz.tenantId,
        sessionId: sessionIdPeriod,
        executedById: authz.actorUserId,
        req,
        permissionUsed: PERMISSIONS.GL.FINAL_POST,
      });
    }

    const sessionIdRetro = String(
      (params.req as any)?.governanceOverrideSessionIdRetro ?? '',
    ).trim();
    if (sessionIdRetro) {
      await this.overrideSessions.markExecuted({
        tenantId: authz.tenantId,
        sessionId: sessionIdRetro,
        executedById: authz.actorUserId,
        req,
        permissionUsed: PERMISSIONS.GL.FINAL_POST,
      });
    }

    if (isReversal) {
      await writeAuditEventWithPrisma(
        {
          tenantId: authz.tenantId,
          eventType: AuditEventType.GL_JOURNAL_REVERSAL_POSTED,
          entityType: AuditEntityType.JOURNAL_ENTRY,
          entityId: entry.id,
          actorUserId: authz.id,
          timestamp: new Date(),
          outcome: 'SUCCESS' as any,
          action: 'FINANCE_GL_FINAL_POST',
          permissionUsed: PERMISSIONS.GL.FINAL_POST,
          lifecycleType: 'POST_REVERSAL',
          metadata: {
            reversalJournalId: entry.id,
            reversalOfId: (entry as any).reversalOfId ?? null,
            postedById: authz.id,
            postedAt: now.toISOString(),
            periodId: period.id,
          },
        },
        prisma,
      );
    }

    this.cache.clearTenant(authz.tenantId);

    return updated;
  }

  async getOpeningBalances(req: Request, dto: OpeningBalancesQueryDto) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    const cutoverDate = this.parseCutoverDate(dto.cutoverDate);

    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: tenant.id,
        name: this.OPENING_PERIOD_NAME,
        startDate: cutoverDate,
        endDate: cutoverDate,
      },
      select: {
        id: true,
        status: true,
        name: true,
        startDate: true,
        endDate: true,
      },
    });

    const journal = await this.prisma.journalEntry.findFirst({
      where: {
        tenantId: tenant.id,
        journalDate: cutoverDate,
        reference: { startsWith: this.OPENING_REF_PREFIX },
      },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });

    const cutoverLocked = !!(period && period.status === 'CLOSED');

    return {
      cutoverDate: dto.cutoverDate,
      openingPeriod: period,
      journal,
      cutoverLocked,
    };
  }

  async upsertOpeningBalances(
    req: Request,
    dto: UpsertOpeningBalancesJournalDto,
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const cutoverDate = this.parseCutoverDate(dto.cutoverDate);

    const existingPeriod = await (this.prisma.accountingPeriod as any).findFirst({
      where: {
        tenantId: tenant.id,
        name: this.OPENING_PERIOD_NAME,
        startDate: cutoverDate,
        endDate: cutoverDate,
      },
      select: { id: true, status: true },
    });

    if (existingPeriod?.status === 'CLOSED') {
      throw new BadRequestException(
        'This accounting period is closed. Posting is not allowed.',
      );
    }

    let period = existingPeriod;
    if (!period) {
      try {
        period = await (this.prisma.accountingPeriod as any).create({
          data: {
            tenantId: tenant.id,
            code: `OB-${dto.cutoverDate.slice(0, 4)}`,
            name: this.OPENING_PERIOD_NAME,
            startDate: cutoverDate,
            endDate: cutoverDate,
            type: 'OPENING',
            createdById: user.id,
          },
        });
      } catch (e: any) {
        if (e?.code === 'P2002') {
          throw new BadRequestException({
            error: 'Opening Balances period already exists for this tenant',
            reason:
              'This tenant can only have one Opening Balances period (schema constraint). Use the existing cutoverDate or create a new tenant for a fresh demo.',
          });
        }
        throw e;
      }
    }

    const existingJournal = await this.prisma.journalEntry.findFirst({
      where: {
        tenantId: tenant.id,
        journalDate: cutoverDate,
        reference: { startsWith: this.OPENING_REF_PREFIX },
      },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });

    if (existingJournal?.status === 'POSTED') {
      throw new ForbiddenException(
        'Opening balance journal is already POSTED and cannot be edited',
      );
    }

    const lines = dto.lines.map((l) => ({
      accountId: l.accountId,
      debit: l.debit,
      credit: l.credit,
    }));
    this.assertLinesBasicValid(lines);
    this.assertBalanced(lines);

    await this.assertOpeningBalanceAccountsAllowed({
      tenantId: tenant.id,
      lines: dto.lines,
    });

    const reference = `${this.OPENING_REF_PREFIX}${dto.cutoverDate}`;
    const description = `${this.OPENING_DESC_PREFIX}${dto.cutoverDate}`;

    if (!existingJournal) {
      const created = await this.prisma.journalEntry.create({
        data: {
          tenantId: tenant.id,
          journalDate: cutoverDate,
          reference,
          description,
          createdById: user.id,
          lines: {
            create: dto.lines.map((l) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
            })),
          },
        },
        include: { lines: true },
      });

      return { openingPeriod: period, journal: created };
    }

    const updated = await this.prisma.journalEntry.update({
      where: { id: existingJournal.id },
      data: {
        reference,
        description,
        lines: {
          deleteMany: { journalEntryId: existingJournal.id },
          create: dto.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
          })),
        },
      },
      include: { lines: true },
    });

    return { openingPeriod: period, journal: updated };
  }

  async postOpeningBalances(req: Request, dto: OpeningBalancesQueryDto) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, 'FINANCE_GL_FINAL_POST');

    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const cutoverDate = this.parseCutoverDate(dto.cutoverDate);

    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: tenant.id,
        name: this.OPENING_PERIOD_NAME,
        startDate: cutoverDate,
        endDate: cutoverDate,
      },
      select: { id: true, status: true },
    });

    if (!period) {
      throw new BadRequestException(
        'Opening Balances accounting period does not exist for cutoverDate',
      );
    }

    // Canonical period semantics for posting (OPEN only) while preserving the existing
    // BadRequestException wording for Opening Balances posting.
    try {
      assertPeriodAllowsPosting({
        req,
        period,
        permissionUsed: PERMISSIONS.GL.FINAL_POST,
      });
    } catch {
      const periodStatus = (period as any).status as string;
      if (periodStatus === PeriodStatus.CLOSED) {
        throw new BadRequestException(
          'This accounting period is closed. Posting is not allowed.',
        );
      }
      if (periodStatus === PeriodStatus.SOFT_CLOSED) {
        throw new BadRequestException(
          'This accounting period is soft-closed. Reopen the period to allow posting.',
        );
      }
      throw new BadRequestException(
        'Journal date is not within an open accounting period. Please choose a date in an open period.',
      );
    }

    const journal = await this.prisma.journalEntry.findFirst({
      where: {
        tenantId: tenant.id,
        journalDate: cutoverDate,
        reference: { startsWith: this.OPENING_REF_PREFIX },
      },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!journal) {
      throw new BadRequestException(
        'No opening balance journal exists for cutoverDate',
      );
    }

    if (journal.status === 'POSTED') {
      throw new BadRequestException(
        'Opening balance journal is already POSTED',
      );
    }

    this.assertBalanced(
      journal.lines.map((l) => ({
        debit: Number(l.debit),
        credit: Number(l.credit),
      })),
    );
    await this.assertOpeningBalanceAccountsAllowed({
      tenantId: tenant.id,
      lines: journal.lines.map((l) => ({
        accountId: l.accountId,
        debit: Number(l.debit),
        credit: Number(l.credit),
      })),
    });

    await this.systemReviewJournal(req, {
      prisma: this.prisma,
      journalId: journal.id,
      sourceType: 'OPENING_BALANCES',
      sourceId: dto.cutoverDate,
      permissionUsed: PERMISSIONS.GL.FINAL_POST,
      validateSource: async () => true,
    });

    const posted = await this.postJournal(req, journal.id);

    await this.prisma.accountingPeriod.update({
      where: { id: period.id },
      data: {
        status: 'HARD_CLOSED',
        closedById: user.id,
        closedAt: new Date(),
      },
    });

    this.cache.clearTenant(tenant.id);

    return { journal: posted, openingPeriodClosed: true };
  }

  async systemReviewJournal(
    req: Request,
    params: {
      prisma?: any;
      journalId: string;
      sourceType: string;
      sourceId: string;
      permissionUsed: string;
      validateSource: () => Promise<boolean>;
    },
  ) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, params.permissionUsed);

    const prisma = params.prisma ?? this.prisma;

    const ok = await params.validateSource();
    if (!ok) {
      throw new BadRequestException('Source workflow validation failed');
    }

    const entry = await prisma.journalEntry.findFirst({
      where: { id: params.journalId, tenantId: authz.tenantId },
      select: { id: true, status: true, reviewedById: true, reviewedAt: true },
    });
    if (!entry) throw new NotFoundException('Journal entry not found');
    if (entry.status !== 'SUBMITTED') {
      throw new BadRequestException(
        `Journal entry cannot be system-reviewed from status: ${entry.status}`,
      );
    }

    const now = new Date();

    const reviewed = await withGlLifecycleBypass(() =>
      prisma.journalEntry.update({
        where: { id: entry.id },
        data: {
          status: 'REVIEWED',
          reviewedById: authz.actorUserId,
          reviewedAt: now,
          reviewMode: JournalReviewMode.SYSTEM_REVIEW,
        },
      }),
    );

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.GL_JOURNAL_SYSTEM_REVIEWED,
        entityType: AuditEntityType.JOURNAL_ENTRY,
        entityId: reviewed.id,
        actorUserId: authz.actorUserId,
        timestamp: now,
        outcome: 'SUCCESS' as any,
        action: params.permissionUsed,
        permissionUsed: params.permissionUsed,
        lifecycleType: 'SYSTEM_REVIEW',
        metadata: {
          journalId: reviewed.id,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          reviewMode: 'SYSTEM_REVIEW',
          realUserId: authz.realUserId,
          actorUserId: authz.actorUserId,
          delegationId: authz.delegationId ?? null,
        },
      },
      prisma,
    );

    return reviewed;
  }

  async listJournals(
    req: Request,
    paramsOrLimit?:
      | {
          limit?: number;
          offset?: number;
          status?:
            | 'DRAFT'
            | 'SUBMITTED'
            | 'REVIEWED'
            | 'REJECTED'
            | 'PARKED'
            | 'POSTED';
          budgetStatus?: 'OK' | 'WARN' | 'BLOCK';
          drilldown?: boolean;
          workbench?: boolean;
          periodId?: string;
          fromDate?: string;
          toDate?: string;
          accountId?: string;
          legalEntityId?: string;
          departmentId?: string;
          projectId?: string;
          fundId?: string;
          riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
          minRiskScore?: number;
          maxRiskScore?: number;
          createdById?: string;
          reviewedById?: string;
          postedById?: string;
        }
      | number,
    offsetLegacy?: number,
    statusLegacy?:
      | 'DRAFT'
      | 'SUBMITTED'
      | 'REVIEWED'
      | 'REJECTED'
      | 'PARKED'
      | 'POSTED',
  ) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, 'FINANCE_GL_VIEW');

    const params =
      typeof paramsOrLimit === 'number'
        ? { limit: paramsOrLimit, offset: offsetLegacy, status: statusLegacy }
        : (paramsOrLimit ?? {});

    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    if (limit < 1 || limit > 200) {
      throw new BadRequestException(
        'Invalid limit. Limit must be between 1 and 200.',
      );
    }

    if (offset < 0) {
      throw new BadRequestException(
        'Invalid offset. Offset must be greater than or equal to 0.',
      );
    }

    const drilldown = Boolean((params as any).drilldown);
    const workbench = Boolean((params as any).workbench);
    const budgetStatus = (params as any).budgetStatus as
      | 'OK'
      | 'WARN'
      | 'BLOCK'
      | undefined;

    if (workbench) {
      requirePermission(authz, 'FINANCE_GL_CREATE');

      const where: any = {
        tenantId: authz.tenantId,
        createdById: authz.id,
        status: { in: ['DRAFT', 'REJECTED'] },
        ...(budgetStatus ? { budgetStatus } : {}),
      };

      const [items, total] = await Promise.all([
        this.prisma.journalEntry.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }],
          take: limit,
          skip: offset,
          select: {
            id: true,
            reference: true,
            journalDate: true,
            description: true,
            riskScore: true,
            riskFlags: true,
            budgetStatus: true,
            status: true,
            createdAt: true,
            createdBy: { select: { id: true, name: true } },
            reviewedBy: { select: { id: true, name: true } },
            postedBy: { select: { id: true, name: true } },
            lines: { select: { debit: true, credit: true } },
          } as any,
        }),
        this.prisma.journalEntry.count({ where }),
      ]);

      const toNum = (v: any) => {
        if (v === null || v === undefined) return 0;
        if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };

      const summaryItems = (items ?? []).map((j: any) => {
        const lines = Array.isArray(j.lines) ? j.lines : [];
        const totalDebit =
          Math.round(
            lines.reduce((sum: number, l: any) => sum + toNum(l.debit), 0) *
              100,
          ) / 100;
        const totalCredit =
          Math.round(
            lines.reduce((sum: number, l: any) => sum + toNum(l.credit), 0) *
              100,
          ) / 100;

        return {
          id: j.id,
          reference: j.reference,
          journalDate: j.journalDate,
          description: j.description,
          totalDebit,
          totalCredit,
          riskScore: j.riskScore,
          riskFlags: j.riskFlags,
          budgetStatus: j.budgetStatus ?? 'OK',
          status: j.status,
          createdBy: j.createdBy
            ? { id: j.createdBy.id, name: j.createdBy.name }
            : null,
          reviewedBy: j.reviewedBy
            ? { id: j.reviewedBy.id, name: j.reviewedBy.name }
            : null,
          postedBy: j.postedBy
            ? { id: j.postedBy.id, name: j.postedBy.name }
            : null,
        };
      });

      return {
        items: summaryItems,
        total,
        limit,
        offset,
      };
    }

    // Journal Register defaults to ALL statuses.
    // Risk drill-down explicitly requests restricted scope via drilldown=true.
    const status = params.status;
    const scopedStatus = drilldown
      ? status === 'REVIEWED' || status === 'POSTED'
        ? status
        : undefined
      : status;

    const periodId = (params.periodId ?? '').trim();
    const accountId = (params.accountId ?? '').trim();
    const legalEntityId = (params.legalEntityId ?? '').trim();
    const departmentId = (params.departmentId ?? '').trim();
    const projectId = (params.projectId ?? '').trim();
    const fundId = (params.fundId ?? '').trim();
    const createdById = (params.createdById ?? '').trim();
    const reviewedById = (params.reviewedById ?? '').trim();
    const postedById = (params.postedById ?? '').trim();

    const from = this.parseOptionalYmd(params.fromDate);
    const to = this.parseOptionalYmd(params.toDate);

    const riskLevel = params.riskLevel;
    const minRiskScore =
      typeof params.minRiskScore === 'number' &&
      Number.isFinite(params.minRiskScore)
        ? params.minRiskScore
        : undefined;
    const maxRiskScore =
      typeof params.maxRiskScore === 'number' &&
      Number.isFinite(params.maxRiskScore)
        ? params.maxRiskScore
        : undefined;

    const riskRange = (() => {
      if (riskLevel === 'LOW') return { gte: 0, lt: 20 };
      if (riskLevel === 'MEDIUM') return { gte: 20, lt: 40 };
      if (riskLevel === 'HIGH') return { gte: 40 };
      return null;
    })();

    const needsRiskScore = Boolean(
      riskLevel || minRiskScore !== undefined || maxRiskScore !== undefined,
    );

    const where: any = {
      tenantId: authz.tenantId,
      ...(scopedStatus
        ? { status: scopedStatus }
        : drilldown
          ? { status: { in: ['REVIEWED', 'POSTED'] } }
          : {}),
      ...(periodId ? { periodId } : {}),
      ...(from ? { journalDate: { gte: from } } : {}),
      ...(to
        ? { journalDate: { ...(from ? { gte: from } : {}), lte: to } }
        : {}),
      ...(createdById ? { createdById } : {}),
      ...(reviewedById ? { reviewedById } : {}),
      ...(postedById ? { postedById } : {}),
      ...(needsRiskScore ? { riskScore: { not: null } } : {}),
      ...(budgetStatus ? { budgetStatus } : {}),
    };

    if (needsRiskScore) {
      where.riskScore = {
        ...(where.riskScore ?? {}),
        ...(riskRange ? (riskRange as any) : {}),
        ...(minRiskScore !== undefined ? { gte: minRiskScore } : {}),
        ...(maxRiskScore !== undefined ? { lte: maxRiskScore } : {}),
      };
    }

    const lineFilters: any[] = [];
    if (accountId) lineFilters.push({ accountId });
    if (legalEntityId) lineFilters.push({ legalEntityId });
    if (departmentId) lineFilters.push({ departmentId });
    if (projectId) lineFilters.push({ projectId });
    if (fundId) lineFilters.push({ fundId });

    if (lineFilters.length) {
      where.lines = { some: { AND: lineFilters } };
    }

    const [items, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        orderBy: [{ journalDate: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
        select: {
          id: true,
          reference: true,
          journalDate: true,
          description: true,
          riskScore: true,
          riskFlags: true,
          budgetStatus: true,
          status: true,
          createdAt: true,
          createdBy: { select: { id: true, name: true } },
          reviewedBy: { select: { id: true, name: true } },
          postedBy: { select: { id: true, name: true } },
          lines: { select: { debit: true, credit: true } },
        } as any,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    const toNum = (v: any) => {
      if (v === null || v === undefined) return 0;
      if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const summaryItems = (items ?? []).map((j: any) => {
      const lines = Array.isArray(j.lines) ? j.lines : [];
      const totalDebit =
        Math.round(
          lines.reduce((sum: number, l: any) => sum + toNum(l.debit), 0) * 100,
        ) / 100;
      const totalCredit =
        Math.round(
          lines.reduce((sum: number, l: any) => sum + toNum(l.credit), 0) * 100,
        ) / 100;

      return {
        id: j.id,
        reference: j.reference,
        journalDate: j.journalDate,
        description: j.description,
        totalDebit,
        totalCredit,
        riskScore: j.riskScore,
        riskFlags: j.riskFlags,
        budgetStatus: j.budgetStatus ?? 'OK',
        status: j.status,
        createdBy: j.createdBy
          ? { id: j.createdBy.id, name: j.createdBy.name }
          : null,
        reviewedBy: j.reviewedBy
          ? { id: j.reviewedBy.id, name: j.reviewedBy.name }
          : null,
        postedBy: j.postedBy
          ? { id: j.postedBy.id, name: j.postedBy.name }
          : null,
      };
    });

    return {
      items: summaryItems,
      total,
      limit,
      offset,
    };
  }

  private assertLinesBasicValid(
    lines: Array<{ debit: number; credit: number }>,
  ) {
    if (!lines || lines.length < 2) {
      throw new BadRequestException('Journal must have at least 2 lines');
    }

    for (const l of lines) {
      if ((l.debit ?? 0) < 0 || (l.credit ?? 0) < 0) {
        throw new BadRequestException('Debit/credit cannot be negative');
      }
      const hasDebit = (l.debit ?? 0) > 0;
      const hasCredit = (l.credit ?? 0) > 0;
      if ((hasDebit && hasCredit) || (!hasDebit && !hasCredit)) {
        throw new BadRequestException(
          'Each line must have either a debit or a credit amount',
        );
      }
    }
  }

  private assertBalanced(lines: Array<{ debit: number; credit: number }>) {
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const totalDebit = round2(
      lines.reduce((sum, l) => sum + (l.debit ?? 0), 0),
    );
    const totalCredit = round2(
      lines.reduce((sum, l) => sum + (l.credit ?? 0), 0),
    );

    if (totalDebit !== totalCredit) {
      throw new BadRequestException({
        error: 'Journal is not balanced',
        totalDebit,
        totalCredit,
      });
    }

    if (totalDebit <= 0) {
      throw new BadRequestException('Journal total must be greater than zero');
    }
  }

  private parseCutoverDate(iso: string): Date {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Invalid cutoverDate');
    }

    // Enforce day-precision by normalizing to UTC midnight of the provided date string.
    const yyyyMmDd = iso.slice(0, 10);
    const normalized = new Date(`${yyyyMmDd}T00:00:00.000Z`);
    if (Number.isNaN(normalized.getTime())) {
      throw new BadRequestException('Invalid cutoverDate');
    }
    return normalized;
  }

  private isOpeningBalanceJournal(
    reference?: string | null,
    description?: string | null,
  ): boolean {
    return (
      (reference ?? '').startsWith(this.OPENING_REF_PREFIX) ||
      (description ?? '').startsWith(this.OPENING_DESC_PREFIX)
    );
  }

  private async getCutoverDateIfLocked(params: {
    tenantId: string;
  }): Promise<Date | null> {
    const closed = await (this.prisma.accountingPeriod as any).findFirst({
      where: {
        tenantId: params.tenantId,
        type: 'OPENING',
        status: { in: ['CLOSED', 'HARD_CLOSED', 'ARCHIVED'] },
      },
      orderBy: { startDate: 'desc' },
      select: { startDate: true },
    });

    return closed?.startDate ?? null;
  }

  private async assertOpeningBalanceAccountsAllowed(params: {
    tenantId: string;
    lines: Array<{ accountId: string; debit: number; credit: number }>;
  }) {
    const accountIds = [...new Set(params.lines.map((l) => l.accountId))];

    const accounts = await this.prisma.account.findMany({
      where: { tenantId: params.tenantId, id: { in: accountIds } },
      select: {
        id: true,
        code: true,
        type: true,
        isActive: true,
        isPosting: true,
      },
    });

    const byId = new Map(accounts.map((a) => [a.id, a] as const));
    for (const id of accountIds) {
      const a = byId.get(id);
      if (!a) {
        throw new BadRequestException(`Account not found: ${id}`);
      }
      if (!a.isActive) {
        throw new BadRequestException(`Account is inactive: ${id}`);
      }

      if (!a.isPosting) {
        throw new BadRequestException(
          `Account is non-posting and cannot be used in journals: ${id}`,
        );
      }

      const isRetainedEarnings = a.code === 'RETAINED_EARNINGS';
      const isBalanceSheet =
        a.type === 'ASSET' || a.type === 'LIABILITY' || a.type === 'EQUITY';
      if (!isBalanceSheet && !isRetainedEarnings) {
        throw new BadRequestException(
          'Opening Balance period only allows Balance Sheet accounts. Income and expenses must be posted in normal periods.',
        );
      }
    }
  }
}
