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

  private async ensureTenantForLoginBranding(
    req: Request,
    options?: { allowDefaultTenant?: boolean },
  ) {
    const queryTenantId = String((req.query as any)?.tenantId ?? '').trim();

    if (options?.allowDefaultTenant && (!queryTenantId || queryTenantId === 'default')) {
      const firstTenant = await this.prisma.tenant.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      if (!firstTenant?.id) throw new NotFoundException('Tenant not found');
      return { id: firstTenant.id };
    }

    return this.ensureTenant(req);
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
      logoUrl: row.logoUrl ? `/api/branding/logo?tenantId=${encodeURIComponent(tenant.id)}` : null,
      primaryColor: row.primaryColor,
    };
  }

  async getLoginBranding(req: Request, options?: { allowDefaultTenant?: boolean }) {
    const tenant = await this.ensureTenantForLoginBranding(req, options);

    const row = await this.prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: {
        loginPageTitle: true,
        loginPageBackgroundUrl: true,
        logoUrl: true,
      },
    });

    if (!row) throw new NotFoundException('Tenant not found');

    return {
      loginPageTitle: row.loginPageTitle,
      loginPageBackgroundUrl: row.loginPageBackgroundUrl ?? null,
      logoUrl: row.logoUrl ? `/api/branding/logo?tenantId=${encodeURIComponent(tenant.id)}` : null,
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
