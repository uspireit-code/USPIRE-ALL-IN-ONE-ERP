import { BadRequestException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { PrismaService } from '../prisma/prisma.service';
import { GovernanceExceptionRegisterQueryDto } from './dto/governance-exception-register-query.dto';
import { GovernanceOverrideSessionRegisterQueryDto } from './dto/governance-override-session-register-query.dto';
import { GovernanceEvidenceRegisterQueryDto } from './dto/governance-evidence-register-query.dto';

type ExceptionCategory = GovernanceExceptionRegisterQueryDto['category'];

const CATEGORY_EVENT_TYPES: Record<NonNullable<ExceptionCategory>, string[]> = {
  SOD: [
    'DELEGATION_ACTION_BLOCKED_SOD',
    'GL_JOURNAL_SOD_VIOLATION_BLOCKED',
    'SOD_BLOCKED',
  ],
  LIFECYCLE: ['LIFECYCLE_GUARD_BLOCKED', 'GL_LIFECYCLE_BYPASS_BLOCKED', 'GL_JOURNAL_POST_BLOCKED'],
  IMMUTABILITY: ['IMMUTABILITY_GUARD_BLOCKED'],
  OVERRIDE: [
    'OVERRIDE_SESSION_CREATED',
    'OVERRIDE_SESSION_UPDATED',
    'OVERRIDE_SESSION_APPROVED',
    'OVERRIDE_SESSION_REJECTED',
    'OVERRIDE_SESSION_REVOKED',
    'OVERRIDE_SESSION_EXPIRED',
    'OVERRIDE_SESSION_EXECUTED',
  ],
  EVIDENCE: ['EVIDENCE_REQUIRED', 'MISSING_SUPPORT_DOCUMENT', 'INVALID_ATTACHMENT_TYPE'],
  AUTOMATION: [
    'AUTOMATION_EXECUTION_FAILED',
    'AUTOMATION_ESCALATED',
    'AUTOMATION_OVERRIDE_USED',
    'AUTOMATION_EXECUTION_COMPLETED',
  ],
};

function pickDefaultEventTypes(params: { category?: ExceptionCategory }) {
  if (params.category) return CATEGORY_EVENT_TYPES[params.category];

  const all = new Set<string>();
  for (const k of Object.keys(CATEGORY_EVENT_TYPES) as Array<keyof typeof CATEGORY_EVENT_TYPES>) {
    for (const t of CATEGORY_EVENT_TYPES[k]) all.add(t);
  }
  return Array.from(all);
}

@Injectable()
export class GovernanceRegistersService {
  constructor(private readonly prisma: PrismaService) {}

  async listExceptionRegister(req: Request, dto: GovernanceExceptionRegisterQueryDto) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const where: any = {
      tenantId: tenant.id,
    };

    if (dto.entityType) where.entityType = String(dto.entityType).trim();
    if (dto.entityId) where.entityId = String(dto.entityId).trim();
    if (dto.userId) where.userId = dto.userId;

    if (dto.from || dto.to) {
      const createdAt: any = {};
      if (dto.from) createdAt.gte = new Date(dto.from);
      if (dto.to) createdAt.lte = new Date(dto.to);
      where.createdAt = createdAt;
    }

    if (dto.eventType) {
      where.eventType = String(dto.eventType).trim();
    } else {
      where.eventType = {
        in: pickDefaultEventTypes({ category: dto.category }),
      };
    }

    if (dto.outcome) {
      where.outcome = dto.outcome;
    } else {
      where.outcome = { in: ['BLOCKED', 'FAILED'] };
    }

    const limit = dto.limit ?? 50;
    const offset = dto.offset ?? 0;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          tenantId: true,
          eventType: true,
          entityType: true,
          entityId: true,
          action: true,
          outcome: true,
          reason: true,
          permissionUsed: true,
          requestId: true,
          createdAt: true,
          user: { select: { id: true, email: true } },
        },
      }),
      this.prisma.auditEvent.count({ where }),
    ]);

    return {
      total,
      limit,
      offset,
      rows,
    };
  }

  async listOverrideSessionsRegister(req: Request, dto: GovernanceOverrideSessionRegisterQueryDto) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const where: any = {
      tenantId: tenant.id,
    };

    if (dto.status) where.status = String(dto.status).trim();
    if (dto.overrideCode) where.overrideCode = String(dto.overrideCode).trim();
    if (dto.requestedById) where.requestedById = dto.requestedById;

    if (dto.from || dto.to) {
      const createdAt: any = {};
      if (dto.from) createdAt.gte = new Date(dto.from);
      if (dto.to) createdAt.lte = new Date(dto.to);
      where.createdAt = createdAt;
    }

    const limit = dto.limit ?? 50;
    const offset = dto.offset ?? 0;

    const [rows, total] = await this.prisma.$transaction([
      (this.prisma as any).governanceOverrideSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      (this.prisma as any).governanceOverrideSession.count({ where }),
    ]);

    return {
      total,
      limit,
      offset,
      rows,
    };
  }

  async listEvidenceRegister(req: Request, dto: GovernanceEvidenceRegisterQueryDto) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const where: any = {
      tenantId: tenant.id,
    };

    if (dto.entityType) where.entityType = String(dto.entityType).trim();
    if (dto.entityId) where.entityId = String(dto.entityId).trim();

    if (dto.governanceDomain) where.governanceDomain = String(dto.governanceDomain).trim();
    if (dto.governanceActionType)
      where.governanceActionType = String(dto.governanceActionType).trim();
    if (dto.evidenceCategory) where.evidenceCategory = String(dto.evidenceCategory).trim();
    if (dto.auditSensitivity) where.auditSensitivity = String(dto.auditSensitivity).trim();

    if (dto.from || dto.to) {
      const createdAt: any = {};
      if (dto.from) createdAt.gte = new Date(dto.from);
      if (dto.to) createdAt.lte = new Date(dto.to);
      where.createdAt = createdAt;
    }

    const limit = dto.limit ?? 50;
    const offset = dto.offset ?? 0;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditEvidence.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          tenantId: true,
          entityType: true,
          entityId: true,
          fileName: true,
          mimeType: true,
          size: true,
          sha256Hash: true,
          uploadedById: true,
          createdAt: true,
          governanceDomain: true,
          governanceActionType: true,
          evidenceCategory: true,
          retentionClassification: true,
          auditSensitivity: true,
          justificationText: true,
          uploadedBy: { select: { id: true, email: true } },
        },
      }),
      this.prisma.auditEvidence.count({ where }),
    ]);

    return {
      total,
      limit,
      offset,
      rows,
    };
  }
}
