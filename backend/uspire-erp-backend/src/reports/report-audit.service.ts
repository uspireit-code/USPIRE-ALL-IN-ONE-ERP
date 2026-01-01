import { BadRequestException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

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

    return this.prisma.auditEvent.create({
      data: {
        tenantId: tenant.id,
        eventType: 'REPORT_VIEW',
        entityType: 'REPORT',
        entityId: params.entityId,
        action: 'VIEW',
        outcome: params.outcome,
        reason: params.reason,
        userId: user.id,
        permissionUsed: params.permissionUsed,
      },
    });
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

    return this.prisma.auditEvent.create({
      data: {
        tenantId: tenant.id,
        eventType: 'REPORT_EXPORT',
        entityType: 'REPORT',
        entityId: params.entityId,
        action: `EXPORT_${params.format}`,
        outcome: params.outcome,
        reason: params.reason,
        userId: user.id,
        permissionUsed: params.permissionUsed,
      },
    });
  }
}
