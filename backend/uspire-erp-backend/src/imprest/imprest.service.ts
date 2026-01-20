import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { requirePermission } from '../rbac/finance-authz.helpers';
import { writeAuditEventWithPrisma } from '../audit/audit-writer';
import { AuditEntityType, AuditEventType } from '@prisma/client';
import {
  mapGenericPrismaValidationError,
  mapImprestValidationError,
} from '../common/prisma-error.util';
import {
  CreateImprestTypePolicyDto,
  UpdateImprestTypePolicyDto,
} from './dto/imprest-type-policy.dto';
import {
  CreateImprestFacilityDto,
  UpdateImprestFacilityDto,
} from './dto/imprest-facility.dto';
import {
  ApproveImprestCaseDto,
  CreateImprestCaseDto,
  CreateImprestSettlementLineDto,
  IssueImprestCaseDto,
  LinkImprestEvidenceDto,
  RejectImprestCaseDto,
  ReviewImprestCaseDto,
  SettleImprestCaseDto,
  SubmitImprestCaseDto,
  UpdateImprestSettlementLineDto,
} from './dto/imprest-case.dto';

@Injectable()
export class ImprestService {
  private readonly IMPREST_CASE_SEQUENCE_NAME = 'IMPREST_CASE';
  private readonly JOURNAL_NUMBER_SEQUENCE_NAME = 'JOURNAL_ENTRY';

  constructor(private readonly prisma: PrismaService) {}

  private async hasActiveDepartmentMembership(params: {
    tenantId: string;
    departmentId: string;
    userId: string;
    at: Date;
  }): Promise<boolean> {
    const at = params.at;
    const row = await (this.prisma as any).departmentMembership.findFirst({
      where: {
        tenantId: params.tenantId,
        departmentId: params.departmentId,
        userId: params.userId,
        status: 'ACTIVE',
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
      },
      select: { id: true },
    });

    return Boolean(row);
  }

  private async getUserAuthz(req: Request): Promise<{
    tenantId: string;
    id: string;
    permissionCodes: Set<string>;
  }> {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId: user.id,
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

    const permissionCodes = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissionCodes.add(rp.permission.code);
      }
    }

    return { tenantId: tenant.id, id: user.id, permissionCodes };
  }

  private getTenantAndUser(req: Request) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }
    return { tenant, user };
  }

  async listTypePolicies(req: Request) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, PERMISSIONS.IMPREST.TYPE_POLICY_VIEW);
    return this.prisma.imprestTypePolicy.findMany({
      where: { tenantId: authz.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTypePolicy(req: Request, dto: CreateImprestTypePolicyDto) {
    const { user } = this.getTenantAndUser(req);
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, PERMISSIONS.IMPREST.TYPE_POLICY_CREATE);

    let created: any;
    try {
      created = await this.prisma.imprestTypePolicy.create({
        data: {
          tenantId: authz.tenantId,
          name: dto.name.trim(),
          defaultFloatLimit: new Prisma.Decimal(dto.defaultFloatLimit),
          settlementDays: dto.settlementDays,
          receiptRule: dto.receiptRule,
          receiptThresholdAmount: dto.receiptThresholdAmount
            ? new Prisma.Decimal(dto.receiptThresholdAmount)
            : null,
          approvalStrength: dto.approvalStrength,
          defaultRiskRating: dto.defaultRiskRating as any,
          effectiveFrom: new Date(dto.effectiveFrom),
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
          isActive: true,
          createdById: authz.id,
        },
      });
    } catch (err) {
      const mapped = mapImprestValidationError(err);
      if (mapped) {
        throw new BadRequestException(mapped);
      }
      const generic = mapGenericPrismaValidationError(
        err,
        'Unable to save policy. Please review the entered values and try again.',
      );
      if (generic) {
        throw new BadRequestException(generic);
      }
      throw err;
    }

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.IMPREST_TYPE_POLICY_CREATED,
        entityType: AuditEntityType.IMPREST_TYPE_POLICY,
        entityId: created.id,
        actorUserId: authz.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: PERMISSIONS.IMPREST.TYPE_POLICY_CREATE,
        permissionUsed: PERMISSIONS.IMPREST.TYPE_POLICY_CREATE,
      },
      this.prisma,
    );

    return created;
  }

  private async createPostedSettlementJournal(
    tx: any,
    args: {
      tenantId: string;
      actorUserId: string;
      journalDate: Date;
      reference: string;
      description: string;
      sourceId: string;
      lines: Array<{
        accountId: string;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
        legalEntityId: string;
        departmentId: string;
        projectId?: string | null;
        fundId?: string | null;
        lineNumber: number;
      }>;
    },
  ) {
    const period = await (tx.accountingPeriod as any).findFirst({
      where: {
        tenantId: args.tenantId,
        startDate: { lte: args.journalDate },
        endDate: { gte: args.journalDate },
      },
      select: { id: true, status: true },
    });

    if (!period) {
      throw new ForbiddenException({
        error: 'Posting blocked by accounting period control',
        reason: 'No accounting period exists for the settlement date',
      });
    }

    if ((period.status as string) !== 'OPEN') {
      throw new ForbiddenException({
        error: 'Posting blocked by accounting period control',
        reason: 'Accounting period is not OPEN for the settlement date',
      });
    }

    const accountIds = Array.from(new Set(args.lines.map((l) => l.accountId)));
    const accounts = await (tx.account as any).findMany({
      where: {
        tenantId: args.tenantId,
        id: { in: accountIds },
      },
      select: { id: true, isActive: true, isPostingAllowed: true },
    });
    const map = new Map(accounts.map((a) => [a.id, a] as const));
    for (const id of accountIds) {
      const a = map.get(id);
      if (!a) throw new BadRequestException(`Account not found: ${id}`);
      if (!a.isActive) throw new BadRequestException(`Account is inactive: ${id}`);
      if (!a.isPostingAllowed) throw new BadRequestException(`Account is non-posting and cannot be used: ${id}`);
    }

    const now = new Date();

    const counter = await (tx as any).tenantSequenceCounter.upsert({
      where: {
        tenantId_name: {
          tenantId: args.tenantId,
          name: this.JOURNAL_NUMBER_SEQUENCE_NAME,
        },
      },
      create: {
        tenantId: args.tenantId,
        name: this.JOURNAL_NUMBER_SEQUENCE_NAME,
        value: 0,
      },
      update: {},
      select: { id: true },
    });

    const bumped = await (tx as any).tenantSequenceCounter.update({
      where: { id: counter.id },
      data: { value: { increment: 1 } },
      select: { value: true },
    });

    return (tx as any).journalEntry.create({
      data: {
        tenantId: args.tenantId,
        reference: args.reference,
        description: args.description,
        status: 'POSTED',
        createdById: args.actorUserId,
        postedById: args.actorUserId,
        postedAt: now,
        journalDate: args.journalDate,
        journalType: 'STANDARD',
        periodId: period.id,
        journalNumber: bumped.value,
        sourceType: 'IMPREST_SETTLEMENT',
        sourceId: args.sourceId,
        lines: {
          create: args.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            legalEntityId: l.legalEntityId,
            departmentId: l.departmentId,
            projectId: l.projectId ?? null,
            fundId: l.fundId ?? null,
            lineNumber: l.lineNumber,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async updateTypePolicy(req: Request, id: string, dto: UpdateImprestTypePolicyDto) {
    const { user } = this.getTenantAndUser(req);
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, PERMISSIONS.IMPREST.TYPE_POLICY_EDIT);

    const existing = await this.prisma.imprestTypePolicy.findFirst({
      where: { id, tenantId: authz.tenantId },
    });
    if (!existing) throw new NotFoundException('Imprest type policy not found');

    const updated = await this.prisma.imprestTypePolicy.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? undefined,
        defaultFloatLimit:
          dto.defaultFloatLimit !== undefined
            ? new Prisma.Decimal(dto.defaultFloatLimit)
            : undefined,
        settlementDays: dto.settlementDays,
        receiptRule: dto.receiptRule,
        receiptThresholdAmount:
          dto.receiptThresholdAmount !== undefined
            ? dto.receiptThresholdAmount
              ? new Prisma.Decimal(dto.receiptThresholdAmount)
              : null
            : undefined,
        approvalStrength: dto.approvalStrength,
        defaultRiskRating: dto.defaultRiskRating as any,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
        effectiveTo:
          dto.effectiveTo !== undefined
            ? dto.effectiveTo
              ? new Date(dto.effectiveTo)
              : null
            : undefined,
        isActive: dto.isActive,
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.IMPREST_TYPE_POLICY_UPDATED,
        entityType: AuditEntityType.IMPREST_TYPE_POLICY,
        entityId: updated.id,
        actorUserId: authz.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: PERMISSIONS.IMPREST.TYPE_POLICY_EDIT,
        permissionUsed: PERMISSIONS.IMPREST.TYPE_POLICY_EDIT,
      },
      this.prisma,
    );

    return updated;
  }

  async listFacilities(req: Request) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, PERMISSIONS.IMPREST.FACILITY_VIEW);
    return this.prisma.imprestFacility.findMany({
      where: { tenantId: authz.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFacility(req: Request, dto: CreateImprestFacilityDto) {
    const { user } = this.getTenantAndUser(req);
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, PERMISSIONS.IMPREST.FACILITY_CREATE);

    const debugRefIds = {
      tenantId: authz.tenantId,
      typePolicyId: dto.typePolicyId,
      entityId: dto.entityId,
      departmentId: dto.departmentId,
      custodianUserId: dto.custodianUserId,
      fundingSourceType: dto.fundingSourceType,
      bankAccountId: dto.bankAccountId ?? null,
      controlGlAccountId: dto.controlGlAccountId,
      projectId: dto.projectId ?? null,
      fundId: dto.fundId ?? null,
    };

    const validFrom = new Date(dto.validFrom);
    const validTo = new Date(dto.validTo);
    if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validTo.getTime())) {
      throw new BadRequestException('Valid from/to dates are invalid.');
    }

    const policy = await this.prisma.imprestTypePolicy.findFirst({
      where: { id: dto.typePolicyId, tenantId: authz.tenantId },
      select: { id: true, isActive: true, effectiveFrom: true, effectiveTo: true },
    });
    if (!policy) {
      throw new BadRequestException(
        'One or more selected references (entity, department, custodian, bank account, or control account) are invalid.',
      );
    }

    const policyEffectiveFrom = new Date(policy.effectiveFrom);
    const policyEffectiveTo = policy.effectiveTo ? new Date(policy.effectiveTo) : null;
    const policyCoversPeriod =
      policy.isActive &&
      policyEffectiveFrom.getTime() <= validFrom.getTime() &&
      (policyEffectiveTo === null || policyEffectiveTo.getTime() >= validTo.getTime());
    if (!policyCoversPeriod) {
      throw new BadRequestException(
        'The selected imprest type policy is not active for the chosen validity period. Please select an active policy or adjust the dates.',
      );
    }

    // Explicit FK validations (do not rely on P2003 to diagnose failures)
    const entity = await this.prisma.entity.findFirst({
      where: { id: dto.entityId, tenantId: authz.tenantId },
      select: { id: true },
    });
    if (!entity) {
      // eslint-disable-next-line no-console
      console.error('[ImprestService.createFacility] validation failed: entity', debugRefIds);
      throw new BadRequestException('Selected entity does not exist.');
    }

    const department = await this.prisma.department.findFirst({
      where: {
        id: dto.departmentId,
        tenantId: authz.tenantId,
        isActive: true,
        status: 'ACTIVE' as any,
      },
      select: { id: true },
    });
    if (!department) {
      // eslint-disable-next-line no-console
      console.error('[ImprestService.createFacility] validation failed: department', debugRefIds);
      throw new BadRequestException('Selected department does not exist or is inactive.');
    }

    const custodianUser = await this.prisma.user.findFirst({
      where: { id: dto.custodianUserId, tenantId: authz.tenantId, isActive: true },
      select: { id: true },
    });
    if (!custodianUser) {
      // eslint-disable-next-line no-console
      console.error('[ImprestService.createFacility] validation failed: custodian user', debugRefIds);
      throw new BadRequestException('Selected custodian does not exist or is inactive.');
    }

    const custodianAssigned = await this.hasActiveDepartmentMembership({
      tenantId: authz.tenantId,
      departmentId: dto.departmentId,
      userId: dto.custodianUserId,
      at: validFrom,
    });
    if (!custodianAssigned) {
      throw new BadRequestException(
        'The selected custodian is not assigned to the chosen department.',
      );
    }

    if (dto.fundingSourceType === 'BANK' && !dto.bankAccountId) {
      throw new BadRequestException(
        'A bank account must be selected when the funding source is set to Bank.',
      );
    }

    if (dto.fundingSourceType === 'BANK' && dto.bankAccountId) {
      const bank = await this.prisma.bankAccount.findFirst({
        where: { id: dto.bankAccountId, tenantId: authz.tenantId, status: 'ACTIVE' as any },
        select: { id: true, currency: true },
      });
      if (!bank) {
        // eslint-disable-next-line no-console
        console.error('[ImprestService.createFacility] validation failed: bank account', debugRefIds);
        throw new BadRequestException(
          'Selected bank account does not exist or is inactive.',
        );
      }
      const bankCurrency = String(bank.currency ?? '').trim().toUpperCase();
      const facilityCurrency = String(dto.currency ?? '').trim().toUpperCase();
      if (bankCurrency && facilityCurrency && bankCurrency !== facilityCurrency) {
        throw new BadRequestException(
          'The selected bank account currency does not match the facility currency.',
        );
      }
    }

    const control = await this.prisma.account.findFirst({
      where: { id: dto.controlGlAccountId, tenantId: authz.tenantId, isActive: true },
      select: { id: true, type: true },
    });
    if (!control) {
      // eslint-disable-next-line no-console
      console.error('[ImprestService.createFacility] validation failed: control GL', debugRefIds);
      throw new BadRequestException('Selected control GL account does not exist or is inactive.');
    }
    if (String(control.type ?? '').toUpperCase() !== 'ASSET') {
      throw new BadRequestException(
        'The imprest control account must be an Asset account.',
      );
    }

    const overlap = await this.prisma.imprestFacility.findFirst({
      where: {
        tenantId: authz.tenantId,
        typePolicyId: dto.typePolicyId,
        entityId: dto.entityId,
        departmentId: dto.departmentId,
        validFrom: { lte: validTo },
        validTo: { gte: validFrom },
      },
      select: { id: true },
    });
    if (overlap) {
      throw new BadRequestException(
        'An imprest facility already exists for this policy, entity, department, and validity period.',
      );
    }

    let created: any;
    try {
      created = await this.prisma.imprestFacility.create({
        data: {
          tenantId: authz.tenantId,
          typePolicyId: dto.typePolicyId,
          custodianUserId: dto.custodianUserId,
          entityId: dto.entityId,
          departmentId: dto.departmentId,
          projectId: dto.projectId ?? null,
          fundId: dto.fundId ?? null,
          currency: dto.currency,
          approvedFloatLimit: new Prisma.Decimal(dto.approvedFloatLimit),
          settlementDays: dto.settlementDays,
          fundingSourceType: dto.fundingSourceType as any,
          bankAccountId: dto.bankAccountId ?? null,
          riskRating: dto.riskRating as any,
          controlGlAccountId: dto.controlGlAccountId,
          validFrom,
          validTo,
          status: 'ACTIVE' as any,
          createdById: authz.id,
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ImprestService.createFacility] prisma error', {
        refIds: debugRefIds,
        error: err,
      });

      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new BadRequestException(
            'An imprest facility already exists for this policy, entity, department, and validity period.',
          );
        }
      }

      const mapped = mapImprestValidationError(err);
      if (mapped) {
        throw new BadRequestException(mapped);
      }

      throw new BadRequestException(
        'One or more selected references (entity, department, custodian, bank account, or control account) are invalid.',
      );
    }

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.IMPREST_FACILITY_CREATED,
        entityType: AuditEntityType.IMPREST_FACILITY,
        entityId: created.id,
        actorUserId: authz.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: PERMISSIONS.IMPREST.FACILITY_CREATE,
        permissionUsed: PERMISSIONS.IMPREST.FACILITY_CREATE,
      },
      this.prisma,
    );

    return created;
  }

  async updateFacility(req: Request, id: string, dto: UpdateImprestFacilityDto) {
    const { user } = this.getTenantAndUser(req);
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, PERMISSIONS.IMPREST.FACILITY_EDIT);

    const existing = await this.prisma.imprestFacility.findFirst({
      where: { id, tenantId: authz.tenantId },
    });
    if (!existing) throw new NotFoundException('Imprest facility not found');

    const fundingSourceType = dto.fundingSourceType ?? (existing.fundingSourceType as any);
    const bankAccountId = dto.bankAccountId ?? (existing.bankAccountId ?? null);
    if (fundingSourceType === 'BANK' && !bankAccountId) {
      throw new BadRequestException('bankAccountId is required when fundingSourceType=BANK');
    }

    const updated = await this.prisma.imprestFacility.update({
      where: { id },
      data: {
        custodianUserId: dto.custodianUserId,
        departmentId: dto.departmentId,
        projectId: dto.projectId !== undefined ? dto.projectId ?? null : undefined,
        fundId: dto.fundId !== undefined ? dto.fundId ?? null : undefined,
        approvedFloatLimit:
          dto.approvedFloatLimit !== undefined
            ? new Prisma.Decimal(dto.approvedFloatLimit)
            : undefined,
        settlementDays: dto.settlementDays,
        fundingSourceType: dto.fundingSourceType as any,
        bankAccountId: dto.bankAccountId !== undefined ? dto.bankAccountId ?? null : undefined,
        riskRating: dto.riskRating as any,
        controlGlAccountId: dto.controlGlAccountId,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
        status: dto.status as any,
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.IMPREST_FACILITY_UPDATED,
        entityType: AuditEntityType.IMPREST_FACILITY,
        entityId: updated.id,
        actorUserId: authz.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: PERMISSIONS.IMPREST.FACILITY_EDIT,
        permissionUsed: PERMISSIONS.IMPREST.FACILITY_EDIT,
      },
      this.prisma,
    );

    return updated;
  }

  async listCases(req: Request) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, PERMISSIONS.IMPREST.CASE_VIEW);
    return this.prisma.imprestCase.findMany({
      where: { tenantId: authz.tenantId },
      orderBy: { createdAt: 'desc' },
      include: { evidence: true, transitions: true },
    });
  }

  async getCase(req: Request, id: string) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, PERMISSIONS.IMPREST.CASE_VIEW);
    const row = await this.prisma.imprestCase.findFirst({
      where: { id, tenantId: authz.tenantId },
      include: {
        evidence: { include: { evidence: true } },
        transitions: true,
        facility: true,
        settlementLines: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException('Imprest case not found');
    return row;
  }

  private computeSettlementSummary(args: {
    requestedAmount: Prisma.Decimal;
    lines: Array<{ type: any; amount: Prisma.Decimal }>;
  }) {
    let expenses = new Prisma.Decimal(0);
    let cashReturned = new Prisma.Decimal(0);

    for (const l of args.lines) {
      const t = String(l.type ?? '').toUpperCase();
      if (t === 'EXPENSE') expenses = expenses.plus(l.amount);
      else if (t === 'CASH_RETURN') cashReturned = cashReturned.plus(l.amount);
    }

    const totalAccounted = expenses.plus(cashReturned);
    const difference = args.requestedAmount.minus(totalAccounted);

    return { expenses, cashReturned, totalAccounted, difference };
  }

  async getSettlementSummary(req: Request, id: string) {
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, PERMISSIONS.IMPREST.CASE_VIEW);

    const row = await this.prisma.imprestCase.findFirst({
      where: { id, tenantId: authz.tenantId },
      select: {
        id: true,
        state: true,
        currency: true,
        requestedAmount: true,
        settlementLines: { select: { type: true, amount: true } },
      },
    });
    if (!row) throw new NotFoundException('Imprest case not found');

    const summary = this.computeSettlementSummary({
      requestedAmount: row.requestedAmount as any,
      lines: (row.settlementLines as any) ?? [],
    });

    return {
      caseId: row.id,
      state: row.state,
      currency: row.currency,
      issuedAmount: row.requestedAmount,
      expensesTotal: summary.expenses,
      cashReturnedTotal: summary.cashReturned,
      totalAccounted: summary.totalAccounted,
      difference: summary.difference,
      linesCount: (row.settlementLines ?? []).length,
    };
  }

  async createSettlementLine(req: Request, caseId: string, dto: CreateImprestSettlementLineDto) {
    const { user } = this.getTenantAndUser(req);
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, PERMISSIONS.IMPREST.CASE_SETTLEMENT_EDIT);

    const row = await this.prisma.imprestCase.findFirst({
      where: { id: caseId, tenantId: authz.tenantId },
      select: { id: true, state: true },
    });
    if (!row) throw new NotFoundException('Imprest case not found');

    if ((row.state as any) === ('SETTLED' as any)) {
      throw new BadRequestException('Settlement lines cannot be modified after the case is settled.');
    }

    if ((row.state as any) !== ('ISSUED' as any)) {
      throw new BadRequestException('Settlement lines can only be added when the case is ISSUED.');
    }

    const spentDate = new Date(dto.spentDate);
    if (Number.isNaN(spentDate.getTime())) throw new BadRequestException('Invalid spentDate');

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) throw new BadRequestException('Amount must be greater than 0');

    if (dto.type === 'EXPENSE') {
      if (!dto.glAccountId) {
        throw new BadRequestException('Expense settlement lines require a GL account');
      }
    }

    if (dto.type === 'CASH_RETURN') {
      if (dto.glAccountId) {
        throw new BadRequestException('Cash return settlement lines must not specify a GL account');
      }
    }

    return this.prisma.imprestSettlementLine.create({
      data: {
        tenantId: authz.tenantId,
        caseId: row.id,
        type: dto.type as any,
        glAccountId: dto.glAccountId ?? null,
        description: dto.description.trim(),
        amount,
        spentDate,
        createdById: authz.id,
      } as any,
    });
  }

  async updateSettlementLine(req: Request, id: string, dto: UpdateImprestSettlementLineDto) {
    const { user } = this.getTenantAndUser(req);
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, PERMISSIONS.IMPREST.CASE_SETTLEMENT_EDIT);

    const line = await this.prisma.imprestSettlementLine.findFirst({
      where: { id, tenantId: authz.tenantId },
      include: { imprestCase: { select: { id: true, state: true } } },
    });
    if (!line) throw new NotFoundException('Settlement line not found');

    if ((line.imprestCase?.state as any) === ('SETTLED' as any)) {
      throw new BadRequestException('Settlement lines cannot be modified after the case is settled.');
    }

    if ((line.imprestCase?.state as any) !== ('ISSUED' as any)) {
      throw new BadRequestException('Settlement lines can only be edited when the case is ISSUED.');
    }

    const data: any = {
      type: dto.type !== undefined ? (dto.type as any) : undefined,
      glAccountId: dto.glAccountId !== undefined ? dto.glAccountId : undefined,
      description: dto.description !== undefined ? dto.description.trim() : undefined,
    };

    const nextType = dto.type !== undefined ? dto.type : (line.type as any);
    const nextGlAccountId = dto.glAccountId !== undefined ? dto.glAccountId : (line as any).glAccountId;

    if (String(nextType).toUpperCase() === 'EXPENSE') {
      if (!nextGlAccountId) {
        throw new BadRequestException('Expense settlement lines require a GL account');
      }
    }

    if (String(nextType).toUpperCase() === 'CASH_RETURN') {
      if (nextGlAccountId) {
        throw new BadRequestException('Cash return settlement lines must not specify a GL account');
      }
      data.glAccountId = null;
    }

    if (dto.spentDate !== undefined) {
      const spentDate = new Date(dto.spentDate);
      if (Number.isNaN(spentDate.getTime())) throw new BadRequestException('Invalid spentDate');
      data.spentDate = spentDate;
    }

    if (dto.amount !== undefined) {
      const amount = new Prisma.Decimal(dto.amount);
      if (amount.lte(0)) throw new BadRequestException('Amount must be greater than 0');
      data.amount = amount;
    }

    return this.prisma.imprestSettlementLine.update({ where: { id: line.id }, data });
  }

  async deleteSettlementLine(req: Request, id: string) {
    const { user } = this.getTenantAndUser(req);
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, PERMISSIONS.IMPREST.CASE_SETTLEMENT_EDIT);

    const line = await this.prisma.imprestSettlementLine.findFirst({
      where: { id, tenantId: authz.tenantId },
      include: { imprestCase: { select: { id: true, state: true } } },
    });
    if (!line) throw new NotFoundException('Settlement line not found');

    if ((line.imprestCase?.state as any) === ('SETTLED' as any)) {
      throw new BadRequestException('Settlement lines cannot be modified after the case is settled.');
    }

    if ((line.imprestCase?.state as any) !== ('ISSUED' as any)) {
      throw new BadRequestException('Settlement lines can only be deleted when the case is ISSUED.');
    }

    await this.prisma.imprestSettlementLine.delete({ where: { id: line.id } });
    return { ok: true };
  }

  private async nextImprestCaseRef(tx: PrismaClient, tenantId: string) {
    const counter = await tx.tenantSequenceCounter.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: this.IMPREST_CASE_SEQUENCE_NAME,
        },
      },
      create: { tenantId, name: this.IMPREST_CASE_SEQUENCE_NAME, value: 0 },
      update: {},
      select: { id: true },
    });

    const bumped = await tx.tenantSequenceCounter.update({
      where: { id: counter.id },
      data: { value: { increment: 1 } },
      select: { value: true },
    });

    return `IMP-${String(bumped.value).padStart(6, '0')}`;
  }

  async createCase(req: Request, dto: CreateImprestCaseDto) {
    const { user } = this.getTenantAndUser(req);
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, PERMISSIONS.IMPREST.CASE_CREATE);

    const facility = await this.prisma.imprestFacility.findFirst({
      where: { id: dto.facilityId, tenantId: authz.tenantId },
    });
    if (!facility) throw new NotFoundException('Imprest facility not found');
    if (facility.status !== ('ACTIVE' as any)) {
      throw new ForbiddenException('Imprest facility is not ACTIVE');
    }

    const policy = await this.prisma.imprestTypePolicy.findFirst({
      where: { id: (facility as any).typePolicyId, tenantId: authz.tenantId },
      select: { id: true, name: true, defaultFloatLimit: true },
    });
    if (!policy) throw new NotFoundException('Imprest type policy not found');

    const requestedAmount = new Prisma.Decimal(dto.requestedAmount);
    const defaultFloatLimit = policy.defaultFloatLimit as any as Prisma.Decimal;
    if (requestedAmount.gt(defaultFloatLimit)) {
      throw new BadRequestException(
        `The requested amount exceeds the maximum allowed for this imprest type. Requested: ${requestedAmount.toFixed()} ${dto.currency}. Limit: ${defaultFloatLimit.toFixed()} ${dto.currency}.`,
      );
    }

    const unsettled = await this.prisma.imprestCase.count({
      where: {
        tenantId: authz.tenantId,
        facilityId: facility.id,
        state: { in: ['ISSUED'] as any },
      },
    });
    if (unsettled > 0) {
      throw new ConflictException({
        code: 'IMPREST_TOPUP_BLOCKED',
        message: 'No settlement → No top-up. Facility has an unsettled issued case.',
      });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const reference = await this.nextImprestCaseRef(tx as any, authz.tenantId);

      return (tx as any).imprestCase.create({
        data: {
          tenantId: authz.tenantId,
          facilityId: facility.id,
          reference,
          purpose: dto.purpose.trim(),
          justification: dto.justification.trim(),
          periodFrom: new Date(dto.periodFrom),
          periodTo: new Date(dto.periodTo),
          expectedSettlementDate: new Date(dto.expectedSettlementDate),
          requestedAmount,
          currency: dto.currency,
          state: 'DRAFT',
          createdById: authz.id,
        },
      });
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.IMPREST_CASE_CREATED,
        entityType: AuditEntityType.IMPREST_CASE,
        entityId: created.id,
        actorUserId: authz.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: PERMISSIONS.IMPREST.CASE_CREATE,
        permissionUsed: PERMISSIONS.IMPREST.CASE_CREATE,
      },
      this.prisma,
    );

    return created;
  }

  private async logTransition(args: {
    tenantId: string;
    caseId: string;
    fromState: any;
    toState: any;
    actorUserId: string;
    notes?: string | null;
    metadata?: any;
  }) {
    await this.prisma.imprestCaseTransitionLog.create({
      data: {
        tenantId: args.tenantId,
        caseId: args.caseId,
        fromState: args.fromState,
        toState: args.toState,
        actorUserId: args.actorUserId,
        notes: args.notes ?? null,
        metadata: args.metadata ?? undefined,
      } as any,
    });
  }

  async submitCase(req: Request, id: string, dto: SubmitImprestCaseDto) {
    const { user } = this.getTenantAndUser(req);
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, PERMISSIONS.IMPREST.CASE_SUBMIT);

    const row = await this.prisma.imprestCase.findFirst({
      where: { id, tenantId: authz.tenantId },
      include: { evidence: true },
    });
    if (!row) throw new NotFoundException('Imprest case not found');

    if (row.state !== ('DRAFT' as any) && row.state !== ('REJECTED' as any)) {
      throw new BadRequestException(`Cannot submit case from state: ${row.state}`);
    }

    const supportDocs = row.evidence.filter((e) => e.type === ('REQUEST_SUPPORTING_DOC' as any));
    if (supportDocs.length === 0) {
      throw new ForbiddenException({
        code: 'EVIDENCE_REQUIRED',
        message: 'Supporting documents are required before submission.',
      });
    }

    const now = new Date();
    const updated = await this.prisma.imprestCase.update({
      where: { id: row.id },
      data: { state: 'SUBMITTED' as any, submittedAt: now },
    });

    await this.logTransition({
      tenantId: authz.tenantId,
      caseId: row.id,
      fromState: row.state,
      toState: 'SUBMITTED',
      actorUserId: authz.id,
      notes: dto.notes ?? null,
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.IMPREST_CASE_SUBMITTED,
        entityType: AuditEntityType.IMPREST_CASE,
        entityId: row.id,
        actorUserId: authz.id,
        timestamp: now,
        outcome: 'SUCCESS' as any,
        action: PERMISSIONS.IMPREST.CASE_SUBMIT,
        permissionUsed: PERMISSIONS.IMPREST.CASE_SUBMIT,
      },
      this.prisma,
    );

    return updated;
  }

  async reviewCase(req: Request, id: string, dto: ReviewImprestCaseDto) {
    const { user } = this.getTenantAndUser(req);
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, PERMISSIONS.IMPREST.CASE_REVIEW);

    const row = await this.prisma.imprestCase.findFirst({
      where: { id, tenantId: authz.tenantId },
    });
    if (!row) throw new NotFoundException('Imprest case not found');

    if (row.state !== ('SUBMITTED' as any)) {
      throw new BadRequestException(`Cannot review case from state: ${row.state}`);
    }

    const now = new Date();
    const updated = await this.prisma.imprestCase.update({
      where: { id: row.id },
      data: { state: 'IN_REVIEW' as any, reviewedAt: now, reviewedById: authz.id },
    });

    await this.logTransition({
      tenantId: authz.tenantId,
      caseId: row.id,
      fromState: row.state,
      toState: 'IN_REVIEW',
      actorUserId: authz.id,
      notes: dto.notes ?? null,
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.IMPREST_CASE_REVIEWED,
        entityType: AuditEntityType.IMPREST_CASE,
        entityId: row.id,
        actorUserId: authz.id,
        timestamp: now,
        outcome: 'SUCCESS' as any,
        action: PERMISSIONS.IMPREST.CASE_REVIEW,
        permissionUsed: PERMISSIONS.IMPREST.CASE_REVIEW,
      },
      this.prisma,
    );

    return updated;
  }

  async approveCase(req: Request, id: string, dto: ApproveImprestCaseDto) {
    const { user } = this.getTenantAndUser(req);
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, PERMISSIONS.IMPREST.CASE_APPROVE);

    const row = await this.prisma.imprestCase.findFirst({
      where: { id, tenantId: authz.tenantId },
    });
    if (!row) throw new NotFoundException('Imprest case not found');

    if (row.createdById === user.id) {
      throw new ForbiddenException('Maker-checker: requester cannot approve their own imprest case');
    }

    if (row.state !== ('IN_REVIEW' as any)) {
      throw new BadRequestException(`Cannot approve case from state: ${row.state}`);
    }

    const now = new Date();
    const updated = await this.prisma.imprestCase.update({
      where: { id: row.id },
      data: { state: 'APPROVED' as any, approvedAt: now, approvedById: authz.id },
    });

    await this.logTransition({
      tenantId: authz.tenantId,
      caseId: row.id,
      fromState: row.state,
      toState: 'APPROVED',
      actorUserId: authz.id,
      notes: dto.notes ?? null,
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.IMPREST_CASE_APPROVED,
        entityType: AuditEntityType.IMPREST_CASE,
        entityId: row.id,
        actorUserId: authz.id,
        timestamp: now,
        outcome: 'SUCCESS' as any,
        action: PERMISSIONS.IMPREST.CASE_APPROVE,
        permissionUsed: PERMISSIONS.IMPREST.CASE_APPROVE,
      },
      this.prisma,
    );

    return updated;
  }

  async rejectCase(req: Request, id: string, dto: RejectImprestCaseDto) {
    const { user } = this.getTenantAndUser(req);
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, PERMISSIONS.IMPREST.CASE_REJECT);

    const row = await this.prisma.imprestCase.findFirst({
      where: { id, tenantId: authz.tenantId },
    });
    if (!row) throw new NotFoundException('Imprest case not found');

    if (row.createdById === user.id) {
      throw new ForbiddenException('Maker-checker: requester cannot reject their own imprest case');
    }

    if (row.state !== ('IN_REVIEW' as any)) {
      throw new BadRequestException(`Cannot reject case from state: ${row.state}`);
    }

    const now = new Date();
    const updated = await this.prisma.imprestCase.update({
      where: { id: row.id },
      data: {
        state: 'REJECTED' as any,
        rejectedAt: now,
        rejectedById: authz.id,
        rejectionReason: dto.reason,
      },
    });

    await this.logTransition({
      tenantId: authz.tenantId,
      caseId: row.id,
      fromState: row.state,
      toState: 'REJECTED',
      actorUserId: authz.id,
      notes: dto.reason,
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.IMPREST_CASE_REJECTED,
        entityType: AuditEntityType.IMPREST_CASE,
        entityId: row.id,
        actorUserId: authz.id,
        timestamp: now,
        outcome: 'SUCCESS' as any,
        action: PERMISSIONS.IMPREST.CASE_REJECT,
        permissionUsed: PERMISSIONS.IMPREST.CASE_REJECT,
        reason: dto.reason,
      },
      this.prisma,
    );

    return updated;
  }

  async linkEvidence(req: Request, caseId: string, dto: LinkImprestEvidenceDto) {
    const { user } = this.getTenantAndUser(req);
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, PERMISSIONS.IMPREST.CASE_VIEW);

    const row = await this.prisma.imprestCase.findFirst({
      where: { id: caseId, tenantId: authz.tenantId },
    });
    if (!row) throw new NotFoundException('Imprest case not found');

    const evidence = await this.prisma.auditEvidence.findFirst({
      where: { id: dto.evidenceId, tenantId: authz.tenantId },
      select: { id: true, entityType: true, entityId: true },
    });
    if (!evidence) throw new NotFoundException('Evidence not found');

    if (evidence.entityType !== ('IMPREST_CASE' as any) || evidence.entityId !== row.id) {
      throw new ForbiddenException('Evidence entityType/entityId must match the imprest case');
    }

    const linked = await this.prisma.imprestCaseEvidence.create({
      data: {
        tenantId: authz.tenantId,
        caseId: row.id,
        evidenceId: evidence.id,
        type: dto.type as any,
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.IMPREST_CASE_EVIDENCE_LINKED,
        entityType: AuditEntityType.IMPREST_CASE,
        entityId: row.id,
        actorUserId: authz.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: PERMISSIONS.IMPREST.CASE_VIEW,
        permissionUsed: PERMISSIONS.IMPREST.CASE_VIEW,
        metadata: { evidenceId: evidence.id, type: dto.type },
      },
      this.prisma,
    );

    return linked;
  }

  private async createPostedIssuanceJournal(args: {
    tenantId: string;
    actorUserId: string;
    journalDate: Date;
    reference: string;
    description: string;
    sourceId: string;
    debitAccountId: string;
    creditAccountId: string;
    amount: Prisma.Decimal;
    legalEntityId?: string | null;
    departmentId?: string | null;
    projectId?: string | null;
    fundId?: string | null;
  }) {
    const period = await (this.prisma.accountingPeriod as any).findFirst({
      where: {
        tenantId: args.tenantId,
        startDate: { lte: args.journalDate },
        endDate: { gte: args.journalDate },
      },
      select: { id: true, status: true },
    });

    if (!period) {
      throw new ForbiddenException({
        error: 'Posting blocked by accounting period control',
        reason: 'No accounting period exists for the issuance date',
      });
    }

    if ((period.status as string) !== 'OPEN') {
      throw new ForbiddenException({
        error: 'Posting blocked by accounting period control',
        reason: 'Accounting period is not OPEN for the issuance date',
      });
    }

    const accounts = await this.prisma.account.findMany({
      where: {
        tenantId: args.tenantId,
        id: { in: [args.debitAccountId, args.creditAccountId] },
      },
      select: { id: true, isActive: true, isPostingAllowed: true },
    });
    const map = new Map(accounts.map((a) => [a.id, a] as const));
    for (const id of [args.debitAccountId, args.creditAccountId]) {
      const a = map.get(id);
      if (!a) throw new BadRequestException(`Account not found: ${id}`);
      if (!a.isActive) throw new BadRequestException(`Account is inactive: ${id}`);
      if (!a.isPostingAllowed)
        throw new BadRequestException(`Account is non-posting and cannot be used: ${id}`);
    }

    const now = new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      const counter = await (tx as any).tenantSequenceCounter.upsert({
        where: {
          tenantId_name: {
            tenantId: args.tenantId,
            name: this.JOURNAL_NUMBER_SEQUENCE_NAME,
          },
        },
        create: {
          tenantId: args.tenantId,
          name: this.JOURNAL_NUMBER_SEQUENCE_NAME,
          value: 0,
        },
        update: {},
        select: { id: true },
      });

      const bumped = await (tx as any).tenantSequenceCounter.update({
        where: { id: counter.id },
        data: { value: { increment: 1 } },
        select: { value: true },
      });

      return (tx as any).journalEntry.create({
        data: {
          tenantId: args.tenantId,
          reference: args.reference,
          description: args.description,
          status: 'POSTED',
          createdById: args.actorUserId,
          postedById: args.actorUserId,
          postedAt: now,
          journalDate: args.journalDate,
          journalType: 'STANDARD',
          periodId: period.id,
          journalNumber: bumped.value,
          sourceType: 'IMPREST_ISSUANCE',
          sourceId: args.sourceId,
          lines: {
            create: [
              {
                accountId: args.debitAccountId,
                debit: args.amount,
                credit: new Prisma.Decimal(0),
                legalEntityId: args.legalEntityId ?? null,
                departmentId: args.departmentId ?? null,
                projectId: args.projectId ?? null,
                fundId: args.fundId ?? null,
                lineNumber: 1,
              },
              {
                accountId: args.creditAccountId,
                debit: new Prisma.Decimal(0),
                credit: args.amount,
                legalEntityId: args.legalEntityId ?? null,
                departmentId: args.departmentId ?? null,
                projectId: args.projectId ?? null,
                fundId: args.fundId ?? null,
                lineNumber: 2,
              },
            ],
          },
        },
        include: { lines: true },
      });
    });

    return created;
  }

  async issueCase(req: Request, id: string, dto: IssueImprestCaseDto) {
    const { user } = this.getTenantAndUser(req);
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, PERMISSIONS.IMPREST.CASE_ISSUE);

    const row = await this.prisma.imprestCase.findFirst({
      where: { id, tenantId: authz.tenantId },
      include: { evidence: true, facility: true },
    });
    if (!row) throw new NotFoundException('Imprest case not found');

    if (row.state !== ('APPROVED' as any) && row.state !== ('ISSUANCE_PENDING_EVIDENCE' as any)) {
      throw new BadRequestException(`Cannot issue case from state: ${row.state}`);
    }

    const fundingProof = row.evidence.filter((e) => e.type === ('FUNDING_PROOF' as any));
    if (fundingProof.length === 0) {
      await this.prisma.imprestCase.update({
        where: { id: row.id },
        data: { state: 'ISSUANCE_PENDING_EVIDENCE' as any },
      });

      throw new ForbiddenException({
        code: 'EVIDENCE_REQUIRED',
        message: 'Funding evidence is required before issuance.',
      });
    }

    const facility = row.facility;
    if (!facility) throw new NotFoundException('Imprest facility not found');

    const outstandingAgg = await this.prisma.imprestCase.aggregate({
      where: {
        tenantId: authz.tenantId,
        facilityId: facility.id,
        state: 'ISSUED' as any,
      },
      _sum: { requestedAmount: true },
    });

    const outstandingIssued = (outstandingAgg._sum.requestedAmount ?? new Prisma.Decimal(0)) as any as Prisma.Decimal;
    const projectedOutstanding = outstandingIssued.plus(row.requestedAmount as any);
    const approvedFloatLimit = facility.approvedFloatLimit as any as Prisma.Decimal;
    if (projectedOutstanding.gt(approvedFloatLimit)) {
      throw new BadRequestException('Issuing this imprest would exceed the facility’s approved float limit.');
    }

    if (facility.fundingSourceType === ('BANK' as any) && !facility.bankAccountId) {
      throw new BadRequestException('Facility fundingSourceType=BANK but bankAccountId is missing');
    }

    if (facility.fundingSourceType !== ('BANK' as any)) {
      throw new BadRequestException('Phase 1 supports issuance posting for BANK funding source only');
    }

    const bank = await this.prisma.bankAccount.findFirst({
      where: { id: facility.bankAccountId!, tenantId: authz.tenantId },
      select: { id: true, glAccountId: true, status: true },
    });
    if (!bank) throw new NotFoundException('Funding bank account not found');
    if (bank.status !== ('ACTIVE' as any)) {
      throw new ForbiddenException('Funding bank account is not ACTIVE');
    }

    const issueDate = new Date(dto.issueDate);
    if (Number.isNaN(issueDate.getTime())) throw new BadRequestException('Invalid issueDate');

    const journal = await this.createPostedIssuanceJournal({
      tenantId: authz.tenantId,
      actorUserId: authz.id,
      journalDate: issueDate,
      reference: row.reference,
      description: `Imprest issuance: ${row.reference}`,
      sourceId: row.id,
      debitAccountId: facility.controlGlAccountId,
      creditAccountId: bank.glAccountId,
      amount: row.requestedAmount as any,
    });

    const now = new Date();
    const updated = await this.prisma.imprestCase.update({
      where: { id: row.id },
      data: {
        state: 'ISSUED' as any,
        issuedAt: now,
        issuedById: authz.id,
        issuedJournalId: journal.id,
      },
    });

    await this.logTransition({
      tenantId: authz.tenantId,
      caseId: row.id,
      fromState: row.state,
      toState: 'ISSUED',
      actorUserId: authz.id,
      notes: dto.notes ?? null,
      metadata: { journalId: journal.id },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.IMPREST_CASE_ISSUED,
        entityType: AuditEntityType.IMPREST_CASE,
        entityId: row.id,
        actorUserId: authz.id,
        timestamp: now,
        outcome: 'SUCCESS' as any,
        action: PERMISSIONS.IMPREST.CASE_ISSUE,
        permissionUsed: PERMISSIONS.IMPREST.CASE_ISSUE,
        metadata: { journalId: journal.id },
      },
      this.prisma,
    );

    return { case: updated, journal };
  }

  async settleCase(req: Request, id: string, dto: SettleImprestCaseDto) {
    const { user } = this.getTenantAndUser(req);
    const authz = await this.getUserAuthz(req);
    requirePermission(authz, PERMISSIONS.IMPREST.CASE_SETTLE);

    const row = await this.prisma.imprestCase.findFirst({
      where: { id, tenantId: authz.tenantId },
      select: {
        id: true,
        reference: true,
        tenantId: true,
        state: true,
        issuedJournalId: true,
        settlementJournalId: true,
        requestedAmount: true,
        facility: {
          select: {
            id: true,
            fundingSourceType: true,
            bankAccountId: true,
            controlGlAccountId: true,
            entityId: true,
            departmentId: true,
            projectId: true,
            fundId: true,
          },
        },
        settlementLines: { select: { type: true, amount: true, glAccountId: true } },
      },
    });
    if (!row) throw new NotFoundException('Imprest case not found');

    if ((row.state as any) === ('SETTLED' as any)) {
      throw new BadRequestException('This imprest case is already settled.');
    }

    if ((row.state as any) !== ('ISSUED' as any)) {
      throw new BadRequestException('Only ISSUED imprest cases can be settled.');
    }

    if (!row.issuedJournalId) {
      throw new BadRequestException('Cannot settle imprest case: issuance journal is missing.');
    }

    if (row.settlementJournalId) {
      throw new BadRequestException('Cannot settle imprest case: settlement journal already exists.');
    }

    const facility = row.facility as any;
    if (!facility) throw new NotFoundException('Imprest facility not found');

    if (!facility.entityId) {
      throw new BadRequestException('Imprest facility is missing legal entity (entityId)');
    }

    if (!facility.departmentId) {
      throw new BadRequestException('Imprest facility is missing department/cost centre (departmentId)');
    }

    const entity = await this.prisma.entity.findFirst({
      where: { id: facility.entityId, tenantId: authz.tenantId },
      select: { id: true, name: true },
    });
    if (!entity) {
      throw new BadRequestException('Imprest facility legal entity reference is invalid');
    }

    const lines = (row.settlementLines as any) ?? [];
    if (lines.length === 0) {
      throw new BadRequestException('You must add at least one settlement line before settling this imprest.');
    }

    const summary = this.computeSettlementSummary({
      requestedAmount: row.requestedAmount as any,
      lines,
    });

    if (!summary.difference.equals(0)) {
      throw new BadRequestException(
        'Issued amount must equal total expenses plus cash returned before this imprest can be settled.',
      );
    }

    const settlementDate = dto.settlementDate ? new Date(dto.settlementDate) : new Date();
    if (Number.isNaN(settlementDate.getTime())) {
      throw new BadRequestException('Invalid settlementDate');
    }

    const expenseByAccount = new Map<string, Prisma.Decimal>();
    let cashReturned = new Prisma.Decimal(0);
    for (const l of lines) {
      const t = String(l.type ?? '').toUpperCase();
      if (t === 'EXPENSE') {
        if (!l.glAccountId) {
          throw new BadRequestException('Expense settlement lines require a GL account');
        }
        const prev = expenseByAccount.get(l.glAccountId) ?? new Prisma.Decimal(0);
        expenseByAccount.set(l.glAccountId, prev.plus(l.amount));
      } else if (t === 'CASH_RETURN') {
        cashReturned = cashReturned.plus(l.amount);
      }
    }

    if (facility.fundingSourceType !== ('BANK' as any)) {
      throw new BadRequestException('Phase 3A supports settlement posting for BANK funding source only');
    }
    if (!facility.bankAccountId) {
      throw new BadRequestException('Facility fundingSourceType=BANK but bankAccountId is missing');
    }

    const bank = await this.prisma.bankAccount.findFirst({
      where: { id: facility.bankAccountId, tenantId: authz.tenantId },
      select: { id: true, glAccountId: true, status: true },
    });
    if (!bank) throw new NotFoundException('Funding bank account not found');
    if (bank.status !== ('ACTIVE' as any)) {
      throw new ForbiddenException('Funding bank account is not ACTIVE');
    }

    const legalEntity = await (this.prisma.legalEntity as any).findFirst({
      where: {
        tenantId: authz.tenantId,
        name: entity.name,
        isActive: true,
        effectiveFrom: { lte: settlementDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: settlementDate } }],
      },
      select: { id: true },
    });

    if (!legalEntity) {
      throw new BadRequestException(
        `No active Legal Entity is configured for this Imprest facility (missing LegalEntity with name: ${entity.name}).`,
      );
    }

    const dims = {
      legalEntityId: legalEntity.id as string,
      departmentId: facility.departmentId as string,
      projectId: facility.projectId ?? null,
      fundId: facility.fundId ?? null,
    };

    const journalLines: Array<{
      accountId: string;
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
      legalEntityId: string;
      departmentId: string;
      projectId?: string | null;
      fundId?: string | null;
      lineNumber: number;
    }> = [];

    let lineNo = 1;

    const expenseAccountIds = Array.from(expenseByAccount.keys());
    for (const accountId of expenseAccountIds) {
      const amount = expenseByAccount.get(accountId)!;
      if (amount.lte(0)) continue;
      journalLines.push({
        accountId,
        debit: amount,
        credit: new Prisma.Decimal(0),
        ...dims,
        lineNumber: lineNo++,
      });
    }

    if (cashReturned.gt(0)) {
      journalLines.push({
        accountId: bank.glAccountId,
        debit: cashReturned,
        credit: new Prisma.Decimal(0),
        ...dims,
        lineNumber: lineNo++,
      });
    }

    const requestedAmount = row.requestedAmount as any as Prisma.Decimal;
    journalLines.push({
      accountId: facility.controlGlAccountId,
      debit: new Prisma.Decimal(0),
      credit: requestedAmount,
      ...dims,
      lineNumber: lineNo++,
    });

    const now = new Date();

    const { updated, journal } = await this.prisma.$transaction(async (tx) => {
      const journal = await this.createPostedSettlementJournal(tx as any, {
        tenantId: authz.tenantId,
        actorUserId: authz.id,
        journalDate: settlementDate,
        reference: row.reference ?? row.id,
        description: `Imprest settlement: ${row.reference ?? row.id}`,
        sourceId: row.id,
        lines: journalLines,
      });

      const updated = await (tx as any).imprestCase.update({
        where: { id: row.id },
        data: {
          state: 'SETTLED' as any,
          settlementDate,
          settledAt: now,
          settledByUserId: authz.id,
          settlementJournalId: journal.id,
        },
      });

      return { updated, journal };
    });

    await this.logTransition({
      tenantId: authz.tenantId,
      caseId: row.id,
      fromState: row.state,
      toState: 'SETTLED',
      actorUserId: authz.id,
      notes: dto.notes ?? null,
      metadata: { settlementDate: settlementDate.toISOString(), journalId: journal.id },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: authz.tenantId,
        eventType: AuditEventType.IMPREST_CASE_SETTLED,
        entityType: AuditEntityType.IMPREST_CASE,
        entityId: row.id,
        actorUserId: authz.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: PERMISSIONS.IMPREST.CASE_SETTLE,
        permissionUsed: PERMISSIONS.IMPREST.CASE_SETTLE,
        metadata: { settlementDate: settlementDate.toISOString(), journalId: journal.id },
      },
      this.prisma,
    );

    return updated;
  }
}
