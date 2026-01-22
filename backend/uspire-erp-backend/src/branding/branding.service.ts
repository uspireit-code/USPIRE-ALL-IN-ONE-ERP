import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../storage/storage.provider';
import { Inject } from '@nestjs/common';

@Injectable()
export class BrandingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  private ensureTenant(req: Request) {
    const queryTenantId = String((req.query as any)?.tenantId ?? '').trim();
    if (queryTenantId) return { id: queryTenantId };

    const tenant: any = (req as any).tenant;
    if (!tenant?.id) throw new BadRequestException('Missing tenant context');
    return tenant as { id: string };
  }

  async getCurrent(req: Request) {
    const tenant = this.ensureTenant(req);

    const row = await this.prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: {
        id: true,
        organisationName: true,
        organisationShortName: true,
        logoUrl: true,
        primaryColor: true,
        updatedAt: true,
      },
    });

    if (!row) throw new NotFoundException('Tenant not found');

    return {
      organisationName: row.organisationName,
      organisationShortName: row.organisationShortName,
      logoUrl: row.logoUrl ? `/branding/logo?tenantId=${encodeURIComponent(tenant.id)}` : null,
      primaryColor: row.primaryColor,
    };
  }

  async getLogo(req: Request) {
    const tenant = this.ensureTenant(req);

    const row = await this.prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { logoUrl: true },
    });

    if (!row?.logoUrl) throw new NotFoundException('No logo uploaded');

    const buf = await this.storage.get(row.logoUrl);
    const fileName = row.logoUrl.split('/').pop() ?? 'logo';

    const mimeType = fileName.toLowerCase().endsWith('.svg')
      ? 'image/svg+xml'
      : fileName.toLowerCase().endsWith('.png')
        ? 'image/png'
        : 'image/jpeg';

    return { body: buf, mimeType, fileName };
  }
}
