import { BadRequestException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

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

    return this.prisma.auditEvent.create({
      data: {
        tenantId: tenant.id,
        eventType: 'DISCLOSURE_NOTE_GENERATE',
        entityType: 'DISCLOSURE_NOTE',
        entityId: params.noteId,
        action: 'GENERATE',
        outcome: params.outcome,
        reason: params.reason,
        userId: user.id,
        permissionUsed: params.permissionUsed,
      },
    });
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

    return this.prisma.auditEvent.create({
      data: {
        tenantId: tenant.id,
        eventType: 'DISCLOSURE_NOTE_VIEW',
        entityType: 'DISCLOSURE_NOTE',
        entityId: params.noteId,
        action: 'VIEW',
        outcome: params.outcome,
        reason: params.reason,
        userId: user.id,
        permissionUsed: params.permissionUsed,
      },
    });
  }
}
