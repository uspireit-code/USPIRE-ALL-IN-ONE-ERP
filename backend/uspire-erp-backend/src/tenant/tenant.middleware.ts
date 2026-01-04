import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const rawTenantId = req.header('x-tenant-id');
    const tenantId = String(rawTenantId ?? '').trim();

    if ((process.env.DEBUG_AUTH ?? '').toString().toLowerCase() === 'true') {
      // eslint-disable-next-line no-console
      console.log('[TenantMiddleware]', {
        method: req.method,
        path: (req as any).originalUrl ?? req.url,
        hasHeader: Boolean(rawTenantId),
        headerTenantId: tenantId || null,
      });
    }

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
