import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LegalEntityMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const rawLegalEntityId = req.header('x-legal-entity-id');
    const legalEntityId = String(rawLegalEntityId ?? '').trim();

    if (!legalEntityId) {
      next();
      return;
    }

    const tenantId = String((req as any)?.tenant?.id ?? '').trim();
    if (!tenantId) {
      res.status(400).json({ error: 'Missing tenant context' });
      return;
    }

    const le = await this.prisma.legalEntity.findFirst({
      where: {
        id: legalEntityId,
        tenantId,
        isActive: true,
      },
      select: {
        id: true,
        tenantId: true,
        isActive: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    });

    if (!le) {
      res.status(404).json({ error: 'Legal entity not found' });
      return;
    }

    const now = new Date();
    const effectiveFrom = le.effectiveFrom instanceof Date ? le.effectiveFrom : new Date(String(le.effectiveFrom));
    const effectiveTo = le.effectiveTo
      ? le.effectiveTo instanceof Date
        ? le.effectiveTo
        : new Date(String(le.effectiveTo))
      : null;

    const isEffective =
      !Number.isNaN(effectiveFrom.getTime()) &&
      effectiveFrom.getTime() <= now.getTime() &&
      (!effectiveTo || (Number.isFinite(effectiveTo.getTime()) && effectiveTo.getTime() >= now.getTime()));

    if (!isEffective) {
      res.status(400).json({ error: 'Legal entity is not effective' });
      return;
    }

    (req as any).legalEntity = le;
    next();
  }
}
