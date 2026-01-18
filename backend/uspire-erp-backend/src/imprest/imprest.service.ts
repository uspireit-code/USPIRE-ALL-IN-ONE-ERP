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
  IssueImprestCaseDto,
  LinkImprestEvidenceDto,
  RejectImprestCaseDto,
  ReviewImprestCaseDto,
  SubmitImprestCaseDto,
} from './dto/imprest-case.dto';

@Injectable()
export class ImprestService {
  private readonly IMPREST_CASE_SEQUENCE_NAME = 'IMPREST_CASE';
  private readonly JOURNAL_NUMBER_SEQUENCE_NAME = 'JOURNAL_ENTRY';

  constructor(private readonly prisma: PrismaService) {}

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

    if (dto.fundingSourceType === 'BANK' && !dto.bankAccountId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Funding source is Bank. Please select a valid Bank Account.',
      });
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
          validFrom: new Date(dto.validFrom),
          validTo: new Date(dto.validTo),
          status: 'ACTIVE' as any,
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
        'Unable to save facility. Please review the entered values and try again.',
      );
      if (generic) {
        throw new BadRequestException(generic);
      }
      throw err;
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
      include: { evidence: { include: { evidence: true } }, transitions: true, facility: true },
    });
    if (!row) throw new NotFoundException('Imprest case not found');
    return row;
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

    const unsettled = await this.prisma.imprestCase.count({
      where: {
        tenantId: authz.tenantId,
        facilityId: facility.id,
        state: { in: ['ISSUED', 'RETIREMENT_SUBMITTED', 'RETIREMENT_REVIEW'] as any },
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
          requestedAmount: new Prisma.Decimal(dto.requestedAmount),
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
}
