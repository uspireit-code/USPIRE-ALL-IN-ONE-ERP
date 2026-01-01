import { BadRequestException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditEventsQueryDto } from './dto/audit-events-query.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async listEvents(req: Request, dto: AuditEventsQueryDto) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const where: any = {
      tenantId: tenant.id,
    };

    if (dto.entityType) {
      where.entityType = dto.entityType;
    }

    if (dto.entityId) {
      where.entityId = dto.entityId;
    }

    if (dto.userId) {
      where.userId = dto.userId;
    }

    if (dto.eventType) {
      where.eventType = dto.eventType;
    }

    if (dto.from || dto.to) {
      const createdAt: any = {};
      if (dto.from) createdAt.gte = new Date(dto.from);
      if (dto.to) createdAt.lte = new Date(dto.to);
      where.createdAt = createdAt;
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
}
