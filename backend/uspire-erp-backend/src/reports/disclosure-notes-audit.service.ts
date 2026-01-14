import { BadRequestException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuditEntityType, AuditEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { writeAuditEventWithPrisma } from '../audit/audit-writer';

@Injectable()
export class DisclosureNotesAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async disclosureNoteGenerate(params: {
    req: Request;
    noteId: string;
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
        eventType: AuditEventType.DISCLOSURE_NOTE_GENERATE,
        entityType: AuditEntityType.DISCLOSURE_NOTE,
        entityId: params.noteId,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: params.outcome as any,
        action: 'GENERATE',
        permissionUsed: params.permissionUsed,
        reason: params.reason,
      },
      this.prisma,
    );
  }

  async disclosureNoteView(params: {
    req: Request;
    noteId: string;
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
        eventType: AuditEventType.DISCLOSURE_NOTE_VIEW,
        entityType: AuditEntityType.DISCLOSURE_NOTE,
        entityId: params.noteId,
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
}
