import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.header('x-tenant-id');

    if (!tenantId) {
      next();
      return;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    req.tenant = tenant;
    next();
  }
}
