import { BadRequestException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuditEntityType, AuditEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { writeAuditEventWithPrisma } from '../audit/audit-writer';

@Injectable()
export class ReportAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async reportView(params: {
    req: Request;
    entityId: string;
    permissionUsed: string;
    outcome: 'SUCCESS' | 'BLOCKED' | 'FAILED';
    reason?: string;
  }) {
    const tenant = params.req.tenant;
    const user = params.req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    return writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.REPORT_VIEW,
        entityType: AuditEntityType.REPORT,
        entityId: params.entityId,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: params.outcome as any,
        action: 'VIEW',
        permissionUsed: params.permissionUsed,
        reason: params.reason,
      },
      this.prisma,
    );
  }

  async reportExport(params: {
    req: Request;
    entityId: string;
    permissionUsed: string;
    format: 'PDF' | 'CSV' | 'XLSX';
    outcome: 'SUCCESS' | 'BLOCKED' | 'FAILED';
    reason?: string;
  }) {
    const tenant = params.req.tenant;
    const user = params.req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    return writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.REPORT_EXPORT,
        entityType: AuditEntityType.REPORT,
        entityId: params.entityId,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: params.outcome as any,
        action: `EXPORT_${params.format}`,
        permissionUsed: params.permissionUsed,
        reason: params.reason,
        metadata: {
          format: params.format,
        },
      },
      this.prisma,
    );
  }
}
